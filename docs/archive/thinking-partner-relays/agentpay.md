# Relay: agentpay (T6 AgentPay), 22:30 IST, Fri 6 Nov

## In plain words

- `@graphpay_ethglobal/agentpay` lets any business take payments from AI agents in test USDT on Whitechain Sepolia. An agent pays with one signature and no gas, under a spending pass held on the chain.
- Version 0.1.1 is on npm: https://www.npmjs.com/package/@graphpay_ethglobal/agentpay
- A developer can try it in five minutes: install, paste the README's example and run. It starts a local copy of Whitechain, makes a shop and an agent, and pays. Two examples ship: a sweet shop and a fixed-fare cab ride.
- Our deployed checkout lets only our own relayers settle, by design. On the real testnet a developer deploys their own checkout and runs their own relayer.
- The SDK has no UI. The demo app is the reference, and a React kit comes after the event (ADR-0076).
- No feedback has arrived: the repo has no issues yet.

## Technical

- V1: [#38](https://github.com/Zugzwang-world/graphpay/pull/38). The first real test payment (0.01 test USDT): [#41](https://github.com/Zugzwang-world/graphpay/pull/41). Through T1's facilitator on a fork (A4): [#47](https://github.com/Zugzwang-world/graphpay/pull/47). Log reads that fit the public RPCs' block-range caps: [#64](https://github.com/Zugzwang-world/graphpay/pull/64).
- npm: [#71](https://github.com/Zugzwang-world/graphpay/pull/71) (the brief), [#80](https://github.com/Zugzwang-world/graphpay/pull/80) (0.1.0), [#99](https://github.com/Zugzwang-world/graphpay/pull/99) (0.1.1: the published manifest drops the workspace devDependencies).
- Safety: chain 1874 only, checked before every signature and send; no hosted facilitator or relayer by default; the relayer's anti-drain limits cannot be switched off; a test fails the build if the package imports our Arkiv, ENS or money-graph code.
- T5's checkout kit uses the public exports; T6 keeps them stable.
- Feedback: GitHub issues labelled `agentpay` and `feedback`, logged in `packages/agentpay/FEEDBACK.md`.
- Open:
  - the README does not link the demo app yet (ADR-0076);
  - the Whitechain sponsor file links the package (Submission);
  - versions freeze from submission until judging ends.

## State

- **Idle.** Session `local_be1a1d1c-53bd-4570-b242-09a41617ce01`.
- Resume file: `docs/sessions/agentpay/resume.md` (11:09 IST).
- Next step: the README's link to the demo app; any venue feedback becomes a 0.1.x fix before the freeze.
