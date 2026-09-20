# Public typed verifier assets

`verifier-source.json` pins the exact reviewed Core commit and its Go
pseudo-version. This identifies source, not a published Core release. The
browser assets implement only `malt.authentication/1`, using Core's portable
verifier with both KZG and IPA backends. They carry the current Core corpus,
`malt.web-verifier.provenance/v2`, and checksums for every artifact.

Rebuild from the clean pinned Core checkout:

```sh
MALT_CORE_SOURCE=/path/to/malt-core npm run build:verifier
npm test
npm run build
```

Run builds in the workspace CPU-limited transient scope. The build rejects a
changed commit, dirty source, wrong repository or module, and tests positive
and hostile Core vectors before replacing assets. The supported reusable
TypeScript distribution remains `malt-ts`, whose release builds separately
require an exact published Core release.
