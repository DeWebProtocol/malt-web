# Gateway and Artifact API

The product-facing browser and SDK boundary is the MALT Gateway at
`http://127.0.0.1:8080` by default. It delegates execution to a MALT reference
executor but
preserves the core `malt.artifact/v0alpha2` contract instead of inventing a
second proof format.

## Resolve, Prove, and Diagnostic Verify

```text
POST /v1/artifacts/resolve
POST /v1/artifacts/prove
POST /v1/artifacts/verify
```

Resolve accepts canonical segments:

```json
{
  "profile": "malt.artifact/v0alpha2",
  "root": "<trusted MALT root>",
  "segments": ["a", "b", "c", "d"]
}
```

The client does not need to know whether the graph consumes those segments as
arcs `a/b`, `c`, and `d`. The reference resolver may prefer the longest prefix
at each root. Verification authenticates the complete returned derivation; it
does not claim that the chosen derivation was longest or unique.

Prove accepts one primitive typed query:

```json
{
  "profile": "malt.artifact/v0alpha2",
  "root": "<trusted MALT root>",
  "query": {"kind": "map_key", "segments": ["account", "name"]}
}
```

Other primitive kinds are `list_index` and `list_range`. Path composition is a
resolve operation, not a primitive prove query.

The verify endpoint accepts the complete artifact returned by resolve or prove:

```json
{
  "profile": "malt.artifact/v0alpha2",
  "artifact": {"profile": "malt.artifact/v0alpha2", "operation": "resolve"}
}
```

The abbreviated artifact above only shows the envelope. A real request carries
its root, query, target, and ProofList. A response is:

```json
{"profile":"malt.artifact/v0alpha2","valid":true}
```

JSON shape validation is not proof verification. The verifier also binds the
root, query, target, ordered steps, optional range segments, and cryptographic
evidence. Normative schemas and semantics live in the
[`DeWebProtocol/malt` artifact spec](https://github.com/DeWebProtocol/malt/blob/v0.0.4/docs/spec/artifacts.md).

This endpoint is a diagnostic and conformance surface, not a client trust
oracle. Browser and SDK clients run the portable verifier locally and fail
closed when it is unavailable. A gateway may report a diagnostic result, but a
client must not accept that result in place of local verification.

## Product Content Routes

The current UnixFS product scenario uses gateway content routes:

```text
GET|HEAD /v1/roots/{root}/content[/{path...}]
POST     /v1/roots/{root}/content/{path...}
POST     /v1/content/new?path={path}
```

`GET` returns file bytes or directory JSON. `HEAD` returns stat metadata.
`POST /v1/content/new` creates a new UnixFS root, while root-scoped `POST`
writes into an existing UnixFS root and returns the updated root.

Content reads preserve proof headers from the reference executor:

```text
X-Malt-ProofList: <base64url(JSON ProofList)>
X-Malt-ProofList-Encoding: base64url-json
X-Malt-Key: <resolved key CID>
X-Malt-Payload: <optional payload CID>
```

The website reconstructs the complete profiled artifact from the explicit root,
segment path, returned target, and ProofList, then verifies it locally with the
portable WebAssembly verifier. It does not use the gateway's `valid` field as a
trust decision.

## Trust and Deployment Boundary

The gateway is untrusted for correctness. It can authenticate callers, enforce
tenant policy, publish roots, cache, and orchestrate storage, but clients accept
results only after local verification against a root selected by the
application.

The open gateway currently provides a permissive local product path around a
configured reference executor. Production identity, authorization, quota, cache, billing,
abuse controls, and provider-specific S3/IAM policy remain deployment work.

Browser origins are configured through `GATEWAY_CORS_ALLOWED_ORIGINS`. The
gateway forwards only selected request and response headers required for
content, byte ranges, and proof transport.

## Reference Executor Routes

The MALT repository retains local/reference routes such as:

```text
GET /resolve/{root}[/{path...}]
GET|HEAD /{root}[/{path...}]
POST /_unixfs?path={path}
POST /{root}/{path...}
POST /{root}/_mutate
POST /verify
```

These routes support the CLI, evaluation, and compatibility clients. New
gateway, executor, and SDK integrations should use the profiled artifact contract
for resolve/prove/verify. Managed products should not copy reference runtime
admin or mutation routes as their public contract.

## Root Policy

Neither the gateway nor core verification proves that a root is fresh, latest,
or authorized. Root publication, rollback prevention, and multi-writer policy
belong to the application or managed gateway layer.
