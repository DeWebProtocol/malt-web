# MALT Web

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Public website and design documentation for MALT.

MALT is a general arc-granularity data-authentication system for graph-shaped
relations. Vector-commitment backends authenticate arcs, immutable payloads
remain in content-addressed storage (CAS), and untrusted execution components
locate and serve proofs. UnixFS is one application model over that core; its
`flat` and `hierarchical` choices are materialization layouts.

## Current Release

[`v0.0.4`](https://github.com/DeWebProtocol/malt/releases/tag/v0.0.4) is the
current experimental source-release baseline. It publishes canonical segment
paths and the frozen `malt.artifact/v0alpha2` resolve/prove/verify profile.
Active PR #163 moves new integrations to `malt.resolve/v0alpha1` and
`malt.read/v0alpha1`. APIs and wire shapes remain pre-v1 and are not yet stable
for production use.

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
policy, evaluation rules, and MIPs live in
[`DeWebProtocol/malt/docs`](https://github.com/dewebprotocol/malt/tree/main/docs).
This site summarizes concepts, tutorials, and public narrative, and links back
to the implementation repository for source-of-truth technical details.

## Related Repositories

- [`DeWebProtocol/malt`](https://github.com/dewebprotocol/malt) — Go implementation, implementation-bound docs, MIPs, benchmarks, and evaluation artifacts
- [`DeWebProtocol/malt-web`](https://github.com/dewebprotocol/malt-web) — public website, conceptual docs, tutorials, and user-facing design narrative
- [`DeWebProtocol/.github`](https://github.com/dewebprotocol/.github) — organization profile and community defaults

## License

MIT — see [LICENSE](LICENSE).
