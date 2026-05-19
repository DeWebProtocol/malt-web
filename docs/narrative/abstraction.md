# MALT Abstraction

MALT is an authenticated graph semantic layer over immutable CAS payloads.

Payload remains ordinary content-addressed data identified by CIDs. MALT
defines the authenticated structure above those payloads: graph nodes,
relations, root computation, proof generation, and verification.

## Authenticated Graph Semantic Layer

The abstraction separates three concerns that are usually fused in a Merkle DAG:

- immutable payload identity
- graph-node and graph-relation semantics
- verifier-facing authentication of those semantics

MALT roots authenticate semantic-layer state. A reader obtains a trusted root
from an application publication layer, asks a gateway or local runtime for a
query result, and verifies the returned `ProofList` against that root.

## Graph Nodes and ArcSets

MALT models outgoing structure as arcsets:

```text
ArcSet = {(coordinate, target)}
```

Coordinates are semantic positions. They can be keys, path-like tokens,
indexes, or range coordinates depending on the semantic object.

The target representation is deterministic:

```text
CanonicalArcSet {
  kind: map | list
  entries: []ArcEntry
}

ArcEntry {
  coordinate: CanonicalCoordinate
  target: TargetRef
}
```

Entries are sorted by canonical coordinate bytes. A well-formed ArcSet has at
most one target per coordinate. Conflicting bindings for the same coordinate are
invalid inputs; equivalent duplicate input may be rejected or collapsed before
canonicalization. Coordinates are encoded by the semantic layer, not by
ArcTable.

## List Semantic

`list` describes complex graph nodes with ordered or indexed child references.

Read semantics:

- first-class index query
- logical range read over index intervals, represented in the current prototype
  by path/`@payload` proof plus per-index list proofs
- length-aware proof

Native writes:

- append
- replace
- truncate

List does not define path-resolution semantics. A file layout can translate
byte ranges into chunk index intervals. The target verifier model combines
file-layout metadata proof with the relevant per-index list proofs; the current
prototype already emits path/`@payload` proof plus list-index proofs, while
explicit `@size`/`@chunksize` metadata proof remains a ProofList-schema TODO.
The current prototype does not expose a first-class cryptographic range-proof
API.

## Map Semantic

`map` describes authenticated keyed or path-like relations among graph nodes.

Native reads:

- exact key lookup
- binding proof
- binding verification

Native writes:

- insert
- replace
- delete

Path resolution is a compatibility layer above map reads. A resolver may apply
longest-prefix or product-specific policy, but map owns exact keyed proof and
update semantics.

## Payload Boundary

CAS payloads remain outside the mutable structure layer. MALT binds semantic
objects to payload CIDs; it does not redefine payload identity.

Every MALT-native map semantic object carries a reserved `@payload` binding.
That binding is the terminal materialization relation for map objects. A small
file can bind `@payload` directly to a CAS blob; a large file can bind
`@payload` to a list node whose entries are chunk CIDs.

List objects do not auto-redirect through `@payload`. This distinction keeps
map materialization and list range semantics separate.
