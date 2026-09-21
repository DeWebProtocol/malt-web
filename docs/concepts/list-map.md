# Prefix and Positional Authentication

Applications still use keyed relations and ordered sequences. Current Core
implements these through typed inputs and descriptor-selected authentication
layouts; it has no separate semantic Map/List adapters or compatibility APIs.

For the research framing, see [MALT Abstraction](/narrative/abstraction). For
application behavior, see [the UnixFS model](/docs/unixfs-layout).

## Prefix

A Prefix Root authenticates bindings derived from explicit typed inputs.
Labels are opaque bytes; the descriptor selects their registered conversion
rule. System selectors are a distinct input kind. The payload selector is
`{"kind":"system","number":"1"}`, not the literal label `@payload`.
Generic relation structures need not have a payload binding.

## Positional

A Positional Root authenticates indexed targets and sequence geometry.
Byte-range results bind metadata and ordered segment CIDs. Clients then check
segment bytes, lengths and slicing. Positional Roots do not implicitly redirect
through a payload selector.

## Composition and updates

`traversal` follows an explicit array of typed steps. A path query can
end at another Root, a payload CID or a manifest CID; interpreting that target
is application policy. Flat, hybrid and rooted UnixFS layouts are composed
above these authentication primitives.

Retained writers import verified candidate state, apply changed bindings, and
export candidate Roots for exact ordered batch materialization. A receipt does
not authenticate a portable state transition or accept a trusted root.
