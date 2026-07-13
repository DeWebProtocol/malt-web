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

The request carries `profile`, an independently selected `trusted_root`, an
`expected` operation/query (plus optional target), and the artifact. The result
uses the same `malt.artifact/v0alpha2` profile. The module checks all caller
expectations and runs the portable KZG/IPA verifier locally; it does not call a
gateway.

`PROVENANCE.json` records the exact MALT Git commit, source remote, Go version,
full Go toolchain string, target, and build flags used for the published
module. The build refuses a dirty `MALT_SOURCE`, so the recorded commit always
names the source bytes used for the build.

`SHA256SUMS` records the checksums for the deployed module, matching Go runtime,
and provenance record. Regenerate all published files through the build script;
do not replace the WASM or runtime independently.
