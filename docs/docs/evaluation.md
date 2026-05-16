# Benchmark Protocol

This page summarizes the current evaluation data loop. It is not a
paper-results page.

The benchmark protocol is designed to compare MALT, IPLD UnixFS, and IPLD
UnixFS+HAMT as the implementation and artifacts mature.

## Systems

Current readbench systems:

- `maltflat`: pure MALT structure UnixFS over map/list/CAS blob composition
- `merkledag`: IPLD UnixFS with basic directory materialization
- `hamt`: IPLD UnixFS with HAMT directory materialization

The read command selects systems with:

```text
--systems maltflat,merkledag,hamt
```

The compact system list is `maltflat,merkledag,hamt`.

HAMT is a directory/map-relation baseline. It is not the large-file content
layout baseline.

## Read Latency

Current entrypoint:

```text
malt-eval read --config <config> \
  --systems maltflat,merkledag,hamt \
  --fixture <name> \
  --iterations <n> \
  --arc @payload=<cid> \
  [--depth <d>] \
  [--small-bytes <bytes>] \
  [--large-bytes <bytes>] \
  [--range <http-range>]
```

Current operations:

- `resolve_path`: resolves the deterministic small-file path and returns the
  target plus `ProofList` evidence for MALT, or comparable traversal evidence
  for IPLD baselines
- `content_range`: reads a range from the deterministic large file and returns
  bytes plus range-covering `ProofList` evidence for MALT, or comparable
  traversal evidence for IPLD baselines

Required read metrics include:

- end-to-end elapsed time
- CAS GET count and bytes fetched
- ArcTable lookup and batch lookup counts
- `ProofList` step count
- comparable evidence item count
- proof/evidence bytes
- content bytes for range reads

For baselines, evidence bytes are counted as fetched DAG or HAMT traversal
blocks needed for verifier-side reconstruction.

## Write Amplification

Current entrypoint:

```text
malt-eval write \
  --repo-path <repo> | --repo-url <url> \
  --repo-ref <ref> \
  --limit <n> \
  --systems maltflat,merkledag,hamt \
  --store-backend memory|fs|badger \
  --store-mode isolated|shared \
  --out <result.jsonl>
```

Each JSONL record corresponds to one system after one source commit. The source
commit supplies live files, live payload bytes, file and directory counts, path
depths, and file mutations.

Required write metrics include:

- cumulative authenticated bytes
- cumulative metadata bytes
- cumulative payload bytes
- cumulative objects or records
- ArcTable record or delta count and bytes
- commitment metadata bytes
- root/head metadata bytes
- attempted writes versus newly persisted writes

The main write comparison must include ArcTable and commitment costs.

## Artifact Status

The first checked-in smoke artifact predates the current three-system read
schema. It is retained as a command wiring artifact, not a paper-grade result.

It verifies a MALT-only read path and does not include the current required
`system` or `evidence_item_count` fields. New paper-result artifacts must
record machine profile, OS, CPU, memory, Go version, CAS latency configuration,
warmup policy, run count, and statistical aggregation policy.

Before using results in a paper claim, the project still needs refreshed
three-system artifacts, write schema coverage, reproducible runner metadata,
and aggregate report generation.
