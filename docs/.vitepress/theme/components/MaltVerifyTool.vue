<script setup>
import { onMounted, ref } from 'vue'
import { defaultDaemonURL, extractProofListInput, verifyProofList } from '../malt-client.mjs'

const baseURL = ref(defaultDaemonURL)
const proofInput = ref('')
const busy = ref(false)
const error = ref('')
const verification = ref(null)

onMounted(() => {
  const stored = window.sessionStorage.getItem('malt-prooflist')
  if (stored) {
    proofInput.value = stored
  }
})

async function runVerify() {
  error.value = ''
  verification.value = null
  busy.value = true
  try {
    const proofList = extractProofListInput(proofInput.value)
    verification.value = await verifyProofList({ baseURL: baseURL.value, proofList })
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
        <p class="malt-tool__eyebrow">ProofList</p>
        <h2 id="malt-verify-heading">Verify</h2>
      </div>
      <span class="malt-tool__status" :class="{ 'is-valid': verification?.valid }">
        {{ verification ? (verification.valid ? 'valid' : 'invalid') : 'idle' }}
      </span>
    </div>

    <div class="malt-tool__grid is-single">
      <label>
        <span>Daemon URL</span>
        <input v-model="baseURL" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>ProofList JSON</span>
        <textarea v-model="proofInput" spellcheck="false" rows="14" />
      </label>
    </div>

    <div class="malt-tool__actions">
      <button type="button" :disabled="busy || !proofInput.trim()" @click="runVerify">Verify</button>
    </div>

    <p v-if="error" class="malt-tool__error">{{ error }}</p>

    <div v-if="verification" class="malt-tool__result">
      <dl>
        <div>
          <dt>Endpoint</dt>
          <dd>{{ verification.endpoint }}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{{ verification.status }}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>{{ verification.valid ? 'valid: true' : 'valid: false' }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
