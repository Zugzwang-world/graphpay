# Invented shop name checks

Checked 6 November 2026. Web-search collision screening only; not trademark clearance or proof of absence.

## Cast

- Good: Filter & Fold (`filter-and-fold`).
- Runner-up: Idli Index (`idli-index`).
- Trap: Turbo Tawa (`turbo-tawa`).

Queries:
1. `"Filter & Fold" OR "Filter and Fold" restaurant cafe Mumbai`
2. `"Idli Index" restaurant cafe Mumbai`
3. `"Turbo Tawa" restaurant cafe Mumbai`
4. `"Filter and Fold" "cafe" OR "Filter & Fold" OR "Idli Index" restaurant OR "Turbo Tawa" restaurant worldwide`

No matching business identified in returned results. Filter Cafe (Vashi), Flip N’ Fold (Thane), and Filter Coffee (Bengaluru) were reviewed as different names. Idli Index appeared as a price-comparison phrase rather than a business. Turbo Tawa appeared in unrelated game copy rather than a business. No cast replacements.

Sources surfaced:
- https://www.zomato.com/mumbai/filter-cafe-vashi-navi-mumbai
- https://promallu.com/toprated/india/flip-n-fold-best-burgers-in-thane-zq0y3y/
- https://www.noenthuda.com/2010/01/05/urban-living-and-restaurants-and-liquidity/
- https://hospitality.economictimes.indiatimes.com/news/restaurants/building-a-successful-restaurant-the-journey-of-filter-coffee/122988962



## City light screen

6 November 2026. 120 invented names use twelve distinctive two-word stems with ten venue suffixes. These are separate synthetic places, not a claimed real chain. The light screen queried each stem in four grouped web searches:

- `"Podi Pebble" OR "Dosa Dapple" OR "Idli Inkwell" Mumbai restaurant`
- `"Kaapi Kite" OR "Sambar Spindle" OR "Rasam Ribbon" Mumbai restaurant`
- `"Tiffin Thimble" OR "Uttapam Orbit" OR "Vada Velvet" Mumbai restaurant`
- `"Appam Acorn" OR "Neer Nooklet" OR "Millet Mariglow" Mumbai restaurant`

No exact stem business collision was identified in returned results. Search returned generic South Indian dining results and sometimes relaxed the exact phrases; full individual-name clearance remains UNVERIFIED. No replacements were indicated by this light screen. No real business names were deliberately copied.

## Geographic validation — final map revision, 6 November 2026

Five neighbourhood anchors now use actual named OSM locality feature records, obtained through live Nominatim search and filtered to `category=place`: BKC, Bandra East, Kalina, Kurla West and Kalanagar. Transport stops, schools and houses returned by ambiguous searches were rejected. In particular, the BKC district node was selected, not the similarly named metro station.

The JSON source links for these five point directly to their OSM features. Sion, Matunga, Dadar, Mahim and Dharavi retain Wikipedia locality anchors; Chunabhatti uses its station-area reference. Santacruz East now uses the verified OSM Vakola locality feature as its stated sublocality anchor; see the final neighbourhood-evidence section below. Six decimal places are output formatting, not a sub-metre accuracy claim.

BKC is first and is the distance origin at 19.067115, 72.865725. Cast labels, prices, metrics and names are unchanged; good and runner-up pins moved to remain within 600 m of the better-sourced locality anchors. City labels and names are unchanged; positions were regenerated around the corrected anchors. Exactly 48/120 city pins (40%) lie within 2,000 m great-circle distance of this BKC anchor. Near pins cover BKC (24), Bandra East (8), Kalina (8) and Kurla West (8); the remaining 72 cover eight other neighbourhoods. This is straight-line, not road or delivery distance.

Neighbourhood feature points are not official administrative centroids. Exact neighbourhood polygon containment remains UNVERIFIED because named suburb nodes do not provide boundary polygons. All cast/city positions are synthetic display pins, never real shop addresses. No real business is asserted at those points.

## Strengthened cast-name screen — 6 November 2026

Additional queries, without a Mumbai restriction:
- `"Filter & Fold" OR "Filter and Fold" restaurant business`
- `"Idli Index" restaurant business`
- `"Turbo Tawa" OR "Turbo Tava" restaurant business`

Filter & Fold: no exact combined business match surfaced; distinct Filter Coffee (Bengaluru), FOLD (London), Filter (Cleveland), and Filter Cafe and Kitchen (Karnataka) were surfaced.
Idli Index: the informal purchasing-power phrase surfaced again; no restaurant match identified.
Turbo Tawa: a phonetic/orthographic near-match **Turbo Tava / Tavacı Turbo** surfaced in Turkey. This is a real business, not a synthetic cast shop. No Mumbai match or evidence of a famous international brand was found, but confusing similarity is a REVIEW FLAG. The user declared the cast labels final on 6 November; the label is preserved rather than silently changed. This is not a clean worldwide absence finding. Producer must not mark the whole name-clearance test as an unconditional PASS.

Near-match sources:
- https://www.tavaciyilmaz.com.tr/
- https://www.firmarehberikonya.com/Firma/turbo-nevsehir-tava-testi-kebabi-pide/2437/
- https://konyaticari.com/tavaci-turbo/

## Live OSM footprint audit — final map revision, 6 November 2026

Public OSM map API XML was retrieved successfully for all three final cast areas. A ray-casting point-in-polygon test checked the exact final cast coordinates against every complete closed building or water ring in the extracts, including complete outer rings of tagged relations. All three pins avoid all tested mapped building footprints, a stronger screen than only named buildings. This is a reproducible OSM-data check, not a guarantee that OSM maps every real structure. No address or association with a real premises is asserted.

- `filter-and-fold` at 19.066700, 72.865100: 58 closed rings tested; zero overlaps; 80.3 m from its sourced locality anchor. [Live OSM XML](https://api.openstreetmap.org/api/0.6/map?bbox=72.861,19.063,72.870,19.071).
- `idli-index` at 19.062200, 72.850300: 139 closed rings tested; zero overlaps; 79.3 m from its sourced locality anchor. [Live OSM XML](https://api.openstreetmap.org/api/0.6/map?bbox=72.846,19.058,72.853,19.065).
- `turbo-tawa` at 19.079400, 72.865800: 210 closed rings tested; zero overlaps; 476.6 m from its sourced locality anchor. [Live OSM XML](https://api.openstreetmap.org/api/0.6/map?bbox=72.8625,19.0765,72.8695,19.0835).

Raw map XML, Nominatim results, scripts and final numeric audit are retained outside the delivery pack in `/workspace/place-scout/`. OSM data © OpenStreetMap contributors, licensed under ODbL; see [OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

Acceptance distinction: the mapped-building avoidance screen and cast-distance test pass; exact administrative/neighbourhood polygon containment remains UNVERIFIED as an official-polygon claim; the Santacruz East display anchor is now sourced below. The Turbo Tava name-similarity review flag remains open. Light city screening is not exhaustive trademark clearance.

## Final source-link audit

All 55 distinct canonical source URLs in the five Place Scout files were attempted on 6 November 2026. None returned 404 after correcting a trailing-punctuation extraction issue in the OSM attribution URL. Several hosts returned 403, and Restaurant Guru returned 503 to direct HTTP, although its readable page was retrieved successfully through the public-page fetch. These are not reported as fully live-readable passes. Detailed per-URL status is retained at `/workspace/place-scout/final-link-audit.json`; the punctuation correction was checked separately.

## Turkish near-match assessment — Producer follow-up, 6 November 2026

### Verified evidence

- The business-controlled [Tavacı Yılmaz site](https://www.tavaciyilmaz.com.tr/) explicitly brands its offering as Yılmaz & Turbo Tava and gives a Nevşehir address. Its claims of local prominence are self-description, not independent proof of fame.
- [CT Haber, 31 March 2018](https://www.cthaber.com/haber/1697936/turbo-tava-pide-salonunu-mehmet-yasin-hurriyetteki-kose-yazisina-tasidi) reports that food writer Mehmet Yaşin featured Turbo Tava ve Pide Salonu in a 25 March 2018 Hürriyet column and reproduces the text. This establishes reported national-newspaper exposure, not global brand recognition. The original Hürriyet page was not independently located/verified.
- [Tavacı Turbo directory listing](https://konyaticari.com/tavaci-turbo/) describes a Nevşehir restaurant serving regional meat-pan dishes and pide. Listings at different Nevşehir addresses are not sufficient to infer a franchise chain or that every listing is the identical legal business.
- Additional queries were `"Tavacı Turbo" restaurant chain franchise international` and `"Turbo Tava" Mumbai India restaurant famous`. No Mumbai operation, international chain or internationally famous brand was established by the returned evidence. Absence in these results is not proof of absence.

### Assessment, not legal clearance

International fame: **UNVERIFIED**, and should not be asserted. The hit is nevertheless more than a random directory coincidence: a real restaurant uses an almost identical food-business name and has reported press exposure.

Contextual confusion risk for a clearly labelled synthetic Mumbai dosa demo is assessed **low but non-zero**, because city, cuisine, visual identity and synthetic disclosure differ. Name similarity itself is high: Tava/Tawa is a one-letter and near-phonetic difference. Assigning the similar name to the negative 18.4%-refund trap increases the reputational downside if someone connects the two.

Release recommendation: preserve the user's final label in the files, but do **not** certify an unconditional no-confusing-similarity PASS. Prefer a coordinated rename before public release if the Producer requires strict compliance with the original naming rule; otherwise explicitly record acceptance of this documented residual risk. Do not silently rename menu/image/ENS dependencies. This assessment does not establish infringement or trademark status.

All three principal evidence pages above were opened successfully through readable-page fetch; direct HTTP checks of the business and directory sites also returned 200. Research date is 6 November 2026; no source's publication date is implied where none is shown.

## Final neighbourhood evidence — Producer follow-up, 6 November 2026

### Santacruz East anchor resolved as a sourced map reference

`neighbourhoods.json` now uses **19.081364, 72.853893**, the [OSM Vakola neighbourhood node](https://www.openstreetmap.org/node/6126211462), instead of a hand-offset coordinate. The JSON neighbourhood remains named Santacruz East: Vakola is the explicitly chosen sublocality anchor, not a claim of a surveyed centroid for all Santacruz East.

Cross-checks: the [Santacruz/Vakola Wikipedia page](https://en.wikipedia.org/wiki/Vakola) gives a Vakola school address in Santacruz East, and a [Vakola, Santacruz East coordinate listing](https://www.findlatitudeandlongitude.com/l/Vakola+Santacruz+East+Mumbai-+400055/3852850/) independently identifies that sublocality as Santacruz East. The latter has a different representative point, which is why its numbers were not mixed with the OSM feature. OSM's own address hierarchy groups the Vakola node under Kalina; that overlap is disclosed, not treated as an exclusive legal boundary. The record is a reference point for the real neighbourhood, not an official centre assertion.

Only the nine Santacruz East city pins were re-scattered for this anchor correction. Exactly 48/120 total city pins remain within 2 km of the BKC origin. All cast and city labels stay unchanged.

### Cast neighbourhood corroboration at the exact final pins

Live reverse-geocoding responses at zoom 18 return the following `address.suburb` values, matching the required cast neighbourhoods:

- `filter-and-fold`, 19.066700, 72.865100: **Bandra Kurla Complex**, G Block, BKC Road. [Reproduce address lookup](https://nominatim.openstreetmap.org/reverse?lat=19.066700&lon=72.865100&format=jsonv2&zoom=18&addressdetails=1). [Mapped road](https://www.openstreetmap.org/way/260786313).
- `idli-index`, 19.062200, 72.850300: **Bandra East**, Sant Dnyaneshwar Nagar, M D Abasaheb Shinde Marg. [Reproduce address lookup](https://nominatim.openstreetmap.org/reverse?lat=19.062200&lon=72.850300&format=jsonv2&zoom=18&addressdetails=1). [Mapped road](https://www.openstreetmap.org/way/39537375).
- `turbo-tawa`, 19.079400, 72.865800: **Kalina**, Arvind Nagar Road. [Reproduce address lookup](https://nominatim.openstreetmap.org/reverse?lat=19.079400&lon=72.865800&format=jsonv2&zoom=18&addressdetails=1). [Mapped road](https://www.openstreetmap.org/way/792057503).

The runner-up pin was shifted slightly after the first reverse lookup returned a college-campus feature. The final runner-up point is outside all mapped building/water rings and all named closed-area polygons in the local extract; the final reverse lookup returns a road in Bandra East, not the college. Distances to the sourced locality anchors are about 80 m, 79 m and 477 m respectively, all below 600 m.

Nominatim reverse lookup identifies a nearby mapped feature and its address hierarchy; it is **not** a mathematical point-in-neighbourhood-polygon proof. The independent building-footprint screen provides the separate premises-avoidance check. Together these give practical map evidence for the intended neighbourhoods without inventing administrative boundaries. If exact official polygon containment is required as an additional acceptance condition, that remains UNVERIFIED and must not be represented as proven.

Final raw responses are retained outside the pack as `reverse-good.json`, `reverse-runner-up-final.json`, `reverse-trap.json` and `nominatim-vakola.json` under `/workspace/place-scout/`. These are synthetic display positions along local streets, not usable shop addresses or an assertion that a real shop occupies a road.

## Final release decision — 6 November 2026, 17:20 IST
The user approved replacement of Turbo Tawa (`turbo-tawa`) by Tawa Tangle (`tawa-tangle`) because of the real Turkish near-match. Historical screening notes above are retained as history, not current cast names. Place Scout screened exact-name, joined/spelling variants and Mumbai food-listing searches for Tawa Tangle and found no restaurant collision; unrelated results only. Preliminary web screen, not trademark clearance. All active cast, menu, SKU, copy and photo paths now use Tawa Tangle.
