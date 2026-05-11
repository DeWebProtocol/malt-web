# Public Service Boundary

A public MALT service can be useful before MALT becomes a full product. The
important rule is to keep service conveniences separate from MALT core
correctness.

## Recommended First Service

Start with a hosted gateway for explicit-root reads:

```text
Read(root, query) -> result + ProofList
```

This service can provide:

- public demo roots
- root-relative file and directory reads
- ProofList-bearing responses
- examples for CLI and HTTP clients
- reproducible benchmark datasets

It should not claim to provide global freshness or latest-head discovery unless
an application publication layer is added.

## Future Product Surface

If MALT later exposes accounts, API keys, dashboards, billing, private datasets,
or managed publication channels, those should live in a separate application
surface. The documentation site should remain static and verifiable.

Suggested split when that happens:

- project website and docs: this VitePress site
- gateway API: hosted service endpoint
- service console: separate authenticated application
- status page: separate operational status surface

## Public Wording

Use precise public language:

- "root-relative gateway reads"
- "client-verifiable ProofLists"
- "application-controlled root publication"
- "snapshot correctness relative to a trusted root"

Avoid implying that the gateway owns freshness, latest heads, or multi-writer
merge policy.
