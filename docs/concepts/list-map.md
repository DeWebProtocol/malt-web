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

A Positional Root authenticates indexed targets and sequence geometry. Direct
labels encode uint64 indices as exactly eight unsigned big-endian bytes; text
such as `"42"` is not an index encoding.
Byte-range results bind metadata and ordered segment CIDs. Clients then check
segment bytes, lengths and slicing. Positional Roots do not implicitly redirect
through a payload selector.

## Composition and updates

`traversal` follows an explicit array of label steps. A path query can
end at another Root, a payload CID or a manifest CID; interpreting that target
is application policy. Flat, hybrid and rooted UnixFS layouts are composed
above these authentication primitives.

Retained writers import verified candidate state, apply changed bindings, and
export candidate Roots for exact ordered batch materialization. A receipt does
not authenticate a portable state transition or accept a trusted root.
