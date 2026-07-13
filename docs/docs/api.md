# Gateway Resolve and Read API

The product-facing browser and SDK boundary is the MALT Gateway at
`http://127.0.0.1:8080` by default. It delegates execution to an untrusted MALT
reference executor while preserving the operation-specific core contracts.

The current gateway tracks [MALT PR #163](https://github.com/DeWebProtocol/malt/pull/163)
at commit `d3598cd`. Released `v0.0.4` remains the baseline; its
`malt.artifact/v0alpha2` resolve/prove profile is frozen compatibility behavior,
not the contract new clients use.

## Resolve, Read, and Diagnostic Verify

```text
POST /v1/resolve
POST /v1/read
POST /v1/verify/resolve
POST /v1/verify/read
```

Resolve accepts the trusted root and canonical segments:

```json
{
  "profile": "malt.resolve/v0alpha1",
  "root": "<trusted MALT root>",
  "segments": ["a", "b", "@payload"]
}
```

It returns an untrusted target plus ProofList:

```json
{
  "profile": "malt.resolve/v0alpha1",
  "target": "<authenticated target CID>",
  "prooflist": {"root": {"/": "<trusted MALT root>"}, "steps": []}
}
```

The empty steps array above is only illustrative. Non-empty paths require real
evidence. `segments: []` is strict root identity. Payload selection is an
explicit final `@payload` segment, not a separate `resolve_payload` operation.

The client does not need to know whether a graph consumes the segments as arcs
`a/b` and `@payload`, or another complete derivation. Verification proves the
returned derivation; it intentionally does not prove it was longest or unique.

Read accepts one primitive typed query:

```json
{
  "profile": "malt.read/v0alpha1",
  "root": "<typed map or list root>",
  "query": {"kind": "map_key", "segments": ["account", "name"]}
}
```

Other query kinds are `list_index` and `list_range`. “Read” replaces the legacy
Artifact operation name “prove”: proof generation is evidence for a semantic
operation, not a semantic operation by itself.

The browser verifies a caller-constructed request together with the untrusted
result. The remote verify endpoints accept the same `{request, result}` pair
and return a diagnostic `{profile, valid, error?}` response. They are not trust
oracles. Normative schemas and semantics live in the
[MALT resolve/read spec](https://github.com/DeWebProtocol/malt/blob/d3598cdb6e5d8bb7ab535a48a3e9912fc4b6cce6/docs/spec/resolve-read-contracts.md).

## Semantic Mutation Contract

The gateway applies a root-relative semantic mutation through:

```text
POST /v1/roots/{root}/mutations
```

`{root}` is the caller-selected base root. The request contains typed map/list
deltas with canonical coordinate changes and optional replay constraints.

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

A successful application returns `201 Created` with an operational receipt and
a candidate `new_root`. MALT does not currently provide a delta/state-transition
proof. The website therefore never promotes that root automatically; the user
or an independent publication policy must accept it explicitly.

## Product Content Routes

The UnixFS product scenario uses:

```text
GET|HEAD /v1/roots/{root}/content[/{path...}]
POST     /v1/roots/{root}/content/{path...}
POST     /v1/content/new?path={path}
```

Content responses preserve `X-Malt-ProofList`, its encoding header, target/stat
headers, and `Vary: X-Malt-Proof`. Gateway CORS merges `Origin` into that
variance set.

For content verification, the website:

1. derives a `ResolveVerification` from the explicit root, application path,
   and terminal `@payload` when the proof contains that binding;
2. separately verifies any trailing `list_index` or `list_range` evidence as
   `ReadVerification` values; and
3. hashes full raw/manifest bytes to the authenticated CID, or verifies list
   range bytes against authenticated segment CIDs.

Raw targets without `@payload` remain ordinary resolves. This composition is a
UnixFS client concern and does not add another core operation.

## Trust and Deployment Boundary

The gateway may authenticate callers, enforce policy, publish roots, cache, and
orchestrate storage, but it is untrusted for correctness. Root freshness,
rollback prevention, and multi-writer policy remain application or managed
gateway responsibilities. Clients accept results only after local verification
against their own request and trusted root.
