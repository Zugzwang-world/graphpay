# SPEC: Identity on ENSv2 (Ethereum Sepolia)

Every actor is an ENS name under `graphpay.eth`. Agents are non-transferable, expiring subnames with their own resolver; the owner can pause or kill them; the payment gate reads registry state, never records alone. Proven in the lab on a Sepolia fork and then on real Sepolia (77 transactions, 68.4M gas, under a lab root). **Re-verify every address at 9 pm** (ENS redeployed Sepolia on 2026-09-15 and changed mainnet addresses several times in October).

## 1. Namespace

`ROOT` = `graphpay.eth`, one constant. The cast is one constant too (`SPEC/AGENTS.md` §1).

```text
RootRegistry
└─ eth                                  ETHRegistry
   └─ graphpay.eth                      token held by OPERATOR; subregistry = UR_root; resolver = R_root
      └─ UR_root (UserRegistry, parent = ETHRegistry / "graphpay")
         ├─ vitalik          human   owner VITALIK      ── concierge | scout | analyst | payer   (+ rehearsal, acceptance, disposable-<n>)
         ├─ kesar-kingdom    shop    owner SHOP_KESAR   ── storefront | risk | dispatch          (the good shop)
         ├─ jamun-junction   shop    owner SHOP_JAMUN   ── storefront | risk | dispatch          (the trap, 18.4% refunds)
         ├─ syrup-street     shop    owner SHOP_SYRUP   ── storefront | risk | dispatch          (the runner-up)
         └─ sim              RESERVED (owner 0); resolver R_sim holds the DEFAULT record (wildcard)
```

- 1 root, 4 owners, 13 cast agents, 1 reserved wildcard; plus two working agents that keep the stage payer's daily cap free (`rehearsal.vitalik` for the M3 part B lifecycle and rehearsals, `acceptance.vitalik` for the acceptance suite) and one `disposable-<n>.vitalik` per kill. Every owner and every agent has **its own PermissionedResolver instance**: a setter role on a shared resolver applies to every name on it.
- **Wallets:** each paying agent's address record and token holder is its own dedicated wallet (payer → PAYER, scout → DEAL_HUNTER, rehearsal → REHEARSAL_PAYER, acceptance → ACCEPTANCE_PAYER, disposable-<n> → a fresh DISPOSABLE_<n>), because the checkout binds one wallet to one node. Non-paying agents (concierge, analyst, the shop agents) are held by their owner's wallet and never get an AgentPolicy.
- `graphpay.kind` is `human`, `shop` or `agent`. Humans and shops are the same kind of node: an owner with its own UserRegistry.
- Find the registry holding `x.y.graphpay.eth` by walking chain state from RootRegistry (`getSubregistry(label)` per label), never from a directory.
- **State of `graphpay.eth` before the event:** registered bare on real Sepolia on 2026-11-04 by OPERATOR `0x531D49A595946a72b9C47b78D287Ff6e6B3CfF32`; resolver `0x0`, subregistry `0x0`, expiry 1825315020 (2027-11-04). No records, no registry. Everything under it is created at the event (ADR-0018). The registrar gave the owner SET_SUBREGISTRY(+admin), SET_RESOLVER(+admin) and CAN_TRANSFER_ADMIN on the token; no RENEW, no UNREGISTER.

## 2. Addresses (Ethereum Sepolia, ENSv2), re-verify at 9 pm

| contract | address |
|---|---|
| RootRegistry | `0xb458d6a3a77919449d03e7a6903c26827c1ec43f` |
| ETHRegistry | `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4` |
| ETHRegistrar | `0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3` |
| StandardRentPriceOracle | `0x8196665d4ca7488b6474a9ec8e7d2719fb42263a` |
| MockUSDC (6 decimals; `mint` is open to anyone) | `0x240b0316df57887dbbe58b586508b19e633a14aa` |
| VerifiableFactory | `0xda70306c98e97ece36f997a21368e53298572991` |
| UserRegistryImpl | `0x9bd8a88719068d09ecee662f36c0e3856708366a` |
| PermissionedResolverImpl | `0x115eb53f0c60696633855f90b138178fb40b2b2c` |
| UniversalResolverV2 | `0x24e1d8e068620b647ca097f961a61055f4f42d72` |
| **Universal Resolver entry point (proxy; use this one)** | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` |
| UniversalHelper | `0xd453e5bdb62cc3bea84341b1e306319c8ffd7dfe` |

Source: https://docs.ens.domains/learn/deployments/ ("Sepolia (ENSv2)"), matched on-chain on 2026-11-04. Load every address from one config file. Build an **address verifier** first: it fetches that page, checks code exists at each address and that the contracts point at each other (for example the ETHRegistrar's registry is the ETHRegistry), and exits non-zero on any change. ABIs: generate them from Sourcify (`GET https://sourcify.dev/server/v2/contract/11155111/<address>?fields=abi`); do not hand-write them. `@ensdomains/ensjs-abi` has only partial ABIs (latest 5.0.5; a "5.2.12" of that package does not exist).

## 3. Roles (exact bitmaps)

Registry roles: REGISTRAR `1<<0`, REGISTER_RESERVED `1<<4`, SET_PARENT `1<<8`, UNREGISTER `1<<12`, RENEW `1<<16`, SET_SUBREGISTRY `1<<20`, SET_RESOLVER `1<<24`, CAN_TRANSFER_ADMIN `(1<<28)<<128`. The admin of a role is the role `<<128`. A role on a registry's root resource applies to every label in it.
Resolver roles: SET_ADDRESS `1<<0`, SET_TEXT `1<<4`, SET_CONTENTHASH `1<<8`, SET_ABI `1<<12`, SET_INTERFACE `1<<16`, SET_NAME `1<<20`, SET_DATA `1<<24`, LINK `1<<28`, UPGRADE `1<<124`. `ALL_ROLES` = 64 nibbles of `1` (`0x1111…1111`).

| who | where | roles |
|---|---|---|
| OPERATOR (the provisioner) | UR_root root | REGISTRAR, RENEW, UNREGISTER, SET_PARENT, SET_RESOLVER, SET_SUBREGISTRY |
| OPERATOR | each owner registry root | **REGISTRAR only**: it cannot unregister, renew or re-point |
| OWNER (human or shop) | own registry root | RENEW(+admin), UNREGISTER(+admin), SET_PARENT, SET_SUBREGISTRY, SET_RESOLVER |
| OWNER | its own token in UR_root | SET_SUBREGISTRY, SET_RESOLVER, RENEW; **no** CAN_TRANSFER_ADMIN (non-transferable) |
| AGENT | its token in the owner registry | **0** (non-transferable, cannot renew, cannot re-point) |
| OWNER | every resolver of its names | `ALL_ROLES` |
| AGENT | its own resolver | only `setText("agent-endpoint[mcp]")`, granted by `grantSetterRoles` |

**Kill authority is the owner only** (verified: the operator and the agent both revert `EACUnauthorizedAccountRoles` on `unregister`).

## 4. Build order and exact calls

Signers: OPERATOR = GraphPay's provisioning key; OWNER(x) = that owner's key. Demo custody: the backend holds the owner keys; say so in the README (production would use the users' wallets or session keys). One numbered line is one transaction unless noted. Gas is from the lab fork.

**A. Root (graphpay.eth already registered bare)**
1. OPERATOR: `VerifiableFactory.deployProxy(PermissionedResolverImpl, salt_R_root, initialize([{OPERATOR, ALL_ROLES}], [seed calls]))` → R_root (about 1.14M gas).
2. OPERATOR: `ETHRegistry.setResolver(uint256(keccak256("graphpay")), R_root)`. *Untested on the bare name; the owner holds SET_RESOLVER from the registrar (verified from source). Rehearse on a fork first.*
3. OPERATOR: `deployProxy(UserRegistryImpl, salt_UR_root, initialize([{OPERATOR, operatorRootRoles}]))` → UR_root (about 1.0M gas).
4. OPERATOR: `ETHRegistry.setSubregistry(uint256(keccak256("graphpay")), UR_root)` (140k; verified on the lab root).
5. OPERATOR: `UR_root.setParent(ETHRegistry, "graphpay")` (252k).

(For reference only, a fresh root would need: `MockUSDC.mint` and `approve`; `getRegisterPrice` = 8,000,021 units a year; `makeCommitment(label, owner, secret, 0x0, resolver, duration, 0x0)`; `commit`; wait at least 60 s (max 86,400 s); `register(label, owner, secret, 0x0, resolver, duration, MockUSDC, 0x0)`; duration at least 28 days. The registrar charges `msg.sender`; the commitment binds the resolver, so deploy the resolver before `commit`.)

**B. Each owner O in {vitalik, kesar-kingdom, jamun-junction, syrup-street}**
1. OPERATOR: `deployProxy(UserRegistryImpl, …, initialize([{O, ownerRegistryRoot}, {OPERATOR, REGISTRAR}]))` → UR_O.
2. OPERATOR: `deployProxy(PermissionedResolverImpl, …, initialize([{O, ALL_ROLES}], calls))` → R_O. Seed `graphpay.kind`, `graphpay.status`, `agent-context`; shops also seed the Whitechain address and `payment-preference` (§5).
3. OPERATOR: `UR_root.register(label, O, UR_O, R_O, NAME_OWNER_TOKEN_ROLES, expiry)`. The subregistry is passed here, so no separate `setSubregistry`.
4. O: `UR_O.setParent(UR_root, label)`.

**C. Each agent: `provisionAgent` (3 transactions)**
1. OPERATOR: `deployProxy(PermissionedResolverImpl, salt(node), initialize([{O, ALL_ROLES}], [seed]))` → R_agent. Seed: `graphpay.status=active`, `graphpay.cap_micro=<decimal>`, `graphpay.principal`, `graphpay.kind=agent`, `agent-context`, `agent-endpoint[mcp]`, `addr(60)` and `addr(2147485522)` = the agent's address. Records go in the deploy transaction because `initialize` skips role checks (about 1.5–3.0M gas).
2. OPERATOR: `UR_O.register(label, AGENT, 0x0, R_agent, 0, expiry)` (0.27–0.39M). Role bitmap `0` = non-transferable.
3. O: `R_agent.grantSetterRoles(<encoded setText(0x, "agent-endpoint[mcp]", "")>, AGENT)` (258k). The argument is an encoded setter call; only its selector and key are used.
4. Read back `UR_O.getState(uint256(keccak256(label)))` for `epoch` and `expiry`; hand them to the payments track's setup script, which creates the AgentPolicy for **paying agents only** from its configured list (`SPEC/PAYMENTS_WHITECHAIN.md` §3.4 `setPolicy`), and to the Arkiv node.

Signature: `provisionAgent(owner: string, role: string, ttlSec: number, capMicro: bigint, opts?: { agentAddr?, mcpUrl?, a2aUrl? }) → { name, node, epoch, resolver, registry, expiry, agentAddr, txs[] }`. It reads the owner's registry and on-chain address from chain state and refuses a signer that is not the on-chain owner. The 3 transactions are not atomic: a failure after step 1 leaves an orphan resolver that already says `active`; the salt is deterministic, so retry rather than redeploy under a new name. **A label's resolver address is deterministic, so a killed label cannot be provisioned again: use a fresh label (`disposable-2`, `disposable-3`…) for every kill rehearsal.**

**D. The synthetic wildcard**
1. OPERATOR: `deployProxy(PermissionedResolverImpl, …, initialize([{OPERATOR, ALL_ROLES}], [setText(0x00, "graphpay.synthetic", "true"), setText(0x00, "graphpay.kind", "agent"), setText(0x00, "agent-context", "synthetic agent, unverified")]))` → R_sim. Setter name `0x00` (the root name) is the **default record**.
2. OPERATOR: `UR_root.register("sim", address(0), 0x0, R_sim, 0, farExpiry)`. Owner `0` makes a RESERVED entry; the role bitmap must be 0 and the expiry non-zero.
3. Every `anything.sim.graphpay.eth` (and `a.b.sim.graphpay.eth`) now resolves with no transaction. **Never put `graphpay.status` or a cap in a default record.**

Cost: the full lab namespace was 63 transactions and 62.2M gas on a fork (5–45 s); 77 transactions and 68.4M gas on real Sepolia at about 19 wei gas price (about 1e-9 ETH in total, 2026-11-04). On real Sepolia each transaction waits a block (about 12 s): budget about 15–20 minutes of block waits for about 80 transactions. Multicall batching of resolver deploys is untested.

## 5. Records

| key | type | value | written by |
|---|---|---|---|
| `agent-context` (ENSIP-26) | text | one line of markdown, includes "synthetic demo cast" | owner (seeded) |
| `agent-endpoint[mcp]` (ENSIP-26) | text | URL of the MCP endpoint | **the agent itself** (scoped setter) |
| `agent-endpoint[a2a]` (ENSIP-26) | text | `…/.well-known/agent-card.json` (shop storefronts) | owner (seeded) |
| `graphpay.status` | text | `active` or `paused` | owner only |
| `graphpay.cap_micro` | text | decimal string of micro-USDT, never a float | owner only |
| `graphpay.principal` | text | the owner's ENS name | owner (seeded) |
| `graphpay.kind` | text | `human`, `shop`, `agent` | owner (seeded) |
| `graphpay.synthetic` | text | `true`, only in the `sim` default record | operator |
| address, coin type `2147485522` (`0x80000000 | 1874`) | addr | the payee on Whitechain Sepolia (shop treasury or agent wallet) | owner (seeded) |
| `payment-preference` (ENSIP-31 draft) | data (ENSIP-24 `setData`) | ERC-7930 list | shop owner |

- Write: `setText(bytes dnsName, string key, string value)`, `setAddress(bytes dnsName, uint256 coinType, bytes address)` (an EVM coin type needs exactly 20 bytes), `setData(bytes dnsName, string key, bytes value)`.
- Read: through the Universal Resolver proxy, `resolve(dnsName, <encoded text/addr/data call>)`. Stock viem 2.57.16 `getEnsText` and `getEnsAddress({ coinType })` work unchanged against ENSv2, including wildcard names. viem has no ENSIP-24 data action: call `resolve` directly.
- **ENSIP-31 `payment-preference`:** concatenated ERC-7930 interoperable addresses, no delimiter: `0x0001 | chainType 0x0000 (eip155) | refLen | ref (minimal big-endian chain id) | addrLen | address`. Earlier entries for the same asset win. If **any** entry is malformed, ignore the whole record and fall back to the default. Test USDT on Whitechain Sepolia: `0x0001000002075214cedfb56113143d55b2358b8cfbb0deb5ad2f55a7` (**28 bytes**, not 29). The draft's own vectors (USDC on Ethereum 27 bytes, on Base 28, native ETH 7, 62 concatenated) reproduce byte for byte. Pin "ENSIP-31 draft as of 2026-11-03" in the README; the draft changed in October (re-verify at 9 pm).
- Payer helper signature: `pickPaymentPreference(record: Hex, held: { chainId: number; token: Address }[]) → { chainId, token } | undefined`. Match chain **and** token.

## 6. Kill switch: what each primitive really does (measured)

| action | `getState` after | `getResolver` | Universal Resolver then | records read | gate | reversible |
|---|---|---|---|---|---|---|
| owner `unregister` (163k gas) | AVAILABLE, token burned | `0x0` | the **parent's** resolver answers | **empty strings, not an error** | `ENS_EXPIRED_OR_REVOKED` | only as a new registration (new epoch) |
| short expiry elapses (no tx, no event) | AVAILABLE | `0x0` | parent's | empty | `ENS_EXPIRED_OR_REVOKED` | yes: `renew()` revives the same owner, token and epoch |
| `graphpay.status=paused` by the owner | REGISTERED | unchanged | own resolver | `paused` | `ENS_PAUSED` | yes, instantly |
| the parent name lapses | agent still REGISTERED | still set | an ancestor's resolver | empty | `ENS_ANCESTOR_INACTIVE` | when the parent is renewed |
| role change on the agent token | REGISTERED | unchanged | own resolver | unchanged | ok | n/a (epoch unchanged, token id regenerated) |

Three traps, all real:
1. **Empty is not an error.** Never infer liveness from resolution; check `getState`.
2. **`renew()` after `unregister` resurrects the records**: the label becomes RESERVED, the old resolver answers again and says `active`. The gate must require REGISTERED. While RESERVED, the operator cannot re-register it.
3. **A default record on a parent resolver leaks** onto every killed child. No `graphpay.*` in any default record; the gate rejects any name whose resolution did not come from its own resolver at offset 0.

Kill ladder for the demo: **pause** = `graphpay.status=paused` (the website's "pause my agent" button; reversible); **kill** = owner `unregister` (one-shot per label; use a disposable agent); **lapse** = short expiry.

## 7. The payment gate

Signature: `ensGate(name: string, amountMicro: bigint) → Promise<{ ok: true, node, epoch, expiry, capMicro, checks: { epoch, tally, policyCap } } | { ok: false, reason: GateReason, node?, epoch?, detail? }>`.
Injected dependencies: `expectedEpoch(node)`, `policyCapMicro(node, epoch)` (from the AgentPolicy on Whitechain), `spentToday(node, epoch)` (from Arkiv tallies or the contract's `spentToday`).

Algorithm (fail closed; never throw into the payment path):
0. `amountMicro <= 0` → `AMOUNT_INVALID`. Any exception reading the chain → `ENS_READ_FAILED`.
1. ENSIP-15 normalise, namehash, labels root first. Invalid → `ENS_NAME_INVALID`. **The name comes from the request: pin the namespace** with `allowedRoots: ['graphpay.eth']`; a name outside it → `ENS_ROOT_NOT_ALLOWED`. Without the pin, any `x.evil.eth` with a factory-proxy resolver passes every check.
2. `now` = the latest block timestamp (not wall-clock).
3. Walk from RootRegistry. For each label: `getState(uint256(keccak256(label)))` must be REGISTERED with `expiry > now` (check expiry yourself), then `getSubregistry(label)`. **Every ancestor, not only the leaf.** A RESERVED ancestor (`sim`) is the wildcard: `graphpay.synthetic=true` → `ENS_SYNTHETIC`, else `ENS_NOT_FOUND`. A never-registered leaf (expiry 0) → `ENS_NOT_FOUND`; otherwise `ENS_EXPIRED_OR_REVOKED` (includes a RESERVED leaf). A dead ancestor → `ENS_ANCESTOR_INACTIVE`.
4. `epoch` = the low 32 bits of the leaf's `resource`. With an expected epoch: none → `ENS_NO_POLICY`, different → `ENS_EPOCH_MISMATCH`.
5. `findResolver(dns)` must return offset 0 and the same address as the parent registry's `getResolver(label)`, and `VerifiableFactory.verifyContract(resolver)` must confirm a PermissionedResolver proxy; else `ENS_RESOLVER_MISMATCH`.
6. Read `graphpay.status` and `graphpay.cap_micro`. Not exactly `active` → `ENS_PAUSED`; cap not `^\d+$` → `ENS_RECORD_INVALID`.
7. **The ENS cap is writable by the owner, so it is not an authority.** Enforce `min(ENS cap, AgentPolicy cap)`; no policy → `ENS_NO_POLICY`.
8. `spentToday + amount > cap` → `CAP_EXCEEDED`.
9. Else ok. `checks` says which optional checks ran; a facilitator that needs them refuses a result where they are false.

Reasons (these are also the reason codes of off-chain refusal records on Arkiv): `AMOUNT_INVALID`, `ENS_READ_FAILED`, `ENS_NAME_INVALID`, `ENS_ROOT_NOT_ALLOWED`, `ENS_NOT_FOUND`, `ENS_EXPIRED_OR_REVOKED`, `ENS_ANCESTOR_INACTIVE`, `ENS_EPOCH_MISMATCH`, `ENS_NO_POLICY`, `ENS_RESOLVER_MISMATCH`, `ENS_PAUSED`, `ENS_SYNTHETIC`, `ENS_RECORD_INVALID`, `CAP_EXCEEDED`.

**Cost and cache.** A 4-label name costs 12 contract reads plus 1 block read: 1.2–2.3 s on the public Sepolia RPC (measured). Cache per name for **20 s** (the same value everywhere), keyed by the **exact spelling** after normalisation (a look-alike spelling poisoned the real entry in a lab draft), stamped before the reads; invalidate from the watcher. A pause or kill therefore bites within 20 s **after its Sepolia transaction confirms** (one Sepolia block, about 12–14 s, after sending): fill that time on screen. Tests allow 25 s from the receipt for RPC lag. Multicall3 batching is untested. The verdict can be stale by settlement time, so the contract must enforce expiry and revocation itself.

## 8. Watcher and the AgentPolicy mirror

Registry events: `LabelRegistered(tokenId*, labelHash*, label, owner, expiry, sender*)` (carries the label string), `LabelUnregistered(tokenId*, sender*)`, `ExpiryUpdated(tokenId*, newExpiry*, sender*)`, `SubregistryUpdated`, `ResolverUpdated`, `ParentUpdated`, `TokenRegenerated(old*, new*)`, `TokenResource(tokenId*, resource*)`, `EACRolesChanged`. Resolver: `TextUpdated(recordId, key, key, value)`, `DataUpdated`, `AddressUpdated`, `Linked(recordId, node, name)`, `Cleared`. (`*` = indexed.)

- Key tracked names by the canonical id `tokenId ^ (tokenId & 0xffffffff)`: the low 32 bits change on role changes.
**The watcher never creates a policy and never copies the ENS cap into one.** Policies (wallet and cap) come from the payments setup script's configured list; the ENS cap is owner-writable and not an authority (the gate already enforces the lower of the two). The watcher only keeps existing policies and the Arkiv nodes in step with ENS state (status, epoch, expiry). It runs inside the single long-lived workers process with the mirror (`SPEC/INTEGRATION_AND_MIRROR.md` §1), not on Vercel cron (cron runs at most once a minute).

- `LabelRegistered`: take the epoch from the `TokenResource` event of the **same transaction**; patch the Arkiv node (`epoch`, `status=active`); if the name has a configured policy, `setPolicy(node, epoch, <configured wallet>, revoked=false, <configured cap>, expiry)`. A re-registration is a **new epoch**: fresh tallies, the old epoch's history stays ("previous holder").
- `LabelUnregistered`: if a policy exists, `setPolicy(node, <the stored live epoch>, <its wallet>, revoked=true, 0, 0)`; node `status=revoked`. Use the epoch you stored: views already show +1 or +2.
- `ExpiryUpdated` (a `renew`): **re-read `getState`**; un-revoke only if REGISTERED with the stored epoch. `renew()` on an unregistered label also emits this and leaves it RESERVED; un-revoking on the event alone re-activates a killed agent.
- `TextUpdated` on `graphpay.status`: patch the node's status (`paused` or `active`); the gate already refuses a paused name. `graphpay.cap_micro` changes are shown on the node, never written into the policy.
- **A time lapse emits nothing**: a ticker (every 30 s, in the workers process) compares the mirrored expiry with chain time and marks `expired`. The contract also checks expiry itself.
- Mark revoked or expired only after the sink call succeeded; serialise log batches through one queue; keep a checkpoint shared by backfill and live watching.
- Sink interface: `updatePolicy({ node, epoch, revoked, expiry })` (wallet and cap from the configured list; no-op when the name has no policy) and `patchNode(node, { status, expiry, epoch })`.

## 9. Epoch rules (`ens_epoch`, a uint32)

- Identity = (namehash, epoch). Every edge, order, tally and policy carries the epoch. Identity key: `keccak256(abi.encode(bytes32 node, uint32 epoch))`.
- **Read the epoch only while the label is REGISTERED.** For an AVAILABLE name `resource` is "the next version": right after a lapse (+1), **wrong by one after an `unregister`** (shows +2; the next registration gets +1).
- Changes on: re-registration after a lapse; `unregister`. Does **not** change on: role changes (the token id does), `renew()` revival after a lapse.
- **Fresh ENSv2 names are epoch 0.** (A lab writer numbered from 1 and was wrong.)
- Pitch line: an owner who renews a lapsed agent keeps its reputation; one who unregisters and re-registers starts from an empty tally.

## 10. Pitfalls

1. `getState` and registry setters take `uint256(keccak256(label))`; ERC-1155 transfers need the **versioned** token id from `getState`.
2. Transfers fail two different ways: `safeTransferFrom` → `TransferUnsafeUntilRegistryIsEmancipated`; `unsafeTransfer` → `TransferDisallowed`. Test both.
3. The public Sepolia RPC is load balanced: a read seconds after a write can be a block behind. Re-read before trusting "still available" or "not yet set".
4. Chain time on a fork: after `evm_increaseTime`, mine a block; use block timestamps.
5. anvil disables its on-disk RPC cache for a loopback fork URL; pass the public endpoint directly. Route a keyed upstream through a read-only local forwarder so the key never lands in argv or logs.
6. viem error messages contain the RPC URL. If the URL carries a key, redact in the transport wrapper.
7. The ENS docs disagree about mainnet ENSv2. Stay on Sepolia and do not claim mainnet.
8. The kill is one-shot per label (deterministic resolver). Make every run idempotent ("killed earlier" is a pass for the refusal check).

## 11. Not built in the lab

ERC-8004 registration and ENSIP-25 `agent-registration[registry][agentId]` (the Sepolia singletons `0x8004A818BFB912233c491871b3d84c89A494BD9e` and `0x8004B663056A597Dffe9eCcC1965A193B7388713` have code; implementation unchecked), CCIP-Read, reverse names, the `linkToNode` rename alias. Stretch only.
