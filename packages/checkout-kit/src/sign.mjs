// What a buyer signs, in a form that runs in a browser (viem only; no Node modules). The
// EIP-712 shapes are the ones in planning/SPEC/PAYMENTS_WHITECHAIN.md §4 and
// @graphpay/contracts; a test holds this copy equal to that package's definitions, so the
// two can never drift. One signature pays the order (Permit2 witness: payee, amount, deadline
// and order id are inside it) and, the first time, a bounded gasless EIP-2612 approval.
import { encodeAbiParameters, erc20Abi, getAddress, keccak256, parseAbi, stringToBytes } from 'viem';

export const ZERO32 = `0x${'0'.repeat(64)}`;
export const DEFAULT_APPROVAL_MICRO = 50_000_000n; // bounded, never unlimited
const APPROVAL_TTL_SECONDS = 3600n;

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

export const eip2612Types = Object.freeze({
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
});

// Permit2's domain has no version.
export const permit2Domain = (chainId, permit2) => ({ name: 'Permit2', chainId, verifyingContract: permit2 });
export const tokenDomain = (chainId, token) => ({ name: token.eip712.name, version: token.eip712.version, chainId, verifyingContract: token.address });

const noncesAbi = parseAbi(['function nonces(address owner) view returns (uint256)']);

// Testnets only (CLAUDE.md): the one chain this kit signs on, held here as a second line of
// defence in case the network the app passes in is wrong. Whitechain Sepolia.
export const SIGNING_CHAIN_IDS = Object.freeze([1874]);

// eth_chainId before every signing step: refuse any other chain.
export async function assertChain(publicClient, network) {
  if (!SIGNING_CHAIN_IDS.includes(network.chainId)) throw new Error(`chain ${network.chainId} is not a testnet this kit signs on; nothing was signed`);
  const id = await publicClient.getChainId();
  if (id !== network.chainId) throw new Error(`the wallet is on chain ${id}, not ${network.chainId}; nothing was signed`);
}

// The intent a person signs for: the exact quote they were shown, as a hash.
export function intentHash({ shopName, summary, amountMicro, deadline }) {
  return keccak256(stringToBytes(`graphpay-checkout/v1|${shopName}|${summary}|${amountMicro}|${deadline}`));
}

// The EIP-2612 approval of Permit2 as the contract's approvalPermit bytes, or '0x' when the
// payer's allowance already covers the amount. `account` is { address, signTypedData }.
export async function approvalPermitFor({ account, publicClient, network, amount, approvalMicro = DEFAULT_APPROVAL_MICRO, nowSec }) {
  const { token, permit2 } = network;
  const allowance = await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'allowance', args: [account.address, permit2] });
  if (allowance >= amount) return '0x';
  const value = amount > approvalMicro ? amount : approvalMicro;
  const deadline = BigInt(nowSec) + APPROVAL_TTL_SECONDS;
  const nonce = await publicClient.readContract({ address: token.address, abi: noncesAbi, functionName: 'nonces', args: [account.address] });
  await assertChain(publicClient, network);
  const signature = await account.signTypedData({ domain: tokenDomain(network.chainId, token), types: eip2612Types, primaryType: 'Permit', message: { owner: account.address, spender: permit2, value, nonce, deadline } });
  return encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], [value, deadline, signature]);
}

const lowerOrder = (w) => ({
  orderId: w.orderId.toLowerCase(),
  parentOrderId: w.parentOrderId.toLowerCase(),
  buyerNode: w.buyerNode.toLowerCase(),
  shopNode: w.shopNode.toLowerCase(),
  payerNode: w.payerNode.toLowerCase(),
  merchant: getAddress(w.merchant),
  amountMicro: BigInt(w.amountMicro),
  deadline: BigInt(w.deadline),
  kind: Number(w.kind),
});

// The graphpay-order payload for one (already checked) requirement, for a person: no name,
// the intent hash as the mandate.
export async function signOrderPayment({ account, publicClient, network, requirement, mandateHash, approvalMicro, nowSec }) {
  const order = lowerOrder(requirement.extra.order);
  const amount = BigInt(requirement.amount);
  const checkout = getAddress(requirement.extra.contract);
  const permit = { token: getAddress(requirement.asset), amount, nonce: BigInt(order.orderId), deadline: order.deadline };
  const approvalPermit = await approvalPermitFor({ account, publicClient, network, amount, approvalMicro, nowSec });
  await assertChain(publicClient, network);
  const signature = await account.signTypedData({
    domain: permit2Domain(network.chainId, network.permit2),
    types: permitWitnessTypes,
    primaryType: 'PermitWitnessTransferFrom',
    message: { permitted: { token: permit.token, amount }, spender: checkout, nonce: permit.nonce, deadline: permit.deadline, witness: { ...order, mandateHash } },
  });
  return {
    order: requirement.extra.order,
    mandateHash,
    payerName: '',
    payer: account.address,
    permit: { token: permit.token, amount: String(amount), nonce: String(permit.nonce), deadline: String(permit.deadline) },
    signature,
    approvalPermit,
  };
}
