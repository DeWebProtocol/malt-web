# MALT UnixFS Layout

UnixFS is an application layout above MALT list/map/CAS blob composition. It is
not the core MALT abstraction.

The layout demonstrates how practical file and directory semantics can be built
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
- file range load composes list reads

Payload and chunks remain ordinary CAS data. MALT authenticates the structure
that binds paths, payloads, and chunk lists together.

## Current MALT Layout Flags

`flat` and `hierarchical` are the current user-facing MALT UnixFS layout names.
`flat` is the default.

In the current `malt add` implementation, both names use the same staged hybrid
materialization path:

- ordinary directories are materialized as authenticated map roots
- directory/root maps also keep descendant full-path bindings
- path lookup can use longest-prefix reads that skip intermediate maps
- directory manifests list names as CAS payloads

This current behavior is not a pure separation between `flat` root-map
materialization and `hierarchical` per-directory materialization. That split is
a design and evaluation dimension to stabilize separately.

## Intended Layout Split

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
