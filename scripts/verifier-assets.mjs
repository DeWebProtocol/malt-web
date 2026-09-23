import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { maltWasmAssetsDirectory, resolveWasmAssetVersions, wasmAssetSetFiles } from '@dewebprotocol/malt/vite'
import { maltCoreRelease, maltTSVersion } from '@dewebprotocol/malt/release'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const verifierFiles = wasmAssetSetFiles.verifier
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export function verifiedPackageAssets() {
  const pin = JSON.parse(fs.readFileSync(path.join(repoRoot, 'verifier-source.json')))
  assert.equal(pin.schema, 'malt.web-verifier-source/v1')
  assert.match(pin.sdk_commit, /^[0-9a-f]{40}$/)
  const archive = `https://github.com/DeWebProtocol/malt-ts/archive/${pin.sdk_commit}.tar.gz`
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json')))
  const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json')))
  assert.equal(pkg.dependencies['@dewebprotocol/malt'], archive)
  assert.equal(lock.packages[''].dependencies['@dewebprotocol/malt'], archive)
  const dependency = lock.packages['node_modules/@dewebprotocol/malt']
  assert.equal(dependency.resolved, archive)
  assert.match(dependency.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/)
  assert.equal(dependency.version, pin.sdk_version)
  const require = createRequire(import.meta.url)
  const installedRoot = path.dirname(require.resolve('@dewebprotocol/malt/package.json'))
  const installed = JSON.parse(fs.readFileSync(path.join(installedRoot, 'package.json')))
  assert.equal(installed.name, '@dewebprotocol/malt')
  assert.equal(installed.version, pin.sdk_version)
  assert.equal(maltTSVersion, pin.sdk_version)
  assert.equal(maltCoreRelease.version, pin.core.module_version)
  assert.equal(maltCoreRelease.commit, pin.core.source_commit)
  const coreLock = JSON.parse(fs.readFileSync(path.join(installedRoot, 'malt-core.lock.json')))
  for (const [key, value] of Object.entries(pin.core)) assert.equal(coreLock[key], value, key)
  const assets = maltWasmAssetsDirectory()
  assert.equal(resolveWasmAssetVersions(assets).verifier, pin.verifier_asset_set_sha256)
  const source = path.join(assets, 'verifier')
  const provenance = JSON.parse(fs.readFileSync(path.join(source, 'PROVENANCE.json')))
  assert.equal(provenance.schema, 'malt.ts-verifier.provenance/v1')
  assert.equal(provenance.source_repository, 'https://github.com/DeWebProtocol/malt-ts.git')
  assert.deepEqual(provenance.core, pin.core)
  return { source, pin }
}

export function verifyInstalledAssets(root = path.join(repoRoot, 'docs/public/verifier')) {
  const { source, pin } = verifiedPackageAssets()
  for (const file of verifierFiles) {
    assert(fs.lstatSync(path.join(root, file)).isFile(), `non-regular verifier asset ${file}`)
    assert(fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(source, file))),
      `deployed verifier differs from the locked malt-ts package: ${file}`)
  }
  assert.equal(digest(fs.readFileSync(path.join(root, 'authentication-v2.json'))), pin.corpus_sha256)
  return { source, pin }
}
