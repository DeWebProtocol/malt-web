export const resolveVerifierProfile = 'malt.resolve/v0alpha1'
export const readVerifierProfile = 'malt.read/v0alpha1'
export const defaultVerifierRuntimeURL = '/verifier/wasm_exec.js'
export const defaultVerifierWASMURL = '/verifier/malt-verifier.wasm'

const providerPromises = new Map()

export async function verifyResolveLocally({
  request,
  result,
  runtimeURL = defaultVerifierRuntimeURL,
  wasmURL = defaultVerifierWASMURL,
  signal,
  provider
}) {
  return verifyLocally({
    kind: 'resolve',
    profile: resolveVerifierProfile,
    value: createResolveVerification({ request, result }),
    runtimeURL,
    wasmURL,
    signal,
    provider
  })
}

export async function verifyReadLocally({
  request,
  result,
  runtimeURL = defaultVerifierRuntimeURL,
  wasmURL = defaultVerifierWASMURL,
  signal,
  provider
}) {
  return verifyLocally({
    kind: 'read',
    profile: readVerifierProfile,
    value: createReadVerification({ request, result }),
    runtimeURL,
    wasmURL,
    signal,
    provider
  })
}

export async function verifyContentProofLocally({
  proofList,
  expectedRoot,
  expectedPath = '',
  runtimeURL = defaultVerifierRuntimeURL,
  wasmURL = defaultVerifierWASMURL,
  signal,
  provider
}) {
  try {
    throwIfAborted(signal)
    const verifier = provider ?? (await loadBrowserVerifier({ runtimeURL, wasmURL, signal }))
    const resolve = resolveVerificationFromProofList({
      proofList,
      root: expectedRoot,
      path: expectedPath,
      payload: 'auto'
    })
    const resolveResult = await verifyResolveLocally({
      ...resolve,
      signal,
      provider: verifier
    })
    if (!resolveResult.valid) {
      return resolveResult
    }

    const reads = readVerificationsFromProofList(proofList)
    assertReadChain(resolve, reads)
    const readResults = []
    for (const value of reads) {
      throwIfAborted(signal)
      const checked = await verifyReadLocally({ ...value, signal, provider: verifier })
      readResults.push(checked)
      if (!checked.valid) {
        return {
          ...checked,
          resolve: resolveResult,
          reads: readResults
        }
      }
    }
    return {
      ...resolveResult,
      resolve: resolveResult,
      reads: readResults
    }
  } catch (err) {
    return invalidResult(resolveVerifierProfile, err)
  }
}

export function createResolveVerification({ request, result }) {
  const normalizedRequest = normalizeResolveRequest(request)
  const normalizedResult = normalizeResult(result, resolveVerifierProfile, 'resolve')
  if (cidString(normalizedResult.prooflist.root) !== normalizedRequest.root) {
    throw new Error('resolve ProofList root does not match the client-selected trusted root')
  }
  if (normalizedResult.prooflist.query !== normalizedRequest.segments.join('/')) {
    throw new Error('resolve ProofList query does not match the client-selected segments')
  }
  return { request: normalizedRequest, result: normalizedResult }
}

export function createReadVerification({ request, result }) {
  const normalizedRequest = normalizeReadRequest(request)
  const normalizedResult = normalizeResult(result, readVerifierProfile, 'read')
  if (cidString(normalizedResult.prooflist.root) !== normalizedRequest.root) {
    throw new Error('read ProofList root does not match the client-selected trusted root')
  }
  return { request: normalizedRequest, result: normalizedResult }
}

export function resolveVerificationFromProofList({ proofList, root, path = '', payload = false }) {
  requireProofList(proofList)
  const trustedRoot = String(root || '').trim()
  if (!trustedRoot) {
    throw new Error('trusted root is required')
  }
  const segments = pathSegments(path)
  const includePayload =
    payload === true ||
    (payload === 'auto' && proofList.steps.some((step) => step?.kind === 'payload_binding'))
  if (includePayload) {
    segments.push('@payload')
  }
  const steps = []
  let sawPrimitiveRead = false
  for (const step of proofList.steps) {
    if (step?.kind === 'list_index' || step?.kind === 'list_range') {
      sawPrimitiveRead = true
      continue
    }
    if (sawPrimitiveRead) {
      throw new Error('resolve traversal evidence appears after primitive read evidence')
    }
    steps.push(step)
  }
  let target = trustedRoot
  if (steps.length > 0) {
    target = cidString(steps[steps.length - 1]?.target)
  }
  if (!target) {
    throw new Error('resolve ProofList target is required')
  }
  return {
    request: { profile: resolveVerifierProfile, root: trustedRoot, segments },
    result: {
      profile: resolveVerifierProfile,
      target,
      prooflist: {
        ...proofList,
        query: segments.join('/'),
        steps
      }
    }
  }
}

function assertReadChain(resolve, reads) {
  let expectedRoot = String(resolve?.result?.target || '').trim()
  for (const [index, read] of reads.entries()) {
    const actualRoot = String(read?.request?.root || '').trim()
    if (!expectedRoot || actualRoot !== expectedRoot) {
      throw new Error(
        `primitive read ${index} root ${JSON.stringify(actualRoot)} does not continue from authenticated target ${JSON.stringify(expectedRoot)}`
      )
    }
    expectedRoot = String(read?.result?.target || '').trim()
  }
}

export function readVerificationsFromProofList(proofList) {
  requireProofList(proofList)
  return proofList.steps.flatMap((step) => {
    if (step?.kind !== 'list_index' && step?.kind !== 'list_range') {
      return []
    }
    const root = cidString(step.from)
    const target = cidString(step.target)
    if (!root || !target) {
      throw new Error('primitive read evidence has no root or target CID')
    }
    let query
    let queryLabel
    let rangeSegments
    if (step.kind === 'list_index') {
      if (!Number.isSafeInteger(step.index) || step.index < 0) {
        throw new Error('list_index evidence has an invalid index')
      }
      query = { kind: 'list_index', index: step.index }
      queryLabel = `list:${step.index}`
    } else {
      if (!Number.isSafeInteger(step.start) || step.start < 0) {
        throw new Error('list_range evidence has an invalid start')
      }
      query = { kind: 'list_range', start: step.start }
      queryLabel = `range:${step.start}:`
      if (step.end != null) {
        query.end = step.end
        queryLabel = `range:${step.start}:${step.end}`
      }
      rangeSegments = (step.segments || []).map(cidString)
      if (rangeSegments.some((cid) => !cid)) {
        throw new Error('list_range evidence contains an invalid segment CID')
      }
    }
    return [
      {
        request: { profile: readVerifierProfile, root, query },
        result: {
          profile: readVerifierProfile,
          target,
          ...(rangeSegments ? { range_segments: rangeSegments } : {}),
          prooflist: {
            root: step.from,
            query: queryLabel,
            steps: [{ ...step, query: queryLabel }]
          }
        }
      }
    ]
  })
}

export async function loadBrowserVerifier({
  runtimeURL = defaultVerifierRuntimeURL,
  wasmURL = defaultVerifierWASMURL,
  signal
} = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('the local MALT verifier is only available in a browser')
  }
  const key = `${absoluteURL(runtimeURL)}\n${absoluteURL(wasmURL)}`
  if (!providerPromises.has(key)) {
    providerPromises.set(key, initializeBrowserVerifier({ runtimeURL, wasmURL, signal }))
  }
  try {
    return await providerPromises.get(key)
  } catch (err) {
    providerPromises.delete(key)
    throw err
  }
}

async function verifyLocally({ kind, profile, value, runtimeURL, wasmURL, signal, provider }) {
  try {
    throwIfAborted(signal)
    const verifier = provider ?? (await loadBrowserVerifier({ runtimeURL, wasmURL, signal }))
    const fn = typeof verifier === 'function' ? verifier : verifier?.[kind]
    if (typeof fn !== 'function') {
      throw new Error(`local verifier does not provide ${kind}`)
    }
    throwIfAborted(signal)
    const result = parseProviderResult(fn(JSON.stringify(value)), profile)
    return { ...result, source: 'local-wasm' }
  } catch (err) {
    return invalidResult(profile, err)
  }
}

async function initializeBrowserVerifier({ runtimeURL, wasmURL, signal }) {
  await loadGoRuntime(runtimeURL, signal)
  throwIfAborted(signal)
  if (typeof globalThis.Go !== 'function') {
    throw new Error('Go WebAssembly runtime did not register globalThis.Go')
  }
  const go = new globalThis.Go()
  const response = await fetch(wasmURL, { signal })
  if (!response.ok) {
    throw new Error(`local verifier WASM request failed (${response.status})`)
  }
  let instantiated
  try {
    instantiated = await WebAssembly.instantiateStreaming(response.clone(), go.importObject)
  } catch {
    instantiated = await WebAssembly.instantiate(await response.arrayBuffer(), go.importObject)
  }
  const runPromise = go.run(instantiated.instance)
  void runPromise.catch((err) => {
    globalThis.maltVerifierRuntimeError = errorMessage(err)
  })
  await waitForProvider(signal)
  return {
    resolve: (json) => globalThis.maltVerifyResolve(json),
    read: (json) => globalThis.maltVerifyRead(json),
    artifact: (json) => globalThis.maltVerifyArtifact(json)
  }
}

async function loadGoRuntime(runtimeURL, signal) {
  if (typeof globalThis.Go === 'function') return
  const source = absoluteURL(runtimeURL)
  const existing = document.querySelector(`script[data-malt-verifier-runtime="${cssEscape(source)}"]`)
  if (existing) {
    await waitForScript(existing, signal)
    return
  }
  const script = document.createElement('script')
  script.src = source
  script.async = true
  script.dataset.maltVerifierRuntime = source
  const loaded = waitForScript(script, signal)
  document.head.append(script)
  await loaded
}

function waitForScript(script, signal) {
  if (typeof globalThis.Go === 'function') return Promise.resolve()
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
    }
    const onLoad = () => { cleanup(); resolve() }
    const onError = () => { cleanup(); reject(new Error(`failed to load local verifier runtime ${script.src}`)) }
    const onAbort = () => { cleanup(); reject(abortError()) }
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function waitForProvider(signal) {
  const deadline = Date.now() + 30_000
  while (
    typeof globalThis.maltVerifyResolve !== 'function' ||
    typeof globalThis.maltVerifyRead !== 'function'
  ) {
    throwIfAborted(signal)
    const initError = globalThis.maltVerifierInitError || globalThis.maltVerifierRuntimeError
    if (initError) throw new Error(`local verifier initialization failed: ${initError}`)
    if (Date.now() >= deadline) throw new Error('local verifier initialization timed out')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function normalizeResolveRequest(request) {
  if (!request || request.profile !== resolveVerifierProfile) {
    throw new Error(`unsupported resolve profile ${JSON.stringify(request?.profile)}`)
  }
  const root = String(request.root || '').trim()
  if (!root) throw new Error('trusted resolve root is required')
  if (!Array.isArray(request.segments)) throw new Error('resolve segments array is required')
  const segments = request.segments.map((segment) => String(segment))
  if (segments.some((segment) => !segment || segment.includes('/'))) {
    throw new Error('resolve segments must be non-empty and cannot contain /')
  }
  return { profile: resolveVerifierProfile, root, segments }
}

function normalizeReadRequest(request) {
  if (!request || request.profile !== readVerifierProfile) {
    throw new Error(`unsupported read profile ${JSON.stringify(request?.profile)}`)
  }
  const root = String(request.root || '').trim()
  if (!root) throw new Error('trusted read root is required')
  if (!request.query || typeof request.query !== 'object') throw new Error('read query is required')
  return { profile: readVerifierProfile, root, query: structuredClone(request.query) }
}

function normalizeResult(result, profile, label) {
  if (!result || result.profile !== profile) {
    throw new Error(`unsupported ${label} result profile ${JSON.stringify(result?.profile)}`)
  }
  const target = String(result.target || '').trim()
  if (!target) throw new Error(`${label} target is required`)
  requireProofList(result.prooflist)
  return structuredClone(result)
}

function requireProofList(proofList) {
  if (!proofList || typeof proofList !== 'object' || !Array.isArray(proofList.steps)) {
    throw new Error('ProofList JSON must contain a steps array')
  }
}

function parseProviderResult(raw, expectedProfile) {
  if (typeof raw !== 'string') throw new Error('local verifier returned a non-JSON result')
  let result
  try {
    result = JSON.parse(raw)
  } catch (err) {
    throw new Error(`local verifier returned invalid JSON: ${errorMessage(err)}`)
  }
  if (!result || result.profile !== expectedProfile || typeof result.valid !== 'boolean') {
    throw new Error('local verifier returned an invalid result envelope')
  }
  return {
    profile: result.profile,
    valid: result.valid,
    ...(result.error ? { error: String(result.error) } : {})
  }
}

function pathSegments(rawPath = '') {
  return String(rawPath || '').split('/').filter(Boolean)
}

function cidString(value) {
  if (typeof value === 'string') return value
  return value && typeof value['/'] === 'string' ? value['/'] : ''
}

function invalidResult(profile, err) {
  return { profile, valid: false, source: 'local-wasm', error: errorMessage(err) }
}

function absoluteURL(raw) {
  return new URL(raw, globalThis.location?.href || 'http://localhost/').toString()
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/["\\]/g, '\\$&')
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError()
}

function abortError() {
  return new DOMException('operation aborted', 'AbortError')
}

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err)
}
