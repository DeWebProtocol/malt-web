export const artifactProfile = 'malt.artifact/v0alpha2'
export const defaultGatewayURL = 'http://127.0.0.1:8080'
// Compatibility alias for persisted profiles created before the gateway split.
export const defaultDaemonURL = defaultGatewayURL
export const defaultCASURL = 'http://127.0.0.1:4318'
export const appFallbackStorageKey = 'malt-app-fallback-path'

export function buildResolveURL(baseURL, root, rawPath = '') {
  void root
  void rawPath
  return buildGatewayURL(baseURL, ['v1', 'artifacts', 'resolve'])
}

export function buildProveURL(baseURL) {
  return buildGatewayURL(baseURL, ['v1', 'artifacts', 'prove'])
}

export function buildVerifyURL(baseURL) {
  return buildGatewayURL(baseURL, ['v1', 'artifacts', 'verify'])
}

export function buildContentURL(baseURL, root, rawPath = '') {
  return buildGatewayURL(baseURL, ['v1', 'roots', root, 'content', ...pathSegments(rawPath)])
}

export function buildUnixFSWriteURL(baseURL, root, rawPath) {
  const cleanPath = normalizeUploadPath(rawPath)
  if (String(root || '').trim()) {
    return buildContentURL(baseURL, root, cleanPath)
  }
  const url = buildGatewayURL(baseURL, ['v1', 'content', 'new'])
  url.searchParams.set('path', cleanPath)
  return url
}

export function buildAppStatePath(appBasePath, root, rawPath = '') {
  const base = normalizeAppBasePath(appBasePath)
  const cleanRoot = String(root || '').trim()
  if (!cleanRoot) {
    return base
  }
  const encoded = [cleanRoot, ...pathSegments(rawPath)].map((segment) =>
    encodeURIComponent(segment)
  )
  return `${base}/${encoded.join('/')}`
}

export function parseAppStatePath(appBasePath, pathname) {
  const base = normalizeAppBasePath(appBasePath)
  const cleanPathname = normalizeBrowserPath(pathname)
  if (cleanPathname !== base && !cleanPathname.startsWith(`${base}/`)) {
    return null
  }
  const suffix = cleanPathname.slice(base.length).replace(/^\/+/, '')
  if (!suffix) {
    return { root: '', path: '' }
  }
  const decoded = safeDecodeSegments(suffix)
  if (!decoded || decoded.length === 0) {
    return { root: '', path: '' }
  }
  return {
    root: decoded[0],
    path: decoded.slice(1).join('/')
  }
}

export function parseAppFallbackRoute(appBasePath, raw) {
  if (!raw) {
    return null
  }
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return parseAppStatePath(appBasePath, parsed.pathname)
  } catch {
    return null
  }
}

export function isAppStateRoute(appBasePath, pathname) {
  const routeState = parseAppStatePath(appBasePath, pathname)
  return Boolean(routeState?.root)
}

export function ancestorDirectoryPaths(rawPath = '') {
  const segments = pathSegments(rawPath)
  if (segments.length === 0) {
    return []
  }
  const ancestors = ['']
  let cursor = ''
  for (const segment of segments.slice(0, -1)) {
    cursor = joinMaltPath(cursor, segment)
    ancestors.push(cursor)
  }
  return ancestors
}

export function resolvePathQuery(rawPath = '') {
  return { kind: 'path', segments: pathSegments(rawPath) }
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

export function extractArtifactInput(input) {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input
  const candidate = parsed?.artifact && typeof parsed.artifact === 'object' ? parsed.artifact : parsed
  if (candidate?.profile === artifactProfile && candidate?.operation && candidate?.prooflist) {
    return candidate
  }
  const proofList = extractProofListInput(parsed)
  return resolveArtifactFromProofList({ proofList })
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

export function joinMaltPath(basePath = '', child = '') {
  const left = pathSegments(basePath)
  const right = pathSegments(child)
  return [...left, ...right].join('/')
}

export function pathParent(rawPath = '') {
  const segments = pathSegments(rawPath)
  segments.pop()
  return segments.join('/')
}

export function pathBasename(rawPath = '') {
  const segments = pathSegments(rawPath)
  return segments[segments.length - 1] || ''
}

export function profileStorageKey(name) {
  const clean = String(name || '').trim()
  if (!clean) {
    throw new Error('profile name is required')
  }
  return `malt-app-profile:${clean}`
}

export function activeProfileStorageKey() {
  return 'malt-app-active-profile'
}

export async function resolvePath({ baseURL, root, path, signal }) {
  const url = buildResolveURL(baseURL, root, path)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile: artifactProfile,
      root: String(root || '').trim(),
      segments: pathSegments(path)
    }),
    signal
  })
  const payload = await readJSONResponse(response)
  return {
    endpoint: url.toString(),
    status: response.status,
    response: payload,
    proofList: payload.prooflist ?? null,
    artifact: payload
  }
}

export async function proveQuery({ baseURL, root, query, signal }) {
  const url = buildProveURL(baseURL)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: artifactProfile, root: String(root || '').trim(), query }),
    signal
  })
  const payload = await readJSONResponse(response)
  return {
    endpoint: url.toString(),
    status: response.status,
    response: payload,
    artifact: payload,
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

export async function statPath({ baseURL, root, path, signal }) {
  const url = buildContentURL(baseURL, root, path)
  const response = await fetch(url, { method: 'HEAD', signal })
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return {
    endpoint: url.toString(),
    status: response.status,
    kind: response.headers.get('X-Malt-Kind') ?? '',
    storageKind: response.headers.get('X-Malt-Storage-Kind') ?? '',
    key: response.headers.get('X-Malt-Key') ?? '',
    payload: response.headers.get('X-Malt-Payload') ?? '',
    size: parseContentLength(response.headers.get('Content-Length'))
  }
}

export async function readContent({ baseURL, root, path, range, signal, omitProof = false }) {
  const url = buildContentURL(baseURL, root, path)
  const headers = new Headers()
  if (range?.trim()) {
    headers.set('Range', range.trim())
  }
  if (omitProof) {
    headers.set('X-Malt-Proof', 'omit')
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

export async function readContentBlob({ baseURL, root, path, range, signal }) {
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
    blob: await response.blob()
  }
}

export async function readDirectory({ baseURL, root, path, signal, omitProof = false }) {
  const payload = await readContent({ baseURL, root, path, signal, omitProof })
  let manifest
  try {
    manifest = JSON.parse(payload.body)
  } catch (err) {
    throw new Error(`directory manifest is not JSON: ${err.message}`)
  }
  if (!manifest || !Array.isArray(manifest.entries)) {
    throw new Error('directory manifest must contain an entries array')
  }
  return {
    ...payload,
    entries: manifest.entries.map((name) => String(name)).sort()
  }
}

export async function readDirectoryByPayload({ baseURL, payload, signal }) {
  const payloadCID = String(payload || '').trim()
  if (!payloadCID) {
    throw new Error('directory payload CID is required')
  }
  return readDirectory({ baseURL, root: payloadCID, path: '', signal, omitProof: true })
}

export async function diagnoseProofListRemotely({ baseURL, proofList, artifact, root, path, signal }) {
  const url = buildVerifyURL(baseURL)
  const candidate = artifact ?? resolveArtifactFromProofList({ proofList, root, path })
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: artifactProfile, artifact: candidate }),
    signal
  })
  const payload = await readJSONResponse(response)
  return {
    endpoint: url.toString(),
    status: response.status,
    valid: Boolean(payload.valid),
    source: 'gateway-diagnostic',
    response: payload
  }
}

// Compatibility alias. Remote verification is diagnostic only and must never
// be used as the client's trust decision.
export const verifyProofListRemotely = diagnoseProofListRemotely

export function resolveArtifactFromProofList({ proofList, root, path }) {
  if (!proofList || typeof proofList !== 'object' || !Array.isArray(proofList.steps)) {
    throw new Error('ProofList JSON must contain a steps array')
  }
  const proofRoot = cidString(proofList.root)
  const trustedRoot = String(root || proofRoot || '').trim()
  if (!trustedRoot) {
    throw new Error('artifact root is required')
  }
  const queryPath = path == null ? String(proofList.query || '') : String(path || '')
  const lastStep = proofList.steps[proofList.steps.length - 1]
  const target = lastStep ? cidString(lastStep.target) : trustedRoot
  if (!target) {
    throw new Error('ProofList target is required')
  }
  return {
    profile: artifactProfile,
    operation: 'resolve',
    root: trustedRoot,
    query: { kind: 'path', segments: pathSegments(queryPath) },
    target,
    prooflist: proofList
  }
}

function cidString(value) {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object' && typeof value['/'] === 'string') {
    return value['/']
  }
  return ''
}

function buildGatewayURL(baseURL, segments) {
  const url = new URL(normalizeBaseURL(baseURL))
  const prefix = url.pathname.replace(/\/+$/, '')
  const encoded = segments.map((segment) => encodeURIComponent(String(segment).trim()))
  url.pathname = [prefix, ...encoded].filter(Boolean).join('/')
  return url
}

function normalizeBaseURL(baseURL) {
  const trimmed = String(baseURL || '').trim()
  if (!trimmed) {
    throw new Error('gateway URL is required')
  }
  return trimmed
}

function normalizeAppBasePath(appBasePath) {
  const raw = String(appBasePath || '/app').trim() || '/app'
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  const clean = withLeadingSlash.replace(/\/+$/, '')
  return clean || '/'
}

function normalizeBrowserPath(pathname) {
  const raw = String(pathname || '/').trim() || '/'
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  const clean = withLeadingSlash.replace(/\/+$/, '')
  return clean || '/'
}

function safeDecodeSegments(rawPath) {
  try {
    return String(rawPath || '')
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
  } catch {
    return null
  }
}

function pathSegments(rawPath) {
  return String(rawPath || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function parseContentLength(raw) {
  if (!raw) {
    return null
  }
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
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
  return `gateway API error (${response.status}): ${message}`
}
