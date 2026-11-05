// The two examples on an anvil fork of Whitechain Sepolia: the same SDK sells a box of
// sweets and a fixed-fare cab ride to customer agents that hold no gas.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { disposableEntry, story } from '@graphpay/config';
import { createReferenceRelayer, issueSpendingPass, usdt } from '../index.mjs';
import { sweetShop, sweetsBuyer } from '../../../examples/agentpay-sweets/index.mjs';
import { cabOperator, riderAgent } from '../../../examples/agentpay-ride/index.mjs';
import { chainClock, network, startFork } from './helpers.mjs';

let fork, clock, relayerAccount, writerAccount;

before(async () => {
  fork = await startFork();
  clock = chainClock();
  await clock.sync(fork);
  relayerAccount = fork.newAccount();
  writerAccount = fork.newAccount();
  await fork.grantRoles({ relayer: relayerAccount.address, policyWriter: writerAccount.address });
  await fork.setBalance(relayerAccount.address, 1);
  await fork.setBalance(writerAccount.address, 1);
});

after(() => fork?.stop());

async function customer() {
  const account = fork.newAccount();
  const agent = disposableEntry(9000 + Math.floor(Math.random() * 900));
  await fork.giveUsdt(account.address, usdt('10'));
  await issueSpendingPass({ walletClient: fork.wallet(writerAccount), publicClient: fork.publicClient, network, name: agent.ensName, wallet: account.address, dailyCapMicro: story.order.budgetMicro });
  return { account, name: agent.ensName };
}

for (const [label, makeShop, makeBuyer, price] of [
  ['sweet shop', sweetShop, sweetsBuyer, BigInt(story.order.priceMicro)],
  ['fixed-fare ride', cabOperator, riderAgent, BigInt(story.agentpayExamples.ride.fareMicro)],
]) {
  test(`${label}: a customer agent with no gas pays with one signature`, async () => {
    const merchantAccount = fork.newAccount();
    const facilitator = createReferenceRelayer({ walletClient: fork.wallet(relayerAccount), publicClient: fork.publicClient, network, allowedMerchants: [merchantAccount.address], clock: clock.now });
    const { merchant, handler } = makeShop({ address: merchantAccount.address, facilitator, publicClient: fork.publicClient });
    const paid = [];
    merchant.on('paid', (p) => paid.push(p));
    const { account, name } = await customer();
    const buyer = makeBuyer({ account, publicClient: fork.publicClient, name, fetch: (url, init) => handler(new Request(url, init)) });
    const r = await buyer.pay('https://merchant.example/order');
    assert.equal(r.status, 'paid', r.reason);
    assert.equal(r.amountMicro, price);
    assert.equal(await fork.usdtBalance(merchantAccount.address), price);
    assert.equal(await fork.publicClient.getBalance({ address: account.address }), 0n);
    assert.equal(paid.length, 1);
    const body = await r.response.json();
    assert.equal(body.orderId, r.orderId);
  });
}
