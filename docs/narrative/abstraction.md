# MALT Abstraction

MALT targets authentication for structured data whose relationships can be
normalized into graph-shaped nodes and relations.

MALT defines authenticated structure: graph-shaped nodes and relations, root
computation, proof generation, and verification. Immutable payloads can still
be represented as ordinary content-addressed data identified by CIDs, but
payload storage is the engineering substrate rather than the abstraction's
starting point.

## Authenticated Graph-Normalized Structure

The abstraction separates three concerns that an implicit Merkle-DAG arc often
couples:

- **Payload storage:** immutable bytes retain ordinary CIDs and live in CAS.
- **Relation authentication:** typed arcs are committed and proved by a VC
  backend under a MALT root.
- **Execution and access:** layouts, ArcTable materialization, caches, daemons,
  and gateways locate or serve relations and proofs.

MALT roots authenticate semantic-layer state. A reader obtains a trusted root
from an application publication layer, asks a server runtime or local runtime
for a query result, and verifies the returned `ProofList` against that root
with the portable authentication kernel. Execution components are not trusted
for correctness.

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
- optional measured range query over byte intervals when the implementation
  authenticates byte-layout metadata
- length-aware proof

Native writes:

- append
- replace
- truncate

List does not define path-resolution semantics. A file layout can translate
byte ranges into list queries. The current fixed-width measured list
authenticates `child_count`, `total_size`, and `chunk_size` metadata and emits
range evidence as path/`@payload` proof plus one measured-list `list_range`
step carrying metadata, covered segment CIDs, and metadata/index proofs. The
current prototype does not expose a first-class cryptographic range-proof API.

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

`@payload` is a reserved coordinate, but it is optional for a generic map. A
relation-only map with no payload binding is valid MALT state. When present,
`@payload` is a terminal materialization relation and its proof uses
`payload_binding` semantics rather than ordinary traversal.

The UnixFS layout requires `@payload` for its file and directory maps. A small
file can bind it directly to a CAS blob; a large file can bind it to a list node
whose entries are chunk CIDs. That requirement belongs to UnixFS, not to the
generic map abstraction.

List objects do not auto-redirect through `@payload`. This distinction keeps
map materialization and list range semantics separate.
