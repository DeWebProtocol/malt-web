import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, webcrypto } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { verifyAuthenticationLocally } from '../docs/.vitepress/theme/malt-verifier.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = process.env.MALT_VERIFIER_ROOT || path.join(repo, 'docs/public/verifier')
const pin = JSON.parse(fs.readFileSync(path.join(repo, 'verifier-source.json')))
const provenance = JSON.parse(fs.readFileSync(path.join(root, 'PROVENANCE.json')))
assert.equal(provenance.schema, 'malt.web-verifier.provenance/v2')
for (const [key, value] of Object.entries(pin)) assert.equal(provenance[key], value, key)
assert.equal(provenance.authentication_profile, 'malt.authentication/1')
assert.equal(provenance.corpus, 'authentication-v1.json')
assert.equal(provenance.target, 'js/wasm')
assert.match(provenance.go_version, /^go\d+\.\d+(?:\.\d+)?$/)
assert.deepEqual(provenance.build_flags, ['-p=6', '-mod=readonly', '-buildvcs=false', '-trimpath'])
assert.deepEqual(provenance.build_environment, { GOENV: 'off', GOWORK: 'off', GOFLAGS: '', GOTOOLCHAIN: 'local' })
const required = new Set(['malt-verifier.wasm', 'wasm_exec.js', 'PROVENANCE.json', 'authentication-v1.json'])
for (const line of fs.readFileSync(path.join(root, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
  const entry = /^([0-9a-f]{64}) [ *]([^/\r\n]+)$/.exec(line)
  assert(entry && required.delete(entry[2]), `unexpected or repeated checksum ${line}`)
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, entry[2]))).digest('hex'), entry[1], entry[2])
}
assert.equal(required.size, 0)
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
const provider = { authentication: globalThis.maltVerifyAuthentication }
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
