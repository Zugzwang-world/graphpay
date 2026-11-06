/**
 * The single contract between the UI and everything else
 * (DESIGN_INSTRUCTIONS.md Appendix A, FRONTEND_HANDOVER.md section 7).
 *
 * Components render state and call DemoAdapter methods; they never touch the
 * network. A live adapter can replace the mock one without UI changes.
 *
 * Anything marked "PROPOSED (mock only)" is not in the owner's contract. It
 * exists only so the mock flow works end to end, and is listed in README.md.
 * It is never a request for a backend change.
 */

export type Money = { amount: string; currency: 'USDT' };
export type AgentRef = { ens: string; role: string; owner: string };
export type ShopRef = { ens: string; name: string };
/** Explorer link. `mock: true` marks a link that points at no real record. PROPOSED (mock only): `mock`. */
export type Link = { label: string; url: string; mock?: boolean };

export type OrderItem = { name: string; qty: number; price: Money; productId?: string };

/** Customer order steps; the merchant tracker starts at `paid`. */
export type OrderStep = 'ordered' | 'paid' | 'dispatched' | 'delivered';
export type RefundStatus = 'requested' | 'accepted' | 'refunded' | 'declined';
export type RiskLevel = 'safe' | 'warn' | 'bad';

export interface Refund {
  id: string;
  amount: Money;
  full: boolean;
  reason: string;
  photoUrl?: string;
  photoName?: string;
  status: RefundStatus;
  /** PROPOSED (mock only): the shop's decline note, so the customer can read it. */
  note?: string;
  requestedAt: number;
  decidedAt?: number;
  settledAt?: number;
  links: Link[];
}

export interface Person {
  name: string;
  ens: string;
}

export interface BuyerReputation {
  orders: number;
  refunds: number;
  since: string;
}

export interface Order {
  id: string;
  /** Human order number, e.g. "1042". */
  number: string;
  kind: 'order' | 'renewal';
  renewalId?: string;
  shop: ShopRef;
  items: OrderItem[];
  total: Money;
  status: OrderStep;
  createdAt: number;
  paidAt?: number;
  dispatchedAt?: number;
  deliveredAt?: number;
  buyer: AgentRef;
  owner: Person;
  reputation: BuyerReputation;
  risk: { level: RiskLevel; text: string };
  /** Payment links (explorer). */
  links: Link[];
  refunds: Refund[];
  /** The merchant has not opened it yet. */
  isNew: boolean;
  /** Seeded sample data rather than created during this demo run. */
  synthetic: boolean;
}

export type RenewalFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RenewalSchedule {
  frequency: RenewalFrequency;
  /** 0 = Sunday … 6 = Saturday, for weekly and every-2-weeks. */
  weekday?: number;
  /** 1–28, for monthly. */
  dayOfMonth?: number;
  /** ISO date (YYYY-MM-DD) of the first charge. */
  startDate: string;
}

export type RenewalStatus = 'active' | 'charged' | 'skipped' | 'cancelled';

export interface RenewalCharge {
  at: number;
  orderId: string;
  amount: Money;
  links: Link[];
}

export interface Renewal {
  id: string;
  sourceOrderId?: string;
  item: string;
  productId?: string;
  shop: ShopRef;
  schedule: RenewalSchedule;
  /** The schedule in words, e.g. "every Sunday". */
  scheduleText: string;
  /** Short form for the merchant list, e.g. "Sun" or "Daily". */
  scheduleShort: string;
  nextChargeAt: number | null;
  amount: Money;
  status: RenewalStatus;
  payingAgent: AgentRef;
  owner: Person;
  charges: RenewalCharge[];
  createdAt: number;
  skippedReason?: 'shop_closed';
  synthetic: boolean;
}

export type AgentStatus = 'active' | 'paused' | 'revoked';
export type PassState = 'active' | 'used_up' | 'expired' | 'paused' | 'revoked';

export interface SpendingPass {
  cap: Money;
  used: Money;
  period: 'day';
  expiresAt: number;
  state: PassState;
}

export type RefusalReason =
  | 'cap'
  | 'paused'
  | 'revoked'
  | 'trap_shop'
  | 'budget'
  | 'quote_expired'
  /** PROPOSED (mock only): the shop is closed. */
  | 'shop_closed';

export interface RefusedAttempt {
  id: string;
  kind: 'payment' | 'cap_change';
  reason: RefusalReason | 'cap_change';
  attempted?: Money;
  at: number;
  links: Link[];
}

export interface AgentState {
  ref: AgentRef;
  label: string;
  main: boolean;
  pays: boolean;
  does: string;
  status: AgentStatus;
  pass?: SpendingPass;
  refusedAttempts: RefusedAttempt[];
}

export interface ShopAgentState {
  ref: AgentRef;
  label: string;
  main: boolean;
}

export interface ShopState {
  ref: ShopRef;
  area: string;
  open: boolean;
}

export interface DemoSnapshot {
  mode: 'mock' | 'live';
  customer: Person;
  agents: AgentState[];
  shop: ShopState;
  shopAgents: ShopAgentState[];
  orders: Order[];
  renewals: Renewal[];
  /** An errand (prompt) is running; the composer may show a waiting hint. */
  errandRunning: boolean;
  now: number;
}

export type AgentActivity = 'thinking' | 'checked' | 'quoted' | 'paid' | 'refused' | 'idle';

export interface ShopChoice {
  shop: ShopRef;
  price: Money;
  distanceKm: number;
  paidOrders: number;
  refundRate: string;
  repeatBuyers: number;
  verdict: 'chosen' | 'considered' | 'rejected';
  reason?: string;
}

export type DemoEvent =
  | { type: 'agent.message'; agent: AgentRef; text: string; at: number; errandId?: string }
  | { type: 'agent.status'; agent: AgentRef; status: AgentActivity; reason?: string; errandId?: string; links?: Link[] }
  | { type: 'graph.read'; question: string; reads: number; ms: number; links: Link[]; errandId?: string }
  | { type: 'ens.resolved'; name: string; address: string; links: Link[] }
  | {
      type: 'quote.created';
      orderId: string;
      shop: ShopRef;
      items: { name: string; qty: number; price: Money }[];
      total: Money;
      validUntil: number;
      errandId?: string;
    }
  | { type: 'payment.signed'; orderId: string }
  | { type: 'payment.settled'; orderId: string; total: Money; links: Link[] }
  | {
      type: 'payment.refused';
      orderId?: string;
      reason: RefusalReason;
      links: Link[];
      /** PROPOSED (mock only): who was refused, for how much, and for which renewal. */
      agent?: AgentRef;
      attempted?: Money;
      renewalId?: string;
      errandId?: string;
    }
  | { type: 'order.updated'; order: Order }
  | { type: 'refund.requested'; orderId: string; amount: Money; reason: string; photoUrl?: string }
  | { type: 'refund.settled'; orderId: string; amount: Money; links: Link[] }
  | { type: 'renewal.created' | 'renewal.charged' | 'renewal.cancelled'; renewal: Renewal; links: Link[] }
  | { type: 'agent.permission'; agent: AgentRef; change: 'paused' | 'resumed' | 'revoked'; links: Link[] }
  | { type: 'cap.change.refused'; agent: AgentRef; attempted: Money; links: Link[] }
  | { type: 'arkiv.write'; kind: 'payment' | 'refund' | 'quote' | 'renewal'; links: Link[] }
  | { type: 'race.result'; question: string; plain: { reads: number }; graph: { reads: number }; sameAnswer: boolean }
  | { type: 'merchant.notification'; kind: 'new_order' | 'refund_request' | 'renewal'; orderId: string }
  | { type: 'error'; message: string; recoverable: boolean; retry?: 'sendPrompt'; errandId?: string }
  /** PROPOSED (mock only): the shared open/closed flag changed. */
  | { type: 'shop.status'; open: boolean }
  /** PROPOSED (mock only): the owner changed an agent's cap. */
  | { type: 'agent.cap.changed'; agent: AgentRef; cap: Money; links: Link[] }
  /** PROPOSED (mock only): Run next renewal now advanced the agent's daily pass period. */
  | { type: 'agent.pass.period'; agent: AgentRef; used: Money; expiresAt: number }
  /** PROPOSED (mock only): shop choices for the thread (C2). */
  | { type: 'shops.compared'; errandId?: string; choices: ShopChoice[] }
  /** PROPOSED (mock only): the demo was reset; reload the snapshot. */
  | { type: 'demo.reset' };

export type DemoEventType = DemoEvent['type'];
/** The event shape for one type, including members whose `type` is a union. */
export type EventOf<T extends DemoEventType> = DemoEvent extends infer E ? (E extends { type: infer U } ? (T extends U ? E : never) : never) : never;

export interface DemoAdapter {
  mode: 'mock' | 'live';
  getSnapshot(): Promise<DemoSnapshot>;
  subscribe(listener: (e: DemoEvent) => void): () => void;
  // customer
  sendPrompt(text: string): Promise<void>;
  reorder(orderId: string): Promise<void>;
  requestRefund(orderId: string, input: { amount: Money; reason: string; photo?: File }): Promise<void>;
  startRenewal(orderId: string, schedule: string): Promise<void>;
  cancelRenewal(renewalId: string): Promise<void>;
  pauseAgent(ens: string): Promise<void>;
  resumeAgent(ens: string): Promise<void>;
  revokeAgent(ens: string): Promise<void>;
  tryRaiseCap(ens: string, newCap: Money): Promise<void>;
  /** PROPOSED (mock only): the owner changes an agent's cap. */
  setCap?(ens: string, cap: Money): Promise<void>;
  // merchant
  setShopOpen(open: boolean): Promise<void>;
  dispatch(orderId: string): Promise<void>;
  approveRefund(orderId: string, amount: Money): Promise<void>;
  declineRefund(orderId: string, note: string): Promise<void>;
  exportCsv(range: { from: string; to: string }): Promise<Blob>;
  sendMerchantPrompt?(text: string): Promise<void>;
  /** PROPOSED (mock only): the merchant opened an order, which clears its "New" marker. */
  markOrderSeen?(orderId: string): Promise<void>;
  // demo controls (stage only)
  runNextRenewal(): Promise<void>;
  resetDemo(): Promise<void>;
}

/**
 * `startRenewal` takes the schedule as a string. The mock encodes a
 * RenewalSchedule as JSON in it, so the contract signature stays unchanged.
 */
export function encodeSchedule(s: RenewalSchedule): string {
  return JSON.stringify(s);
}

export function decodeSchedule(raw: string): RenewalSchedule | null {
  try {
    const v = JSON.parse(raw) as RenewalSchedule;
    return v && typeof v.frequency === 'string' && typeof v.startDate === 'string' ? v : null;
  } catch {
    return null;
  }
}
