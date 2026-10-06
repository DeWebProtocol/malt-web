# Evaluation and Benchmark Protocol

The active evaluator is the root module of
[`DeWebProtocol/malt-evaluation`](https://github.com/DeWebProtocol/malt-evaluation).
Its current command is `malt-eval-next`, which runs explicit state/run/request
experiments and rebuilds analyses from verified raw artifacts. Core and product
measurements have distinct boundaries:

- **Core adapters** invoke public authentication APIs over in-memory
  materialization and verify results against a source oracle. They exclude
  HTTP, CAS payload transfer, durable storage and application trust policy.
- **Product adapters** use versioned external workers from the runtime or
  Gateway. Each experiment must declare capabilities that its actual worker
  handshake supports. A missing capability is an error; a Core run does not
  stand in for a file, browser or deployed-service experiment.

The evaluator's `go.mod`, binary identity, compiled locks and raw manifests
record the selected implementation. Experimental Core pins can differ from
published browser SDK pins. A local `go.work` compatibility build is not
publication provenance. Gateway owns product correctness E2E; the evaluator
owns reproducible measurements and statistical analysis.

Evaluator source links on this page require repository access. This public
summary explains the measurement boundaries and does not publish raw campaign
records or internal execution plans.

## Current Commands and Evidence

The current flow is `compile`, `preflight`, `run`, `validate`, then `analyze`.
Plans declare states, independent runs, requests and measurement boundaries.
Reports preserve failures, hierarchical weights, acceptance and conditional
success distributions, and paired confidence intervals. Diagnostic adapters
such as `fake-fixed` are harness checks, never performance baselines.

The separate `malt-eval-replay` command accounts for non-MALT Git replay,
including nested Merkle DAG, nested HAMT and flat-path HAMT. Its source,
derived-data and retained-storage accounting remains distinct from native
MALT product measurements.

The current implementation includes Core mechanism and shared-ArcSet adapters,
runtime local file reads, and persistent Gateway relation reads. Complete
HTTP/CAS/CAR/browser reads, online product build/update workers and complete
resource/history accounting still require matching owner implementations and
evidence. See the pinned
[implementation matrix](https://github.com/DeWebProtocol/malt-evaluation/blob/5045dc112df46633c65e231de3dee36d6484ed17/docs/evaluation-next-implementation.md).

`freeze` binds confirmatory sampling to a separate validated pilot. It does not
complete release integration, formal E0 or the paper claim graph. Current
reports remain `publication_eligible=false` until those gates are implemented
and satisfied. Passing smoke tests or merging an adapter is not a paper result.

See the evaluator's
[`README`](https://github.com/DeWebProtocol/malt-evaluation) and
[`executable protocol`](https://github.com/DeWebProtocol/malt-evaluation/blob/5045dc112df46633c65e231de3dee36d6484ed17/docs/evaluation-next.md)
for the live executable status.

## Retired Orchestration

The Phase-0 registry (`malt-eval-plan`) and superseded manuscript-specific
lock/dispatch commands are retired. Their source remains at evaluator commit
`47f01dda4092485e7bd058d214c00feb43c33b2d`. Retained RQ leaf executors and
historical validators keep their original schemas; they are not implicit
fallbacks in the new scheduler. See the
[retirement ledger](https://github.com/DeWebProtocol/malt-evaluation/blob/5045dc112df46633c65e231de3dee36d6484ed17/docs/retired-orchestration.md).

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
materialization. Current runtime/product tests select `flat-v1`, `hybrid-v1`
or `rooted-v1` and record that strategy instead of reusing this label.

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
above. They were removed before MALT Core v0.0.6 and are not part of the
current SDK-only Core.

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

It verified a MALT-only read path and did not include that later historical schema's
`system` or `evidence_item_count` fields. New paper-result artifacts must
record machine profile, OS, CPU, memory, Go version, CAS latency configuration,
warmup policy, run count, and statistical aggregation policy.

Before using any historical reconstruction in a paper claim, the project still
needs a predeclared role for that evidence and matching provenance. Frozen
v0.0.5 records cannot substitute for fresh, fully qualified current experiments.
