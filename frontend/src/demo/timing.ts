/**
 * Every mock delay in one place (DESIGN_INSTRUCTIONS.md 13): realistic pauses
 * of a few hundred milliseconds to a few seconds. Agents think 1–3 s, a
 * payment settles in 2–4 s (FRONTEND_HANDOVER.md 7).
 */
export const timing = {
  /** Between one agent message and the next agent starting. */
  handoff: 500,
  conciergeThink: 1200,
  scoutThink: 1800,
  graphRead: 900,
  analystThink: 1600,
  riskCheck: 1100,
  payerThink: 1000,
  /** From quote to the payer's signature. */
  sign: 1400,
  /** From signature to settlement on Whitechain. */
  settle: 2600,
  /** An ENS write (pause, resume, revoke, cap change). */
  ensWrite: 1200,
  capRefusal: 1400,
  dispatch: 900,
  /** Delivered follows Dispatched by itself (there is no Mark delivered button). */
  deliveredAfter: 6000,
  refundRequest: 700,
  refundAccept: 800,
  refundSettle: 2400,
  refundDecline: 700,
  renewalCreate: 900,
  renewalCharge: 2200,
  /** Between retried renewal charges when the shop opens. */
  renewalRetryGap: 1200,
  shopToggle: 300,
  exportBuild: 700,
  markSeen: 0,
} as const;

export type TimingKey = keyof typeof timing;

/** The quote validity window (story data has the minutes; this is the fallback). */
export const QUOTE_VALIDITY_MS = 15 * 60_000;
