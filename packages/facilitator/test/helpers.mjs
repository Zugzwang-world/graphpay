// Offline fixtures: real signatures from throw-away keys, a fake chain the tests steer, and a
// requirement shaped like the shop's. Nothing here touches a network.

import { encodeAbiParameters, keccak256, namehash, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { graphPayOrderClient } from '../src/client.mjs';
import { createGraphPayFacilitator, termsHashOf } from '../src/pipeline.mjs';
import { toWireOrder } from '../src/wire.mjs';

export const CHAIN_ID = 1874;
const addr = (label) => `0x${keccak256(toHex(label)).slice(-40)}`;
export const TOKEN = { address: addr('test token'), eip712: { name: 'Test Token', version: '1' } };
export const PERMIT2 = addr('test permit2');
export const CHECKOUT = addr('test checkout');
export const MERCHANT = addr('test merchant');
export const AGENT_NAME = 'agent.example.graphpay.eth';
export const AGENT_NODE = namehash(AGENT_NAME);
export const SHOP_NODE = namehash('shop.graphpay.eth');
export const ZERO32 = `0x${'0'.repeat(64)}`;
export const T0 = 1_800_000_000_000; // ms

export const newAccount = () => privateKeyToAccount(generatePrivateKey());

export function makeOrder({ payerNode = AGENT_NODE, amountMicro = 4_800_000n, salt = 1 } = {}) {
  return {
    orderId: `0x${(BigInt(keccak256(toHex(`order ${salt}`))) >> 1n).toString(16).padStart(64, '0')}`,
    parentOrderId: ZERO32,
    buyerNode: namehash('buyer.graphpay.eth'),
    shopNode: SHOP_NODE,
    payerNode,
    merchant: MERCHANT,
    amountMicro,
    deadline: BigInt(T0 / 1000 + 600),
    kind: 0,
  };
}

export function requirementFor(order) {
  return {
    scheme: 'graphpay-order',
    network: `eip155:${CHAIN_ID}`,
    asset: TOKEN.address,
    amount: String(order.amountMicro),
    payTo: order.merchant,
    maxTimeoutSeconds: 600,
    extra: { contract: CHECKOUT, order: toWireOrder(order), shopName: 'shop.graphpay.eth', mandateRequired: true },
  };
}

// A fake Whitechain whose state each test bends; it counts sends.
export function fakeChain(account, overrides = {}) {
  const chain = {
    relayerAddress: addr('relayer'),
    sends: 0,
    state: {
      nowSec: BigInt(T0 / 1000),
      order: { status: 0, termsHash: ZERO32 },
      nonceUsed: false,
      balance: 10_000_000n,
      allowance: 0n,
      tokenNonce: 0n,
      bound: AGENT_NODE,
      policy: { wallet: account.address, revoked: false, dailyCapMicro: 6_000_000n, expiry: 0n, epoch: 0 },
      spentToday: 0n,
    },
    estimate: 330_000n,
    price: 5_000_000_001n,
    balance: 800_000_000_000_000_000n,
    receipt: { status: 'success', fee: 330_000n * 5_000_000_001n },
    outcome: { settled: true },
    code: undefined, // an EOA without a delegation
    async getCode() {
      return chain.code;
    },
    async isValidSignature() {
      return false;
    },
    async readState() {
      return structuredClone(chain.state);
    },
    async nodeOfWallet() {
      return chain.state.bound;
    },
    async estimateSettle() {
      return chain.estimate;
    },
    async gasPrice() {
      return chain.price;
    },
    async relayerBalance() {
      return chain.balance;
    },
    async sendSettle() {
      chain.sends += 1;
      return `0x${String(chain.sends).padStart(64, 'a')}`;
    },
    async waitReceipt() {
      return chain.receipt;
    },
    outcomeOf() {
      return chain.outcome;
    },
    ...overrides,
  };
  return chain;
}

export function makeFacilitator({ chain, gate, recorder, limits, clock = () => T0 } = {}) {
  return createGraphPayFacilitator({
    chainId: CHAIN_ID,
    token: TOKEN,
    permit2: PERMIT2,
    checkout: CHECKOUT,
    allowedMerchants: [MERCHANT],
    chain,
    ensGate: gate ?? (async () => ({ ok: true, node: AGENT_NODE, epoch: 0 })),
    recorder,
    limits,
    clock,
  });
}

// Signs a payment the way an agent does: witness plus, while the allowance is short, an approval.
export async function signedPayment(account, order, { payerName = AGENT_NAME, allowance = 0n, tokenNonce = 0n } = {}) {
  const publicClient = {
    getChainId: async () => CHAIN_ID,
    async readContract({ functionName }) {
      return functionName === 'allowance' ? allowance : tokenNonce;
    },
  };
  const client = graphPayOrderClient({ account, publicClient, chainId: CHAIN_ID, token: TOKEN, permit2: PERMIT2, checkout: CHECKOUT, payerName, mandateHash: keccak256(toHex('mandate')), now: () => T0 });
  const req = requirementFor(order);
  const { payload } = await client.createPaymentPayload(2, req);
  return { paymentPayload: { x402Version: 2, resource: { url: 'https://shop.example/orders/1/pay' }, accepted: req, payload }, requirement: req };
}

export { termsHashOf, encodeAbiParameters };
