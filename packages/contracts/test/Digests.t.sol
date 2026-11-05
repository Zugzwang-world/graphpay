// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {GraphPayCheckout} from "../src/GraphPayCheckout.sol";
import {CheckoutFixture, IDomainSeparator} from "./utils/CheckoutFixture.sol";

/// @notice Every signed digest three ways: by hand here, by viem (test/fixtures/digests.json,
/// written by scripts/digests.mjs and checked by `pnpm test`), and by the contract or the real
/// token and Permit2 on the fork. Then the EIP-2612 suite against the real test USDT.
contract DigestsTest is CheckoutFixture {
    string internal constant FIXTURE = "./test/fixtures/digests.json";
    string internal fixture;

    function setUp() public override {
        super.setUp();
        fixture = vm.readFile(FIXTURE);
    }

    function _fixtureOrder() internal view returns (GraphPayCheckout.Order memory o) {
        o.orderId = vm.parseJsonBytes32(fixture, ".order.orderId");
        o.parentOrderId = vm.parseJsonBytes32(fixture, ".order.parentOrderId");
        o.buyerNode = vm.parseJsonBytes32(fixture, ".order.buyerNode");
        o.shopNode = vm.parseJsonBytes32(fixture, ".order.shopNode");
        o.payerNode = vm.parseJsonBytes32(fixture, ".order.payerNode");
        o.merchant = vm.parseJsonAddress(fixture, ".order.merchant");
        o.amountMicro = uint64(vm.parseJsonUint(fixture, ".order.amountMicro"));
        o.deadline = uint64(vm.parseJsonUint(fixture, ".order.deadline"));
        o.kind = uint8(vm.parseJsonUint(fixture, ".order.kind"));
    }

    function _fixturePermitSingle(address spender) internal view returns (IAllowanceTransfer.PermitSingle memory ps) {
        ps.details.token = address(usdt);
        ps.details.amount = uint160(vm.parseJsonUint(fixture, ".permitSingle.amount"));
        ps.details.expiration = uint48(vm.parseJsonUint(fixture, ".permitSingle.expiration"));
        ps.details.nonce = uint48(vm.parseJsonUint(fixture, ".permitSingle.nonce"));
        ps.spender = spender;
        ps.sigDeadline = vm.parseJsonUint(fixture, ".permitSingle.sigDeadline");
    }

    function _fixtureSub() internal view returns (GraphPayCheckout.Sub memory s) {
        s.subId = vm.parseJsonBytes32(fixture, ".sub.subId");
        s.subscriberNode = vm.parseJsonBytes32(fixture, ".sub.subscriberNode");
        s.shopNode = vm.parseJsonBytes32(fixture, ".sub.shopNode");
        s.payerNode = vm.parseJsonBytes32(fixture, ".sub.payerNode");
        s.merchant = vm.parseJsonAddress(fixture, ".sub.merchant");
        s.amountMicro = uint64(vm.parseJsonUint(fixture, ".sub.amountMicro"));
        s.period = uint32(vm.parseJsonUint(fixture, ".sub.period"));
        s.firstChargeAt = uint64(vm.parseJsonUint(fixture, ".sub.firstChargeAt"));
    }

    /// @dev A checkout deployed at the fixture's address, so its own-domain digests compare with viem's.
    function _checkoutAtFixtureAddress() internal returns (GraphPayCheckout c) {
        address at = vm.parseJsonAddress(fixture, ".checkout");
        deployCodeTo(
            "GraphPayCheckout.sol:GraphPayCheckout",
            abi.encode(address(usdt), address(permit2), admin, relayer, policyWriter),
            at
        );
        c = GraphPayCheckout(at);
    }

    function test_theContractsTypeStrings_areTheSpecs() public view {
        assertEq(checkout.ORDER_TYPEHASH(), keccak256(bytes(ORDER_TYPE)));
        assertEq(keccak256(bytes(checkout.WITNESS_TYPE())), keccak256(bytes(WITNESS_TYPE_STRING)));
        assertEq(checkout.SUBSCRIBE_TYPEHASH(), SUBSCRIBE_TYPE_HASH);
        assertEq(checkout.CANCEL_TYPEHASH(), CANCEL_TYPE_HASH);
    }

    function test_thePermit2Domain_byHand_isTheRealPermit2s() public view {
        assertEq(_permit2Domain(), IDomainSeparator(address(permit2)).DOMAIN_SEPARATOR());
    }

    function test_theWitnessDigest_matchesViem_andTheContractsWitness() public {
        GraphPayCheckout.Order memory o = _fixtureOrder();
        bytes32 mandate = vm.parseJsonBytes32(fixture, ".mandateHash");
        ISignatureTransfer.PermitTransferFrom memory p = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({token: address(usdt), amount: o.amountMicro}),
            nonce: vm.parseJsonUint(fixture, ".permit.nonce"),
            deadline: vm.parseJsonUint(fixture, ".permit.deadline")
        });
        assertEq(p.nonce, uint256(o.orderId), "nonce = uint256(orderId)");
        GraphPayCheckout c = _checkoutAtFixtureAddress();

        bytes32 witness = _witnessStruct(o, mandate);
        assertEq(witness, vm.parseJsonBytes32(fixture, ".digests.witnessStruct"), "witness struct: hand vs viem");
        assertEq(c.witnessHash(o, mandate), witness, "witness struct: contract vs hand");
        assertEq(
            _witnessDigest(o, mandate, p, address(c)),
            vm.parseJsonBytes32(fixture, ".digests.witness"),
            "witness digest: hand vs viem"
        );
    }

    function test_aViemShapedWitnessSignature_paysThroughTheRealPermit2() public {
        // The fixture's digest shape, signed for a real payer and the deployed checkout.
        GraphPayCheckout.Order memory o = _newOrder(1, AGENT_NODE, 1_000_000);
        Signed memory s = _signWithApproval(o, agentKey);
        _settle(s);
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
    }

    function test_theEip2612Digest_matchesViem_andTheTokensDomain() public view {
        assertEq(_tokenDomain(), usdt.DOMAIN_SEPARATOR(), "configured domain = the token's DOMAIN_SEPARATOR()");
        bytes32 digest = _eip2612Digest(
            vm.parseJsonAddress(fixture, ".approval.owner"),
            address(permit2),
            vm.parseJsonUint(fixture, ".approval.value"),
            vm.parseJsonUint(fixture, ".approval.nonce"),
            vm.parseJsonUint(fixture, ".approval.deadline")
        );
        assertEq(digest, vm.parseJsonBytes32(fixture, ".digests.eip2612"), "EIP-2612 digest: hand vs viem");
    }

    function test_thePermitSingleDigestAndHash_matchViem() public view {
        IAllowanceTransfer.PermitSingle memory ps = _fixturePermitSingle(vm.parseJsonAddress(fixture, ".checkout"));
        assertEq(_permitSingleDigest(ps), vm.parseJsonBytes32(fixture, ".digests.permitSingle"), "hand vs viem");
        assertEq(_permitHash(ps), vm.parseJsonBytes32(fixture, ".digests.permitHash"), "permitHash: hand vs viem");
    }

    function test_theSubscribeAndCancelDigests_matchViem_andTheContract() public {
        GraphPayCheckout c = _checkoutAtFixtureAddress();
        GraphPayCheckout.Sub memory s = _fixtureSub();
        IAllowanceTransfer.PermitSingle memory ps = _fixturePermitSingle(address(c));
        bytes32 subscribe = _subscribeDigest(s, ps, address(c));
        assertEq(subscribe, vm.parseJsonBytes32(fixture, ".digests.subscribe"), "subscribe: hand vs viem");
        assertEq(c.subscribeDigest(s, ps), subscribe, "subscribe: contract vs hand");
        assertEq(c.domainSeparator(), _checkoutDomain(address(c)), "checkout domain");

        uint64 deadline = uint64(vm.parseJsonUint(fixture, ".cancel.deadline"));
        bytes32 cancel = _cancelDigest(s.subId, deadline, address(c));
        assertEq(cancel, vm.parseJsonBytes32(fixture, ".digests.cancel"), "cancel: hand vs viem");
        assertEq(c.cancelDigest(s.subId, deadline), cancel, "cancel: contract vs hand");
    }

    // ---------------------------------------------------------------- EIP-2612 on the real test USDT

    function test_usdt_isTheConfiguredToken() public view {
        assertEq(usdt.decimals(), vm.parseJsonUint(json, ".whitechain.tokens.usdt.decimals"));
        assertEq(usdt.symbol(), vm.parseJsonString(json, ".whitechain.tokens.usdt.symbol"));
        assertEq(usdt.name(), tokenName);
    }

    function test_usdt_packedBytesPermit_approvesPermit2() public {
        uint256 deadline = _now() + 600;
        bytes32 digest = _eip2612Digest(human, address(permit2), APPROVAL_VALUE, usdt.nonces(human), deadline);
        vm.prank(stranger); // gasless for the owner: anyone submits it
        usdt.permit(human, address(permit2), APPROVAL_VALUE, deadline, _sigOf(humanKey, digest));
        assertEq(usdt.allowance(human, address(permit2)), APPROVAL_VALUE);
        assertEq(usdt.nonces(human), 1);
    }

    function test_usdt_vrsPermit_approvesPermit2() public {
        uint256 deadline = _now() + 600;
        bytes32 digest = _eip2612Digest(human, address(permit2), APPROVAL_VALUE, usdt.nonces(human), deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(humanKey, digest);
        usdt.permit(human, address(permit2), APPROVAL_VALUE, deadline, v, r, s);
        assertEq(usdt.allowance(human, address(permit2)), APPROVAL_VALUE);
    }

    function test_usdt_refusesAPermitSignedUnderAnotherDomainName() public {
        // Pitfall: a wrong token name signs under another domain; the token refuses it.
        uint256 deadline = _now() + 600;
        bytes32 wrongDomain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("USDT"), keccak256(bytes(tokenVersion)), chainId, address(usdt))
        );
        bytes32 structHash = keccak256(
            abi.encode(EIP2612_TYPEHASH, human, address(permit2), APPROVAL_VALUE, usdt.nonces(human), deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", wrongDomain, structHash));
        vm.expectRevert();
        usdt.permit(human, address(permit2), APPROVAL_VALUE, deadline, _sigOf(humanKey, digest));
        assertEq(usdt.allowance(human, address(permit2)), 0);
    }

    function test_aWrongDomainApproval_isDroppedQuietly_andThePaymentEndsTransferFailed() public {
        GraphPayCheckout.Order memory o = _newOrder(2, AGENT_NODE, 1_000_000);
        Signed memory s = _sign(o, agentKey);
        uint256 deadline = _now() + 600;
        bytes32 wrongDomain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("USDT"), keccak256(bytes(tokenVersion)), chainId, address(usdt))
        );
        bytes32 structHash = keccak256(
            abi.encode(EIP2612_TYPEHASH, agent, address(permit2), APPROVAL_VALUE, usdt.nonces(agent), deadline)
        );
        s.approval = abi.encode(
            APPROVAL_VALUE, deadline, _sigOf(agentKey, keccak256(abi.encodePacked("\x19\x01", wrongDomain, structHash)))
        );
        vm.expectEmit(true, true, true, true, address(checkout));
        emit GraphPayCheckout.PaymentFailed(
            o.orderId, AGENT_NODE, SHOP_NODE, 1_000_000, GraphPayCheckout.FailReason.TRANSFER_FAILED, 0
        );
        _settle(s);
    }

    function test_aFrontRunApproval_isHarmless() public {
        GraphPayCheckout.Order memory o = _newOrder(3, AGENT_NODE, 1_000_000);
        Signed memory s = _signWithApproval(o, agentKey);
        (uint256 value, uint256 deadline, bytes memory sig) = abi.decode(s.approval, (uint256, uint256, bytes));
        vm.prank(stranger);
        usdt.permit(agent, address(permit2), value, deadline, sig); // someone applies it first
        _settle(s); // the contract's own attempt then fails quietly; the pull still works
        assertEq(uint8(checkout.orders(o.orderId).status), uint8(GraphPayCheckout.Status.PAID));
    }
}
