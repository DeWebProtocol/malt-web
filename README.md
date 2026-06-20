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

## Related Repositories

- [`DeWebProtocol/malt`](https://github.com/dewebprotocol/malt) — Go implementation
- [`DeWebProtocol/malt-docs`](https://github.com/dewebprotocol/malt-docs) — Protocol specifications and MIPs (planned)

## License

MIT — see [LICENSE](LICENSE).
