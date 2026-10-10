# Evaluation

MALT evaluation studies verified read latency, write amplification and the costs
of maintaining authenticated relations. Nested Roots can still propagate
updates to affected ancestors. Measurements must include payloads, relation
materialization, indexes, commitments and publication metadata within the
declared boundary.

## Current Evaluator

The active [malt-evaluation repository](https://github.com/DeWebProtocol/malt-evaluation)
uses `malt-eval-next`: explicit state/run/request plans, capability-checked
workers, raw artifacts and reproducible offline analysis. Its Core adapters
measure in-memory authentication; runtime and Gateway workers supply specific
product capabilities. A Core result does not include network, payload delivery
or durable storage unless a separately declared worker measures them.

Non-MALT Git replay uses `malt-eval-replay` and its own accounting contract.
Phase-0 registration and the earlier manuscript-specific dispatch commands are
retired; historical artifacts retain their original identities.

Implemented infrastructure does not establish a completed paper campaign.
Current reports remain `publication_eligible=false` until the required
release/E0 and claim evidence is implemented and satisfied. The
[Evaluation and Benchmark Protocol](/docs/evaluation) links the current
commands, capability matrix and historical sources.

## What Comparisons Must Report

Read measurements include end-to-end latency, acceptance and failures, retrieval
rounds, fetched bytes, evidence size, and proof generation and verification.
Conditional success latency must remain distinguishable from the distribution
that preserves failed or timed-out requests.

Write measurements include source changes, derived structures and actual
storage: payload and metadata blocks, ArcTable records, commitments, root/index
writes and the declared retention history. Attempted writes and newly retained
bytes are different quantities.

The [Evaluation Story](/narrative/evaluation-story) explains these research
dimensions. They are intended comparisons, not claims of measured speedups.

## Layouts and Historical Results

The current runtime supports `flat-v1`, `hybrid-v1` and `rooted-v1` UnixFS
layouts. Experiments must identify the selected strategy. The historical
v0.0.5 `MALT-flat` result label is not a current runtime layout identifier.

HAMT is a directory/map-relation baseline. Large-file range comparisons must
also identify their chunk layout and payload-verification work. MALT range
evidence authenticates element-index bounds, count, an optional metadata CID
and ordered chunk CIDs. The client verifies its CID-bound application geometry,
hashes fetched chunks and assembles the requested byte interval.

The [frozen harness record](/docs/evaluation#frozen-v0-0-5-harness) remains
historical provenance. Its schemas, commands and results must not be relabeled
as current measurements.
