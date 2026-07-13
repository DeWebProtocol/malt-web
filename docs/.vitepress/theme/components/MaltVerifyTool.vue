<script setup>
import { computed, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import {
  defaultGatewayURL,
  diagnoseReadRemotely,
  diagnoseResolveRemotely,
  readProfile,
  resolveProfile
} from '../malt-client.mjs'
import { verifyReadLocally, verifyResolveLocally } from '../malt-verifier.mjs'

const baseURL = ref(defaultGatewayURL)
const contract = ref('resolve')
const requestInput = ref('')
const resultInput = ref('')
const busy = ref(false)
const error = ref('')
const verification = ref(null)
const diagnostic = ref(null)
const activeProfile = computed(() => (contract.value === 'read' ? readProfile : resolveProfile))

onMounted(() => {
  const raw = window.sessionStorage.getItem('malt-verification-input')
  if (!raw) return
  try {
    const stored = JSON.parse(raw)
    const value = stored.verification ?? stored
    if (!value?.request || !value?.result) return
    contract.value = value.request.profile === readProfile ? 'read' : 'resolve'
    requestInput.value = JSON.stringify(value.request, null, 2)
    resultInput.value = JSON.stringify(value.result, null, 2)
  } catch {
    window.sessionStorage.removeItem('malt-verification-input')
  }
})

function verificationValue() {
  return {
    request: JSON.parse(requestInput.value),
    result: JSON.parse(resultInput.value)
  }
}

async function runVerify() {
  error.value = ''
  verification.value = null
  diagnostic.value = null
  busy.value = true
  try {
    const value = verificationValue()
    verification.value =
      contract.value === 'read'
        ? await verifyReadLocally({
            ...value,
            runtimeURL: withBase('/verifier/wasm_exec.js'),
            wasmURL: withBase('/verifier/malt-verifier.wasm')
          })
        : await verifyResolveLocally({
            ...value,
            runtimeURL: withBase('/verifier/wasm_exec.js'),
            wasmURL: withBase('/verifier/malt-verifier.wasm')
          })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function runGatewayDiagnostic() {
  error.value = ''
  diagnostic.value = null
  busy.value = true
  try {
    const value = verificationValue()
    diagnostic.value =
      contract.value === 'read'
        ? await diagnoseReadRemotely({ baseURL: baseURL.value, ...value })
        : await diagnoseResolveRemotely({ baseURL: baseURL.value, ...value })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="malt-tool" aria-labelledby="malt-verify-heading">
    <div class="malt-tool__head">
      <div>
        <p class="malt-tool__eyebrow">Resolve / Read</p>
        <h2 id="malt-verify-heading">Verify</h2>
      </div>
      <span class="malt-tool__status" :class="{ 'is-valid': verification?.valid }">
        {{ verification ? (verification.valid ? 'locally valid' : 'not verified') : 'idle' }}
      </span>
    </div>

    <div class="malt-tool__grid is-single">
      <label>
        <span>Contract</span>
        <select v-model="contract">
          <option value="resolve">resolve</option>
          <option value="read">read</option>
        </select>
      </label>
      <label>
        <span>Caller-selected request JSON</span>
        <textarea v-model="requestInput" spellcheck="false" rows="8" />
      </label>
      <label>
        <span>Untrusted result JSON</span>
        <textarea v-model="resultInput" spellcheck="false" rows="14" />
      </label>
      <label>
        <span>Gateway URL (diagnostic only)</span>
        <input v-model="baseURL" autocomplete="off" spellcheck="false" />
      </label>
    </div>

    <div class="malt-tool__actions">
      <button type="button" :disabled="busy || !requestInput.trim() || !resultInput.trim()" @click="runVerify">
        Verify locally
      </button>
      <button type="button" :disabled="busy || !requestInput.trim() || !resultInput.trim()" @click="runGatewayDiagnostic">
        Run gateway diagnostic
      </button>
    </div>

    <p class="malt-tool__note">
      The request is the caller-selected trust input. The local WebAssembly verifier is the trust
      decision; gateway verification is a diagnostic comparison only.
    </p>

    <p v-if="error" class="malt-tool__error">{{ error }}</p>

    <div v-if="verification" class="malt-tool__result">
      <dl>
        <div>
          <dt>Provider</dt>
          <dd>local WebAssembly ({{ activeProfile }})</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>{{ verification.valid ? 'valid: true' : `valid: false (${verification.error || 'rejected'})` }}</dd>
        </div>
      </dl>
    </div>

    <div v-if="diagnostic" class="malt-tool__result">
      <dl>
        <div>
          <dt>Gateway diagnostic</dt>
          <dd>{{ diagnostic.endpoint }}</dd>
        </div>
        <div>
          <dt>Diagnostic result</dt>
          <dd>{{ diagnostic.valid ? 'valid: true' : 'valid: false' }} (not a trust decision)</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
