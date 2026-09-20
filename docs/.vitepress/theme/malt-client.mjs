export const authenticationProfile = 'malt.authentication/1'
export const defaultGatewayURL = 'http://127.0.0.1:8080'

export function buildAuthenticationURL(baseURL) {
  const url = new URL(String(baseURL))
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('HTTP gateway URL without credentials is required')
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/authentication/query`
  url.search = ''; url.hash = ''
  return url
}

export async function resolvePath({ baseURL, root, steps, signal }) {
  if (typeof root !== 'string' || !root.trim()) throw new Error('root is required')
  if (!Array.isArray(steps)) throw new Error('typed steps array is required')
  const request = { profile: authenticationProfile, root: root.trim(), steps: structuredClone(steps), operation: 'resolve' }
  const url = buildAuthenticationURL(baseURL)
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request), signal, credentials: 'omit', redirect: 'error', cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(`gateway API error (${response.status}): ${result.error || result.message || response.statusText}`)
  return { endpoint: url.toString(), status: response.status, request, result }
}
