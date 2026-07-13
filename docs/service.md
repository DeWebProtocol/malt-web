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
- UnixFS content streaming and browser uploads through a local reference executor

It should not claim to provide global freshness or latest-head discovery unless
an application publication layer is added.

For the current API surface, see [Gateway Resolve and Read API](/docs/api).

## Managed Gateway Repository

The managed gateway service belongs in `DeWebProtocol/gateway`, not in MALT
core. That repository owns tenant policy, identity, authorization, root
publication, backend orchestration, cache policy, S3/Filecoin/IPFS integration,
quota, and product-level end-to-end tests.

The `DeWebProtocol/malt` repository may keep a small reference/evaluation
gateway so core behavior can be exercised end to end. Payload storage and MALT
authentication are separate capabilities orchestrated by the gateway:

```text
                         +-> MALT execution/core -> result + ProofList
client -> reference gateway
                         +-> CAS payloads --------> bytes identified by CID

client verifies the ProofList locally against its trusted root and checks payload bytes
against the authenticated CID
```

CAS is not hidden behind or defined by MALT core, and the gateway is not part of
the authentication trust boundary. That reference surface should not become
the production multi-tenant service.

## Product Surface

If MALT exposes accounts, API keys, dashboards, billing, private datasets, or
managed publication channels, those should live in the gateway product surface
or a private deployment overlay. The documentation site should remain static
and verifiable.

Suggested split when that happens:

- project website and docs: this VitePress site
- runtime API: hosted service endpoint
- service console: separate authenticated application
- status page: separate operational status surface

## Public Wording

Use precise public language:

- "root-relative resolver reads"
- "client-verifiable ProofLists"
- "application-controlled root publication"
- "snapshot correctness relative to a trusted root"

Avoid implying that the server runtime owns freshness, latest heads, or
multi-writer merge policy.
