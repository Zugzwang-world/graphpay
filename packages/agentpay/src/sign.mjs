// What a payer signs, and nothing else: the Permit2 witness over the order (one signature
// per payment, the order as the witness, so no relayer can change payee or amount), and
// when Permit2 is not yet approved, a bounded EIP-2612 approval of Permit2 that the relayer
// applies in the same transaction. The payer needs no gas and no earlier transaction.
// Every signer checks eth_chainId first.

import { encodeAbiParameters, erc20Abi, getAddress, parseAbi } from 'viem';
import {
  cancelTypes,
  checkoutDomain,
  eip2612Types,
  permit2Domain,
  permitHash,
  permitSingleTypes,
  permitWitnessTypes,
  subscribeTypes,
  tokenDomain,
} from './vendor/index.mjs';
import { assertChain } from './network.mjs';
import { fromWireOrder } from './wire.mjs';

// Bounded, never unlimited (the lab used 50 for a 6.00 budget).
export const DEFAULT_APPROVAL_MICRO = 50_000_000n;
const APPROVAL_TTL_SECONDS = 3600n;
const noncesAbi = parseAbi(['function nonces(address owner) view returns (uint256)']);
export const permit2Abi = parseAbi([
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  'function nonceBitmap(address owner, uint256 wordPos) view returns (uint256)',
]);

// The EIP-2612 approval of Permit2, as the contract's approvalPermit bytes, or '0x' when the
// payer's allowance already covers `amount`.
export async function approvalPermitFor({ account, publicClient, network, amount, approvalMicro = DEFAULT_APPROVAL_MICRO, nowSec }) {
  const { token, permit2 } = network;
  const allowance = await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'allowance', args: [account.address, permit2] });
  if (allowance >= amount) return '0x';
  const value = amount > approvalMicro ? amount : approvalMicro;
  const deadline = BigInt(nowSec) + APPROVAL_TTL_SECONDS;
  const nonce = await publicClient.readContract({ address: token.address, abi: noncesAbi, functionName: 'nonces', args: [account.address] });
  await assertChain(publicClient, network);
  const signature = await account.signTypedData({
    domain: tokenDomain(network.chainId, token),
    types: eip2612Types,
    primaryType: 'Permit',
    message: { owner: account.address, spender: permit2, value, nonce, deadline },
  });
  return encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], [value, deadline, signature]);
}

// The graphpay-order payload for one requirement (already checked by the caller's guards).
export async function signOrderPayment({ account, publicClient, network, requirement, payerName, mandateHash, approvalMicro, nowSec }) {
  const order = fromWireOrder(requirement.extra.order);
  const amount = BigInt(requirement.amount);
  const checkout = getAddress(requirement.extra.contract);
  const permit = { token: getAddress(requirement.asset), amount, nonce: BigInt(order.orderId), deadline: order.deadline };
  const approvalPermit = await approvalPermitFor({ account, publicClient, network, amount, approvalMicro, nowSec });
  await assertChain(publicClient, network);
  const signature = await account.signTypedData({
    domain: permit2Domain(network.chainId, network.permit2),
    types: permitWitnessTypes,
    primaryType: 'PermitWitnessTransferFrom',
    message: {
      permitted: { token: permit.token, amount },
      spender: checkout,
      nonce: permit.nonce,
      deadline: permit.deadline,
      witness: { ...order, mandateHash },
    },
  });
  return {
    order: requirement.extra.order,
    mandateHash,
    payerName,
    payer: account.address,
    permit: { token: permit.token, amount: String(amount), nonce: String(permit.nonce), deadline: String(permit.deadline) },
    signature,
    approvalPermit,
  };
}

// A subscription: the Permit2 allowance (PermitSingle) for up to `maxCycles` charges and the
// subscriber's signed terms (Subscribe binds payee, amount and period; PermitSingle binds none).
export async function signSubscription({ account, publicClient, network, sub, maxCycles, approvalMicro, nowSec }) {
  const { token, permit2, checkout } = network;
  const [, , nonce] = await publicClient.readContract({ address: permit2, abi: permit2Abi, functionName: 'allowance', args: [account.address, token.address, checkout] });
  const cycles = BigInt(maxCycles);
  const amount = sub.amountMicro * cycles;
  const expiration = Number(sub.firstChargeAt + BigInt(sub.period) * (cycles + 1n));
  const permitSingle = {
    details: { token: token.address, amount, expiration, nonce: Number(nonce) },
    spender: checkout,
    sigDeadline: BigInt(nowSec) + 600n,
  };
  const approvalPermit = await approvalPermitFor({ account, publicClient, network, amount, approvalMicro, nowSec });
  await assertChain(publicClient, network);
  const permitSig = await account.signTypedData({ domain: permit2Domain(network.chainId, permit2), types: permitSingleTypes, primaryType: 'PermitSingle', message: permitSingle });
  const subSig = await account.signTypedData({
    domain: checkoutDomain(network.chainId, checkout),
    types: subscribeTypes,
    primaryType: 'Subscribe',
    message: {
      subId: sub.subId,
      subscriberNode: sub.subscriberNode,
      shopNode: sub.shopNode,
      payerNode: sub.payerNode,
      merchant: sub.merchant,
      amountMicro: sub.amountMicro,
      period: sub.period,
      firstChargeAt: sub.firstChargeAt,
      permitHash: permitHash(permitSingle),
    },
  });
  return { permitSingle, permitSig, subSig, approvalPermit };
}

export async function signCancel({ account, publicClient, network, subId, nowSec, ttlSeconds = 600 }) {
  const deadline = BigInt(nowSec) + BigInt(ttlSeconds);
  await assertChain(publicClient, network);
  const signature = await account.signTypedData({
    domain: checkoutDomain(network.chainId, network.checkout),
    types: cancelTypes,
    primaryType: 'Cancel',
    message: { subId, deadline },
  });
  return { subId, deadline, signature };
}

// A refund request, signed by the order's payer so the merchant knows it is theirs. Off-chain
// only: the merchant decides and refunds on-chain itself.
export const refundRequestTypes = Object.freeze({
  RefundRequest: [
    { name: 'orderId', type: 'bytes32' },
    { name: 'amountMicro', type: 'uint64' },
    { name: 'reason', type: 'string' },
    { name: 'deadline', type: 'uint64' },
  ],
});

export const refundRequestDomain = (network) => ({ name: 'AgentPay Refund Request', version: '1', chainId: network.chainId, verifyingContract: network.checkout });

export async function signRefundRequest({ account, publicClient, network, orderId, amountMicro, reason, nowSec, ttlSeconds = 600 }) {
  const message = { orderId, amountMicro: BigInt(amountMicro), reason, deadline: BigInt(nowSec) + BigInt(ttlSeconds) };
  await assertChain(publicClient, network);
  const signature = await account.signTypedData({ domain: refundRequestDomain(network), types: refundRequestTypes, primaryType: 'RefundRequest', message });
  return {
    request: { orderId, amountMicro: message.amountMicro.toString(), reason, deadline: message.deadline.toString(), payer: account.address },
    signature,
  };
}
