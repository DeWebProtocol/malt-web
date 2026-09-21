<script setup>
import { onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import { verifyAuthenticationLocally } from '@dewebprotocol/malt/verifier'
import { verificationPairs } from '../verification-input.mjs'

const requestInput = ref(''), resultInput = ref(''), busy = ref(false), error = ref('')
const verification = ref(null), imported = ref([]), selected = ref(0), confirmed = ref(false)
let operation = 0
function selectPair() {
  const pair = imported.value[Number(selected.value)]
  requestInput.value = JSON.stringify(pair.request, null, 2)
  resultInput.value = JSON.stringify(pair.result, null, 2)
  reset()
}
function reset() { operation++; confirmed.value = false; verification.value = null }
function load(pairs) { imported.value = pairs; selected.value = 0; selectPair() }
onMounted(() => {
  const stored = window.sessionStorage.getItem('malt-authentication-input')
  window.sessionStorage.removeItem('malt-authentication-input')
  try { if (stored) load(verificationPairs(JSON.parse(stored))) } catch (err) { error.value = String(err) }
})
async function importProof(event) {
  if (busy.value) return
  const file = event.target.files?.[0]
  if (!file) return
  busy.value = true; error.value = ''; reset()
  const current = operation
  try {
    if (file.size > 96 * 1024 * 1024) throw new Error('proof file is too large')
    const pairs = verificationPairs(JSON.parse(await file.text()))
    if (operation === current) load(pairs)
  } catch (err) {
    if (operation === current) error.value = err instanceof Error ? err.message : String(err)
  } finally { busy.value = false; event.target.value = '' }
}
async function runVerify() {
  if (busy.value || !confirmed.value) return
  const current = ++operation
  busy.value = true; error.value = ''; verification.value = null
  try {
    const checked = await verifyAuthenticationLocally({
      request: JSON.parse(requestInput.value), result: JSON.parse(resultInput.value),
      runtimeURL: withBase('/verifier/wasm_exec.js'), wasmURL: withBase('/verifier/malt-verifier.wasm')
    })
    if (operation === current) verification.value = checked
  } catch (err) {
    if (operation === current) error.value = err instanceof Error ? err.message : String(err)
  } finally { busy.value = false }
}

</script>

<template>
  <section class="malt-tool" aria-labelledby="malt-verify-heading">
    <div class="malt-tool__head">
      <div><p class="malt-tool__eyebrow">Typed authentication</p><h2 id="malt-verify-heading">Verify</h2></div>
      <span class="malt-tool__status" :class="{ 'is-valid': verification?.valid }">
        {{ verification ? (verification.valid ? 'selected query verified' : 'not verified') : 'idle' }}
      </span>
    </div>
    <div class="malt-tool__grid is-single">
      <label><span>Import Console proof JSON (read locally)</span><input type="file" accept=".json,application/json" :disabled="busy" @change="importProof" /></label>
      <label v-if="imported.length > 1"><span>Imported query</span>
        <select v-model="selected" :disabled="busy" @change="selectPair">
          <option v-for="(pair, i) in imported" :key="pair.name" :value="i">{{ pair.name }}</option>
        </select>
      </label>
      <label><span>Expected request JSON — confirm the root and query</span>
        <textarea v-model="requestInput" :disabled="busy" spellcheck="false" rows="10" @input="reset" />
      </label>
      <label><span>Untrusted authentication result JSON</span>
        <textarea v-model="resultInput" :disabled="busy" spellcheck="false" rows="14" @input="reset" />
      </label>
      <label><span><input v-model="confirmed" :disabled="busy" type="checkbox" /> I have checked that the request contains my intended root and query.</span></label>
    </div>
    <div class="malt-tool__actions">
      <button type="button" :disabled="busy || !confirmed || !requestInput.trim() || !resultInput.trim()" @click="runVerify">Verify locally</button>
    </div>
    <p class="malt-tool__note">Imported requests are untrusted. The local verifier checks only the selected query against the root you confirm. It does not establish freshness, verify other imported queries, or check downloaded payload bytes.</p>
    <p v-if="error" class="malt-tool__error">{{ error }}</p>
    <div v-if="verification" class="malt-tool__result">
      <p>{{ verification.valid ? 'The selected authentication query is valid.' : `Verification failed: ${verification.error || 'rejected'}` }}</p>
    </div>
  </section>
</template>
