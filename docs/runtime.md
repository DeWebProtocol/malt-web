# Server Runtime Model

The MALT server runtime composes root-relative resolver and writer ports. It is
a performance-critical component, not a correctness authority or semantic owner.

For concrete prototype routes, see [Root-Centric HTTP API](/docs/api). For
verifier-facing evidence, see [ProofLists](/docs/prooflists).

Released behavior is pinned to MALT `v0.0.4`. The tightened package split and
reference-executor naming are the active target of
[draft PR #163](https://github.com/DeWebProtocol/malt/pull/163) at
`d3598cd`; this page uses those draft role names where it discusses
the intended boundary.

## Roles

<div class="malt-flow">
  <div class="malt-flow-card">
    <strong>Writer client</strong>
    <p>Turns source-domain data into list or map semantic mutations, computes or requests a new root, and publishes that root through application policy.</p>
  </div>
  <div class="malt-flow-card">
    <strong>Server runtime</strong>
    <p>Applies writer mutations, accelerates root-relative queries, and assembles ProofLists for caller-supplied roots.</p>
  </div>
  <div class="malt-flow-card">
    <strong>Reader client</strong>
    <p>Obtains a trusted root, queries any server runtime, and verifies result plus ProofList locally.</p>
  </div>
</div>

## Correctness Boundary

The server runtime does not:

- own authoritative heads
- choose the latest root
- guarantee freshness
- arbitrate concurrent writers
- define tenant, quota, ACL, pinning, or garbage-collection policy
- act as the production managed gateway; that belongs in `DeWebProtocol/gateway`

The server runtime does:

- apply semantic mutations for explicit roots
- answer root-relative queries
- return `result + ProofList`
- support local client verification

The operation-specific gateway projection is `POST /v1/resolve` and
`POST /v1/read`. Reference GET/content routes remain UnixFS and local-runtime
adapters.

The resolver owns traversal and `ProofList` assembly. The writer owns mutation
application and receipts. List/map interfaces and authenticated operations stay
under the semantic layer rather than being redefined as graph node interfaces.

## Local CAS Boundary

The reference executor uses an external CAS endpoint from `cas.base_url`; the
current prototype no longer embeds mock CAS inside the `malt` process. For local
development, build the standalone `cas` binary from `cmd/cas` and run it as the
local Kubo-compatible mock CAS service, usually at `http://127.0.0.1:4318`.
`cas` is its own CLI, not a `malt` subcommand.

## HTTP Shape

The current prototype exposes root-centric HTTP reads such as:

```text
GET|HEAD /{root}/{path...}
GET /resolve/{root}[/{path...}]
```

Successful file, directory, and range reads can carry verifier-facing proof
metadata in response headers:

```text
X-Malt-ProofList: <base64url(JSON ProofList)>
X-Malt-ProofList-Encoding: base64url-json
Vary: X-Malt-Proof
```

Clients that only need bytes can opt out of default proof generation with
`?proof=false` or `X-Malt-Proof: omit`.

Root-scoped writes and root creation are documented in the
[HTTP API](/docs/api), including the
[Semantic Mutation Contract](/docs/api#semantic-mutation-contract). The server
runtime still does not own authoritative heads or freshness policy.
