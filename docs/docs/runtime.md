# Runtime and Prototype Status

This page separates the released MALT baseline from an active draft target. It
is implementation documentation, not the definition of the MALT abstraction.

The source of truth for current executable behavior is the sibling
implementation repository. The website summarizes the public runtime boundary
so readers can connect the research model to the prototype.

The current source release is
[`v0.0.4`](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.4). It keeps
the experimental primitive facade and adds canonical segment paths plus the
explicit `malt.artifact/v0alpha2` resolve/prove/verify profile and schemas.

The client/gateway/core package split, `execution.Executor`, operation-specific
resolve/read profiles, reference-executor naming, and `model/unixfs` +
`sdk/unixfs` + `runtime/unixfs` split below are the active target of
[draft PR #163](https://github.com/DeWebProtocol/malt/pull/163), currently at
`db271e7`. Payload selection is an explicit `@payload` resolve segment; the
released v0alpha2 Artifact profile remains frozen. These changes are not part
of the `v0.0.4` release. The browser
verifier's [published provenance](/verifier/PROVENANCE.json) records the exact
full MALT commit and Go toolchain used to build the deployed WASM.

## Active Draft: Portable Core Surface

The module-root `package malt` is the trusted, application-neutral facade. It
exposes `ResolveRequest`/`ResolveResult`/`VerifyResolve`, typed
`ReadRequest`/`ReadResult`/`VerifyRead`, and mutation/receipt values. It owns no
ArcTable, CAS, HTTP client, or execution engine.

The separate `execution.Executor` performs untrusted `Read` and `Apply` work.
Clients may use any local executor or gateway that returns the same results;
correctness comes from local verification, not from that executor.

`auth/verifier` is the portable authentication kernel. It verifies runtime-
generated map, list, and range ProofLists without ArcTable, CAS, application
adapter, server, reference executor, or network access. `graph/verifier` is a thin adapter that lets
the reference graph runtime use that same kernel; it is not a second verifier
implementation.

The unversioned `protocol` package serializes the operation-specific
`malt.resolve/v0alpha1` and `malt.read/v0alpha1` contracts. The `artifact`
package remains a frozen v0.0.4 compatibility surface. A resolver receives
segment arrays and may compose several authenticated arcs without requiring the
client to discover arc boundaries first.

## Active Draft: Public CLI and Local Verifier

The draft public `malt` CLI target is intentionally small:

- `malt init`: create or initialize local configuration
- `malt start/status/stop/restart`: detach, inspect, stop, or restart a managed
  local reference executor
- `malt add`: import data through the executor/client path and return a root
- `malt resolve`: print a root-relative resolve response
- `malt verify`: locally verify ProofList material against an explicit trusted
  root and caller-selected canonical query

Remote product work goes through gateway/executor APIs. Verification stays in
the client. Removed direct in-process
helpers are not part of the public command surface.

The local mock CAS is not a `malt` subcommand. It is a separate `cas` binary
built from `cmd/cas`; local development normally runs it at
`http://127.0.0.1:4318` and points the reference executor's `cas.base_url` at that external CAS
endpoint.

The website App calls the local MALT Gateway at `http://127.0.0.1:8080`. The
gateway delegates to the reference executor at `http://127.0.0.1:4317`, streams UnixFS
content, and exposes the profiled resolve/read endpoints. Its local WASM trust
boundary tracks draft PR #163: the App verifies both ProofList evidence and the
actual returned payload bytes before preview or download. An upload response is
only a candidate root until the user explicitly accepts or independently
publishes it.
When the current root is not already a UnixFS root, browser uploads fail fast;
legacy-root migration is a reference-executor compatibility opt-in rather than a default
browser action.

## Active Draft: Mutation Materialization

The current write boundary is root-scoped writer mutation application.
Application adapters produce canonical arc deltas and submit them through the
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

## Active Draft: Package Roles

These draft package names should not redefine the research abstraction. They
are proposed prototype modules mapped to the semantic model:

| Package | Role |
|---|---|
| module-root `package malt` | Trusted resolve/read, mutation/receipt value, and verification facade; no execution or storage ownership. |
| `mutation` | Pure semantic mutation, delta, commit-descriptor, and write-receipt values plus validation. |
| `execution` | Untrusted `Read`/`Apply` executor over injected semantic/runtime ports. |
| `protocol` | Profiled resolve/read serialization, schemas, and request/result verification pairs. |
| `artifact` | Frozen `malt.artifact/v0alpha2` v0.0.4 compatibility envelope and fixtures. |
| `auth/verifier` | Portable ProofList verification kernel with built-in KZG and IPA verification support. |
| `auth/commitment` | Verification-only and prover/updater commitment capabilities, with built-in KZG and IPA backends. |
| `auth/arcset` | Canonical path and arcset representation. |
| `runtime/arctable` | Root-recoverable arcset persistence and materialization. |
| `runtime/arctable/bloom` | Optional negative-lookup optimization hook, disabled unless configured with a BloomCache. |
| `auth/semantic/list` | Public list semantic abstraction, shared types, and storage-free single-step `Commitment` primitives. |
| `runtime/semantic/list/tree` | Primary list runtime implementation, composing auth/list slot proofs with ArcTable-backed tree traversal. |
| `auth/semantic/mapping` | Public map semantic abstraction, shared types, binding CID encoding, and storage-free single-step `Commitment` primitives. |
| `runtime/semantic/mapping/radix` | Primary map runtime implementation, composing auth/mapping slot proofs with ArcTable-backed radix traversal. |
| `cmd/eval/internal/baseline/indexedmap` | Baseline comparison map implementation, not the current runtime map path. |
| `model/unixfs` | Pure UnixFS application model, manifests, path policy, chunk rules, and mutation plans. |
| `sdk/unixfs` | Client-side UnixFS staging, loading, upload planning, and authenticated range-body binding. |
| `runtime/unixfs` | Optional in-process UnixFS execution adapter over semantic and CAS ports. |
| `wire/maltcid` | Typed MALT map/list root CID helpers. |
| `storage/cas` | Content-addressed storage interfaces and adapters. |
| `cmd/cas` | Standalone local mock CAS HTTP server for development and controlled-latency evaluation. |
| `storage/kv` | Generic persistence adapters. |
| `graph/resolver` | Resolver read/proof port and explicit MALT path. |
| `graph/verifier` | Thin reference-runtime adapter over `auth/verifier`. |
| `graph/writer` | Mutation model and executor. |
| `graph` | Graph contracts around resolver and writer ports. |
| `runtime/graph` | Concrete graph runtime composition around resolver and writer executors. |
| `runtime/node` | Node/runtime factory. |
| `api/http` | HTTP DTOs and JSON contracts. |
| `sdk/client` | Thin reference-executor HTTP client; it is not the local trust boundary. |
| `sdk/verifier` | Authoritative local verifier envelope binding trusted root and caller-selected request expectations. |
| `reference/executor` | All-in-one untrusted reference backend used by CLI development and evaluation flows. |
| `daemon` | Process lifecycle management for the reference executor; not a client daemon. |
| `graph/querypath` | Root-relative query path canonicalization helper. |

`graph` is the graph boundary around resolver and writer ports. `runtime/graph`
wires concrete executors. Neither is the list/map semantic owner.

## Runtime Boundary

The reference executor, resolver adapters, ArcTable, graph runtime metadata, and caches are
untrusted execution state. They may affect latency or availability, but
accepted correctness comes from local verification against a trusted root.

MALT core does not define root freshness, latest-root discovery, global
availability, tenant policy, quota, ACL, pinning, garbage collection, or
multi-writer merge policy. Those belong to applications or deployments built
around MALT. Managed gateway service behavior now belongs in the separate
`DeWebProtocol/gateway` repository; this repository's reference executor remains a
reference runtime and evaluation surface for explicit-root behavior.
