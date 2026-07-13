const fs = require('node:fs')
const path = require('node:path')
const { createHash, webcrypto } = require('node:crypto')
const { TextDecoder, TextEncoder } = require('node:util')

const repositoryRoot = path.resolve(__dirname, '..')
const verifierRoot = path.join(repositoryRoot, 'docs', 'public', 'verifier')

globalThis.require = require
globalThis.fs = fs
globalThis.path = path
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder
globalThis.performance ??= require('node:perf_hooks').performance
globalThis.crypto ??= webcrypto

require(path.join(verifierRoot, 'wasm_exec.js'))

const root = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const request = {
  profile: 'malt.artifact/v0alpha2',
  artifact: {
    profile: 'malt.artifact/v0alpha2',
    operation: 'resolve',
    root,
    query: { kind: 'path', segments: [] },
    target: root,
    prooflist: { root: { '/': root }, steps: [] }
  }
}

async function main() {
  verifyChecksums()
  const go = new Go()
  const wasm = fs.readFileSync(path.join(verifierRoot, 'malt-verifier.wasm'))
  const { instance } = await WebAssembly.instantiate(wasm, go.importObject)
  void go.run(instance)
  await waitForProvider()

  const accepted = JSON.parse(globalThis.maltVerifyArtifact(JSON.stringify(request)))
  if (accepted.profile !== request.profile || accepted.valid !== true) {
    throw new Error(`identity artifact was not accepted: ${JSON.stringify(accepted)}`)
  }

  const tampered = structuredClone(request)
  tampered.artifact.target = 'bafkreib6qhwx2g5wgdgczgczumrq6rupl7u36po34ohfhn7rmvtpt7a3om'
  const rejected = JSON.parse(globalThis.maltVerifyArtifact(JSON.stringify(tampered)))
  if (rejected.valid !== false) {
    throw new Error('tampered artifact was accepted')
  }
  console.log('Local WASM verifier contract passed.')
}

function verifyChecksums() {
  const sums = fs
    .readFileSync(path.join(verifierRoot, 'SHA256SUMS'), 'utf8')
    .trim()
    .split('\n')
  for (const line of sums) {
    const [expected, filename] = line.trim().split(/\s+/, 2)
    const actual = createHash('sha256')
      .update(fs.readFileSync(path.join(verifierRoot, filename)))
      .digest('hex')
    if (actual !== expected) {
      throw new Error(`checksum mismatch for ${filename}: got ${actual}, want ${expected}`)
    }
  }
}

async function waitForProvider() {
  const deadline = Date.now() + 30_000
  while (typeof globalThis.maltVerifyArtifact !== 'function') {
    if (globalThis.maltVerifierInitError) {
      throw new Error(globalThis.maltVerifierInitError)
    }
    if (Date.now() >= deadline) {
      throw new Error('local verifier initialization timed out')
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  }
)
