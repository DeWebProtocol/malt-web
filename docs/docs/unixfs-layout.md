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

## Flat Layout

`flat` is the default MALT UnixFS layout.

In flat layout, full path bindings are kept in one root map and ordinary
directory manifests list names. This maximizes update locality and deliberately
gives up per-directory authentication boundaries for ordinary directories.

Flat layout is useful for evaluating how far MALT can push authenticated file
and directory behavior without parent-reference propagation.

## Hierarchical Layout

`hierarchical` materializes directories as authenticated map roots and lets
path lookup cross root boundaries.

This preserves per-layer authentication boundaries, but it reintroduces more
parent-reference propagation than flat layout. It is useful when directory
boundaries are semantically important.

## Symlink Directory Boundary

Even under flat MALT UnixFS, a symlink whose target is a directory is
materialized as an authenticated map boundary. This lets symlinked directory
mounts become explicit authenticated subroots without changing the default flat
behavior for ordinary directories.

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
