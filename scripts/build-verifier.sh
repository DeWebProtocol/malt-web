#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
malt_source="${MALT_SOURCE:?set MALT_SOURCE to a MALT checkout containing cmd/malt-verifier-wasm}"
output_dir="$repo_root/docs/public/verifier"

for command_name in git go install mktemp node sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "required command not found: $command_name" >&2
    exit 1
  }
done

temporary="$(mktemp -d /tmp/malt-web-verifier.XXXXXXXX)"
cleanup() {
  if [[ "$temporary" == /tmp/malt-web-verifier.* && -d "$temporary" ]]; then
    rm -rf -- "$temporary"
  fi
}
trap cleanup EXIT
staging_dir="$temporary/verifier"

if ! git -C "$malt_source" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "MALT_SOURCE must be a Git checkout so verifier provenance can be recorded" >&2
  exit 1
fi
malt_source="$(cd "$malt_source" && pwd -P)"
malt_top="$(cd "$(git -C "$malt_source" rev-parse --show-toplevel)" && pwd -P)"
if [[ "$malt_source" != "$malt_top" ]]; then
  echo "MALT_SOURCE must name the MALT repository root: $malt_top" >&2
  exit 1
fi
malt_origin="$(git -C "$malt_source" remote get-url origin 2>/dev/null || true)"
case "${malt_origin,,}" in
  git@github.com:dewebprotocol/malt | \
  git@github.com:dewebprotocol/malt.git | \
  https://github.com/dewebprotocol/malt | \
  https://github.com/dewebprotocol/malt.git | \
  ssh://git@github.com/dewebprotocol/malt | \
  ssh://git@github.com/dewebprotocol/malt.git)
    ;;
  *)
    echo "MALT_SOURCE origin is not the canonical MALT repository: ${malt_origin:-missing origin}" >&2
    exit 1
    ;;
esac
if [[ -n "$(git -C "$malt_source" status --porcelain --untracked-files=all)" ]]; then
  echo "MALT_SOURCE must be clean; refusing to publish unverifiable source provenance" >&2
  exit 1
fi

malt_commit="$(git -C "$malt_source" rev-parse HEAD)"
origin_refs="$(
  git -C "$malt_source" for-each-ref --contains="$malt_commit" \
    --format='%(refname)' refs/remotes/origin/
)"
if [[ -z "$origin_refs" ]]; then
  echo "MALT_SOURCE commit is not contained by any origin remote-tracking ref: $malt_commit" >&2
  exit 1
fi
malt_module="$(
  cd "$malt_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=auto go list -m -f '{{.Path}}'
)"
if [[ "$malt_module" != "github.com/dewebprotocol/malt" ]]; then
  echo "MALT_SOURCE has unexpected module path $malt_module" >&2
  exit 1
fi

go_root="$(
  cd "$malt_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=auto go env GOROOT
)"
go_binary="$go_root/bin/go"
if [[ ! -x "$go_binary" ]]; then
  echo "selected Go toolchain is missing its executable: $go_binary" >&2
  exit 1
fi
go_version="$(
  cd "$malt_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local "$go_binary" env GOVERSION
)"
go_toolchain="$(
  cd "$malt_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local "$go_binary" version
)"
(
  cd "$malt_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local "$go_binary" mod verify
)

mkdir -p "$staging_dir"
cp "$go_root/lib/wasm/wasm_exec.js" "$staging_dir/wasm_exec.js"
(
  cd "$malt_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local GOOS=js GOARCH=wasm \
    "$go_binary" build -mod=readonly -buildvcs=false -trimpath \
    -o "$staging_dir/malt-verifier.wasm" ./cmd/malt-verifier-wasm
)
chmod 0644 "$staging_dir/wasm_exec.js" "$staging_dir/malt-verifier.wasm"
MALT_COMMIT="$malt_commit" \
GO_VERSION="$go_version" \
GO_TOOLCHAIN="$go_toolchain" \
PROVENANCE_PATH="$staging_dir/PROVENANCE.json" \
  node -e '
    const fs = require("node:fs")
    const provenance = {
      schema: "malt.web-verifier.provenance/v1",
      source_repository: "https://github.com/DeWebProtocol/malt.git",
      source_commit: process.env.MALT_COMMIT,
      go_version: process.env.GO_VERSION,
      go_toolchain: process.env.GO_TOOLCHAIN,
      target: "js/wasm",
      build_flags: ["-mod=readonly", "-buildvcs=false", "-trimpath"],
      build_environment: {
        GOENV: "off",
        GOWORK: "off",
        GOFLAGS: "",
        GOTOOLCHAIN: "local"
      }
    }
    fs.writeFileSync(process.env.PROVENANCE_PATH, `${JSON.stringify(provenance, null, 2)}\n`)
  '
chmod 0644 "$staging_dir/PROVENANCE.json"
(
  cd "$staging_dir"
  sha256sum malt-verifier.wasm wasm_exec.js PROVENANCE.json > SHA256SUMS
)
chmod 0644 "$staging_dir/SHA256SUMS"
cat "$staging_dir/SHA256SUMS"
node "$malt_source/scripts/run-verifier-wasm-vectors.mjs" \
  "$staging_dir/malt-verifier.wasm" \
  "$staging_dir/wasm_exec.js" \
  "$malt_source/conformance/resolve-read/v1/vectors.json"
MALT_VERIFIER_ROOT="$staging_dir" node "$repo_root/scripts/check-verifier-wasm.cjs"

mkdir -p "$output_dir"
for artifact in malt-verifier.wasm wasm_exec.js PROVENANCE.json; do
  install -m 0644 "$staging_dir/$artifact" "$output_dir/$artifact"
done
# Publish the checksum manifest last so an interrupted copy cannot validate a
# mixed old/new artifact set.
install -m 0644 "$staging_dir/SHA256SUMS" "$output_dir/SHA256SUMS"
node "$repo_root/scripts/check-verifier-wasm.cjs"
