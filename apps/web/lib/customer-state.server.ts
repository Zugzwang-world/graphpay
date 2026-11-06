// Reads the three sources for the customer phone (lib/customer-state.ts says how they
// combine). Each read is public chain or graph data; nothing here signs.
import { checkoutAbi } from '@graphpay/contracts';
import { createEnsGate, ensPublicClient } from '@graphpay/ens';
import { runGraphql } from '@graphpay/money-graph';
import { decodeFunctionResult, encodeFunctionData } from 'viem';
import { namehash } from 'viem/ens';
import { arkivEngine } from '../app/api/graphql/arkiv.server.ts';
import { rpcCall } from './chain.server.ts';
import type { CustomerState, SubscriptionSummary } from './contracts.ts';
import { agentStatusOf, newestPayment, orderSummary, policyOf, type EnsStatus, type OrderEdge, type Policy } from './customer-state.ts';
import { checkoutAddress, siteModel } from './site.server.ts';
import { payerSubscription } from './subscription-live.server.ts';

export interface Sources {
  ensStatus(name: string): Promise<EnsStatus>;
  policy(node: `0x${string}`): Promise<Policy | null>;
  spentToday(node: `0x${string}`): Promise<bigint>;
  payments(name: string, sinceDay: number): Promise<OrderEdge[]>;
  trail(orderId: string): Promise<OrderEdge[]>;
  // The payer agent's newest subscription to the story's plan, from the checkout.
  subscription(): Promise<SubscriptionSummary | null>;
}

let gate: Promise<ReturnType<typeof createEnsGate>> | null = null;
const ensGate = () =>
  (gate ??= ensPublicClient()
    .then(({ client }) => createEnsGate({ client }))
    .catch((error: unknown) => {
      gate = null;
      throw error;
    }));

async function ethCall<T>(functionName: 'policies' | 'spentToday', node: `0x${string}`): Promise<T> {
  const to = checkoutAddress();
  if (!to) throw new Error('the checkout is not deployed');
  const data = encodeFunctionData({ abi: checkoutAbi, functionName, args: [node] });
  const result = await rpcCall('whitechain', 'eth_call', [{ to, data }, 'latest']);
  if (typeof result !== 'string') throw new Error('eth_call returned no data');
  return decodeFunctionResult({ abi: checkoutAbi, functionName, data: result as `0x${string}` }) as T;
}

const graphql = async <T>(query: string, variables: Record<string, unknown>): Promise<T> => {
  const answer = await runGraphql({ engine: await arkivEngine(), query, variables });
  if (answer.errors?.length || answer.data === undefined) throw new Error('the graph did not answer');
  return answer.data as T;
};

const EDGE = 'kind amountMicro ts ref orderId to { ens }';

export const liveSources: Sources = {
  ensStatus: async (name) => (await (await ensGate()).ensCheck(name)).status,
  policy: async (node) => policyOf(await ethCall<Parameters<typeof policyOf>[0]>('policies', node)),
  spentToday: (node) => ethCall<bigint>('spentToday', node),
  payments: async (name, sinceDay) => {
    const data = await graphql<{ node: { out: OrderEdge[] } | null }>(`query($ens: String!, $since: Int!) { node(ens: $ens) { out(kind: "pay", sinceDay: $since, limit: 50) { ${EDGE} } } }`, { ens: name, since: sinceDay });
    return data.node?.out ?? [];
  },
  trail: async (orderId) => (await graphql<{ order: OrderEdge[] }>(`query($id: String!) { order(id: $id) { ${EDGE} } }`, { id: orderId })).order,
  // Bounded: a slow chain read is no subscription on this answer, never a slow customer state.
  subscription: () => Promise.race([payerSubscription(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000))]),
};

export async function readCustomerState(sources: Sources = liveSources, nowS = Math.floor(Date.now() / 1000)): Promise<CustomerState> {
  const agent = siteModel().payer.ens;
  const node = namehash(agent) as `0x${string}`;
  // Independent sources: all are awaited, and any one failing fails the whole answer, so the
  // phone never shows a half-known agent as active.
  // The subscription is the one source that may fail on its own: it never decides the agent's status.
  const [ens, policy, spent, payments, subscription] = await Promise.all([
    sources.ensStatus(agent),
    sources.policy(node),
    sources.spentToday(node),
    sources.payments(agent, Math.floor(nowS / 86_400) - 30),
    sources.subscription().catch(() => null),
  ]);
  const payment = newestPayment(payments);
  const lastOrder = payment?.orderId ? orderSummary(payment, await sources.trail(payment.orderId)) : null;
  return {
    agent: { ens: agent, status: agentStatusOf(ens, policy, nowS), epoch: policy?.epoch ?? 0 },
    capMicro: String(policy?.dailyCapMicro ?? 0n),
    spentTodayMicro: String(spent),
    policyExpiresAt: policy && policy.expiry > 0n ? new Date(Number(policy.expiry) * 1000).toISOString() : null,
    lastOrder,
    subscription,
  };
}

// One read per 3 s per instance, however many phones poll.
let shared: { at: number; value: Promise<CustomerState> } | null = null;
export function sharedCustomerState(): Promise<CustomerState> {
  if (shared && Date.now() - shared.at < 3000) return shared.value;
  const value = readCustomerState();
  shared = { at: Date.now(), value };
  value.catch(() => {
    if (shared?.value === value) shared = null;
  });
  return value;
}
