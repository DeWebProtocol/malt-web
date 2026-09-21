# Runtime and Repository Boundaries

MALT separates an application-neutral authentication Core, an optional untrusted
Gateway, and a user-controlled local runtime. The current source integration
uses typed authentication; release pins are independent from this source change.

## MALT Core SDK

[`DeWebProtocol/malt-core`](https://github.com/DeWebProtocol/malt-core) owns
`auth/input`, the coordinate authentication tree under `auth/tree`,
`auth/engine`, `traversal`, `sdk/authentication`, commitment backends,
canonical Root CIDs, wire schemas and local verification. Algorithms consume
narrow capabilities in `auth/arcset/materializer`. The old Map/List adapters,
module-root facade, aggregate Store and Resolve/Read/client-root APIs are removed.
Core does not own ArcTable persistence, CAS, HTTP, UnixFS or trust policy.

## Gateway

[`DeWebProtocol/gateway`](https://github.com/DeWebProtocol/gateway) is an
optional untrusted hosted executor and storage gateway. It embeds the Core
executor and owns concrete ArcTable/KV/CAS implementations. It exposes
typed authentication queries and candidate/batch routes.
When managed accounts are disabled, local integrations may also expose
unscoped candidate materialization and CAS-write routes. Managed deployments use
authenticated, ACL-protected Bucket routes for queries, writes and
materialization. Nginx serves immutable `GET|HEAD /api/v1/cas/{cid}` reads
without credentials; Console hashes returned bytes against authenticated CIDs.
The runtime composes separate native MALT, CAS and Merkle DAG compatibility
profiles per execution scope. Named-root publication is a separate managed
policy registry and never selects the Root of an authentication request. The
[Gateway repository](https://github.com/DeWebProtocol/gateway) is the source of
truth for route registration and managed-service policy.

Process-bound evaluation instances additionally expose token-protected path,
CAR, typed candidate-graph and exact authentication-batch routes. Those routes
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
typed authentication results, binds returned payload bytes to authenticated CIDs, and
keeps gateway-produced roots as candidates until explicit acceptance. It can
also import IPFS-compatible Merkle DAG UnixFS with
`malt add --target merkle-dag`; that compatibility target returns a DAG CID and
does not claim a MALT root or ProofList.

Gateway HTTP currently supplies native authentication, exact batch receipts, Bucket-head,
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
uses same-origin `/api` with authenticated Bucket queries and immutable CID
reads, and verifies with the WASM integration artifact built from Core. UnixFS preview/upload logic
stays in that browser client instead of becoming a gateway or core route. This
repository ships the public documentation and verifier tools, not the managed
Console.

## Package Map

| Repository/package | Responsibility |
|---|---|
| `malt-core/protocol` | Typed authentication serialization and schemas |
| `malt-core/auth/arcset` | Canonical ArcSet values |
| `malt-core/auth/arcset/materializer` | Narrow lookup/update/snapshot/iteration capabilities, no persistence format |
| `malt-core/auth/tree` | Coordinate authentication trees and proofs |
| `malt-core/auth/input`, `malt-core/auth/engine` | Typed inputs and descriptor-bound authentication |
| `malt-core/traversal` | Explicit typed graph traversal |
| `malt-core/sdk/authentication` | Typed queries, retained candidate computation, batch and receipt checks |
| `gateway/internal/arctable`, `gateway/internal/kv` | Persistent materialization owned by the service |
| `gateway/internal/backend/embedded` | Embedded untrusted core execution and CAS |
| `gateway/internal/runtime`, `gateway/internal/profile/*` | Per-scope composition and isolated native/CAS/compatibility ports |
| `gateway/internal/policy/publication` | Named-root revision metadata and freeze policy; not client trust |
| `malt/cmd/malt`, `malt/internal/runtime` | CLI/daemon adapters and reusable process composition |
| `malt/application/*` | Shared backup, sync, root, mount, and verified write-back use cases |
| `malt/transport/capability` | URL-free CAS/BatchCAS, Authentication/AuthenticationWriter/AuthenticationBatch and DatasetBranch ports |
| `malt/transport`, `malt/transport/local`, `malt/transport/hybrid` | Untrusted Gateway HTTP plus durable local and verified hybrid CAS adapters |
| `malt/trust`, `malt/cache`, `malt/journal` | Separate accepted/candidate/observed roots, non-authoritative cache, and durable operation intent |
| `malt/filesystem/service`, `malt/filesystem/staging` | Root-bound verified reads and crash-recoverable local dirty overlay |
| `malt/filesystem/mount`, `malt/filesystem/platform/fuse` | Daemon-managed mount lifecycle and the outer Linux syscall adapter |
| `malt/unixfs/*` | UnixFS application rules and payload verification |
| `malt/merkledag/*` | Merkle DAG import and local CID/link replay compatibility |
| `malt/tools/evaluation`, `malt/internal/evaluation` | Private cross-repository workers and process-bound measurement transport |

## Mutation Limit

Typed writers compute candidate roots locally. An exact authentication-batch
receipt acknowledges durable materialization of the submitted candidates; it
is not a portable authenticated state-transition proof. Gateway publication can name and freeze a root, but
does not make it trusted automatically; clients must explicitly accept or
independently authenticate each new trusted root.

The browser verifier's
[provenance record](/verifier/PROVENANCE.json) identifies the exact MALT commit
and Go toolchain used to build the deployed WASM. That integration identity,
rather than the website version, determines which typed Root codecs the
artifact accepts.
