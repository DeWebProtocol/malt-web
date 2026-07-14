# Runtime and Repository Boundaries

The current source release is
[MALT v0.0.6](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.6). It
establishes a three-part product boundary: an SDK-only core, an untrusted
gateway, and trusted application clients.

## MALT Core SDK

[`DeWebProtocol/malt`](https://github.com/DeWebProtocol/malt) owns the normative
authentication surface:

- canonical segments, arcs, ArcSets, roots, and typed CIDs;
- resolve/read/mutation values and language-neutral schemas;
- commitment backends and list/map algorithms;
- ProofList generation/verification semantics;
- the local verifier and browser WASM build.

The module-root facade exposes `ResolveRequest`, `ResolveResult`,
`VerifyResolve`, typed read values, and `VerifyRead`. Core algorithms consume an
injected `auth/arcset/materializer.Store`; core does not define a persistent
ArcTable format, CAS, HTTP, CLI, daemon, UnixFS, or service policy.

## Gateway

[`DeWebProtocol/gateway`](https://github.com/DeWebProtocol/gateway) embeds the
core executor and owns concrete ArcTable/KV/CAS implementations. It exposes
generic resolve, read, mutation, root-creation, CAS, and diagnostic routes.

The gateway is a proof producer and storage service, not a correctness
authority. A client supplies the root it trusts and checks every accepted
result locally.

## Trusted Clients

[`DeWebProtocol/malt-client`](https://github.com/DeWebProtocol/malt-client)
owns the `malt` CLI, local trusted-root daemon, gateway transport, and UnixFS
application model. It parses UnixFS `/` paths into segment arrays, verifies
resolve/read results, binds returned payload bytes to authenticated CIDs, and
keeps gateway-produced roots as candidates until explicit acceptance.

This Web App is another client. It uses the same generic gateway routes and the
WASM verifier built from core. UnixFS preview/upload logic stays in the browser
client instead of becoming a gateway or core route.

## Package Map

| Repository/package | Responsibility |
|---|---|
| `malt` module root | Trusted operation values and verification facade |
| `malt/protocol` | Profiled resolve/read serialization and schemas |
| `malt/auth/arcset` | Canonical ArcSet values |
| `malt/auth/arcset/materializer` | Injected materialization capability, no persistence format |
| `malt/auth/verifier` | Portable ProofList verification kernel |
| `malt/auth/semantic/*` | Application-neutral map/list semantics and algorithms |
| `malt/graph/*`, `malt/execution` | Generic resolver/writer/executor composition |
| `gateway/internal/arctable`, `gateway/internal/kv` | Persistent materialization owned by the service |
| `gateway/internal/backend/embedded` | Embedded untrusted core execution and CAS |
| `malt-client/cmd/malt` | CLI and local daemon lifecycle |
| `malt-client/unixfs/*` | UnixFS application rules and payload verification |
| `malt/sdk/verifier` | Local trusted verifier envelope, including WASM export |

## Mutation Limit

Mutation receipts report operational work and a candidate root. They are not
state-transition proofs. Until a transition-proof or independent publication
protocol exists, clients must explicitly accept or independently obtain each
new trusted root.

The browser verifier's
[provenance record](/verifier/PROVENANCE.json) identifies the exact MALT commit
and Go toolchain used to build the deployed WASM.
