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
| `core/structure/mapping/indexed` | Baseline comparison map implementation, not the current runtime map path. |
| `core/layout/malt/unixfs` | Current list/map/CAS-blob UnixFS layout. |
| `core/resolver` | Runtime read and compatibility adapters. |
| `core/writer` | Transitional concrete map/arcs write adapter. |
| `core/graph` | Runtime metadata, composition, and accessors. |
| `core/querypath` | Root-relative query path canonicalization helper. |
| `core/manifest` | UnixFS directory-manifest helper used by the application layout. |

core/graph is runtime metadata and composition code. It is not the semantic
abstraction.

## Runtime Boundary

The daemon, resolver adapters, ArcTable, graph runtime metadata, and caches are
untrusted execution state. They may affect latency or availability, but
accepted correctness comes from local verification against a trusted root.

MALT core does not define root freshness, latest-root discovery, global
availability, tenant policy, quota, ACL, pinning, garbage collection, or
multi-writer merge policy. Those belong to applications or deployments built
around MALT.
