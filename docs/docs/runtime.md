# Runtime and Prototype Status

This page describes the current MALT prototype surface. It is implementation
documentation, not the definition of the MALT abstraction.

The source of truth for current executable behavior is the sibling
implementation repository. The website summarizes the public runtime boundary
so readers can connect the research model to the prototype.

## Public CLI

The current public `malt` CLI is intentionally small:

- `malt init`: create or initialize local configuration
- `malt daemon`: run the local daemon and HTTP API
- `malt add`: import data through the daemon/client path and return a root
- `malt resolve`: print a root-relative resolve response
- `malt verify`: verify ProofList material, including responses that contain a
  `prooflist` field

The product path goes through daemon-client APIs. Removed direct in-process
helpers are not part of the public command surface.

## Mutation Materialization

The current write boundary is root-scoped writer mutation application.
Application layouts produce canonical arc deltas and submit them through the
writer route; the writer applies those deltas to map/list semantic backends and
returns a write receipt.

Current mutation payloads are typed by semantic object kind:

- map deltas use canonical path/key coordinates
- list deltas use canonical index coordinates
- targets carry `cas`, `map`, `list`, or `unknown` target kinds
- large-file UnixFS list creation may include an optional fixed-list commit
  descriptor with `total_size` and `chunk_size`

The receipt reports delta, arc, map, and list counts for operational
accounting. These counts are useful for storage and evaluation reporting, but
they are not correctness evidence. Verification still comes from roots,
semantic commitments, and ProofLists.

For the concrete HTTP request and response shape, see the
[Semantic Mutation Contract](/docs/api#semantic-mutation-contract).

## Evaluation CLI

Evaluation commands live under the separate `malt-eval` binary:

- `malt-eval run`: execute a JSON evaluation plan and write a structured run
  directory
- `malt-eval schema`: list or print embedded evaluator JSON schemas
- `malt-eval summarize`: regenerate figure CSVs from framework raw envelopes
- `malt-eval read`: run root-relative read benchmarks across MALT and IPLD
  baselines
- `malt-eval write`: replay source-domain mutation traces for write
  amplification experiments
- `malt-eval metrics`: inspect or collect evaluation metrics

The current read runner can emit records for `maltflat`, `merkledag`, and
`hamt` over the same deterministic fixture. The framework runner writes raw
JSONL envelopes, `manifest.json`, and generated summary CSVs. Write replay now
has checked-in result schema coverage; paper claims still require refreshed
artifacts, repeated runs, workload-lock metadata, and explicit backend/config
labels.

## Package Roles

Current package names should not redefine the research abstraction. They are
prototype modules mapped to the semantic model:

| Package | Role |
|---|---|
| `core/commitment` | Stateless commitment backends for commit/prove/verify/update. |
| `core/arctable` | Root-recoverable arcset persistence and materialization. |
| `core/arctable/bloom` | Optional negative-lookup optimization hook, disabled unless configured with a BloomCache. |
| `core/structure/list` | Public list semantic abstraction and shared types. |
| `core/structure/list/tree` | Primary list implementation. |
| `core/structure/mapping` | Public map semantic abstraction and shared types. |
| `core/structure/mapping/radix` | Primary map implementation. |
| `cmd/eval/internal/baseline/indexedmap` | Baseline comparison map implementation, not the current runtime map path. |
| `layout/unixfs` | Current list/map/CAS-blob UnixFS layout. |
| `core/resolver` | Resolver read/proof port and explicit MALT path. |
| `core/writer` | Mutation model and executor. |
| `core/graph` | Graph contracts plus runtime composition around resolver and writer ports. |
| `core/querypath` | Root-relative query path canonicalization helper. |
| `core/manifest` | UnixFS directory-manifest helper used by the application layout. |

`core/graph` is the graph boundary around resolver and writer ports. It is not
the list/map semantic owner.

## Runtime Boundary

The daemon, resolver adapters, ArcTable, graph runtime metadata, and caches are
untrusted execution state. They may affect latency or availability, but
accepted correctness comes from local verification against a trusted root.

MALT core does not define root freshness, latest-root discovery, global
availability, tenant policy, quota, ACL, pinning, garbage collection, or
multi-writer merge policy. Those belong to applications or deployments built
around MALT.
