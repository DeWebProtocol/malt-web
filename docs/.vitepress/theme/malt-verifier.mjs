export const authenticationProfile = 'malt.authentication/1'
export const defaultVerifierRuntimeURL = '/verifier/wasm_exec.js'
export const defaultVerifierWASMURL = '/verifier/malt-verifier.wasm'
let providerPromise
let selectedAssets

export async function verifyAuthenticationLocally({ request, result, provider,
  runtimeURL = defaultVerifierRuntimeURL, wasmURL = defaultVerifierWASMURL, signal }) {
  try {
    throwIfAborted(signal)
    if (request?.profile !== authenticationProfile || result?.profile !== authenticationProfile ||
        typeof request.root !== 'string' || !request.root || !Array.isArray(request.steps)) {
      throw new Error('current authentication request, explicit root and steps are required')
    }
    const value = JSON.stringify({ request, result })
    const verifier = provider ?? await loadBrowserVerifier({ runtimeURL, wasmURL, signal })
    if (typeof verifier.authentication !== 'function') throw new Error('current authentication WASM export is required')
    throwIfAborted(signal)
    return { ...parseProviderResult(verifier.authentication(value), authenticationProfile), source: 'local-wasm' }
  } catch (error) { return invalidResult(authenticationProfile, error) }
}

export async function loadBrowserVerifier({ runtimeURL = defaultVerifierRuntimeURL,
  wasmURL = defaultVerifierWASMURL, signal } = {}) {
  if (typeof document === 'undefined') throw new Error('the local verifier requires a browser')
  const assets = `${absoluteURL(runtimeURL)}\n${absoluteURL(wasmURL)}`
  if (selectedAssets && selectedAssets !== assets) throw new Error('reload the page before changing verifier assets')
  selectedAssets = assets
  // A failed Go runtime cannot be reused safely in this page. Reload to retry.
  providerPromise ??= initializeBrowserVerifier({ runtimeURL, wasmURL, signal })
  return providerPromise
}

async function initializeBrowserVerifier({ runtimeURL, wasmURL, signal }) {
  await loadGoRuntime(runtimeURL, signal)
  throwIfAborted(signal)
  const go = new globalThis.Go()
  globalThis.maltVerifierBackend = 'all'
  globalThis.maltVerifierReady = false
  globalThis.maltVerifyAuthentication = undefined
  globalThis.maltVerifierInitError = undefined
  const response = await fetch(wasmURL, { signal, credentials: 'omit', redirect: 'error' })
  if (!response.ok) throw new Error(`local verifier WASM request failed (${response.status})`)
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), go.importObject)
  let runtimeError
  void go.run(instance).then(() => { runtimeError = new Error('local verifier exited') }, error => { runtimeError = error })
  const deadline = Date.now() + 120000
  while (!globalThis.maltVerifierReady) {
    throwIfAborted(signal)
    if (runtimeError) throw runtimeError
    if (globalThis.maltVerifierInitError) throw new Error(globalThis.maltVerifierInitError)
    if (Date.now() >= deadline) throw new Error('local verifier initialization timed out')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  if (runtimeError) throw runtimeError
  if (globalThis.maltVerifierInitError) throw new Error(globalThis.maltVerifierInitError)
  if (globalThis.maltVerifierLoadedBackend !== 'all' || typeof globalThis.maltVerifyAuthentication !== 'function') {
    throw new Error('current authentication WASM export and both backends are required')
  }
  const verify = globalThis.maltVerifyAuthentication
  return { authentication(json) { if (runtimeError) throw runtimeError; return verify(json) } }
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
