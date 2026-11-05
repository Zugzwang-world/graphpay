// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

/// @dev The canonical Permit2 implements both transfer styles at one address.
interface IPermit2 is ISignatureTransfer, IAllowanceTransfer {}

/// @dev The packed-bytes EIP-2612 overload Tether's token implements (selector 0x9fd5a6cf).
interface IERC20PermitBytes {
    function permit(address owner, address spender, uint256 value, uint256 deadline, bytes calldata signature)
        external;
}

/// @title GraphPayCheckout
/// @notice Orders, refunds, subscriptions and agent spending policies for one token, paid
/// gaslessly through Permit2 (planning/SPEC/PAYMENTS_WHITECHAIN.md §3, §4). The payer signs
/// a Permit2 witness that carries the order terms, so no role can redirect or change a
/// payment. Payment problems are recorded as events, never as silent reverts; caller
/// mistakes revert. The contract never holds funds: money moves payer to merchant and back.
contract GraphPayCheckout is Ownable2Step, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    enum Status {
        NONE,
        CREATED,
        PAID,
        DELIVERED,
        CANCELLED,
        REFUNDED
    }

    enum SubStatus {
        NONE,
        ACTIVE,
        LAPSED,
        CANCELLED
    }

    enum FailReason {
        NONE,
        AGENT_REVOKED,
        SPEND_CAP,
        TRANSFER_FAILED,
        EXPIRED,
        DUPLICATE,
        AGENT_EXPIRED,
        NODE_MISMATCH
    }

    enum DisputeStatus {
        NONE,
        OPEN,
        RESOLVED
    }

    /// @notice The terms the payer signs (as the `GraphPayOrder` witness, with a mandate hash).
    struct Order {
        bytes32 orderId;
        bytes32 parentOrderId;
        bytes32 buyerNode;
        bytes32 shopNode;
        bytes32 payerNode; // 0 = a human payer
        address merchant;
        uint64 amountMicro;
        uint64 deadline;
        uint8 kind; // 0 one-off, 1 re-order, 2 renewal
    }

    /// @notice The terms a subscriber signs (as `Subscribe`, bound to a Permit2 `PermitSingle`).
    struct Sub {
        bytes32 subId;
        bytes32 subscriberNode;
        bytes32 shopNode;
        bytes32 payerNode;
        address subscriber;
        address merchant;
        uint64 amountMicro;
        uint32 period;
        uint64 firstChargeAt;
    }

    struct AgentPolicy {
        uint32 epoch;
        address wallet;
        bool revoked;
        uint64 dailyCapMicro; // 0 = may not spend; type(uint64).max = unlimited
        uint64 expiry; // 0 = never
    }

    /// @notice What the chain keeps per order. The full terms are in `OrderCreated`; `termsHash`
    /// is keccak256(abi.encode(Order)). A paid order has paid exactly `amountMicro`.
    struct OrderState {
        bytes32 termsHash;
        bytes32 buyerNode;
        bytes32 shopNode;
        address merchant;
        uint64 amountMicro;
        uint8 kind;
        Status status;
        DisputeStatus dispute;
        uint8 disputeReason;
        address payer; // set when paid
        uint64 refundedMicro;
    }

    struct SubState {
        bytes32 subscriberNode;
        bytes32 shopNode;
        bytes32 payerNode;
        address subscriber;
        uint64 amountMicro;
        uint32 period;
        address merchant;
        uint64 nextChargeAt;
        uint32 cycle; // successful charges so far; the first charge is cycle 1
        uint64 retryAt;
        uint8 failures; // consecutive
        SubStatus status;
    }

    uint8 public constant KIND_ONE_OFF = 0;
    uint8 public constant KIND_REORDER = 1;
    uint8 public constant KIND_RENEWAL = 2;
    /// @notice A pull or an approval starts only with this much gas left, so a starved call
    /// reverts instead of being recorded as a failed payment (`catch` swallows out-of-gas).
    uint256 public constant MIN_PULL_GAS = 150_000;
    uint8 public constant MAX_RENEWAL_FAILURES = 3;
    uint64 public constant RETRY_DELAY = 1 days;
    /// @dev Renewal order ids live in their own id space (the top bit set), so nobody can
    /// squat a subscription's next renewal through `settleOrder` (E-5).
    uint256 private constant RENEWAL_BIT = 1 << 255;

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "GraphPayOrder(bytes32 orderId,bytes32 parentOrderId,bytes32 buyerNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint64 deadline,uint8 kind,bytes32 mandateHash)"
    );
    string public constant WITNESS_TYPE =
        "GraphPayOrder witness)GraphPayOrder(bytes32 orderId,bytes32 parentOrderId,bytes32 buyerNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint64 deadline,uint8 kind,bytes32 mandateHash)TokenPermissions(address token,uint256 amount)";
    bytes32 public constant SUBSCRIBE_TYPEHASH = keccak256(
        "Subscribe(bytes32 subId,bytes32 subscriberNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint32 period,uint64 firstChargeAt,bytes32 permitHash)"
    );
    bytes32 public constant CANCEL_TYPEHASH = keccak256("Cancel(bytes32 subId,uint64 deadline)");

    /// @notice The one token of this deployment (test USDT); the name stays for a stable ABI.
    IERC20 public immutable USDT;
    IPermit2 public immutable PERMIT2;

    mapping(address => bool) public isRelayer;
    mapping(address => bool) public isPolicyWriter;
    mapping(address => bytes32) public nodeOfWallet;

    mapping(bytes32 => AgentPolicy) private _policies;
    mapping(bytes32 => mapping(uint32 => mapping(uint256 => uint64))) private _spent; // node, epoch, day
    mapping(bytes32 => OrderState) private _orders;
    mapping(bytes32 => SubState) private _subs;
    bytes32[] private _subIds;

    event OrderCreated(
        bytes32 indexed orderId,
        bytes32 indexed shopNode,
        bytes32 indexed buyerNode,
        bytes32 payerNode,
        address merchant,
        uint64 amountMicro,
        uint64 deadline,
        bytes32 parentOrderId,
        uint8 kind
    );
    event PaymentSettled(
        bytes32 indexed orderId,
        bytes32 indexed payerNode,
        bytes32 indexed shopNode,
        address payer,
        uint64 amountMicro,
        uint64 day,
        bytes32 mandateHash,
        uint32 payerEpoch
    );
    event PaymentFailed(
        bytes32 indexed orderId,
        bytes32 indexed payerNode,
        bytes32 indexed shopNode,
        uint64 amountMicro,
        FailReason reason,
        uint32 payerEpoch
    );
    event Refunded(
        bytes32 indexed orderId,
        bytes32 indexed shopNode,
        bytes32 indexed buyerNode,
        uint64 amountMicro,
        uint64 totalRefundedMicro,
        bool full,
        uint8 reason
    );
    event OrderDelivered(bytes32 indexed orderId, bytes32 indexed shopNode, uint64 deliveredAt);
    event OrderCancelled(bytes32 indexed orderId, bytes32 indexed byNode, uint8 reason);
    event Disputed(bytes32 indexed orderId, bytes32 indexed buyerNode, bytes32 indexed shopNode, uint8 reason);
    event DisputeResolved(bytes32 indexed orderId, uint8 outcome, uint64 refundMicro);
    event SubscriptionCreated(
        bytes32 indexed subId,
        bytes32 indexed subscriberNode,
        bytes32 indexed shopNode,
        uint64 amountMicro,
        uint32 period,
        uint64 firstChargeAt
    );
    event SubscriptionRenewed(bytes32 indexed subId, bytes32 indexed orderId, uint32 cycle, uint64 amountMicro);
    event RenewalFailed(bytes32 indexed subId, uint32 cycle, FailReason reason);
    event SubscriptionLapsed(bytes32 indexed subId, uint32 cycle);
    event SubscriptionCancelled(bytes32 indexed subId, bytes32 indexed byNode, uint64 effectiveAt);
    event AgentPolicySet(
        bytes32 indexed payerNode, uint32 epoch, address wallet, bool revoked, uint64 dailyCapMicro, uint64 expiry
    );
    event RelayerSet(address indexed relayer, bool allowed);
    event PolicyWriterSet(address indexed writer, bool allowed);

    error NotRelayer();
    error NotPolicyWriter();
    error NotAllowed();
    error BadInput(string what);
    error UnknownOrder();
    error BadState();
    error TermsMismatch();

    modifier onlyRelayer() {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        _;
    }

    modifier onlyPolicyWriter() {
        if (!isPolicyWriter[msg.sender]) revert NotPolicyWriter();
        _;
    }

    constructor(address token, address permit2, address admin, address relayer, address policyWriter)
        Ownable(admin)
        EIP712("GraphPayCheckout", "1")
    {
        if (token.code.length == 0) revert BadInput("token");
        if (permit2.code.length == 0) revert BadInput("permit2");
        if (
            relayer == address(0) || policyWriter == address(0) || relayer == admin || policyWriter == admin
                || relayer == policyWriter
        ) revert BadInput("roles");
        USDT = IERC20(token);
        PERMIT2 = IPermit2(permit2);
        isRelayer[relayer] = true;
        isPolicyWriter[policyWriter] = true;
        emit RelayerSet(relayer, true);
        emit PolicyWriterSet(policyWriter, true);
    }

    // ---------------------------------------------------------------- admin

    /// @notice Relayers are a set, so scheduled renewals can use their own key (E-1).
    function setRelayer(address relayer, bool allowed) external onlyOwner {
        if (allowed) _checkNewRole(relayer, isPolicyWriter[relayer]);
        isRelayer[relayer] = allowed;
        emit RelayerSet(relayer, allowed);
    }

    function setPolicyWriter(address writer, bool allowed) external onlyOwner {
        if (allowed) _checkNewRole(writer, isRelayer[writer]);
        isPolicyWriter[writer] = allowed;
        emit PolicyWriterSet(writer, allowed);
    }

    /// @notice The next admin may hold no other role; it accepts with `acceptOwnership`.
    function transferOwnership(address newOwner) public override onlyOwner {
        if (isRelayer[newOwner] || isPolicyWriter[newOwner]) revert BadInput("role");
        super.transferOwnership(newOwner);
    }

    /// @notice The checkout always has an admin.
    function renounceOwnership() public pure override {
        revert NotAllowed();
    }

    // ---------------------------------------------------------------- policies

    /// @notice Binds `wallet` to `node` and sets its spending policy. A wallet backs at most one
    /// node; moving a node to a new wallet releases the old one; the epoch never decreases.
    function setPolicy(bytes32 node, uint32 epoch, address wallet, bool revoked, uint64 dailyCapMicro, uint64 expiry)
        external
        onlyPolicyWriter
    {
        if (node == bytes32(0) || wallet == address(0)) revert BadInput("policy");
        AgentPolicy storage p = _policies[node];
        address previous = p.wallet;
        if (previous != address(0) && epoch < p.epoch) revert BadInput("epoch");
        bytes32 bound = nodeOfWallet[wallet];
        if (bound != bytes32(0) && bound != node) revert BadInput("wallet bound to another node");
        if (previous != address(0) && previous != wallet) delete nodeOfWallet[previous];
        nodeOfWallet[wallet] = node;
        p.epoch = epoch;
        p.wallet = wallet;
        p.revoked = revoked;
        p.dailyCapMicro = dailyCapMicro;
        p.expiry = expiry;
        emit AgentPolicySet(node, epoch, wallet, revoked, dailyCapMicro, expiry);
    }

    // ---------------------------------------------------------------- orders

    /// @notice Creates the order if new and pays it with the payer's Permit2 witness signature
    /// (and an optional EIP-2612 approval of Permit2, so the payer needs no gas and no prior
    /// approval). A failed attempt is recorded and leaves the order CREATED, so the same signed
    /// permit can be retried until its deadline; a settled order is never paid twice.
    /// @param approvalPermit empty, or abi.encode(uint256 value, uint256 deadline, bytes signature)
    function settleOrder(
        Order calldata o,
        bytes32 mandateHash,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        address payer,
        bytes calldata sig,
        bytes calldata approvalPermit
    ) external onlyRelayer nonReentrant {
        if (o.orderId == bytes32(0) || uint256(o.orderId) & RENEWAL_BIT != 0) revert BadInput("order id");
        if (payer == address(0)) revert BadInput("payer");
        OrderState storage r = _orders[o.orderId];
        bytes32 terms = keccak256(abi.encode(o));
        Status status = r.status;
        if (status == Status.NONE) {
            _createOrder(r, o, terms);
        } else {
            if (r.termsHash != terms) revert TermsMismatch();
            if (status != Status.CREATED) {
                emit PaymentFailed(
                    o.orderId, o.payerNode, o.shopNode, o.amountMicro, FailReason.DUPLICATE, _policies[o.payerNode].epoch
                );
                return;
            }
        }

        (FailReason reason, uint32 epoch) = _checkPolicy(o.payerNode, payer, o.amountMicro);
        if (reason == FailReason.NONE) {
            if (block.timestamp > o.deadline) {
                reason = FailReason.EXPIRED;
            } else if (permit.permitted.token != address(USDT) || permit.permitted.amount < o.amountMicro) {
                // Permit2 binds the token in the signature, not our witness: pin it here.
                reason = FailReason.TRANSFER_FAILED;
            } else {
                reason = _pull(o, mandateHash, permit, payer, sig, approvalPermit);
            }
        }
        if (reason != FailReason.NONE) {
            emit PaymentFailed(o.orderId, o.payerNode, o.shopNode, o.amountMicro, reason, epoch);
            return;
        }

        r.status = Status.PAID;
        r.payer = payer;
        uint64 day = uint64(block.timestamp / 1 days);
        if (o.payerNode != bytes32(0)) _spent[o.payerNode][epoch][day] += o.amountMicro;
        emit PaymentSettled(o.orderId, o.payerNode, o.shopNode, payer, o.amountMicro, day, mandateHash, epoch);
    }

    function markDelivered(bytes32 orderId) external {
        OrderState storage r = _order(orderId);
        if (msg.sender != r.merchant) revert NotAllowed();
        if (r.status != Status.PAID) revert BadState();
        r.status = Status.DELIVERED;
        emit OrderDelivered(orderId, r.shopNode, uint64(block.timestamp));
    }

    /// @notice The merchant cancels an order nobody has paid; `byNode` must be the shop.
    function cancelOrder(bytes32 orderId, bytes32 byNode, uint8 reason) external {
        OrderState storage r = _order(orderId);
        if (msg.sender != r.merchant) revert NotAllowed();
        if (r.status != Status.CREATED) revert BadState();
        if (byNode != r.shopNode) revert BadInput("by node");
        r.status = Status.CANCELLED;
        emit OrderCancelled(orderId, byNode, reason);
    }

    /// @notice Partial or full refund from the merchant's own balance (it approves this contract
    /// for a bounded float), capped at what was paid.
    function refund(bytes32 orderId, uint64 amountMicro, uint8 reason) external nonReentrant {
        OrderState storage r = _order(orderId);
        if (msg.sender != r.merchant) revert NotAllowed();
        if (r.status != Status.PAID && r.status != Status.DELIVERED) revert BadState();
        if (amountMicro == 0 || uint256(r.refundedMicro) + amountMicro > r.amountMicro) revert BadInput("refund");
        _refund(orderId, r, amountMicro, reason);
    }

    // ---------------------------------------------------------------- disputes

    function openDispute(bytes32 orderId, uint8 reason) external {
        OrderState storage r = _order(orderId);
        if (msg.sender != r.payer) revert NotAllowed();
        if (r.status != Status.PAID && r.status != Status.DELIVERED) revert BadState();
        if (r.dispute != DisputeStatus.NONE) revert BadState();
        r.dispute = DisputeStatus.OPEN;
        r.disputeReason = reason;
        emit Disputed(orderId, r.buyerNode, r.shopNode, reason);
    }

    /// @param outcome 0 the shop is upheld (no refund), 1 the buyer is upheld
    /// @param refundMicro capped at what is left to refund; paid from the merchant's float
    function resolveDispute(bytes32 orderId, uint8 outcome, uint64 refundMicro) external onlyOwner nonReentrant {
        OrderState storage r = _order(orderId);
        if (r.dispute != DisputeStatus.OPEN) revert BadState();
        if (outcome > 1 || (outcome == 0 && refundMicro != 0)) revert BadInput("outcome");
        r.dispute = DisputeStatus.RESOLVED;
        uint64 left = r.amountMicro - r.refundedMicro;
        uint64 amount = refundMicro < left ? refundMicro : left;
        if (amount != 0) _refund(orderId, r, amount, r.disputeReason);
        emit DisputeResolved(orderId, outcome, amount);
    }

    // ---------------------------------------------------------------- subscriptions

    /// @notice Creates a subscription from the subscriber's signed `Subscribe` terms and Permit2
    /// `PermitSingle` (which binds no payee, amount or period), and takes the first charge when
    /// `firstChargeAt` has come.
    function createSubscription(
        Sub calldata s,
        IAllowanceTransfer.PermitSingle calldata ps,
        bytes calldata permitSig,
        bytes calldata subSig,
        bytes calldata approvalPermit
    ) external onlyRelayer nonReentrant {
        SubState storage st = _subs[s.subId];
        if (s.subId == bytes32(0) || st.status != SubStatus.NONE) revert BadInput("sub id");
        if (s.subscriber == address(0) || s.merchant == address(0) || s.amountMicro == 0 || s.period == 0) {
            revert BadInput("sub");
        }
        if (
            ps.spender != address(this) || ps.details.token != address(USDT) || ps.details.amount < s.amountMicro
                || ps.details.expiration <= s.firstChargeAt
        ) revert BadInput("permit terms");
        if (block.timestamp > ps.sigDeadline) revert BadInput("permit deadline");
        if (!SignatureChecker.isValidSignatureNow(s.subscriber, _subscribeDigest(s, ps), subSig)) {
            revert BadInput("subscribe signature");
        }
        // The payer node is the subscriber's own: a bound wallet pays only as its node, an
        // unbound one only as a human (node 0).
        if (nodeOfWallet[s.subscriber] != s.payerNode) revert BadInput("payer node");

        if (approvalPermit.length != 0) {
            _requirePullGas();
            _applyApproval(s.subscriber, approvalPermit);
        }
        try PERMIT2.permit(s.subscriber, ps, permitSig) {}
        catch {
            // Front-run: anyone may submit the signed permit first. Accept only if Permit2 shows it applied.
            (uint160 amount, uint48 expiration, uint48 nonce) =
                PERMIT2.allowance(s.subscriber, address(USDT), address(this));
            if (nonce <= ps.details.nonce || amount < ps.details.amount || expiration < ps.details.expiration) {
                revert BadInput("permit");
            }
        }

        st.subscriberNode = s.subscriberNode;
        st.shopNode = s.shopNode;
        st.payerNode = s.payerNode;
        st.subscriber = s.subscriber;
        st.amountMicro = s.amountMicro;
        st.period = s.period;
        st.merchant = s.merchant;
        st.nextChargeAt = s.firstChargeAt;
        st.status = SubStatus.ACTIVE;
        _subIds.push(s.subId);
        emit SubscriptionCreated(s.subId, s.subscriberNode, s.shopNode, s.amountMicro, s.period, s.firstChargeAt);

        if (s.firstChargeAt <= block.timestamp) _charge(s.subId, st);
    }

    /// @notice Charges a due subscription (a relayer's scheduled job, not x402). A failure is
    /// retried no sooner than a day later; three in a row lapse the subscription.
    function renew(bytes32 subId) external onlyRelayer nonReentrant {
        SubState storage st = _subs[subId];
        if (st.status == SubStatus.NONE) revert UnknownOrder();
        if (st.status != SubStatus.ACTIVE || block.timestamp < st.nextChargeAt || block.timestamp < st.retryAt) {
            revert BadState();
        }
        _charge(subId, st);
    }

    /// @notice Gasless cancel with the subscriber's `Cancel` signature. Cancelling does not revoke
    /// the Permit2 allowance (`Permit2.lockdown` does), but no renewal runs after it.
    function cancelWithSig(bytes32 subId, uint64 deadline, bytes calldata sig) external {
        SubState storage st = _subs[subId];
        if (st.status == SubStatus.NONE) revert UnknownOrder();
        if (block.timestamp > deadline) revert BadInput("deadline");
        if (!SignatureChecker.isValidSignatureNow(st.subscriber, _cancelDigest(subId, deadline), sig)) {
            revert BadInput("cancel signature");
        }
        _cancel(subId, st, st.subscriberNode);
    }

    function cancelSubscription(bytes32 subId) external {
        SubState storage st = _subs[subId];
        if (st.status == SubStatus.NONE) revert UnknownOrder();
        bytes32 byNode;
        if (msg.sender == st.subscriber) byNode = st.subscriberNode;
        else if (msg.sender == st.merchant) byNode = st.shopNode;
        else revert NotAllowed();
        _cancel(subId, st, byNode);
    }

    // ---------------------------------------------------------------- views

    function orders(bytes32 orderId) external view returns (OrderState memory) {
        return _orders[orderId];
    }

    function subscription(bytes32 subId) external view returns (SubState memory) {
        return _subs[subId];
    }

    function policies(bytes32 node) external view returns (AgentPolicy memory) {
        return _policies[node];
    }

    function spentMicro(bytes32 node, uint32 epoch, uint256 day) external view returns (uint64) {
        return _spent[node][epoch][day];
    }

    /// @notice Spent today (UTC) under the node's current policy epoch.
    function spentToday(bytes32 node) external view returns (uint64) {
        return _spent[node][_policies[node].epoch][block.timestamp / 1 days];
    }

    /// @notice How many subscriptions exist; with `subscriptionIdAt`, lets a stateless job find due ones.
    function subscriptionCount() external view returns (uint256) {
        return _subIds.length;
    }

    function subscriptionIdAt(uint256 index) external view returns (bytes32) {
        return _subIds[index];
    }

    /// @notice keccak256(abi.encode(subId, cycle)) with the top bit set.
    function renewalOrderId(bytes32 subId, uint32 cycle) public pure returns (bytes32) {
        return bytes32(uint256(keccak256(abi.encode(subId, cycle))) | RENEWAL_BIT);
    }

    function termsHash(Order calldata o) external pure returns (bytes32) {
        return keccak256(abi.encode(o));
    }

    /// @notice The `GraphPayOrder` struct hash Permit2 receives as the witness.
    function witnessHash(Order calldata o, bytes32 mandateHash) external pure returns (bytes32) {
        return _witnessHash(o, mandateHash);
    }

    /// @notice The EIP-712 digest the subscriber signs (this contract's domain).
    function subscribeDigest(Sub calldata s, IAllowanceTransfer.PermitSingle calldata ps)
        external
        view
        returns (bytes32)
    {
        return _subscribeDigest(s, ps);
    }

    function cancelDigest(bytes32 subId, uint64 deadline) external view returns (bytes32) {
        return _cancelDigest(subId, deadline);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------------------------------------------------------- internals

    function _checkNewRole(address who, bool holdsOtherRole) private view {
        if (who == address(0) || holdsOtherRole || who == owner() || who == pendingOwner()) revert BadInput("role");
    }

    function _order(bytes32 orderId) private view returns (OrderState storage r) {
        r = _orders[orderId];
        if (r.status == Status.NONE) revert UnknownOrder();
    }

    function _createOrder(OrderState storage r, Order calldata o, bytes32 terms) private {
        if (o.merchant == address(0) || o.amountMicro == 0) revert BadInput("order");
        if (o.kind == KIND_ONE_OFF) {
            if (o.parentOrderId != bytes32(0)) revert BadInput("parent");
        } else if (o.kind == KIND_REORDER) {
            // A re-order follows a paid order of the same buyer at the same shop.
            OrderState storage parent = _orders[o.parentOrderId];
            Status ps = parent.status;
            if (
                o.parentOrderId == bytes32(0) || (ps != Status.PAID && ps != Status.DELIVERED && ps != Status.REFUNDED)
                    || parent.buyerNode != o.buyerNode || parent.shopNode != o.shopNode
            ) revert BadInput("parent");
        } else {
            revert BadInput("kind");
        }
        r.termsHash = terms;
        r.buyerNode = o.buyerNode;
        r.shopNode = o.shopNode;
        r.merchant = o.merchant;
        r.amountMicro = o.amountMicro;
        r.kind = o.kind;
        r.status = Status.CREATED;
        emit OrderCreated(
            o.orderId, o.shopNode, o.buyerNode, o.payerNode, o.merchant, o.amountMicro, o.deadline, o.parentOrderId, o.kind
        );
    }

    /// @dev The policy check, in this order: a bound wallet pays only as its node; a human
    /// (node 0) only from an unbound wallet; the claimed node's policy must name the paying
    /// wallet; then revoked, expired, and the daily cap in the policy's stored epoch.
    function _checkPolicy(bytes32 node, address payer, uint64 amountMicro)
        private
        view
        returns (FailReason, uint32 epoch)
    {
        bytes32 bound = nodeOfWallet[payer];
        if (node == bytes32(0)) return (bound == bytes32(0) ? FailReason.NONE : FailReason.NODE_MISMATCH, 0);
        AgentPolicy storage p = _policies[node];
        epoch = p.epoch;
        if (bound != node || p.wallet != payer) return (FailReason.NODE_MISMATCH, epoch);
        if (p.revoked) return (FailReason.AGENT_REVOKED, epoch);
        if (p.expiry != 0 && block.timestamp >= p.expiry) return (FailReason.AGENT_EXPIRED, epoch);
        if (uint256(_spent[node][epoch][block.timestamp / 1 days]) + amountMicro > p.dailyCapMicro) {
            return (FailReason.SPEND_CAP, epoch);
        }
        return (FailReason.NONE, epoch);
    }

    /// @dev Applies the optional approval after the policy checks (a refused payment consumes no
    /// approval), then pulls payer to merchant through Permit2 with the order as the witness.
    function _pull(
        Order calldata o,
        bytes32 mandateHash,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        address payer,
        bytes calldata sig,
        bytes calldata approvalPermit
    ) private returns (FailReason) {
        _requirePullGas();
        if (approvalPermit.length != 0) {
            _applyApproval(payer, approvalPermit);
            _requirePullGas();
        }
        try PERMIT2.permitWitnessTransferFrom(
            permit,
            ISignatureTransfer.SignatureTransferDetails({to: o.merchant, requestedAmount: o.amountMicro}),
            payer,
            _witnessHash(o, mandateHash),
            WITNESS_TYPE,
            sig
        ) {
            return FailReason.NONE;
        } catch {
            return FailReason.TRANSFER_FAILED;
        }
    }

    /// @dev A front-run or invalid approval is harmless: the pull then fails on its own.
    function _applyApproval(address holder, bytes calldata approvalPermit) private {
        (uint256 value, uint256 deadline, bytes memory signature) =
            abi.decode(approvalPermit, (uint256, uint256, bytes));
        try IERC20PermitBytes(address(USDT)).permit(holder, address(PERMIT2), value, deadline, signature) {} catch {}
    }

    function _requirePullGas() private view {
        if (gasleft() < MIN_PULL_GAS) revert BadInput("gas");
    }

    /// @dev One charge of a subscription. A success creates the cycle's renewal order (kind 2,
    /// parent = the previous cycle's order) already paid; a failure creates no order.
    function _charge(bytes32 subId, SubState storage st) private {
        uint32 cycle = st.cycle + 1;
        address subscriber = st.subscriber;
        uint64 amount = st.amountMicro;
        (FailReason reason, uint32 epoch) = _checkPolicy(st.payerNode, subscriber, amount);
        if (reason == FailReason.NONE) {
            _requirePullGas();
            try PERMIT2.transferFrom(subscriber, st.merchant, uint160(amount), address(USDT)) {}
            catch {
                reason = FailReason.TRANSFER_FAILED;
            }
        }
        if (reason != FailReason.NONE) {
            uint8 failures = st.failures + 1;
            st.failures = failures;
            st.retryAt = uint64(block.timestamp) + RETRY_DELAY;
            emit RenewalFailed(subId, cycle, reason);
            if (failures >= MAX_RENEWAL_FAILURES) {
                st.status = SubStatus.LAPSED;
                emit SubscriptionLapsed(subId, cycle);
            }
            return;
        }

        Order memory o = Order({
            orderId: renewalOrderId(subId, cycle),
            parentOrderId: cycle == 1 ? bytes32(0) : renewalOrderId(subId, cycle - 1),
            buyerNode: st.subscriberNode,
            shopNode: st.shopNode,
            payerNode: st.payerNode,
            merchant: st.merchant,
            amountMicro: amount,
            deadline: uint64(block.timestamp),
            kind: KIND_RENEWAL
        });
        OrderState storage r = _orders[o.orderId];
        r.termsHash = keccak256(abi.encode(o));
        r.buyerNode = o.buyerNode;
        r.shopNode = o.shopNode;
        r.merchant = o.merchant;
        r.amountMicro = amount;
        r.kind = KIND_RENEWAL;
        r.status = Status.PAID;
        r.payer = subscriber;
        emit OrderCreated(
            o.orderId, o.shopNode, o.buyerNode, o.payerNode, o.merchant, amount, o.deadline, o.parentOrderId, KIND_RENEWAL
        );
        uint64 day = uint64(block.timestamp / 1 days);
        if (o.payerNode != bytes32(0)) _spent[o.payerNode][epoch][day] += amount;
        // A renewal's mandate is the subscription itself.
        emit PaymentSettled(o.orderId, o.payerNode, o.shopNode, subscriber, amount, day, subId, epoch);
        emit SubscriptionRenewed(subId, o.orderId, cycle, amount);

        st.cycle = cycle;
        st.failures = 0;
        st.retryAt = 0;
        // Next charge one period on, but never more than one period behind (re-anchor after an outage).
        uint64 next = st.nextChargeAt + st.period;
        if (next <= block.timestamp) next = uint64(block.timestamp) + st.period;
        st.nextChargeAt = next;
    }

    function _cancel(bytes32 subId, SubState storage st, bytes32 byNode) private {
        if (st.status != SubStatus.ACTIVE) revert BadState();
        st.status = SubStatus.CANCELLED;
        emit SubscriptionCancelled(subId, byNode, uint64(block.timestamp));
    }

    function _refund(bytes32 orderId, OrderState storage r, uint64 amountMicro, uint8 reason) private {
        uint64 total = r.refundedMicro + amountMicro;
        r.refundedMicro = total;
        bool full = total == r.amountMicro;
        if (full) r.status = Status.REFUNDED;
        USDT.safeTransferFrom(r.merchant, r.payer, amountMicro);
        emit Refunded(orderId, r.shopNode, r.buyerNode, amountMicro, total, full, reason);
    }

    function _witnessHash(Order calldata o, bytes32 mandateHash) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                o.orderId,
                o.parentOrderId,
                o.buyerNode,
                o.shopNode,
                o.payerNode,
                o.merchant,
                o.amountMicro,
                o.deadline,
                o.kind,
                mandateHash
            )
        );
    }

    /// @dev permitHash = keccak256(abi.encode(token, amount, expiration, nonce, spender, sigDeadline)).
    function _subscribeDigest(Sub calldata s, IAllowanceTransfer.PermitSingle calldata ps)
        private
        view
        returns (bytes32)
    {
        bytes32 permitHash = keccak256(
            abi.encode(
                ps.details.token, ps.details.amount, ps.details.expiration, ps.details.nonce, ps.spender, ps.sigDeadline
            )
        );
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SUBSCRIBE_TYPEHASH,
                    s.subId,
                    s.subscriberNode,
                    s.shopNode,
                    s.payerNode,
                    s.merchant,
                    s.amountMicro,
                    s.period,
                    s.firstChargeAt,
                    permitHash
                )
            )
        );
    }

    function _cancelDigest(bytes32 subId, uint64 deadline) private view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(CANCEL_TYPEHASH, subId, deadline)));
    }
}
