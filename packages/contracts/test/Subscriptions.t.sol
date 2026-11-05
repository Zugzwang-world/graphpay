// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Vm} from "forge-std/Test.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {GraphPayCheckout} from "../src/GraphPayCheckout.sol";
import {CheckoutFixture} from "./utils/CheckoutFixture.sol";

/// @notice Subscriptions: subscriber-signed terms bound to a Permit2 PermitSingle, renewed by a
/// relayer on schedule, lapsing after three failures, cancelled gaslessly.
contract SubscriptionsTest is CheckoutFixture {
    uint64 internal constant PRICE = 400_000;
    uint32 internal constant PERIOD = 120; // a 2-minute demo period

    struct NewSub {
        GraphPayCheckout.Sub s;
        IAllowanceTransfer.PermitSingle ps;
        bytes permitSig;
        bytes subSig;
        bytes approval;
    }

    function _subId(uint256 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode("subscription", salt));
    }

    function _newSub(uint256 salt, uint256 key, bytes32 subscriberNode, bytes32 payerNode, uint64 firstChargeAt)
        internal
        view
        returns (NewSub memory n)
    {
        address subscriber = vm.addr(key);
        n.s = GraphPayCheckout.Sub({
            subId: _subId(salt),
            subscriberNode: subscriberNode,
            shopNode: SHOP_NODE,
            payerNode: payerNode,
            subscriber: subscriber,
            merchant: merchant,
            amountMicro: PRICE,
            period: PERIOD,
            firstChargeAt: firstChargeAt
        });
        (,, uint48 nonce) = permit2.allowance(subscriber, address(usdt), address(checkout));
        n.ps = IAllowanceTransfer.PermitSingle({
            details: IAllowanceTransfer.PermitDetails({
                token: address(usdt),
                amount: uint160(PRICE) * 10,
                expiration: uint48(_now() + 30 days),
                nonce: nonce
            }),
            spender: address(checkout),
            sigDeadline: _now() + 600
        });
        _resign(n, key);
        n.approval = _approvalPermit(key, APPROVAL_VALUE, _now() + 3600);
    }

    function _resign(NewSub memory n, uint256 key) internal view {
        n.permitSig = _sigOf(key, _permitSingleDigest(n.ps));
        n.subSig = _sigOf(key, _subscribeDigest(n.s, n.ps, address(checkout)));
    }

    function _create(NewSub memory n) internal returns (uint256 gasUsed) {
        vm.prank(relayer);
        uint256 before = gasleft();
        checkout.createSubscription(n.s, n.ps, n.permitSig, n.subSig, n.approval);
        gasUsed = before - gasleft();
    }

    function _expectCreateRevert(NewSub memory n, bytes memory reason) internal {
        vm.prank(relayer);
        vm.expectRevert(reason);
        checkout.createSubscription(n.s, n.ps, n.permitSig, n.subSig, n.approval);
    }

    function _renew(bytes32 subId) internal returns (uint256 gasUsed) {
        vm.prank(renewer);
        uint256 before = gasleft();
        checkout.renew(subId);
        gasUsed = before - gasleft();
    }

    function test_create_takesTheFirstCharge_asCycleOne() public {
        NewSub memory n = _newSub(1, humanKey, HUMAN_NODE, bytes32(0), _now());
        bytes32 firstOrder = checkout.renewalOrderId(n.s.subId, 1);
        uint256 humanBefore = usdt.balanceOf(human);

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.SubscriptionCreated(n.s.subId, HUMAN_NODE, SHOP_NODE, PRICE, PERIOD, n.s.firstChargeAt);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.OrderCreated(firstOrder, SHOP_NODE, HUMAN_NODE, bytes32(0), merchant, PRICE, _now(), 0, 2);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentSettled(firstOrder, bytes32(0), SHOP_NODE, human, PRICE, _now() / 1 days, n.s.subId, 0);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.SubscriptionRenewed(n.s.subId, firstOrder, 1, PRICE);
        uint256 gasUsed = _create(n);
        emit log_named_uint("gas: createSubscription with the first charge (execution only)", gasUsed);

        assertEq(usdt.balanceOf(human), humanBefore - PRICE);
        GraphPayCheckout.SubState memory st = checkout.subscription(n.s.subId);
        assertEq(uint8(st.status), uint8(GraphPayCheckout.SubStatus.ACTIVE));
        assertEq(st.cycle, 1);
        assertEq(st.nextChargeAt, n.s.firstChargeAt + PERIOD);
        assertEq(uint8(checkout.orders(firstOrder).status), uint8(GraphPayCheckout.Status.PAID));
        assertEq(checkout.orders(firstOrder).kind, 2);
        assertEq(checkout.orders(firstOrder).payer, human);
        _assertNoFunds();
    }

    function test_create_withAFutureFirstCharge_chargesNothingYet() public {
        NewSub memory n = _newSub(2, humanKey, HUMAN_NODE, bytes32(0), _now() + 1 days);
        uint256 humanBefore = usdt.balanceOf(human);
        _create(n);
        assertEq(usdt.balanceOf(human), humanBefore);
        assertEq(checkout.subscription(n.s.subId).cycle, 0);
        vm.prank(renewer);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.renew(n.s.subId);
        vm.warp(n.s.firstChargeAt);
        _renew(n.s.subId);
        assertEq(checkout.subscription(n.s.subId).cycle, 1);
        assertEq(usdt.balanceOf(human), humanBefore - PRICE);
    }

    function test_renew_followsTheSchedule_andReanchorsAfterAnOutage() public {
        NewSub memory n = _newSub(3, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(n);
        uint64 next = checkout.subscription(n.s.subId).nextChargeAt;

        vm.warp(next - 1);
        vm.prank(renewer);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.renew(n.s.subId);

        vm.warp(next);
        bytes32 first = checkout.renewalOrderId(n.s.subId, 1);
        bytes32 second = checkout.renewalOrderId(n.s.subId, 2);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.OrderCreated(second, SHOP_NODE, HUMAN_NODE, bytes32(0), merchant, PRICE, next, first, 2);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.SubscriptionRenewed(n.s.subId, second, 2, PRICE);
        uint256 gasUsed = _renew(n.s.subId);
        emit log_named_uint("gas: renew (execution only)", gasUsed);
        assertEq(checkout.subscription(n.s.subId).nextChargeAt, next + PERIOD, "on schedule: one period on");

        // An outage of ten periods: one catch-up charge, then re-anchored to now + period.
        vm.warp(next + 11 * uint64(PERIOD));
        _renew(n.s.subId);
        assertEq(checkout.subscription(n.s.subId).nextChargeAt, _now() + PERIOD, "re-anchored");
        vm.prank(renewer);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.renew(n.s.subId);
    }

    function test_threeFailuresInARow_lapseTheSubscription() public {
        NewSub memory n = _newSub(4, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(n);
        _drain(human);

        for (uint32 i = 1; i <= 3; i++) {
            vm.warp(_now() + (i == 1 ? PERIOD : 1 days));
            vm.expectEmit(true, true, true, true, address(checkout));
            emit GraphPayCheckout.RenewalFailed(n.s.subId, 2, GraphPayCheckout.FailReason.TRANSFER_FAILED);
            if (i == 3) {
                vm.expectEmit(true, true, true, true, address(checkout));
                emit GraphPayCheckout.SubscriptionLapsed(n.s.subId, 2);
            }
            _renew(n.s.subId);
            GraphPayCheckout.SubState memory st = checkout.subscription(n.s.subId);
            assertEq(st.failures, i);
            assertEq(st.retryAt, _now() + 1 days);
            if (i < 3) {
                vm.prank(renewer);
                vm.expectRevert(GraphPayCheckout.BadState.selector); // no retry before a day has passed
                checkout.renew(n.s.subId);
            }
        }
        assertEq(uint8(checkout.subscription(n.s.subId).status), uint8(GraphPayCheckout.SubStatus.LAPSED));
        assertEq(uint8(checkout.orders(checkout.renewalOrderId(n.s.subId, 2)).status), 0, "no order for a failure");
        vm.warp(_now() + 2 days);
        vm.prank(renewer);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.renew(n.s.subId);
    }

    function test_aSuccess_resetsTheFailureCount() public {
        NewSub memory n = _newSub(5, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(n);
        uint256 kept = _drain(human);
        vm.warp(_now() + PERIOD);
        _renew(n.s.subId); // fails
        assertEq(checkout.subscription(n.s.subId).failures, 1);
        vm.prank(stranger);
        assertTrue(usdt.transfer(human, kept));
        vm.warp(_now() + 1 days);
        _renew(n.s.subId);
        GraphPayCheckout.SubState memory st = checkout.subscription(n.s.subId);
        assertEq(st.failures, 0);
        assertEq(st.retryAt, 0);
        assertEq(st.cycle, 2);
    }

    function test_cancelWithSig_isGasless_andStopsRenewals() public {
        NewSub memory n = _newSub(6, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(n);
        uint64 deadline = _now() + 600;
        bytes memory sig = _sigOf(humanKey, _cancelDigest(n.s.subId, deadline, address(checkout)));

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.SubscriptionCancelled(n.s.subId, HUMAN_NODE, _now());
        vm.prank(stranger); // anyone may carry the subscriber's signature
        uint256 before = gasleft();
        checkout.cancelWithSig(n.s.subId, deadline, sig);
        emit log_named_uint("gas: cancelWithSig (execution only)", before - gasleft());
        assertEq(uint8(checkout.subscription(n.s.subId).status), uint8(GraphPayCheckout.SubStatus.CANCELLED));

        vm.warp(_now() + PERIOD);
        vm.prank(renewer);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.renew(n.s.subId);
        vm.expectRevert(GraphPayCheckout.BadState.selector); // a replay is harmless
        checkout.cancelWithSig(n.s.subId, deadline, sig);
    }

    function test_cancelWithSig_refusesAnExpiredOrForeignSignature() public {
        NewSub memory n = _newSub(7, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(n);
        uint64 deadline = _now() + 600;
        bytes memory foreign = _sigOf(strangerKey, _cancelDigest(n.s.subId, deadline, address(checkout)));
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "cancel signature"));
        checkout.cancelWithSig(n.s.subId, deadline, foreign);

        bytes memory sig = _sigOf(humanKey, _cancelDigest(n.s.subId, deadline, address(checkout)));
        vm.warp(deadline + 1);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "deadline"));
        checkout.cancelWithSig(n.s.subId, deadline, sig);

        vm.expectRevert(GraphPayCheckout.UnknownOrder.selector);
        checkout.cancelWithSig(_subId(999), deadline, sig);
    }

    function test_cancelSubscription_byTheSubscriberOrTheMerchantOnly() public {
        NewSub memory a = _newSub(8, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(a);
        NewSub memory b = _newSub(9, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(b);

        address[4] memory others = [stranger, relayer, admin, otherMerchant];
        for (uint256 i = 0; i < others.length; i++) {
            vm.prank(others[i]);
            vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
            checkout.cancelSubscription(a.s.subId);
        }
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.SubscriptionCancelled(a.s.subId, HUMAN_NODE, _now());
        vm.prank(human);
        checkout.cancelSubscription(a.s.subId);

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.SubscriptionCancelled(b.s.subId, SHOP_NODE, _now());
        vm.prank(merchant);
        checkout.cancelSubscription(b.s.subId);
    }

    function test_aFrontRunPermitSingle_isAccepted_whenPermit2ShowsItApplied() public {
        NewSub memory n = _newSub(10, humanKey, HUMAN_NODE, bytes32(0), _now());
        vm.prank(stranger); // someone submits the signed permit to Permit2 first
        permit2.permit(human, n.ps, n.permitSig);
        _create(n);
        assertEq(checkout.subscription(n.s.subId).cycle, 1);
    }

    function test_aPermitNobodyApplied_reverts() public {
        NewSub memory n = _newSub(11, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.permitSig = _sigOf(strangerKey, _permitSingleDigest(n.ps));
        _expectCreateRevert(n, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "permit"));
    }

    function test_theSubscribeTerms_mustBeSignedByTheSubscriber() public {
        NewSub memory n = _newSub(12, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.s.amountMicro = PRICE * 2; // the relayer raises the price after signing
        _expectCreateRevert(n, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "subscribe signature"));
        n = _newSub(12, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.s.merchant = otherMerchant; // ... or the payee
        _expectCreateRevert(n, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "subscribe signature"));
        n = _newSub(12, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.subSig = _sigOf(strangerKey, _subscribeDigest(n.s, n.ps, address(checkout)));
        _expectCreateRevert(n, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "subscribe signature"));
    }

    function test_thePermit_mustCoverTheSubscription() public {
        bytes memory terms = abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "permit terms");
        NewSub memory n = _newSub(13, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.ps.spender = stranger;
        _resign(n, humanKey);
        _expectCreateRevert(n, terms);

        n = _newSub(13, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.ps.details.token = address(permit2);
        _resign(n, humanKey);
        _expectCreateRevert(n, terms);

        n = _newSub(13, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.ps.details.amount = PRICE - 1;
        _resign(n, humanKey);
        _expectCreateRevert(n, terms);

        n = _newSub(13, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.ps.details.expiration = uint48(n.s.firstChargeAt);
        _resign(n, humanKey);
        _expectCreateRevert(n, terms);

        n = _newSub(13, humanKey, HUMAN_NODE, bytes32(0), _now());
        vm.warp(n.ps.sigDeadline + 1);
        _expectCreateRevert(n, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "permit deadline"));
    }

    function test_aSubscriber_mayOnlyClaimItsOwnNode() public {
        bytes memory refused = abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "payer node");
        // An unbound wallet claims an agent's node.
        NewSub memory n = _newSub(14, humanKey, HUMAN_NODE, AGENT_NODE, _now());
        _expectCreateRevert(n, refused);
        // A bound agent wallet claims to be a human.
        n = _newSub(15, agentKey, AGENT_NODE, bytes32(0), _now());
        _expectCreateRevert(n, refused);
    }

    function test_badSubscriptionInputs_revert() public {
        NewSub memory n = _newSub(16, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(n);
        _expectCreateRevert(n, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "sub id")); // exists
        n = _newSub(17, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.s.period = 0;
        _expectCreateRevert(n, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "sub"));
        n = _newSub(17, humanKey, HUMAN_NODE, bytes32(0), _now());
        n.s.subId = bytes32(0);
        _expectCreateRevert(n, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "sub id"));
    }

    /// E-5: renewal ids live in their own id space, so a relayer cannot squat the next renewal.
    function test_renewalIds_haveTheTopBit_andSettleOrderCannotSquatThem() public {
        NewSub memory n = _newSub(18, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(n);
        bytes32 next = checkout.renewalOrderId(n.s.subId, 2);
        assertEq(uint256(next) >> 255, 1);
        assertEq(next, bytes32(uint256(keccak256(abi.encode(n.s.subId, uint32(2)))) | (1 << 255)));

        // The relayer tries to create that id as a one-off order paid by a wallet it controls.
        GraphPayCheckout.Order memory squat = _newOrder(0, bytes32(0), 1);
        squat.orderId = next;
        squat.merchant = relayer;
        Signed memory s = _signWithApproval(squat, strangerKey);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "order id"));
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);

        vm.warp(_now() + PERIOD);
        _renew(n.s.subId);
        assertEq(uint8(checkout.orders(next).status), uint8(GraphPayCheckout.Status.PAID));
    }

    function test_anAgentsCharges_countTowardItsDailyCap() public {
        vm.warp((_now() / 1 days + 1) * 1 days + 12 hours); // a fixed midday (UTC), so both charges share a day
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, false, PRICE, 0); // room for exactly one charge a day
        NewSub memory n = _newSub(19, agentKey, AGENT_NODE, AGENT_NODE, _now());
        _create(n);
        assertEq(checkout.spentToday(AGENT_NODE), PRICE);
        vm.warp(_now() + PERIOD);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.RenewalFailed(n.s.subId, 2, GraphPayCheckout.FailReason.SPEND_CAP);
        _renew(n.s.subId);
    }

    /// The gas guard on a renewal: a starved call reverts; it never records a failure (three lapse it).
    function test_aStarvedRenewal_revertsInsteadOfRecordingAFailure() public {
        NewSub memory n = _newSub(23, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(n);
        vm.warp(_now() + PERIOD);
        bytes memory call = abi.encodeCall(GraphPayCheckout.renew, (n.s.subId));
        bool sawGuard;
        bool sawSuccess;
        for (uint256 gasLimit = 60_000; gasLimit <= 320_000; gasLimit += 4_000) {
            uint256 snap = vm.snapshotState();
            vm.recordLogs();
            vm.prank(renewer);
            (bool ok, bytes memory ret) = address(checkout).call{gas: gasLimit}(call);
            Vm.Log[] memory logs = vm.getRecordedLogs();
            assertEq(_countLogs(logs, GraphPayCheckout.RenewalFailed.selector), 0, "starved gas recorded a failure");
            if (ok) {
                sawSuccess = true;
                assertEq(checkout.subscription(n.s.subId).cycle, 2);
            } else if (keccak256(ret) == keccak256(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "gas"))) {
                sawGuard = true;
            }
            vm.revertToState(snap);
        }
        assertTrue(sawGuard, "the guard never tripped");
        assertTrue(sawSuccess, "no gas limit renewed");
    }

    function test_theSubscriptionList_findsEverySubscription() public {
        assertEq(checkout.subscriptionCount(), 0);
        NewSub memory a = _newSub(20, humanKey, HUMAN_NODE, bytes32(0), _now());
        _create(a);
        NewSub memory b = _newSub(21, humanKey, HUMAN_NODE, bytes32(0), _now() + 1 days);
        _create(b);
        assertEq(checkout.subscriptionCount(), 2);
        assertEq(checkout.subscriptionIdAt(0), a.s.subId);
        assertEq(checkout.subscriptionIdAt(1), b.s.subId);
    }

    function test_onlyRelayers_createAndRenew() public {
        NewSub memory n = _newSub(22, humanKey, HUMAN_NODE, bytes32(0), _now());
        address[5] memory others = [admin, policyWriter, merchant, human, stranger];
        for (uint256 i = 0; i < others.length; i++) {
            vm.prank(others[i]);
            vm.expectRevert(GraphPayCheckout.NotRelayer.selector);
            checkout.createSubscription(n.s, n.ps, n.permitSig, n.subSig, n.approval);
        }
        _create(n);
        vm.warp(_now() + PERIOD);
        for (uint256 i = 0; i < others.length; i++) {
            vm.prank(others[i]);
            vm.expectRevert(GraphPayCheckout.NotRelayer.selector);
            checkout.renew(n.s.subId);
        }
        vm.prank(relayer); // the facilitator's relayer may renew too; the renewer has its own key (E-1)
        checkout.renew(n.s.subId);
        vm.prank(renewer);
        vm.expectRevert(GraphPayCheckout.UnknownOrder.selector);
        checkout.renew(_subId(999));
    }

    /// @dev Moves every token the holder has to the stranger; returns how much.
    function _drain(address holder) internal returns (uint256 amount) {
        amount = usdt.balanceOf(holder);
        vm.prank(holder);
        assertTrue(usdt.transfer(stranger, amount));
    }
}
