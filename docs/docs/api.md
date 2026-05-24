# Root-Centric HTTP API

The current prototype exposes a root-centric HTTP surface. The caller supplies
the root that should be verified; server-side resolver and writer routes
execute root-relative reads and mutations, returning result data plus proof
material unless proof generation is explicitly omitted.

## Read Routes

```text
GET|HEAD /{root}/{path...}
GET /resolve/{root}[/{path...}]
```

`GET|HEAD /{root}/{path...}` is the default content route. A successful `GET`
returns the loaded file or directory result in the body. When proof generation
is enabled, verifier-facing proof material is carried in headers.

`GET /resolve/{root}[/{path...}]` returns an explicit resolve response. This is
the route used by `malt resolve`.

## Write and Root Routes

```text
POST /_
POST /{root}/{path...}
POST /{root}/_mutate
```

`POST /_` creates a root.

`POST /{root}/{path...}` is the UnixFS convenience write path. `POST
/{root}/_mutate` is the root-scoped semantic mutation path. Both use the writer
mutation boundary instead of exposing mutable public heads.

## Semantic Mutation Contract

`POST /{root}/_mutate` accepts layout-produced semantic mutations. The request
body carries canonical arc deltas, not source-domain file operations:

```json
{
  "deltas": [
    {
      "object": "<existing map/list root, omitted for creation>",
      "expected_root": "<optional replay check root>",
      "kind": "map",
      "changes": [
        {
          "path": "@payload",
          "before": { "target": "<old CID>", "target_kind": "cas" },
          "after": { "target": "<new CID>", "target_kind": "list" }
        }
      ]
    },
    {
      "kind": "list",
      "changes": [
        {
          "index": 0,
          "after": { "target": "<chunk CID>", "target_kind": "cas" }
        }
      ],
      "commit": {
        "fixed_list": {
          "total_size": 1048576,
          "chunk_size": 262144
        }
      }
    }
  ]
}
```

Each delta applies to one semantic object. `kind` selects the coordinate
domain: map deltas use canonical path/key coordinates through `path`, while
list deltas use canonical index coordinates through `index`. `before` and
`after` describe one coordinate transition; omitting `before` means the
coordinate is expected to be absent, and omitting `after` means deletion.

Targets are typed references. `target_kind` may be `cas`, `map`, `list`, or
`unknown`; omitting it keeps the target CID but treats the semantic target type
as unknown for compatibility. The optional `commit.fixed_list` descriptor is
valid only for list deltas. It lets large-file UnixFS materialization replay a
measured fixed-width list root with the committed `total_size` and
`chunk_size`.

`expected_root` is an optional replay guard. When present, the writer checks
that applying the delta reproduces the layout's expected semantic root. It is
not a head publication or freshness mechanism.

The response is a materialization receipt:

```json
{
  "base_root": "<request root>",
  "new_root": "<resulting root>",
  "result_root": "<resulting root>",
  "delta_count": 2,
  "arc_count": 3,
  "malt_object_count": 2,
  "map_count": 1,
  "list_count": 1
}
```

The receipt counts are operational accounting. `delta_count` counts semantic
object deltas, `arc_count` counts canonical coordinate changes, and
`map_count` / `list_count` count deltas by semantic kind. These counts help
storage and evaluation accounting; they are not verifier evidence and do not
replace root recomputation or ProofList verification.

## Auxiliary Routes

The daemon also exposes runtime support endpoints:

```text
GET /health
GET /metrics
POST /metrics:reset
POST /verify
```

`/metrics` and `/metrics:reset` support local evaluation counter collection.
`/verify` is the daemon-side verification helper used by clients that want to
delegate compatibility verification checks, while the core correctness model
still assumes clients can verify locally against the selected root.

## Proof Transport

Proof-bearing content reads use response headers:

```text
X-Malt-ProofList: <base64url(JSON ProofList)>
X-Malt-ProofList-Encoding: base64url-json
Vary: X-Malt-Proof
```

Clients that only need bytes can opt out of proof materialization:

```text
GET /{root}/{path...}?proof=false
X-Malt-Proof: omit
```

Opting out removes proof materialization from the response. It does not change
the root-centric correctness model for clients that require verification.

## Removed Public Surface

The public bucket/head routes are removed. Runtime storage placement and local
working-root conveniences are not semantic identity, verifier input, ProofList
input, or authoritative head state.

The legacy content-route `format=resolve` and `format=proof` modes are removed.
Resolve transcripts use `/resolve/{root}[/{path...}]`; proof-bearing content
reads return content in the body and carry verifier evidence in
`X-Malt-ProofList`.

Removed public routes such as `POST /{root}/_batch-update` remain reserved so
they do not fall through to content routes.
