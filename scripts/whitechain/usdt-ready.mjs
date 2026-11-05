// node scripts/whitechain/usdt-ready.mjs [--fork <anvil url>]
// ALLOW_REAL_NETWORK=1 node scripts/whitechain/usdt-ready.mjs --go --yes
// Readiness of the qualifying test-USDT payment (acceptance C7): the token as clients sign for
// it, the checkout pinned to it, the acceptance agent's wallet, balance and policy, and FUNDER's
// reserve. The stand-in token is retired (ADR-0054), so M2 deployed the USDT checkout itself.
// With --go (and --yes to send) it then makes the payment, once ever: the story's order as the
// acceptance agent to the story's shop through the local facilitator (local-pay.mjs, the real ENS gate), checks
// PaymentSettled, the token transfer and the payer's unchanged WBT, and writes
// docs/sessions/payments/c7.json. A second --go finds that record and refuses (C7 = E3, paid once).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeEventLog, domainSeparator, erc20Abi, formatEther, formatUnits, isAddressEqual, namehash, parseAbi } from 'viem';
import { castEntries, config, story } from '../../packages/config/index.mjs';
import { checkoutAbi, tokenDomain } from '../../packages/contracts/index.mjs';
import { configuredCheckout, context, flag, usdt } from './lib.mjs';
import { localPayment } from './local-pay.mjs';

const ctx = await context(process.argv.slice(2));
const { publicClient } = ctx;
const token = usdt();
const tokenAbi = [...erc20Abi, ...parseAbi(['function DOMAIN_SEPARATOR() view returns (bytes32)'])];
const read = (address, abi, functionName, args = []) => publicClient.readContract({ address, abi, functionName, args });
const checks = [];
const check = (name, ok, note = '') => checks.push({ name, ok, note });

check('token has code', Boolean(await publicClient.getCode({ address: token.address })));
check(`decimals = ${token.decimals}`, (await read(token.address, tokenAbi, 'decimals')) === token.decimals);
check('EIP-712 domain = DOMAIN_SEPARATOR()', (await read(token.address, tokenAbi, 'DOMAIN_SEPARATOR')) === domainSeparator({ domain: tokenDomain(ctx.chain.id, token) }));
const funder = config.wallets.carried.FUNDER;
const funderUsdt = await read(token.address, erc20Abi, 'balanceOf', [funder]);
check('FUNDER holds test USDT for top-ups', funderUsdt > 0n, `${formatUnits(funderUsdt, 6)} USDT`);

const acceptance = castEntries().find((e) => e.key === 'acceptance');
const wallet = ctx.account(acceptance.walletRole).address;
const balance = await read(token.address, erc20Abi, 'balanceOf', [wallet]);
const storyCap = BigInt(acceptance.capMicro);
check(`${acceptance.ensName} wallet holds test USDT`, balance > 0n, `${formatUnits(balance, 6)} USDT, ${formatEther(await publicClient.getBalance({ address: wallet }))} WBT (pays no gas)`);

const deployed = configuredCheckout();
if (!deployed) {
  check('USDT checkout deployed', false, 'run deploy-checkout');
} else {
  const pinned = await read(deployed.address, checkoutAbi, 'USDT');
  check('checkout.USDT() = test USDT', isAddressEqual(pinned, token.address), deployed.address);
  const policy = await read(deployed.address, checkoutAbi, 'policies', [namehash(acceptance.ensName)]);
  check(`policy for ${acceptance.ensName} on its own wallet`, isAddressEqual(policy.wallet, wallet) && !policy.revoked, `cap ${formatUnits(policy.dailyCapMicro, 6)}/day, the story's ${formatUnits(storyCap, 6)}`);
}
// Paid once ever, guarded twice: the record (written as pending before the payment, so a crash
// or a receipt timeout still blocks a second run; committed with the step's PR) and the chain
// itself (no PaymentSettled for the acceptance agent's node on this checkout since its deploy).
const RECORD = ctx.fork ? join(tmpdir(), 'graphpay-fork-c7.json') : new URL('../../docs/sessions/payments/c7.json', import.meta.url);
const prior = !ctx.fork && existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, 'utf8')) : null;
if (prior) check('C7 not yet attempted', false, prior.status === 'pending' ? `an attempt is pending since ${prior.at} (order ${prior.orderId}): check the chain before touching c7.json` : `paid once already: ${prior.explorer}`);
const settledBefore = deployed ? await settlementsOf(namehash(acceptance.ensName)) : [];
if (settledBefore.length) check('no earlier payment by the acceptance agent on this checkout', false, ctx.explorerTx(settledBefore[0].transactionHash));
else if (balance < BigInt(story.order.priceMicro)) check(`${acceptance.ensName} holds ${formatUnits(BigInt(story.order.priceMicro), 6)}`, false);
for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.note ? ` (${c.note})` : ''}`);
if (checks.some((c) => !c.ok)) {
  process.exitCode = 1;
} else if (flag(process.argv, '--go')) {
  await qualifyingPayment();
}

// PaymentSettled events paying for a node (payerNode is indexed), in 1,000-block chunks from the deploy block (the RPC limit).
async function settlementsOf(payerNode) {
  const latest = await publicClient.getBlockNumber();
  const found = [];
  for (let from = BigInt(deployed.deployBlock); from <= latest; from += 1_000n) {
    const to = from + 999n < latest ? from + 999n : latest;
    found.push(...(await publicClient.getContractEvents({ address: deployed.address, abi: checkoutAbi, eventName: 'PaymentSettled', args: { payerNode }, fromBlock: from, toBlock: to })));
  }
  return found;
}

// C7: one payment of the story's order as the acceptance agent, through the facilitator.
async function qualifyingPayment() {
  const lp = await localPayment(ctx);
  const agent = lp.payer(acceptance.walletRole, acceptance.ensName, { mandate: 'C7 qualifying payment' });
  const gate = await lp.gate.ensGate(agent.name, BigInt(story.order.priceMicro));
  console.log(`  gate ${agent.name}: ${gate.ok ? `ok (epoch ${gate.epoch}, cap ${lp.fmt(gate.capMicro)})` : gate.reason}`);
  if (!gate.ok || !ctx.send) {
    if (gate.ok) console.log(`ready: would pay ${lp.fmt(story.order.priceMicro)} as ${agent.name} to ${lp.shop.ensName}; nothing sent (add --yes)`);
    else process.exitCode = 1;
    lp.close();
    return;
  }
  try {
    const before = await lp.balances(agent.address);
    const merchantBefore = await lp.balances(lp.merchant.address);
    const q = await lp.quote(agent, { buyer: castEntries().find((e) => e.kind === 'persona').ensName, qty: story.order.quantity });
    if (q.priceMicro !== String(story.order.priceMicro)) throw new Error('the quote is not the catalog price');
    const record = (fields) => writeFileSync(RECORD, `${JSON.stringify({ check: 'C7 (also E3)', synthetic: true, payer: agent.name, wallet: agent.address, orderId: q.orderId, ...fields }, null, 2)}\n`);
    record({ status: 'pending', at: new Date().toISOString() });
    const paid = await lp.pay(q, agent);
    const sent = paid.body?.transaction || paid.settlement?.transaction;
    if (sent) record({ status: 'pending', at: new Date().toISOString(), tx: sent, explorer: ctx.explorerTx(sent) });
    if (paid.status !== 200 || paid.settlement?.success !== true) throw new Error(`C7 answered ${paid.status} ${JSON.stringify(paid.body)}; the record stays pending`);
    const hash = paid.body.transaction;
    const receipt = await lp.logRelayed('C7 qualifying payment', hash);
    let settled = false;
    let moved = 0n;
    for (const log of receipt.logs) {
      try {
        if (isAddressEqual(log.address, lp.checkout)) {
          const ev = decodeEventLog({ abi: checkoutAbi, data: log.data, topics: log.topics });
          if (ev.eventName === 'PaymentSettled' && ev.args.orderId.toLowerCase() === q.orderId) settled = true;
        } else if (isAddressEqual(log.address, token.address)) {
          const ev = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
          if (ev.eventName === 'Transfer' && isAddressEqual(ev.args.from, agent.address) && isAddressEqual(ev.args.to, lp.merchant.address)) moved += ev.args.value;
        }
      } catch {
        // another event
      }
    }
    const after = await lp.balances(agent.address);
    const result = {
      status: 'paid',
      shop: lp.shop.ensName,
      amount: lp.fmt(story.order.priceMicro),
      token: token.address,
      tx: hash,
      explorer: ctx.explorerTx(hash),
      block: Number(receipt.blockNumber),
      gasUsed: Number(receipt.gasUsed),
      txFrom: receipt.from,
      paymentSettled: settled,
      tokenTransferMicro: String(moved),
      payerWbtBefore: formatEther(before.wbt),
      payerWbtAfter: formatEther(after.wbt),
      merchantReceivedMicro: String((await lp.balances(lp.merchant.address)).usdt - merchantBefore.usdt),
      at: new Date().toISOString(),
    };
    record(result);
    const ok = settled && moved === BigInt(story.order.priceMicro) && after.wbt === before.wbt && isAddressEqual(receipt.from, lp.relayer.address);
    console.log(`C7 ${ok ? 'done' : 'CHECK FAILED'}: ${result.explorer} (PaymentSettled ${settled}, transfer ${formatUnits(moved, 6)}, payer gas 0: ${after.wbt === before.wbt}, from the relayer: ${isAddressEqual(receipt.from, lp.relayer.address)})`);
    if (!ok) process.exitCode = 1;
  } finally {
    lp.close();
  }
}
