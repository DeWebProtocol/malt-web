# Runtime and Repository Boundaries

MALT separates an application-neutral authentication Core, an optional untrusted
Gateway, and a user-controlled local runtime. The current source integration
uses typed authentication; release pins are independent from this source change.

## MALT Core SDK

[`DeWebProtocol/malt-core`](https://github.com/DeWebProtocol/malt-core) owns
`derivation`, the coordinate authentication tree under `auth/tree`,
`engine`, `traversal`, `sdk/authentication`, commitment backends,
canonical Root CIDs, wire schemas and local verification. Algorithms consume
narrow capabilities in `auth/arcset/materializer`. The old Map/List adapters,
module-root facade, aggregate Store and Resolve/Read/client-root APIs are removed.
Core does not own ArcTable persistence, CAS, HTTP, UnixFS or trust policy.

Core `v0.0.10-rc.3` adds the optional [`sdk/object`
API](https://github.com/DeWebProtocol/malt-core/blob/v0.0.10-rc.3/docs/guides/objects.md).
Applications can compose Maps, Lists, immutable byte leaves and custom structs,
commit their reachable references, then collect graph deltas for storage.
These constructors use the current Prefix/Positional authentication contracts;
they do not restore the retired Map/List facade or define another wire format.
Persistence, publication and accepted-root policy remain with the caller.

[`malt-ts`](https://github.com/DeWebProtocol/malt-ts) owns the supported
TypeScript/JavaScript API, browser Workers and reproducible WASM distribution.
Its API is separate from the Go Object API. Both this site's verifier and the
Gateway Console now pin SDK `0.0.3-rc.3`, bound to published Core rc.3.

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

The gateway is a proof producer and storage service, not a correctness
authority. A client supplies the root it trusts and checks every accepted
result locally.

## Public Node API

The runtime's [`nodeapi`](https://github.com/DeWebProtocol/malt/blob/44bd537d50bb49e74c0a01d274890e9af43de3a0/docs/node-api.md)
package defines shared, transport-independent authentication, CAS and dataset
capabilities above Core. Gateway in-process services and the HTTP client
implement the same contracts; local and hybrid adapters implement CAS.
Managed service implementations enforce caller authority and Bucket lifecycle
for each operation. Local trusted-root policy remains separate.

Materialization, branch publication, observing a remote head and accepting a
Root are distinct operations. This common API does not by itself supply a full
offline native authentication store or a new replication engine. The retired
`transport/capability` packages have been replaced by `nodeapi` and its reusable
`nodeapi/nodetest` contract suites.

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

The managed Gateway Console is another client. It lives in
[`gateway/console`](https://github.com/DeWebProtocol/gateway/tree/main/console),
uses same-origin `/api` with authenticated Bucket queries and immutable CID
reads, and verifies with WASM assets built and distributed by malt-ts against an exact
published Core release. UnixFS preview/upload logic
stays in that browser client instead of becoming a gateway or core route. This
repository ships the public documentation and verifier tools, not the managed
Console.

## Package Map

| Repository/package | Responsibility |
|---|---|
| `malt-ts` | TypeScript API, WASM compilation and distribution, browser Worker lifecycle |
| `malt-core/protocol` | Typed authentication serialization and schemas |
| `malt-core/auth/arcset` | Canonical ArcSet values |
| `malt-core/auth/arcset/materializer` | Narrow lookup/update/snapshot/iteration capabilities, no persistence format |
| `malt-core/auth/tree` | Coordinate authentication trees and proofs |
| `malt-core/derivation`, `malt-core/engine` | Coordinate derivation and descriptor-bound authentication |
| `malt-core/traversal` | Explicit typed graph traversal |
| `malt-core/sdk/authentication` | Typed queries, retained candidate computation, batch and receipt checks |
| `malt-core/sdk/object` | Optional Map/List/Immutable and custom-object construction over current authentication |
| `gateway/internal/arctable`, `gateway/internal/kv` | Persistent materialization owned by the service |
| `gateway/internal/backend/embedded` | Embedded untrusted core execution and CAS |
| `gateway/internal/runtime`, `gateway/internal/profile/*` | Per-scope composition and isolated native/CAS/compatibility ports |
| `gateway/internal/policy/publication` | Named-root revision metadata and freeze policy; not client trust |
| `malt/cmd/malt`, `malt/internal/runtime` | CLI/daemon adapters and reusable process composition |
| `malt/application/*` | Shared backup, sync, root, mount, and verified write-back use cases |
| `malt/nodeapi`, `malt/nodeapi/nodetest` | Shared authentication/CAS/dataset capabilities and contract suites |
| `malt/transport`, `malt/transport/local`, `malt/transport/hybrid` | Untrusted Gateway HTTP plus durable local and verified hybrid CAS adapters |
| `malt/trust`, `malt/cache`, `malt/journal` | Separate accepted/candidate/observed roots, non-authoritative cache, and durable operation intent |
| `malt/filesystem/service`, `malt/filesystem/staging` | Root-bound verified reads and crash-recoverable local dirty overlay |
| `malt/filesystem/mount`, `malt/filesystem/platform/fuse` | Daemon-managed mount lifecycle and the outer Linux syscall adapter |
| `malt/unixfs/*` | UnixFS application rules and payload verification |
| `malt/merkledag/*` | Merkle DAG import and local CID/link replay compatibility |
| `malt-evaluation` | Experiment protocol, raw artifacts, analysis and reproducible measurement provenance |

## Mutation Limit

Typed writers compute candidate roots locally. An exact authentication-batch
receipt acknowledges durable materialization of the submitted candidates; it
is not a portable authenticated state-transition proof. Gateway publication can name and freeze a root, but
does not make it trusted automatically; clients must explicitly accept or
independently authenticate each new trusted root.

The browser verifier's
[provenance record](/verifier/PROVENANCE.json) identifies malt-ts build inputs, its exact Core dependency, and the Go toolchain
used to build the deployed WASM. That integration identity,
rather than the website version, determines which typed Root codecs the
artifact accepts.
