# System Design

MALT combines an application-neutral authentication Core with a local runtime
that owns keys, accepted and candidate roots, application layouts and payload
verification. Gateways store data and return query results, while correctness
is checked locally against the caller's selected Root.

## Separated System Concerns

```text
Payload plane       Portable authentication kernel       Execution plane
CAS + payload CIDs  opaque labels, coordinate trees,       application layouts,
                    commitments and query verification   ArcTable, gateways
```

Application adapters translate paths and changes into explicit opaque labels
and retained writer operations. Core's `sdk/authentication` composes those
operations without owning application policy, persistent storage or HTTP.

## Core Modules

- `derivation` encodes opaque labels using the Root's declared rule.
- `auth/tree` authenticates coordinate bindings with Prefix or Positional
  layouts.
- `auth/commitment` provides commitment, opening and verification primitives.
- `engine` binds those algorithms to complete Root descriptors.
- `traversal` composes explicit label steps across Roots.
- `sdk/authentication` and its host adapter expose query, retained writer and
  session operations to native and browser callers.

Keyed and sequential data are application uses of these layouts. There is no
separate semantic Map/List facade or automatic string-path resolver. Each Root
selects its exact input rule and supported KZG or IPA commitment profile.

## ArcTable and Materialization

Core algorithms consume narrow lookup, update and snapshot capabilities under
`auth/arcset/materializer`. Persistent ArcTable implementations belong to the
Gateway, where they recover enough state to answer queries and generate proofs.
The aggregate compatibility Store is removed.

ArcTable is untrusted materialization. Indexes, storage prefixes, caches and
recovery records can improve execution but do not replace Root-relative
verification or define semantic identity. An invalid returned binding remains
invalid even when it came from a local cache or durable storage.

## Queries, Writers and Receipts

The public operations are:

```text
Authenticate(root, label steps, operation) -> authentication result
Verify(request, result) -> valid / invalid
Prepare / Apply / Export -> locally computed candidate
MaterializeBatch(exact ordered candidates) -> exact durable receipt
```

Queries select resolve, binding or range. Applications construct or independently
match the request before checking its result. A writer receipt identifies the
exact persisted batch; it does not prove a portable state transition or promote
a candidate into the application's trusted roots. See [the typed contracts](/docs/api).

## UnixFS Application Layouts

UnixFS owns path parsing, canonical directory manifests, chunking and payload
verification. Its flat, hybrid and rooted strategies use Prefix keyed bindings,
Positional file chunks and immutable payload objects.

A full path may be one flat label, or the application may emit several Root
selectors. When the selected target is a Prefix Root carrying a payload, the
reader explicitly queries `system` selector `1`. A direct payload or manifest
target needs no extra selector. The literal label `@payload` is a distinct typed
input, not a reserved string recognized by the Core query API.

Range evidence authenticates fixed chunk metadata and selected chunk CIDs.
The reader then checks the fetched bytes and assembles the requested interval.
The [UnixFS layout guide](/docs/unixfs-layout) describes the current strategies.

The [Core repository](https://github.com/DeWebProtocol/malt-core) defines
executable authentication semantics. The
[local runtime](https://github.com/DeWebProtocol/malt) owns UnixFS and CLI
behavior; its Go module path remains `github.com/dewebprotocol/malt-client`.
Current source uses `malt.authentication/3`; exact release pins identify the
implementation used by a deployed binary.
