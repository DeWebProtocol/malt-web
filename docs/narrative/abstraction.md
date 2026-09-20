# MALT Abstraction

MALT authenticates structured data whose relationships can be represented as
graph nodes and relations. Immutable payload bytes retain their ordinary CIDs;
authenticated relationships describe how those payloads and other nodes connect.

## Authenticated Graph-Normalized Structure

The abstraction separates three concerns:

- **Payload storage:** immutable bytes live in content-addressed storage.
- **Relation authentication:** typed inputs map to coordinates whose targets
  are committed under a complete MALT Root.
- **Execution and access:** application adapters, ArcTable materialization,
  caches and gateways locate state and produce answers with evidence.

A reader selects a Root according to its application's trust policy, constructs
an exact query, and verifies the untrusted result locally. Publication or a
successful server response does not establish a trusted Root or freshness.

## Typed Inputs and Authentication Trees

Applications submit explicit typed inputs. Core's input rule encodes each one
as a coordinate; the authentication tree operates on coordinates and targets.
The Root binds the input rule, tree layout and commitment profile, so they
cannot be independently substituted during verification.

The two tree layouts serve different workloads:

- **Prefix** authenticates keyed bindings and absence. A complete flat path may
  be a single label input; Core does not parse or group path segments.
- **Positional** authenticates indexed bindings and count metadata. Its
  fixed-chunk form also authenticates byte-layout metadata for range queries.

The current SDK exposes these through `auth/input`, `auth/tree`, `auth/engine`
and `sdk/authentication`. Keyed and sequential application data no longer
require separate semantic Map/List adapters.

## Explicit Graph Traversal

A query supplies an ordered array of typed steps. Each step selects one binding
at the current Root; a following step uses the reached Root's own descriptor.
Applications choose all selectors and arc boundaries. There is no automatic
longest-prefix grouping or implicit terminal payload redirect.

The `malt.authentication/1` query contract supports resolve, binding and range
operations. Local verification checks the caller's complete Root, requested
steps, ordered continuity and final operation evidence. A missing binding
proves where traversal stopped, without authenticating an unvisited suffix.
See [ProofLists and typed results](/docs/prooflists).

## Payload Boundary

The typed `system` selector with number `1` selects a payload binding when the
application layout uses one. A label containing the literal text `@payload`
is a different input. Applications may call the system selector `@payload`
in user-facing path notation, but must translate it explicitly.

Generic Prefix objects need not contain a payload. UnixFS decides which objects
carry directory manifests or file payloads. When traversal ends at a Prefix
Root, its reader explicitly queries the payload selector. In flat layouts,
file and directory entries already point to their payload or manifest target.
Large-file payloads use Positional chunk bindings. The three current UnixFS
strategies are described in [UnixFS layouts](/docs/unixfs-layout).

A Positional range result authenticates bounds, fixed chunk metadata and the
ordered segment CIDs covered by the requested interval. The application must
hash fetched bytes against those CIDs and assemble the requested slice. Core
proof verification alone does not authenticate an arbitrary response body.

## Updates and Trust

Retained typed writers prepare and apply changes, then export candidates.
Materialization can persist an ordered batch and return an exact receipt.
Candidates and receipts describe execution; they are not portable proofs of
state transition, freshness or accepted-root promotion. Applications retain
control of those trust decisions.
