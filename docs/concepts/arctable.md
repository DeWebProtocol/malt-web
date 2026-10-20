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

## Versioned retention

Gateway's versioned ArcTable separates three storage lifecycles:

| State | Retention rule |
| --- | --- |
| Canonical deltas | Original relation changes, deletion markers and physical parent links preserve historical recovery |
| Materialized Head | A named application head owns mutable complete ArcSets for its current Root and reachable Roots; forward updates apply deltas in place |
| Snapshot | The application explicitly pins a selected Root's complete ArcSet until it releases that pin |

When a head moves from A to B, its mutable view overwrites changed relations and
removes deleted relations. Independent Snapshot and other-head views retain
their selected Roots. A remains recoverable from canonical history,
subject to the configured recovery work budget. If the application chooses to
retain A for a release tag or fork point, it explicitly creates a Snapshot.
Version intervals, read-cost thresholds and publication validation do not
automatically create Snapshots.

Each head owns its mutable rows. An explicit Snapshot has separate immutable
rows, even when it selects the same Root. Pins are Root-relative; applications
manage the mapping from tag names to Roots.
A single-Root Snapshot contains that Root's relations. Applications can also
explicitly retain complete views for a reachable Root graph. Payload storage,
authentication-node persistence and cache budgets have their own policies.

A mutable Head view records its applied Root and revision in `@current`
metadata. Forward updates replay the intervening canonical deltas and commit
changed rows with that marker atomically. Observing a head can repair a view
that lags its published ref after a restart. Root-qualified reads use a mutable
view only for the exact Root it materializes, and can otherwise recover history
from deltas. Initial views and newly reachable structures require complete
initialization; a checkout outside the previous physical lineage reconciles the
view against the complete target state. Publication validation and graph
discovery can still inspect complete states.

A Snapshot is an acceleration view and does not establish freshness or client
trust.

Core's materializer `Snapshot()` capability and immutable Root-qualified reads
provide state views. They do not select persistent Snapshot retention.

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
derived during recovery and may be cached or indexed separately. Prefix
`auth/tree` authenticates original labels and targets, using those coordinates
for routing; `engine`
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
