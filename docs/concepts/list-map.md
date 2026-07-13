# List and Map Semantics

MALT exposes authenticated structure through semantic abstractions, not through
runtime graph objects.

For the research framing, see [MALT Abstraction](/narrative/abstraction). For
the current UnixFS application model, see [MALT UnixFS Application Model](/docs/unixfs-layout).

## List

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

List does not define path-resolution semantics. File layouts translate byte
ranges into list queries. The current fixed-width measured list authenticates
`child_count`, `total_size`, and `chunk_size` metadata and emits range evidence
as path/`@payload` proof plus one measured-list `list_range` step carrying
metadata, covered segment CIDs, and metadata/index proofs. The current
prototype does not expose a first-class cryptographic range-proof API.

## Map

`map` describes authenticated keyed or path-like relations among graph nodes.

Native reads:

- exact key lookup
- binding proof
- binding verification

Native writes:

- insert
- replace
- delete

`@payload` is a reserved coordinate but is optional for a generic map. A
relation-only map may omit or delete it. When present, the binding is terminal
and uses `payload_binding` proof semantics; list roots do not implicitly
redirect through `@payload`.

UnixFS file and directory maps require `@payload` as a layout invariant. Other
layouts may require it, omit it, or reserve additional coordinates without
changing generic map semantics.

## Path Resolution

Explicit path resolution is a compatibility layer above map reads. It may
implement longest-prefix matching or product-specific path policy, but the map
semantic owns exact key proof generation and verification.
