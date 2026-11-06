# Relay: w1-identity (W1 Identity), 00:00 IST, Sat 7 Nov

## In plain words

- W1 gives the dosa story's shops their own names on ENS, flips the story to them, and makes the kill work live.
- **Done: the new shop names are on ENS** (#158): `filter-and-fold.graphpay.eth`, `idli-index.graphpay.eth` and `tawa-tangle.graphpay.eth`, each with its three agents.
  - Each pays into the wallet its old shop used, so no money moved.
  - The old names stay registered as history.
- **Ready, not pushed: the story flip.** Three label lines in `story.json`, plus one phones test that replays a Nov 5 errand under the new names. It waits for the Coordinator's go, after W2 has written the new shops' Arkiv rows. Then W5 restarts the workers.
- **The kill: built, in its PR.**
  - **A spare is ready:** `disposable-2.vitalik.graphpay.eth` has its name, a spending pass of 1.00 a day and 1 test USDT.
  - The site holds the keys of the spares `disposable-2` to `disposable-9` (in Vercel, never printed). They take effect from the next deploy.
  - **The Kill button's route** makes the owner unregister the spare's name. The watcher then revokes its pass, and the spare's next payment is refused and recorded on Arkiv.
  - **After each kill,** the workers make a fresh spare: a name, a pass and 1 test USDT. That needs a workers restart once the PR is in.
- **Still to prove:** one kill on the production site, followed by a refused payment and a fresh spare.

## Technical

- **The spare keeper** is `scripts/ens/spare.mjs`: a dry run by default, `--yes` to send, and one run at a time (a lock file). It works in three steps:
  1. It takes the lowest live `disposable-<n>` among the keys in `.env`. If none is live, it provisions the next label that was never registered, never a killed one. OPERATOR deploys the resolver and registers the label; the owner, VITALIK, signs the two setter grants.
  2. POLICY_WRITER calls `setPolicy`, from the payments setup's plan (`scripts/whitechain/plan.mjs`). It never lifts a revocation, and stops if the wallet is bound to another node.
  3. FUNDER tops the wallet up to the story's disposable cap. It keeps 10 test USDT in reserve, and the receipt must show exactly that transfer.
  - For `disposable-2`: Sepolia [0xeea8…16b9](https://sepolia.etherscan.io/tx/0xeea817653bc0f30628c840fb9e265810e1786c4580a75853c9fc7585137216b9), [0x4d82…ab43](https://sepolia.etherscan.io/tx/0x4d82116c0a356789652cf33ed5c5f55f7ec5e342a293d5280fef546deca1ab43), [0xace7…67e5](https://sepolia.etherscan.io/tx/0xace7d1b80334a76c1d0ead5c0fefe070f995c2f3e9a8131680e0552688f767e5).
  - Its policy: [0xbe08…604c](https://explorer.testnet.whitechain.io/tx/0xbe08647b142b7c49523c6d8f5376c345c491fd90de6c79a062238a34a112604c). Its 1 test USDT: [0x1fd6…35e5](https://explorer.testnet.whitechain.io/tx/0x1fd6f43462497fa5409c296fb6752fdf1c68faaf9d7433fb34c720aedeab35e5).
  - `scripts/ens/gate-pass.mjs` shows its full gate ok.
- **The route** is `POST /api/customer/kill-disposable` (`apps/web/lib/kill-disposable.server.ts`).
  - **The spare it takes:** chosen from chain state, never from the request. It must be live, held by its own key, and have a live pass at its epoch. A spare whose pass isn't set yet is never offered, because the watcher would then find nothing to revoke (the reviewer's one blocking finding, fixed).
  - **The kill:** the owner unregisters the name, in the owner's queue that Pause and Resume use.
  - **The revoke:** it waits up to 75 s for the watcher's `AgentPolicySet` with `revoked`.
  - **The payment:** at least 21 s after the kill, past the gate's 20 s cache, the spare signs one payment for the cheapest item within its cap (none fits: no kill). Re-order's rules read the answer: refused, paid, unknown or not sent.
  - **The record:** a 402 refusal's `fail` edge is read back from GraphQL `order(id)` by its ref.
  - **Partial results:** a step that fails after the kill is named in `incomplete`, and the kill hash stays in the answer.
  - `GET` names the ready spare and the site's key pool. The route is listed in OPEN under "frontend".
- **The keeper's guards:**
  - It re-reads the name before setting the pass, and again before the top-up.
  - If the name was killed while its pass was being set, it revokes that pass itself.
  - It provisions only a label whose key the site holds.
  - A failed run is retried after 2 minutes; exit 2, a missing key, waits for a person.
  - A lock whose process has died is taken over.
- **The workers:** `packages/mirror/src/ens.mjs` runs the keeper as a child process. It runs once at the watcher's start, and again after each `onRevoked` of a disposable name (a new watcher hook in `packages/ens`). `SPARE_KEEPER=0` turns it off.
- **The flip** is ready on branch `claude/w1-flip`. With it, the whole suite passes: 214 web and phones tests, and every package.

## State

- **Running:** this session, `local_45f7cf5d-c31e-4dbf-b849-466f3067bdd3` (brief `briefs/2302-w1-identity.md`).
- **Blockers:** none.
- **Waiting on:** the Coordinator's go for the flip, and W5's workers restart after the kill PR.
