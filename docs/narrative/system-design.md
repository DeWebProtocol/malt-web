# System Design

MALT realizes the abstraction as a root-centric, gateway-accelerated,
client-verifiable structure layer over immutable CAS payloads.

## Layering

The system is organized around a narrow semantic core:

```text
Application layout
    |
    v
Semantic layer: list / map
    |
    v
ArcTable: root-recoverable arcset materialization
    |
    v
Commitment backend: stateless proof primitive
    |
    v
KV state + CAS payloads
```

Application layout translates source-domain data into semantic mutations. The
semantic layer defines list and map behavior. ArcTable persists and
materializes arcsets. The stateless commitment backend authenticates
semantic-layer representations.

## Semantic Layer

The semantic layer is the architectural center.

- `list` describes ordered or indexed child references.
- `map` describes authenticated keyed or path-like relations.
- every map semantic object carries the reserved `@payload` binding.

Layouts and gateways use list/map semantics instead of treating the runtime
graph package as the abstraction. This keeps the public model independent of
current package boundaries.

## ArcTable

ArcTable provides root-recoverable arcset persistence and materialization:

```text
given root -> recover enough semantic state to answer queries and generate proofs
```

ArcTable is a stateful performance component. It may use local indexes,
storage prefixes, snapshots, or versioned recovery internally. Those details
are not semantic identity, commitment input, `ProofList` input, or verifier
input.

An incorrect ArcTable result is rejected by root-relative verification.

## Commitment Backend

The commitment backend is a stateless commitment and proof primitive over
semantic-layer representations.

It is responsible for:

- commit
- prove
- verify
- update when the backend supports efficient local updates

It is not responsible for map key semantics, list range semantics, resolver
policy, application layout, root publication, or freshness.

## Gateway and Layouts

The gateway is an untrusted root-relative materializer and prover. Its
verifier-facing read shape is:

```text
Read(root, query) -> result + ProofList
VerifyRead(root, query, result, ProofList) -> valid / invalid
```

The gateway does not choose the latest root, publish authoritative heads, or
guarantee freshness. Those are application or deployment policies.

Writers compute root transitions from semantic mutations:

```text
ComputeRoot(baseRoot, semanticMutation) -> newRoot + ArcSets
Materialize(newRoot, ArcSets) -> materializationReceipt
```

The materialization receipt is operational metadata, not a correctness object.

## UnixFS as a Layout

UnixFS is an application layout built from list/map/CAS blob composition. It is
not the core MALT abstraction.

In the current MALT UnixFS direction:

- directories use map semantics
- directory entries are map bindings
- small-file `@payload` points to a CAS blob
- large-file `@payload` points to a list node
- list entries are chunk CIDs
- path lookup composes map reads
- range load composes list reads

This layout demonstrates that the semantic layer can support practical file
and directory behavior while keeping payload identity unchanged.
