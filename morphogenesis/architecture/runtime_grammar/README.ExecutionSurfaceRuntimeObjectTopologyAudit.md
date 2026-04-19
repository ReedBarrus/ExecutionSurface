# ExecutionSurface Runtime Object Topology Audit

## Status

This document audits the current runtime as a topology of object families and
relation families.

It is a companion surface within the runtime grammar corpus.

## Purpose

The audit exists to answer:

- what the main node families are
- what the main edge families are
- which families live before and after commit
- which families are truthful candidates for later transport and projection

## Topology posture

ExecutionSurface is not best modeled as a flat pipeline plus receipts.

It is better modeled as:

- a structural chain before support recruitment
- a support topology after recruitment
- a commit boundary that admits only lawful support carriers
- a read-side layer that should expose bounded induced subgraphs or object cards

## Node families

### Structural node families

- `A1` ingest root
- `A2` aligned stream
- `W1` window frame
- `S1` spectral frame

These preserve geometry and lineage before support recruitment.

### Pre-commit support node families

- `H1` harmonic state
- `An` anomaly report
- `SegmentTransition`
- `M1` merged state

These are the first runtime support-bearing families.

### Post-commit substrate node families

- committed `H1`
- committed `M1`
- `TrajectoryFrame`
- `BN` basin state

These form the substrate’s active support topology.

### Read-side node families

- `Q` query result
- `A3` reconstructed chunk
- cross-run comparison entries
- workbench runtime sections

These remain secondary to substrate truth.

### Audit node families

- runtime receipt
- workbench receipt
- provenance receipt
- benchmark receipts
- validator receipts

These are never primary runtime truth.

## Edge families

### Provenance edges

- `A2 -> A1`
- `S1 -> W1`
- `H1 -> S1`
- `M1 -> H1[]`
- `A3 -> H1 | M1`
- `Q -> consulted states`

### Temporal adjacency edges

- ordered `TrajectoryFrame` sequence
- segment-local frame order
- cross-frame transition counts

### Neighborhood edges

- state-to-basin membership
- frame-to-basin membership
- state-to-nearest-basin proximity
- basin transition edges

### Composition edges

- `H1 -> kept_bins`
- `M1 -> merged_from`
- `BN -> member_state_ids`

### Read-side consult edges

- query result refs
- replay source refs
- cross-run pairwise comparison refs

## Commit-boundary split

### Before commit

Before commit, the runtime is still deciding or deriving support.

Main families:

- `A1`
- `A2`
- `W1`
- `S1`
- `H1`
- `An`
- `SegmentTransition`
- `M1`

### At commit

The substrate admits only:

- `H1`
- `M1`

The boundary is append-only and legitimacy-gated.

### After commit

The substrate organizes committed support into:

- trajectory
- basin neighborhoods
- queryable corpus
- replayable source support

## Topological truth candidates for later projection

### Strong candidates

- `H1`
- `M1`
- `TrajectoryFrame`
- `BN`
- provenance refs
- merge lineage
- basin membership edges
- temporal adjacency edges

These families preserve both geometry and relation structure.

### Secondary candidates

- `Q`
- `A3`
- cross-run comparison rows

These are useful, but more clearly read-side.

### Weak candidates

- receipts alone
- count-only summaries
- note fields

These should not anchor later topology-aware transport.

## Packaging implications

If we need bounded transport later, the most truthful packet shape is likely:

1. scoped object ids
2. bounded object cards
3. bounded relation edges
4. optional compact derived vectors
5. subordinate receipts

That shape is closer to an induced subgraph packet than to a receipt packet.

## One-line summary

ExecutionSurface currently has a viable object topology centered on structural
nodes, support nodes, the `H1/M1` commit boundary, and post-commit temporal and
neighborhood relations, which makes graph-aware bounded packaging a much more
truthful next step than receipt-heavy transport.
