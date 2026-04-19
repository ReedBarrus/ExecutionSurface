# ExecutionSurface Projection Ledger

## Status

This document is the projection intake surface for `ExecutionSurface`.

It belongs to the live workflow band, but it is not runtime authority and it is
not implementation authority.

## Method posture

This surface belongs to:

- `Topology-First Architecture Pressure Generation`

Its role is to accept projection without granting projection authority.

## Purpose

The projection ledger exists so ideas can enter the process freely without
forcing immediate stabilization, implementation, or release.

Projection is allowed here.

Projection does not become authority here.

## Working rule

Every projection must be classified before it can move into the working lane.

Allowed statuses:

- `detected in runtime`
- `implementable against current runtime`
- `requires topology detection`
- `requires topology perturbation`
- `speculative / deferred`
- `anti-pattern / archive`

## Ledger entry template

Each entry should carry at minimum:

- `projection`
- `source`
- `desired function`
- `status`
- `runtime object/relation grounding`
- `required detection`
- `required perturbation`
- `implementation seam`
- `defer/archive reason`

## Gate to the working lane

A projection may move into the working lane only when:

1. a runtime or implementable topology candidate is named
2. a topology detection request exists or has already been satisfied
3. the idea has a bounded seam or subject scope

If those are missing, the projection remains here.

## Non-goals

This ledger does not:

- stabilize architecture by itself
- authorize implementation
- replace the subject registry
- replace topology detection
- replace perturbation

## One-line summary

The projection ledger allows ideas to enter freely while forcing them to remain
non-authoritative until they are grounded through topology detection and
perturbation.
