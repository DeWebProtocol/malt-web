# Runtime Model

MALT v0.0.6 separates trusted authentication semantics from untrusted
materialization and application behavior.

```text
trusted application client
  |  canonical segments / typed query / payload bytes
  v
untrusted gateway (ArcTable + KV + CAS + proof generation)
  |  result + ProofList + immutable bytes
  v
local MALT core verifier against a caller-selected root
```

## Core

MALT core defines roots, ArcSets, resolve/read operations, mutation values,
commitment algorithms, ProofLists, schemas, and verification. It can traverse
over an injected materializer capability, but it does not know how an ArcTable
is persisted and owns no CAS, HTTP server, CLI, daemon, or UnixFS package.

## Gateway

The gateway embeds core execution and implements the stateful materialization
boundary. Generic/reference deployments expose `POST /v1/resolve`,
`POST /v1/read`, and diagnostics; local unmanaged deployments may additionally
expose unscoped root, mutation, and CAS-write routes. Managed deployments use
authenticated Bucket-scoped routes for those persistence operations and
payload reads. Unauthenticated raw-CID `GET`/`HEAD` exists only in the
process-bound, loopback evaluation surface. See the
[Gateway API boundaries](/docs/api).

Internally it presents separate native MALT, CAS, and Merkle DAG compatibility
profiles over a per-scope composition. Root publication is managed policy
metadata rather than part of those proof contracts.

It does not choose which root a reader trusts. Diagnostic verify routes are
useful for integration checks but cannot replace client-side verification.

## Client

`malt-client` is the native CLI/daemon application. Its current package split
separates untrusted transport, accepted/candidate root policy, UnixFS behavior,
and Merkle DAG compatibility. The managed browser application is
`DeWebProtocol/gateway/console`; this site does not ship it. Both trusted
clients own application path parsing and UnixFS semantics, pass segment arrays
to the gateway, verify ProofLists locally, and bind bytes to authenticated
CIDs.

`/` is therefore a UnixFS/HTTP presentation detail. MALT core operates on
segments and canonical arcs; it does not interpret `/`, `.`, or `[]` as a
universal application separator.

Mutation results remain candidate roots because v0.0.6 has no authenticated
state-transition proof. Explicit acceptance or an independent publication
policy establishes the next trusted root.
