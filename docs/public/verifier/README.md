# Browser verifier artifacts

`malt-verifier.wasm` is built from MALT's `cmd/malt-verifier-wasm` command.
`wasm_exec.js` must come from the same Go toolchain used for that build.

Regenerate both files from this repository with:

```sh
MALT_SOURCE=/path/to/malt npm run build:verifier
```

The WebAssembly module registers one browser function:

```text
globalThis.maltVerifyArtifact(verifyRequestJSON) -> verifyResultJSON
```

The request and result use the `malt.artifact/v0alpha2` profile. The module
runs the portable KZG/IPA verifier locally; it does not call a gateway.

`SHA256SUMS` records the checksums for the deployed module and matching Go
runtime. Regenerate it after rebuilding either artifact.
