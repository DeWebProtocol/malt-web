export const resolveProfile = 'malt.resolve/v0alpha1'
export const readProfile = 'malt.read/v0alpha1'
export const defaultGatewayURL = 'http://127.0.0.1:8080'

export function buildResolveURL(baseURL) {
  return buildGatewayURL(baseURL, ['v1', 'resolve'])
}

export function buildReadURL(baseURL) {
  return buildGatewayURL(baseURL, ['v1', 'read'])
}

export function buildVerifyResolveURL(baseURL) {
  return buildGatewayURL(baseURL, ['v1', 'verify', 'resolve'])
}

export function buildVerifyReadURL(baseURL) {
  return buildGatewayURL(baseURL, ['v1', 'verify', 'read'])
}

export async function resolvePath({ baseURL, root, path, signal }) {
  const url = buildResolveURL(baseURL)
  const request = {
    profile: resolveProfile,
    root: requiredRoot(root),
    segments: pathSegments(path)
  }
  const response = await fetch(url, publicRequestOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal
  }))
  const payload = await readJSONResponse(response)
  return {
    endpoint: url.toString(),
    status: response.status,
    response: payload,
    request,
    result: payload,
    proofList: payload.prooflist ?? null
  }
}

export async function readQuery({ baseURL, root, query, signal }) {
  const url = buildReadURL(baseURL)
  const request = {
    profile: readProfile,
    root: requiredRoot(root),
    query
  }
  const response = await fetch(url, publicRequestOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal
  }))
  const payload = await readJSONResponse(response)
  return {
    endpoint: url.toString(),
    status: response.status,
    response: payload,
    request,
    result: payload,
    proofList: payload.prooflist ?? null
  }
}

export async function diagnoseResolveRemotely({ baseURL, request, result, signal }) {
  return diagnoseRemotely(buildVerifyResolveURL(baseURL), request, result, signal)
}

export async function diagnoseReadRemotely({ baseURL, request, result, signal }) {
  return diagnoseRemotely(buildVerifyReadURL(baseURL), request, result, signal)
}

async function diagnoseRemotely(url, request, result, signal) {
  const response = await fetch(url, publicRequestOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request, result }),
    signal
  }))
  const payload = await readJSONResponse(response)
  return {
    endpoint: url.toString(),
    status: response.status,
    valid: Boolean(payload.valid),
    source: 'gateway-diagnostic',
    response: payload
  }
}

function buildGatewayURL(baseURL, segments) {
  const selected = String(baseURL || '').trim()
  if (!selected) throw new Error('gateway URL is required')
  const url = new URL(selected)
  const prefix = url.pathname.replace(/\/+$/, '')
  url.pathname = [prefix, ...segments.map((segment) => encodeURIComponent(segment))]
    .filter(Boolean)
    .join('/')
  return url
}

function publicRequestOptions(options) {
  return {
    ...options,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store'
  }
}

function requiredRoot(value) {
  const root = String(value || '').trim()
  if (!root) throw new Error('root is required')
  return root
}

function pathSegments(value) {
  return String(value || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

async function readJSONResponse(response) {
  const text = await response.text()
  let payload = null
  if (text.trim()) {
    try {
      payload = JSON.parse(text)
    } catch (err) {
      throw new Error(`invalid JSON response: ${err.message}`)
    }
  }
  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      text.trim() ||
      response.statusText ||
      'request failed'
    throw new Error(`gateway API error (${response.status}): ${message}`)
  }
  return payload ?? {}
}
