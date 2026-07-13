# MALT UnixFS Application Model

UnixFS is an application model above MALT list/map semantics and immutable
payload objects. It is not the core MALT abstraction.

Released `v0.0.5` separates UnixFS ownership across `model/unixfs`,
`sdk/unixfs`, and `runtime/unixfs`. Those packages respectively own the
application model, client planning/body verification, and optional reference
execution adapter described here.

The model demonstrates how practical file and directory semantics can be built
without embedding every verifier-facing relation inside immutable parent
objects.

## Structure Model

In pure MALT structure UnixFS:

- directories use map semantics
- directory entries are map bindings
- small-file `@payload` points to a CAS blob
- large-file `@payload` points to a list node
- list entries are chunk CIDs
- path lookup composes map reads
- large-file range load uses measured-list range evidence over chunk CIDs

Payload and chunks remain ordinary CAS data. MALT authenticates the structure
that binds paths, payloads, and chunk lists together.

UnixFS requires `@payload` on its file and directory maps. That is an application
invariant, not a generic map rule: relation-only MALT maps may omit or delete
the reserved coordinate.

For byte ranges, ProofList verification authenticates fixed chunk metadata and
the ordered segment CIDs. A caller accepting returned range bytes must also use
`sdk/unixfs.VerifyRangeBody` or an equivalent check to bind those bytes to
the authenticated segments.

## Released Materialization Flags

`flat` and `hierarchical` are the current user-facing values of the retained
`malt add --layout` materialization flag. `flat` is the default. The flag names
a UnixFS materialization strategy; it does not make UnixFS a MALT core layout.

In the current `malt add` implementation, both names use the same staged hybrid
materialization path:

- ordinary directories are materialized as authenticated map roots
- directory/root maps also keep descendant full-path bindings
- path lookup can use longest-prefix reads that skip intermediate maps
- directory manifests list names as CAS payloads

This current behavior is not a pure separation between `flat` root-map
materialization and `hierarchical` per-directory materialization. That split is
a design and evaluation dimension to stabilize separately.

## Intended Materialization Split

The intended terminology remains:

- `flat`: full-path root-map materialization for update locality and shallow
  lookup
- `hierarchical`: directory/root-boundary materialization for explicit
  per-directory authentication boundaries

## Symlink Directory Boundary

A symlink whose target is a directory is materialized as an authenticated map
boundary in the current staged path. This lets symlinked directory mounts become
explicit authenticated subroots.

## Merkle-DAG UnixFS Terminology

For Merkle-DAG UnixFS baselines, avoid overloading `layout`.

File chunk-tree layout:

```text
file-layout=balanced|trickle
```

Directory materialization strategy:

```text
dir-layout=basic|hamt|adaptive
```

HAMT is a directory/map-relation baseline. It is not a large-file content
layout. Large-file range reads compare Merkle/UnixFS chunk structure with MALT
list-backed chunk structure.
