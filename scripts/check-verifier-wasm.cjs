const fs = require('node:fs')
const path = require('node:path')
const { createHash, webcrypto } = require('node:crypto')
const { TextDecoder, TextEncoder } = require('node:util')

const repositoryRoot = path.resolve(__dirname, '..')
const verifierRoot = path.join(repositoryRoot, 'docs', 'public', 'verifier')
const rootContentFixture = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'scripts', 'fixtures', 'root-directory-content.json'), 'utf8')
)

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
  trusted_root: root,
  expected: {
    operation: 'resolve',
    query: { kind: 'path', segments: [] }
  },
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
  verifyProvenance()
  const go = new Go()
  const wasm = fs.readFileSync(path.join(verifierRoot, 'malt-verifier.wasm'))
  const { instance } = await WebAssembly.instantiate(wasm, go.importObject)
  void go.run(instance)
  await waitForProvider()

  const accepted = JSON.parse(globalThis.maltVerifyArtifact(JSON.stringify(request)))
  if (accepted.profile !== request.profile || accepted.valid !== true) {
    throw new Error(`identity artifact was not accepted: ${JSON.stringify(accepted)}`)
  }

  const rootContentRequest = {
    profile: rootContentFixture.artifact.profile,
    trusted_root: rootContentFixture.expected.trusted_root,
    expected: {
      operation: rootContentFixture.expected.operation,
      query: rootContentFixture.expected.query
    },
    artifact: rootContentFixture.artifact
  }
  const rootContentAccepted = JSON.parse(
    globalThis.maltVerifyArtifact(JSON.stringify(rootContentRequest))
  )
  if (rootContentAccepted.profile !== request.profile || rootContentAccepted.valid !== true) {
    throw new Error(
      `real daemon root-content artifact was not accepted: ${JSON.stringify(rootContentAccepted)}`
    )
  }

  // v0.0.4 omitted an empty path segments array. The same v0alpha2 profile
  // treats the absent field as the canonical identity path, while explicit
  // null remains invalid.
  const v004Identity = structuredClone(request)
  delete v004Identity.artifact.query.segments
  const v004Accepted = JSON.parse(globalThis.maltVerifyArtifact(JSON.stringify(v004Identity)))
  if (v004Accepted.profile !== request.profile || v004Accepted.valid !== true) {
    throw new Error(`v0.0.4 identity artifact was not accepted: ${JSON.stringify(v004Accepted)}`)
  }

  const nullSegments = structuredClone(request)
  nullSegments.artifact.query.segments = null
  const nullRejected = JSON.parse(globalThis.maltVerifyArtifact(JSON.stringify(nullSegments)))
  if (nullRejected.valid !== false) {
    throw new Error('identity artifact with explicit null segments was accepted')
  }

  const tampered = structuredClone(request)
  tampered.artifact.target = 'bafkreib6qhwx2g5wgdgczgczumrq6rupl7u36po34ohfhn7rmvtpt7a3om'
  const rejected = JSON.parse(globalThis.maltVerifyArtifact(JSON.stringify(tampered)))
  if (rejected.valid !== false) {
    throw new Error('tampered artifact was accepted')
  }

  const wrongRoot = structuredClone(request)
  wrongRoot.trusted_root = 'bafkreib6qhwx2g5wgdgczgczumrq6rupl7u36po34ohfhn7rmvtpt7a3om'
  const rootRejected = JSON.parse(globalThis.maltVerifyArtifact(JSON.stringify(wrongRoot)))
  if (rootRejected.valid !== false || !rootRejected.error?.includes('does not match trusted root')) {
    throw new Error(`trusted-root mismatch was not rejected: ${JSON.stringify(rootRejected)}`)
  }

  const wrongQuery = structuredClone(request)
  wrongQuery.expected.query.segments = ['docs']
  const queryRejected = JSON.parse(globalThis.maltVerifyArtifact(JSON.stringify(wrongQuery)))
  if (queryRejected.valid !== false || !queryRejected.error?.includes('does not match expected query')) {
    throw new Error(`client-query mismatch was not rejected: ${JSON.stringify(queryRejected)}`)
  }
  console.log('Local WASM verifier contract passed.')
}

function verifyChecksums() {
  const sums = fs
    .readFileSync(path.join(verifierRoot, 'SHA256SUMS'), 'utf8')
    .trim()
    .split('\n')
  const checked = new Set()
  for (const line of sums) {
    const [expected, filename] = line.trim().split(/\s+/, 2)
    const actual = createHash('sha256')
      .update(fs.readFileSync(path.join(verifierRoot, filename)))
      .digest('hex')
    if (actual !== expected) {
      throw new Error(`checksum mismatch for ${filename}: got ${actual}, want ${expected}`)
    }
    checked.add(filename)
  }
  for (const filename of ['malt-verifier.wasm', 'wasm_exec.js', 'PROVENANCE.json']) {
    if (!checked.has(filename)) {
      throw new Error(`SHA256SUMS does not cover ${filename}`)
    }
  }
}

function verifyProvenance() {
  const provenance = JSON.parse(
    fs.readFileSync(path.join(verifierRoot, 'PROVENANCE.json'), 'utf8')
  )
  if (provenance.schema !== 'malt.web-verifier.provenance/v1') {
    throw new Error(`unexpected verifier provenance schema ${JSON.stringify(provenance.schema)}`)
  }
  if (!/^[0-9a-f]{40}$/.test(provenance.source_commit || '')) {
    throw new Error('verifier provenance does not contain an exact MALT commit')
  }
  if (!/^go\d+\.\d+(?:\.\d+)?/.test(provenance.go_version || '')) {
    throw new Error('verifier provenance does not contain a Go version')
  }
  if (!String(provenance.go_toolchain || '').includes(provenance.go_version)) {
    throw new Error('verifier provenance Go toolchain does not match go_version')
  }
  if (provenance.target !== 'js/wasm') {
    throw new Error(`unexpected verifier build target ${JSON.stringify(provenance.target)}`)
  }
  if (rootContentFixture.source_commit !== provenance.source_commit) {
    throw new Error(
      `root-content fixture source ${rootContentFixture.source_commit} does not match verifier source ${provenance.source_commit}`
    )
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
