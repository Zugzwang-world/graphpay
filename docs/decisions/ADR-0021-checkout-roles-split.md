# ADR-0021: Checkout roles split

Status: adopted from the lab (planning/DECISIONS.md part A) · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0021

## Decision

`GraphPayCheckout` roles split: admin (`Ownable2Step`, cannot renounce), relayer, policy writer, and each order's merchant for refunds and delivery; roles stay distinct after deploy

## Why

A stolen relayer key can no longer lift a cap or pull refunds
