#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
core_source="${MALT_CORE_SOURCE:?set MALT_CORE_SOURCE to the pinned malt-core checkout}"
core_source="$(cd "$core_source" && pwd -P)"
expected_commit="$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1])).source_commit" "$repo_root/verifier-source.json")"
core_commit="$(git -C "$core_source" rev-parse HEAD)"
if [[ "$core_commit" != "$expected_commit" || -n "$(git -C "$core_source" status --porcelain --untracked-files=all)" ]]; then
  echo "MALT_CORE_SOURCE must be clean at pinned commit $expected_commit" >&2
  exit 1
fi
core_origin="$(git -C "$core_source" remote get-url origin)"
case "${core_origin,,}" in
  git@github.com:dewebprotocol/malt-core.git|https://github.com/dewebprotocol/malt-core.git|https://github.com/dewebprotocol/malt-core) ;;
  *) echo "MALT_CORE_SOURCE must use the canonical Core origin" >&2; exit 1 ;;
esac
if [[ -z "$(git -C "$core_source" for-each-ref --contains="$core_commit" --format='%(refname)' refs/remotes/origin/)" ]]; then
  echo "pinned Core commit is not present in origin refs" >&2; exit 1
fi
core_module="$(cd "$core_source" && GOENV=off GOWORK=off GOFLAGS= go list -m -f '{{.Path}}')"
[[ "$core_module" == github.com/dewebprotocol/malt-core ]] || { echo 'wrong Core module' >&2; exit 1; }
go_root="$(cd "$core_source" && GOENV=off GOWORK=off GOFLAGS= go env GOROOT)"
go_binary="$go_root/bin/go"
go_version="$("$go_binary" env GOVERSION)"
temporary="$(mktemp -d /tmp/malt-web-verifier.XXXXXXXX)"
trap 'rm -rf -- "$temporary"' EXIT
(
  cd "$core_source"
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local "$go_binary" mod verify
  GOENV=off GOWORK=off GOFLAGS= GOTOOLCHAIN=local GOOS=js GOARCH=wasm \
    "$go_binary" build -p=6 -mod=readonly -buildvcs=false -trimpath -o "$temporary/malt-verifier.wasm" ./cmd/malt-verifier-wasm
)
cp "$go_root/lib/wasm/wasm_exec.js" "$temporary/wasm_exec.js"
cp "$core_source/conformance/authentication-v1.json" "$temporary/authentication-v1.json"
node --input-type=module - "$repo_root/verifier-source.json" "$temporary/PROVENANCE.json" "$go_version" <<'JS'
import fs from 'node:fs'
const [pin, output, go] = process.argv.slice(2)
fs.writeFileSync(output, JSON.stringify({ schema: 'malt.web-verifier.provenance/v2',
  ...JSON.parse(fs.readFileSync(pin)), go_version: go, target: 'js/wasm',
  authentication_profile: 'malt.authentication/1', corpus: 'authentication-v1.json',
  build_flags: ['-p=6', '-mod=readonly', '-buildvcs=false', '-trimpath'],
  build_environment: { GOENV: 'off', GOWORK: 'off', GOFLAGS: '', GOTOOLCHAIN: 'local' }
}, null, 2) + '\n')
JS
(cd "$temporary" && sha256sum malt-verifier.wasm wasm_exec.js PROVENANCE.json authentication-v1.json > SHA256SUMS)
MALT_VERIFIER_ROOT="$temporary" node "$repo_root/scripts/check-verifier-wasm.mjs"
output="$repo_root/docs/public/verifier"
for artifact in malt-verifier.wasm wasm_exec.js PROVENANCE.json authentication-v1.json; do
  install -m 0644 "$temporary/$artifact" "$output/$artifact"
done
install -m 0644 "$temporary/SHA256SUMS" "$output/SHA256SUMS"
