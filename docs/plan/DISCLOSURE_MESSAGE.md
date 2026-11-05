# Pre-event disclosure (paste-ready for ETHGlobal)

For the founder: paste this into the Hacker Dashboard or send it to an organiser. It is the written disclosure the rules ask for (`planning/DISCLOSURE.md`).

---

Hi ETHGlobal team, this is the written disclosure of pre-event work for our project **GraphPay** (public repo: https://github.com/Zugzwang-world/graphpay).

**How this was built:** before the hackathon we did research and built throwaway prototypes in a separate private lab repo to test our assumptions (for example how Arkiv handles repeated writes, and how ENSv2 behaves when an agent's name is revoked). We brought only knowledge to the event: research notes, written specs, verified facts, decisions, prompts and acceptance tests, all in `planning/`. **All code in this repo was written during the hackathon**, by us with Claude Code; see `AI_USAGE.md`. Pre-event items we reused, all disclosed here: two testnet wallets (a funding wallet holding faucet tokens, and the wallet that owns the ENS name), two credentials (an Arkiv access key and an Anthropic API key; no code), and the bare ENS name `graphpay.eth`, registered on Sepolia before the event with no records or subnames. Every other wallet was created at the event.

| item | before the event | at the event |
|---|---|---|
| research | three research reports on Arkiv, Whitechain + x402, and ENSv2 | read as background |
| lab prototypes | a private lab repo with throwaway prototypes and experiments on testnets | not copied, not merged, not referenced from the event code |
| knowledge pack | specs, verified facts, decisions, acceptance tests, prompts, pitfalls | committed unchanged as `planning/` in the first commit; no code |
| testnet wallets | lab wallets funded with test tokens; spare tokens swept into the funding wallet | two reused (the funding wallet and the ENS-name owner); every other wallet is new |
| `graphpay.eth` | registered bare on Ethereum Sepolia on 2026-11-04 | resolver, registries, owners and agents created at the event |
| lab contracts and Arkiv data | a stand-in token and a checkout on Whitechain Sepolia; two synthetic cities on Arkiv | not used; the event deploys and seeds its own |
| the pitch deck brief | a written brief | the deck and the website are built at the event |

Three questions, if you can answer them in writing:
1. Our specs, prompts and a written website design were prepared before the event; no code. Is that allowed on the Classic track if it is committed and disclosed, or does the written design count as a barred "design"?
2. We reuse two testnet wallets, an Arkiv access key and a bare ENS name registered before the event. Is this written disclosure enough?
3. Is the first commit (the planning pack, docs only) a problem under the commit-history rule?

Optional: at kickoff an organiser told us we may use AI as fully as we like, with full disclosure. Could you confirm that in writing?

Thank you!
