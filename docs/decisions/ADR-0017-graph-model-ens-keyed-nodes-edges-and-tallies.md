# ADR-0017: Graph model: ENS-keyed nodes, edges and tallies

Status: adopted from the lab (planning/DECISIONS.md part A) · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0017

## Decision

Graph model: ENS-keyed nodes, every event an edge, tallies per (node, epoch, window), epochs indexed on edges, an indexed `day` on tallies, names on edges

## Why

Measured: aggregates at constant cost; names on edges remove a lookup round on traversals
