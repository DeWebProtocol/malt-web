# Problem: Structure Embedded in Identity

MALT starts from a structural limit in Merkle-DAG content-addressed systems:
the same parent hash links define traversal, authentication, and object
identity.

That coupling is useful for immutable content. It becomes expensive when the
structure over immutable content evolves.

## Traversal, Authentication, and Identity

In a Merkle DAG, an object contains links to its children. Those links are part
of the parent object's bytes, so they are also part of the parent object's
hash-derived identity.

This means Traversal, authentication, and identity are tied to the same
embedded edge:

- traversal follows the edge from parent to child
- authentication checks the edge as part of the parent object
- object identity changes when the edge changes

The design is clean for immutable object graphs, but it makes structural change
propagate through the same path used for reads.

## Ancestor-Dependent Rewrite

A local structural update changes a parent object. Because that parent has a
new identity, its parent must also change, and the rewrite continues toward the
root.

This ancestor-dependent rewrite is the core update amplification MALT targets.
The problem is not that a particular UnixFS implementation is inefficient. The
problem is that embedded authenticated links make parent identity depend on
child relation state.

The result is metadata movement and object churn even when payload bytes remain
ordinary immutable CAS blocks.

## Retrieval Depth

Merkle-DAG reads often couple semantic depth to retrieval depth. A path lookup
or range read may need to fetch and inspect a sequence of parent objects before
it can discover the next child link.

That matters when:

- paths are deep
- directories are large
- content is chunked through intermediate layout nodes
- storage latency dominates local computation
- encrypted payloads hide child links until each parent is fetched and
  decrypted

MALT separates the semantic relation being queried from the physical chain of
embedded parent objects used to discover it.

## Expressiveness Limits

Embedded links also impose a graph shape. A Merkle DAG can represent many
useful structures, but every verifier-facing relation must be encoded as an
acyclic committed edge inside object content.

That makes some evolving semantic associations awkward:

- reverse relations
- cross-object views
- regrouping without rewriting payload identity
- multiple authenticated views over the same immutable content

Applications often respond by adding mutable metadata, indexes, or relation
logs outside the same cryptographic closure. Those mechanisms can be practical,
but they make verification application-specific.

## What MALT Changes

MALT keeps immutable CAS payloads. It moves evolving structure into an
authenticated graph semantic layer above those payloads.

The cost does not disappear. MALT replaces implicit ancestor rewrite with
explicit, verifiable structure maintenance:

- list and map semantics define what structure means
- ArcTable stores and materializes root-relative arcsets
- commitment backends authenticate semantic-layer representations
- gateways return `result + ProofList` for caller-supplied roots

The research question becomes whether this explicit structure layer gives a
better cost and verification boundary for evolving CAS-backed data.
