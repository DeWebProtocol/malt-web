const fs = require('node:fs')
const path = require('node:path')
const { createHash, webcrypto } = require('node:crypto')
const { TextDecoder, TextEncoder } = require('node:util')

const repositoryRoot = path.resolve(__dirname, '..')
const verifierRoot = process.env.MALT_VERIFIER_ROOT
  ? path.resolve(process.env.MALT_VERIFIER_ROOT)
  : path.join(repositoryRoot, 'docs', 'public', 'verifier')
const currentResolveFixture = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'scripts', 'fixtures', 'resolve-kzg-payload.json'), 'utf8')
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
  request: {
    profile: 'malt.resolve/v0alpha1',
    root,
    segments: []
  },
  result: {
    profile: 'malt.resolve/v0alpha1',
    target: root,
    prooflist: { root: { '/': root }, query: '', steps: [] }
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

  const accepted = JSON.parse(globalThis.maltVerifyResolve(JSON.stringify(request)))
  if (accepted.profile !== request.request.profile || accepted.valid !== true) {
    throw new Error(`identity resolve was not accepted: ${JSON.stringify(accepted)}`)
  }

  const currentResolveAccepted = JSON.parse(
    globalThis.maltVerifyResolve(JSON.stringify(currentResolveFixture.verification))
  )
  if (currentResolveAccepted.profile !== request.request.profile || currentResolveAccepted.valid !== true) {
    throw new Error(
      `current KZG payload resolve was not accepted: ${JSON.stringify(currentResolveAccepted)}`
    )
  }

  const missingSegments = structuredClone(request)
  delete missingSegments.request.segments
  const missingRejected = JSON.parse(globalThis.maltVerifyResolve(JSON.stringify(missingSegments)))
  if (missingRejected.valid !== false) {
    throw new Error('resolve request without segments was accepted')
  }

  const nullSegments = structuredClone(request)
  nullSegments.request.segments = null
  const nullRejected = JSON.parse(globalThis.maltVerifyResolve(JSON.stringify(nullSegments)))
  if (nullRejected.valid !== false) {
    throw new Error('resolve request with null segments was accepted')
  }

  const tampered = structuredClone(request)
  tampered.result.target = 'bafkreib6qhwx2g5wgdgczgczumrq6rupl7u36po34ohfhn7rmvtpt7a3om'
  const rejected = JSON.parse(globalThis.maltVerifyResolve(JSON.stringify(tampered)))
  if (rejected.valid !== false) {
    throw new Error('tampered resolve result was accepted')
  }

  const wrongRoot = structuredClone(request)
  wrongRoot.request.root = 'bafkreib6qhwx2g5wgdgczgczumrq6rupl7u36po34ohfhn7rmvtpt7a3om'
  const rootRejected = JSON.parse(globalThis.maltVerifyResolve(JSON.stringify(wrongRoot)))
  if (rootRejected.valid !== false || !rootRejected.error?.includes('does not match trusted root')) {
    throw new Error(`trusted-root mismatch was not rejected: ${JSON.stringify(rootRejected)}`)
  }

  const wrongQuery = structuredClone(request)
  wrongQuery.request.segments = ['docs']
  const queryRejected = JSON.parse(globalThis.maltVerifyResolve(JSON.stringify(wrongQuery)))
  if (queryRejected.valid !== false || !queryRejected.error?.includes('does not match segment path')) {
    throw new Error(`client-query mismatch was not rejected: ${JSON.stringify(queryRejected)}`)
  }

  if (typeof globalThis.maltVerifyRead !== 'function' || typeof globalThis.maltVerifyArtifact !== 'function') {
    throw new Error('WASM did not register read and legacy artifact verifier functions')
  }
  console.log('Local WASM verifier contract passed.')
}

function verifyChecksums() {
  const requiredArtifacts = new Set([
    'malt-verifier.wasm',
    'wasm_exec.js',
    'PROVENANCE.json'
  ])
  const sums = fs
    .readFileSync(path.join(verifierRoot, 'SHA256SUMS'), 'utf8')
    .trimEnd()
    .split('\n')
  const checked = new Set()
  for (const line of sums) {
    const match = /^([0-9a-f]{64}) ([ *])([^/\r\n]+)$/.exec(line)
    const filename = match?.[3]
    if (!filename || !requiredArtifacts.has(filename)) {
      throw new Error(`unexpected verifier checksum entry ${JSON.stringify(line)}`)
    }
    const expected = match[1]
    if (checked.has(filename)) {
      throw new Error(`duplicate verifier checksum entry ${JSON.stringify(filename)}`)
    }
    const actual = createHash('sha256')
      .update(fs.readFileSync(path.join(verifierRoot, filename)))
      .digest('hex')
    if (actual !== expected) {
      throw new Error(`checksum mismatch for ${filename}: got ${actual}, want ${expected}`)
    }
    checked.add(filename)
  }
  for (const filename of requiredArtifacts) {
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
  if (provenance.source_repository !== 'https://github.com/DeWebProtocol/malt.git') {
    throw new Error(
      `unexpected verifier source repository ${JSON.stringify(provenance.source_repository)}`
    )
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
  const expectedFlags = ['-mod=readonly', '-buildvcs=false', '-trimpath']
  if (JSON.stringify(provenance.build_flags) !== JSON.stringify(expectedFlags)) {
    throw new Error(`unexpected verifier build flags ${JSON.stringify(provenance.build_flags)}`)
  }
  const expectedEnvironment = {
    GOENV: 'off',
    GOWORK: 'off',
    GOFLAGS: '',
    GOTOOLCHAIN: 'local'
  }
  if (
    JSON.stringify(provenance.build_environment) !==
    JSON.stringify(expectedEnvironment)
  ) {
    throw new Error(
      `unexpected verifier build environment ${JSON.stringify(provenance.build_environment)}`
    )
  }
  if (currentResolveFixture.verified_commit !== provenance.source_commit) {
    throw new Error(
      `current resolve fixture verification ${currentResolveFixture.verified_commit} does not match verifier source ${provenance.source_commit}`
    )
  }
}

async function waitForProvider() {
  const deadline = Date.now() + 30_000
  while (
    typeof globalThis.maltVerifyResolve !== 'function' ||
    typeof globalThis.maltVerifyRead !== 'function'
  ) {
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
