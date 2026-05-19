# ArcTable and Commitments

ArcTable and commitment backends support the semantic layer, but they do not
replace it.

For the full design narrative, see [System Design](/narrative/system-design).
For current package roles, see [Runtime and Prototype Status](/docs/runtime).

## ArcTable

ArcTable provides root-recoverable arcset persistence and materialization:

```text
given root -> recover enough semantic state to answer queries and generate proofs
```

It belongs to the performance plane. It is allowed to use implementation-local
storage prefixes, namespaces, indexes, or partitions. Those details are not
part of canonical semantic identity, commitment inputs, `ProofList`, or
`VerifyRead`.

Incorrect materialized state is rejected by verification or root recomputation.

## Commitments

Commitment backends are stateless proof primitives over semantic-layer
representations.

They are responsible for:

- commit
- prove
- verify
- update when the backend supports efficient local updates

They are not responsible for map key semantics, list range semantics, path
resolution, application layout, or root publication policy.

## Canonical ArcSets

The target representation is deterministic and semantic-layer owned:

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
canonicalization. Coordinates are encoded by list or map semantics, not by
ArcTable.
