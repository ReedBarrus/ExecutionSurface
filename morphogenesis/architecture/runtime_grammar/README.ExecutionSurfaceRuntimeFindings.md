# ExecutionSurface Runtime Findings

## Status

This document extracts the current runtime laws, prohibitions, and design
consequences from the active runtime grammar corpus without reopening every seam
classification from scratch.

It is an operational companion surface within the runtime grammar corpus.

## Core Findings

### Finding 1

The runtime core is more structural and support-rich than the current read-side
receipts suggest.

The operator stack already works over:

- full aligned and windowed signal structure
- full spectral frames
- retained support bins
- band-profile vectors
- uncertainty and distortion measures
- basin centroids and distances
- trajectory relation measures

The flat count problem is mostly a read-side exposure problem, not a core
operator problem.

### Finding 2

Support recruitment begins at `CompressOp`, not at later interpretation layers.

That means `H1` and its descendants should be treated as explicitly derived
support objects rather than as thin counts or proto-semantics.

### Finding 3

Downstream runtime operators are not primarily reasoning over scalar counts.

They use richer structures such as:

- `kept_bins`
- `band_profile_norm`
- `centroid_band_profile`
- `band_profile_snapshot`
- `distance_to_basin_centroid`
- `divergence_score`

### Finding 4

The main flattening and semantic pressure starts in assembled runtime result
packets and workbench integration packets.

The highest-friction seams are:

- orchestrator result assembly
- semantic overlay helpers
- cross-run comparison
- workbench integration
- reconstruction support staging

### Finding 5

Receipts are useful and should survive, but only as subordinate audit surfaces.

They should not remain the main way runtime state is exposed after support
recruitment begins.

## Surviving Runtime Laws

- preserve structure as the active authority through `S1`
- name `H1` as support recruitment explicitly
- preserve provenance and policy anchors at every seam
- preserve bounded support retrieval, clustering, replay, and comparison
- keep read-side projections below runtime authority

## Forbidden Moves

- do not let receipt packets determine runtime shape
- do not require semantic overlay for default runtime admission or comparison
- do not duplicate interpretation through compatibility aliases
- do not reduce support objects to counts alone in primary read-side surfaces
- do not let projections invent identity or hidden write authority

## Immediate Design Consequences

### Consequence 1

The next runtime pass should introduce bounded support descriptors for `H1`,
`M1`, basin topology, and trajectory relation surfaces.

### Consequence 2

The orchestrator and workbench should be rebuilt around structural-support
integration rather than count-led receipt packets with semantic overlays.

### Consequence 3

Cross-run comparison should be re-derived against structural-support descriptors
rather than interpretive label families.

### Consequence 4

The LM-facing packet should remain bounded and read-side-only, but it should be
fed by support descriptors rather than mostly counts once the new descriptor
surfaces exist.

## One-Line Summary

The active runtime findings show that ExecutionSurface already has a richer
structural-support core than its current read-side surfaces admit, so the next
correction is to stop receipt-led flattening and remove semantic overlay from
default runtime authority.
