# Benchmark Protocol

This page records the pre-v0.0.6 evaluation harness contract. It is not a
paper-results page or a current core CLI contract. The SDK-only core no longer
ships `malt-eval`. The former v0.0.5 evaluator is retired from the active
[`DeWebProtocol/malt-evaluation`](https://github.com/DeWebProtocol/malt-evaluation)
tree. Its source remains recoverable from the
[standalone import commit](https://github.com/DeWebProtocol/malt-evaluation/commit/774854b5d90c1ba5d57c3d74619dd97a78fd9dcf),
repository history, and the
[MALT v0.0.5 release](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.5).
Historical result files remain provenance only and must not be relabeled as
current results.

The active evaluator now lives at the `malt-evaluation` repository root; there
is no nested `current/` module. Its current-product workload implements
resolve/read local verification, CAS binding, client read/candidate acceptance
adapters, a deterministic depth/path matrix, logical storage accounting, and
immutable baseline links. New runs record normalized plans, build provenance,
and exact write-trace commits; this does not retroactively recover moving
`HEAD` inputs
from older results that omitted them. Current product pass/fail correctness
belongs to the gateway-owned CAS-to-gateway-to-client E2E suite, while the
evaluator records reproducible measurements over that boundary. Fresh
measurements remain separate from the frozen v0.0.5 records.

The benchmark protocol is designed to compare MALT, IPLD UnixFS, and IPLD
UnixFS+HAMT as the implementation and artifacts mature.

## Systems

Frozen v0.0.5 readbench systems:

- `maltflat`: pure MALT structure UnixFS over map/list semantics plus
  CAS-backed immutable payloads
- `merkledag`: IPLD UnixFS with basic directory materialization
- `hamt`: IPLD UnixFS with HAMT directory materialization

`maltflat` identifies the frozen v0.0.5 evaluator's full-path flat-map baseline
and remains the label in its historical result schemas. It is not a
`malt-client` layout value and does not name the current client's `hybrid`
materialization. New
client/product tests should describe the actual target and `layout=hybrid`
instead of reusing this label.

The read command selects systems with:

```text
--systems maltflat,merkledag,hamt
```

The compact system list is `maltflat,merkledag,hamt`.

HAMT is a directory/map-relation baseline. It is not the large-file content
layout baseline.

## Frozen v0.0.5 Framework Runner

The historical runner is no longer compiled or maintained on
`malt-evaluation`'s active branch. When reconstruction is required, use the
immutable sources linked above. Its entrypoint was:

```text
malt-eval run --plan <plan.json> [--out <dir>] [--run-id <id>]
```

A run directory contained raw suite JSONL envelopes, `manifest.json`, logs, and
generated summary CSVs. `malt-eval schema` listed or printed embedded schemas
for run plans, run manifests, write traces, read queries, CAS cost-model
records, proof overhead, storage overhead, and common envelope fields.

## Read Latency

The v0.0.5 entrypoint was:

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

The harness operations were:

- `resolve_path`: resolves the deterministic small-file path and returns the
  target plus `ProofList` evidence for MALT, or comparable traversal evidence
  for IPLD baselines
- `content_range`: reads a range from the deterministic large file and returns
  bytes plus measured-list `list_range` `ProofList` evidence for MALT, or
  comparable traversal evidence for IPLD baselines

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

The former framework entrypoint was:

```text
malt-eval run --plan <plan.json>
```

The former focused helper entrypoint was:

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

The historical write-trace schema, adapters, tests, and artifacts belong to the
retired evaluator and remain recoverable from the immutable sources linked
above. They are not shipped by MALT core v0.0.6.

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

The first historical smoke artifact predates the current three-system read
schema. It is recoverable with the retired evaluator as a command-wiring
artifact, not a paper-grade result.

It verified a MALT-only read path and did not include the current required
`system` or `evidence_item_count` fields. New paper-result artifacts must
record machine profile, OS, CPU, memory, Go version, CAS latency configuration,
warmup policy, run count, and statistical aggregation policy.

Before using results in a paper claim, the project still needs refreshed
three-system artifacts, framework run outputs, repeated measurements,
workload-lock metadata, backend/config labels, and statistical aggregation on
top of the generated summary CSVs.
