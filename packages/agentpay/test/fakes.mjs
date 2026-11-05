// An in-memory stand-in for the few chain reads the SDK makes, for offline unit tests.

import { config } from '@graphpay/config';

export const MAX_U64 = (1n << 64n) - 1n;
const ZERO = `0x${'0'.repeat(40)}`;
const ZERO32 = `0x${'0'.repeat(64)}`;

export function fakeChain({ chainId = config.networks.whitechain.chainId } = {}) {
  const state = {
    chainId,
    policies: new Map(),
    bound: new Map(),
    spent: new Map(),
    orders: new Map(),
    allowance: 10n ** 12n,
    balance: 10n ** 12n,
    reads: [],
  };
  const publicClient = {
    getChainId: async () => state.chainId,
    getBalance: async () => 10n ** 18n,
    async readContract({ functionName, args }) {
      state.reads.push(functionName);
      switch (functionName) {
        case 'policies':
          return state.policies.get(args[0]) ?? { epoch: 0, wallet: ZERO, revoked: false, dailyCapMicro: 0n, expiry: 0n };
        case 'spentToday':
          return state.spent.get(args[0]) ?? 0n;
        case 'spentMicro':
          return state.spent.get(args[0]) ?? 0n;
        case 'nodeOfWallet':
          return state.bound.get(args[0].toLowerCase()) ?? ZERO32;
        case 'orders':
          return state.orders.get(args[0]) ?? { termsHash: ZERO32, buyerNode: ZERO32, shopNode: ZERO32, merchant: ZERO, amountMicro: 0n, kind: 0, status: 0, dispute: 0, disputeReason: 0, payer: ZERO, refundedMicro: 0n };
        case 'allowance':
          return state.allowance;
        case 'balanceOf':
          return state.balance;
        case 'nonces':
          return 0n;
        case 'nonceBitmap':
          return 0n;
        case 'termsHash':
          return ZERO32;
        default:
          throw new Error(`fake chain: no ${functionName}`);
      }
    },
    async multicall({ contracts }) {
      return Promise.all(contracts.map((c) => publicClient.readContract(c)));
    },
  };
  return { state, publicClient };
}

// A pass for `node` bound to `wallet`.
export function givePass(state, { node, wallet, dailyCapMicro, spent = 0n, revoked = false, expiry = 0n }) {
  state.policies.set(node, { epoch: 0, wallet, revoked, dailyCapMicro, expiry });
  state.bound.set(wallet.toLowerCase(), node);
  state.spent.set(node, spent);
}

// A facilitator that records calls and settles everything it is asked to.
export function fakeFacilitator({ valid = true, success = true } = {}) {
  const calls = [];
  return {
    calls,
    async verify(p, r) {
      calls.push(['verify', p, r]);
      return valid ? { isValid: true, payer: p.payload.payer } : { isValid: false, invalidReason: 'bad_signature' };
    },
    async settle(p, r) {
      calls.push(['settle', p, r]);
      return success ? { success: true, payer: p.payload.payer, transaction: `0x${'ab'.repeat(32)}`, network: r.network } : { success: false, errorReason: 'SPEND_CAP', transaction: `0x${'cd'.repeat(32)}`, network: r.network };
    },
  };
}
