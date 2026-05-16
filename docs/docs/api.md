# Root-Centric HTTP API

The current prototype exposes a root-centric HTTP surface. The caller supplies
the root that should be verified; the gateway resolves or materializes the
root-relative query and returns result data plus proof material unless proof
generation is explicitly omitted.

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
/{root}/_mutate` is the root-scoped semantic mutation path. Both use the
gateway materialization boundary instead of exposing mutable public heads.

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
