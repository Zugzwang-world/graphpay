import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeCast, castEntries, config, story } from '@graphpay/config';
import { acceptsForAgents, createReadHooks, personaBox } from '../src/hooks.mjs';

test('accepts entries become the payer\'s CAIP-2 network and token', () => {
  const token = config.whitechain.tokens.usdt.address;
  assert.deepEqual(acceptsForAgents([{ chainId: 1874, token }]), [{ network: 'eip155:1874', asset: token }]);
});

test('the search box is around the persona\'s configured point', () => {
  const box = personaBox();
  const lat = Math.round(story.locations.persona.lat * 1e6);
  const lng = Math.round(story.locations.persona.lng * 1e6);
  assert.ok(box.latMin < lat && lat < box.latMax && box.lngMin < lng && lng < box.lngMax);
});

test('payer wallets come by wallet role, for the paying agents and the numbered disposables only', async () => {
  const cast = activeCast();
  const payer = castEntries(cast).find((e) => e.pays);
  const wallets = { [payer.walletRole]: `0x${'12'.repeat(20)}`, [`${cast.disposable.walletRolePrefix}1`]: `0x${'34'.repeat(20)}` };
  const hooks = createReadHooks({ ens: {}, arkiv: { publicClient: {} }, wallets });
  assert.equal(await hooks.payerWallet(payer.key), wallets[payer.walletRole]);
  assert.equal(await hooks.payerWallet(`${cast.disposable.labelPrefix}1`), wallets[`${cast.disposable.walletRolePrefix}1`]);
  await assert.rejects(hooks.payerWallet(cast.persona.key), /no wallet address/);
  await assert.rejects(hooks.payerWallet(`${cast.disposable.labelPrefix}2`), /no wallet address/);
});
