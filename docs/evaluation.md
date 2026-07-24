# Evaluation

MALT evaluation has two public documentation layers:

- [Evaluation Story](/narrative/evaluation-story): research framing for read
  latency, write amplification, cost breakdown, sensitivity studies, and
  semantic reachability.
- [Evaluation and Benchmark Protocol](/docs/evaluation): current evaluator
  boundaries, Phase 0 and executable Section 5 status, plus the frozen v0.0.5
  harness contract and artifact caveats.

The main quantitative evaluation focuses on read latency and write
amplification. Cost breakdown explains the results; it is not a separate main
claim.

## Current Evaluator Status

The active `malt-evaluation` root module has two distinct tracks:

- `current-product` measures the Gateway/trusted-client boundary, including
  local proof and payload verification.
- `current-core` measures public Core algorithms over the reference in-memory
  materializer and excludes Gateway, network, persistent ArcTable, and client
  policy.

Phase 0 plan validation and normalization are registration only and cannot
dispatch experiments. The executable Section 5 RQ1-RQ4 suites and publication
pipeline are implemented, but the checked-in plan remains unfrozen at
`stage=implementation`. Formal E0 and campaign dispatch therefore remain
closed. No checked-in output is a current paper result, and the paper's result
tables must stay unfilled until exact artifacts and machine identities are
frozen, the campaigns run, and the pinned reporting gates accept them.

## Systems

Frozen v0.0.5 evaluator systems:

- `MALT-flat`: pure MALT structure UnixFS using list/map semantics plus
  CAS-backed immutable payloads
- `IPLD UnixFS`: implicit Merkle-DAG baseline
- `IPLD UnixFS + HAMT`: strong large-directory authenticated-map baseline

`MALT-flat` identifies the frozen v0.0.5 evaluator's full-path flat-map
baseline and is preserved by existing result artifacts. It is not a current
`malt-client` layout value: the native client exposes `layout=hybrid`. New
product tests should name that actual strategy instead of treating
`MALT-flat` as a client configuration.

HAMT is a directory or map-relation baseline. It is not the large-file content
layout baseline.

## Metrics

Read latency reports:

- p50, p95, and p99 latency
- CAS GET count
- ArcTable lookup count for MALT
- bytes fetched
- retrieval depth
- sequential network rounds
- proof or evidence bytes
- prove latency
- verify latency

Write amplification reports:

- total persisted bytes
- objects changed
- CAS payload blocks
- CAS metadata blocks
- ArcTable records or deltas
- commitment metadata
- root or publication metadata

## Workloads

Path or query resolution:

```text
Read(root, path/query) -> destination + proof/evidence
```

Range or partial read:

```text
Read(root, byte range) -> selected bytes + path/payload proof + list_range evidence
```

The current MALT path uses measured-list `list_range` evidence for large-file
range reads. The step carries authenticated fixed chunk metadata, covered
segment CIDs, and metadata/index proof payload. ProofList verification binds
that metadata and the ordered segment CIDs; UnixFS callers accepting returned
bytes additionally perform an equivalent body-binding check. The
`malt-client/unixfs.VerifyRangeBody` helper is a client-side check rather than
part of MALT core.

Encrypted private-CAS read:

```text
fetch encrypted parent -> decrypt -> parse child link -> fetch encrypted child
```

The encrypted setting tests the deployment assumption that embedded Merkle-DAG
links can create sequential reveal dependencies when the storage service cannot
inspect plaintext structure.

See [Evaluation and Benchmark Protocol](/docs/evaluation) for the active
current-product/current-core boundary and the historical harness contract. The
retired v0.0.5 source remains recoverable from immutable history with its
intentional dependency pin; it is not the active runner. Current product
correctness is exercised by Gateway-owned end-to-end tests, while
`malt-evaluation` owns reproducible measurements and result provenance.
Evaluation CLI ownership remains outside the SDK-only Core.
