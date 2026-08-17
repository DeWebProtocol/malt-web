# Evaluation Story

MALT's evaluation should show that the system changes the structure-maintenance
cost model for evolving graph-normalized data. The current prototype stores
immutable payloads in CAS, so the benchmark accounting still reports CAS
payload and metadata costs explicitly.

The claim is not that MALT is free. The claim is that MALT replaces
ancestor-propagating Merkle-DAG costs with localized, verifiable semantic-layer
maintenance costs.

## Read Latency

Read latency measures root-relative path/query resolution and large-file range
reads.

The core read shape is:

```text
Read(root, path/query) -> destination + proof/evidence
Read(root, byte range) -> selected bytes + path/payload proof + list_range evidence
```

The current MALT path uses measured-list `list_range` evidence for large-file
range reads. The step carries authenticated fixed chunk metadata, covered
segment CIDs, and metadata/index proof payload. ProofList verification binds
that metadata and the ordered segment CIDs; UnixFS callers accepting returned
bytes additionally perform an equivalent body-binding check. The
`github.com/dewebprotocol/malt-client/unixfs.VerifyRangeBody` helper is part of the local runtime
implementation rather than MALT Core.

Metrics should include:

- end-to-end latency
- CAS GET count and bytes fetched
- ArcTable lookup count for MALT
- retrieval depth
- sequential network rounds
- proof or evidence bytes
- prove latency
- verify latency

Merkle-DAG evidence is the fetched DAG blocks needed for verifier-side hash
reconstruction. MALT evidence is `ProofList`. HAMT evidence is traversal blocks
or proofs for directory lookup.

## Write Amplification

Write amplification measures cumulative authenticated storage occupation under
source-domain mutations.

The main comparison should count all authenticated bytes, not only payload
bytes:

- CAS payload blocks
- CAS metadata blocks
- ArcTable records or deltas
- commitment metadata
- root or publication metadata
- objects or records changed

This matters because MALT intentionally moves work into explicit structure
maintenance. ArcTable and commitment costs are part of the main comparison, not
hidden in a later breakdown.

## Cost Breakdown

Cost breakdown explains the end-to-end results.

For reads, useful components include server/runtime dispatch, ArcTable lookup,
commitment prove, CAS fetch, and client verification.

For writes, useful components include layout translation, semantic mutation,
ArcTable update, commitment update, CAS writes, and root/publication metadata.

This is attribution, not a separate claim that some components can be ignored.

## Sensitivity Studies

Sensitivity studies should vary the design choices that affect the cost model:

- overwrite versus versioned ArcTable
- commitment backend choice
- chunk size
- directory fanout
- file size
- path depth
- version depth
- controlled CAS latency

Proof-off or in-process runs can be useful lower bounds, but they should be
labeled as lower bounds rather than main results.

## Deferred Semantic Reachability Demo

MALT can express relations that are awkward for embedded-reference DAGs, such
as reverse relations, cross-object relations, and multiple views over the same
payloads.

Those demonstrations are useful, but they are secondary to the main
quantitative evaluation. The primary paper story should focus on read latency,
write amplification, and cost attribution.

HAMT is a directory/map-relation baseline. It is not the large-file content
layout baseline. Large-file range experiments compare Merkle/UnixFS chunk
structure with MALT list-backed chunk structure; HAMT affects only directory
lookup when the path traverses a HAMT-sharded directory.
