export { checkoutAbi } from './abi/GraphPayCheckout';

type Hex = `0x${string}`;
type TypedField = { name: string; type: string };

export declare const ORDER_KIND: Readonly<{ ONE_OFF: 0; REORDER: 1; RENEWAL: 2 }>;
export declare const ORDER_STATUS: readonly ['NONE', 'CREATED', 'PAID', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
export declare const SUB_STATUS: readonly ['NONE', 'ACTIVE', 'LAPSED', 'CANCELLED'];
export declare const DISPUTE_STATUS: readonly ['NONE', 'OPEN', 'RESOLVED'];
export declare const FAIL_REASON: readonly [
  'NONE',
  'AGENT_REVOKED',
  'SPEND_CAP',
  'TRANSFER_FAILED',
  'EXPIRED',
  'DUPLICATE',
  'AGENT_EXPIRED',
  'NODE_MISMATCH',
];
export declare const RENEWAL_BIT: bigint;
export declare const WITNESS_TYPE_STRING: string;
export declare const permitWitnessTypes: Readonly<Record<'PermitWitnessTransferFrom' | 'TokenPermissions' | 'GraphPayOrder', TypedField[]>>;
export declare const permitSingleTypes: Readonly<Record<'PermitSingle' | 'PermitDetails', TypedField[]>>;
export declare const eip2612Types: Readonly<Record<'Permit', TypedField[]>>;
export declare const subscribeTypes: Readonly<Record<'Subscribe', TypedField[]>>;
export declare const cancelTypes: Readonly<Record<'Cancel', TypedField[]>>;
export declare function permit2Domain(chainId: number, permit2: Hex): { name: 'Permit2'; chainId: number; verifyingContract: Hex };
export declare function checkoutDomain(
  chainId: number,
  checkout: Hex,
): { name: 'GraphPayCheckout'; version: '1'; chainId: number; verifyingContract: Hex };
export declare function tokenDomain(
  chainId: number,
  token: { address: Hex; eip712: { name: string; version: string } },
): { name: string; version: string; chainId: number; verifyingContract: Hex };
export declare function permitHash(permitSingle: {
  details: { token: Hex; amount: bigint | number; expiration: number; nonce: number };
  spender: Hex;
  sigDeadline: bigint | number;
}): Hex;
export declare function renewalOrderId(subId: Hex, cycle: number): Hex;
