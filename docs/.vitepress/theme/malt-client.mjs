import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'

export const resolveProfile = 'malt.resolve/v0alpha1'
export const readProfile = 'malt.read/v0alpha1'
export const defaultGatewayURL = 'http://127.0.0.1:8080'
// Compatibility alias for persisted profiles created before the gateway split.
export const defaultDaemonURL = defaultGatewayURL
export const defaultCASURL = defaultGatewayURL
export const appFallbackStorageKey = 'malt-app-fallback-path'

export function buildResolveURL(baseURL, root, rawPath = '', bucketID = '') {
	void root
	void rawPath
	return buildNativeGatewayURL(baseURL, bucketID, ['resolve'])
}

export function buildReadURL(baseURL, bucketID = '') {
	return buildNativeGatewayURL(baseURL, bucketID, ['read'])
}

export function buildVerifyResolveURL(baseURL) {
  return buildGatewayURL(baseURL, ['v1', 'verify', 'resolve'])
}

export function buildVerifyReadURL(baseURL) {
  return buildGatewayURL(baseURL, ['v1', 'verify', 'read'])
}

export function buildCASURL(baseURL, cid = '', bucketID = '') {
	return buildNativeGatewayURL(baseURL, bucketID, ['cas', ...(cid ? [cid] : [])])
}

export function buildBucketURL(baseURL, bucketID, suffix = []) {
	const selected = String(bucketID || '').trim()
	if (!selected) throw new Error('Bucket ID is required')
	return buildGatewayURL(baseURL, ['v1', 'buckets', selected, ...suffix])
}

export async function fetchBuckets({ baseURL, apiKey, signal }) {
	const url = buildGatewayURL(baseURL, ['v1', 'buckets'])
	const response = await fetch(url, gatewayRequestOptions(url, apiKey, { signal }))
	const payload = await readJSONResponse(response)
	if (!Array.isArray(payload.buckets)) throw new Error('gateway did not return a Bucket list')
	return payload.buckets
}

export async function fetchBucketHead({ baseURL, bucketID, apiKey, signal }) {
	const url = buildBucketURL(baseURL, bucketID, ['head'])
	const response = await fetch(url, gatewayRequestOptions(url, apiKey, { signal }))
	const head = await readJSONResponse(response)
	if (head.bucket_id !== String(bucketID || '').trim() || head.name !== 'main') {
		throw new Error('gateway returned a head for a different Bucket or ref')
	}
	if (head.commit_id) {
		parseCID(head.root)
		if (!Number.isSafeInteger(head.revision) || head.revision < 1) {
			throw new Error('gateway returned an invalid Bucket head revision')
		}
	} else if (head.root || head.revision !== 0) {
		throw new Error('gateway returned an invalid empty Bucket head')
	}
	return head
}

export async function pushBucketRoot({
	baseURL,
	bucketID,
	apiKey,
	pushID,
	baseCommit,
	baseRoot,
	baseRevision,
	candidateRoot,
	message,
	signal
}) {
	parseCID(candidateRoot)
	if (baseRoot) parseCID(baseRoot)
	const url = buildBucketURL(baseURL, bucketID, ['push'])
	const response = await fetch(url, gatewayRequestOptions(url, apiKey, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			push_id: String(pushID || '').trim(),
			base_commit: String(baseCommit || '').trim(),
			base_root: String(baseRoot || '').trim(),
			candidate_root: String(candidateRoot || '').trim(),
			expected_head_revision: Number(baseRevision || 0),
			message: String(message || '').trim()
		}),
		signal
	}))
	const text = await response.text()
	let payload
	try {
		payload = JSON.parse(text)
	} catch (err) {
		throw new Error(`invalid JSON response: ${err.message}`)
	}
	if (response.status !== 201 && response.status !== 409) {
		throw new Error(apiErrorMessage(response, payload, text))
	}
	if (!['fast_forward', 'merged', 'branched'].includes(payload.status)) {
		throw new Error('gateway returned an unsupported Bucket push status')
	}
	if (!payload.head || payload.head.bucket_id !== String(bucketID || '').trim()) {
		throw new Error('gateway returned an invalid Bucket push head')
	}
	if (payload.head.root) parseCID(payload.head.root)
	if ((payload.status === 'branched') !== Boolean(payload.branch)) {
		throw new Error('gateway returned an inconsistent Bucket conflict result')
	}
	return payload
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

export function extractVerificationInput(input) {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input
  const candidate =
    parsed?.verification && typeof parsed.verification === 'object'
      ? parsed.verification
      : parsed
  if (candidate?.request && candidate?.result) {
    return candidate
  }
  throw new Error('verification JSON must contain request and result')
}

export function normalizeUploadPath(rawPath) {
  const path = String(rawPath || '').replace(/\\/g, '/')
  if (!path || path.startsWith('/') || path.endsWith('/')) {
    throw new Error('upload path is required')
  }
  const segments = path.split('/')
  for (const segment of segments) {
    if (
      !segment ||
      segment === '.' ||
      segment === '..' ||
      segment.startsWith('@') ||
      segment.includes('\0')
    ) {
      throw new Error(`unsupported UnixFS path segment ${JSON.stringify(segment)}`)
    }
  }
  return segments.join('/')
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

export async function resolvePath({ baseURL, root, path, bucketID, apiKey, signal }) {
	const url = buildResolveURL(baseURL, root, path, bucketID)
  const request = {
    profile: resolveProfile,
    root: String(root || '').trim(),
    segments: pathSegments(path)
  }
  const response = await fetch(url, gatewayRequestOptions(url, apiKey, {
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

export async function readQuery({ baseURL, root, query, bucketID, apiKey, signal }) {
	const url = buildReadURL(baseURL, bucketID)
  const request = { profile: readProfile, root: String(root || '').trim(), query }
  const response = await fetch(url, gatewayRequestOptions(url, apiKey, {
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

export async function uploadUnixFSFile({
  baseURL,
  root,
  path,
	file,
	bucketID,
	apiKey,
  signal,
  verifyExistingContent,
  verifyExistingResolve
}) {
  const cleanPath = normalizeUploadPath(path)
  const oldRoot = String(root || '').trim()
  const tree = oldRoot
    ? await loadUnixFSTree({
		baseURL,
		bucketID,
		apiKey,
        root: oldRoot,
        signal,
        verifyExistingContent,
        verifyExistingResolve
      })
    : directoryNode()
  const bytes = new Uint8Array(await file.arrayBuffer())
	const fileCID = await putPayloadBlock({ baseURL, bucketID, apiKey, bytes, signal })
  setTreeFile(tree, pathSegments(cleanPath), fileCID)
	const materialized = await materializeUnixFSTree({ baseURL, bucketID, apiKey, node: tree, signal })
  return {
		endpoint: buildNativeGatewayURL(baseURL, bucketID, ['roots']).toString(),
    status: 201,
    path: cleanPath,
    kind: 'file',
    oldRoot,
    newRoot: materialized.cid,
    arcCount: materialized.arcCount,
    response: { old_root: oldRoot, new_root: materialized.cid }
  }
}

export async function statPath({ baseURL, root, path, bucketID, apiKey, signal }) {
	const resolved = await resolvePath({ baseURL, root, path, bucketID, apiKey, signal })
  const codec = parseCID(resolved.result.target).code
  const kind = isMapCodec(codec) ? 'dir' : 'file'
  let payload = ''
  if (kind === 'dir') {
    const payloadResult = await resolvePath({
		baseURL,
		bucketID,
		apiKey,
      root,
      path: joinMaltPath(path, '@payload'),
      signal
    })
    payload = payloadResult.result.target
  }
  return {
    endpoint: resolved.endpoint,
    status: resolved.status,
    request: resolved.request,
    result: resolved.result,
    proofList: resolved.proofList,
    kind,
    storageKind: storageKind(codec),
    key: resolved.result.target,
    payload,
    size: null
  }
}

export async function readContent({ baseURL, root, path, range, bucketID, apiKey, signal, omitProof = false }) {
  void omitProof
	const resolved = await resolvePath({ baseURL, root, path, bucketID, apiKey, signal })
  const target = resolved.result.target
  const codec = parseCID(target).code
  let proofList = resolved.proofList
  let bytes
  let contentType = 'application/octet-stream'
  let contentRange = ''
  let rangeHandled = false
  if (isMapCodec(codec)) {
    const payloadResolve = await resolvePath({
		baseURL,
		bucketID,
		apiKey,
      root,
      path: joinMaltPath(path, '@payload'),
      signal
    })
    proofList = payloadResolve.proofList
		bytes = await readPayloadBlock({ baseURL, bucketID, apiKey, cid: payloadResolve.result.target, signal })
    contentType = 'application/json'
  } else if (isListCodec(codec)) {
    const requested = parseRequestedRange(range)
    const query = { kind: 'list_range', start: requested?.start ?? 0 }
    if (requested?.end != null) query.end = requested.end
    const read = await readQuery({
		baseURL,
		bucketID,
		apiKey,
      root: target,
      query,
      signal
    })
    proofList = combineProofLists(resolved.proofList, read.proofList, pathSegments(path).join('/'))
    const chunks = await Promise.all(
		(read.result.range_segments || []).map((cid) => readPayloadBlock({ baseURL, bucketID, apiKey, cid, signal }))
    )
    const step = [...(read.proofList?.steps || [])]
      .reverse()
      .find((item) => item?.kind === 'list_range')
    if (!step) throw new Error('list read did not return list_range evidence')
    const assembled = concatBytes(chunks)
    const start = Number(step.start)
    const end = Number(step.end)
    const total = Number(step.total_size)
    const chunkSize = Number(step.chunk_size)
    const offset = start % chunkSize
    bytes = assembled.subarray(offset, offset + (end - start))
    if (start !== 0 || end !== total) contentRange = `bytes ${start}-${end - 1}/${total}`
    rangeHandled = true
  } else {
		bytes = await readPayloadBlock({ baseURL, bucketID, apiKey, cid: target, signal })
  }
  const selected = rangeHandled
    ? { bytes, contentRange, partial: Boolean(contentRange) }
    : applyByteRange(bytes, range)
  bytes = selected.bytes
  contentRange = selected.contentRange
  return {
    endpoint: resolved.endpoint,
    status: selected.partial ? 206 : 200,
    contentType,
    contentRange,
    proofList,
    bytes,
    body: new TextDecoder().decode(bytes)
  }
}

export async function readContentBlob({ baseURL, root, path, range, bucketID, apiKey, signal }) {
	const payload = await readContent({ baseURL, root, path, range, bucketID, apiKey, signal })
  return {
    ...payload,
    blob: new Blob([payload.bytes], { type: payload.contentType })
  }
}

// Fetch one immutable payload block through the same gateway. Callers must
// still hash the returned bytes against the requested CID; this endpoint is an
// availability path, not a trust decision.
export async function readPayloadBlock({ baseURL, cid, bucketID, apiKey, signal }) {
  const blockCID = String(cid || '').trim()
  if (!blockCID) {
    throw new Error('payload block CID is required')
  }
	const url = buildCASURL(baseURL, blockCID, bucketID)
	const response = await fetch(url, gatewayRequestOptions(url, apiKey, { signal }))
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  await assertBlockMatchesCID(blockCID, bytes)
  return bytes
}

export async function readDirectory({ baseURL, root, path, bucketID, apiKey, signal, omitProof = false }) {
	const payload = await readContent({ baseURL, root, path, bucketID, apiKey, signal, omitProof })
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

export async function readDirectoryByPayload({ baseURL, payload, bucketID, apiKey, signal }) {
  const payloadCID = String(payload || '').trim()
  if (!payloadCID) {
    throw new Error('directory payload CID is required')
  }
	const bytes = await readPayloadBlock({ baseURL, bucketID, apiKey, cid: payloadCID, signal })
  const body = new TextDecoder().decode(bytes)
  const manifest = JSON.parse(body)
  return { bytes, body, proofList: null, entries: (manifest.entries || []).map(String).sort() }
}

export async function diagnoseResolveRemotely({ baseURL, request, result, signal }) {
  const url = buildVerifyResolveURL(baseURL)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request, result }),
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

export async function diagnoseReadRemotely({ baseURL, request, result, signal }) {
  const url = buildVerifyReadURL(baseURL)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request, result }),
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

async function putPayloadBlock({ baseURL, bytes, codec = 0x55, bucketID, apiKey, signal }) {
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
	const url = buildCASURL(baseURL, '', bucketID)
  url.searchParams.set('codec', String(codec))
  const response = await fetch(url, gatewayRequestOptions(url, apiKey, {
    method: 'POST',
		headers: { 'Content-Type': 'application/octet-stream' },
    body,
    signal
  }))
  const payload = await readJSONResponse(response)
  const digest = await sha256.digest(body)
  const expected = CID.createV1(codec, digest).toString()
  if (String(payload.cid || '') !== expected) {
    throw new Error(`gateway returned CAS CID ${JSON.stringify(payload.cid)}, expected ${expected}`)
  }
  return expected
}

async function createStructure({ baseURL, arcs, bucketID, apiKey, signal }) {
	const url = buildNativeGatewayURL(baseURL, bucketID, ['roots'])
  const response = await fetch(url, gatewayRequestOptions(url, apiKey, {
    method: 'POST',
		headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ arcs }),
    signal
  }))
  const payload = await readJSONResponse(response)
  if (!payload.root) throw new Error('gateway did not return a structure root')
  const root = String(payload.root)
  if (!isMapCodec(parseCID(root).code)) {
    throw new Error('gateway did not return a MALT map root')
  }
  return root
}

function directoryNode() {
  return { kind: 'dir', children: new Map() }
}

async function loadUnixFSTree(options) {
  return loadUnixFSDirectory({ ...options, path: '' })
}

async function loadUnixFSDirectory({
	baseURL,
	bucketID,
	apiKey,
  root,
  path,
  signal,
  verifyExistingContent,
  verifyExistingResolve
}) {
  if (typeof verifyExistingContent !== 'function' || typeof verifyExistingResolve !== 'function') {
    throw new Error('verified existing-root callbacks are required for UnixFS updates')
  }
	const manifest = await readDirectory({ baseURL, root, path, bucketID, apiKey, signal })
  await verifyExistingContent(path, manifest, signal)
  const node = directoryNode()
  for (const name of manifest.entries) {
    const childPath = joinMaltPath(path, name)
		const stat = await statPath({ baseURL, root, path: childPath, bucketID, apiKey, signal })
    await verifyExistingResolve(childPath, stat, signal)
    if (stat.kind === 'dir') {
      node.children.set(
        name,
        await loadUnixFSDirectory({
			baseURL,
			bucketID,
			apiKey,
          root,
          path: childPath,
          signal,
          verifyExistingContent,
          verifyExistingResolve
        })
      )
    } else {
      node.children.set(name, { kind: 'file', cid: stat.key })
    }
  }
  return node
}

function setTreeFile(root, segments, cid) {
  if (!segments.length) throw new Error('upload path is required')
  let current = root
  for (const segment of segments.slice(0, -1)) {
    let child = current.children.get(segment)
    if (!child || child.kind !== 'dir') {
      child = directoryNode()
      current.children.set(segment, child)
    }
    current = child
  }
  current.children.set(segments[segments.length - 1], { kind: 'file', cid })
}

async function materializeUnixFSTree({ baseURL, node, bucketID, apiKey, signal }) {
	const names = [...node.children.keys()].sort()
	const arcs = {}
	const descendants = new Map()
	let arcCount = 1
	for (const name of names) {
		const child = node.children.get(name)
		let childCID
		if (child.kind === 'dir') {
			const materialized = await materializeUnixFSTree({ baseURL, bucketID, apiKey, node: child, signal })
			childCID = materialized.cid
			arcCount += materialized.arcCount
			for (const [relative, target] of materialized.descendants) {
				descendants.set(`${name}/${relative}`, target)
			}
		} else {
			childCID = child.cid
		}
		arcs[name] = childCID
		descendants.set(name, childCID)
	}
	const manifestBytes = new TextEncoder().encode(JSON.stringify({ entries: names }))
	arcs['@payload'] = await putPayloadBlock({ baseURL, bucketID, apiKey, bytes: manifestBytes, signal })
	for (const [relative, target] of descendants) {
		if (relative.includes('/')) arcs[relative] = target
	}
	const cid = await createStructure({ baseURL, bucketID, apiKey, arcs, signal })
	return { cid, descendants, arcCount: arcCount + Object.keys(arcs).length }
}

function combineProofLists(resolveProof, readProof, query) {
  if (!resolveProof || !readProof) throw new Error('resolve and read ProofLists are required')
  return {
    root: resolveProof.root,
    query,
    steps: [...(resolveProof.steps || []), ...(readProof.steps || [])]
  }
}

function parseCID(value) {
  try {
    return CID.parse(String(value || '').trim())
  } catch (err) {
    throw new Error(`invalid CID ${JSON.stringify(value)}: ${err.message}`)
  }
}

async function assertBlockMatchesCID(value, bytes) {
  const expected = parseCID(value)
  const actual = CID.createV1(expected.code, await sha256.digest(bytes))
  if (!actual.equals(expected)) {
    throw new Error(`gateway CAS bytes do not match requested CID ${expected}`)
  }
}

function isMapCodec(codec) {
	return codec === 0x300001 || codec === 0x300003
}

function isListCodec(codec) {
	return codec === 0x300002 || codec === 0x300004
}

function storageKind(codec) {
	if (isMapCodec(codec)) return 'map'
	if (isListCodec(codec)) return 'list'
	return 'raw'
}

function concatBytes(chunks) {
	const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
	const out = new Uint8Array(length)
	let offset = 0
	for (const chunk of chunks) {
		out.set(chunk, offset)
		offset += chunk.byteLength
	}
	return out
}

function parseRequestedRange(raw) {
	const value = String(raw || '').trim()
	if (!value) return null
	const match = /^bytes=(\d+)-(\d+)$/.exec(value)
	if (!match) throw new Error('range must use bytes=start-end')
	const start = Number(match[1])
	const endInclusive = Number(match[2])
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(endInclusive) || endInclusive < start) {
		throw new Error('invalid byte range')
	}
	return { start, end: endInclusive + 1 }
}

function applyByteRange(bytes, raw) {
	const requested = parseRequestedRange(raw)
	if (!requested) return { bytes, contentRange: '', partial: false }
	if (requested.end > bytes.byteLength) throw new Error('byte range exceeds payload length')
	return {
		bytes: bytes.subarray(requested.start, requested.end),
		contentRange: `bytes ${requested.start}-${requested.end - 1}/${bytes.byteLength}`,
		partial: true
	}
}

function buildGatewayURL(baseURL, segments) {
  const url = new URL(normalizeBaseURL(baseURL))
  const prefix = url.pathname.replace(/\/+$/, '')
  const encoded = segments.map((segment) => encodeURIComponent(String(segment).trim()))
  url.pathname = [prefix, ...encoded].filter(Boolean).join('/')
  return url
}

function buildNativeGatewayURL(baseURL, bucketID, suffix) {
	const selected = String(bucketID || '').trim()
	return selected
		? buildBucketURL(baseURL, selected, suffix)
		: buildGatewayURL(baseURL, ['v1', ...suffix])
}

function gatewayHeaders(apiKey, values = {}) {
	const headers = { ...values }
	const token = String(apiKey || '').trim()
	if (token) headers.Authorization = `Bearer ${token}`
	return headers
}

function gatewayRequestOptions(url, apiKey, options = {}) {
	const token = String(apiKey || '').trim()
	const { headers = {}, ...rest } = options
	if (token) assertSecureCredentialURL(url)
	return {
		...rest,
		headers: gatewayHeaders(token, headers),
		...(token ? { redirect: 'error' } : {})
	}
}

function assertSecureCredentialURL(value) {
	const url = value instanceof URL ? value : new URL(String(value))
	const hostname = url.hostname.toLowerCase()
	const loopback =
		hostname === 'localhost' ||
		hostname === '::1' ||
		hostname === '[::1]' ||
		/^127(?:\.\d{1,3}){3}$/.test(hostname)
	if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
		throw new Error('Gateway API keys require HTTPS or a loopback HTTP Gateway')
	}
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
	const message = payload?.message || payload?.error || text?.trim() || response.statusText || 'request failed'
  return `gateway API error (${response.status}): ${message}`
}
