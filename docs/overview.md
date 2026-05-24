# MALT Design Overview

MALT is an authenticated graph semantic layer over immutable content-addressed
storage.

Payload remains ordinary CAS content identified by CIDs. MALT defines how the
evolving structure above those payload CIDs is expressed, persisted,
authenticated, read, written, and verified.

The website has two main lanes:

- [Research Narrative](/narrative/problem): problem framing, abstraction,
  system design, and evaluation story.
- [Technical Docs](/docs/runtime): current prototype status, HTTP API,
  ProofLists, UnixFS layout, and benchmark protocol.

## Core Claim

Merkle DAG systems commit traversal structure implicitly inside parent object
content. This is powerful for immutable content, but evolving structure can
force ancestor-dependent rewrites and retrieval-depth costs.

MALT changes the boundary:

- payload is still immutable CAS data
- structure is authenticated by independent structure roots
- `list` and `map` define typed semantic reads and writes
- ArcTable materializes root-relative structure state for efficient access
- stateless commitment backends produce verifier-facing proofs
- reads return `result + ProofList` for local verification

The claim is not that updates become free. The claim is that MALT replaces
implicit ancestor-rewrite costs with explicit, verifiable structure maintenance.

## Layering

```text
Application layout
    |
    v
Semantic layer: list / map
    |
    v
ArcTable: root-recoverable arcset materialization
    |
    v
Commitment backend: stateless proof primitive
    |
    v
KV state + CAS payloads
```

## Read Interface

The verifier-facing read shape is:

```text
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
deployment concerns built around MALT.

## Where to Go Next

- [Problem: Structure Embedded in Identity](/narrative/problem)
- [MALT Abstraction](/narrative/abstraction)
- [Root-Centric HTTP API](/docs/api)
- [ProofLists](/docs/prooflists)
- [MALT UnixFS Layout](/docs/unixfs-layout)
