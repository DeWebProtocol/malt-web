# Typed Authentication Proofs

The current query profile is `malt.authentication/3`. An application constructs
an explicit root, label traversal steps, and an operation: `resolve`, `binding`,
or `range`. The untrusted executor returns traversal evidence and, when
requested, binding or range evidence. Core verifies that result against the
caller's exact request without a Gateway, CAS or ArcTable.

```text
Authenticate(request) -> result
Verify(request, result) -> valid / invalid
POST /v1/authentication/query -> authentication result
```

The authentication tree consumes coordinates and targets. Outside `auth`,
`derivation` converts opaque application label bytes to coordinates and `engine`
applies the profile selected by each Root. `traversal` composes label queries.

## Explicit payload selection

An empty `steps` array requests root identity. UnixFS discovers payloads using
the ordinary label `@payload` (base64 `"QHBheWxvYWQ="`). Core gives this label
no special meaning. Applications own reserved names and payload discovery.

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
