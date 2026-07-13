<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import {
  defaultGatewayURL,
  readContent,
  resolveArtifactFromProofList,
  resolvePath,
  resolvePathQuery
} from '../malt-client.mjs'
import { verifyArtifactLocally } from '../malt-verifier.mjs'

const baseURL = ref(defaultGatewayURL)
const root = ref('')
const path = ref('')
const range = ref('')
const mode = ref('resolve')
const busy = ref(false)
const error = ref('')
const result = ref(null)
const verification = ref(null)

const proofText = computed(() =>
  result.value?.proofList ? JSON.stringify(result.value.proofList, null, 2) : ''
)

async function run(nextMode) {
  mode.value = nextMode
  error.value = ''
  result.value = null
  verification.value = null
  if (!root.value.trim()) {
    error.value = 'root is required'
    return
  }
  busy.value = true
  try {
    const payload =
      nextMode === 'content'
        ? await readContent({
            baseURL: baseURL.value,
            root: root.value,
            path: path.value,
            range: range.value
          })
        : await resolvePath({ baseURL: baseURL.value, root: root.value, path: path.value })
    result.value = payload
    if (!payload.proofList) {
      throw new Error('response did not include ProofList material')
    }
    verification.value = await verifyArtifactLocally({
      artifact:
        payload.artifact ??
        resolveArtifactFromProofList({
          proofList: payload.proofList,
          root: root.value,
          path: path.value
        }),
      expectedRoot: root.value.trim(),
      expectedOperation: 'resolve',
      expectedQuery: resolvePathQuery(path.value),
      runtimeURL: withBase('/verifier/wasm_exec.js'),
      wasmURL: withBase('/verifier/malt-verifier.wasm')
    })
    if (!verification.value.valid) {
      throw new Error(verification.value.error || 'local proof verification failed')
    }
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
  const artifact =
    result.value?.artifact ??
    resolveArtifactFromProofList({
      proofList: result.value?.proofList,
      root: root.value,
      path: path.value
    })
  window.sessionStorage.setItem(
    'malt-verification-input',
    JSON.stringify({
      artifact,
      trustedRoot: root.value.trim(),
      expectedOperation: 'resolve',
      expectedQuery: resolvePathQuery(path.value)
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
        {{ verification ? (verification.valid ? 'verified' : 'invalid') : 'idle' }}
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
      <label>
        <span>Range</span>
        <input v-model="range" autocomplete="off" spellcheck="false" placeholder="bytes=0-1023" />
      </label>
    </div>

    <div class="malt-tool__actions">
      <button type="button" :disabled="busy" @click="run('resolve')">Resolve</button>
      <button type="button" :disabled="busy" @click="run('content')">Read content</button>
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
        <div v-if="result.contentRange">
          <dt>Content-Range</dt>
          <dd>{{ result.contentRange }}</dd>
        </div>
        <div v-if="verification">
          <dt>Local proof verification</dt>
          <dd>{{ verification.valid ? 'valid: true' : `valid: false (${verification.error || 'rejected'})` }}</dd>
        </div>
      </dl>

      <div v-if="mode === 'content'" class="malt-tool__panel">
        <h3>Content</h3>
        <pre>{{ result.body }}</pre>
      </div>

      <div class="malt-tool__panel">
        <h3>ProofList</h3>
        <pre>{{ proofText }}</pre>
      </div>
    </div>
  </section>
</template>
