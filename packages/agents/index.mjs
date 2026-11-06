// @graphpay/agents: the buyer team (concierge, scout, analyst, payer) and the shop
// team (storefront, risk, dispatch) on AI SDK 7, with every guard in code
// (ADR-0019). Live services reach it only through interfaces (index.d.ts):
// LiveHooks, McpLike, ShopSurface; the mocks are in ./mocks.

export { createActivity, PRESENCE_RENEW_MS, STEPS } from './src/activity.mjs';
export { runAgent, MAX_STEPS } from './src/agents.mjs';
export { offerFor, runBuyerTeam } from './src/buyer.mjs';
export { ROOT, SHOP_ROLES, teamCast } from './src/cast.mjs';
export { Mandate, NEEDS, NeedProposal, NeedSpec, OUTPUTS, Quote, RankedShop, Receipt, ROLES, ShopTally, AgentStanding } from './src/contracts.mjs';
export { runErrand } from './src/errand.mjs';
export { parseBuyerRisk, RANKING_QUERY, readBuyerStanding, readRanking } from './src/graph.mjs';
export { adoptNeed, mandateHash, needFromRequest, parseMandate, todayAt } from './src/mandate.mjs';
export { AGENT_MODES, createMeter, createModelFactory, finalTextBlockOnly, resolveAgentMode } from './src/models.mjs';
export { displayUsdt, fromMicro, isUsdt, microFrom, toMicro } from './src/money.mjs';
export { createPayer, explorerTx, knownContracts, PAYMENT_ASSET, PAYMENT_NETWORK, presignCheck } from './src/payer.mjs';
export { promptFor, TAIL } from './src/prompts.mjs';
export { createRunLog, RUN_SCHEMA } from './src/runlog.mjs';
export { BUYER_POLICY, buyerRiskReasons, eligibilityReasons, rankShops, scoreShop, SHOP_POLICY, talliesFromNodes, volumeReference } from './src/scoring.mjs';
export { createScrubber, scrubDeep } from './src/scrub.mjs';
export { usageOf, usageTable } from './src/usage.mjs';
export { createShopGateway } from './src/shop.mjs';
export { createRunState, payGuard } from './src/state.mjs';
export { base64JsonCodec, checkPaymentRequired, header, interpretSettlement, onStorefront } from './src/x402.mjs';
