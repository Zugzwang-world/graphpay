import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { activeCast, agentPreset, apiCostUsd, castEntries, config, disposableEntry, resolveRpc, rpcCandidates, story } from '../index.mjs';

const pack = (file) => readFileSync(new URL(`../../../planning/${file}`, import.meta.url), 'utf8');

test('carried-over and lab wallet addresses match planning/WALLETS.md', () => {
  const wallets = pack('WALLETS.md');
  const section5 = wallets.slice(wallets.indexOf('## 5.'));
  for (const [role, address] of Object.entries(config.wallets.carried)) {
    assert.ok(wallets.includes(`| ${role} | \`${address}\``), role);
  }
  assert.equal(config.wallets.labNotUsed.length, 12);
  for (const address of config.wallets.labNotUsed) assert.ok(section5.includes(address), address);
});

test('chain ids and the test USDT match planning/FACTS.md', () => {
  const facts = pack('FACTS.md');
  for (const net of Object.values(config.networks)) assert.ok(facts.includes(`**${net.chainId}**`), net.name);
  assert.ok(facts.includes(config.whitechain.tokens.usdt.address));
  assert.equal(config.networks.whitechain.ensCoinType, (0x80000000 | 1874) >>> 0);
  for (const address of Object.values(config.ens.contracts)) assert.ok(facts.toLowerCase().includes(address.toLowerCase()), address);
});

test('the story cast is complete and unique, one wallet per paying agent, owners never bound', () => {
  const cast = activeCast();
  const entries = castEntries(cast);
  const agents = entries.filter((e) => e.kind.endsWith('agent'));
  assert.equal(entries.filter((e) => e.kind === 'persona' || e.kind === 'shop').length, 1 + cast.shops.length);
  assert.equal(agents.length, cast.buyerAgents.length + cast.workingAgents.length + cast.shops.length * cast.shopAgents.length);
  assert.equal(new Set(entries.map((e) => e.ensName)).size, entries.length);
  for (const e of entries) assert.ok(e.ensName.endsWith(`.${config.root.ens}`), e.ensName);
  const roles = new Set(config.wallets.fresh.map((w) => w.role));
  for (const e of entries) assert.ok(roles.has(e.walletRole), `${e.key} → ${e.walletRole}`);
  const payers = agents.filter((a) => a.pays);
  assert.equal(new Set(payers.map((a) => a.walletRole)).size, payers.length, 'one wallet per paying agent');
  assert.ok(!payers.some((a) => a.walletRole === cast.persona.walletRole), 'owner wallets are never bound');
  assert.equal(disposableEntry(1, cast).ensName, `${cast.disposable.labelPrefix}1.${cast.persona.label}.${config.root.ens}`);
});

test('the story names its order, renewal, city sizes and demo steps, and holds no address', () => {
  const shopKeys = new Set(story.shops.map((s) => s.key));
  assert.ok(shopKeys.has(story.order.shop) && shopKeys.has(story.renewal.shop));
  const sku = story.shops.find((s) => s.key === story.order.shop).products.find((p) => p.sku === story.order.sku);
  assert.equal(sku.priceMicro, story.order.priceMicro);
  assert.ok(story.order.priceMicro <= story.order.budgetMicro);
  assert.deepEqual(Object.keys(story.syntheticCity.sizes).sort(), ['M', 'S']);
  assert.ok(story.demoScript.length > 0 && story.demoScript.every((s, i) => s.step === i + 1));
  assert.ok(!/0x[0-9a-fA-F]{40}/.test(JSON.stringify(story)), 'addresses belong in graphpay.config.json');
  assert.ok(!('cast' in config), 'the cast lives in story.json only');
});

test('every agent preset covers every agent role with a priced model and a valid effort', () => {
  const roles = [...story.buyerAgents.map((a) => a.key), ...story.shopAgents.map((a) => a.key)];
  assert.ok(story.agentModels.presets[story.agentModels.active], 'the active preset exists');
  for (const [name, preset] of Object.entries(story.agentModels.presets)) {
    for (const role of roles) {
      const settings = preset.roles[role];
      assert.ok(settings, `${name}/${role}`);
      assert.ok(config.models.pricingUsdPerMTok[settings.model], `${name}/${role}: ${settings.model} has a price`);
      assert.ok(config.models.effortLevels.includes(settings.effort), `${name}/${role}: effort`);
      assert.ok(settings.maxTokens >= 16000, `${name}/${role}: room for xhigh thinking`);
    }
  }
  assert.equal(agentPreset('payer', { env: {} }).preset, story.agentModels.active);
  assert.equal(agentPreset('payer', { env: { AGENT_PRESET: 'live' } }).preset, 'live');
  assert.throws(() => agentPreset('payer', { env: { AGENT_PRESET: 'nope' } }), /not in the story config/);
});

test('presets, roles and prices are looked up as own keys only', () => {
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.throws(() => agentPreset('payer', { env: { AGENT_PRESET: name } }), /not in the story config/, name);
    assert.throws(() => agentPreset(name, { env: {} }), /has no settings for role/, name);
    assert.throws(() => apiCostUsd(name, { input_tokens: 1 }), /no price/, name);
  }
});

const PRICES = config.models.pricingUsdPerMTok;
const near = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 1e-12, `${what}: ${actual} is not ${expected}`);
const cards = () =>
  Object.entries(PRICES).flatMap(([model, card]) => [[model, card], ...(card.longPrompt ? [[`${model} longPrompt`, card.longPrompt]] : [])]);

test('every price card is complete: cache writes 1.25x input for 5 minutes and 2x for 1 hour', () => {
  for (const [what, card] of cards()) {
    for (const key of ['input', 'output', 'cacheWrite5m', 'cacheWrite1h', 'cacheRead']) {
      assert.ok(Number.isFinite(card[key]) && card[key] > 0, `${what}: ${key}`);
    }
    near(card.cacheWrite5m, card.input * 1.25, `${what} cacheWrite5m`);
    near(card.cacheWrite1h, card.input * 2, `${what} cacheWrite1h`);
  }
  assert.ok(Object.values(PRICES).some((card) => card.longPrompt), 'a long-prompt card is configured');
  for (const card of Object.values(PRICES)) {
    if (card.longPrompt) assert.ok(Number.isInteger(card.longPrompt.aboveInputTokens) && card.longPrompt.aboveInputTokens > 0);
  }
  assert.match(config.models.apiBaseUrl, /^https:\/\/[^/]+$/);
});

test('API cost: every token kind at its configured price', () => {
  assert.throws(() => apiCostUsd('not-a-model', {}), /no price/);
  for (const [model, card] of Object.entries(PRICES)) {
    near(apiCostUsd(model, { input_tokens: 1e4, output_tokens: 2e4 }), (1e4 * card.input + 2e4 * card.output) / 1e6, `${model} in+out`);
    near(apiCostUsd(model, { cache_read_input_tokens: 3e4 }), (3e4 * card.cacheRead) / 1e6, `${model} read`);
    assert.equal(apiCostUsd(model, {}), 0);
    assert.equal(apiCostUsd(model, null), 0);
  }
});

test('API cost: 1-hour cache writes at cacheWrite1h from usage.cache_creation, other writes at the 5-minute rate', () => {
  for (const [model, card] of Object.entries(PRICES)) {
    const both = { cache_creation_input_tokens: 3e4, cache_creation: { ephemeral_5m_input_tokens: 1e4, ephemeral_1h_input_tokens: 2e4 } };
    near(apiCostUsd(model, both), (1e4 * card.cacheWrite5m + 2e4 * card.cacheWrite1h) / 1e6, `${model} by TTL`);
    // No breakdown (or a null one): every write is a 5-minute write.
    near(apiCostUsd(model, { cache_creation_input_tokens: 3e4 }), (3e4 * card.cacheWrite5m) / 1e6, `${model} no breakdown`);
    near(apiCostUsd(model, { cache_creation_input_tokens: 3e4, cache_creation: null }), (3e4 * card.cacheWrite5m) / 1e6, `${model} null breakdown`);
    // Only the 1-hour part broken down: the rest of the total is 5-minute.
    const partial = { cache_creation_input_tokens: 3e4, cache_creation: { ephemeral_1h_input_tokens: 1e4 } };
    near(apiCostUsd(model, partial), (2e4 * card.cacheWrite5m + 1e4 * card.cacheWrite1h) / 1e6, `${model} partial`);
    // A breakdown without the total still counts.
    near(apiCostUsd(model, { cache_creation: { ephemeral_1h_input_tokens: 1e4 } }), (1e4 * card.cacheWrite1h) / 1e6, `${model} no total`);
  }
});

test('API cost: a prompt over the long-prompt threshold (cache reads and writes count) prices every token on the long card', () => {
  for (const [model, card] of Object.entries(PRICES)) {
    if (!card.longPrompt) continue;
    const { aboveInputTokens: limit, ...long } = card.longPrompt;
    const cost = (c, u) => (u.input * c.input + u.read * c.cacheRead + u.write5m * c.cacheWrite5m + u.write1h * c.cacheWrite1h + u.output * c.output) / 1e6;
    const usage = (u) => ({
      input_tokens: u.input,
      output_tokens: u.output,
      cache_read_input_tokens: u.read,
      cache_creation_input_tokens: u.write5m + u.write1h,
      cache_creation: { ephemeral_5m_input_tokens: u.write5m, ephemeral_1h_input_tokens: u.write1h },
    });
    const atLimit = { input: limit - 3000, read: 1000, write5m: 1000, write1h: 1000, output: 5000 };
    near(apiCostUsd(model, usage(atLimit)), cost(card, atLimit), `${model} at the threshold`);
    for (const over of [{ ...atLimit, input: atLimit.input + 1 }, { ...atLimit, read: atLimit.read + 1 }, { ...atLimit, write1h: atLimit.write1h + 1 }]) {
      near(apiCostUsd(model, usage(over)), cost(long, over), `${model} one token over`);
    }
    // The fallback total counts toward the threshold too.
    near(apiCostUsd(model, { input_tokens: 1, cache_creation_input_tokens: limit }), (long.input + limit * long.cacheWrite5m) / 1e6, `${model} write total`);
  }
});

test('RPC candidates: the secret URL first, then public Ankr, then Whitechain public', () => {
  const list = rpcCandidates('whitechain', { WHITECHAIN_RPC_URL: 'https://keyed.example/x' });
  assert.deepEqual(list.map((c) => c.label), ['WHITECHAIN_RPC_URL (secret)', 'public Ankr', 'Whitechain public']);
  assert.deepEqual(rpcCandidates('whitechain', {}).map((c) => c.secret), [false, false]);
});

function fakeFetch(answers) {
  return async (url) => {
    const answer = answers[url];
    if (answer === undefined) throw new Error(`unreachable ${url}`);
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result: answer }) };
  };
}

test('resolveRpc refuses any chain but 1874 and never names a secret URL', async () => {
  const secret = 'https://keyed.example/very-secret-path';
  const [ankr, wc] = config.networks.whitechain.publicRpcs.map((p) => p.url);
  const wrongThenRight = await resolveRpc('whitechain', {
    env: { WHITECHAIN_RPC_URL: secret },
    fetchImpl: fakeFetch({ [secret]: '0x1', [ankr]: '0x752' }),
  });
  assert.equal(wrongThenRight.label, 'public Ankr');
  assert.deepEqual(wrongThenRight.refused, ['WHITECHAIN_RPC_URL (secret): refused, chain 1 is not 1874']);
  await assert.rejects(
    resolveRpc('whitechain', { env: { WHITECHAIN_RPC_URL: secret }, fetchImpl: fakeFetch({ [secret]: '0x1', [wc]: '0xaa36a7' }) }),
    (error) => !error.message.includes(secret) && /no RPC answered with chain id 1874/.test(error.message),
  );
});

test('a resolved RPC never shows its URL when logged, and a plain-http secret URL is refused', async () => {
  const [ankr] = config.networks.whitechain.publicRpcs.map((p) => p.url);
  const rpc = await resolveRpc('whitechain', {
    env: { WHITECHAIN_RPC_URL: 'http://keyed.example/abc' },
    fetchImpl: fakeFetch({ [ankr]: '0x752' }),
  });
  assert.equal(rpc.label, 'public Ankr');
  assert.deepEqual(rpc.refused, ['WHITECHAIN_RPC_URL (secret): refused, not an https URL']);
  assert.equal(rpc.url, ankr);
  assert.ok(!JSON.stringify(rpc).includes(ankr) && !JSON.stringify(rpc).includes('keyed.example'));
});
