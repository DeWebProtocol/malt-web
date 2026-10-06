# Public Service Boundary

MALT Core authenticates relationships relative to a caller-selected Root and
query. The optional Gateway supplies storage, execution and managed service
access. The local runtime and browser clients verify the evidence and returned
payload bytes.

## Website and Console

This VitePress site provides public explanations, tutorials and browser proof
tools. Its source is `malt-web/docs`.

The [Gateway Console](https://gateway.deweb.world) is maintained in
`gateway/console`, alongside the Gateway service. It is built independently
from the Go service binary and uses same-origin `/api` routes. The supported
browser authentication SDK and WASM assets come from
[malt-ts](https://github.com/DeWebProtocol/malt-ts).

The local [MALT runtime](https://github.com/DeWebProtocol/malt) is another
client: it owns the CLI/daemon, local trust state, UnixFS behavior and
verification. There is no separate managed Console repository.

## Managed Access

The managed Console provides account sign-in, Bucket selection, file browsing
and uploads. Gateway owns identity, authorization, quotas, service administration
and branch publication. Bucket permissions and service-administrator access
are separate authorities.

Shared authentication, CAS and dataset capabilities follow the runtime's
[public Node API](https://github.com/DeWebProtocol/malt/blob/44bd537d50bb49e74c0a01d274890e9af43de3a0/docs/node-api.md).
Gateway services apply the caller's permissions and Bucket lifecycle to each
operation. Reader permits queries and reads; candidate export, materialization
and publication require Writer.

A materialization receipt acknowledges persistence at the selected service.
Publishing a branch or observing its head does not accept that Root on behalf
of the client. Concurrent publication may preserve a candidate on a conflict
branch; the application must check the result bound to its original request.

## Snapshot Reads and Payloads

The Console keeps its selected browsing snapshot separate from a newly
observed head. A head notification prompts an explicit refresh. Proofs are
checked against the selected Root and exact query; payload blocks are checked
against authenticated CIDs. Browser HTTP cache hits alone do not establish
verification.

Managed Bucket proof queries require authorization. In the current managed
edge design, immutable payloads are separately readable by CID through
`GET|HEAD /api/v1/cas/{cid}`. Store ciphertext or intentionally public bytes
on that public delivery path. Bucket ACL changes affect later authorized
service calls, but cannot recall a public CID download, cached response or
bytes already held by a client. Complete shared-snapshot and cache revocation
policy remains deferred.

These are source-level service boundaries. The Gateway repository owns the
[immutable-read contract](https://github.com/DeWebProtocol/gateway/blob/c059bea7a179e3c1f7f7ae740d6fb1d50a63cc59/docs/immutable-reads.md)
and deployment procedures; access to that service repository is restricted.
A source commit or successful build does not establish which version a live
deployment runs.

## Ownership

| Surface | Owner |
| --- | --- |
| Protocol, Root formats, proofs and local authentication | MALT Core |
| Browser API, Workers and distributed WASM | malt-ts |
| Public website, explanations and proof tools | malt-web |
| Managed service and account/Bucket Console | Gateway |
| Local accepted roots, CLI/daemon and UnixFS | MALT runtime |
| Reproducible experiments and result provenance | malt-evaluation |

See [Runtime and Repository Boundaries](/docs/runtime) for the implementation
map and [Gateway API Boundaries](/docs/api) for typed HTTP requests.
