# Browser verifier artifacts

`malt-verifier.wasm` is built from MALT's `cmd/malt-verifier-wasm` command.
`wasm_exec.js` must come from the same Go toolchain used for that build.

Regenerate both files from this repository with:

```sh
MALT_SOURCE=/path/to/malt npm run build:verifier
```

The WebAssembly module registers one browser function:

```text
globalThis.maltVerifyArtifact(localVerifyRequestJSON) -> verifyResultJSON
```

The request carries `profile`, an independently selected `trusted_root`, and
the artifact. The result uses the same `malt.artifact/v0alpha2` profile. The
module checks the trusted-root binding and runs the portable KZG/IPA verifier
locally; it does not call a gateway.

`SHA256SUMS` records the checksums for the deployed module and matching Go
runtime. Regenerate it after rebuilding either artifact.
