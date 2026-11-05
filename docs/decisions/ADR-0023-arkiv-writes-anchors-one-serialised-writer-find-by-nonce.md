# ADR-0023: Arkiv writes: anchors, one serialised writer, find by nonce

Status: adopted from the lab (planning/DECISIONS.md part A) · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0023

## Decision

Arkiv writes: an anchor (checkpoint, `ref`) patched in the same atomic batch; one serialised writer per wallet sending with the confirmed nonce; after an uncertain send, find the mined transaction by nonce; an indexed event id with read-side dedupe as a safety net; random salts

## Why

A repeated salted create mints a second entity on Rabdi; batches are atomic and one nonce lands once (all verified on-chain)
