// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {GraphPayCheckout, IPermit2} from "../../src/GraphPayCheckout.sol";

interface IDomainSeparator {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/// @dev Tether's EIP-2612 surface: both permit overloads, nonces, the domain.
interface ITetherPermit is IERC20, IDomainSeparator {
    function nonces(address owner) external view returns (uint256);
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;
    function permit(address owner, address spender, uint256 value, uint256 deadline, bytes calldata signature)
        external;
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

/// @notice A fork of real Whitechain Sepolia at a pinned block, with the real test USDT and the
/// real Permit2 read from the one config file, a fresh checkout, and test actors. Digests are
/// recomputed here by hand from the type strings, independently of the contract's constants.
abstract contract CheckoutFixture is Test {
    // After the M0 funding (2026-11-06 00:49:28 IST): FUNDER holds 31.75208 test USDT here.
    uint256 internal constant FORK_BLOCK = 12_310_000;
    string internal constant CONFIG = "../config/graphpay.config.json";

    string internal constant ORDER_TYPE =
        "GraphPayOrder(bytes32 orderId,bytes32 parentOrderId,bytes32 buyerNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint64 deadline,uint8 kind,bytes32 mandateHash)";
    string internal constant WITNESS_TYPE_STRING =
        "GraphPayOrder witness)GraphPayOrder(bytes32 orderId,bytes32 parentOrderId,bytes32 buyerNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint64 deadline,uint8 kind,bytes32 mandateHash)TokenPermissions(address token,uint256 amount)";
    bytes32 internal constant TOKEN_PERMISSIONS_TYPEHASH = keccak256("TokenPermissions(address token,uint256 amount)");
    bytes32 internal constant PERMIT_WITNESS_TYPEHASH = keccak256(
        "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,GraphPayOrder witness)GraphPayOrder(bytes32 orderId,bytes32 parentOrderId,bytes32 buyerNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint64 deadline,uint8 kind,bytes32 mandateHash)TokenPermissions(address token,uint256 amount)"
    );
    bytes32 internal constant PERMIT_DETAILS_TYPEHASH =
        keccak256("PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)");
    bytes32 internal constant PERMIT_SINGLE_TYPEHASH = keccak256(
        "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"
    );
    bytes32 internal constant EIP2612_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 internal constant SUBSCRIBE_TYPE_HASH = keccak256(
        "Subscribe(bytes32 subId,bytes32 subscriberNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint32 period,uint64 firstChargeAt,bytes32 permitHash)"
    );
    bytes32 internal constant CANCEL_TYPE_HASH = keccak256("Cancel(bytes32 subId,uint64 deadline)");
    bytes32 internal constant DOMAIN_TYPEHASH_NO_VERSION =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    // ENS-style nodes for the test actors (the contract treats nodes as opaque ids).
    bytes32 internal constant AGENT_NODE = keccak256("test node: paying agent");
    bytes32 internal constant OTHER_AGENT_NODE = keccak256("test node: second agent");
    bytes32 internal constant BUYER_NODE = keccak256("test node: buyer");
    bytes32 internal constant HUMAN_NODE = keccak256("test node: human");
    bytes32 internal constant SHOP_NODE = keccak256("test node: shop");
    bytes32 internal constant OTHER_SHOP_NODE = keccak256("test node: other shop");
    bytes32 internal constant MANDATE = keccak256("test mandate: at most 6, by 20:00");

    uint64 internal constant AGENT_CAP = 6_000_000;
    uint256 internal constant APPROVAL_VALUE = 50_000_000; // bounded, never unlimited
    uint256 internal constant MERCHANT_FLOAT = 20_000_000;

    string internal json;
    uint256 internal chainId;
    ITetherPermit internal usdt;
    IPermit2 internal permit2;
    address internal funder;
    string internal tokenName;
    string internal tokenVersion;

    GraphPayCheckout internal checkout;

    address internal admin;
    address internal relayer;
    address internal renewer;
    address internal policyWriter;
    address internal merchant;
    uint256 internal merchantKey;
    address internal otherMerchant;
    address internal agent;
    uint256 internal agentKey;
    address internal otherAgent;
    uint256 internal otherAgentKey;
    address internal human;
    uint256 internal humanKey;
    address internal stranger;
    uint256 internal strangerKey;

    struct Signed {
        GraphPayCheckout.Order o;
        bytes32 mandate;
        ISignatureTransfer.PermitTransferFrom permit;
        address payer;
        bytes sig;
        bytes approval;
    }

    function setUp() public virtual {
        json = vm.readFile(CONFIG);
        chainId = vm.parseJsonUint(json, ".networks.whitechain.chainId");
        vm.createSelectFork(_forkRpc(), FORK_BLOCK);
        assertEq(block.chainid, chainId, "fork is not Whitechain Sepolia");

        usdt = ITetherPermit(vm.parseJsonAddress(json, ".whitechain.tokens.usdt.address"));
        permit2 = IPermit2(vm.parseJsonAddress(json, ".whitechain.system.permit2"));
        funder = vm.parseJsonAddress(json, ".wallets.carried.FUNDER");
        tokenName = vm.parseJsonString(json, ".whitechain.tokens.usdt.eip712.name");
        tokenVersion = vm.parseJsonString(json, ".whitechain.tokens.usdt.eip712.version");
        assertGt(address(usdt).code.length, 0, "no test USDT at the fork block");
        assertGt(address(permit2).code.length, 0, "no Permit2 at the fork block");

        admin = makeAddr("admin");
        relayer = makeAddr("relayer");
        renewer = makeAddr("renewer");
        policyWriter = makeAddr("policy writer");
        (merchant, merchantKey) = makeAddrAndKey("merchant");
        otherMerchant = makeAddr("other merchant");
        (agent, agentKey) = makeAddrAndKey("agent wallet");
        (otherAgent, otherAgentKey) = makeAddrAndKey("second agent wallet");
        (human, humanKey) = makeAddrAndKey("human wallet");
        (stranger, strangerKey) = makeAddrAndKey("stranger");

        checkout = new GraphPayCheckout(address(usdt), address(permit2), admin, relayer, policyWriter);
        vm.prank(admin);
        checkout.setRelayer(renewer, true);
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, false, AGENT_CAP, 0);

        _fund(agent, 12_000_000);
        _fund(otherAgent, 3_000_000);
        _fund(human, 6_000_000);
        vm.prank(merchant);
        usdt.approve(address(checkout), MERCHANT_FLOAT);
    }

    // ---------------------------------------------------------------- config and money

    /// @dev The public Whitechain RPC from the config (never the founder's keyed URL).
    function _forkRpc() internal view returns (string memory) {
        for (uint256 i = 0;; i++) {
            string memory key = string.concat(".networks.whitechain.publicRpcs[", vm.toString(i), "]");
            require(vm.keyExistsJson(json, key), "no public Whitechain RPC in the config");
            if (keccak256(bytes(vm.parseJsonString(json, string.concat(key, ".label")))) == keccak256("Whitechain public"))
            {
                return vm.parseJsonString(json, string.concat(key, ".url"));
            }
        }
    }

    /// @dev Real test USDT, moved from a real holder (FUNDER) on the fork.
    function _fund(address to, uint256 amount) internal {
        vm.prank(funder);
        assertTrue(usdt.transfer(to, amount));
    }

    function _now() internal view returns (uint64) {
        return uint64(vm.getBlockTimestamp());
    }

    function _approvePermit2(address holder) internal {
        vm.prank(holder);
        usdt.approve(address(permit2), APPROVAL_VALUE);
    }

    // ---------------------------------------------------------------- orders

    function _oneOffId(uint256 salt) internal pure returns (bytes32) {
        return bytes32(uint256(keccak256(abi.encode("one-off order", salt))) >> 1); // top bit clear
    }

    function _newOrder(uint256 salt, bytes32 payerNode, uint64 amountMicro)
        internal
        view
        returns (GraphPayCheckout.Order memory o)
    {
        o.orderId = _oneOffId(salt);
        o.buyerNode = BUYER_NODE;
        o.shopNode = SHOP_NODE;
        o.payerNode = payerNode;
        o.merchant = merchant;
        o.amountMicro = amountMicro;
        o.deadline = _now() + 600;
        o.kind = 0;
    }

    function _sign(GraphPayCheckout.Order memory o, uint256 key) internal view returns (Signed memory s) {
        s.o = o;
        s.mandate = MANDATE;
        s.payer = vm.addr(key);
        s.permit = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({token: address(usdt), amount: o.amountMicro}),
            nonce: uint256(o.orderId),
            deadline: o.deadline
        });
        s.sig = _sigOf(key, _witnessDigest(s.o, s.mandate, s.permit, address(checkout)));
    }

    function _signWithApproval(GraphPayCheckout.Order memory o, uint256 key) internal view returns (Signed memory s) {
        s = _sign(o, key);
        s.approval = _approvalPermit(key, APPROVAL_VALUE, _now() + 3600);
    }

    function _settle(Signed memory s) internal returns (uint256 gasUsed) {
        vm.prank(relayer);
        uint256 before = gasleft();
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
        gasUsed = before - gasleft();
    }

    /// @dev Pays an order as `key` (with a fresh approval permit) and checks it settled.
    function _pay(uint256 salt, bytes32 payerNode, uint64 amountMicro, uint256 key)
        internal
        returns (GraphPayCheckout.Order memory o)
    {
        o = _newOrder(salt, payerNode, amountMicro);
        _settle(_signWithApproval(o, key));
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID), "not paid");
    }

    // ---------------------------------------------------------------- digests (by hand)

    function _permit2Domain() internal view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH_NO_VERSION, keccak256("Permit2"), chainId, address(permit2)));
    }

    function _tokenDomain() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH, keccak256(bytes(tokenName)), keccak256(bytes(tokenVersion)), chainId, address(usdt)
            )
        );
    }

    function _checkoutDomain(address at) internal view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256("GraphPayCheckout"), keccak256("1"), chainId, at));
    }

    function _witnessStruct(GraphPayCheckout.Order memory o, bytes32 mandate) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(bytes(ORDER_TYPE)),
                o.orderId,
                o.parentOrderId,
                o.buyerNode,
                o.shopNode,
                o.payerNode,
                o.merchant,
                o.amountMicro,
                o.deadline,
                o.kind,
                mandate
            )
        );
    }

    function _witnessDigest(
        GraphPayCheckout.Order memory o,
        bytes32 mandate,
        ISignatureTransfer.PermitTransferFrom memory p,
        address spender
    ) internal view returns (bytes32) {
        bytes32 permitted = keccak256(abi.encode(TOKEN_PERMISSIONS_TYPEHASH, p.permitted.token, p.permitted.amount));
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_WITNESS_TYPEHASH, permitted, spender, p.nonce, p.deadline, _witnessStruct(o, mandate))
        );
        return keccak256(abi.encodePacked("\x19\x01", _permit2Domain(), structHash));
    }

    function _eip2612Digest(address owner, address spender, uint256 value, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(abi.encode(EIP2612_TYPEHASH, owner, spender, value, nonce, deadline));
        return keccak256(abi.encodePacked("\x19\x01", _tokenDomain(), structHash));
    }

    /// @dev abi.encode(value, deadline, signature): the gasless approval of Permit2.
    function _approvalPermit(uint256 key, uint256 value, uint256 deadline) internal view returns (bytes memory) {
        address owner = vm.addr(key);
        bytes32 digest = _eip2612Digest(owner, address(permit2), value, usdt.nonces(owner), deadline);
        return abi.encode(value, deadline, _sigOf(key, digest));
    }

    function _permitSingleDigest(IAllowanceTransfer.PermitSingle memory ps) internal view returns (bytes32) {
        bytes32 details = keccak256(
            abi.encode(
                PERMIT_DETAILS_TYPEHASH, ps.details.token, ps.details.amount, ps.details.expiration, ps.details.nonce
            )
        );
        bytes32 structHash = keccak256(abi.encode(PERMIT_SINGLE_TYPEHASH, details, ps.spender, ps.sigDeadline));
        return keccak256(abi.encodePacked("\x19\x01", _permit2Domain(), structHash));
    }

    function _permitHash(IAllowanceTransfer.PermitSingle memory ps) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ps.details.token, ps.details.amount, ps.details.expiration, ps.details.nonce, ps.spender, ps.sigDeadline
            )
        );
    }

    function _subscribeDigest(GraphPayCheckout.Sub memory s, IAllowanceTransfer.PermitSingle memory ps, address at)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                SUBSCRIBE_TYPE_HASH,
                s.subId,
                s.subscriberNode,
                s.shopNode,
                s.payerNode,
                s.merchant,
                s.amountMicro,
                s.period,
                s.firstChargeAt,
                _permitHash(ps)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _checkoutDomain(at), structHash));
    }

    function _cancelDigest(bytes32 subId, uint64 deadline, address at) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(CANCEL_TYPE_HASH, subId, deadline));
        return keccak256(abi.encodePacked("\x19\x01", _checkoutDomain(at), structHash));
    }

    function _sigOf(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    // ---------------------------------------------------------------- logs

    function _countLogs(Vm.Log[] memory logs, bytes32 topic0) internal view returns (uint256 n) {
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(checkout) && logs[i].topics[0] == topic0) n++;
        }
    }

    function _assertNoFunds() internal view {
        assertEq(usdt.balanceOf(address(checkout)), 0, "the checkout must never hold funds");
    }
}
