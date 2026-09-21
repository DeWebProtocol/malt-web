<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { defaultGatewayURL, resolvePath } from '../malt-client.mjs'
import { verifyAuthenticationLocally } from '@dewebprotocol/malt/verifier'

const baseURL = ref(defaultGatewayURL)
const root = ref('')
const stepsInput = ref('[]')
const busy = ref(false)
const error = ref('')
const result = ref(null)
const verification = ref(null)
let operation = 0

function reset() {
  operation++
  error.value = ''
  result.value = null
  verification.value = null
}

const verificationLabel = computed(() => {
  if (!verification.value) {
    return 'idle'
  }
  if (!verification.value.valid) {
    return 'invalid'
  }
  return 'proof verified'
})

const proofText = computed(() =>
  result.value?.result ? JSON.stringify(result.value.result, null, 2) : ''
)

async function run() {
  if (busy.value) return
  reset()
  const current = operation
  if (!root.value.trim()) {
    error.value = 'root is required'
    return
  }
  busy.value = true
  try {
    const payload = await resolvePath({
      baseURL: baseURL.value,
      root: root.value,
      steps: JSON.parse(stepsInput.value)
    })
    if (operation !== current) return
		const proofVerification = await verifyAuthenticationLocally({
			request: payload.request,
			result: payload.result,
			runtimeURL: withBase('/verifier/wasm_exec.js'),
			wasmURL: withBase('/verifier/malt-verifier.wasm')
		})
    if (operation !== current) return
    if (!proofVerification.valid) {
      verification.value = proofVerification
      throw new Error(proofVerification.error || 'local proof verification failed')
    }
    verification.value = proofVerification
    result.value = payload
  } catch (err) {
    if (operation === current) error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

function sendToVerifier() {
  if (busy.value || !verification.value?.valid || !proofText.value || typeof window === 'undefined') {
    return
  }
 window.sessionStorage.setItem('malt-authentication-input', JSON.stringify({ node: {
  request: result.value.request, result: result.value.result
 } }))
  window.location.href = withBase('/tools/verify')
}
</script>

<template>
  <section class="malt-tool" aria-labelledby="malt-resolve-heading">
    <div class="malt-tool__head">
      <div>
        <p class="malt-tool__eyebrow">MALT Gateway</p>
        <h2 id="malt-resolve-heading">Resolve</h2>
      </div>
      <span class="malt-tool__status" :class="{ 'is-valid': verification?.valid }">
        {{ verificationLabel }}
      </span>
    </div>

    <div class="malt-tool__grid">
      <label>
        <span>Gateway URL</span>
        <input v-model="baseURL" :disabled="busy" @input="reset" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>Root</span>
        <input v-model="root" :disabled="busy" @input="reset" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>Typed path steps (JSON)</span>
        <textarea v-model="stepsInput" :disabled="busy" @input="reset" rows="4" spellcheck="false" />
      </label>
    </div>

    <div class="malt-tool__actions">
      <button type="button" :disabled="busy" @click="run">Resolve and verify</button>
      <button type="button" :disabled="busy || !verification?.valid || !proofText" @click="sendToVerifier">Verify page</button>
    </div>

    <p v-if="error" class="malt-tool__error">{{ error }}</p>

    <div v-if="result" class="malt-tool__result">
      <dl>
        <div>
          <dt>Endpoint</dt>
          <dd>{{ result.endpoint }}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{{ result.status }}</dd>
        </div>
        <div v-if="result.result?.resolved">
          <dt>Target</dt>
          <dd>{{ result.result.resolved }}</dd>
        </div>
        <div v-if="verification">
          <dt>Local verification</dt>
          <dd>
            {{ verification.valid ? 'valid: proof verified locally' : `valid: false (${verification.error || 'rejected'})` }}
          </dd>
        </div>
      </dl>

      <div class="malt-tool__panel">
        <h3>Authentication result</h3>
        <pre>{{ proofText }}</pre>
      </div>
    </div>
  </section>
</template>
