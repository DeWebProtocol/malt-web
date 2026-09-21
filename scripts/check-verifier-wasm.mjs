import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { webcrypto } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { verifyInstalledAssets } from './verifier-assets.mjs'
import { verifyAuthenticationLocally } from '@dewebprotocol/malt/verifier'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = process.env.MALT_VERIFIER_ROOT || path.join(repo, 'docs/public/verifier')
verifyInstalledAssets(root)
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'authentication-v1.json')))
assert.equal(corpus.schema, 'malt.conformance.authentication/1')
globalThis.crypto ??= webcrypto
await import(pathToFileURL(path.join(root, 'wasm_exec.js')))
const go = new globalThis.Go()
globalThis.maltVerifierBackend = 'all'
const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(root, 'malt-verifier.wasm')), go.importObject)
let failure
void go.run(instance).catch(error => { failure = error })
const deadline = Date.now() + 120000
while (!globalThis.maltVerifierReady) {
  if (failure) throw failure
  if (globalThis.maltVerifierInitError) throw new Error(globalThis.maltVerifierInitError)
  assert(Date.now() < deadline, 'WASM initialization timeout')
  await new Promise(resolve => setTimeout(resolve, 10))
}
assert.equal(globalThis.maltVerifierLoadedBackend, 'all')
assert.equal(globalThis.maltVerifierInitError, undefined)
assert.equal(typeof globalThis.maltVerifyAuthentication, 'function')
for (const old of ['maltVerifyResolve', 'maltVerifyRead', 'maltVerifyMapProof', 'maltVerifyArtifact']) assert.equal(globalThis[old], undefined)
// The supported provider accepts an AbortSignal; the internal Go ABI takes
// only the serialized query. Adapt it explicitly for this native test host.
const provider = { authentication: json => globalThis.maltVerifyAuthentication(json) }
for (const vector of corpus.vectors) {
  const result = await verifyAuthenticationLocally({ ...vector.verification, provider })
  assert.equal(result.valid, vector.valid, `${vector.id}: ${result.error}`)
}
const valid = corpus.vectors.find(vector => vector.valid).verification
for (const mutate of [v => v.request.root = 'bafkqaaa', v => v.request.input = { kind: 'label', data: 'd3Jvbmc=' }, v => v.request.profile = 'malt.authentication/0']) {
  const value = structuredClone(valid); mutate(value)
  assert.equal((await verifyAuthenticationLocally({ ...value, provider })).valid, false)
}
assert.equal((await verifyAuthenticationLocally({ ...valid, provider: {} })).valid, false)
console.log(`Public typed WASM verifier passed ${corpus.vectors.length} Core vectors and hostile input checks.`)
process.exit(0)
