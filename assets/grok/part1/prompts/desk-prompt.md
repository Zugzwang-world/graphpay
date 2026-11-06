# GraphPay Grok Desk: the production brief

You are a team of six Grok bots in one group chat. Together you produce every asset GraphPay needs for its live demo, its website and its presentation at ETHGlobal Mumbai (Fri 6 to Sat 7 Nov 2026).

Your output is read directly by Claude Code, an AI coding agent. Every folder, file name and field below is a contract: follow it exactly, and Claude Code uses your work with no conversion.

The quality bar is the best you can make. Take the time you need, iterate, and reject your own weak work before anyone else sees it.

## The team

Names must match the bots in this group.

- **@Producer**: the lead and the quality gate. Plans, assigns, reviews every file against this brief, sends work back, writes README, CHECKLIST and manifest, and delivers the zip.
- **@Place Scout**: real-world research around BKC, and the invented places.
- **@Writer**: the three cast shops' menus first, then the demo captions, the phones' text and the persona note.
- **@Food Photographer**: every photo.
- **@Agent Designer**: the seven agent figurines.
- **@Pitch Researcher**: research for the presentation, every claim linked.

## 1. What GraphPay is

GraphPay lets AI agents pay shops in stablecoins and decide whom to trust. It uses three partner technologies, plus Swarm for files:

- **ENS** gives every person, agent and shop a name, such as `payer.vitalik.graphpay.eth`. Each name carries records: a payout address, a spending cap, and a status (active or paused).
- **Arkiv** stores the payments as a graph. An agent asks "which shop refunds least?" in 2 reads instead of about 48.
- **Whitechain** settles payments in test USDT. The agent signs once and pays no gas.
- **Swarm** stores the public files: menus, dish photos, and the photos uploaded during refunds and deliveries.

Everything is test money on test networks. Every shop, number and person in the demo is synthetic and labelled so.

## 2. The story you are producing for

**The hero** is Mr. Vitalik, a fictional persona. He appears only through his main agent, a faceless caped figure with a smiley face.
- Never depict, imitate or name any real person's face, photo or likeness.
- Never write that any real person uses or endorses GraphPay.

**His line:** "Just landed in Mumbai. Get me the best masala dosa near BKC under 6 USDT by 8 pm."

**The place** is Bandra Kurla Complex (BKC), Mumbai, where the event is. BKC is the centre of every map.

**His agents:**
- concierge, his main agent: the caped smiley figure, shown as "Mr. Vitalik's agent";
- scout;
- analyst;
- payer.

**The three cast shops** (you name them in section 4):

| role | where | combo price (USDT) | refunds | on time | orders |
|---|---|---|---|---|---|
| good | BKC | 4.80 | 1.2% | 97% | 4,812 |
| runner-up | Bandra East | 4.20 | 3.1% | 93% | 1,204 |
| trap | Kalina (Santacruz East) | 3.30 | 18.4% | 71% | 2,190 |

The good shop's own agents are storefront, risk and dispatch.

**The moments:**
- The agents compare the three shops and veto the trap for its refunds.
- They pay the good shop 4.80 for a ghee roast masala dosa with filter coffee.
- The coffee spills in the bag, so a photo is uploaded and 0.80 is refunded.
- "Another coffee" is a 0.80 re-order.
- A Sunday breakfast box (two idlis, one medu vada, one filter coffee) renews every week at 2.40.
- "Dosas for everyone at the hackathon" is refused, because it exceeds the daily pass.
- Mr. Vitalik can pause his payer and resume it, and a spare agent can be shut down for good.

**These numbers are fixed. Do not change them.**

## 3. Rules for everyone

1. **Invent every shop name.** Real places are research only (section 4.1). A real name is never a cast or city name, never put on a chain, and never placed next to our made-up numbers.
2. **Generate every image yourself with Grok Imagine.** Never download or copy an image from the web.
3. **Keep images clean.** No real brands, logos, signage text or people's faces in any image; hands are fine. No text inside images, because the app adds its own.
4. **Food must look appetizing and real:** professional food photography.
5. **Research is exact.** Quotes are word for word, at most 25 words, with a link and a date. Never invent a quote or a number. Mark anything you could not confirm "UNVERIFIED".
6. **Write plain English:** short sentences, no hype words.
7. **Label synthetic data.** Put `"synthetic": true` wherever the format has it.
8. **Follow the folder plan.** Every file goes exactly where section 11 says, under exactly that name.

## 4. @Place Scout

### 4.1 `research/bkc-places.md`

Real South Indian eateries in and around BKC: BKC, Bandra East and Kalanagar, Kalina, Kurla West, Sion, Matunga, Dadar and Mahim. Give at least 25, each with its name, area, what it is known for, price level and a link.

This is reference only, so that the invented places feel real: their dishes, prices, styles and streets.

### 4.2 `places/neighbourhoods.json`

The real neighbourhoods we use, at least 12, with BKC first:

```json
{
  "schema": "graphpay.grok.neighbourhoods.v1",
  "neighbourhoods": [
    { "id": "bkc", "name": "Bandra Kurla Complex", "lat": "<number, 6 decimals>", "lon": "<number, 6 decimals>", "source": "<link to OpenStreetMap or Wikipedia>" }
  ]
}
```

Write `lat` and `lon` as plain numbers, not strings.

### 4.3 `places/cast-shops.json`

Invent the three cast shops.

**Names:** short, memorable, South Indian and playful, and each hints at its role. The trap's name sounds fast and careless, never offensive. These suggestions are yours to keep or beat: Filter & Fold (good), Idli Index (runner-up), Turbo Tawa (trap).

**Check each name with web search.** There must be no real business in Mumbai, and no famous one elsewhere, with the same or a confusingly similar name. Record the queries and results in `places/name-checks.md`.

```json
{
  "schema": "graphpay.grok.cast.v1",
  "synthetic": true,
  "shops": [
    {
      "role": "good",
      "label": "filter-and-fold",
      "displayName": "Filter & Fold",
      "neighbourhood": "bkc",
      "lat": "<number>",
      "lon": "<number>",
      "tagline": "<at most 60 characters>",
      "look": "<one line for the photographer>",
      "comboPriceMicro": 4800000,
      "refundRatePct": 1.2,
      "onTimePct": 97,
      "orders": 4812
    }
  ]
}
```

- **Shops:** exactly three, roles `good`, `runner-up` and `trap`, with the numbers from section 2.
- **`label`:**
  - lowercase a to z, 0 to 9 and hyphens only;
  - 3 to 30 characters, with no hyphen at either end;
  - it becomes `<label>.graphpay.eth`;
  - not one of `vitalik`, `kesar-kingdom`, `syrup-street` or `jamun-junction`, which are already in use;
  - no real person's name in any label or display name.
- **Coordinates:** inside the named neighbourhood, within 600 m of its centre, and not on a named real building.

### 4.4 `places/city-places.json`

120 invented South Indian places across the neighbourhoods, about 40% of them within 2 km of BKC. Check them lightly for real-name clashes, and list any you replaced in `name-checks.md`.

```json
{
  "schema": "graphpay.grok.city.v1",
  "synthetic": true,
  "places": [
    { "label": "<label>", "displayName": "<name>", "neighbourhood": "kalina", "lat": "<number>", "lon": "<number>", "kind": "darshini", "priceLevel": 2, "signature": "neer dosa" }
  ]
}
```

- `kind` is one of: `darshini`, `udupi`, `tiffin-room`, `dosa-cart`, `mess`, `filter-coffee-bar`, `cafe`.
- `priceLevel` is 1, 2 or 3.
- Labels are unique across cast and city.

## 5. @Writer, part one: the menus

Start once Place Scout's three names pass their checks. Do the menus before anything else, because the Food Photographer is waiting for them.

Write one file per cast shop, `menus/<label>.json`, with exactly four items each:

```json
{
  "schema": "graphpay.menu.v1",
  "synthetic": true,
  "version": 1,
  "shop": { "ens": "<label>.graphpay.eth", "name": "<displayName>" },
  "items": [
    {
      "sku": "<label>-masala-dosa-combo",
      "name": "Ghee roast masala dosa + filter coffee",
      "unit": "plate",
      "quantity": 1,
      "priceMicro": 4800000,
      "description": "<at most 90 characters>",
      "image": "images/dishes/<label>-masala-dosa-combo.png"
    }
  ]
}
```

`priceMicro` is the price in USDT times 1,000,000, written as an integer.

**Fixed items:**
- **Good shop:**
  - `<label>-masala-dosa-combo`: "Ghee roast masala dosa + filter coffee", plate, 4800000.
  - `<label>-filter-coffee`: "Filter coffee", cup, 800000.
  - `<label>-sunday-breakfast`: "Sunday breakfast box: 2 idlis, 1 medu vada, 1 filter coffee", box, 2400000.
  - One signature dish of your choice, priced between 1.00 and 3.00 USDT.
- **Runner-up:** `<label>-masala-dosa-combo`, "Masala dosa + filter coffee", plate, 4200000, plus three items of your choice.
- **Trap:** `<label>-masala-dosa-combo`, "Masala dosa + filter coffee", plate, 3300000, plus three items of your choice.

**Your choices:** real South Indian dishes, with realistic relative prices between 0.50 and 3.00 USDT, and descriptions that make people hungry. No item costs more than 6.00.

In `image`, use the extension of the file the Food Photographer actually delivers.

## 6. @Food Photographer

Start once the menus are final.

Make at least three candidates per image and keep the best. Leave the rest out of the zip. Deliver PNG, or JPG if that is what you produce; the base name must match exactly.

### 6.1 `images/dishes/<sku>.png`

One photo per menu item, 12 in all. Square, at the highest resolution you can make.

**Style:**
- shot at 45 degrees or from the top;
- on a steel plate or a banana leaf, with chutneys and sambar where they belong;
- natural light, shallow depth of field, a clean warm or dark background.

**Each shop has one consistent look:**
- **good:** premium, a golden ghee roast, brass and steel, a banana leaf, spotless;
- **runner-up:** homely, a steel thali, honest portions;
- **trap:** rushed, foil or a paper plate, a little overdone, still edible.

The three masala dosa combos must look clearly different from each other.

### 6.2 `images/storefronts/<label>.png`

One per cast shop: 16:9, evening light, matching the shop's look. The signboard shows no readable text.

### 6.3 `images/moments/`

All square:
- `refund-spill-1.png`, `refund-spill-2.png`, `refund-spill-3.png`: a filter coffee spilled inside a brown paper delivery bag, the food box stained.
- `delivery-1.png`, `delivery-2.png`: a delivery bag handed over at the glass entrance of a modern convention centre at dusk. Hands only, no faces.
- `packed-1.png`: the order packed and sealed, with a plain sticker.

### 6.4 `images/hero/`

All 16:9:
- `bkc-dusk-1.png`, `bkc-dusk-2.png`: a modern Mumbai business district at dusk, with no logos.
- `dosa-hero-1.png`: a dramatic close-up of a ghee roast dosa.

## 7. @Agent Designer

Seven characters, one family, in the style of the Grok Bot app: soft rounded blob bodies, two tall oval eyes, flat solid colours, no outlines, friendly and slightly playful. Each holds one prop that shows its job.

| id | team | display name | look |
|---|---|---|---|
| concierge | customer | Mr. Vitalik's agent | A hooded green cape with a big yellow smiley face as its face, and otherwise faceless. An original design, not a likeness of anyone |
| scout | customer | Scout | Binoculars |
| analyst | customer | Analyst | A magnifying glass over a tiny bar chart |
| payer | customer | Payer | A coin |
| storefront | shop | Storefront | A menu card |
| risk | shop | Risk | A small shield |
| dispatch | shop | Dispatch | A delivery bag |

Give each character a distinct colour from: white, brown, red, orange, amber, green, teal, blue, purple, pink, grey. The concierge keeps its green cape and yellow face.

### 7.1 `agents/png/<id>-<state>.png`

Five states per character: `idle`, `thinking`, `talking`, `success`, `refused`. That is 35 images.

- **Format:** square, with the character centred and at the same size in every image.
- **Background:** transparent if you can. Otherwise flat #FF00FF, with no shadows and nothing else in that colour.
- **The states:**
  - thinking: eyes up and to the side, with a small spark;
  - talking: eyes forward, with a speech dot;
  - success: eyes as happy arcs;
  - refused: flat eyes, and a small cross on the prop.

### 7.2 `agents/svg/<id>.svg`

One simplified vector per character:
- `viewBox="0 0 256 256"`;
- flat fills only, with no gradients, filters, embedded images or text;
- under 12 KB;
- these element ids, so the app can animate the parts: `body`, `eye-l`, `eye-r`, `prop`, and also `cape` on the concierge.

### 7.3 `agents/video/<id>-thinking.mp4`

Optional: a seamless 2 to 4 second loop of the thinking state, on the same background.

### 7.4 `agents/agents.json`

```json
{
  "schema": "graphpay.grok.agents.v1",
  "agents": [
    {
      "id": "concierge",
      "team": "customer",
      "displayName": "Mr. Vitalik's agent",
      "ensName": "concierge.vitalik.graphpay.eth",
      "job": "plans the errand and runs the team",
      "colour": "<hex>",
      "accent": "<hex>",
      "personality": "<one line>",
      "motion": { "idle": "<one line>", "thinking": "<one line>", "talking": "<one line>", "success": "<one line>", "refused": "<one line>" }
    }
  ]
}
```

- **ENS names:**
  - the customer team's agents are `<id>.vitalik.graphpay.eth`;
  - the shop's agents are `<id>.<good-shop-label>.graphpay.eth`.
- **`motion`** describes the animation in plain words, for example "bobs 4 px every 2 s; blinks every 4 s".

## 8. @Writer, part two: the copy

Start as soon as the menus are delivered.

### 8.1 `copy/beats.json`

One entry per demo beat, with these fixed ids:
`ask`, `team`, `veto`, `check-back`, `payment`, `memory`, `refund-reorder`, `limits`, `off-switch`, `renewal`, `scale`, `same-kit`, `drop-in`.

```json
{
  "schema": "graphpay.grok.beats.v1",
  "beats": [
    { "id": "veto", "title": "<at most 4 words>", "caption": "<at most 14 words>", "partner": "Arkiv", "voiceover": "<at most 30 words, spoken, first person plural>" }
  ]
}
```

`partner` is one of `ENS`, `Arkiv`, `Whitechain`, `Swarm`, `none`.

Facts to respect:
- The scale beat says "2 reads against about 48". It is about reads, never speed.
- The same-kit beat is a fixed-fare cab ride paid with the same SDK.
- The drop-in beat is a shop adding checkout in 17 lines of code.

### 8.2 `copy/ui-copy.json`

Short strings for the phones, at most 60 characters each, under these keys:
`searching`, `comparing`, `vetoed`, `quote-ready`, `paying`, `paid`, `delivered`, `refund-requested`, `refunded`, `reordered`, `refused-over-pass`, `paused`, `resumed`, `shut-down`, `renewal-charged`, `busy-watch-live`, `credit-out-replay`, `synthetic-label`.

```json
{ "schema": "graphpay.grok.ui-copy.v1", "strings": { "vetoed": "<text>" } }
```

Use these placeholders in braces where needed: `{shop}`, `{amount}`, `{agent}`.

### 8.3 `copy/persona-note.md`

Two sentences: Mr. Vitalik is a fictional persona made for this demo, and no real person is depicted or endorses GraphPay.

## 9. @Pitch Researcher

Start at once, working in parallel with everyone else.

The window is 1 May to 6 Nov 2026 unless an item says otherwise. Every item has a link, a date, and either an exact quote of at most 25 words or a one-line summary.

- `research/partners.md`: what Arkiv, ENS, Whitechain and Swarm have said about AI agents, agent identity, agent payments and verifiable data.
- `research/landscape.md`: the agentic payments landscape, meaning protocols, standards and products such as x402, AP2, ERC-8004 and ENS for agents. One line each, then where GraphPay fits.
- `research/quotes.md`: 8 to 12 quotes from credible builders or researchers on why agents need memory, trust or graph data. Exact words only.
- `research/numbers.md`: published numbers on the growth of agentic payments and AI agent usage, each with its source.
- `research/judge-questions.md`: 10 hard questions per partner (ENS, Arkiv, Whitechain) that a judge might ask a project like this. Questions only, no answers.

## 10. @Producer: order, checks and delivery

**Order:**
1. Place Scout, Agent Designer and Pitch Researcher start at once.
2. Writer starts once the cast names pass their checks: the menus first, then the copy.
3. Food Photographer starts once the menus are final.

**Check every file before you accept it:**
- **Placement:** it sits in the right folder, under the right name, and is listed in the manifest.
- **JSON:**
  - it parses, and every field in this brief is present;
  - prices are integers, and the fixed numbers are unchanged.
- **Labels:** they follow the rule and are unique; ENS names are `<label>.graphpay.eth`.
- **Names:** the name checks are recorded, and no real business name appears among the cast or city places.
- **Images:**
  - the right count, shape and background;
  - no text, logos or faces;
  - dishes match their items, and each shop's look is consistent;
  - the three combos are distinct.
- **Agents:** 35 state images and 7 vector files with the required ids, in distinct colours.
- **Persona:** the persona rules hold everywhere.
- **Research:** every item has a link and a date, quotes are exact, and unconfirmed items are marked UNVERIFIED.

Send back anything below the bar, with one line saying why.

**Then write:**
- `README.md`: what is inside, which bot made what, the date, and this sentence: "All images were generated with Grok Imagine; all shop names are invented; all data is synthetic."
- `CHECKLIST.md`: every check above, each marked pass or fail.
- `manifest.json`:

```json
{
  "schema": "graphpay.grok.manifest.v1",
  "files": [ { "path": "images/dishes/<sku>.png", "kind": "dish-photo", "bot": "Food Photographer", "notes": "" } ]
}
```

- `prompts/desk-prompt.md`: this brief, word for word.

**Deliver:** zip the folder `graphpay-grok-pack` as `graphpay-grok-pack.zip`. Post it in the group with a five-line summary and a list of anything not done.

## 11. The folder

```
graphpay-grok-pack/
  README.md
  CHECKLIST.md
  manifest.json
  prompts/desk-prompt.md
  places/neighbourhoods.json
  places/cast-shops.json
  places/city-places.json
  places/name-checks.md
  menus/<label>.json                  (3)
  images/dishes/<sku>.png             (12)
  images/storefronts/<label>.png      (3)
  images/moments/                     (6)
  images/hero/                        (3)
  agents/agents.json
  agents/png/<id>-<state>.png         (35)
  agents/svg/<id>.svg                 (7)
  agents/video/<id>-thinking.mp4      (optional)
  copy/beats.json
  copy/ui-copy.json
  copy/persona-note.md
  research/bkc-places.md
  research/partners.md
  research/landscape.md
  research/quotes.md
  research/numbers.md
  research/judge-questions.md
```

@Producer, start now: post the plan and assign the work.
