// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {GraphPayCheckout} from "../src/GraphPayCheckout.sol";
import {CheckoutFixture} from "./utils/CheckoutFixture.sol";

/// @notice ADR-0021: admin, relayer, policy writer and each order's merchant stay separate.
contract RolesTest is CheckoutFixture {
    function test_theConstructor_refusesMissingOrSharedRoles_andATokenWithoutCode() public {
        address token = address(usdt);
        address p2 = address(permit2);
        bytes memory roles = abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "roles");
        vm.expectRevert(roles);
        new GraphPayCheckout(token, p2, admin, address(0), policyWriter);
        vm.expectRevert(roles);
        new GraphPayCheckout(token, p2, admin, relayer, address(0));
        vm.expectRevert(roles);
        new GraphPayCheckout(token, p2, admin, admin, policyWriter);
        vm.expectRevert(roles);
        new GraphPayCheckout(token, p2, admin, relayer, admin);
        vm.expectRevert(roles);
        new GraphPayCheckout(token, p2, admin, relayer, relayer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new GraphPayCheckout(token, p2, address(0), relayer, policyWriter);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "token"));
        new GraphPayCheckout(stranger, p2, admin, relayer, policyWriter);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "permit2"));
        new GraphPayCheckout(token, stranger, admin, relayer, policyWriter);
    }

    function test_theDeployment_pinsTheTokenAndPermit2_andTheRoles() public view {
        assertEq(address(checkout.USDT()), address(usdt));
        assertEq(address(checkout.PERMIT2()), address(permit2));
        assertEq(checkout.owner(), admin);
        assertTrue(checkout.isRelayer(relayer));
        assertTrue(checkout.isRelayer(renewer));
        assertTrue(checkout.isPolicyWriter(policyWriter));
        assertFalse(checkout.isRelayer(admin));
        assertFalse(checkout.isPolicyWriter(relayer));
    }

    function test_theRelayer_isRefusedEverythingButSettlingAndRenewing() public {
        GraphPayCheckout.Order memory o = _pay(1, AGENT_NODE, 1_000_000, agentKey);
        vm.startPrank(relayer);
        vm.expectRevert(GraphPayCheckout.NotPolicyWriter.selector);
        checkout.setPolicy(OTHER_AGENT_NODE, 0, otherAgent, false, 1, 0);
        vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
        checkout.refund(o.orderId, 1, 1);
        vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
        checkout.markDelivered(o.orderId);
        vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
        checkout.openDispute(o.orderId, 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, relayer));
        checkout.resolveDispute(o.orderId, 1, 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, relayer));
        checkout.setRelayer(stranger, true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, relayer));
        checkout.setPolicyWriter(stranger, true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, relayer));
        checkout.transferOwnership(relayer);
        vm.stopPrank();
    }

    function test_thePolicyWriter_isRefusedEverythingThatMovesMoney() public {
        GraphPayCheckout.Order memory paid = _pay(2, AGENT_NODE, 1_000_000, agentKey);
        GraphPayCheckout.Order memory o = _newOrder(3, AGENT_NODE, 1_000_000);
        Signed memory s = _signWithApproval(o, agentKey);
        vm.startPrank(policyWriter);
        vm.expectRevert(GraphPayCheckout.NotRelayer.selector);
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
        vm.expectRevert(GraphPayCheckout.NotRelayer.selector);
        checkout.renew(keccak256("any subscription"));
        vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
        checkout.refund(paid.orderId, 1, 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, policyWriter));
        checkout.resolveDispute(paid.orderId, 1, 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, policyWriter));
        checkout.setRelayer(policyWriter, true);
        vm.stopPrank();
    }

    function test_theAdmin_isRefusedSettlingPoliciesRefundsAndDisputesOfItsOwn() public {
        GraphPayCheckout.Order memory paid = _pay(4, AGENT_NODE, 1_000_000, agentKey);
        GraphPayCheckout.Order memory o = _newOrder(5, AGENT_NODE, 1_000_000);
        Signed memory s = _signWithApproval(o, agentKey);
        vm.startPrank(admin);
        vm.expectRevert(GraphPayCheckout.NotRelayer.selector);
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
        vm.expectRevert(GraphPayCheckout.NotRelayer.selector);
        checkout.renew(keccak256("any subscription"));
        vm.expectRevert(GraphPayCheckout.NotPolicyWriter.selector);
        checkout.setPolicy(OTHER_AGENT_NODE, 0, otherAgent, false, 1, 0);
        vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
        checkout.refund(paid.orderId, 1, 1);
        vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
        checkout.markDelivered(paid.orderId);
        vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
        checkout.openDispute(paid.orderId, 1);
        vm.stopPrank();
    }

    function test_aMerchant_isRefusedEverythingButItsOwnOrders() public {
        GraphPayCheckout.Order memory o = _newOrder(6, AGENT_NODE, 1_000_000);
        Signed memory s = _signWithApproval(o, agentKey);
        vm.startPrank(merchant);
        vm.expectRevert(GraphPayCheckout.NotRelayer.selector);
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
        vm.expectRevert(GraphPayCheckout.NotPolicyWriter.selector);
        checkout.setPolicy(AGENT_NODE, 0, agent, false, type(uint64).max, 0);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, merchant));
        checkout.setRelayer(merchant, true);
        vm.stopPrank();
    }

    function test_theSetters_refuseAnAddressThatHoldsAnotherRole_andRemovingAlwaysWorks() public {
        bytes memory refused = abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "role");
        vm.startPrank(admin);
        vm.expectRevert(refused);
        checkout.setRelayer(policyWriter, true);
        vm.expectRevert(refused);
        checkout.setRelayer(admin, true);
        vm.expectRevert(refused);
        checkout.setRelayer(address(0), true);
        vm.expectRevert(refused);
        checkout.setPolicyWriter(relayer, true);
        vm.expectRevert(refused);
        checkout.setPolicyWriter(renewer, true);
        vm.expectRevert(refused);
        checkout.setPolicyWriter(admin, true);

        address nextAdmin = makeAddr("next admin");
        checkout.transferOwnership(nextAdmin);
        vm.expectRevert(refused); // the pending admin holds no other role either
        checkout.setRelayer(nextAdmin, true);
        vm.expectRevert(refused);
        checkout.setPolicyWriter(nextAdmin, true);

        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.RelayerSet(relayer, false);
        checkout.setRelayer(relayer, false);
        checkout.setPolicyWriter(policyWriter, false);
        vm.stopPrank();
        assertFalse(checkout.isRelayer(relayer));
        assertFalse(checkout.isPolicyWriter(policyWriter));

        GraphPayCheckout.Order memory o = _newOrder(7, AGENT_NODE, 1_000_000);
        Signed memory s = _signWithApproval(o, agentKey);
        vm.prank(relayer);
        vm.expectRevert(GraphPayCheckout.NotRelayer.selector);
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
    }

    function test_renounceOwnership_reverts() public {
        vm.prank(admin);
        vm.expectRevert(GraphPayCheckout.NotAllowed.selector);
        checkout.renounceOwnership();
        assertEq(checkout.owner(), admin);
    }

    function test_ownershipMovesInTwoSteps_toAnAddressWithNoOtherRole() public {
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "role"));
        checkout.transferOwnership(relayer);
        vm.expectRevert(abi.encodeWithSelector(GraphPayCheckout.BadInput.selector, "role"));
        checkout.transferOwnership(policyWriter);
        address nextAdmin = makeAddr("next admin");
        checkout.transferOwnership(nextAdmin);
        vm.stopPrank();
        assertEq(checkout.owner(), admin, "the transfer waits for acceptance");
        assertEq(checkout.pendingOwner(), nextAdmin);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        checkout.acceptOwnership();
        vm.prank(nextAdmin);
        checkout.acceptOwnership();
        assertEq(checkout.owner(), nextAdmin);
        assertEq(checkout.pendingOwner(), address(0));

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, admin));
        checkout.setRelayer(stranger, true);
    }

    function test_aSecondRelayer_canSettleAndRenew_withItsOwnKey() public {
        GraphPayCheckout.Order memory o = _newOrder(8, AGENT_NODE, 1_000_000);
        Signed memory s = _signWithApproval(o, agentKey);
        vm.prank(renewer);
        checkout.settleOrder(s.o, s.mandate, s.permit, s.payer, s.sig, s.approval);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
    }
}
