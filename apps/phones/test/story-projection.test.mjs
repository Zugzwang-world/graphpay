import assert from 'node:assert/strict';
import { test } from 'node:test';
import { castEntries, config, story } from '../../../packages/config/index.mjs';
import { projectStory } from '../story-projection.mjs';

test('the projection carries the story cast in the phones shape', () => {
  const p = projectStory(story);
  const ens = (kind, key) => castEntries(story, config.root.ens).find((e) => e.kind === kind && e.key === key).ensName;
  assert.equal(p.customer.name, story.persona.displayName);
  assert.equal(p.customer.ens, ens('persona', story.persona.key));
  assert.equal(p.agents.length, story.buyerAgents.length);
  assert.equal(p.agents.filter((a) => a.main).length, 1);
  const payer = p.agents.find((a) => a.role === p.spendingPass.payingRole);
  assert.ok(payer?.pays);
  assert.equal(payer.ens, ens('buyer-agent', 'payer'));
  assert.equal(p.shop.ens, ens('shop', story.order.shop));
  assert.equal(p.shops.length, story.shops.length);
  assert.equal(p.quickPrompts[0].text, story.order.request);
  assert.ok(p.products.every((x) => /^\d+\.\d{2}$/.test(x.priceUsdt) && x.priceMicro && x.quantity > 0));
  assert.match(p.explorers.whitechain, /^https:\/\//);
});

test('optional images and avatars pass through and stay null when unset', () => {
  const withArt = structuredClone(story);
  withArt.persona.avatar = '/art/persona.png';
  withArt.shops[0].products[0].image = '/art/product.png';
  const p = projectStory(withArt);
  assert.equal(p.customer.avatar, '/art/persona.png');
  assert.equal(p.products[0].image, '/art/product.png');
  assert.equal(projectStory(story).agents[0].avatar, story.buyerAgents[0].avatar ?? null);
});
