// node scripts/whitechain/deploy-checkout.mjs [--fork <anvil url>] [--yes]
// Deploys GraphPayCheckout for test USDT from DEPLOYER (admin), with FACILITATOR as the relayer
// and POLICY_WRITER as the policy writer (planning/SPEC/PAYMENTS_WHITECHAIN.md §7). Dry run by
// default. Before deploying: the token has code, 6 decimals, the configured symbol, and its
// DOMAIN_SEPARATOR() is the domain clients sign; Permit2 has code; the build is the committed ABI.
// A pending record (predicted address and nonce) goes to the tx log before sending, so a timeout
// never leads to a second deploy: a rerun finds the contract at the predicted address instead.
// The result goes to whitechain.contracts.checkout in the config (address, deploy block, tx).

import { readFileSync } from 'node:fs';
import { domainSeparator, encodeDeployData, erc20Abi, getAddress, getContractAddress, isAddressEqual, parseAbi } from 'viem';
import { config } from '../../packages/config/index.mjs';
import { checkoutAbi, tokenDomain } from '../../packages/contracts/index.mjs';
import { configuredCheckout, context, logTx, permit2, readTxLog, sendTx, usdt, writeContracts } from './lib.mjs';

const ARTIFACT = new URL('../../packages/contracts/out/GraphPayCheckout.sol/GraphPayCheckout.json', import.meta.url);
const LABEL = 'deploy GraphPayCheckout (USDT)';

const ctx = await context(process.argv.slice(2));
const { publicClient } = ctx;
const token = usdt();

const existing = configuredCheckout();
if (existing && (await publicClient.getCode({ address: existing.address }))) {
  console.log(`already deployed: ${existing.address} (block ${existing.deployBlock}); nothing to do`);
  process.exit(0);
}

// The token and Permit2, as clients will sign for them.
const tokenAbi = [...erc20Abi, ...parseAbi(['function DOMAIN_SEPARATOR() view returns (bytes32)'])];
const [code, decimals, symbol, onChainDomain, permit2Code] = await Promise.all([
  publicClient.getCode({ address: token.address }),
  publicClient.readContract({ address: token.address, abi: tokenAbi, functionName: 'decimals' }),
  publicClient.readContract({ address: token.address, abi: tokenAbi, functionName: 'symbol' }),
  publicClient.readContract({ address: token.address, abi: tokenAbi, functionName: 'DOMAIN_SEPARATOR' }),
  publicClient.getCode({ address: permit2() }),
]);
const expectedDomain = domainSeparator({ domain: tokenDomain(ctx.chain.id, token) });
const checks = [
  ['token has code', Boolean(code && code !== '0x')],
  [`token decimals = ${token.decimals}`, decimals === token.decimals],
  [`token symbol = ${token.symbol}`, symbol === token.symbol],
  ['configured EIP-712 domain = DOMAIN_SEPARATOR()', onChainDomain === expectedDomain],
  ['Permit2 has code', Boolean(permit2Code && permit2Code !== '0x')],
  ['token is not on the never-use list', !config.whitechain.tokens.neverUse.some((a) => isAddressEqual(a, token.address))],
];
for (const [name, ok] of checks) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`);
if (checks.some(([, ok]) => !ok)) throw new Error('token checks failed; nothing deployed');

const artifact = JSON.parse(readFileSync(ARTIFACT, 'utf8'));
if (JSON.stringify(artifact.abi) !== JSON.stringify(checkoutAbi)) {
  throw new Error('the forge build differs from the committed ABI: run forge build in packages/contracts');
}

const deployer = ctx.account('DEPLOYER').address;
const relayer = ctx.account('FACILITATOR').address;
const policyWriter = ctx.account('POLICY_WRITER').address;
const args = [token.address, permit2(), deployer, relayer, policyWriter];
const nonce = await publicClient.getTransactionCount({ address: deployer, blockTag: 'latest' });
const predicted = getContractAddress({ from: deployer, nonce: BigInt(nonce) });
console.log(`  admin DEPLOYER ${deployer}, relayer FACILITATOR ${relayer}, policy writer POLICY_WRITER ${policyWriter}`);

// A pending deploy from an earlier run: finish its record instead of deploying again.
const pending = readTxLog().filter((r) => r.label === LABEL && r.status === 'pending' && r.network === (ctx.fork ? 'fork' : 'whitechain'));
for (const p of pending) {
  if (await publicClient.getCode({ address: p.predicted })) {
    // The receipt may never have reached the log (a timeout): fetch it by the logged hash.
    const sent = readTxLog().find((r) => r.label === LABEL && r.status === 'sent' && r.nonce === p.nonce);
    const receipt = sent && (await publicClient.getTransactionReceipt({ hash: sent.hash }).catch(() => null));
    if (!receipt || receipt.status !== 'success' || !receipt.contractAddress || !isAddressEqual(receipt.contractAddress, p.predicted)) {
      throw new Error(`a contract exists at the pending address ${p.predicted} but its deploy receipt was not found: check the explorer`);
    }
    record(p.predicted, Number(receipt.blockNumber), receipt.transactionHash);
    process.exit(0);
  }
  if (nonce > p.nonce) throw new Error(`DEPLOYER's nonce ${p.nonce} was used without a contract at ${p.predicted}: check the explorer before retrying`);
}

const data = encodeDeployData({ abi: checkoutAbi, bytecode: artifact.bytecode.object, args });
const gas = await publicClient.estimateGas({ account: deployer, data });
console.log(`  predicted ${predicted} at DEPLOYER nonce ${nonce}; gas estimate ${gas}`);
if (!ctx.send) process.exit(0);

logTx({ label: LABEL, status: 'pending', predicted, nonce, from: deployer, network: ctx.fork ? 'fork' : 'whitechain' });
const receipt = await sendTx(ctx, {
  role: 'DEPLOYER',
  label: LABEL,
  request: { abi: checkoutAbi, bytecode: artifact.bytecode.object, args, data },
  expectedNonce: nonce, // the nonce the pending record predicted from
});
const address = getAddress(receipt.contractAddress);
if (!isAddressEqual(address, predicted)) throw new Error(`deployed at ${address}, predicted ${predicted}`);
record(address, Number(receipt.blockNumber), receipt.transactionHash);

function record(address, deployBlock, deployTx) {
  if (ctx.fork) {
    console.log(`fork deploy at ${address} (block ${deployBlock}); the config is not changed for a fork`);
    return;
  }
  writeContracts({ checkout: { token: 'usdt', address, deployBlock, deployTx } });
  console.log(`recorded whitechain.contracts.checkout = ${address} (block ${deployBlock}) in packages/config/graphpay.config.json`);
}
