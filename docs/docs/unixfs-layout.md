# MALT UnixFS Application Model

UnixFS is an application model above MALT list/map semantics and immutable
payload objects. It is not the core MALT abstraction.

With core `v0.0.6`, UnixFS lives entirely in application clients. The native
implementation is in `DeWebProtocol/malt-client/unixfs`; the managed Gateway
Console implements
the same client-side model for browser upload, preview, and verification.

The native client supports two UnixFS targets. `malt add --target malt`
materializes MALT-authenticated structure and returns a MALT root whose reads
can carry ProofLists. `malt add --target merkle-dag` constructs an
IPFS-compatible Merkle DAG, writes its blocks to CAS, and returns the DAG root
CID. The latter is interoperability support: it does not turn Merkle DAG
relations into MALT-authenticated arcs or produce a ProofList.

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
`malt-client/unixfs.VerifyRangeBody` or an equivalent check to bind those bytes
to the authenticated segments.

## Current Hybrid Materialization

The native `malt-client` currently accepts one MALT materialization value:
`malt add --layout hybrid`. It is also the default. The flag names a UnixFS
application strategy; it does not make UnixFS a MALT core layout.

The hybrid materialization path:

- ordinary directories are materialized as authenticated map roots
- directory/root maps also keep descendant full-path bindings
- path lookup can use longest-prefix reads that skip intermediate maps
- directory manifests list names as CAS payloads

Earlier pre-release clients exposed `flat` and `hierarchical`, but both names
selected this same implementation. They are no longer accepted as current CLI
values. Pure flat root-map and pure per-directory hierarchical materialization
remain possible future design/evaluation dimensions, not shipped client modes.

## Possible Future Materialization Split

If those strategies are implemented as behaviorally distinct modes, their
intended meanings are:

- `flat`: full-path root-map materialization for update locality and shallow
  lookup
- `hierarchical`: directory/root-boundary materialization for explicit
  per-directory authentication boundaries

## MALT Target Symlink Directory Boundary

For `malt add --target malt`, a symlink whose target is a directory is followed
and materialized as an authenticated map boundary. This lets symlinked
directory mounts become explicit authenticated subroots. A symlink to a file
is likewise followed and imported as its target payload.

The separate `--target merkle-dag` compatibility path does not follow local
symlinks. It preserves each link as an IPFS UnixFS symlink node containing the
link target text.

## Merkle-DAG UnixFS Terminology

For Merkle-DAG UnixFS compatibility imports and baselines, avoid overloading
`layout`. The native CLI selects this target with `--target merkle-dag`.

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
