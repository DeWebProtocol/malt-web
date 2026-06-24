# MALT Web

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Public website and design documentation for MALT.

MALT targets authenticated structured data: data whose relationships can be
normalized into graph-shaped nodes and relations. This site presents the public
design narrative, root-centric resolver/writer model, service boundary, and
evaluation plan.

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
