// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Vm} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {GraphPayCheckout} from "../src/GraphPayCheckout.sol";
import {CheckoutFixture} from "./utils/CheckoutFixture.sol";

contract OtherToken is ERC20 {
    constructor() ERC20("Other token (test)", "OTHER") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice One-off orders and re-orders on a Whitechain fork, paid in the real test USDT.
contract OrdersTest is CheckoutFixture {
    function test_firstPayment_isGasless_withAnApprovalPermitAndTheWitness() public {
        GraphPayCheckout.Order memory o = _newOrder(1, AGENT_NODE, 4_800_000);
        Signed memory s = _signWithApproval(o, agentKey);
        assertEq(usdt.allowance(agent, address(permit2)), 0, "the agent starts with no approval");
        uint256 agentBefore = usdt.balanceOf(agent);
        uint256 merchantBefore = usdt.balanceOf(merchant);

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.OrderCreated(o.orderId, SHOP_NODE, BUYER_NODE, AGENT_NODE, merchant, 4_800_000, o.deadline, 0, 0);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentSettled(
            o.orderId, AGENT_NODE, SHOP_NODE, agent, 4_800_000, _now() / 1 days, MANDATE, 0
        );
        uint256 gasUsed = _settle(s);
        emit log_named_uint("gas: first agent settle with the gasless approval (execution only)", gasUsed);

        assertEq(usdt.balanceOf(agent), agentBefore - 4_800_000);
        assertEq(usdt.balanceOf(merchant), merchantBefore + 4_800_000);
        GraphPayCheckout.OrderState memory r = checkout.orders(o.orderId);
        assertEq(uint8(r.status), uint8(GraphPayCheckout.Status.PAID));
        assertEq(r.payer, agent);
        assertEq(r.merchant, merchant);
        assertEq(r.termsHash, keccak256(abi.encode(o)));
        assertEq(checkout.spentToday(AGENT_NODE), 4_800_000);
        assertEq(usdt.allowance(agent, address(permit2)), APPROVAL_VALUE - 4_800_000, "bounded approval, used once");
        _assertNoFunds();
    }

    /// C2's real conditions: the merchant already holds a float, the payer has no approval yet.
    /// A real receipt adds the 21,000 intrinsic gas and the calldata to this execution figure.
    function test_gas_firstAgentSettle_toAMerchantThatHoldsAFloat() public {
        _fund(merchant, 1_000_000);
        uint256 gasUsed = _settle(_signWithApproval(_newOrder(40, AGENT_NODE, 4_800_000), agentKey));
        emit log_named_uint("gas: first agent settle, merchant with a float (execution only)", gasUsed);
        assertLt(gasUsed, 330_000);
    }

    function test_payment_withAnExistingApproval_needsNoApprovalPermit() public {
        _approvePermit2(human);
        GraphPayCheckout.Order memory o = _newOrder(2, bytes32(0), 400_000);
        uint256 gasUsed = _settle(_sign(o, humanKey));
        emit log_named_uint("gas: human settle with an existing approval (execution only)", gasUsed);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
        assertEq(checkout.orders(o.orderId).payer, human);
    }

    function test_replayOfAPaidOrder_isRecordedDuplicate_andMovesNoMoney() public {
        GraphPayCheckout.Order memory o = _newOrder(3, AGENT_NODE, 1_000_000);
        Signed memory s = _signWithApproval(o, agentKey);
        _settle(s);
        uint256 agentBefore = usdt.balanceOf(agent);
        uint256 merchantBefore = usdt.balanceOf(merchant);

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 1_000_000, GraphPayCheckout.FailReason.DUPLICATE, 0
        );
        _settle(s);

        assertEq(usdt.balanceOf(agent), agentBefore);
        assertEq(usdt.balanceOf(merchant), merchantBefore);
        assertEq(checkout.spentToday(AGENT_NODE), 1_000_000, "a replay spends nothing");
    }

    function test_failedFirstAttempt_leavesTheOrderCreated_andTheSameSignedPermitRetries() public {
        GraphPayCheckout.Order memory o = _newOrder(4, AGENT_NODE, 2_000_000);
        Signed memory s = _sign(o, agentKey); // no approval yet: the pull fails

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 2_000_000, GraphPayCheckout.FailReason.TRANSFER_FAILED, 0
        );
        _settle(s);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.CREATED));
        assertEq(checkout.spentToday(AGENT_NODE), 0, "a failed attempt spends nothing");

        // The retry resends the approval permit (it is applied only when the policy passes).
        s.approval = _approvalPermit(agentKey, APPROVAL_VALUE, _now() + 3600);
        vm.recordLogs();
        _settle(s);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(_countLogs(logs, GraphPayCheckout.OrderCreated.selector), 0, "the order is not created twice");
        assertEq(_countLogs(logs, GraphPayCheckout.PaymentSettled.selector), 1);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
    }

    function test_aRetryWithOtherTerms_revertsTermsMismatch() public {
        GraphPayCheckout.Order memory o = _newOrder(5, AGENT_NODE, 2_000_000);
        _settle(_sign(o, agentKey)); // fails, CREATED
        GraphPayCheckout.Order memory changed = o;
        changed.amountMicro = 1_000_000;
        Signed memory s = _signWithApproval(changed, agentKey);
        vm.prank(relayer);
        vm.expectRevert(GraphPayCheckout.TermsMismatch.selector);
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
    }

    function test_aPaidOrderWithOtherTerms_revertsTermsMismatch_insteadOfRecordingADuplicate() public {
        GraphPayCheckout.Order memory o = _pay(6, AGENT_NODE, 1_000_000, agentKey);
        GraphPayCheckout.Order memory changed = o;
        changed.payerNode = OTHER_AGENT_NODE;
        Signed memory s = _sign(changed, otherAgentKey);
        vm.prank(relayer);
        vm.expectRevert(GraphPayCheckout.TermsMismatch.selector);
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
    }

    function test_aPermitForAnotherToken_isRecordedTransferFailed_andMovesNeitherToken() public {
        OtherToken other = new OtherToken();
        other.mint(agent, 10_000_000);
        vm.prank(agent);
        other.approve(address(permit2), type(uint256).max);
        GraphPayCheckout.Order memory o = _newOrder(7, AGENT_NODE, 1_000_000);
        Signed memory s = _sign(o, agentKey);
        // The payer signs the same witness over a permit for another token: Permit2 alone would pay with it.
        s.permit.permitted.token = address(other);
        s.sig = _sigOf(agentKey, _witnessDigest(s.o, s.mandate, s.permit, address(checkout)));

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 1_000_000, GraphPayCheckout.FailReason.TRANSFER_FAILED, 0
        );
        _settle(s);
        assertEq(other.balanceOf(merchant), 0);
        assertEq(other.balanceOf(agent), 10_000_000);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.CREATED));
    }

    function test_aPermitBelowThePrice_isRecordedTransferFailed() public {
        _approvePermit2(agent);
        GraphPayCheckout.Order memory o = _newOrder(8, AGENT_NODE, 1_000_000);
        Signed memory s = _sign(o, agentKey);
        s.permit.permitted.amount = 999_999;
        s.sig = _sigOf(agentKey, _witnessDigest(s.o, s.mandate, s.permit, address(checkout)));
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 1_000_000, GraphPayCheckout.FailReason.TRANSFER_FAILED, 0
        );
        _settle(s);
    }

    function test_anOrderPastItsDeadline_isRecordedExpired() public {
        _approvePermit2(agent);
        GraphPayCheckout.Order memory o = _newOrder(9, AGENT_NODE, 1_000_000);
        Signed memory s = _sign(o, agentKey);
        vm.warp(o.deadline + 1);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 1_000_000, GraphPayCheckout.FailReason.EXPIRED, 0
        );
        _settle(s);
        assertEq(usdt.allowance(agent, address(permit2)), APPROVAL_VALUE, "nothing pulled");
    }

    function test_aBadSignature_isRecordedTransferFailed_andTheOrderStaysCreated() public {
        _approvePermit2(agent);
        GraphPayCheckout.Order memory o = _newOrder(10, AGENT_NODE, 1_000_000);
        Signed memory s = _sign(o, agentKey);
        s.sig = _sigOf(strangerKey, _witnessDigest(s.o, s.mandate, s.permit, address(checkout)));
        _settle(s);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.CREATED));
        assertEq(usdt.balanceOf(merchant), 0);
    }

    function test_aRelayerNamingAnotherPayer_cannotMoveTheirMoney() public {
        _approvePermit2(human);
        uint256 humanBefore = usdt.balanceOf(human);
        GraphPayCheckout.Order memory o = _newOrder(11, bytes32(0), 1_000_000);
        Signed memory s = _sign(o, strangerKey); // the stranger signs ...
        s.payer = human; // ... and the call names the human as the payer
        _settle(s);
        assertEq(usdt.balanceOf(human), humanBefore);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.CREATED));
    }

    function test_aChangedWitness_cannotRedirectThePayment() public {
        _approvePermit2(agent);
        GraphPayCheckout.Order memory o = _newOrder(12, AGENT_NODE, 1_000_000);
        Signed memory s = _sign(o, agentKey);
        s.o.merchant = otherMerchant; // the relayer swaps the payee after signing
        _settle(s);
        assertEq(usdt.balanceOf(otherMerchant), 0);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.CREATED));
    }

    /// The gas guard: with any gas limit the call either settles or reverts; it never records a
    /// failure that only starved gas caused.
    function test_starvedGas_revertsInsteadOfRecordingAFailure() public {
        GraphPayCheckout.Order memory o = _newOrder(13, AGENT_NODE, 1_000_000);
        Signed memory s = _signWithApproval(o, agentKey);
        bytes memory call =
            abi.encodeCall(GraphPayCheckout.settleOrder, (s.o, s.mandate, s.permit, s.payer, s.sig, s.approval));
        bool sawGuard;
        bool sawSuccess;
        for (uint256 gasLimit = 120_000; gasLimit <= 420_000; gasLimit += 4_000) {
            uint256 snap = vm.snapshotState();
            vm.recordLogs();
            vm.prank(relayer);
            (bool ok, bytes memory ret) = address(checkout).call{gas: gasLimit}(call);
            Vm.Log[] memory logs = vm.getRecordedLogs();
            assertEq(_countLogs(logs, GraphPayCheckout.PaymentFailed.selector), 0, "starved gas recorded a failure");
            if (ok) {
                sawSuccess = true;
                assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
            } else if (keccak256(ret) == keccak256(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "gas"))) {
                sawGuard = true;
            }
            vm.revertToState(snap);
        }
        assertTrue(sawGuard, "the guard never tripped");
        assertTrue(sawSuccess, "no gas limit settled");
    }

    function test_orderIdsWithTheTopBit_areRefused() public {
        GraphPayCheckout.Order memory o = _newOrder(14, AGENT_NODE, 1_000_000);
        o.orderId = bytes32(uint256(o.orderId) | (1 << 255));
        Signed memory s = _signWithApproval(o, agentKey);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "order id"));
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
    }

    function test_badOrderInputs_revert() public {
        GraphPayCheckout.Order memory o = _newOrder(15, AGENT_NODE, 1_000_000);
        o.merchant = address(0);
        _expectSettleRevert(o, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "order"));
        o = _newOrder(15, AGENT_NODE, 0);
        _expectSettleRevert(o, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "order"));
        o = _newOrder(15, AGENT_NODE, 1_000_000);
        o.kind = 2;
        _expectSettleRevert(o, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "kind"));
        o = _newOrder(15, AGENT_NODE, 1_000_000);
        o.parentOrderId = _oneOffId(99);
        _expectSettleRevert(o, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "parent"));
        o = _newOrder(15, AGENT_NODE, 1_000_000);
        o.orderId = bytes32(0);
        _expectSettleRevert(o, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "order id"));
    }

    // ---------------------------------------------------------------- re-orders

    function test_reorder_followsAPaidOrderOfTheSameBuyerAtTheSameShop() public {
        GraphPayCheckout.Order memory parent = _pay(20, AGENT_NODE, 4_800_000, agentKey);
        GraphPayCheckout.Order memory o = _newOrder(21, AGENT_NODE, 1_200_000);
        o.kind = 1;
        o.parentOrderId = parent.orderId;
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.OrderCreated(
            o.orderId, SHOP_NODE, BUYER_NODE, AGENT_NODE, merchant, 1_200_000, o.deadline, parent.orderId, 1
        );
        uint256 gasUsed = _settle(_sign(o, agentKey));
        emit log_named_uint("gas: re-order with an existing approval (execution only)", gasUsed);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
        assertEq(checkout.orders(o.orderId).kind, 1);
        assertEq(checkout.spentToday(AGENT_NODE), 6_000_000);
    }

    function test_reorder_ofAFullyRefundedOrder_isAllowed() public {
        GraphPayCheckout.Order memory parent = _pay(22, AGENT_NODE, 1_000_000, agentKey);
        vm.prank(merchant);
        checkout.refund(parent.orderId, 1_000_000, 1);
        GraphPayCheckout.Order memory o = _newOrder(23, AGENT_NODE, 1_000_000);
        o.kind = 1;
        o.parentOrderId = parent.orderId;
        _settle(_sign(o, agentKey));
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
    }

    function test_reorder_ofAnUnpaidOrAnotherBuyersOrAnotherShopsOrder_reverts() public {
        GraphPayCheckout.Order memory unpaid = _newOrder(24, AGENT_NODE, 1_000_000);
        _settle(_sign(unpaid, agentKey)); // no approval: stays CREATED
        GraphPayCheckout.Order memory paid = _pay(25, AGENT_NODE, 1_000_000, agentKey);

        GraphPayCheckout.Order memory o = _newOrder(26, AGENT_NODE, 1_000_000);
        o.kind = 1;
        o.parentOrderId = unpaid.orderId;
        _expectSettleRevert(o, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "parent"));

        o.parentOrderId = paid.orderId;
        o.buyerNode = HUMAN_NODE;
        _expectSettleRevert(o, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "parent"));

        o.buyerNode = BUYER_NODE;
        o.shopNode = OTHER_SHOP_NODE;
        _expectSettleRevert(o, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "parent"));

        o.shopNode = SHOP_NODE;
        o.parentOrderId = bytes32(0);
        _expectSettleRevert(o, abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "parent"));
    }

    // ---------------------------------------------------------------- refunds, delivery, cancel

    function test_refund_partialThenFull_isCappedAtWhatWasPaid() public {
        GraphPayCheckout.Order memory o = _pay(30, AGENT_NODE, 4_800_000, agentKey);
        uint256 agentBefore = usdt.balanceOf(agent);

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.Refunded(o.orderId, SHOP_NODE, BUYER_NODE, 800_000, 800_000, false, 7);
        vm.prank(merchant);
        uint256 before = gasleft();
        checkout.refund(o.orderId, 800_000, 7);
        emit log_named_uint("gas: partial refund (execution only)", before - gasleft());
        assertEq(usdt.balanceOf(agent), agentBefore + 800_000);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));

        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "refund"));
        checkout.refund(o.orderId, 4_000_001, 7);

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.Refunded(o.orderId, SHOP_NODE, BUYER_NODE, 4_000_000, 4_800_000, true, 7);
        vm.prank(merchant);
        checkout.refund(o.orderId, 4_000_000, 7);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.REFUNDED));
        assertEq(checkout.orders(o.orderId).refundedMicro, 4_800_000);
        assertEq(usdt.balanceOf(agent), agentBefore + 4_800_000);

        vm.prank(merchant);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.refund(o.orderId, 1, 7);
        _assertNoFunds();
    }

    function test_refund_ofZero_reverts() public {
        GraphPayCheckout.Order memory o = _pay(31, AGENT_NODE, 1_000_000, agentKey);
        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "refund"));
        checkout.refund(o.orderId, 0, 1);
    }

    function test_refund_withoutTheMerchantsFloat_reverts() public {
        GraphPayCheckout.Order memory o = _pay(32, AGENT_NODE, 1_000_000, agentKey);
        vm.prank(merchant);
        usdt.approve(address(checkout), 0);
        vm.prank(merchant);
        vm.expectRevert();
        checkout.refund(o.orderId, 500_000, 1);
    }

    function test_refund_ofADeliveredOrder_works_andOfAnUnpaidOrder_reverts() public {
        GraphPayCheckout.Order memory o = _pay(33, AGENT_NODE, 1_000_000, agentKey);
        vm.prank(merchant);
        checkout.markDelivered(o.orderId);
        vm.prank(merchant);
        checkout.refund(o.orderId, 300_000, 2);
        assertEq(checkout.orders(o.orderId).refundedMicro, 300_000);

        GraphPayCheckout.Order memory unpaid = _newOrder(34, AGENT_NODE, 1_000_000);
        _settle(_sign(unpaid, strangerKey)); // refused: CREATED
        vm.prank(merchant);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.refund(unpaid.orderId, 1, 2);

        vm.prank(merchant);
        vm.expectRevert(GraphPayCheckout.UnknownOrder.selector);
        checkout.refund(_oneOffId(999), 1, 2);
    }

    function test_onlyTheOrdersMerchant_refundsDeliversAndCancels() public {
        GraphPayCheckout.Order memory o = _pay(35, AGENT_NODE, 1_000_000, agentKey);
        address[5] memory others = [otherMerchant, relayer, admin, policyWriter, agent];
        for (uint256 i = 0; i < others.length; i++) {
            vm.prank(others[i]);
            vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
            checkout.refund(o.orderId, 1, 1);
            vm.prank(others[i]);
            vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
            checkout.markDelivered(o.orderId);
            vm.prank(others[i]);
            vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
            checkout.cancelOrder(o.orderId, SHOP_NODE, 1);
        }
    }

    function test_markDelivered_movesPaidToDelivered_once() public {
        GraphPayCheckout.Order memory o = _pay(36, AGENT_NODE, 1_000_000, agentKey);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.OrderDelivered(o.orderId, SHOP_NODE, _now());
        vm.prank(merchant);
        checkout.markDelivered(o.orderId);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.DELIVERED));
        vm.prank(merchant);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.markDelivered(o.orderId);
    }

    function test_cancelOrder_onlyAnUnpaidOrder_asTheShop_andThenItCannotBePaid() public {
        GraphPayCheckout.Order memory o = _newOrder(37, AGENT_NODE, 1_000_000);
        Signed memory s = _sign(o, agentKey);
        _settle(s); // no approval: CREATED

        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "by node"));
        checkout.cancelOrder(o.orderId, BUYER_NODE, 3);

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.OrderCancelled(o.orderId, SHOP_NODE, 3);
        vm.prank(merchant);
        checkout.cancelOrder(o.orderId, SHOP_NODE, 3);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.CANCELLED));

        s.approval = _approvalPermit(agentKey, APPROVAL_VALUE, _now() + 3600);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 1_000_000, GraphPayCheckout.FailReason.DUPLICATE, 0
        );
        _settle(s);

        GraphPayCheckout.Order memory paid = _pay(38, AGENT_NODE, 1_000_000, agentKey);
        vm.prank(merchant);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.cancelOrder(paid.orderId, SHOP_NODE, 3);
    }

    function _expectSettleRevert(GraphPayCheckout.Order memory o, bytes memory reason) internal {
        Signed memory s = _signWithApproval(o, agentKey);
        vm.prank(relayer);
        vm.expectRevert(reason);
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
    }
}
