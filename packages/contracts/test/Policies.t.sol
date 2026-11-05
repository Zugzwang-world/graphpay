// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {GraphPayCheckout} from "../src/GraphPayCheckout.sol";
import {CheckoutFixture} from "./utils/CheckoutFixture.sol";

/// @notice AgentPolicy: the contract enforces the policy of the ENS node a wallet is bound to.
contract PoliciesTest is CheckoutFixture {
    function test_aRevokedAgent_isRecordedAgentRevoked_andMovesNoMoney() public {
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, true, AGENT_CAP, 0);
        GraphPayCheckout.Order memory o = _newOrder(1, AGENT_NODE, 400_000);
        uint256 before = usdt.balanceOf(agent);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 400_000, GraphPayCheckout.FailReason.AGENT_REVOKED, 0
        );
        uint256 gasUsed = _settle(_signWithApproval(o, agentKey));
        emit log_named_uint("gas: recorded failure, revoked agent (execution only)", gasUsed);
        assertEq(usdt.balanceOf(agent), before);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.CREATED));
    }

    function test_aRefusedPayment_consumesNoApproval() public {
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, true, AGENT_CAP, 0);
        uint256 nonceBefore = usdt.nonces(agent);
        _settle(_signWithApproval(_newOrder(2, AGENT_NODE, 400_000), agentKey));
        assertEq(usdt.allowance(agent, address(permit2)), 0, "the approval was applied for a refused payment");
        assertEq(usdt.nonces(agent), nonceBefore, "the approval permit was consumed");
    }

    function test_overTheDailyCap_isRecordedSpendCap() public {
        _pay(3, AGENT_NODE, 4_800_000, agentKey);
        _pay(4, AGENT_NODE, 1_200_000, agentKey); // exactly the cap
        GraphPayCheckout.Order memory o = _newOrder(5, AGENT_NODE, 1);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(o.orderId, AGENT_NODE, SHOP_NODE, 1, GraphPayCheckout.FailReason.SPEND_CAP, 0);
        _settle(_sign(o, agentKey));
        assertEq(checkout.spentToday(AGENT_NODE), AGENT_CAP);
    }

    function test_theCapResets_onTheNextUtcDay() public {
        _pay(6, AGENT_NODE, 6_000_000, agentKey);
        uint256 today = _now() / 1 days;
        vm.warp((today + 1) * 1 days);
        assertEq(checkout.spentToday(AGENT_NODE), 0);
        _pay(7, AGENT_NODE, 1_000_000, agentKey);
        assertEq(checkout.spentMicro(AGENT_NODE, 0, today), 6_000_000, "yesterday stays queryable");
        assertEq(checkout.spentMicro(AGENT_NODE, 0, today + 1), 1_000_000);
    }

    function test_anExpiredPolicy_isRecordedAgentExpired_andExpiryZeroMeansNever() public {
        uint64 expiry = _now() + 100;
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, false, AGENT_CAP, expiry);
        _pay(8, AGENT_NODE, 1_000_000, agentKey);
        vm.warp(expiry);
        GraphPayCheckout.Order memory o = _newOrder(9, AGENT_NODE, 1_000_000);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 1_000_000, GraphPayCheckout.FailReason.AGENT_EXPIRED, 0
        );
        _settle(_sign(o, agentKey));

        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, false, AGENT_CAP, 0);
        vm.warp(_now() + 3650 days);
        _pay(10, AGENT_NODE, 1_000_000, agentKey);
    }

    /// The payerNode = 0 bypass: a bound (here revoked) agent wallet cannot pay "as a human".
    function test_aBoundWalletPayingAsAHuman_isNodeMismatch() public {
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, true, AGENT_CAP, 0);
        GraphPayCheckout.Order memory o = _newOrder(11, bytes32(0), 400_000);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, bytes32(0), SHOP_NODE, 400_000, GraphPayCheckout.FailReason.NODE_MISMATCH, 0
        );
        _settle(_signWithApproval(o, agentKey));
        assertEq(usdt.balanceOf(merchant), 0);
    }

    function test_aBoundWalletClaimingAnotherNode_isNodeMismatch() public {
        vm.prank(policyWriter);
        checkout.setPolicy(OTHER_AGENT_NODE, 0, otherAgent, false, AGENT_CAP, 0);
        GraphPayCheckout.Order memory o = _newOrder(12, OTHER_AGENT_NODE, 400_000);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, OTHER_AGENT_NODE, SHOP_NODE, 400_000, GraphPayCheckout.FailReason.NODE_MISMATCH, 0
        );
        _settle(_signWithApproval(o, agentKey));
    }

    function test_anUnboundWalletClaimingANode_isNodeMismatch() public {
        GraphPayCheckout.Order memory o = _newOrder(13, AGENT_NODE, 400_000);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 400_000, GraphPayCheckout.FailReason.NODE_MISMATCH, 0
        );
        _settle(_signWithApproval(o, humanKey));
        assertEq(checkout.spentToday(AGENT_NODE), 0);
    }

    function test_aNodeWithoutAPolicy_isNodeMismatch() public {
        GraphPayCheckout.Order memory o = _newOrder(14, HUMAN_NODE, 400_000);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, HUMAN_NODE, SHOP_NODE, 400_000, GraphPayCheckout.FailReason.NODE_MISMATCH, 0
        );
        _settle(_signWithApproval(o, humanKey));
    }

    function test_aHumanPaysFromAnUnboundWallet_withNoCap() public {
        GraphPayCheckout.Order memory o = _newOrder(15, bytes32(0), 5_000_000);
        _settle(_signWithApproval(o, humanKey));
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
        assertEq(checkout.spentToday(bytes32(0)), 0, "humans have no tally");
    }

    function test_aNewEpoch_startsAFreshHistory_andTheOldEpochStaysQueryable() public {
        _pay(16, AGENT_NODE, 6_000_000, agentKey);
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 1, agent, false, AGENT_CAP, 0);
        assertEq(checkout.spentToday(AGENT_NODE), 0);
        GraphPayCheckout.Order memory o = _newOrder(17, AGENT_NODE, 1_000_000);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentSettled(o.orderId, AGENT_NODE, SHOP_NODE, agent, 1_000_000, _now() / 1 days, MANDATE, 1);
        _settle(_signWithApproval(o, agentKey));
        assertEq(checkout.spentMicro(AGENT_NODE, 0, _now() / 1 days), 6_000_000);
        assertEq(checkout.spentMicro(AGENT_NODE, 1, _now() / 1 days), 1_000_000);
    }

    function test_theEpochNeverDecreases() public {
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 3, agent, false, AGENT_CAP, 0);
        vm.prank(policyWriter);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "epoch"));
        checkout.setPolicy(AGENT_NODE, 2, agent, false, AGENT_CAP, 0);
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 3, agent, true, 0, 0); // same epoch: an update
        assertEq(checkout.policies(AGENT_NODE).epoch, 3);
        assertTrue(checkout.policies(AGENT_NODE).revoked);
    }

    function test_aWalletBoundToAnotherNode_cannotBeBoundAgain() public {
        vm.prank(policyWriter);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "wallet bound to another node"));
        checkout.setPolicy(OTHER_AGENT_NODE, 0, agent, false, AGENT_CAP, 0);
    }

    function test_movingANodeToANewWallet_releasesTheOldWallet() public {
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.AgentPolicySet(AGENT_NODE, 1, otherAgent, false, AGENT_CAP, 0);
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 1, otherAgent, false, AGENT_CAP, 0);
        assertEq(checkout.nodeOfWallet(otherAgent), AGENT_NODE);
        assertEq(checkout.nodeOfWallet(agent), bytes32(0), "the old wallet is released");
        assertEq(checkout.policies(AGENT_NODE).wallet, otherAgent);

        // The released wallet pays as a human again; the node pays only from its new wallet.
        GraphPayCheckout.Order memory asHuman = _newOrder(18, bytes32(0), 400_000);
        _settle(_signWithApproval(asHuman, agentKey));
        assertEq(uint8(checkout.orders(asHuman.orderId).status), uint8(GraphPayCheckout.Status.PAID));
        _pay(19, AGENT_NODE, 400_000, otherAgentKey);
    }

    function test_aZeroCapMeansMayNotSpend_andTheMaximumMeansUnlimited() public {
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, false, 0, 0);
        GraphPayCheckout.Order memory o = _newOrder(20, AGENT_NODE, 1);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(o.orderId, AGENT_NODE, SHOP_NODE, 1, GraphPayCheckout.FailReason.SPEND_CAP, 0);
        _settle(_signWithApproval(o, agentKey));

        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, false, type(uint64).max, 0);
        _pay(21, AGENT_NODE, 10_000_000, agentKey);
        _pay(22, AGENT_NODE, 1_000_000, agentKey);
    }

    function test_setPolicy_refusesZeroNodeOrWallet() public {
        vm.startPrank(policyWriter);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "policy"));
        checkout.setPolicy(bytes32(0), 0, otherAgent, false, AGENT_CAP, 0);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "policy"));
        checkout.setPolicy(OTHER_AGENT_NODE, 0, address(0), false, AGENT_CAP, 0);
        vm.stopPrank();
    }

    /// forge-config: default.fuzz.runs = 32
    function testFuzz_spendNeverExceedsTheCap(uint64 cap, uint64 first, uint64 second) public {
        cap = uint64(bound(cap, 1, 10_000_000));
        first = uint64(bound(first, 1, 6_000_000)); // the agent holds 12 test USDT
        second = uint64(bound(second, 1, 6_000_000));
        vm.prank(policyWriter);
        checkout.setPolicy(AGENT_NODE, 0, agent, false, cap, 0);
        vm.prank(agent);
        usdt.approve(address(permit2), type(uint256).max);
        _settle(_sign(_newOrder(100, AGENT_NODE, first), agentKey));
        _settle(_sign(_newOrder(101, AGENT_NODE, second), agentKey));
        assertLe(checkout.spentToday(AGENT_NODE), cap);
    }
}
