# ExecutionSurface Topology Detection Protocol

## Status

This document defines the minimal topology-detection protocol for
`ExecutionSurface`.

It is a live workflow surface.

## Method posture

This protocol belongs to:

- `Topology-First Architecture Pressure Generation`

It is the first active gate in the working lane.

## Root rule

No architecture move may stabilize a subject until the relevant implemented or
implementable object/relation topology has been detected, or explicitly
requested and bounded as missing.

## Purpose

The topology detection protocol exists to force the process to ask:

- what exact object enters
- what transformation acts
- what exact object leaves
- what relations are conserved
- what relations are lost or omitted
- what authority ceiling applies
- what verification handle exists

This protocol works in:

- substrate-aware mode
- substrate-free mode

## Substrate-free posture

In substrate-free mode, topology means:

the minimal object/relation structure that can be observed, named, compared, and
preserved across a transformation.

This protocol therefore applies to:

- code
- docs
- JSON
- text
- tables
- logs
- UI state
- analog signal

## Required output

Every detection pass must emit one:

- `Topology detection object`

## Topology detection object

Minimum fields:

- `source artifact`
- `active seam`
- `input object family`
- `output object family`
- `transformation`
- `conserved relations`
- `lost / omitted relations`
- `authority ceiling`
- `verification handle`
- `unknowns`

## Stop conditions

The pass must stop, recruit downward, or defer if:

- no input object can be named
- no output object can be named
- no transformation can be named
- no conserved or lost relation can be stated honestly
- no verification handle exists

## One-line summary

The topology detection protocol forces every serious architecture move to name
the actual object/relation transformation it is talking about before
stabilization begins.
