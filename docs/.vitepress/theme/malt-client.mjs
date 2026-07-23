import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'

export const resolveProfile = 'malt.resolve/v0alpha1'
export const readProfile = 'malt.read/v0alpha1'
export const defaultGatewayURL = 'http://127.0.0.1:8080'
// Compatibility alias for persisted profiles created before the gateway split.
export const defaultDaemonURL = defaultGatewayURL
export const defaultCASURL = defaultGatewayURL
export const appFallbackStorageKey = 'malt-app-fallback-path'

export function initialAccountAccessView(configuredGatewayURL) {
  return String(configuredGatewayURL || '').trim() ? 'login' : 'api-key'
}

export function managedGatewayBaseURL(configuredURL, browserOrigin, fallback = defaultGatewayURL) {
	const selected = String(configuredURL || '').trim()
	if (!selected) return canonicalGatewayBaseURL(fallback)
	return canonicalGatewayBaseURL(new URL(selected, browserOrigin).toString())
}

export function bucketAllowsWrite(bucket) {
	return (
		bucket?.state === 'active' &&
		['writer', 'admin', 'owner'].includes(String(bucket?.role || ''))
	)
}

export function bucketCanOpen(bucket) {
	return Boolean(bucket?.id) && bucket.state !== 'archived'
}

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

export async function fetchGatewayIdentity({ baseURL, apiKey, signal }) {
	const url = buildGatewayURL(baseURL, ['v1', 'me'])
	const response = await fetch(url, gatewayRequestOptions(url, apiKey, { signal }))
	return validateGatewayIdentity(await readJSONResponse(response))
}

export async function registerAccount({ baseURL, email, username, password, displayName, signal }) {
  const url = buildGatewayURL(baseURL, ['v1', 'auth', 'register'])
  assertSecureCredentialURL(url)
  const response = await fetch(url, gatewayRequestOptions(url, '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(email || '').trim(),
      username: String(username || '').trim(),
      password: String(password || ''),
      ...(String(displayName || '').trim() ? { display_name: String(displayName).trim() } : {})
    }),
    signal
  }))
  return validateAuthSession(await readJSONResponse(response))
}

export async function fetchBootstrapStatus({ baseURL, signal }) {
  const url = buildGatewayURL(baseURL, ['v1', 'auth', 'bootstrap', 'status'])
  const response = await fetch(url, gatewayRequestOptions(url, '', { signal }))
  const value = await readJSONResponse(response)
  if (typeof value.required !== 'boolean') {
    throw new Error('gateway returned invalid bootstrap status')
  }
  return { required: value.required }
}

export async function bootstrapAdministrator({
  baseURL,
  token,
  email,
  username,
  password,
  displayName,
  signal
}) {
  const url = buildGatewayURL(baseURL, ['v1', 'auth', 'bootstrap'])
  assertSecureCredentialURL(url)
  const response = await fetch(url, gatewayRequestOptions(url, '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: String(token || ''),
      email: String(email || '').trim(),
      username: String(username || '').trim(),
      password: String(password || ''),
      ...(String(displayName || '').trim() ? { display_name: String(displayName).trim() } : {})
    }),
    signal
  }))
  return validateAuthSession(await readJSONResponse(response))
}

export async function loginAccount({ baseURL, login, password, signal }) {
  const url = buildGatewayURL(baseURL, ['v1', 'auth', 'login'])
  assertSecureCredentialURL(url)
  const response = await fetch(url, gatewayRequestOptions(url, '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: String(login || '').trim(),
      password: String(password || '')
    }),
    signal
  }))
  return validateAuthSession(await readJSONResponse(response))
}

export async function logoutAccount({ baseURL, signal }) {
  const url = buildGatewayURL(baseURL, ['v1', 'auth', 'logout'])
  const response = await fetch(url, gatewayRequestOptions(url, '', { method: 'POST', signal }))
  await readJSONResponse(response)
}

export async function fetchAccountProfile({ baseURL, signal }) {
  const url = buildGatewayURL(baseURL, ['v1', 'profile'])
  const response = await fetch(url, gatewayRequestOptions(url, '', { signal }))
  return validateAccountUser((await readJSONResponse(response)).user)
}

export async function updateAccountProfile({ baseURL, displayName, signal }) {
  const url = buildGatewayURL(baseURL, ['v1', 'profile'])
  const response = await fetch(url, gatewayRequestOptions(url, '', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: String(displayName || '').trim() }),
    signal
  }))
  return validateAccountUser((await readJSONResponse(response)).user)
}

export async function fetchAdminOverview({ baseURL, signal }) {
  const url = buildGatewayURL(baseURL, ['v1', 'admin', 'overview'])
  const response = await fetch(url, gatewayRequestOptions(url, '', { signal }))
  const value = await readJSONResponse(response)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('gateway returned invalid admin statistics')
  }
  return value
}

export async function fetchAdminUsers({ baseURL, signal }) {
  const url = buildGatewayURL(baseURL, ['v1', 'admin', 'users'])
  const response = await fetch(url, gatewayRequestOptions(url, '', { signal }))
  const value = await readJSONResponse(response)
  const values = Array.isArray(value) ? value : value.users
  if (!Array.isArray(values)) throw new Error('gateway returned an invalid user list')
  return values.map(validateAccountUser)
}

export async function updateAdminUserTier({ baseURL, userID, tier, signal }) {
  const selectedUserID = String(userID || '').trim()
  if (!selectedUserID) throw new Error('user ID is required')
  const url = buildGatewayURL(baseURL, ['v1', 'admin', 'users', selectedUserID, 'tier'])
  const response = await fetch(url, gatewayRequestOptions(url, '', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: String(tier || '').trim() }),
    signal
  }))
  return validateAccountUser((await readJSONResponse(response)).user)
}

export async function fetchBuckets({ baseURL, apiKey, signal }) {
	const url = buildGatewayURL(baseURL, ['v1', 'buckets'])
	const response = await fetch(url, gatewayRequestOptions(url, apiKey, { signal }))
	const payload = await readJSONResponse(response)
	if (!Array.isArray(payload.buckets)) throw new Error('gateway did not return a Bucket list')
	const buckets = payload.buckets.map(validateBucketView)
	if (new Set(buckets.map((bucket) => bucket.id)).size !== buckets.length) {
		throw new Error('gateway returned duplicate Buckets')
	}
	return buckets
}

export async function fetchBucketHead({ baseURL, bucketID, apiKey, signal }) {
	const url = buildBucketURL(baseURL, bucketID, ['head'])
	const response = await fetch(url, gatewayRequestOptions(url, apiKey, { signal }))
	const head = await readJSONResponse(response)
	if (response.status !== 200) throw new Error(`gateway returned unexpected Bucket head status ${response.status}`)
	return validateBucketRef(head, String(bucketID || '').trim(), { name: 'main', kind: 'main' })
}

function validateGatewayIdentity(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('gateway returned an invalid identity')
	}
  const authMethod = String(value.auth_method || '').trim()
	const identity = {
		tenant_id: String(value.tenant_id || '').trim(),
		principal_id: String(value.principal_id || '').trim(),
		credential_id: String(value.credential_id || '').trim(),
    ...(authMethod ? { auth_method: authMethod } : {})
	}
	if (
    !identity.tenant_id ||
    !identity.principal_id ||
    (authMethod && !['session', 'api_key'].includes(authMethod)) ||
    (authMethod === 'api_key' && !identity.credential_id)
  ) {
		throw new Error('gateway returned an incomplete identity')
	}
	return identity
}

function validateAuthSession(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('gateway returned an invalid authentication response')
  }
  return { user: validateAccountUser(value.user) }
}

function validateAccountUser(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('gateway returned invalid account information')
  }
  const user = {
    id: String(value.id || value.user_id || '').trim(),
    tenant_id: String(value.tenant_id || '').trim(),
    principal_id: String(value.principal_id || '').trim(),
    email: String(value.email || '').trim(),
    username: String(value.username || '').trim(),
    display_name: String(value.display_name || value.displayName || '').trim(),
    system_role: String(value.system_role || 'user').trim(),
    tier: String(value.tier || '').trim(),
    quota_bytes: normalizeNonNegativeNumber(value.quota_bytes),
    used_bytes: normalizeNonNegativeNumber(value.used_bytes),
    reserved_bytes: normalizeNonNegativeNumber(value.reserved_bytes),
    provisioning_state: String(value.provisioning_state || '').trim(),
    provisioning_error: String(value.provisioning_error || '').trim(),
    created_at: String(value.created_at || '').trim(),
    updated_at: String(value.updated_at || '').trim()
  }
  if (
    !user.id ||
    !user.tenant_id ||
    !user.principal_id ||
    !user.email ||
    !user.username ||
    !['user', 'admin'].includes(user.system_role)
  ) {
    throw new Error('gateway returned incomplete account information')
  }
  return user
}

function normalizeNonNegativeNumber(value) {
  const selected = Number(value ?? 0)
  return Number.isFinite(selected) && selected >= 0 ? selected : 0
}

function validateBucketView(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('gateway returned an invalid Bucket')
	}
	const bucket = {
		id: String(value.id || '').trim(),
		tenant_id: String(value.tenant_id || '').trim(),
		name: String(value.name || '').trim(),
		state: String(value.state || '').trim(),
		role: String(value.role || '').trim(),
		created_by: String(value.created_by || '').trim(),
		created_at: String(value.created_at || '').trim(),
		updated_at: String(value.updated_at || '').trim()
	}
	if (
		!bucket.id ||
		!bucket.tenant_id ||
		!bucket.name ||
		!['active', 'read_only', 'archived'].includes(bucket.state) ||
		!['reader', 'writer', 'admin', 'owner'].includes(bucket.role)
	) {
		throw new Error('gateway returned invalid Bucket metadata')
	}
	return bucket
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
	const selectedBucket = String(bucketID || '').trim()
	const selectedPushID = String(pushID || '').trim()
	const selectedBaseCommit = String(baseCommit || '').trim()
	const selectedBaseRoot = String(baseRoot || '').trim()
	const selectedCandidateRoot = String(candidateRoot || '').trim()
	const selectedBaseRevision = Number(baseRevision || 0)
	const selectedMessage = String(message || '').trim()
	if (!selectedBucket) throw new Error('Bucket ID is required')
	if (!selectedPushID) throw new Error('Bucket push ID is required')
	parseCID(selectedCandidateRoot)
	if (selectedBaseRoot) parseCID(selectedBaseRoot)
	if (!Number.isSafeInteger(selectedBaseRevision) || selectedBaseRevision < 0) {
		throw new Error('Bucket base revision must be a non-negative safe integer')
	}
	const emptyBase = !selectedBaseCommit && !selectedBaseRoot && selectedBaseRevision === 0
	const populatedBase = Boolean(selectedBaseCommit && selectedBaseRoot && selectedBaseRevision >= 1)
	if (!emptyBase && !populatedBase) throw new Error('Bucket base commit, root, and revision must describe one observation')
	const url = buildBucketURL(baseURL, bucketID, ['push'])
	const response = await fetch(url, gatewayRequestOptions(url, apiKey, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			push_id: selectedPushID,
			base_commit: selectedBaseCommit,
			base_root: selectedBaseRoot,
			candidate_root: selectedCandidateRoot,
			base_revision: selectedBaseRevision,
			message: selectedMessage
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
	if (response.status === 409 && payload?.status !== 'branched') {
		throw new Error(apiErrorMessage(response, payload, text))
	}
	return validateBucketPushResult(payload, response.status, {
		bucketID: selectedBucket,
		baseCommit: selectedBaseCommit,
		baseRoot: selectedBaseRoot,
		baseRevision: selectedBaseRevision,
		candidateRoot: selectedCandidateRoot,
		changeSetCID: '',
		message: selectedMessage
	})
}

function validateBucketPushResult(value, statusCode, request) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('gateway returned an invalid Bucket push result')
	}
	const expectedStatus = statusCode === 409 ? 'branched' : null
	if (expectedStatus ? value.status !== expectedStatus : !['fast_forward', 'merged'].includes(value.status)) {
		throw new Error(`gateway returned an inconsistent Bucket push status ${JSON.stringify(value.status)}`)
	}
	const head = validateBucketRef(value.head, request.bucketID, { name: 'main', kind: 'main' })
	const finalCommit = validateBucketCommit(value.commit, request.bucketID, 'final commit')
	const candidate = validateBucketCommit(value.candidate, request.bucketID, 'candidate commit')
	if (!sameCID(candidate.root, request.candidateRoot)) {
		throw new Error('gateway returned a candidate commit for a different root')
	}
	validateCandidateBase(candidate, request, value.status === 'branched')

	if (value.status === 'fast_forward') {
		if (finalCommit.id !== head.commit_id || !sameCID(finalCommit.root, head.root)) {
			throw new Error('gateway returned a fast-forward commit that does not match main')
		}
		if (value.branch != null || !sameBucketCommit(candidate, finalCommit) || !sameCID(finalCommit.root, request.candidateRoot)) {
			throw new Error('gateway returned an inconsistent fast-forward result')
		}
		if (value.merge_base || !hasNoConflicts(value.conflicts)) {
			throw new Error('gateway returned conflict metadata for a fast-forward result')
		}
	} else if (value.status === 'merged') {
		if (finalCommit.id !== head.commit_id || !sameCID(finalCommit.root, head.root)) {
			throw new Error('gateway returned a merge commit that does not match main')
		}
		if (
			value.branch != null ||
			candidate.id === finalCommit.id ||
			finalCommit.parents.length !== 2 ||
			finalCommit.parents[1] !== candidate.id ||
			!finalCommit.parents[0] ||
			finalCommit.parents[0] === candidate.id ||
			!finalCommit.base_root
		) {
			throw new Error('gateway returned a merge commit that does not include the candidate')
		}
		if (!sameOptionalCID(value.merge_base, request.baseRoot)) {
			throw new Error('gateway returned a merge result for a different base')
		}
		if (!hasNoConflicts(value.conflicts)) throw new Error('gateway returned conflicts for a merged result')
	} else {
		const branch = validateBucketRef(value.branch, request.bucketID, { kind: 'conflict' })
		const branchSegments = branch.name.split('/')
		if (
			branchSegments.length !== 3 ||
			branchSegments[0] !== 'conflicts' ||
			!branchSegments[1] ||
			!branchSegments[2] ||
			!sameBucketCommit(candidate, finalCommit)
		) {
			throw new Error('gateway returned an inconsistent Bucket conflict commit')
		}
		if (branch.commit_id !== candidate.id || !sameCID(branch.root, candidate.root)) {
			throw new Error('gateway returned a conflict branch that does not preserve the candidate')
		}
		if (!sameOptionalCID(value.merge_base, request.baseRoot)) {
			throw new Error('gateway returned a conflict result for a different base')
		}
		if (
			!Array.isArray(value.conflicts) ||
			value.conflicts.length === 0 ||
			value.conflicts.some((conflict) => !conflict || typeof conflict.coordinate !== 'string' || !conflict.coordinate)
		) {
			throw new Error('gateway returned a conflict result without conflict coordinates')
		}
	}
	return value
}

function validateBucketRef(value, bucketID, expected = {}) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('gateway returned an invalid Bucket ref')
	}
	if (value.bucket_id !== bucketID || typeof value.name !== 'string' || !value.name.trim()) {
		throw new Error('gateway returned a ref for a different Bucket or name')
	}
	if ((expected.name && value.name !== expected.name) || (expected.kind && value.kind !== expected.kind)) {
		throw new Error('gateway returned an unexpected Bucket ref')
	}
	if (!['main', 'explicit', 'conflict'].includes(value.kind) || value.state !== 'open') {
		throw new Error('gateway returned a Bucket ref with an invalid kind or state')
	}
	if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
		throw new Error('gateway returned an invalid Bucket ref revision')
	}
	const commitID = typeof value.commit_id === 'string' ? value.commit_id.trim() : ''
	const root = typeof value.root === 'string' ? value.root.trim() : ''
	if (!commitID) {
		if (value.name !== 'main' || root || value.revision !== 0) {
			throw new Error('gateway returned an invalid empty Bucket ref')
		}
	} else {
		if (!root || value.revision < 1) throw new Error('gateway returned an incomplete Bucket ref')
		parseCID(root)
	}
	return value
}

function validateBucketCommit(value, bucketID, label) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`gateway returned an invalid Bucket ${label}`)
	}
	if (value.bucket_id !== bucketID || typeof value.id !== 'string' || !value.id.trim()) {
		throw new Error(`gateway returned a ${label} for a different Bucket or ID`)
	}
	if (
		typeof value.author !== 'string' ||
		!value.author.trim() ||
		typeof value.created_at !== 'string' ||
		Number.isNaN(Date.parse(value.created_at))
	) {
		throw new Error(`gateway returned incomplete ${label} metadata`)
	}
	for (const field of ['base_root', 'credential', 'change_set_cid', 'message']) {
		if (value[field] != null && typeof value[field] !== 'string') {
			throw new Error(`gateway returned invalid ${label} metadata`)
		}
	}
	parseCID(value.root)
	if (value.base_root) parseCID(value.base_root)
	if (value.change_set_cid) parseCID(value.change_set_cid)
	if (value.parents != null && !Array.isArray(value.parents)) {
		throw new Error(`gateway returned invalid ${label} parents`)
	}
	const parents = value.parents || []
	if (
		parents.length > 2 ||
		new Set(parents).size !== parents.length ||
		parents.some((parent) => typeof parent !== 'string' || !parent.trim() || parent === value.id)
	) {
		throw new Error(`gateway returned invalid ${label} parents`)
	}
	return { ...value, parents }
}

function validateCandidateBase(candidate, request, allowHistoryConflict) {
	if (
		String(candidate.change_set_cid || '') !== request.changeSetCID ||
		String(candidate.message || '') !== request.message
	) {
		throw new Error('gateway returned a candidate commit for a different request')
	}
	if (request.baseCommit) {
		const expectedParent = candidate.parents.length === 1 && candidate.parents[0] === request.baseCommit
		const historyConflict = allowHistoryConflict && candidate.parents.length === 0
		if (!sameCID(candidate.base_root, request.baseRoot) || (!expectedParent && !historyConflict)) {
			throw new Error('gateway returned a candidate commit for a different base')
		}
	} else if (candidate.base_root || candidate.parents.length !== 0) {
		throw new Error('gateway returned an initial candidate commit with a non-empty base')
	}
}

function sameCID(left, right) {
	return parseCID(left).equals(parseCID(right))
}

function sameOptionalCID(left, right) {
	const first = String(left || '').trim()
	const second = String(right || '').trim()
	return !first && !second ? true : Boolean(first && second && sameCID(first, second))
}

function sameBucketCommit(left, right) {
	return (
		left.id === right.id &&
		left.bucket_id === right.bucket_id &&
		sameCID(left.root, right.root) &&
		sameOptionalCID(left.base_root, right.base_root) &&
		left.parents.length === right.parents.length &&
		left.parents.every((parent, index) => parent === right.parents[index]) &&
		String(left.author || '') === String(right.author || '') &&
		String(left.credential || '') === String(right.credential || '') &&
		String(left.change_set_cid || '') === String(right.change_set_cid || '') &&
		String(left.message || '') === String(right.message || '') &&
		Date.parse(left.created_at) === Date.parse(right.created_at)
	)
}

function hasNoConflicts(value) {
	return value == null || (Array.isArray(value) && value.length === 0)
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

export function canonicalGatewayBaseURL(value) {
	const url = new URL(normalizeBaseURL(value))
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('Gateway URL must use HTTP or HTTPS')
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new Error('Gateway URL must not contain credentials, query parameters, or a fragment')
	}
	const pathname = url.pathname.replace(/\/+$/, '')
	return `${url.origin}${pathname && pathname !== '/' ? pathname : ''}`
}

export function createBucketStashScope({ profile, baseURL, bucketID }) {
	const selectedProfile = String(profile || '').trim()
	const selectedBucket = String(bucketID || '').trim()
	if (!selectedProfile || !selectedBucket) throw new Error('Bucket stash profile and Bucket ID are required')
	return Object.freeze({
		profile: selectedProfile,
		baseURL: canonicalGatewayBaseURL(baseURL),
		bucketID: selectedBucket
	})
}

export function mergeObservedBucketHead(current, currentScope, incoming, incomingScope) {
	const selected = createBucketStashScope(incomingScope || {})
	validateBucketRef(incoming, selected.bucketID, { name: 'main', kind: 'main' })
	let previousScope
	try {
		previousScope = createBucketStashScope(currentScope || {})
		validateBucketRef(current, selected.bucketID, { name: 'main', kind: 'main' })
	} catch {
		return incoming
	}
	if (!sameBucketStashScope(previousScope, selected)) return incoming
	if (incoming.revision > current.revision) return incoming
	if (incoming.revision < current.revision) return current
	if (
		String(incoming.commit_id || '') !== String(current.commit_id || '') ||
		!sameOptionalCID(incoming.root, current.root)
	) {
		throw new Error('Gateway returned different Bucket heads at the same revision')
	}
	return incoming
}

export function bucketStashNamespace(scope) {
	const selected = createBucketStashScope(scope || {})
	return `malt-app-bucket-stash:v2:${encodeURIComponent(selected.profile)}:${encodeURIComponent(selected.baseURL)}:${encodeURIComponent(selected.bucketID)}:`
}

export function legacyBucketStashStorageKey(scope) {
	const selected = createBucketStashScope(scope || {})
	return `malt-app-bucket-stashes:${selected.profile}:${selected.bucketID}`
}

export function legacyBucketStashBindingNamespace(scope) {
	const selected = createBucketStashScope(scope || {})
	return `malt-app-bucket-stash:legacy-bound:v2:${encodeURIComponent(selected.profile)}:${encodeURIComponent(selected.bucketID)}:`
}

export function legacyBucketStashBindingStorageKey(scope, legacyID) {
	const id = String(legacyID || '').trim()
	if (!id) throw new Error('legacy Bucket stash ID is required')
	return `${legacyBucketStashBindingNamespace(scope)}${encodeURIComponent(id)}`
}

export function bucketStashStorageKey(scope, stashID) {
	const id = String(stashID || '').trim()
	if (!id) throw new Error('Bucket stash ID is required')
	return `${bucketStashNamespace(scope)}${encodeURIComponent(id)}`
}

export function assertBucketStashScope(stash, expectedScope) {
	const expected = createBucketStashScope(expectedScope || {})
	let actual
	try {
		actual = createBucketStashScope(stash?.scope || {})
	} catch {
		throw new Error('Bucket stash has no valid Gateway scope')
	}
	if (!sameBucketStashScope(actual, expected)) {
		throw new Error('Bucket stash belongs to a different profile, Gateway, or Bucket')
	}
	return actual
}

export function assertBucketStashLegacyBinding(storage, stash) {
	const value = normalizeBucketStash(stash)
	if (!value) throw new Error('invalid Bucket stash')
	if (!value.legacyBinding) return null
	const marker = readLegacyBindingMarker(storage, value.scope, value.legacyBinding.legacyID)
	if (!marker || !legacyMarkerMatchesStash(marker, value)) {
		throw new Error('legacy Bucket stash binding no longer matches its Gateway scope')
	}
	return marker
}

export function readBucketStashValues(storage, scope) {
	const selected = createBucketStashScope(scope || {})
	const namespace = bucketStashNamespace(selected)
	const values = []
	for (const key of storageKeySnapshot(storage)) {
		if (!key.startsWith(namespace)) continue
		const value = readBucketStashValue(storage, key, selected, { verifyBinding: true })
		if (value && key === bucketStashStorageKey(selected, value.id)) values.push(value)
	}
	return values.sort((left, right) =>
		String(left.createdAt || '').localeCompare(String(right.createdAt || '')) || left.id.localeCompare(right.id)
	)
}

export function readLegacyBucketStashValues(storage, scope) {
	const selected = createBucketStashScope(scope || {})
	const legacyKey = legacyBucketStashStorageKey(selected)
	const raw = storage.getItem(legacyKey)
	if (raw == null) return []
	let decoded
	try {
		decoded = JSON.parse(raw)
	} catch {
		return []
	}
	if (!Array.isArray(decoded)) return []
	const values = []
	const seen = new Set()
	for (const value of decoded) {
		const legacy = normalizeLegacyBucketStash(value)
		if (
			!legacy ||
			seen.has(legacy.id) ||
			storage.getItem(legacyBucketStashBindingStorageKey(selected, legacy.id)) != null
		) continue
		seen.add(legacy.id)
		values.push(legacy)
	}
	return values.sort((left, right) =>
		String(left.createdAt || '').localeCompare(String(right.createdAt || '')) || left.id.localeCompare(right.id)
	)
}

export async function bindLegacyBucketStashValue(storage, legacy, scope, options = {}) {
	const source = normalizeLegacyBucketStash(legacy)
	if (!source) throw new Error('invalid legacy Bucket stash')
	const selected = createBucketStashScope(scope || {})
	const id = source.id
	const pushID = `web_${source.id}`
	const lockManager = options.lockManager
	if (!lockManager || typeof lockManager.request !== 'function') {
		throw new Error('Web Locks API is required to bind a legacy Bucket stash safely')
	}
	return lockManager.request(legacyBindingLockName(selected, source.id), { mode: 'exclusive' }, async () => {
		const marker = readLegacyBindingMarker(storage, selected, source.id)
		if (marker) {
			if (!sameBucketStashScope(marker.scope, selected)) {
				throw new Error('legacy Bucket stash is already bound to a different Gateway')
			}
			const existing = readBucketStashValue(
				storage,
				bucketStashStorageKey(selected, source.id),
				selected,
				{ verifyBinding: true }
			)
			return { stash: existing, values: readBucketStashValues(storage, selected) }
		}
		const stash = normalizeBucketStash({
			id,
			pushID,
			candidateRoot: source.candidateRoot,
			base: source.base,
			message: source.message,
			scope: selected,
			status: 'pending',
			createdAt: String(options.createdAt || ''),
			legacyBinding: { version: 1, legacyID: source.id }
		})
		if (!stash) throw new Error('legacy Bucket stash cannot be bound')
		const key = bucketStashStorageKey(selected, stash.id)
		const existing = readBucketStashValue(storage, key, selected, { verifyBinding: false })
		if (existing && !sameBucketStashRequest(existing, stash)) {
			throw new Error('legacy Bucket stash ID is already bound to a different request')
		}
		if (!existing) storage.setItem(key, JSON.stringify(stash))
		const binding = legacyBindingMarker(selected, source.id)
		storage.setItem(legacyBucketStashBindingStorageKey(selected, source.id), JSON.stringify(binding))
		return { stash, values: readBucketStashValues(storage, selected) }
	})
}

export function appendBucketStashValue(storage, stash) {
	const value = normalizeBucketStash(stash)
	if (!value) throw new Error('invalid Bucket stash')
	const key = bucketStashStorageKey(value.scope, value.id)
	const existing = storage.getItem(key)
	if (existing != null) {
			const decoded = readBucketStashValue(storage, key, value.scope, { verifyBinding: true })
		if (!decoded || !sameBucketStashRequest(decoded, value)) {
			throw new Error('Bucket stash ID is already bound to a different request')
		}
		return readBucketStashValues(storage, value.scope)
	}
	storage.setItem(key, JSON.stringify(value))
	return readBucketStashValues(storage, value.scope)
}

export function applyBucketStashResult(storage, stash, result) {
	const value = normalizeBucketStash(stash)
	if (!value) throw new Error('invalid Bucket stash')
	assertBucketStashLegacyBinding(storage, value)
	const key = bucketStashStorageKey(value.scope, value.id)
	const stored = readBucketStashValue(storage, key, value.scope, { verifyBinding: true })
	if (!stored) return readBucketStashValues(storage, value.scope)
	if (!sameBucketStashRequest(stored, value)) {
		throw new Error('stored Bucket stash no longer matches the completed request')
	}
	if (result.status === 'branched') {
		storage.setItem(
			key,
			JSON.stringify({
				...stored,
				status: 'branched',
				branch: result.branch.name,
				conflicts: result.conflicts
			})
		)
	} else {
		storage.removeItem(key)
	}
	return readBucketStashValues(storage, value.scope)
}

function storageKeySnapshot(storage) {
	const keys = []
	for (let index = 0; index < storage.length; index++) {
		const key = storage.key(index)
		if (typeof key === 'string') keys.push(key)
	}
	return keys
}

function readBucketStashValue(storage, key, scope, options = {}) {
	try {
		const value = normalizeBucketStash(JSON.parse(storage.getItem(key)))
		if (!value || !sameBucketStashScope(value.scope, scope)) return null
		if (options.verifyBinding && value.legacyBinding) assertBucketStashLegacyBinding(storage, value)
		return value
	} catch {
		return null
	}
}

function normalizeBucketStash(value) {
	if (
		!value ||
		typeof value.id !== 'string' ||
		!value.id.trim() ||
		typeof value.pushID !== 'string' ||
		!value.pushID.trim() ||
		typeof value.candidateRoot !== 'string' ||
		typeof value.message !== 'string' ||
		!['pending', 'branched'].includes(value.status) ||
		!value.base ||
		typeof value.base.commitID !== 'string' ||
		typeof value.base.root !== 'string' ||
		!Number.isSafeInteger(value.base.revision) ||
		value.base.revision < 0
	) {
		return null
	}
	let scope
	let legacyBinding = null
	try {
		scope = createBucketStashScope(value.scope || {})
		parseCID(value.candidateRoot)
		if (value.base.root) parseCID(value.base.root)
		if (value.legacyBinding != null) {
			legacyBinding = normalizeLegacyBindingProvenance(value.legacyBinding, value.id, value.pushID)
			if (!legacyBinding) return null
		}
	} catch {
		return null
	}
	const emptyBase = !value.base.commitID && !value.base.root && value.base.revision === 0
	const populatedBase = Boolean(value.base.commitID && value.base.root && value.base.revision >= 1)
	if (!emptyBase && !populatedBase) return null
	return {
		id: value.id.trim(),
		pushID: value.pushID.trim(),
		candidateRoot: value.candidateRoot.trim(),
		base: {
			commitID: value.base.commitID.trim(),
			root: value.base.root.trim(),
			revision: value.base.revision
		},
		message: value.message.trim(),
		scope,
		status: value.status,
		createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
		...(legacyBinding ? { legacyBinding } : {}),
		...(value.status === 'branched'
			? {
					branch: typeof value.branch === 'string' ? value.branch : '',
					conflicts: Array.isArray(value.conflicts) ? value.conflicts : []
				}
			: {})
	}
}

function normalizeLegacyBucketStash(value) {
	if (
		!value ||
		typeof value.id !== 'string' ||
		!value.id.trim() ||
		typeof value.candidateRoot !== 'string' ||
		!['pending', 'branched'].includes(value.status) ||
		!value.base ||
		typeof value.base.commitID !== 'string' ||
		typeof value.base.root !== 'string' ||
		!Number.isSafeInteger(value.base.revision) ||
		value.base.revision < 0
	) {
		return null
	}
	try {
		parseCID(value.candidateRoot)
		if (value.base.root) parseCID(value.base.root)
	} catch {
		return null
	}
	const emptyBase = !value.base.commitID && !value.base.root && value.base.revision === 0
	const populatedBase = Boolean(value.base.commitID && value.base.root && value.base.revision >= 1)
	if (!emptyBase && !populatedBase) return null
	return {
		id: value.id.trim(),
		candidateRoot: value.candidateRoot.trim(),
		base: {
			commitID: value.base.commitID.trim(),
			root: value.base.root.trim(),
			revision: value.base.revision
		},
		message: typeof value.message === 'string' ? value.message.trim() : 'web upload',
		status: value.status,
		createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
		legacy: true,
		...(value.status === 'branched'
			? {
					branch: typeof value.branch === 'string' ? value.branch : '',
					conflicts: Array.isArray(value.conflicts) ? value.conflicts : []
				}
			: {})
	}
}

function normalizeLegacyBindingProvenance(value, stashID, pushID) {
	if (
		!value ||
		value.version !== 1 ||
		typeof value.legacyID !== 'string' ||
		!value.legacyID.trim() ||
		String(stashID || '').trim() !== value.legacyID.trim() ||
		String(pushID || '').trim() !== `web_${value.legacyID.trim()}`
	) {
		return null
	}
	return Object.freeze({ version: 1, legacyID: value.legacyID.trim() })
}

function sameLegacyBindingProvenance(left, right) {
	if (!left && !right) return true
	return Boolean(left && right && left.version === right.version && left.legacyID === right.legacyID)
}

function legacyBindingMarker(scope, legacyID) {
	const selected = createBucketStashScope(scope || {})
	const id = String(legacyID || '').trim()
	if (!id) throw new Error('legacy Bucket stash ID is required')
	return Object.freeze({ version: 1, legacyID: id, scope: selected })
}

function readLegacyBindingMarker(storage, scope, legacyID) {
	const key = legacyBucketStashBindingStorageKey(scope, legacyID)
	const raw = storage.getItem(key)
	if (raw == null) return null
	let decoded
	try {
		decoded = JSON.parse(raw)
	} catch {
		throw new Error('legacy Bucket stash binding marker is invalid')
	}
	if (!decoded || decoded.version !== 1 || decoded.legacyID !== String(legacyID || '').trim()) {
		throw new Error('legacy Bucket stash binding marker is invalid')
	}
	let markerScope
	try {
		markerScope = createBucketStashScope(decoded.scope || {})
	} catch {
		throw new Error('legacy Bucket stash binding marker has an invalid scope')
	}
	return Object.freeze({ version: 1, legacyID: decoded.legacyID, scope: markerScope })
}

function legacyMarkerMatchesStash(marker, stash) {
	return (
		marker.version === stash.legacyBinding.version &&
		marker.legacyID === stash.legacyBinding.legacyID &&
		stash.id === marker.legacyID &&
		stash.pushID === `web_${marker.legacyID}` &&
		sameBucketStashScope(marker.scope, stash.scope)
	)
}

function legacyBindingLockName(scope, legacyID) {
	const selected = createBucketStashScope(scope || {})
	return `malt-app-legacy-bind:v1:${encodeURIComponent(selected.profile)}:${encodeURIComponent(selected.bucketID)}:${encodeURIComponent(String(legacyID || '').trim())}`
}

function sameBucketStashScope(left, right) {
	return left.profile === right.profile && left.baseURL === right.baseURL && left.bucketID === right.bucketID
}

function sameBucketStashRequest(left, right) {
	return (
		left.id === right.id &&
		left.pushID === right.pushID &&
		left.candidateRoot === right.candidateRoot &&
		left.base.commitID === right.base.commitID &&
		left.base.root === right.base.root &&
		left.base.revision === right.base.revision &&
		left.message === right.message &&
		sameLegacyBindingProvenance(left.legacyBinding, right.legacyBinding) &&
		sameBucketStashScope(left.scope, right.scope)
	)
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

// Fetch one immutable payload block through its managed Bucket. Public raw-CAS
// reads are intentionally unavailable. Callers still hash returned bytes
// against the requested CID; Bucket authorization is not a trust decision.
export async function readPayloadBlock({ baseURL, cid, bucketID, apiKey, signal }) {
  const blockCID = String(cid || '').trim()
  if (!blockCID) {
    throw new Error('payload block CID is required')
  }
	if (!String(bucketID || '').trim()) {
		throw new Error('managed Bucket ID is required for payload reads')
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
    credentials: token ? 'omit' : 'include',
    redirect: 'error',
    cache: 'no-store'
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
		throw new Error('Gateway credentials require HTTPS or a loopback HTTP Gateway')
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
