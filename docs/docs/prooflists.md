# ProofLists

ProofLists are the verifier-facing evidence returned by MALT reads.

The public contract is root-centric:

```text
Read(root, query) -> result + ProofList
VerifyRead(root, query, result, ProofList) -> valid / invalid
```

The root is supplied by the caller. A gateway may assemble the `ProofList`, but
the reader verifies the result locally.

## What a ProofList Covers

A `ProofList` carries the evidence needed to check that a returned result
matches a query under a root. Depending on the query and layout, evidence can
include:

- map-step proofs
- exact binding proofs
- terminal `@payload` proofs
- list index proofs
- composed list-index evidence for range reads
- blob binding evidence as needed by the layout

The gateway is not trusted for correctness. If it returns an inconsistent
result, stale materialization, or a forged transcript, verification fails.

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

## Schema Status

The current implementation exposes a compatibility `ProofList` transport for
the prototype. The paper-facing concrete step schema remains intentionally deferred
while the benchmark-facing read/result schema stabilizes.

Public documentation should therefore depend on the verifier-facing contract
and the current transport headers, not on an unstable internal step layout.

## Freshness Boundary

A valid `ProofList` proves snapshot correctness relative to the supplied root.
It does not prove that the root is the latest root.

Root publication, freshness, and multi-writer arbitration are application or
deployment policies. MALT focuses on verification once a caller has selected a
trusted root.
