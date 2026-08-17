#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
core_version="v0.0.7"
core_release_commit="53b5a18b5f4d5df823b7fc5be959014b2a928887"
# MALT_SOURCE is a compatibility fallback for existing local build jobs.
core_source="${MALT_CORE_SOURCE:-${MALT_SOURCE:-}}"
if [[ -z "$core_source" ]]; then
  echo "set MALT_CORE_SOURCE to the malt-core v0.0.7 checkout" >&2
  exit 1
fi
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

if ! git -C "$core_source" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "MALT_CORE_SOURCE must be a Git checkout so verifier provenance can be recorded" >&2
  exit 1
fi
core_source="$(cd "$core_source" && pwd -P)"
core_top="$(cd "$(git -C "$core_source" rev-parse --show-toplevel)" && pwd -P)"
if [[ "$core_source" != "$core_top" ]]; then
  echo "MALT_CORE_SOURCE must name the malt-core repository root: $core_top" >&2
  exit 1
fi
core_origin="$(git -C "$core_source" remote get-url origin 2>/dev/null || true)"
case "${core_origin,,}" in
  git@github.com:dewebprotocol/malt-core | \
  git@github.com:dewebprotocol/malt-core.git | \
  https://github.com/dewebprotocol/malt-core | \
  https://github.com/dewebprotocol/malt-core.git | \
  ssh://git@github.com/dewebprotocol/malt-core | \
  ssh://git@github.com/dewebprotocol/malt-core.git)
    ;;
  *)
    echo "MALT_CORE_SOURCE origin is not the canonical malt-core repository: ${core_origin:-missing origin}" >&2
    exit 1
    ;;
esac
if [[ -n "$(git -C "$core_source" status --porcelain --untracked-files=all)" ]]; then
  echo "MALT_CORE_SOURCE must be clean; refusing to publish unverifiable source provenance" >&2
  exit 1
fi

core_commit="$(git -C "$core_source" rev-parse HEAD)"
origin_refs="$(
  git -C "$core_source" for-each-ref --contains="$core_commit" \
    --format='%(refname)' refs/remotes/origin/
)"
if [[ -z "$origin_refs" ]]; then
  echo "MALT_CORE_SOURCE commit is not contained by any origin remote-tracking ref: $core_commit" >&2
  exit 1
fi
tag_commit="$(git -C "$core_source" rev-parse "${core_version}^{commit}")"
if [[ "$core_commit" != "$core_release_commit" || "$tag_commit" != "$core_release_commit" ]]; then
  echo "MALT_CORE_SOURCE must be exact $core_version commit $core_release_commit; got HEAD=$core_commit tag=$tag_commit" >&2
  exit 1
fi
core_module="$(
  cd "$core_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=auto go list -m -f '{{.Path}}'
)"
if [[ "$core_module" != "github.com/dewebprotocol/malt-core" ]]; then
  echo "MALT_CORE_SOURCE has unexpected module path $core_module" >&2
  exit 1
fi

CORE_VECTOR_PATH="$core_source/conformance/resolve-read/v2/vectors.json" \
WEB_FIXTURE_PATH="$repo_root/scripts/fixtures/resolve-kzg-payload.json" \
CORE_COMMIT="$core_commit" \
  node -e '
    const fs = require("node:fs")
    const corpus = JSON.parse(fs.readFileSync(process.env.CORE_VECTOR_PATH, "utf8"))
    const fixture = JSON.parse(fs.readFileSync(process.env.WEB_FIXTURE_PATH, "utf8"))
    const vector = corpus.vectors.find((candidate) => candidate.id === "resolve.kzg.payload.accept")
    if (!vector || fixture.source_vector !== "conformance/resolve-read/v2/vectors.json#resolve.kzg.payload.accept") {
      throw new Error("web verifier fixture does not identify the frozen KZG payload vector")
    }
    if (fixture.verified_commit !== process.env.CORE_COMMIT) {
      throw new Error("web verifier fixture does not bind the selected Core commit")
    }
    if (JSON.stringify(fixture.verification) !== JSON.stringify(vector.verification)) {
      throw new Error("web verifier fixture differs from the selected Core corpus")
    }
  '

go_root="$(
  cd "$core_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=auto go env GOROOT
)"
go_binary="$go_root/bin/go"
if [[ ! -x "$go_binary" ]]; then
  echo "selected Go toolchain is missing its executable: $go_binary" >&2
  exit 1
fi
go_version="$(
  cd "$core_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local "$go_binary" env GOVERSION
)"
go_toolchain="$(
  cd "$core_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local "$go_binary" version
)"
(
  cd "$core_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local "$go_binary" mod verify
)

mkdir -p "$staging_dir"
cp "$go_root/lib/wasm/wasm_exec.js" "$staging_dir/wasm_exec.js"
(
  cd "$core_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local GOOS=js GOARCH=wasm \
    "$go_binary" build -mod=readonly -buildvcs=false -trimpath \
    -o "$staging_dir/malt-verifier.wasm" ./cmd/malt-verifier-wasm
)
chmod 0644 "$staging_dir/wasm_exec.js" "$staging_dir/malt-verifier.wasm"
CORE_COMMIT="$core_commit" \
CORE_MODULE="$core_module" \
CORE_VERSION="$core_version" \
GO_VERSION="$go_version" \
GO_TOOLCHAIN="$go_toolchain" \
PROVENANCE_PATH="$staging_dir/PROVENANCE.json" \
  node -e '
    const fs = require("node:fs")
    const provenance = {
      schema: "malt.web-verifier.provenance/v1",
      source_repository: "https://github.com/DeWebProtocol/malt-core.git",
      source_module: process.env.CORE_MODULE,
      source_version: process.env.CORE_VERSION,
      source_commit: process.env.CORE_COMMIT,
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
node "$core_source/scripts/run-verifier-wasm-vectors.mjs" \
  "$staging_dir/malt-verifier.wasm" \
  "$staging_dir/wasm_exec.js" \
  "$core_source/conformance/resolve-read/v2/vectors.json" \
  all \
  "$core_source/conformance/map-proof/v1/vectors.json"
MALT_VERIFIER_ROOT="$staging_dir" node "$repo_root/scripts/check-verifier-wasm.cjs"

mkdir -p "$output_dir"
for artifact in malt-verifier.wasm wasm_exec.js PROVENANCE.json; do
  install -m 0644 "$staging_dir/$artifact" "$output_dir/$artifact"
done
# Publish the checksum manifest last so an interrupted copy cannot validate a
# mixed old/new artifact set.
install -m 0644 "$staging_dir/SHA256SUMS" "$output_dir/SHA256SUMS"
node "$repo_root/scripts/check-verifier-wasm.cjs"
