# Runtime and Repository Boundaries

The current public Core release is
[MALT v0.0.6](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.6). It
establishes a three-part product boundary: an SDK-only core, an untrusted
gateway, and trusted application clients. Gateway, client, evaluator, and
browser-verifier integration artifacts may select a later reviewed Core
commit; each integration records that exact source independently of the public
release label.

## MALT Core SDK

[`DeWebProtocol/malt`](https://github.com/DeWebProtocol/malt) owns the normative
authentication surface:

- canonical segments, arcs, ArcSets, roots, and typed CIDs;
- resolve/read/mutation values and language-neutral schemas;
- commitment backends and list/map algorithms;
- ProofList generation/verification semantics;
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

[`DeWebProtocol/gateway`](https://github.com/DeWebProtocol/gateway) embeds the
core executor and owns concrete ArcTable/KV/CAS implementations. It exposes
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

The gateway is a proof producer and storage service, not a correctness
authority. A client supplies the root it trusts and checks every accepted
result locally.

## Trusted Clients

[`DeWebProtocol/malt-client`](https://github.com/DeWebProtocol/malt-client)
owns the `malt` CLI and local daemon. Its current package structure separates
`transport`, `trust`, `unixfs`, and `merkledag` so untrusted I/O, root policy,
MALT-authenticated UnixFS, and CID/link replay remain independently reviewable.
The client parses UnixFS `/` paths into segment arrays, verifies
resolve/read results, binds returned payload bytes to authenticated CIDs, and
keeps gateway-produced roots as candidates until explicit acceptance. It can
also import IPFS-compatible Merkle DAG UnixFS with
`malt add --target merkle-dag`; that compatibility target returns a DAG CID and
does not claim a MALT root or ProofList.

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
| `malt` module root | Trusted operation values and verification facade |
| `malt/protocol` | Profiled resolve/read serialization and schemas |
| `malt/auth/arcset` | Canonical ArcSet values |
| `malt/auth/arcset/materializer` | Narrow lookup/update/snapshot/iteration capabilities, no persistence format |
| `malt/auth/verifier` | Portable ProofList verification kernel |
| `malt/auth/semantic/*` | Application-neutral map/list semantics and algorithms |
| `malt/graph/*`, `malt/execution` | Generic resolver/writer/executor composition |
| `gateway/internal/arctable`, `gateway/internal/kv` | Persistent materialization owned by the service |
| `gateway/internal/backend/embedded` | Embedded untrusted core execution and CAS |
| `gateway/internal/runtime`, `gateway/internal/profile/*` | Per-scope composition and isolated native/CAS/compatibility ports |
| `gateway/internal/policy/publication` | Named-root revision metadata and freeze policy; not client trust |
| `malt-client/cmd/malt` | CLI and local daemon lifecycle |
| `malt-client/transport`, `malt-client/trust` | Untrusted HTTP capabilities and explicit accepted/candidate policy |
| `malt-client/unixfs/*` | UnixFS application rules and payload verification |
| `malt-client/merkledag/*` | Merkle DAG import and local CID/link replay compatibility |
| `malt/sdk/verifier` | Local trusted verifier envelope, including WASM export |

## Mutation Limit

Mutation receipts report operational work and a candidate root. They are not
state-transition proofs. Gateway publication can name and freeze a root, but
does not make it trusted automatically; clients must explicitly accept or
independently authenticate each new trusted root.

The browser verifier's
[provenance record](/verifier/PROVENANCE.json) identifies the exact MALT commit
and Go toolchain used to build the deployed WASM. That integration identity,
not the website's v0.0.6 release badge, determines which typed Root codecs the
artifact accepts.
