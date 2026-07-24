# ProofLists

ProofList is evidence carried by MALT resolve and primitive-read results. It is
not a generic semantic operation.

The current active profiles are:

```text
Resolve(request) -> ResolveResult + ProofList
VerifyResolve(request, result) -> valid / invalid

Read(root, query) -> result + ProofList
VerifyRead(request, result) -> valid / invalid
```

The caller constructs the request from its trusted root and intended segments
or typed query. The executor returns an untrusted result. Local verification
binds the two and does not require ArcTable, CAS, a graph runtime, an
application adapter, a server, or network access.

## Evidence Kinds

Depending on the operation, ProofList may include:

- map-step and exact binding proofs;
- terminal `@payload` binding proofs;
- list-index proofs; and
- measured `list_range` evidence with authenticated segment CIDs.

Resolve accepts traversal evidence. Primitive list evidence is verified as a
read result, not hidden inside resolve semantics. A UnixFS client may compose
resolve and read ProofLists in memory for content verification; the browser
still verifies the resolve and zero or more read operations separately before
checking body bytes.

For list ranges, ProofList authenticates metadata and ordered segment CIDs, not
the response body by itself. A client must fetch/check those CIDs and bind the
exact returned bytes to the authenticated range.

## Explicit Payload Selection

`@payload` is a reserved explicit segment:

- `[]` means strict zero-step root identity;
- `["@payload"]` resolves a root map's payload; and
- `["docs", "readme", "@payload"]` resolves a nested payload.

A raw CID reached directly by the application path needs no extra payload
segment. This is why the UnixFS client derives payload selection from the
actual proof rather than inventing a `resolve_payload` operation.

## Existential Resolution

A valid resolve result proves one complete ordered derivation. It intentionally
does not prove that the chosen derivation was longest, shortest, or unique. If
several valid derivations can serve an application request, choosing among them
is application policy; any correctly verified derivation is valid core output.

## HTTP Transport

The generic/reference gateway returns ProofList directly in operation result
JSON:

```text
POST /v1/resolve -> { profile, target, prooflist }
POST /v1/read    -> { profile, target, range_segments?, prooflist }
```

In a managed deployment, the same operations and payload reads are scoped under
`/v1/buckets/{bucket}/...` and require a cookie session or API key plus Bucket
ACL authorization. The managed Console uses those Bucket routes. It does not
fetch bytes from a public `/v1/cas/{cid}` endpoint.

CAS bytes are fetched separately from the applicable private materialization
route and bound to the target or authenticated range segments by the client.
An unscoped `GET`/`HEAD /v1/cas/{cid}` is reserved for the process-bound
loopback evaluator and is not a production persistence surface. Remote
verification is diagnostic only; the authoritative path runs in the client
through Go or browser WASM.

## Compatibility

MALT `v0.0.4` released `malt.artifact/v0alpha2` with `resolve`, `prove`, and
`verify`. That profile is frozen for compatibility. New integrations use
`malt.resolve/v0alpha1` and `malt.read/v0alpha1` rather than extending the old
operation union.

Proof validity is snapshot-relative. Root freshness, publication, and
multi-writer arbitration remain application or deployment policy.
