# MALT Web

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Public website, design documentation, and browser proof-verification tools for
MALT. The managed account and Bucket UI lives in
[`DeWebProtocol/gateway/console`](https://github.com/DeWebProtocol/gateway/tree/main/console);
this repository does not ship the Gateway Console.

Website: [dewebprotocol.github.io/malt-web](https://dewebprotocol.github.io/malt-web/).

MALT is a general arc-granularity data-authentication system for graph-shaped
relations. Vector-commitment backends authenticate arcs, immutable payloads
remain in content-addressed storage (CAS), and untrusted execution components
locate and serve proofs. UnixFS is one application model over that core. The
user-controlled local runtime supports `flat-v1`, `hybrid-v1` and `rooted-v1`
UnixFS layouts. Layout selection and payload handling remain runtime
application concerns.

## Current Source and Verifier Pin

Current source uses explicit typed authentication through
`malt.authentication/3`, with Prefix and Positional trees. Retired Map/List,
Resolve/Read and Artifact compatibility adapters are removed. Applications
select every traversal input as opaque label bytes, including the ordinary
`@payload` label where required by their layout. Core rc.3 also offers optional
`sdk/object` Map/List/Immutable constructors over these current contracts.

The public verifier uses the supported `@dewebprotocol/malt/verifier` API and
copies WASM assets from the exact malt-ts commit pinned in `package-lock.json`.
`verifier-source.json` binds the SDK commit, its Core source identity, the
verifier asset-set digest, and the portable corpus digest. Run
`npm run sync:verifier` after deliberately updating those pins; this website
does not compile WASM or manage its own browser runtime. The current pin is
SDK `0.0.3-rc.4` at `a145712a7a5f0759f4f2a8a64e42364947daaf41`, bound to
Core `v0.0.10-rc.4` at `0d7b166d58d1c2e21ead96de9c66968caf630374`.

The Resolve tool calls the current Gateway typed query route. The Verify tool
imports proof JSON locally and verifies only a query whose Root and request the
user confirms; it does not establish freshness or verify downloaded payload
bytes. See [the tool documentation](docs/tools/verify.md).

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

## Deployment

GitHub Actions tests and builds each push to `main`, then publishes the static
artifact to [GitHub Pages](https://dewebprotocol.github.io/malt-web/). Pages uses
the Actions publishing source and the `github-pages` environment. The public
site's base path is `/malt-web/`; local development defaults to `/`.

To reproduce the deployed path locally:

```sh
BASE_PATH=/malt-web/ npm run build
BASE_PATH=/malt-web/ npm run preview
```

The managed Gateway Console has its own deployment in the Gateway repository.

## Test

Run documentation, browser-query, local import, asynchronous state, and actual
WASM conformance checks:

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
- [`DeWebProtocol/malt-ts`](https://github.com/dewebprotocol/malt-ts) — supported TypeScript/JavaScript API, browser Workers, and WASM assets bound to an exact published Core release
- [`DeWebProtocol/gateway`](https://github.com/dewebprotocol/gateway) (private) — optional untrusted hosted executor, Bucket/CAS gateway, same-origin Console, and managed-service integration
- [`DeWebProtocol/malt`](https://github.com/dewebprotocol/malt) — user-controlled MALT local runtime, CLI/daemon, trusted-root policy, UnixFS, and Merkle DAG compatibility; its Go module remains `github.com/dewebprotocol/malt-client` during the initial refactor
- [`DeWebProtocol/malt-evaluation`](https://github.com/dewebprotocol/malt-evaluation) (private) — the `malt-eval-next` experiment protocol, explicit Core/product measurement boundaries, replay accounting, and result provenance
- [`DeWebProtocol/malt-web`](https://github.com/dewebprotocol/malt-web) — public website, conceptual docs, tutorials, and browser proof-verification tools
- [`DeWebProtocol/.github`](https://github.com/dewebprotocol/.github) — organization profile and community defaults

## License

MIT — see [LICENSE](LICENSE).
