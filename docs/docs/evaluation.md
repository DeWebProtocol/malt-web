# Evaluation and Benchmark Protocol

The active evaluator is the root module of
[`DeWebProtocol/malt-evaluation`](https://github.com/DeWebProtocol/malt-evaluation).
It is separate from the SDK-only Core and has two explicit measurement
boundaries:

- **`current-product`** measures real Gateway/local-runtime operations,
  including HTTP, local ProofList verification, CID-bound payload reads, and
  selected Gateway diagnostics. Product correctness pass/fail remains in the
  Gateway-owned end-to-end suite; the evaluator owns reproducible measurements
  and provenance.
- **`current-core`** invokes the public application-neutral SDK directly over
  the reference in-memory ArcSet materializer. It excludes HTTP, Gateway,
  local trust policy, CAS payload transfer, persistent ArcTable, and network
  latency, so its results must not be described as deployed-product results.

The exact Core integration identity for either active track is recorded by the
evaluator's `go.mod`, build metadata, and result manifests. A local `go.work`
compatibility build is not publication provenance.

## Phase 0 and the Section 5 Suite

Two contracts must not be confused:

- `examples/paper-campaign-plan.json` is the Phase 0 registration and guardrail
  contract. `malt-eval-plan` validates and normalizes it, but the normalized
  form remains non-dispatchable and is not a benchmark result.
- `examples/paper-section5-plan.json` describes the executable paper Section 5
  suite. RQ1-RQ4 runners, schemas, provenance gates, and pinned report
  pipelines are implemented.

The implemented suite covers verified reads and measured ranges (RQ1),
multi-platform client-root behavior (RQ2), controlled mutation/write
accounting and Git first-parent traces (RQ3), and structural, ArcTable,
commitment-backend, and same-layout causal studies (RQ4).

Implementation is not publication evidence. The checked-in Section 5 plan is
still at `stage=implementation` with an unfrozen revision lock, so campaign
runners reject dispatch. The exact Core, Gateway, client, evaluator, workers,
fixtures, corpora, datasets, configuration, and machine identities must be
frozen before formal E0. Only a passing E0 over those exact inputs can enable a
campaign. No checked-in file is a paper result, and no final RQ1-RQ4 campaign
has been run or accepted for paper claims.

See the evaluator's
[`README`](https://github.com/DeWebProtocol/malt-evaluation) and
[`Phase 0 campaign contracts`](https://github.com/DeWebProtocol/malt-evaluation/blob/main/docs/phase0-campaign-contracts.md)
for the live executable status.

## Frozen v0.0.5 Harness

The remainder of this page records the pre-v0.0.6 evaluation harness contract.
It is not a paper-results page or a current evaluator CLI contract. The former
v0.0.5 evaluator is retired from the active `malt-evaluation` tree. Its source
remains recoverable from the
[standalone import commit](https://github.com/DeWebProtocol/malt-evaluation/commit/774854b5d90c1ba5d57c3d74619dd97a78fd9dcf),
repository history, and the
[MALT v0.0.5 release](https://github.com/DeWebProtocol/malt-core/releases/tag/v0.0.5).
Historical result files remain provenance only and must not be relabeled as
current results.

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
`malt-client` layout value and does not name the current runtime's `hybrid`
materialization. New
runtime/product tests should describe the actual target and `layout=hybrid`
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
above. They were removed before MALT Core v0.0.6 and remain absent from
`malt-core v0.0.7`.

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

Before using any historical reconstruction in a paper claim, the project still
needs a predeclared role for that evidence and matching provenance. Frozen
v0.0.5 records cannot substitute for fresh runs of the current RQ1-RQ4 suite.
