# MALT Design Overview

MALT is a user-controlled local data runtime for structured data. It runs on
the user's device, owns keys and accepted roots, and keeps application access
separate from the storage or network system that supplies bytes and proofs.

MALT Core authenticates relationships at arc granularity after an application
adapter normalizes them into graph-shaped nodes and relations. Immutable
payload objects remain ordinary CAS content identified by CIDs,
vector-commitment (VC) backends commit to typed relations, and execution/access
components locate and serve results without entering the correctness trust
boundary.

The website has two main lanes:

- [Research Narrative](/narrative/problem): problem framing, abstraction,
  system design, and evaluation story.
- [Technical Docs](/docs/runtime): current prototype status, HTTP API,
  ProofLists, UnixFS application model, and benchmark protocol.

Status labels matter in the technical lane: `malt-core v0.0.7` is the current
released Core baseline. It preserves the application-neutral SDK in the
renamed `malt-core` repository, keeps persistent ArcTable/KV/CAS execution in
`gateway`, and keeps the user-controlled local runtime, daemon, and UnixFS in
the `malt` repository. The managed browser application remains in
`gateway/console`.

The local runtime deliberately supports both MALT-authenticated UnixFS and
IPFS-compatible Merkle DAG UnixFS import. Those are separate targets under one
runtime workflow: Merkle DAG compatibility does not change MALT Core semantics
or imply ProofList authentication for the returned DAG root.

## Core Claim

Merkle DAG systems commit traversal structure implicitly inside parent object
content. This is powerful for immutable content, but evolving structure can
force ancestor-dependent rewrites and retrieval-depth costs.

MALT changes the boundary:

- typed arcs are authenticated under independent structure roots
- `list` and `map` define typed semantic reads and writes
- VC backends produce verifier-facing commitments and proofs
- the portable `auth/verifier` checks proofs without runtime or storage access
- core algorithms consume an injected materializer capability, while gateway
  ArcTable/KV implementations remain untrusted execution state
- reads return `result + ProofList` for local verification
- clients submit segment arrays without discovering how a graph groups a long
  path into authenticated arcs
- `malt.resolve/v0alpha1` and `malt.read/v0alpha1` standardize
  operation-specific results and verification across gateways, executors, and
  SDKs; the v0.0.4 Artifact union is frozen compatibility behavior
- resolver and writer ports expose this runtime behavior without owning the
  list/map semantics
- immutable payloads can remain ordinary CAS data

The claim is not that updates become free. The claim is that MALT replaces
implicit ancestor-rewrite costs with explicit, verifiable structure maintenance.

## Three Separated Concerns

```text
Payload storage       Arc authentication          Execution and access
CAS objects + CIDs    typed arcs + VC proofs      layouts, ArcTable, caches,
        |              auth/verifier               executors, gateways
        |                     ^                            |
        +--- payload CID -----+--- result + ProofList -----+
```

In v0.0.7, the module-root package in `malt-core` (Go package name `malt`) is
the application-neutral facade for resolve/read values, mutations, and
verification. Semantic algorithms live under `auth/semantic`; `auth/verifier`
is the portable authentication kernel.
No persistent ArcTable, CAS, HTTP server, CLI, daemon, or UnixFS package is part
of core.

UnixFS is one application model/profile that composes these primitives; it is
not the definition of the core abstraction. The local runtime currently uses
one `hybrid` materialization strategy: directories form authenticated map roots
while ancestor maps may also retain descendant full-path bindings. Layout
selection remains a runtime adapter/application concern rather than a Core
semantic.

## Read Interface

The verifier-facing read shape is:

```text
Resolve(root, segments) -> target + ProofList
VerifyResolve(request, result) -> valid / invalid

Read(root, query) -> result + ProofList
VerifyRead(root, query, result, ProofList) -> valid / invalid
```

The root is the caller's correctness handle. The server runtime may accelerate
resolution and proof assembly, but the reader checks the returned result
against the supplied root.

## Write Interface

Layouts produce semantic mutations and the writer applies them under an
explicit root:

```text
ApplyMutation(baseRoot, semanticMutation) -> newRoot + writeReceipt
```

The write receipt is operational metadata. It is not a correctness object and
does not make the server the owner of a head.

The current prototype exposes this write boundary as root-scoped canonical arc
deltas; see the [Semantic Mutation Contract](/docs/api#semantic-mutation-contract).

## What MALT Does Not Own

MALT core does not choose the latest root, publish authoritative heads,
guarantee freshness, arbitrate multi-writer conflicts, provide global
availability, or define tenant and quota policy. Those are application or
deployment concerns built around MALT. Managed gateway service behavior belongs
in the separate `DeWebProtocol/gateway` repository.

The current [`malt-core v0.0.7`](https://github.com/DeWebProtocol/malt-core/releases/tag/v0.0.7)
source release publishes the operation-specific resolve/read profiles and
retains the frozen v0alpha2 Artifact compatibility contract from v0.0.4.
It remains pre-`v1` and is not a production stability promise.

## Where to Go Next

- [Problem: Structure Embedded in Identity](/narrative/problem)
- [MALT Abstraction](/narrative/abstraction)
- [Root-Centric HTTP API](/docs/api)
- [ProofLists](/docs/prooflists)
- [MALT UnixFS Application Model](/docs/unixfs-layout)
