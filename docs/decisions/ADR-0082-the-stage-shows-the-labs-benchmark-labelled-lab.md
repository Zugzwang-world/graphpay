# ADR-0082: The stage's scene 7 shows the lab's benchmark, labelled "lab"
Status: accepted · Date: 2026-11-07 04:40 IST · Decided by: founder · Source: the founder's words to the "GraphPay stage completion" session (#219), relayed to the night Coordinator at 04:55 IST

## Decision
Scene 7 of the stage shows two meters, "1.8x faster" and "about 30x less data", both labelled "lab, 9,612 payments". They are the pre-event lab's measured figures: 0.65 s and 31 KB, against plain Arkiv's 1.17 s and 976 KB (`planning/SPEC/BENCHMARK.md` §4, the M row). The founder asked for them by name.

## Why
The event's own big city M was trimmed and not raced (ADR-0081), so no M number from the event exists. The lab's run is a real measurement, and it shows the scale the product is built for. The label says where each figure comes from.

## Consequences
- Narrows ADR-0042 (pack E-13: race and benchmark numbers only from live runs at the event) for this one display. The figures are labelled "lab", never "live" or "measured at the event".
- `/race` and the submission files keep the event's measured S numbers (`bench/results/questions-S.csv`: Q2 2 reads against 5). The README claims no M number.
