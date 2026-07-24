import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildReadURL,
  buildResolveURL,
  buildVerifyReadURL,
  buildVerifyResolveURL,
  diagnoseResolveRemotely,
  readProfile,
  readQuery,
  resolvePath,
  resolveProfile
} from '../docs/.vitepress/theme/malt-client.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const docsRoot = path.join(root, '..', 'docs')

for (const file of [
  'tools/resolve.md',
  'tools/verify.md',
  '.vitepress/theme/components/MaltResolveTool.vue',
  '.vitepress/theme/components/MaltVerifyTool.vue',
  '.vitepress/theme/malt-client.mjs',
  '.vitepress/theme/malt-payload-verifier.mjs',
  '.vitepress/theme/malt-verifier.mjs',
  'public/verifier/wasm_exec.js',
  'public/verifier/malt-verifier.wasm',
  'public/verifier/PROVENANCE.json',
  'public/verifier/SHA256SUMS'
]) {
  assert.ok(fs.existsSync(path.join(docsRoot, file)), `Missing public browser tool file: ${file}`)
}

for (const removed of ['app.md', '.vitepress/theme/components/MaltApp.vue']) {
  assert.equal(
    fs.existsSync(path.join(docsRoot, removed)),
    false,
    `Managed Console file must not remain in the public documentation repository: ${removed}`
  )
}

const configSource = fs.readFileSync(path.join(docsRoot, '.vitepress/config.ts'), 'utf8')
assert.match(configSource, /text:\s*'Gateway Console'/)
assert.match(configSource, /https:\/\/gateway\.deweb\.world/)
assert.match(configSource, /link:\s*'\/tools\/resolve'/)
assert.match(configSource, /link:\s*'\/tools\/verify'/)
assert.doesNotMatch(configSource, /link:\s*'\/app'/)
assert.doesNotMatch(configSource, /transformHtml/)

const themeSource = fs.readFileSync(path.join(docsRoot, '.vitepress/theme/index.ts'), 'utf8')
assert.match(themeSource, /export default DefaultTheme/)
assert.doesNotMatch(themeSource, /MaltApp|isAppStateRoute/)

const clientSource = fs.readFileSync(
  path.join(docsRoot, '.vitepress/theme/malt-client.mjs'),
  'utf8'
)
assert.doesNotMatch(
  clientSource,
  /registerAccount|loginAccount|fetchBuckets|pushBucketRoot|localStorage|API key/
)
assert.match(clientSource, /credentials:\s*'omit'/)

const resolveToolSource = fs.readFileSync(
  path.join(docsRoot, '.vitepress/theme/components/MaltResolveTool.vue'),
  'utf8'
)
assert.match(resolveToolSource, /Resolve and verify/)
assert.match(resolveToolSource, /verifyResolveLocally/)
assert.doesNotMatch(resolveToolSource, /Read content|API key|readPayloadBlock/)

const verifyToolSource = fs.readFileSync(
  path.join(docsRoot, '.vitepress/theme/components/MaltVerifyTool.vue'),
  'utf8'
)
assert.match(verifyToolSource, /Verify locally/)
assert.match(verifyToolSource, /gateway diagnostic/i)
assert.match(verifyToolSource, /not a trust decision/)

assert.equal(buildResolveURL('https://gateway.example/api').toString(), 'https://gateway.example/api/v1/resolve')
assert.equal(buildReadURL('https://gateway.example/api/').toString(), 'https://gateway.example/api/v1/read')
assert.equal(
  buildVerifyResolveURL('https://gateway.example/api').toString(),
  'https://gateway.example/api/v1/verify/resolve'
)
assert.equal(
  buildVerifyReadURL('https://gateway.example/api').toString(),
  'https://gateway.example/api/v1/verify/read'
)

const requests = []
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input))
  const body = options.body ? JSON.parse(options.body) : null
  requests.push({ url, options, body })
  if (url.pathname.endsWith('/v1/resolve')) {
    return Response.json({
      profile: resolveProfile,
      target: 'bafkqaaa',
      prooflist: {
        root: body.root,
        query: body.segments.join('/'),
        steps: []
      }
    })
  }
  if (url.pathname.endsWith('/v1/read')) {
    return Response.json({
      profile: readProfile,
      target: 'bafkqbbb',
      prooflist: {
        root: body.root,
        query: 'list_index:0',
        steps: []
      }
    })
  }
  if (url.pathname.endsWith('/v1/verify/resolve')) {
    return Response.json({ valid: true })
  }
  throw new Error(`Unexpected test request: ${url}`)
}

const resolved = await resolvePath({
  baseURL: 'https://gateway.example/api',
  root: 'bafkqroot',
  path: 'docs/read me'
})
assert.deepEqual(resolved.request, {
  profile: resolveProfile,
  root: 'bafkqroot',
  segments: ['docs', 'read me']
})
assert.equal(resolved.proofList.root, 'bafkqroot')

const read = await readQuery({
  baseURL: 'https://gateway.example/api',
  root: 'bafkqlist',
  query: { kind: 'list_index', index: 0 }
})
assert.equal(read.request.profile, readProfile)
assert.equal(read.result.target, 'bafkqbbb')

const diagnostic = await diagnoseResolveRemotely({
  baseURL: 'https://gateway.example/api',
  request: resolved.request,
  result: resolved.result
})
assert.equal(diagnostic.valid, true)
assert.equal(diagnostic.source, 'gateway-diagnostic')

for (const request of requests) {
  assert.equal(request.options.credentials, 'omit')
  assert.equal(request.options.redirect, 'error')
  assert.equal(request.options.cache, 'no-store')
  assert.equal(request.options.headers.Authorization, undefined)
}

await assert.rejects(
  resolvePath({ baseURL: 'https://gateway.example/api', root: '', path: '' }),
  /root is required/
)

console.log('Public browser tools contract passed.')
