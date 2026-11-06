// T2's ENS watcher (M6, packages/ens/src/watcher.mjs) hosted in the workers process: the
// tracked names' registry and resolver events on Sepolia, with the real sinks.
//   updatePolicy  T2's createPolicySink: setPolicy on the checkout as POLICY_WRITER, built
//                 from the chain's own policy and the payments setup's configured list
//                 (scripts/whitechain/plan.mjs); never an ENS cap or address
//   patchNode     logged only: a policy change emits AgentPolicySet, and the mirror writes
//                 the node's standing from it (one writer path for node rows)
// Without POLICY_WRITER_PRIVATE_KEY the policy sink logs what it would send. ENS_WATCHER=0
// turns the watcher off. Every send is serialised, refused while POLICY_WRITER has a
// pending transaction, and logged by hash and explorer link.
//   the spare keeper  after the watcher revoked a killed disposable agent, and once at start,
//                 scripts/ens/spare.mjs --yes makes sure one funded spare is live for the
//                 site's next kill (a child process: its failure never touches the mirror;
//                 one run at a time). SPARE_KEEPER=0 turns it off.

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { activeCast } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { createEnsGate, createEnsReader, createEnsWatcher, createPolicySink, disposableAgent, memoryCheckpoint, namespacePlan, retryingReads } from '@graphpay/ens';
import { privateKeyToAccount } from 'viem/accounts';
import { clientsFor } from '../../../scripts/lib/chains.mjs';
import { roleAddresses } from '../../../scripts/lib/wallets.mjs';
import { policyPlan } from '../../../scripts/whitechain/plan.mjs';

const json = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x));

// The names the watcher tracks: the owners, the agents and every numbered disposable agent
// that has a wallet role (a policy exists only for those; an unprovisioned name is left out,
// since it has no registry or resolver to read).
export function watchedNames({ roles = {} } = {}) {
  const plan = namespacePlan();
  const ns = Object.keys(roles).map((r) => /^DISPOSABLE_([1-9][0-9]*)$/.exec(r)?.[1]).filter(Boolean).map(Number);
  const names = new Set([...plan.owners.map((o) => o.name), ...plan.agents.map((a) => a.name), ...ns.map((n) => disposableAgent(n).name)]);
  return [...names];
}

const SPARE_SCRIPT = fileURLToPath(new URL('../../../scripts/ens/spare.mjs', import.meta.url));

// True for a numbered disposable agent's name (disposable-<n> under the persona).
export function isDisposableName(name) {
  const prefix = activeCast().disposable.labelPrefix;
  const label = name.split('.')[0];
  const n = label.startsWith(prefix) ? label.slice(prefix.length) : '';
  return /^[1-9][0-9]*$/.test(n) && disposableAgent(Number(n)).name === name;
}

function runScript(file, args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [file, ...args], { timeout: 15 * 60_000, maxBuffer: 1 << 20 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, out: `${stdout}${stderr}` });
    });
  });
}

// One keeper run at a time; a kick while one runs schedules exactly one more after it. A failed run
// (an RPC error, a nonce clash, a held lock) is tried again after `retryMs`; exit 2 (a key is
// missing, on this Mac or on the site) waits for a person, so it is not retried.
export function spareKeeper({ log, run = runScript, disabled = false, retryMs = 120_000, setTimer = (fn, ms) => setTimeout(fn, ms).unref?.() }) {
  let running = null;
  let again = null;
  let retrying = false;
  const kick = (why) => {
    if (disabled) return Promise.resolve();
    if (running) {
      again = why;
      return running;
    }
    running = run(SPARE_SCRIPT, ['--yes'])
      .then(({ code, out }) => {
        for (const line of out.split('\n').filter(Boolean)) log(`spare keeper: ${line}`);
        log(`spare keeper (${why}): exit ${code}`);
        return code;
      })
      .catch((e) => {
        log(`spare keeper (${why}): ${e.message}`);
        return 1;
      })
      .then((code) => {
        running = null;
        if (again) {
          const next = again;
          again = null;
          kick(next);
        } else if (code !== 0 && code !== 2 && !retrying) {
          retrying = true;
          setTimer(() => {
            retrying = false;
            kick('retry');
          }, retryMs);
        }
      });
    return running;
  };
  return { kick };
}

// whitechain: the workers' checked clients (clientsFor). values: the loaded .env as [name, value] pairs.
export async function startEnsWatcher({ env, values, whitechain, checkout, log }) {
  if (env.ENS_WATCHER === '0') {
    log('ens watcher: off (ENS_WATCHER=0)');
    return { stop: () => {} };
  }
  const sepolia = await clientsFor('sepolia', env); // refuses any RPC not on 11155111
  const client = retryingReads(sepolia.publicClient, { tries: 4, delayMs: 2000 });
  log(`ens watcher: sepolia ${sepolia.rpcLabel} (chain ${sepolia.chain.id})`);

  const roles = roleAddresses(values);
  const configured = (node) => {
    try {
      const p = policyPlan({ roles, now: Math.floor(Date.now() / 1000) }).find((x) => x.node.toLowerCase() === node.toLowerCase());
      return p ? { wallet: p.wallet, capMicro: p.capMicro } : undefined;
    } catch {
      return undefined; // a missing role key: nothing to reopen from
    }
  };
  const readPolicy = async (node) => {
    const p = await whitechain.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [node] });
    return { epoch: p.epoch, wallet: p.wallet, revoked: p.revoked, dailyCapMicro: p.dailyCapMicro, expiry: p.expiry };
  };

  const key = env.POLICY_WRITER_PRIVATE_KEY;
  let account = key ? privateKeyToAccount(key) : null;
  if (account && !(await whitechain.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'isPolicyWriter', args: [account.address] }))) {
    log('ens watcher: POLICY_WRITER is not a policy writer on the checkout; policy writes are logged only');
    account = null;
  }
  let sending = Promise.resolve();
  const writePolicy = (p) => {
    const run = sending.then(async () => {
      if (!account) {
        log(`ens watcher: [no POLICY_WRITER key] would setPolicy ${json(p)}`);
        return;
      }
      const pc = whitechain.publicClient;
      const [latest, pending] = await Promise.all([pc.getTransactionCount({ address: account.address, blockTag: 'latest' }), pc.getTransactionCount({ address: account.address, blockTag: 'pending' })]);
      if (pending !== latest) throw new Error(`POLICY_WRITER has a pending transaction (nonce ${latest}); not sending`);
      // The nonce is left to viem (read at send time), which narrows the window with T1's scripts.
      const request = { address: checkout, abi: checkoutAbi, functionName: 'setPolicy', args: [p.node, p.epoch, p.wallet, p.revoked, p.capMicro, p.expiry], account, chain: whitechain.chain };
      const hash = await whitechain.walletClient(account).writeContract(request);
      log(`ens watcher: setPolicy sent ${whitechain.explorerTx(hash)} (epoch ${p.epoch}, revoked ${p.revoked})`);
      const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== 'success') throw new Error(`setPolicy reverted: ${whitechain.explorerTx(hash)}`);
      log(`ens watcher: setPolicy mined, block ${receipt.blockNumber}, ${receipt.gasUsed} gas`);
    });
    sending = run.catch(() => {});
    return run;
  };

  const policySink = createPolicySink({ configured, readPolicy, writePolicy, log });
  const sink = {
    updatePolicy: (c) => policySink.updatePolicy(c),
    patchNode: async (node, fields) => log(`ens watcher: node ${node.slice(0, 10)}… ${json(fields)} (the mirror writes the standing from AgentPolicySet)`),
  };
  const keeper = spareKeeper({ log, disabled: env.SPARE_KEEPER === '0' || !account });
  const watcher = createEnsWatcher({
    client,
    names: watchedNames({ roles }),
    sink,
    reader: createEnsReader({ client }),
    gate: createEnsGate({ client, expectedEpoch: async () => null, policyCapMicro: async () => null, spentToday: async () => 0n }),
    checkpoint: memoryCheckpoint(),
    log,
    onRevoked: ({ name }) => {
      if (isDisposableName(name)) keeper.kick(`${name} revoked`);
    },
  });
  const started = await watcher.start();
  log(`ens watcher: ${started.tracked} names from block ${started.checkpoint}${account ? '' : ' (no POLICY_WRITER key: policy writes are logged only)'}`);
  keeper.kick('start');
  const stop = watcher.run({ pollMs: 6_000, tickMs: 30_000, onError: (e) => log(`ens watcher: ${e.shortMessage ?? e.message}`) });
  return { stop, watcher };
}

// Starts the watcher, and on failure tries again every `retryMs` until it runs: its start
// applies revocations that happened while the workers were down, so it must not give up.
// Returns { stop }.
export function keepEnsWatcher(opts, { retryMs = 60_000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let running = null;
  let timer = null;
  let stopped = false;
  const attempt = async () => {
    timer = null;
    if (stopped) return;
    try {
      running = await startEnsWatcher(opts);
      if (stopped) running.stop();
    } catch (err) {
      opts.log(`ens watcher: start failed (${err.shortMessage ?? err.message}); trying again in ${retryMs / 1000} s`);
      if (!stopped) timer = setTimer(attempt, retryMs);
    }
  };
  attempt();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimer(timer);
      running?.stop();
    },
  };
}
