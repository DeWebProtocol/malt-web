#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
malt_source="${MALT_SOURCE:?set MALT_SOURCE to a MALT checkout containing cmd/malt-verifier-wasm}"
output_dir="$repo_root/docs/public/verifier"
go_root="$(go env GOROOT)"

mkdir -p "$output_dir"
cp "$go_root/lib/wasm/wasm_exec.js" "$output_dir/wasm_exec.js"
(
  cd "$malt_source"
  GOOS=js GOARCH=wasm go build -buildvcs=false -trimpath \
    -o "$output_dir/malt-verifier.wasm" ./cmd/malt-verifier-wasm
)
chmod 0644 "$output_dir/wasm_exec.js" "$output_dir/malt-verifier.wasm"
sha256sum "$output_dir/malt-verifier.wasm"
