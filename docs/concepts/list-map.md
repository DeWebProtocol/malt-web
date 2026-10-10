# Prefix and Positional Authentication

Applications still use keyed relations and ordered sequences. Current Core
implements these through opaque labels and descriptor-selected authentication
layouts; it has no separate semantic Map/List adapters or compatibility APIs.

For the research framing, see [MALT Abstraction](/narrative/abstraction). For
application behavior, see [the UnixFS model](/docs/unixfs-layout).

## Prefix

A Prefix Root authenticates bindings at 32-byte coordinates. Its descriptor
selects public coordinate derivation: SHA256 (profile 4) hashes opaque labels;
Direct (profile 3) accepts a precomputed 32-byte coordinate. ArcTable preserves
the original label and target. `@payload` is an ordinary label that UnixFS
uses by application convention. Generic relation structures need no payload.

## Positional

A Positional Root authenticates indexed targets, a count and an optional opaque
payload CID. Only root slot zero stores metadata; all slots in non-root vectors
hold content. For capacity 256, 255 elements fit in one vector; 256 elements
require a root pointing to one full leaf vector. The count and capacity determine
the tree shape, so height and per-node sizes are not stored.

Direct labels encode uint64 indices as exactly eight unsigned big-endian bytes;
text such as `"42"` is not an index encoding. Core range queries use element
indices. Applications verify the document referenced by the payload CID and
interpret its JSON themselves. UnixFS uses that document for chunk width and
file size, then verifies chunk CIDs and slices bytes locally. Heterogeneous
sequences need no byte-size fields.

## Composition and updates

`traversal` follows an explicit array of label steps. A path query can
end at another Root, a payload CID or a manifest CID; interpreting that target
is application policy. Flat, hybrid and rooted UnixFS layouts are composed
above these authentication primitives.

Retained writers import verified candidate state, apply changed bindings, and
export candidate Roots for exact ordered batch materialization. A receipt does
not authenticate a portable state transition or accept a trusted root.
