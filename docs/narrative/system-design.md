# System Design

MALT realizes the abstraction as a root-centric, server-assisted,
client-verifiable authentication system for graph-normalized structured data.
Immutable payloads can be stored in CAS, while MALT authenticates the
relationships that bind structure together.

## Separated System Concerns

The system keeps payload storage, relation authentication, and execution/access
separate:

```text
Payload plane          Portable authentication kernel       Execution plane
CAS + payload CIDs     canonical arcs, list/map proofs,      layouts, ArcTable,
                      VC verification, ProofLists           caches, gateways
        |                            ^                              |
        +------ authenticated target+------ result + proof --------+
```

Application clients translate source-domain data into semantic mutations. The
module-root `malt` package exposes typed resolve/read values and verification.
`auth/verifier` checks real list/map/range ProofLists without ArcTable, CAS, a
runtime, an application, a server, or network access. A gateway-owned
materializer and other execution components may accelerate proof generation
but cannot make an invalid answer acceptable.

## Semantic Layer

The semantic layer is the architectural center.

- `list` describes ordered or indexed child references.
- `map` describes authenticated keyed or path-like relations.
- `@payload` is reserved but optional for generic maps; layouts may require it.

Applications produce semantic mutations, and graph ports expose resolver reads and
writer mutations over list/map semantics. This keeps the public model
independent of current package boundaries.

## ArcTable

ArcTable provides root-recoverable arcset persistence and materialization:

```text
given root -> recover enough semantic state to answer queries and generate proofs
```

ArcTable is a stateful performance component. It may use local indexes,
storage prefixes, snapshots, or versioned recovery internally. Those details
are not semantic identity, commitment input, `ProofList` input, or verifier
input.

ArcTable is untrusted materialization. An incorrect ArcTable result is rejected
by root-relative verification.

## Commitment Backend

The commitment backend is a stateless commitment and proof primitive over
cell vectors. It is semantic-neutral.

It is responsible for:

- commit
- prove
- verify
- update when the backend supports efficient local updates

It is not responsible for map key semantics, list range semantics, resolver
policy, application layout, root publication, or freshness.

The current implementation separates that primitive layer from semantic
single-step facades and algorithms:

- `auth/semantic/list.Commitment`
- `auth/semantic/mapping.Commitment`

Those facades expose storage-free `Commit`, `ProveSlot`, and `VerifySlot`
operations. `auth/semantic/list/tree` and `auth/semantic/mapping/radix` compose
them with an injected `auth/arcset/materializer.Store` capability and multi-step
traversal. Persistent ArcTable implementations live in the gateway.

The portable authentication kernel in `auth/verifier` selects a supported VC
verification backend from the typed MALT root. The current built-in backends
cover KZG and IPA roots.

## Graph Ports and Layouts

The server runtime exposes resolver and writer ports. Its verifier-facing read
shape is:

```text
Resolve(root, segments) -> target + ProofList
VerifyResolve(request, result) -> valid / invalid

Read(root, query) -> result + ProofList
VerifyRead(root, query, result, ProofList) -> valid / invalid
```

The server runtime does not choose the latest root, publish authoritative heads,
or guarantee freshness. Those are application or deployment policies.

The writer applies root transitions from semantic mutations:

```text
ApplyMutation(baseRoot, semanticMutation) -> newRoot + writeReceipt
```

The write receipt is operational metadata, not a correctness object. The current
prototype's concrete write payload is documented in the
[Semantic Mutation Contract](/docs/api#semantic-mutation-contract).

## UnixFS as an Application Model

UnixFS is an application model/profile built from list/map semantics plus immutable
payload objects. It is not the core MALT abstraction.

In the current MALT UnixFS direction:

- directories use map semantics
- directory entries are map bindings
- small-file `@payload` points to a CAS blob
- large-file `@payload` points to a list node
- list entries are chunk CIDs
- path lookup composes map reads
- large-file range load uses measured-list range evidence over chunk CIDs

This layout demonstrates that the semantic layer can support practical file
and directory behavior while keeping payload identity unchanged.

The core implementation is published as the experimental
[`v0.0.6`](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.6) source
release. Native UnixFS and CLI behavior live in `malt-client`. New integrations
use operation-specific `malt.resolve/v0alpha1` and
`malt.read/v0alpha1`; the `malt.artifact/v0alpha2` operation set remains frozen
v0.0.4 compatibility behavior. It is not yet a production managed service or
stable API line.
