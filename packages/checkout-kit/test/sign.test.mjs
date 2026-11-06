// The browser-safe signer is a copy of what @graphpay/contracts and @graphpay_ethglobal/agentpay define;
// these tests hold it equal, so it can never drift from what the contract verifies.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress } from 'viem';
import { config } from '@graphpay/config';
import { eip2612Types, permit2Domain, permitWitnessTypes, tokenDomain } from '@graphpay/contracts';
import { buildRequirement, createOrder, nodeOf, signOrderPayment as agentpaySign, whitechainNetwork } from '@graphpay_ethglobal/agentpay';
import { fakeChain } from './fakes.mjs';
import * as kit from '../src/sign.mjs';

const network = whitechainNetwork();
const NOW = 1_800_000_000;

function requirement() {
  const order = createOrder({
    merchant: { name: `shop.${config.root.ens}`, node: nodeOf(`shop.${config.root.ens}`), address: privateKeyToAccount(generatePrivateKey()).address },
    payer: { address: privateKeyToAccount(generatePrivateKey()).address },
    items: [{ sku: 'box-12', name: 'box of 12', quantity: 2, unitPriceMicro: 4_800_000n }],
    fulfilment: { type: 'delivery' },
    deadline: BigInt(NOW + 300),
    salt: `0x${'11'.repeat(32)}`,
  });
  return buildRequirement(order, network);
}

test('the copied EIP-712 shapes equal the ones @graphpay/contracts defines', () => {
  assert.deepEqual(kit.permitWitnessTypes, permitWitnessTypes);
  assert.deepEqual(kit.eip2612Types, eip2612Types);
  assert.deepEqual(kit.permit2Domain(network.chainId, network.permit2), permit2Domain(network.chainId, network.permit2));
  assert.deepEqual(kit.tokenDomain(network.chainId, network.token), tokenDomain(network.chainId, network.token));
});

test('the kit signs the same order, with the same bytes, as the SDK buyer does (a deterministic signature)', async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const req = requirement();
  const mandateHash = kit.intentHash({ shopName: 'shop', summary: '2 x box', amountMicro: 9_600_000n, deadline: NOW + 300 });
  const chain = fakeChain();
  chain.state.allowance = 0n; // the first payment: a gasless approval is signed too
  const base = { account, publicClient: chain.publicClient, network, nowSec: NOW };
  const ours = await kit.signOrderPayment({ ...base, requirement: req, mandateHash });
  const theirs = await agentpaySign({ ...base, requirement: req, payerName: '', mandateHash });
  assert.deepEqual(ours, theirs);
  assert.notEqual(ours.approvalPermit, '0x');
  assert.equal(ours.payerName, '');
  // And the signature is the account's, over the witness the contract verifies.
  const recovered = await recoverTypedDataAddress({
    domain: permit2Domain(network.chainId, network.permit2),
    types: permitWitnessTypes,
    primaryType: 'PermitWitnessTransferFrom',
    message: { permitted: { token: ours.permit.token, amount: BigInt(ours.permit.amount) }, spender: req.extra.contract, nonce: BigInt(ours.permit.nonce), deadline: BigInt(ours.permit.deadline), witness: { ...kit_lower(req.extra.order), mandateHash } },
    signature: ours.signature,
  });
  assert.equal(recovered, account.address);
});

const kit_lower = (w) => ({ ...w, merchant: w.merchant, amountMicro: BigInt(w.amountMicro), deadline: BigInt(w.deadline), kind: Number(w.kind) });

test('no approval is signed when the allowance already covers the amount, and a wrong chain signs nothing', async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const chain = fakeChain();
  const permit = await kit.approvalPermitFor({ account, publicClient: chain.publicClient, network, amount: 1_000_000n, nowSec: NOW });
  assert.equal(permit, '0x');
  let signed = 0;
  const spy = { address: account.address, signTypedData: async (...a) => (signed++, account.signTypedData(...a)) };
  const wrong = fakeChain({ chainId: 1 });
  await assert.rejects(kit.signOrderPayment({ account: spy, publicClient: wrong.publicClient, network, requirement: requirement(), mandateHash: kit.ZERO32, nowSec: NOW }), /not 1874|chain 1/);
  assert.equal(signed, 0);
});

test('the intent hash binds the quote that was shown', () => {
  const a = kit.intentHash({ shopName: 's', summary: '1 x box', amountMicro: 4_800_000n, deadline: NOW });
  assert.notEqual(a, kit.intentHash({ shopName: 's', summary: '1 x box', amountMicro: 4_800_001n, deadline: NOW }));
  assert.notEqual(a, kit.intentHash({ shopName: 'other', summary: '1 x box', amountMicro: 4_800_000n, deadline: NOW }));
  assert.match(a, /^0x[0-9a-f]{64}$/);
});

test('a chain that is not the testnet is refused by the kit itself, whatever network the app passes', async () => {
  const chain = fakeChain({ chainId: 1 });
  await assert.rejects(kit.assertChain(chain.publicClient, { ...network, chainId: 1 }), /not a testnet this kit signs on/);
  assert.deepEqual([...kit.SIGNING_CHAIN_IDS], [config.networks.whitechain.chainId]);
});
