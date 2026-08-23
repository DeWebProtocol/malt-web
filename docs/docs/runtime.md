# Runtime and Repository Boundaries

The current public Core release is
[malt-core v0.0.8](https://github.com/DeWebProtocol/malt-core/releases/tag/v0.0.8).
It establishes a three-part product boundary: an application-neutral Core, an
optional untrusted gateway/executor, and a user-controlled local runtime.
The runtime, evaluator, and browser verifier retain their exact `v0.0.7`
migration/provenance baseline; Gateway pins the later `v0.0.8` Map-proof
performance update. `v0.0.8` changes no roots, CIDs, ProofLists, transcripts,
schemas, receipts, or wire encodings.

## MALT Core SDK

[`DeWebProtocol/malt-core`](https://github.com/DeWebProtocol/malt-core) owns
the normative authentication surface:

- canonical segments, arcs, ArcSets, roots, and typed CIDs;
- resolve/read/mutation values and language-neutral schemas;
- commitment backends and list/map algorithms;
- ProofList generation/verification semantics;
- application-neutral client-root view, intent, bundle, and receipt profiles;
- the local verifier and browser WASM build.

The module-root facade exposes `ResolveRequest`, `ResolveResult`,
`VerifyResolve`, typed read values, and `VerifyRead`. Core algorithms consume
the narrowest injected capability they need from
`auth/arcset/materializer`: coordinate lookup, root-relative update, snapshot,
or iteration. The aggregate `Store` remains a compatibility/conformance
interface rather than a production-algorithm dependency. Core does not define
a persistent ArcTable format, CAS, HTTP, CLI, daemon, UnixFS, or service
policy.

## Gateway

[`DeWebProtocol/gateway`](https://github.com/DeWebProtocol/gateway) is an
optional untrusted hosted executor and storage gateway. It embeds the Core
executor and owns concrete ArcTable/KV/CAS implementations. It exposes
generic resolve/read and diagnostic routes for reference and evaluation use.
When managed accounts are disabled, local integrations may also expose
unscoped root-creation, mutation, and CAS-write routes. Managed deployments use
authenticated, ACL-protected Bucket routes for native MALT persistence and
payload materialization; they do not expose unauthenticated raw-CID reads. Its
runtime composes separate native MALT, CAS, and Merkle DAG compatibility
profiles per execution scope. Named-root publication is a separate managed
policy registry and never selects the root of a resolve/read request. The
[Gateway repository](https://github.com/DeWebProtocol/gateway) is the source of
truth for route registration and managed-service policy.

Process-bound evaluation instances additionally expose token-protected path,
CAR, update-view, and exact client-root materialization routes. Those routes
exist to reproduce cross-repository measurements; they are not production
Gateway APIs, Bucket synchronization operations, or client trust promotion.

The gateway is a proof producer and storage service, not a correctness
authority. A client supplies the root it trusts and checks every accepted
result locally.

## User-Controlled Local Runtime

[`DeWebProtocol/malt`](https://github.com/DeWebProtocol/malt)
is the source repository for the MALT local data runtime.
The Go module remains `github.com/dewebprotocol/malt-client` during the initial
runtime refactor. The runtime owns the `malt` CLI and local daemon, and its
current package structure separates `transport`, `trust`, `unixfs`, and
`merkledag` so untrusted I/O, root policy, MALT-authenticated UnixFS, and
CID/link replay remain independently reviewable. The runtime parses UnixFS `/`
paths into segment arrays, verifies
resolve/read results, binds returned payload bytes to authenticated CIDs, and
keeps gateway-produced roots as candidates until explicit acceptance. It can
also import IPFS-compatible Merkle DAG UnixFS with
`malt add --target merkle-dag`; that compatibility target returns a DAG CID and
does not claim a MALT root or ProofList.

Gateway HTTP currently supplies native resolve/read, mutation, Bucket-head,
and remote CAS capabilities. The CAS plane can instead select a bounded durable
local store or a Gateway-primary, CID-verifying read-through hybrid. On Linux,
the daemon can mount an accepted remote Bucket view through FUSE, read-only by
default or with an explicit write-back policy; local staging, fsync journaling,
candidate computation, and accepted-root promotion remain separate. A peer
network transport and non-Linux mount adapters are future work. Every transport
shares the same local verifier and cannot promote an observed remote head
directly into an accepted root.

Runtime-owned evaluator workers live under
`malt/tools/evaluation/cmd`, and their private Gateway bootstrap and raw
measurement transport live under `malt/internal/evaluation`. They are
not part of the `malt` CLI or reusable production transport surface.

The managed Gateway Console is another client. It lives in
[`gateway/console`](https://github.com/DeWebProtocol/gateway/tree/main/console),
uses same-origin `/api` plus authenticated Bucket-scoped routes, and verifies
with the WASM integration artifact built from Core. UnixFS preview/upload logic
stays in that browser client instead of becoming a gateway or core route. This
repository ships the public documentation and verifier tools, not the managed
Console.

## Package Map

| Repository/package | Responsibility |
|---|---|
| `malt-core` module root | Trusted operation values and verification facade |
| `malt-core/protocol` | Profiled resolve/read serialization and schemas |
| `malt-core/auth/arcset` | Canonical ArcSet values |
| `malt-core/auth/arcset/materializer` | Narrow lookup/update/snapshot/iteration capabilities, no persistence format |
| `malt-core/auth/verifier` | Portable ProofList verification kernel |
| `malt-core/auth/semantic/*` | Application-neutral map/list semantics and algorithms |
| `malt-core/graph/*`, `malt-core/execution` | Generic resolver/writer/executor composition |
| `malt-core/sdk/writer` | Application-neutral client-root computation and exact materialization-session checks |
| `gateway/internal/arctable`, `gateway/internal/kv` | Persistent materialization owned by the service |
| `gateway/internal/backend/embedded` | Embedded untrusted core execution and CAS |
| `gateway/internal/runtime`, `gateway/internal/profile/*` | Per-scope composition and isolated native/CAS/compatibility ports |
| `gateway/internal/policy/publication` | Named-root revision metadata and freeze policy; not client trust |
| `malt/cmd/malt`, `malt/internal/runtime` | CLI/daemon adapters and reusable process composition |
| `malt/application/*` | Shared backup, sync, root, mount, and verified write-back use cases |
| `malt/transport/capability` | URL-free semantic Native/CAS/Mutation/DatasetBranch ports |
| `malt/transport`, `malt/transport/local`, `malt/transport/hybrid` | Untrusted Gateway HTTP plus durable local and verified hybrid CAS adapters |
| `malt/trust`, `malt/cache`, `malt/journal` | Separate accepted/candidate/observed roots, non-authoritative cache, and durable operation intent |
| `malt/filesystem/service`, `malt/filesystem/staging` | Root-bound verified reads and crash-recoverable local dirty overlay |
| `malt/filesystem/mount`, `malt/filesystem/platform/fuse` | Daemon-managed mount lifecycle and the outer Linux syscall adapter |
| `malt/unixfs/*` | UnixFS application rules and payload verification |
| `malt/merkledag/*` | Merkle DAG import and local CID/link replay compatibility |
| `malt/tools/evaluation`, `malt/internal/evaluation` | Private cross-repository workers and process-bound measurement transport |
| `malt-core/sdk/verifier` | Local trusted verifier envelope, including WASM export |

## Mutation Limit

Mutation receipts report operational work and a candidate root. The newer
Core client-root profiles can bind exact local computation to exact
materialization, but neither receipt is a portable authenticated
state-transition proof. Gateway publication can name and freeze a root, but
does not make it trusted automatically; clients must explicitly accept or
independently authenticate each new trusted root.

The browser verifier's
[provenance record](/verifier/PROVENANCE.json) identifies the exact MALT commit
and Go toolchain used to build the deployed WASM. That integration identity,
not the website's current-release badge, determines which typed Root codecs the
artifact accepts.
