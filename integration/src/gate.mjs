// The ENS gate on the payer's side of M12 (T2's createEnsGate, M6 part 1), with the
// policy and the day's spend read from the deployed checkout on Whitechain, as the
// facilitator reads them. Two uses:
//   ensCheck(name)   the agents' ens_check (the shop's risk agent, G9)
//   gatedSign(sign)  a sign hook that runs the full gate on the paying agent first and
//                    signs nothing unless it passes (fail closed: any read error refuses)
// The facilitator runs the same gate again before it settles; this one only stops a
// signature that would be refused anyway. The kill check (E7, assertion F) must sign with
// the ungated hook: it proves the facilitator refuses a killed agent (HTTP 402
// ENS_EXPIRED_OR_REVOKED) and the recorder writes its fail edge, which a refusal here
// would hide.

import { config } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { createEnsGate } from '@graphpay/ens';
import { isAddressEqual, zeroAddress } from 'viem';

export class GateRefusedError extends Error {
  constructor(reason, detail) {
    super(`refused: ${reason}${detail ? ` (${detail})` : ''}`);
    this.code = 'GATE_REFUSED';
    this.reason = reason;
  }
}

// ens: a Sepolia public client; whitechain: a public client on chain 1874.
// reads: the ENS walk and text reads, faked in the tests (createEnsGate's defaults otherwise).
export function createPayerGate({ ens, whitechain, checkout = config.whitechain.contracts.checkout.address, clock = Date.now, reads = {} }) {
  const chainId = config.networks.whitechain.chainId;
  let chainChecked = null;
  const read = async (functionName, args) => {
    // The checkout is read only on Whitechain (1874), checked once per gate.
    chainChecked ??= whitechain.getChainId().then((id) => {
      if (id !== chainId) throw new Error(`gate: the Whitechain client answers chain ${id}`);
    });
    await chainChecked;
    return whitechain.readContract({ address: checkout, abi: checkoutAbi, functionName, args });
  };
  // One policy read per gate call: the epoch and the cap must come from the same policy.
  const reads_ = new Map();
  const policyOf = (node) => {
    const at = reads_.get(node);
    if (at && clock() - at.t < 5_000) return at.p;
    const p = read('policies', [node]).then((x) => (x && !isAddressEqual(x.wallet, zeroAddress) ? x : null));
    reads_.set(node, { t: clock(), p });
    p.catch(() => reads_.delete(node));
    return p;
  };
  const gate = createEnsGate({
    client: ens,
    clock,
    ...reads,
    expectedEpoch: async (node) => (await policyOf(node))?.epoch ?? null,
    // Payer side only: a revoked policy refuses before signing. The facilitator must not
    // reuse this (it would hide the on-chain AGENT_REVOKED record, INTEGRATION_AND_MIRROR §8.7).
    policyCapMicro: async (node) => {
      const p = await policyOf(node);
      return p && !p.revoked ? BigInt(p.dailyCapMicro) : null;
    },
    spentToday: async (node) => BigInt(await read('spentToday', [node])),
  });

  return {
    ensGate: gate.ensGate,
    ensCheck: gate.ensCheck,
    invalidate: gate.invalidate,
    gatedSign(sign) {
      return async (req) => {
        const amount = BigInt(req?.requirement?.amount ?? req?.approved?.amountMicro ?? 0);
        const r = await gate.ensGate(req.payerEns, amount);
        if (!r.ok) throw new GateRefusedError(r.reason, r.detail);
        return sign(req);
      };
    },
  };
}
