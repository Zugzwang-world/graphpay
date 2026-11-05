// The facilitator's and the shop's settings from the environment (planning/SPEC/PAYMENTS_WHITECHAIN.md
// §9), checked against @graphpay/config (ADR-0030): addresses, the token and its EIP-712 domain come
// from the config file; an env value that repeats one must equal it, or the service refuses to start.
// Only names and checked values come back: secrets stay in env and are never part of a message.

import { getAddress, isAddress, parseEther } from 'viem';
import { config, story } from '@graphpay/config';
import { DEFAULT_LIMITS } from './pipeline.mjs';
import { StartupError } from './startup.mjs';

const MIN_SECRET = 24;

function same(env, name, expected, { caseless = false } = {}) {
  const v = env[name];
  if (v === undefined || v === '') return;
  const a = caseless ? v.toLowerCase() : v;
  const b = caseless ? String(expected).toLowerCase() : String(expected);
  if (a !== b) throw new StartupError(`${name} differs from the config file`);
}

function int(env, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const v = env[name];
  if (v === undefined || v === '') return fallback;
  if (!/^[0-9]+$/.test(v) || Number(v) < min || Number(v) > max) throw new StartupError(`${name} is not a whole number between ${min} and ${max}`);
  return Number(v);
}

function wbt(env, name, fallbackWei) {
  const v = env[name];
  if (v === undefined || v === '') return fallbackWei;
  if (!/^[0-9]+(\.[0-9]{1,18})?$/.test(v)) throw new StartupError(`${name} is not an amount of WBT`);
  return parseEther(v);
}

function secret(env, name) {
  const v = env[name] ?? '';
  if (v.length < MIN_SECRET) throw new StartupError(`${name} is missing or shorter than ${MIN_SECRET} characters`);
  return v;
}

const addressList = (name, value) => {
  let list;
  try {
    list = value.trim().startsWith('[') ? JSON.parse(value) : value.split(',');
  } catch {
    throw new StartupError(`${name} is not a JSON array or a comma-separated list`);
  }
  if (!Array.isArray(list) || list.length === 0) throw new StartupError(`${name} is empty`);
  return list.map((a) => {
    const t = String(a).trim();
    if (!isAddress(t, { strict: false }) || BigInt(t) === 0n) throw new StartupError(`${name} holds something that is not an address`);
    return getAddress(t);
  });
};

// The story shops' merchant wallets from the config's public role addresses (`wallets.addresses`,
// role -> address), when the config has them: shop key -> address, or null. Until then the env
// values are the source (M4's env script derives them from the role keys) and the shop's payee
// must still equal its ENS address (M5 amendment §2).
export function configMerchants(cfg = config, source = story) {
  const roles = cfg.wallets?.addresses;
  if (!roles) return null;
  const out = {};
  for (const shop of source.shops) {
    const address = roles[shop.walletRole];
    if (!address || !isAddress(address, { strict: false })) throw new StartupError(`the config has no address for ${shop.walletRole}`);
    out[shop.key] = getAddress(address);
  }
  return out;
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.some((y) => y.toLowerCase() === x.toLowerCase()));

// The checkout, the token and Permit2 from the config; repeated env values checked.
export function chainSettings(env = process.env) {
  const wc = config.networks.whitechain;
  const checkout = config.whitechain.contracts.checkout;
  const token = config.whitechain.tokens[checkout.token];
  if (!checkout?.address || !token?.address) throw new StartupError('the config has no checkout or token');
  same(env, 'GRAPHPAY_CONTRACT', checkout.address, { caseless: true });
  same(env, 'GRAPHPAY_TOKEN', token.address, { caseless: true });
  same(env, 'GRAPHPAY_TOKEN_NAME', token.eip712.name);
  same(env, 'GRAPHPAY_TOKEN_VERSION', token.eip712.version);
  same(env, 'GRAPHPAY_ROOT_ENS', config.root.ens);
  if (env.ENS_ALLOWED_ROOTS) {
    const roots = env.ENS_ALLOWED_ROOTS.split(',').map((r) => r.trim());
    if (roots.length !== 1 || roots[0] !== config.root.ens) throw new StartupError('ENS_ALLOWED_ROOTS differs from the config file');
  }
  return {
    chainId: wc.chainId,
    checkout: getAddress(checkout.address),
    token: { address: getAddress(token.address), eip712: { name: token.eip712.name, version: token.eip712.version }, decimals: token.decimals, symbol: token.symbol },
    permit2: getAddress(config.whitechain.system.permit2),
    sepoliaChainId: config.networks.sepolia.chainId,
    rootEns: config.root.ens,
  };
}

// facilitator: limits, the merchant allow-list, the bearer token and the recorder route.
export function facilitatorSettings(env = process.env, { cfg = config } = {}) {
  const fromConfig = configMerchants(cfg);
  const listed = env.ALLOWED_MERCHANTS ? addressList('ALLOWED_MERCHANTS', env.ALLOWED_MERCHANTS) : null;
  if (fromConfig && listed && !sameSet(listed, Object.values(fromConfig))) throw new StartupError('ALLOWED_MERCHANTS differs from the config file');
  const merchants = listed ?? (fromConfig ? Object.values(fromConfig) : null);
  if (!merchants) throw new StartupError('ALLOWED_MERCHANTS is not set');
  const attemptsUrl = env.ATTEMPTS_URL ?? '';
  if (attemptsUrl !== '' && !/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(attemptsUrl)) throw new StartupError('ATTEMPTS_URL must be https (or a loopback URL)');
  return {
    ...chainSettings(env),
    allowedMerchants: merchants,
    authToken: secret(env, 'FACILITATOR_AUTH_TOKEN'),
    recorder: attemptsUrl ? { url: attemptsUrl, token: secret(env, 'RECORDER_TOKEN') } : null,
    limits: {
      maxSettleGas: BigInt(int(env, 'MAX_SETTLE_GAS', Number(DEFAULT_LIMITS.maxSettleGas), { min: 400_000, max: 2_000_000 })),
      gasBudgetDailyWei: wbt(env, 'GAS_BUDGET_DAILY_WBT', DEFAULT_LIMITS.gasBudgetDailyWei),
      minRelayerBalanceWei: wbt(env, 'MIN_RELAYER_BALANCE_WBT', DEFAULT_LIMITS.minRelayerBalanceWei),
      recordedFailuresPerDay: int(env, 'RECORDED_FAILURES_PER_DAY', DEFAULT_LIMITS.recordedFailuresPerDay, { max: 1000 }),
      receiptTimeoutMs: int(env, 'RECEIPT_TIMEOUT_MS', DEFAULT_LIMITS.receiptTimeoutMs, { min: 1_000, max: 120_000 }),
      gateTtlMs: int(env, 'ENS_GATE_TTL_MS', DEFAULT_LIMITS.gateTtlMs, { min: 1_000, max: 60_000 }),
    },
  };
}

// shop: label -> payout address for the story shops, the facilitator's URL and bearer, the passcode.
export function shopSettings(env = process.env, { shopKeys, cfg = config }) {
  const fromConfig = configMerchants(cfg);
  let merchants;
  try {
    merchants = env.SHOP_MERCHANTS === undefined && fromConfig ? fromConfig : JSON.parse(env.SHOP_MERCHANTS ?? '');
  } catch {
    throw new StartupError('SHOP_MERCHANTS is not a JSON object');
  }
  if (!merchants || typeof merchants !== 'object' || Array.isArray(merchants)) throw new StartupError('SHOP_MERCHANTS is not a JSON object');
  const out = {};
  for (const [key, address] of Object.entries(merchants)) {
    if (!shopKeys.includes(key)) throw new StartupError('SHOP_MERCHANTS names a shop that is not in the story');
    out[key] = addressList('SHOP_MERCHANTS', String(address))[0];
    if (fromConfig && fromConfig[key]?.toLowerCase() !== out[key].toLowerCase()) throw new StartupError('SHOP_MERCHANTS differs from the config file');
  }
  const url = env.FACILITATOR_URL ?? '';
  if (!/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) throw new StartupError('FACILITATOR_URL must be https (or a loopback URL)');
  return {
    ...chainSettings(env),
    merchants: out,
    facilitatorUrl: url.replace(/\/+$/, ''),
    facilitatorToken: secret(env, 'FACILITATOR_AUTH_TOKEN'),
    passcode: env.DEMO_PASSCODE ?? '', // the handler turns spending off when it is short
  };
}
