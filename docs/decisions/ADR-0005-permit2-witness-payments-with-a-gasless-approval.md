# ADR-0005: Permit2 witness payments with a gasless approval

Status: adopted from the lab (planning/DECISIONS.md part A) · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0005

## Decision

Orders pay with a Permit2 witness transfer; subscriptions use Permit2 AllowanceTransfer plus a gasless `cancelWithSig`; the payer's first approval is a gasless EIP-2612 permit for Permit2

## Why

The witness carries the order terms; the token supports EIP-2612, so the payer needs no gas and no prior approval (proven on the real chain)
