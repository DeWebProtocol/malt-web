# Gateway API Boundaries

The Gateway embeds the untrusted graph executor and owns concrete
ArcTable/KV/CAS persistence. It returns candidate results and proofs; clients
decide trust locally. The HTTP surface depends on the deployment mode:

| Surface | Purpose | Persistence and payload routes |
| --- | --- | --- |
| Generic/reference | Local integration and protocol diagnostics, commonly at `http://127.0.0.1:8080` | Resolve/read are unscoped; unmanaged local deployments may also enable unscoped root, mutation, and CAS writes |
| Process-bound evaluation | Reproducible evaluator instances on loopback | Adds token-bound evaluation routes and the only unscoped raw-CID `GET`/`HEAD` |
| Managed Bucket | Account/API-key clients and the same-origin Gateway Console | Uses authenticated, ACL-protected `/v1/buckets/{bucket}/...` routes; there is no public raw-CID read |

The managed Console lives in
[`DeWebProtocol/gateway/console`](https://github.com/DeWebProtocol/gateway/tree/main/console)
and sends same-origin requests through `/api`. This website ships public
documentation and verifier tools, not that Console.

[MALT v0.0.6](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.6)
remains the public Core release baseline. A current Gateway integration may pin
a later reviewed Core commit in its `go.mod`; that exact integration and route
registration are defined by the
[Gateway repository](https://github.com/DeWebProtocol/gateway). Normative
resolve/read schemas remain in the
[MALT Core repository](https://github.com/DeWebProtocol/malt/tree/main/docs/spec).

## Resolve and Read

```text
POST /v1/resolve
POST /v1/read

POST /v1/buckets/{bucket}/resolve
POST /v1/buckets/{bucket}/read
```

The first pair is the generic/reference surface. The Bucket pair carries the
same Core request profiles through managed authentication, authorization, and
scope policy.

Resolve accepts a caller-selected root and an array of application-produced
segments:

```json
{
  "profile": "malt.resolve/v0alpha1",
  "root": "<trusted MALT root>",
  "segments": ["a", "b", "@payload"]
}
```

It returns an untrusted target and ProofList. `segments: []` means strict root
identity. A resolver may group segments into authenticated arcs in more than
one valid way; verification proves the returned derivation, not that it was
longest or unique.

Read accepts one primitive typed query:

```json
{
  "profile": "malt.read/v0alpha1",
  "root": "<typed map or list root>",
  "query": {"kind": "map_key", "segments": ["account", "name"]}
}
```

Other query kinds are `list_index` and `list_range`. Clients construct the
expected request themselves and verify `{request, result}` locally with MALT
core or the published WASM verifier.

## Diagnostic Verification

```text
POST /v1/verify/resolve
POST /v1/verify/read
```

These endpoints are for conformance and troubleshooting. Responses carry
`X-Malt-Verification-Role: diagnostic`; they are not trust oracles and do not
replace local verification.

## CAS

An unmanaged local/reference deployment may expose these write routes:

```text
POST /v1/cas?codec=<multicodec>
POST /v1/cas/batch
```

`POST /v1/cas` accepts an immutable payload body up to 64 MiB and returns
`201 Created` with `{"cid":"..."}`. The generic
`POST /v1/cas/has` presence-check route returns no bytes and is not a
persistence write. Managed deployments do not register the two unscoped CAS
write routes above. Their product surface is:

```text
POST      /v1/buckets/{bucket}/cas
POST      /v1/buckets/{bucket}/cas/batch
POST      /v1/buckets/{bucket}/cas/has
GET, HEAD /v1/buckets/{bucket}/cas/{cid}
```

Bucket CAS reads require a cookie session or API key and a matching Bucket ACL.
They return `Cache-Control: no-store` and are a private payload-materialization
transport, not a public CID gateway, publication mechanism, or trust boundary.
Knowing a CID does not grant access to another Bucket.

The production Gateway deliberately does not expose unauthenticated
`GET /v1/cas/{cid}` or `HEAD /v1/cas/{cid}`. Those exact unscoped read routes
exist only when a process-bound loopback evaluation instance is enabled, and
the evaluator must present its instance token. They are not a deployed
application API.

Clients still hash every returned block and compare it with the authenticated
CID before use.

CAS stores payload bytes; it does not define MALT authentication semantics.

## Create a Structure

```text
POST /v1/roots
POST /v1/buckets/{bucket}/roots
```

The unscoped route is available only in an unmanaged local/reference
deployment. Managed clients use the Bucket-scoped route.

The request contains a canonical arc map:

```json
{
  "arcs": {
    "@payload": "<payload CID>",
    "docs/readme.md": "<target CID>"
  }
}
```

The response is `201 Created` with `{"root":"<new root>"}`. The returned root
is an untrusted candidate until the caller explicitly accepts it or verifies an
independent publication/transition policy.

## Semantic Mutation Contract

```text
POST /v1/roots/{root}/mutations
POST /v1/buckets/{bucket}/roots/{root}/mutations
```

`{root}` is the caller-selected base root. The request contains typed map/list
deltas with canonical coordinate changes and optional replay constraints. As
with root creation, the first route is unmanaged/reference and the second is
the authenticated managed persistence surface:

```json
{
  "deltas": [
    {
      "kind": "map",
      "object": "<optional semantic-object CID>",
      "changes": [
        {
          "path": "docs/readme.md",
          "before": {"target": "<old CID>", "target_kind": "cas"},
          "after": {"target": "<new CID>", "target_kind": "cas"}
        }
      ]
    }
  ]
}
```

A successful mutation returns `201 Created` with an operational receipt and a
candidate `new_root`. MALT does not currently provide a portable
state-transition proof, so the managed Gateway Console and `malt-client` never
promote this root automatically.

## Managed Bucket Synchronization

The managed write workflow is larger than a persistence request:

```text
GET  /v1/buckets/{bucket}/head
GET  /v1/buckets/{bucket}/branches
POST /v1/buckets/{bucket}/push
```

A client persists its local candidate and original base before refreshing the
remote head. It then pushes that exact base and candidate. The Gateway may
fast-forward, conservatively merge independent map-coordinate changes, or
preserve an unmergeable candidate on a conflict branch. The Bucket head is an
observed synchronization ref, not an automatically trusted client root.

The complete ACL, ref, push, conflict, and private-CAS contract is maintained in
the Gateway source of truth:
[`docs/buckets.md`](https://github.com/DeWebProtocol/gateway/blob/main/docs/buckets.md).

## Operator Root Publication

When `GATEWAY_ADMIN_TOKEN` is configured, the Gateway exposes bearer-protected
managed-policy routes:

```text
GET  /admin/v1/scopes/{scope}/roots
POST /admin/v1/scopes/{scope}/roots
GET  /admin/v1/scopes/{scope}/roots/{name}
POST /admin/v1/scopes/{scope}/roots/{name}/freeze
```

A publish request is `{"name":"main","root":"bafy..."}`. Records carry a
monotonic revision, previous root, timestamp, and optional frozen state.
Freezing is irreversible. Publication does not modify ArcTable state, prove a
mutation, choose the root of a request, or automatically update a client's
accepted root.

## Trust Boundary

The gateway may enforce access policy, cache results, orchestrate storage, and
publish roots, but it is untrusted for correctness. Root freshness, rollback
prevention, and multi-writer policy remain application or managed-service
responsibilities. Authentication and Bucket authorization determine who may
ask the service to read or write; they do not make a returned ProofList or root
correct.
