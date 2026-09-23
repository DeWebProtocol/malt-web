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
local query verification.

Incorrect materialized state is rejected by verification or root recomputation.

## Commitments

Commitment backends are stateless primitive proof engines over cell vectors.
They do not know whether a cell vector came from a list node, a map binding
vector, a radix node, or a bucket.

They are responsible for:

- commit
- prove
- verify
- update when the backend supports efficient local updates

They are not responsible for map key semantics, list range semantics, path
resolution, application layout, or root publication policy.

`derivation` derives coordinates from opaque application label bytes.
ArcTable persists the original label–target bindings. Coordinates are
derived during recovery and may be cached or indexed separately. `auth/tree` authenticates those coordinates; `engine`
binds the algorithm to a Root descriptor. `traversal` composes explicit
steps across Roots. Materialization is injected through narrow lookup, update
and snapshot capabilities in `auth/arcset/materializer`.

## Canonical inputs and materialized state

Canonical coordinates and typed Root descriptors are Core-owned. A coordinate
has at most one authenticated binding in a candidate. The retained writer
validates imported state and computes changed nodes before an untrusted service
materializes an exact batch. Physical keys, caches and storage prefixes are not
part of the coordinate derivation or proof contract.

The retired semantic Map/List facades and aggregate Store are absent from this
source path. Prefix and Positional are authentication layouts; file/directory
meaning and chunk assembly remain application concerns.
