# MALT Web

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Public website and design documentation for MALT.

MALT is a general arc-granularity data-authentication system for graph-shaped
relations. Vector-commitment backends authenticate arcs, immutable payloads
remain in content-addressed storage (CAS), and untrusted execution components
locate and serve proofs. UnixFS is one application model over that core. The
native client currently exposes one `hybrid` MALT materialization strategy;
future strategies remain client/application concerns.

## Current Release

[`v0.0.6`](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.6) is the
current experimental core SDK release. New integrations use
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
[`DeWebProtocol/malt/docs`](https://github.com/dewebprotocol/malt/tree/main/docs).
Reproducible benchmark runners, comparison adapters, plans, and research-grade
result generation live in
[`DeWebProtocol/malt-evaluation`](https://github.com/dewebprotocol/malt-evaluation).
This site summarizes concepts, tutorials, and public narrative, and links back
to the implementation repository for source-of-truth technical details.

## Related Repositories

- [`DeWebProtocol/malt`](https://github.com/dewebprotocol/malt) — application-neutral authentication SDK, normative contracts, MIPs, and verifier
- [`DeWebProtocol/gateway`](https://github.com/dewebprotocol/gateway) — managed gateway, ArcTable/KV/CAS materialization, and service integration
- [`DeWebProtocol/malt-client`](https://github.com/dewebprotocol/malt-client) — trusted CLI/daemon, MALT-authenticated UnixFS, and IPFS-compatible Merkle DAG UnixFS import, separated into transport, trust, application, and compatibility layers
- [`DeWebProtocol/malt-evaluation`](https://github.com/dewebprotocol/malt-evaluation) — preserved historical evaluation plus an isolated current-product track and unified boundary gate
- [`DeWebProtocol/malt-web`](https://github.com/dewebprotocol/malt-web) — browser client, public website, conceptual docs, and tutorials
- [`DeWebProtocol/.github`](https://github.com/dewebprotocol/.github) — organization profile and community defaults

## License

MIT — see [LICENSE](LICENSE).
