# Public Service Boundary

A public MALT service can be useful before MALT becomes a full product. The
important rule is to keep service conveniences separate from MALT core
correctness.

The current static documentation is split between the
[research narrative](/narrative/problem) and [technical docs](/docs/runtime).
This page describes what stays outside MALT core now that managed gateway work
has its own repository boundary.

## Current First Product

The open gateway now provides an explicit-root product path:

```text
Read(root, query) -> result + ProofList
```

This service provides the integration boundary for:

- public demo roots
- root-relative file and directory reads
- ProofList-bearing responses
- examples for CLI and HTTP clients
- reproducible benchmark datasets
- profiled `resolve` and primitive `read` results, plus diagnostic verification
- Bucket-scoped CAS/root operations composed into UnixFS behavior by trusted
  clients

The gateway now has an operator-controlled named-root publication registry with
monotonic revisions and irreversible freeze. This is application metadata, not
global freshness, consensus, or an automatic client trust decision.
Longer term, user-managed roots are expected to be published through a
decentralized naming system; a Gateway Bucket head remains only an observed
synchronization ref and does not replace that user-controlled trust decision.

The managed product path also provides user accounts, cookie sessions, tenants,
principals, API keys, storage tiers, and multiple Buckets per tenant. Personal
and shared Buckets use the same commit DAG and `main` head; sharing is an ACL
change. When concurrent clients push from the same base, the Gateway
fast-forwards one writer, automatically merges independent map-coordinate
changes, and preserves an unmergeable candidate on a `conflicts/...` branch
instead of overwriting either side.

For the current API surface, see [Gateway Resolve and Read API](/docs/api).

## Managed Gateway Repository

The managed gateway service belongs in `DeWebProtocol/gateway`, not in MALT
core. That repository owns tenant policy, identity, authorization,
root publication, backend orchestration, cache policy, S3/Filecoin/IPFS integration,
quota, and product-level end-to-end tests.

The gateway embeds the untrusted core executor so behavior can be exercised end
to end. Payload storage and MALT authentication remain separate capabilities:

```text
                         +-> MALT execution/core -> result + ProofList
client -> managed/reference gateway
                         +-> CAS payloads --------> bytes identified by CID

client verifies the ProofList locally against its trusted root and checks payload bytes
against the authenticated CID
```

CAS is not defined by MALT core, and the gateway is not part of the
authentication trust boundary. Bucket ACLs authorize service access; they do
not make a Gateway head a trusted client root. The browser does not use a
public raw-CAS `GET /v1/cas/{cid}` path: immutable payload reads require a
managed Bucket ID and an authenticated cookie session or API key, and go
through the Bucket-scoped route. The client still hashes every returned block
against its authenticated CID.

The browser App registers or signs in with an email or username and password.
On the managed HTTPS deployment, the Gateway keeps the resulting session in a
`Secure`, `HttpOnly`, same-site cookie; JavaScript does not persist a password
or session token.
Existing API keys remain available as a compatibility sign-in method and stay
in tab memory only. After authentication, the App lists only the Buckets
returned for that principal. The user selects a Bucket instead of entering a
Bucket ID or root. That selection fetches the Bucket's current `main` ref and
uses its root as the tab's browsing snapshot; the App does not silently follow
later head changes. All content reads still verify proofs and payload CIDs
locally.

Managed same-origin builds configure the Gateway URL at build time, so the App
does not expose Gateway topology as an end-user setting. Local development can
still point the sign-in form at a separate Gateway. A new deployment exposes a
one-time administrator initialization form only while bootstrap is required.
Signed-in users can edit their display name and inspect their tier and quota.
Only a cookie session whose account has `system_role: "admin"` exposes the
service Console; the Gateway independently enforces every Console API call.
Bucket-level `admin` or `owner` roles never grant access to that system
Console.

The current public-registration flow is an Alpha boundary, not a production
identity system. Email addresses are normalized and unique but are not yet
verified, and password recovery is not yet available. Registration and login
have reverse-proxy and in-process abuse limits, but users should not reuse a
valuable password. New accounts receive 10 MiB; the current administrator
tiers are 10 MiB, 10 GiB, and 1 TiB, with 3, 100, and 1,000 Buckets
respectively. Immutable payloads are charged once per tenant and unique CID
with a 4 KiB minimum. Persistent Bucket metadata operations share the same
byte entitlement and use a conservative 64 KiB minimum allocation so empty
roots, mutations, branches, or pushes cannot bypass storage limits. Historical
charges remain until an explicit garbage-collection and reconciliation policy
exists.

For uploads, the App stores a local candidate before refreshing the remote
head, and accepts `fast_forward`, `merged`, or `branched` push outcomes only
after the returned main ref, final commit, submitted candidate, and optional
conflict branch are bound to the original request.
Credentialed requests require HTTPS except for loopback development Gateways
and reject redirects so credentials are never forwarded to another URL.
Pending and branched browser stashes are listed after reload; users can retry a
pending push with its original push ID/base or explicitly restore its candidate
root without first replacing it with the latest remote head. Each stash is an
independent localStorage record bound to the canonical Gateway URL,
tenant/principal identity, and Bucket ID, so one tab cannot overwrite another
stash through a shared array update and a later sign-in cannot redirect an old
retry. The
stored `base_revision` records what the browser observed; it is diagnostic
metadata, not a client-selected compare-and-swap token. Legacy array stashes
that predate Gateway scoping remain visible, but cannot be opened or retried
until the user explicitly binds one to the selected Gateway and Bucket.
Binding creates a scoped record while preserving the original
deterministic push ID, so a retry can recover a response lost before the
browser learned the first push result. Binding requires the browser Web Locks
API and records one structured, Gateway-independent ownership marker for the
legacy ID. Competing tabs can therefore bind a legacy candidate to only one
canonical Gateway/account/Bucket scope. The App rechecks that marker before
restore, before and after a retry refresh, immediately before the push, and
again before completing or deleting the stash. Until binding, the App performs
no Gateway read for that legacy candidate.

Observed main refs are merged monotonically within one canonical Gateway
scope. A delayed response from an idempotent retry may complete the matching
stash, but it cannot replace a newer observed revision; two different
commit/root tuples at the same revision are rejected as an inconsistent
Gateway response. Revisions from different Gateway scopes are not compared.

## Product Surface

Accounts, API keys, the service Console, storage tiers, private datasets, and
managed publication channels belong to the gateway product surface or a
private deployment overlay. The documentation site outside the App remains
static and verifiable.

Suggested split when that happens:

- project website and docs: this VitePress site
- runtime API: hosted service endpoint
- service console: the authenticated App surface backed by Gateway admin APIs
- status page: separate operational status surface

## Public Wording

Use precise public language:

- "root-relative resolver reads"
- "client-verifiable ProofLists"
- "application-controlled root publication"
- "snapshot correctness relative to a trusted root"

Avoid implying that a Bucket head is a globally fresh or automatically trusted
root. It is the Gateway's current ref under its documented concurrency policy.
