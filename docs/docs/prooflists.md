# ProofLists

ProofLists are the verifier-facing evidence returned by MALT reads.

The `malt.artifact/v0alpha2` profile described here is released in `v0.0.4`.
The `sdk/unixfs` package location, local verifier envelope, and browser WASM
integration are the active target of
[draft PR #163](https://github.com/DeWebProtocol/malt/pull/163) at
`0f2b5b1`; they are not yet a newer release.

The public contract is root-centric:

```text
Read(root, query) -> result + ProofList
VerifyRead(root, query, result, ProofList) -> valid / invalid
```

The root is supplied by the caller. The server runtime may assemble the
`ProofList`, but the reader verifies the result locally with the portable
`auth/verifier` kernel. Verification does not require ArcTable, CAS, a graph
runtime, an application adapter, a server, a reference executor, or network access.

## What a ProofList Covers

A `ProofList` carries the evidence needed to check that a returned result
matches a query under a root. Depending on the query and layout, evidence can
include:

- map-step proofs
- exact binding proofs
- terminal `@payload` proofs
- list index proofs
- measured-list `list_range` evidence for range reads
- blob binding evidence as needed by the layout

For list-backed byte ranges, the current implementation resolves the path and
terminal `@payload` binding, then appends one measured-list `list_range` step.
That step carries authenticated fixed chunk metadata, the segment CIDs covering
the requested range, and a proof payload composed from metadata and index
proofs. The ProofList authenticates the metadata and ordered segment CIDs. A
UnixFS caller that accepts returned bytes must additionally call
`sdk/unixfs.VerifyRangeBody` (or perform an equivalent binding check) to
fetch/check those CIDs and bind the exact response body to the authenticated
range.

The server runtime is not trusted for correctness. If it returns an
inconsistent result, stale materialization, or a forged transcript, verification
fails.

## HTTP Transport

The current content read transport uses headers:

```text
X-Malt-ProofList: <base64url(JSON ProofList)>
X-Malt-ProofList-Encoding: base64url-json
Vary: X-Malt-Proof
```

`X-Malt-ProofList-Encoding` records the encoding of the header value.
`Vary: X-Malt-Proof` records that clients can request proof omission with
`X-Malt-Proof: omit`.

In the active draft, `malt verify --prooflist` accepts either a bare ProofList
JSON object or a resolve response containing a `prooflist` field and requires a
caller-selected trusted root.

## Artifact Profile Status

[`v0.0.4`](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.4) publishes
the explicit `malt.artifact/v0alpha2` envelope and named JSON Schemas for
resolve, primitive prove, and verify. The envelope carries the expected root,
query, target, optional range segments, and ProofList together.

Consumers should pin the MALT release and reject unknown profiles. Schema
validation checks structure; portable verification still checks all semantic
bindings and cryptographic evidence.

Resolution is existential. A valid artifact proves the complete ordered
derivation returned for the requested segments, not that this derivation was
longest or unique. Namespace overlap policy belongs to the application.

`@payload` is reserved but optional for generic maps. UnixFS requires it for its
file and directory maps, so UnixFS proof paths include the terminal
`payload_binding` step described above; relation-only generic maps do not need
one.

The active draft represents this terminal binding as a `resolve_payload`
artifact. Root content therefore uses an empty segment query with a non-empty
payload ProofList; only an empty `resolve` query with zero steps means root
identity.

## Freshness Boundary

A valid `ProofList` proves snapshot correctness relative to the supplied root.
It does not prove that the root is the latest root.

Root publication, freshness, and multi-writer arbitration are application or
deployment policies. MALT focuses on verification once a caller has selected a
trusted root.
