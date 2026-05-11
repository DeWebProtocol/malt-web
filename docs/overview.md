# MALT Design Overview

MALT is an authenticated mutable structure layer over immutable
content-addressed storage.

Payload remains ordinary CAS content identified by CIDs. MALT defines how the
mutable structure above those payload CIDs is expressed, persisted,
authenticated, read, written, and verified.

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

The root is the caller's correctness handle. The gateway may accelerate
resolution and proof assembly, but the reader checks the returned result against
the supplied root.

## Write Interface

Writers or clients compute or select roots from semantic mutations:

```text
ComputeRoot(baseRoot, semanticMutation) -> newRoot + ArcSets
Materialize(newRoot, ArcSets) -> materializationReceipt
```

The materialization receipt is operational metadata. It is not a correctness
object and does not make the gateway the owner of a head.

## What MALT Does Not Own

MALT core does not choose the latest root, publish authoritative heads,
guarantee freshness, arbitrate multi-writer conflicts, provide global
availability, or define tenant and quota policy. Those are application or
deployment concerns built around MALT.
