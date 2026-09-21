# Typed Authentication Proofs

The current query profile is `malt.authentication/1`. An application constructs
an explicit root, typed traversal steps, and an operation: `resolve`, `binding`,
or `range`. The untrusted executor returns traversal evidence and, when
requested, binding or range evidence. Core verifies that result against the
caller's exact request without a Gateway, CAS or ArcTable.

```text
Authenticate(request) -> result
Verify(request, result) -> valid / invalid
POST /v1/authentication/query -> authentication result
```

The authentication tree owns coordinates and proofs. `auth/input` encodes
labels, positional indices and system selectors; `auth/engine` applies them to
a Root descriptor. `traversal` composes explicit queries. There are no
separate legacy Map/List proof or Resolve/Read APIs.

## Explicit payload selection

An empty `steps` array requests root identity. The typed system selector
`{"kind":"system","number":"1"}` selects a Prefix Root's payload; the
literal label `@payload` is ordinary label data, not that selector.

UnixFS interprets paths according to the selected layout. Flat layout uses a
whole-path label and can point directly to a payload or directory manifest.
When the resolved target remains a Prefix Root, the application explicitly
adds the payload selector. A Positional Root exposes authenticated sequence
metadata and ranges directly.

## Payload bytes and trust

Range evidence binds ordered segment CIDs and geometry. Applications must also
check downloaded segment bytes, lengths and slicing against that evidence.
Verifying a proof alone does not check a displayed payload buffer.

Proof validity is relative to the caller-selected snapshot. A proof does not
establish root freshness, publication, accepted-root promotion, or a portable
state transition. The [public verifier](/tools/verify) checks one explicit
query at a time. Imported requests remain untrusted until the user confirms
the intended root and query.
