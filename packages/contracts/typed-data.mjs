// The EIP-712 shapes every GraphPayCheckout signer uses (planning/SPEC/PAYMENTS_WHITECHAIN.md §4),
// in viem's typed-data form. The contract's type strings and these definitions are checked
// against each other through the digest fixture (test/fixtures/digests.json, both sides).
// Addresses come from @graphpay/config, never from here.

import { encodeAbiParameters, keccak256 } from 'viem';

export const ORDER_KIND = Object.freeze({ ONE_OFF: 0, REORDER: 1, RENEWAL: 2 });
export const ORDER_STATUS = Object.freeze(['NONE', 'CREATED', 'PAID', 'DELIVERED', 'CANCELLED', 'REFUNDED']);
export const SUB_STATUS = Object.freeze(['NONE', 'ACTIVE', 'LAPSED', 'CANCELLED']);
export const DISPUTE_STATUS = Object.freeze(['NONE', 'OPEN', 'RESOLVED']);
export const FAIL_REASON = Object.freeze([
  'NONE',
  'AGENT_REVOKED',
  'SPEND_CAP',
  'TRANSFER_FAILED',
  'EXPIRED',
  'DUPLICATE',
  'AGENT_EXPIRED',
  'NODE_MISMATCH',
]);

// Renewal order ids carry the top bit; one-off and re-order ids must not (E-5).
export const RENEWAL_BIT = 1n << 255n;

const graphPayOrder = [
  { name: 'orderId', type: 'bytes32' },
  { name: 'parentOrderId', type: 'bytes32' },
  { name: 'buyerNode', type: 'bytes32' },
  { name: 'shopNode', type: 'bytes32' },
  { name: 'payerNode', type: 'bytes32' },
  { name: 'merchant', type: 'address' },
  { name: 'amountMicro', type: 'uint64' },
  { name: 'deadline', type: 'uint64' },
  { name: 'kind', type: 'uint8' },
  { name: 'mandateHash', type: 'bytes32' },
];

// Permit2 SignatureTransfer with the order as the witness. Signed with
// primaryType 'PermitWitnessTransferFrom'; spender = the checkout; nonce = uint256(orderId).
export const permitWitnessTypes = Object.freeze({
  PermitWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'GraphPayOrder' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  GraphPayOrder: graphPayOrder,
});

// The witness type string the contract passes to Permit2 (its WITNESS_TYPE constant).
export const WITNESS_TYPE_STRING =
  'GraphPayOrder witness)GraphPayOrder(bytes32 orderId,bytes32 parentOrderId,bytes32 buyerNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint64 deadline,uint8 kind,bytes32 mandateHash)TokenPermissions(address token,uint256 amount)';

// Permit2 AllowanceTransfer, for subscriptions (spender = the checkout).
export const permitSingleTypes = Object.freeze({
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
});

// EIP-2612 approval of Permit2, in the token's own domain.
export const eip2612Types = Object.freeze({
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
});

// The subscriber's terms and cancel, in the checkout's domain.
export const subscribeTypes = Object.freeze({
  Subscribe: [
    { name: 'subId', type: 'bytes32' },
    { name: 'subscriberNode', type: 'bytes32' },
    { name: 'shopNode', type: 'bytes32' },
    { name: 'payerNode', type: 'bytes32' },
    { name: 'merchant', type: 'address' },
    { name: 'amountMicro', type: 'uint64' },
    { name: 'period', type: 'uint32' },
    { name: 'firstChargeAt', type: 'uint64' },
    { name: 'permitHash', type: 'bytes32' },
  ],
});

export const cancelTypes = Object.freeze({
  Cancel: [
    { name: 'subId', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
});

// Permit2's domain has no version.
export const permit2Domain = (chainId, permit2) => ({ name: 'Permit2', chainId, verifyingContract: permit2 });

export const checkoutDomain = (chainId, checkout) => ({
  name: 'GraphPayCheckout',
  version: '1',
  chainId,
  verifyingContract: checkout,
});

// The token's EIP-2612 domain from the token config ({ address, eip712: { name, version } }).
export const tokenDomain = (chainId, token) => ({
  name: token.eip712.name,
  version: token.eip712.version,
  chainId,
  verifyingContract: token.address,
});

// keccak256(abi.encode(token, amount, expiration, nonce, spender, sigDeadline)): binds the
// subscriber's Subscribe terms to one PermitSingle.
export function permitHash(permitSingle) {
  const { details, spender, sigDeadline } = permitSingle;
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint160' }, { type: 'uint48' }, { type: 'uint48' }, { type: 'address' }, { type: 'uint256' }],
      [details.token, BigInt(details.amount), Number(details.expiration), Number(details.nonce), spender, BigInt(sigDeadline)],
    ),
  );
}

// keccak256(abi.encode(subId, cycle)) with the top bit set (the contract's renewalOrderId).
export function renewalOrderId(subId, cycle) {
  const id = BigInt(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint32' }], [subId, Number(cycle)])));
  return `0x${(id | RENEWAL_BIT).toString(16).padStart(64, '0')}`;
}
