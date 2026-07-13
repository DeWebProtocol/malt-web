# Browser verifier artifacts

`malt-verifier.wasm` is built from MALT's `cmd/malt-verifier-wasm` command.
`wasm_exec.js` must come from the same Go toolchain used for that build.

Regenerate both files from this repository with:

```sh
MALT_SOURCE=/path/to/malt npm run build:verifier
```

The WebAssembly module registers operation-specific browser functions and one
frozen compatibility function:

```text
globalThis.maltVerifyResolve(resolveVerificationJSON) -> verifyResultJSON
globalThis.maltVerifyRead(readVerificationJSON) -> verifyResultJSON
globalThis.maltVerifyArtifact(localVerifyRequestJSON) -> verifyResultJSON
```

The resolve/read request is constructed from the client's independently
selected root and intended segments or typed query. The returned result is
passed separately with its ProofList. The module checks every binding and runs
the portable KZG/IPA verifier locally; it does not call a gateway.

`maltVerifyArtifact` only preserves the released `malt.artifact/v0alpha2`
v0.0.4 compatibility contract. New integrations use
`malt.resolve/v0alpha1` and `malt.read/v0alpha1`.

`PROVENANCE.json` records the exact MALT Git commit, source remote, Go version,
full Go toolchain string, target, and build flags used for the published
module. The build refuses a dirty `MALT_SOURCE`, so the recorded commit always
names the source bytes used for the build.

`SHA256SUMS` records the checksums for the deployed module, matching Go runtime,
and provenance record. Regenerate all published files through the build script;
do not replace the WASM or runtime independently.
