// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {GraphPayCheckout} from "../src/GraphPayCheckout.sol";
import {CheckoutFixture} from "./utils/CheckoutFixture.sol";

/// @notice Minimal disputes: the payer opens one, the admin resolves it.
contract DisputesTest is CheckoutFixture {
    function test_onlyThePayer_opensADispute_onAPaidOrder_once() public {
        GraphPayCheckout.Order memory o = _pay(1, AGENT_NODE, 4_800_000, agentKey);
        address[4] memory others = [merchant, relayer, admin, human];
        for (uint256 i = 0; i < others.length; i++) {
            vm.prank(others[i]);
            vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
            checkout.openDispute(o.orderId, 4);
        }
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.Disputed(o.orderId, BUYER_NODE, SHOP_NODE, 4);
        vm.prank(agent);
        checkout.openDispute(o.orderId, 4);
        assertEq(uint8(checkout.orders(o.orderId).dispute), uint8(GraphPayCheckout.DisputeStatus.OPEN));

        vm.prank(agent);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.openDispute(o.orderId, 4);
    }

    function test_aDispute_needsAPaidOrDeliveredOrder() public {
        GraphPayCheckout.Order memory unpaid = _newOrder(2, AGENT_NODE, 1_000_000);
        _settle(_sign(unpaid, agentKey)); // no approval: CREATED, nobody has paid
        vm.prank(agent);
        vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
        checkout.openDispute(unpaid.orderId, 1);

        GraphPayCheckout.Order memory refunded = _pay(3, AGENT_NODE, 1_000_000, agentKey);
        vm.prank(merchant);
        checkout.refund(refunded.orderId, 1_000_000, 1);
        vm.prank(agent);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.openDispute(refunded.orderId, 1);

        GraphPayCheckout.Order memory delivered = _pay(4, AGENT_NODE, 1_000_000, agentKey);
        vm.prank(merchant);
        checkout.markDelivered(delivered.orderId);
        vm.prank(agent);
        checkout.openDispute(delivered.orderId, 1);
    }

    function test_onlyTheAdmin_resolves_andTheRefundIsCappedAtWhatIsLeft() public {
        GraphPayCheckout.Order memory o = _pay(5, AGENT_NODE, 4_800_000, agentKey);
        vm.prank(merchant);
        checkout.refund(o.orderId, 800_000, 2);
        vm.prank(agent);
        checkout.openDispute(o.orderId, 9);

        address[4] memory others = [merchant, relayer, policyWriter, agent];
        for (uint256 i = 0; i < others.length; i++) {
            vm.prank(others[i]);
            vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, others[i]));
            checkout.resolveDispute(o.orderId, 1, 1);
        }

        uint256 agentBefore = usdt.balanceOf(agent);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.Refunded(o.orderId, SHOP_NODE, BUYER_NODE, 4_000_000, 4_800_000, true, 9);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.DisputeResolved(o.orderId, 1, 4_000_000);
        vm.prank(admin);
        checkout.resolveDispute(o.orderId, 1, 10_000_000);
        assertEq(usdt.balanceOf(agent), agentBefore + 4_000_000);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.REFUNDED));
        assertEq(uint8(checkout.orders(o.orderId).dispute), uint8(GraphPayCheckout.DisputeStatus.RESOLVED));

        vm.prank(admin);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.resolveDispute(o.orderId, 1, 1);
        _assertNoFunds();
    }

    function test_resolvingForTheShop_refundsNothing() public {
        GraphPayCheckout.Order memory o = _pay(6, AGENT_NODE, 1_000_000, agentKey);
        vm.prank(agent);
        checkout.openDispute(o.orderId, 3);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "outcome"));
        checkout.resolveDispute(o.orderId, 0, 1);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "outcome"));
        checkout.resolveDispute(o.orderId, 2, 0);

        uint256 merchantBefore = usdt.balanceOf(merchant);
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.DisputeResolved(o.orderId, 0, 0);
        vm.prank(admin);
        checkout.resolveDispute(o.orderId, 0, 0);
        assertEq(usdt.balanceOf(merchant), merchantBefore);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
    }

    function test_resolvingWithoutAnOpenDispute_reverts() public {
        GraphPayCheckout.Order memory o = _pay(7, AGENT_NODE, 1_000_000, agentKey);
        vm.prank(admin);
        vm.expectRevert(GraphPayCheckout.BadState.selector);
        checkout.resolveDispute(o.orderId, 1, 1);
        vm.prank(admin);
        vm.expectRevert(GraphPayCheckout.UnknownOrder.selector);
        checkout.resolveDispute(_oneOffId(999), 1, 1);
    }
}
