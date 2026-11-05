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

test('API cost comes from the configured prices', () => {
  const model = Object.keys(config.models.pricingUsdPerMTok)[0];
  const price = config.models.pricingUsdPerMTok[model];
  assert.equal(apiCostUsd(model, { input_tokens: 1e6, output_tokens: 1e6 }), price.input + price.output);
  assert.throws(() => apiCostUsd('not-a-model', {}), /no price/);
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
