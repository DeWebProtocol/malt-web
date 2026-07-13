export const localVerifierProfile = 'malt.artifact/v0alpha2'
export const defaultVerifierRuntimeURL = '/verifier/wasm_exec.js'
export const defaultVerifierWASMURL = '/verifier/malt-verifier.wasm'

const providerPromises = new Map()

/**
 * Verify a complete MALT artifact in the browser. The trusted root and expected
 * query are caller inputs, not values learned from the artifact.
 *
 * Loading failures and malformed provider responses fail closed. A gateway
 * response is never consulted by this function.
 */
export async function verifyArtifactLocally({
  artifact,
  expectedRoot,
  expectedQuery,
  expectedTarget = '',
  runtimeURL = defaultVerifierRuntimeURL,
  wasmURL = defaultVerifierWASMURL,
  signal,
  provider
}) {
  try {
    const request = createLocalVerifyRequest({
      artifact,
      expectedRoot,
      expectedQuery,
      expectedTarget
    })
    throwIfAborted(signal)
    const verify = provider ?? (await loadBrowserVerifier({ runtimeURL, wasmURL, signal }))
    throwIfAborted(signal)
    const raw = verify(JSON.stringify(request))
    const result = parseProviderResult(raw)
    return {
      ...result,
      source: 'local-wasm',
      trustedRoot: expectedRoot,
      query: expectedQuery
    }
  } catch (err) {
    return {
      profile: localVerifierProfile,
      valid: false,
      source: 'local-wasm',
      error: errorMessage(err)
    }
  }
}

export function createLocalVerifyRequest({ artifact, expectedRoot, expectedQuery, expectedTarget = '' }) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error('artifact is required for local verification')
  }
  if (artifact.profile !== localVerifierProfile) {
    throw new Error(`unsupported artifact profile ${JSON.stringify(artifact.profile)}`)
  }

  const trustedRoot = String(expectedRoot || '').trim()
  if (!trustedRoot) {
    throw new Error('trusted root is required and must be selected outside the artifact')
  }
  if (artifact.root !== trustedRoot) {
    throw new Error('artifact root does not match the client-selected trusted root')
  }
  if (!expectedQuery || typeof expectedQuery !== 'object') {
    throw new Error('expected query is required and must be selected outside the artifact')
  }
  if (!queriesEqual(artifact.query, expectedQuery)) {
    throw new Error('artifact query does not match the client-selected query')
  }

  const target = String(expectedTarget || '').trim()
  if (target && artifact.target !== target) {
    throw new Error('artifact target does not match the client-selected target')
  }

  return { profile: localVerifierProfile, artifact }
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
  return (requestJSON) => globalThis.maltVerifyArtifact(requestJSON)
}

async function loadGoRuntime(runtimeURL, signal) {
  if (typeof globalThis.Go === 'function') {
    return
  }
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
  if (typeof globalThis.Go === 'function') {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
    }
    const onLoad = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error(`failed to load local verifier runtime ${script.src}`))
    }
    const onAbort = () => {
      cleanup()
      reject(abortError())
    }
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function waitForProvider(signal) {
  const deadline = Date.now() + 30_000
  while (typeof globalThis.maltVerifyArtifact !== 'function') {
    throwIfAborted(signal)
    const initError = globalThis.maltVerifierInitError || globalThis.maltVerifierRuntimeError
    if (initError) {
      throw new Error(`local verifier initialization failed: ${initError}`)
    }
    if (Date.now() >= deadline) {
      throw new Error('local verifier initialization timed out')
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function parseProviderResult(raw) {
  if (typeof raw !== 'string') {
    throw new Error('local verifier returned a non-JSON result')
  }
  let result
  try {
    result = JSON.parse(raw)
  } catch (err) {
    throw new Error(`local verifier returned invalid JSON: ${errorMessage(err)}`)
  }
  if (!result || result.profile !== localVerifierProfile || typeof result.valid !== 'boolean') {
    throw new Error('local verifier returned an invalid result envelope')
  }
  return {
    profile: result.profile,
    valid: result.valid,
    ...(result.error ? { error: String(result.error) } : {})
  }
}

function queriesEqual(actual, expected) {
  if (!actual || !expected || actual.kind !== expected.kind) {
    return false
  }
  const fields = ['segments', 'index', 'start', 'end']
  return fields.every((field) => valuesEqual(actual[field], expected[field]))
}

function valuesEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    )
  }
  return left == null ? right == null : left === right
}

function absoluteURL(raw) {
  return new URL(raw, globalThis.location?.href || 'http://localhost/').toString()
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/["\\]/g, '\\$&')
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw abortError()
  }
}

function abortError() {
  return new DOMException('operation aborted', 'AbortError')
}

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err)
}
