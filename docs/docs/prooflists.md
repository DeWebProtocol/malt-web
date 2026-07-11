# ProofLists

ProofLists are the verifier-facing evidence returned by MALT reads.

The public contract is root-centric:

```text
Read(root, query) -> result + ProofList
VerifyRead(root, query, result, ProofList) -> valid / invalid
```

The root is supplied by the caller. The server runtime may assemble the
`ProofList`, but the reader verifies the result locally with the portable
`auth/verifier` kernel. Verification does not require ArcTable, CAS, a graph
runtime, a layout, a server, a daemon, or network access.

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
`layout/unixfs.VerifyRangeBody` (or perform an equivalent binding check) to
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

`malt verify --prooflist` accepts either a bare ProofList JSON object or a
resolve response containing a `prooflist` field.

## Artifact Profile Status

[`v0.0.3`](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.3) publishes
the current ProofList contract as the experimental `v0alpha1` artifact profile.
The envelope is verifier-facing and implementation-bound, but it has no embedded
version discriminator and no stable named JSON Schema.

Consumers should pin the MALT release and bind the ProofList to the expected
typed root, query, target, and range segments. They should not treat the current
JSON fields as a stable cross-release wire contract.

`@payload` is reserved but optional for generic maps. UnixFS requires it for its
file and directory maps, so UnixFS proof paths include the terminal
`payload_binding` step described above; relation-only generic maps do not need
one.

## Freshness Boundary

A valid `ProofList` proves snapshot correctness relative to the supplied root.
It does not prove that the root is the latest root.

Root publication, freshness, and multi-writer arbitration are application or
deployment policies. MALT focuses on verification once a caller has selected a
trusted root.
