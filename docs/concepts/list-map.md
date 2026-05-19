# List and Map Semantics

MALT exposes authenticated structure through semantic abstractions, not through
runtime graph objects.

For the research framing, see [MALT Abstraction](/narrative/abstraction). For
the current UnixFS application layout, see [MALT UnixFS Layout](/docs/unixfs-layout).

## List

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

List does not define path-resolution semantics. File layouts translate byte
ranges into chunk index intervals. The target verifier model combines
file-layout metadata proof with the relevant per-index list proofs; the current
prototype already emits path/`@payload` proof plus list-index proofs, while
explicit `@size`/`@chunksize` metadata proof remains a ProofList-schema TODO.
The current prototype does not expose a first-class cryptographic range-proof
API.

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

Every MALT-native map semantic object carries a reserved `@payload` binding.
That binding is the terminal materialization relation for map semantic objects;
list roots do not implicitly redirect through `@payload`.

## Path Resolution

Explicit path resolution is a compatibility layer above map reads. It may
implement longest-prefix matching or product-specific path policy, but the map
semantic owns exact key proof generation and verification.
