# Agentic payments landscape

Research window: 1 May–6 November 2026. Checked 6 November 2026 (IST). Each entry is a one-line summary followed by its date and source. Undated specifications are technical background, not dated market announcements.

- **x402:** Standardized payment requirements, signed payloads, verification and settlement for paid resources; client budget management is outside the opened v2 core specification. Date: undated live document, accessed 2026-11-06; in-window publication **UNVERIFIED**. [x402 v2 specification](https://raw.githubusercontent.com/x402-foundation/x402/main/specs/x402-specification-v2.md).
- **AP2:** User-authorized agent purchases use mandates; Google's v0.2 announcement adds pre-authorized Human Not Present transactions and says AP2 is being donated to FIDO. Publication: 2026-04-28, **OUTSIDE WINDOW**; background only. [Google AP2 announcement](https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/).
- **A2A x402 extension:** Payment state and payloads can travel in A2A messages, either standalone or nested within higher-level AP2 mandates; this is composability, not competing settlement rails. Date: undated v0.2 specification, accessed 2026-11-06; in-window publication **UNVERIFIED**. [A2A x402 extension](https://raw.githubusercontent.com/google-agentic-commerce/a2a-x402/main/spec/v0.2/spec.md).
- **ERC-8004:** The draft defines agent identity, reputation and validation registries; a registered identity is not a guarantee of honest service or payment authorization. Created: 2025-08-13, **OUTSIDE WINDOW**; live draft checked 2026-11-06. [ERC-8004 draft](https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-8004.md).
- **ENS for agents:** Resolvable names and registry associations add human-readable identity and discovery to agent infrastructure. Publication: 2026-05-15, **IN WINDOW**. [ENS DAO Newsletter 112](https://discuss.ens.domains/t/ens-dao-newsletter-112-5-15-2026/22128).
- **Fireblocks agentic payment infrastructure:** Wallet and policy infrastructure addresses authorization and financial risk before settlement rather than treating protocol compatibility as sufficient control. Publication: 2026-11-03, **IN WINDOW**. [Fireblocks analysis](https://www.fireblocks.com/blog/agent-economy-numbers-x402-data).
- **Microsoft Agent 365:** Enterprise agent registration and management shows the identity/governance side of deployment, not a cryptocurrency payment rail. Publication: 2026-11-03, **IN WINDOW**. [Microsoft Agent 365 update](https://www.microsoft.com/en-us/security/blog/2026/11/03/microsoft-named-a-leader-in-the-2026-gartner-magic-quadrant-for-ai-agent-management-platforms/).

## Where GraphPay fits

**Product positioning derived from the supplied synthetic demo brief, not an externally verified deployment:** GraphPay combines ENS names, an Arkiv payment-history model, Whitechain test-asset settlement and Swarm public files into a shop-payment workflow with selection, limits, refunds, repeat orders and agent lifecycle controls.

Position it as an application and SDK demonstration, not as a replacement for x402, AP2 or ERC-8004. The open specifications explain how these layers can coexist; this research does not establish that GraphPay implements any of those three protocols. Any interoperability or compliance claim is **UNVERIFIED** without the corresponding integration and tests.

## Safe contrasts

- Identity binds a name or registration to an actor; it does not prove the actor will deliver.
- A payment protocol moves authorization and settlement messages; it does not automatically enforce the user's daily budget.
- An audit trail supports verification of recorded events; it does not make synthetic performance numbers independent evidence.
- Read counts are not latency measurements. “2 reads against about 48” remains a demo-specific, unverified comparison until reproduced.

## Window gap

AP2's opened announcement and the creation dates of ERC-8004 and ENSIP-25 precede May. They are included only to explain the requested landscape. Current specification content was checked, but this research did not establish immutable in-window revisions. Do not move those announcements into May or label a mutable main-branch document an archived November snapshot.
