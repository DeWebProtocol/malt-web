# Public typed verifier assets

These files are copied byte-for-byte from the exact `@dewebprotocol/malt`
package locked in `package-lock.json`. `verifier-source.json` records its
malt-ts commit and version, the published Core source identity, the verifier
asset-set digest, and the separately retained Core corpus digest.

The WASM, matching `wasm_exec.js`, `PROVENANCE.json`, and `SHA256SUMS` belong
to malt-ts. Web preserves those files unchanged and imports the supported
`@dewebprotocol/malt/verifier` API for browser initialization and verification.
There is no Core checkout or Go/WASM compilation step in this repository.

After a deliberate SDK dependency/pin update, run sequentially in the workspace
CPU-limited scope:

```sh
npm ci
npm run sync:verifier
npm test
npm run build
```

Synchronization validates package-lock identity, installed SDK metadata, the
Core binding, package asset checksums, and corpus integrity. It runs actual
WASM positive and hostile-vector tests before replacing the site's assets.
