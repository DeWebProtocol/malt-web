<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { defaultGatewayURL, resolvePath } from '../malt-client.mjs'
import { verifyResolveLocally } from '../malt-verifier.mjs'

const baseURL = ref(defaultGatewayURL)
const root = ref('')
const path = ref('')
const busy = ref(false)
const error = ref('')
const result = ref(null)
const verification = ref(null)

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
  result.value?.proofList ? JSON.stringify(result.value.proofList, null, 2) : ''
)

async function run() {
  error.value = ''
  result.value = null
  verification.value = null
  if (!root.value.trim()) {
    error.value = 'root is required'
    return
  }
  busy.value = true
  try {
    const payload = await resolvePath({
      baseURL: baseURL.value,
      root: root.value,
      path: path.value
    })
    if (!payload.proofList) {
      throw new Error('response did not include ProofList material')
    }
		const proofVerification = await verifyResolveLocally({
			request: payload.request,
			result: payload.result,
			runtimeURL: withBase('/verifier/wasm_exec.js'),
			wasmURL: withBase('/verifier/malt-verifier.wasm')
		})
    if (!proofVerification.valid) {
      verification.value = proofVerification
      throw new Error(proofVerification.error || 'local proof verification failed')
    }
    verification.value = proofVerification
    result.value = payload
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

function sendToVerifier() {
  if (!proofText.value || typeof window === 'undefined') {
    return
  }
	window.sessionStorage.setItem(
		'malt-verification-input',
		JSON.stringify({
      verification: {
        request: result.value?.request,
        result: result.value?.result
      }
    })
  )
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
        <input v-model="baseURL" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>Root</span>
        <input v-model="root" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>Path</span>
        <input v-model="path" autocomplete="off" spellcheck="false" placeholder="@payload" />
      </label>
    </div>

    <div class="malt-tool__actions">
      <button type="button" :disabled="busy" @click="run">Resolve and verify</button>
      <button type="button" :disabled="!proofText" @click="sendToVerifier">Verify page</button>
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
        <div v-if="result.response?.target">
          <dt>Target</dt>
          <dd>{{ result.response.target }}</dd>
        </div>
        <div v-if="verification">
          <dt>Local verification</dt>
          <dd>
            {{ verification.valid ? 'valid: proof verified locally' : `valid: false (${verification.error || 'rejected'})` }}
          </dd>
        </div>
      </dl>

      <div class="malt-tool__panel">
        <h3>ProofList</h3>
        <pre>{{ proofText }}</pre>
      </div>
    </div>
  </section>
</template>
