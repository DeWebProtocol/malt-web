# Gateway API

The browser and `malt-client` use the MALT Gateway at
`http://127.0.0.1:8080` by default. The gateway embeds the untrusted graph
executor and owns ArcTable/KV/CAS persistence. It returns results and proofs;
clients decide trust locally.

The current gateway tracks
[MALT v0.0.6](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.6).
Normative resolve/read schemas remain in the
[MALT core repository](https://github.com/DeWebProtocol/malt/blob/v0.0.6/docs/spec/resolve-read-contracts.md).

## Resolve and Read

```text
POST /v1/resolve
POST /v1/read
```

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

```text
POST /v1/cas?codec=<multicodec>
GET  /v1/cas/{cid}
HEAD /v1/cas/{cid}
```

`POST` accepts an immutable payload body up to 64 MiB and returns
`201 Created` with `{"cid":"..."}`. `GET` and `HEAD` return immutable bytes
with CID-derived `ETag` and long-lived cache headers. Clients still hash
returned bytes and compare them with the authenticated CID before use.

CAS stores payload bytes; it does not define MALT authentication semantics.

## Create a Structure

```text
POST /v1/roots
```

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
```

`{root}` is the caller-selected base root. The request contains typed map/list
deltas with canonical coordinate changes and optional replay constraints:

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
candidate `new_root`. MALT v0.0.6 does not provide a state-transition proof, so
the Web App and `malt-client` never promote this root automatically.

## Trust Boundary

The gateway may enforce access policy, cache results, orchestrate storage, and
publish roots, but it is untrusted for correctness. Root freshness, rollback
prevention, and multi-writer policy remain application or managed-service
responsibilities.
