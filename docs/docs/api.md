# Gateway API Boundaries

Gateway owns HTTP, authorization, persistence, payload storage and publication.
Core defines typed authentication requests, proofs, candidates and exact receipts.
Clients select an expected root and query, then verify the result locally.

| Current route | Purpose |
| --- | --- |
| `POST /v1/authentication/query` | Resolve explicit typed steps, prove a binding, or authenticate a byte range |
| `POST /v1/authentication/candidates` | Materialize a complete typed candidate in an unmanaged integration |
| `POST /v1/authentication/batches` | Atomically materialize an ordered candidate batch with an exact receipt |
| `POST /v1/cas` | Store payload bytes where the deployment permits unmanaged writes |

Managed access uses `/v1/buckets/{bucket}/authentication/...` and the applicable
Bucket ACL. The same-origin Console lives in the Gateway repository. Public
tools on this site send no account credentials. Token-bound evaluation routes
remain private to an explicitly selected loopback evaluator instance.
See the [Gateway route definitions](https://github.com/DeWebProtocol/gateway/blob/main/internal/server/server.go)
for deployment policy, including immutable CAS access.

```json
{
  "profile": "malt.authentication/1",
  "root": "<caller-selected MALT Root CID>",
  "steps": [],
  "operation": "resolve"
}
```

`steps` is always explicit. Label data is base64; positional and system numbers
use decimal strings. A binding request additionally selects `input`; a range
request supplies `start` and optionally `end`, with an exclusive end. The
[Core authentication contract](https://github.com/DeWebProtocol/malt-core/blob/v0.0.9/docs/spec/authentication-contracts.md)
is normative for schemas and verification.

Candidates use `malt.authentication/0`; batches use
`malt.authentication-batch/0`; receipts use `malt.authentication-receipt/0`.
An accepted receipt must bind the submitted transaction, base, root, batch
digest and durable boundary. It records materialization, not a portable proof
of a state transition or permission to promote a trusted root.

This source migration removes the retired Map/List adapters, Resolve/Read,
client-root and remote verifier entrypoints. No pre-beta compatibility layer
is retained. Browser package publication remains independently bound to an
exact published Core release; an immutable source pin is not a release.
