# MALT UnixFS Application Model

UnixFS is an application model above typed authentication and immutable payload
objects. The local runtime and managed Console own file/directory meaning;
Core owns label-to-coordinate derivation, coordinates, tree proofs and Root
layouts. The application owns reserved labels and payload discovery.

`malt add --target malt` produces MALT-authenticated structure. The separate
`--target merkle-dag` mode imports IPFS-compatible UnixFS blocks and returns a
DAG CID; its link replay does not claim a MALT proof.

## Three application layouts

| CLI layout | Authenticated relations |
| --- | --- |
| `--layout flat-v1` | Complete-path labels in one Prefix Root; paths may target payloads or directory manifests directly |
| `--layout hybrid-v1` | A Prefix Root per directory with retained descendant whole-path bindings |
| `--layout rooted-v1` | Immediate-child labels per directory and explicit component traversal between Prefix Roots |

`--layout hybrid` is the default short spelling of `hybrid-v1` outside managed
Bucket mode. A managed Bucket freezes its selected layout; a mutation must
match it. These are current application strategies, not semantic Map/List
adapters in Core. The older bare `flat` and `hierarchical` spellings are invalid.

## Manifests and payloads

Directory manifests use canonical V2 JSON with explicit `name` and `type`
fields. The current runtime rejects historical name-only V1 encodings and raw
manifest fallback; it never infers file/directory type from a Root layout.

If traversal ends at a Prefix Root, content reading explicitly selects its
ordinary application label `@payload`, encoded as `"QHBheWxvYWQ="`. A flat path
that directly targets a payload or manifest needs no extra payload query. Core treats these bytes like every other label.

Chunked files use Positional authentication with fixed-width geometry and
ordered chunk CIDs. The local verified reader authenticates range evidence,
fetches and checks segment bytes and lengths, then slices the requested range.
A proof alone does not authenticate a displayed byte buffer. Encrypted UnixFS
also checks the authenticated ciphertext width against its encrypted manifest.

## MALT Target Symlink Directory Boundary

For hybrid/rooted `malt add --target malt`, a symlink whose target is a
directory can be followed and materialized as an authenticated Prefix boundary.
Flat mode rejects followed directory symlinks before uploading blocks. This lets symlinked
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
Positional chunk structure.
