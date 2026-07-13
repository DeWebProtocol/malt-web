<script setup>
import { onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import {
  artifactProfile,
  defaultGatewayURL,
  diagnoseProofListRemotely,
  extractArtifactInput
} from '../malt-client.mjs'
import { verifyArtifactLocally } from '../malt-verifier.mjs'

const baseURL = ref(defaultGatewayURL)
const trustedRoot = ref('')
const expectedQuery = ref('{"kind":"path","segments":[]}')
const expectedTarget = ref('')
const proofInput = ref('')
const busy = ref(false)
const error = ref('')
const verification = ref(null)
const diagnostic = ref(null)

onMounted(() => {
  const verificationInput = window.sessionStorage.getItem('malt-verification-input')
  if (verificationInput) {
    try {
      const stored = JSON.parse(verificationInput)
      proofInput.value = JSON.stringify(stored.artifact, null, 2)
      trustedRoot.value = String(stored.trustedRoot || '')
      expectedQuery.value = JSON.stringify(stored.expectedQuery || { kind: 'path', segments: [] })
      expectedTarget.value = String(stored.expectedTarget || '')
      return
    } catch {
      window.sessionStorage.removeItem('malt-verification-input')
    }
  }
  const stored = window.sessionStorage.getItem('malt-prooflist')
  if (stored) {
    proofInput.value = stored
  }
})

async function runVerify() {
  error.value = ''
  verification.value = null
  diagnostic.value = null
  busy.value = true
  try {
    const artifact = extractArtifactInput(proofInput.value)
    const query = JSON.parse(expectedQuery.value)
    verification.value = await verifyArtifactLocally({
      artifact,
      expectedRoot: trustedRoot.value,
      expectedQuery: query,
      expectedTarget: expectedTarget.value,
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
    const artifact = extractArtifactInput(proofInput.value)
    diagnostic.value = await diagnoseProofListRemotely({ baseURL: baseURL.value, artifact })
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
        {{ verification ? (verification.valid ? 'locally valid' : 'not verified') : 'idle' }}
      </span>
    </div>

    <div class="malt-tool__grid is-single">
      <label>
        <span>Trusted root</span>
        <input v-model="trustedRoot" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>Expected query JSON</span>
        <input v-model="expectedQuery" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>Expected target (optional)</span>
        <input v-model="expectedTarget" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>Gateway URL (diagnostic only)</span>
        <input v-model="baseURL" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>Artifact or ProofList JSON</span>
        <textarea v-model="proofInput" spellcheck="false" rows="14" />
      </label>
    </div>

    <div class="malt-tool__actions">
      <button type="button" :disabled="busy || !proofInput.trim() || !trustedRoot.trim()" @click="runVerify">
        Verify locally
      </button>
      <button type="button" :disabled="busy || !proofInput.trim()" @click="runGatewayDiagnostic">
        Run gateway diagnostic
      </button>
    </div>

    <p class="malt-tool__note">
      The local WebAssembly verifier is the trust decision. Gateway verification is a diagnostic
      comparison only.
    </p>

    <p v-if="error" class="malt-tool__error">{{ error }}</p>

    <div v-if="verification" class="malt-tool__result">
      <dl>
        <div>
          <dt>Provider</dt>
          <dd>local WebAssembly ({{ artifactProfile }})</dd>
        </div>
        <div>
          <dt>Trusted root</dt>
          <dd>{{ trustedRoot }}</dd>
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
