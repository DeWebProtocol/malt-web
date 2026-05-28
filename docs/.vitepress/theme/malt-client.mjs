export const defaultDaemonURL = 'http://127.0.0.1:4317'

export function buildResolveURL(baseURL, root, rawPath = '') {
  return buildDaemonURL(baseURL, ['resolve', root, ...pathSegments(rawPath)])
}

export function buildContentURL(baseURL, root, rawPath = '') {
  return buildDaemonURL(baseURL, [root, ...pathSegments(rawPath)])
}

export function buildUnixFSWriteURL(baseURL, root, rawPath) {
  const cleanPath = normalizeUploadPath(rawPath)
  if (String(root || '').trim()) {
    return buildDaemonURL(baseURL, [root, ...pathSegments(cleanPath)])
  }
  const url = buildDaemonURL(baseURL, ['_unixfs'])
  url.searchParams.set('path', cleanPath)
  return url
}

export function decodeProofListHeader(raw) {
  if (!raw) {
    throw new Error('missing X-Malt-ProofList header')
  }
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  const text =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8')
  return JSON.parse(text)
}

export function extractProofListInput(input) {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('ProofList JSON must be an object')
  }
  const proofList = parsed.prooflist && typeof parsed.prooflist === 'object' ? parsed.prooflist : parsed
  if (!Array.isArray(proofList.steps)) {
    throw new Error('ProofList JSON must contain a steps array')
  }
  return proofList
}

export function normalizeUploadPath(rawPath) {
  const path = String(rawPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
  if (!path) {
    throw new Error('upload path is required')
  }
  return path
}

export function uploadPathForFile(file) {
  return normalizeUploadPath(file?.webkitRelativePath || file?.name || '')
}

export async function resolvePath({ baseURL, root, path, signal }) {
  const url = buildResolveURL(baseURL, root, path)
  const response = await fetch(url, { signal })
  const payload = await readJSONResponse(response)
  return {
    endpoint: url.toString(),
    status: response.status,
    response: payload,
    proofList: payload.prooflist ?? null
  }
}

export async function uploadUnixFSFile({ baseURL, root, path, file, signal }) {
  const url = buildUnixFSWriteURL(baseURL, root, path)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
    signal
  })
  const payload = await readJSONResponse(response)
  return {
    endpoint: url.toString(),
    status: response.status,
    path: payload.path ?? path,
    kind: payload.kind ?? 'file',
    oldRoot: payload.old_root ?? '',
    newRoot: payload.new_root ?? '',
    arcCount: payload.arc_count ?? 0,
    response: payload
  }
}

export async function readContent({ baseURL, root, path, range, signal }) {
  const url = buildContentURL(baseURL, root, path)
  const headers = new Headers()
  if (range?.trim()) {
    headers.set('Range', range.trim())
  }
  const response = await fetch(url, { headers, signal })
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  const proofHeader = response.headers.get('X-Malt-ProofList')
  return {
    endpoint: url.toString(),
    status: response.status,
    contentType: response.headers.get('Content-Type') ?? '',
    contentRange: response.headers.get('Content-Range') ?? '',
    proofList: proofHeader ? decodeProofListHeader(proofHeader) : null,
    body: await response.text()
  }
}

export async function verifyProofList({ baseURL, proofList, signal }) {
  const url = buildDaemonURL(baseURL, ['verify'])
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prooflist: proofList }),
    signal
  })
  const payload = await readJSONResponse(response)
  return {
    endpoint: url.toString(),
    status: response.status,
    valid: Boolean(payload.valid),
    response: payload
  }
}

function buildDaemonURL(baseURL, segments) {
  const url = new URL(normalizeBaseURL(baseURL))
  const prefix = url.pathname.replace(/\/+$/, '')
  const encoded = segments.map((segment) => encodeURIComponent(String(segment).trim()))
  url.pathname = [prefix, ...encoded].filter(Boolean).join('/')
  return url
}

function normalizeBaseURL(baseURL) {
  const trimmed = String(baseURL || '').trim()
  if (!trimmed) {
    throw new Error('daemon URL is required')
  }
  return trimmed
}

function pathSegments(rawPath) {
  return String(rawPath || '')
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
    throw new Error(apiErrorMessage(response, payload, text))
  }
  return payload ?? {}
}

async function responseErrorMessage(response) {
  const text = await response.text()
  try {
    return apiErrorMessage(response, JSON.parse(text), text)
  } catch {
    return apiErrorMessage(response, null, text)
  }
}

function apiErrorMessage(response, payload, text) {
  const message = payload?.error || text?.trim() || response.statusText || 'request failed'
  return `daemon API error (${response.status}): ${message}`
}
