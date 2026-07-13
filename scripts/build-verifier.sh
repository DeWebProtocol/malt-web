#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
malt_source="${MALT_SOURCE:?set MALT_SOURCE to a MALT checkout containing cmd/malt-verifier-wasm}"
output_dir="$repo_root/docs/public/verifier"
go_root="$(go env GOROOT)"

if ! git -C "$malt_source" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "MALT_SOURCE must be a Git checkout so verifier provenance can be recorded" >&2
  exit 1
fi
if [[ -n "$(git -C "$malt_source" status --porcelain --untracked-files=all)" ]]; then
  echo "MALT_SOURCE must be clean; refusing to publish unverifiable source provenance" >&2
  exit 1
fi

malt_commit="$(git -C "$malt_source" rev-parse HEAD)"
malt_repository="$(git -C "$malt_source" remote get-url origin 2>/dev/null || true)"
go_version="$(go env GOVERSION)"
go_toolchain="$(go version)"

mkdir -p "$output_dir"
cp "$go_root/lib/wasm/wasm_exec.js" "$output_dir/wasm_exec.js"
(
  cd "$malt_source"
  GOOS=js GOARCH=wasm go build -buildvcs=false -trimpath \
    -o "$output_dir/malt-verifier.wasm" ./cmd/malt-verifier-wasm
)
chmod 0644 "$output_dir/wasm_exec.js" "$output_dir/malt-verifier.wasm"
MALT_COMMIT="$malt_commit" \
MALT_REPOSITORY="$malt_repository" \
GO_VERSION="$go_version" \
GO_TOOLCHAIN="$go_toolchain" \
PROVENANCE_PATH="$output_dir/PROVENANCE.json" \
  node -e '
    const fs = require("node:fs")
    const provenance = {
      schema: "malt.web-verifier.provenance/v1",
      source_repository: process.env.MALT_REPOSITORY,
      source_commit: process.env.MALT_COMMIT,
      go_version: process.env.GO_VERSION,
      go_toolchain: process.env.GO_TOOLCHAIN,
      target: "js/wasm",
      build_flags: ["-buildvcs=false", "-trimpath"]
    }
    fs.writeFileSync(process.env.PROVENANCE_PATH, `${JSON.stringify(provenance, null, 2)}\n`)
  '
chmod 0644 "$output_dir/PROVENANCE.json"
(
  cd "$output_dir"
  sha256sum malt-verifier.wasm wasm_exec.js PROVENANCE.json > SHA256SUMS
)
cat "$output_dir/SHA256SUMS"
