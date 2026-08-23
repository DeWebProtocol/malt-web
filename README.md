# MALT Web

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Public website, design documentation, and browser proof-verification tools for
MALT. The managed account and Bucket UI lives in
[`DeWebProtocol/gateway/console`](https://github.com/DeWebProtocol/gateway/tree/main/console);
this repository does not ship the Gateway Console.

MALT is a general arc-granularity data-authentication system for graph-shaped
relations. Vector-commitment backends authenticate arcs, immutable payloads
remain in content-addressed storage (CAS), and untrusted execution components
locate and serve proofs. UnixFS is one application model over that core. The
user-controlled local runtime currently exposes one `hybrid` MALT
materialization strategy; future strategies remain runtime
adapter/application concerns.

## Current Release

[`malt-core v0.0.8`](https://github.com/DeWebProtocol/malt-core/releases/tag/v0.0.8)
is the current Core SDK release. The `v0.0.7` release established the renamed
repository and Go module; historical tags and releases remain valid. `v0.0.8`
is a wire-compatible Map-proof performance update. New integrations use
`malt.resolve/v0alpha1` and `malt.read/v0alpha1`; the v0.0.4
`malt.artifact/v0alpha2` resolve/prove/verify profile remains frozen
compatibility behavior. APIs and wire shapes remain pre-v1 and are not yet
stable for production use.

## Prerequisites

- Node.js 22 or newer
- npm (comes with Node.js)

## Development

```sh
npm install
npm run dev
```

The dev server starts at `http://127.0.0.1:5173`.

## Build

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

## Test

Run content and tool-link checks:

```sh
npm test
```

## Documentation Ownership

Protocol behavior, verifier-facing schemas, wire-format notes, compatibility
policy, and MIPs live in
[`DeWebProtocol/malt-core/docs`](https://github.com/dewebprotocol/malt-core/tree/main/docs).
Reproducible benchmark runners, comparison adapters, plans, and research-grade
result generation live in
[`DeWebProtocol/malt-evaluation`](https://github.com/dewebprotocol/malt-evaluation).
This site summarizes concepts, tutorials, and public narrative, and links back
to the implementation repository for source-of-truth technical details.
Managed-service behavior and the same-origin Console are defined by
[`DeWebProtocol/gateway`](https://github.com/DeWebProtocol/gateway).

## Related Repositories

- [`DeWebProtocol/malt-core`](https://github.com/dewebprotocol/malt-core) — application-neutral authentication SDK, normative contracts, MIPs, and verifier
- [`DeWebProtocol/gateway`](https://github.com/dewebprotocol/gateway) — optional untrusted hosted executor, Bucket/CAS gateway, same-origin Console, and managed-service integration
- [`DeWebProtocol/malt`](https://github.com/dewebprotocol/malt) — user-controlled MALT local runtime, CLI/daemon, trusted-root policy, UnixFS, and Merkle DAG compatibility; its Go module remains `github.com/dewebprotocol/malt-client` during the initial refactor
- [`DeWebProtocol/malt-evaluation`](https://github.com/dewebprotocol/malt-evaluation) — current-product and current-core workloads, executable paper plans/suites, result schemas, and preserved historical provenance
- [`DeWebProtocol/malt-web`](https://github.com/dewebprotocol/malt-web) — public website, conceptual docs, tutorials, and browser proof-verification tools
- [`DeWebProtocol/.github`](https://github.com/dewebprotocol/.github) — organization profile and community defaults

## License

MIT — see [LICENSE](LICENSE).
