# Roots and ProofLists

MALT is root-centric. A root is the verifier-facing handle for one committed
semantic structure snapshot.

For the fuller system model, see
[Runtime and Repository Boundaries](/docs/runtime). For current transport
details, see [Root-Centric HTTP API](/docs/api) and
[ProofLists](/docs/prooflists).

## Root-Centric Read

```text
Resolve(root, segments) -> target + ProofList
VerifyResolve(request, result) -> valid / invalid

Read(root, query) -> result + ProofList
VerifyRead(root, query, result, ProofList) -> valid / invalid
```

The root is supplied by the caller. It may come from an application manifest,
signed publication record, release channel, consensus protocol, or local
workflow. MALT does not define that publication layer.

## ProofList

A `ProofList` is the evidence needed to verify that a returned result matches a
query under a root. It is assembled by the server runtime or local runtime and
checked by the client.

ProofLists are useful because they keep the server runtime out of the trust base:

- the server runtime can be wrong or stale
- the reader can reject invalid results locally
- the application chooses which roots are trusted
- freshness policy stays outside MALT core

## Snapshot Correctness

MALT guarantees snapshot semantic correctness relative to a trusted root. It
does not by itself guarantee that the root is the latest root.

That distinction is intentional. It lets MALT focus on authenticated structure
while allowing different applications to choose different publication,
freshness, and merge policies.
