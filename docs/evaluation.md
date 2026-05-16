# Evaluation

MALT evaluation has two public documentation layers:

- [Evaluation Story](/narrative/evaluation-story): research framing for read
  latency, write amplification, cost breakdown, sensitivity studies, and
  semantic reachability.
- [Benchmark Protocol](/docs/evaluation): current `malt-eval` command shape,
  systems, operations, metrics, and artifact caveats.

The main quantitative evaluation focuses on read latency and write
amplification. Cost breakdown explains the results; it is not a separate main
claim.

## Systems

Primary systems:

- `MALT-flat`: pure MALT structure UnixFS using list/map/CAS blob composition
- `IPLD UnixFS`: implicit Merkle-DAG baseline
- `IPLD UnixFS + HAMT`: strong large-directory authenticated-map baseline

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
Read(root, range query) -> selected bytes + range-covering proof/evidence
```

Encrypted private-CAS read:

```text
fetch encrypted parent -> decrypt -> parse child link -> fetch encrypted child
```

The encrypted setting tests the deployment assumption that embedded Merkle-DAG
links can create sequential reveal dependencies when the storage service cannot
inspect plaintext structure.

See [Benchmark Protocol](/docs/evaluation) for the current implemented
`malt-eval read` and `malt-eval write` entrypoints.
