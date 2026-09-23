import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { buildAuthenticationURL, resolvePath } from '../docs/.vitepress/theme/malt-client.mjs'
import { verificationPairs } from '../docs/.vitepress/theme/verification-input.mjs'
import { verifyAuthenticationLocally } from '@dewebprotocol/malt/verifier'

assert.equal(buildAuthenticationURL('https://gateway.example/api/?old=1#old').toString(), 'https://gateway.example/api/v1/authentication/query')
assert.throws(() => buildAuthenticationURL('https://account:secret@gateway.example'), /credentials/)
const calls = []
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options })
  return Response.json({ profile: 'malt.authentication/3', resolved: 'bafkqaaa' })
}
const steps = ['YS9i', 'QHBheWxvYWQ=']
const pair = await resolvePath({ baseURL: 'https://gateway.example/api', root: 'selected', steps })
assert.deepEqual(pair.request, { profile: 'malt.authentication/3', root: 'selected', steps, operation: 'resolve' })
assert.equal(calls[0].options.credentials, 'omit')
assert.equal(calls[0].options.redirect, 'error')
assert.equal(calls[0].options.cache, 'no-store')
assert.equal(calls[0].options.headers.Authorization, undefined)
await assert.rejects(resolvePath({ baseURL: 'https://gateway.example', root: '', steps: [] }), /root/)
await assert.rejects(resolvePath({ baseURL: 'https://gateway.example', root: 'r', steps: null }), /steps/)
const input = { request: pair.request, result: pair.result }
assert.deepEqual(verificationPairs({ node: input, payload: input, range: input }).map(v => v.name), ['node', 'payload', 'range'])
assert.throws(() => verificationPairs({ verification: input }), /unsupported/)
assert.throws(() => verificationPairs({ node: { ...input, request: { profile: 'malt.resolve/v0alpha1' } } }), /unsupported/)
let forwarded
const checked = await verifyAuthenticationLocally({ ...input, provider: { authentication: json => {
  forwarded = JSON.parse(json); return JSON.stringify({ profile: 'malt.authentication/3', valid: true })
} } })
assert.deepEqual(forwarded, input)
assert.equal(checked.valid, true)
assert.equal((await verifyAuthenticationLocally({ ...input, provider: {} })).valid, false)
assert.equal((await verifyAuthenticationLocally({ ...input, provider: { authentication: () => '{"valid":true}' } })).valid, false)
const component = fs.readFileSync(new URL('../docs/.vitepress/theme/components/MaltVerifyTool.vue', import.meta.url), 'utf8')
assert.match(component, /file\.text\(\)/)
assert.match(component, /if \(busy\.value \|\| !confirmed\.value\) return/)
assert.doesNotMatch(component, /postMessage|diagnoseRemotely/)
for (const retired of ['../docs/.vitepress/theme/malt-payload-verifier.mjs', './check-payload-verifier.mjs', './fixtures/resolve-kzg-payload.json']) {
  assert.equal(fs.existsSync(new URL(retired, import.meta.url)), false)
}
console.log('Public typed browser query and local proof import checks passed.')

// Exercise the actual Vue script to keep verification status bound to the
// request on screen when file reads and verifier initialization are deferred.
let finishRead, finishVerify, verifyCalls = 0
const readGate = new Promise(resolve => { finishRead = resolve })
const verifyGate = new Promise(resolve => { finishVerify = resolve })
const script = component.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const view = vm.runInNewContext(script + '\n({requestInput,resultInput,busy,confirmed,verification,importProof,runVerify,reset})', {
  ref: value => ({ value }), onMounted: () => {}, withBase: value => value,
  verificationPairs, verifyAuthenticationLocally: async () => { verifyCalls++; return verifyGate }
})
view.requestInput.value = JSON.stringify({ ...input.request, root: 'A' })
view.resultInput.value = JSON.stringify(input.result)
view.confirmed.value = true
const importing = view.importProof({ target: { files: [{ size: 1, text: () => readGate }], value: 'proof.json' } })
assert.equal(view.busy.value, true)
await view.runVerify()
assert.equal(verifyCalls, 0, 'verification must not overlap a pending import')
finishRead(JSON.stringify({ node: { request: { ...input.request, root: 'B' }, result: input.result } }))
await importing
assert.equal(JSON.parse(view.requestInput.value).root, 'B')
assert.equal(view.confirmed.value, false)
assert.equal(view.verification.value, null)
assert.equal(view.busy.value, false)
view.confirmed.value = true
const verifying = view.runVerify()
assert.equal(verifyCalls, 1)
view.requestInput.value = JSON.stringify({ ...input.request, root: 'C' }); view.reset()
finishVerify({ valid: true })
await verifying
assert.equal(view.verification.value, null, 'old verification cannot validate the changed editor input')
assert.equal(view.busy.value, false)
console.log('Deferred file import and stale verification status checks passed.')

// Resolve must invalidate completed proofs and both pending network and WASM
// results when any displayed selector changes.
const resolveComponent = fs.readFileSync(new URL('../docs/.vitepress/theme/components/MaltResolveTool.vue', import.meta.url), 'utf8')
for (const field of ['baseURL', 'root', 'stepsInput']) {
  assert.match(resolveComponent, new RegExp(`v-model="${field}"[^>]*@input="reset"`))
}
const resolveScript = resolveComponent.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
let finishQuery, finishProof, markProofStarted, resolveProofCalls = 0
const proofStarted = new Promise(resolve => { markProofStarted = resolve })
const queryGate = new Promise(resolve => { finishQuery = resolve })
const proofGate = new Promise(resolve => { finishProof = resolve })
const resolvedView = vm.runInNewContext(resolveScript + '\n({root,stepsInput,baseURL,busy,result,verification,run,reset,sendToVerifier})', {
  ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }), withBase: value => value,
  defaultGatewayURL: 'https://gateway.example',
  resolvePath: ({ root, steps }) => root === 'A' ? queryGate : Promise.resolve({ ...pair, request: { ...pair.request, root, steps } }),
  verifyAuthenticationLocally: async () => { resolveProofCalls++; markProofStarted(); return proofGate }
})
resolvedView.root.value = 'A'
const pendingQuery = resolvedView.run()
resolvedView.root.value = 'B'; resolvedView.reset()
finishQuery({ ...pair, request: { ...pair.request, root: 'A' } })
await pendingQuery
assert.equal(resolveProofCalls, 0, 'obsolete network response must not start proof verification')
assert.equal(resolvedView.result.value, null)
assert.equal(resolvedView.verification.value, null)
const pendingProof = resolvedView.run()
await proofStarted
assert.equal(resolveProofCalls, 1)
resolvedView.stepsInput.value = JSON.stringify(steps); resolvedView.reset()
finishProof({ valid: true })
await pendingProof
assert.equal(resolvedView.result.value, null)
assert.equal(resolvedView.verification.value, null, 'obsolete proof must not validate changed steps')
await resolvedView.run()
assert.equal(resolvedView.verification.value.valid, true)
resolvedView.baseURL.value = 'https://other.example'; resolvedView.reset()
assert.equal(resolvedView.result.value, null)
assert.equal(resolvedView.verification.value, null, 'editing completed query must clear the success badge and proof transfer')
resolvedView.sendToVerifier()
console.log('Resolve input changes discard pending and completed verification results.')
