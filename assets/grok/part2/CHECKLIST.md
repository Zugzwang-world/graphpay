# Checklist — part 1 (places, menus, copy, research)

Producer audit, 6 November 2026 ~17:00 Asia/Calcutta. Only checks actually performed are marked.

## Placement and schema

| Check | Result |
|---|---|
| Folder names match brief §11 for part-1 paths | pass |
| `places/neighbourhoods.json` schema, ≥12, BKC first, lat/lon numbers, source links | pass |
| `places/cast-shops.json` synthetic, 3 roles, fixed metrics from brief §2 | pass |
| Cast labels follow rule; ENS form `<label>.graphpay.eth` | pass |
| Cast coords within 600 m of neighbourhood centres (haversine) | pass (80 m / 79 m / 477 m) |
| `places/city-places.json` 120 places, unique labels vs cast, kinds/priceLevel valid | pass |
| ~40% of city places within 2 km of BKC | pass (48/120 = 40%) |
| `places/name-checks.md` present with queries and results | pass |
| Name clearance: no Mumbai cast collision | pass |
| Name clearance: worldwide no confusing similarity | pass for current cast screen — user-approved Tawa Tangle replaces the flagged name; preliminary searches found no collision, not trademark clearance |
| Menus: 3 files, 4 items each, schema, synthetic, shop ENS/name match | pass |
| Fixed good-shop item names and prices | pass |
| Combo prices match cast `comboPriceMicro`; prices integers; none > 6 USDT | pass |
| Menu `image` paths exist on disk for all 12 SKUs | pass (files present; visual QA of stills is part 2) |
| `copy/beats.json` all 13 fixed ids; partner enum; title≤4 / caption≤14 / VO≤30 words | pass |
| Scale beat states 2 reads vs ~48 and does not claim speed | pass (explicitly “not a speed claim”) |
| `copy/ui-copy.json` all 18 keys; each ≤60 characters | pass |
| `copy/persona-note.md` fictional-persona disclosure | pass |
| `research/bkc-places.md` ≥25 linked reference eateries | pass (25-row table) |
| `research/partners.md`, `landscape.md`, `quotes.md` (10 quotes ≤25 words), `numbers.md`, `judge-questions.md` (10×3) | pass (structure/counts; quote text not re-verified against live sources this run) |
| `research/link-checks.md` present | pass |
| `prompts/desk-prompt.md` byte-identical to original group-chat brief | pass |
| `USER-ADDITIONS.md` records additions separately | pass |

## Part 1 open items (documented, not blockers for part 1 zip)

- Historical near-match resolved by user-approved rename to Tawa Tangle; screening history retained.
- Live re-fetch of every research URL was not repeated in this Producer run; Pitch Researcher’s earlier link notes stand.
- Exact official neighbourhood-polygon containment remains UNVERIFIED (disclosed in name-checks).

## Part 2 status (not in this zip)

| Item | Status |
|---|---|
| 12 dish + 3 storefront + 6 moment + 3 hero stills on disk with correct dims | present (dims checked) |
| Three masala-dosa combos visually distinct / shop looks | pass (Producer viewed all three) |
| Five candidates per food image | mostly; early `filter-and-fold-masala-dosa-combo`, `packed-1`, `refund-spill-1` lack a full 5-candidate trail in `/workspace/food-photographer/candidates/` |
| 35 agent state PNGs + 7 SVGs with required ids; transparent backgrounds | pass (file/SVG/id/alpha checks); 28 extra thinking frames also present |
| 7 thinking + 7 success loops | present; Agent Designer visual-review.json all pass (Producer did not re-watch clips this run) |
| 6 b-roll videos | pass under explicit user waiver — five reviewed clips shipped; `dosa-fold.mp4` omitted and waived at 17:20 IST on 6 November 2026 |
| README / CHECKLIST / full manifest covering part 2 | pass — both zips rebuilt 6 Nov 2026 ~17:20 Asia/Calcutta for final release |

## Release limitations
- FAIL: full five-candidate trail for three early stills remains incomplete (see above); user instructed shipment of available passing assets without new attempts.
- UNVERIFIED: GraphPay implementation claims (gas sponsorship, 2 vs about 48 reads, 17-line checkout) are demo-supplied, not independently confirmed.
- Exact neighbourhood boundaries and uncertain/dated research retain their source caveats.
- Visual video acceptance relies on the named file-by-file review records; Producer did not personally watch videos.

Delivery encoding: the 24 Imagine food/storefront/moment/hero photos were converted to quality-95 JPG at unchanged dimensions to fit the chat attachment limit. Menu paths and manifest use the delivered JPG extensions. Agent PNGs remain unchanged.

## Final delivery

Both `graphpay-grok-pack-part1.zip` and `graphpay-grok-pack-part2.zip` pass integrity tests and are staged for the Grok Bot group chat. User waiver of `dosa-fold.mp4` and incomplete five-candidate trails for three early stills remain documented above. Routine delete criteria met on this ship.
