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

The current source path separates typed authentication in `malt-core`, service
persistence in `gateway`, and user-controlled trust, daemon and UnixFS behavior
in `malt`. The managed browser application remains in `gateway/console`.
The exact source and release pins of each integration identify its executable
behavior; a source migration does not imply a published package release.

The local runtime deliberately supports both MALT-authenticated UnixFS and
IPFS-compatible Merkle DAG UnixFS import. Those are separate targets under one
runtime workflow: Merkle DAG compatibility does not change MALT Core semantics
or imply ProofList authentication for the returned DAG root.

## Core Claim

Merkle DAG systems commit traversal structure implicitly inside parent object
content. This is powerful for immutable content, but evolving structure can
force ancestor-dependent rewrites and retrieval-depth costs.

MALT changes the boundary:

- applications submit opaque label–target bindings and derive authentication coordinates
- a standalone authentication tree commits coordinates and verifies proofs
- Prefix and Positional layouts are selected by a Root descriptor
- KZG and IPA provide commitment backends
- `engine` and `traversal` compose those primitives through narrow materializer capabilities
- `malt.authentication/3` carries explicit queries and locally verified evidence
- retained writers produce candidates and exact materialization batches
- immutable payloads remain ordinary CAS data

The claim is not that updates become free. The claim is that MALT replaces
implicit ancestor-rewrite costs with explicit, verifiable structure maintenance.

## Three Separated Concerns

```text
Payload storage       Arc authentication          Execution and access
CAS objects + CIDs    typed arcs + VC proofs      layouts, ArcTable, caches,
        |              auth/tree               executors, gateways
        |                     ^                            |
        +--- payload CID -----+--- result + ProofList -----+
```

Core's public application-neutral APIs live in `sdk/authentication`. Typed
coordinate derivation, the authentication tree, engine and graph traversal are separate
modules. Core contains no persistent ArcTable, CAS, HTTP server, daemon or UnixFS.

UnixFS composes these primitives through flat, hybrid and rooted layouts.
Application layout selection does not add semantic Map/List adapters to Core.

## Read Interface

The verifier-facing read shape is:

```text
Authenticate(root, label steps, operation) -> authentication result
Verify(request, result) -> valid / invalid
```

The root is the caller's correctness handle. The server runtime may accelerate
resolution and proof assembly, but the reader checks the returned result
against the supplied root.

## Write Interface

Application planners prepare typed state, and the retained writer computes
local candidates before exact materialization:

```text
Prepare / Apply / Export -> candidate
MaterializeBatch(exact ordered candidates) -> durable receipt
```

The write receipt is operational metadata. It is not a correctness object and
does not make the server the owner of a head.

The [typed API boundary](/docs/api) separates candidate computation, atomic
materialization receipts and application-owned root acceptance.

## What MALT Does Not Own

MALT core does not choose the latest root, publish authoritative heads,
guarantee freshness, arbitrate multi-writer conflicts, provide global
availability, or define tenant and quota policy. Those are application or
deployment concerns built around MALT. Managed gateway service behavior belongs
in the separate `DeWebProtocol/gateway` repository.

The current source removes retired Map/List, Resolve/Read, client-root and
Artifact compatibility interfaces. It remains pre-beta; independent package
releases retain their own exact provenance requirements.

## Where to Go Next

- [Problem: Structure Embedded in Identity](/narrative/problem)
- [MALT Abstraction](/narrative/abstraction)
- [Root-Centric HTTP API](/docs/api)
- [ProofLists](/docs/prooflists)
- [MALT UnixFS Application Model](/docs/unixfs-layout)
