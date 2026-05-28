<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import {
  defaultDaemonURL,
  normalizeUploadPath,
  readContent,
  resolvePath,
  uploadPathForFile,
  uploadUnixFSFile,
  verifyProofList
} from '../malt-client.mjs'

const baseURL = ref(defaultDaemonURL)
const root = ref('')
const path = ref('')
const range = ref('')
const prefix = ref('')
const files = ref([])
const busy = ref(false)
const mode = ref('resolve')
const error = ref('')
const uploadResult = ref(null)
const result = ref(null)
const verification = ref(null)

const proofText = computed(() =>
  result.value?.proofList ? JSON.stringify(result.value.proofList, null, 2) : ''
)

const uploadText = computed(() => {
  if (!uploadResult.value) {
    return ''
  }
  return uploadResult.value.files
    .map((item, index) => `${index + 1}. ${item.path} -> ${item.newRoot}`)
    .join('\n')
})

function selectFiles(event) {
  files.value = Array.from(event.target.files || [])
  uploadResult.value = null
  error.value = ''
}

function targetPath(file) {
  const rel = uploadPathForFile(file)
  if (!prefix.value.trim()) {
    return rel
  }
  return `${normalizeUploadPath(prefix.value)}/${rel}`
}

async function uploadSelected() {
  error.value = ''
  uploadResult.value = null
  result.value = null
  verification.value = null
  if (files.value.length === 0) {
    error.value = 'choose files first'
    return
  }

  busy.value = true
  try {
    let currentRoot = root.value.trim()
    const writes = []
    for (const file of files.value) {
      const writePath = targetPath(file)
      const write = await uploadUnixFSFile({
        baseURL: baseURL.value,
        root: currentRoot,
        path: writePath,
        file
      })
      if (!write.newRoot) {
        throw new Error('write response did not include a new root')
      }
      writes.push(write)
      currentRoot = write.newRoot
    }
    root.value = currentRoot
    if (!path.value.trim() && writes[0]) {
      path.value = writes[0].path
    }
    uploadResult.value = {
      newRoot: currentRoot,
      files: writes
    }
    await run('resolve')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

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
    verification.value = await verifyProofList({
      baseURL: baseURL.value,
      proofList: payload.proofList
    })
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
  window.sessionStorage.setItem('malt-prooflist', proofText.value)
  window.location.href = withBase('/tools/verify')
}
</script>

<template>
  <section class="malt-tool" aria-labelledby="malt-app-heading">
    <div class="malt-tool__head">
      <div>
        <p class="malt-tool__eyebrow">Local daemon</p>
        <h2 id="malt-app-heading">App</h2>
      </div>
      <span class="malt-tool__status" :class="{ 'is-valid': verification?.valid }">
        {{ busy ? 'working' : verification ? (verification.valid ? 'verified' : 'invalid') : 'idle' }}
      </span>
    </div>

    <div class="malt-tool__grid">
      <label>
        <span>Daemon URL</span>
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
      <label>
        <span>Upload prefix</span>
        <input v-model="prefix" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        <span>Files</span>
        <input type="file" multiple @change="selectFiles" />
      </label>
      <label>
        <span>Folder</span>
        <input type="file" multiple webkitdirectory directory @change="selectFiles" />
      </label>
      <div class="malt-tool__meta">{{ files.length }} selected</div>
    </div>

    <div class="malt-tool__actions">
      <button type="button" :disabled="busy || files.length === 0" @click="uploadSelected">
        Upload
      </button>
      <button type="button" :disabled="busy" @click="run('resolve')">Resolve</button>
      <button type="button" :disabled="busy" @click="run('content')">Read content</button>
      <button type="button" :disabled="!proofText" @click="sendToVerifier">Verify page</button>
    </div>

    <p v-if="error" class="malt-tool__error">{{ error }}</p>

    <div v-if="uploadResult" class="malt-tool__result">
      <dl>
        <div>
          <dt>New root</dt>
          <dd>{{ uploadResult.newRoot }}</dd>
        </div>
        <div>
          <dt>Uploaded</dt>
          <dd>{{ uploadResult.files.length }}</dd>
        </div>
      </dl>
      <div class="malt-tool__panel">
        <h3>Uploads</h3>
        <pre>{{ uploadText }}</pre>
      </div>
    </div>

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
          <dt>Verify</dt>
          <dd>{{ verification.valid ? 'valid: true' : 'valid: false' }}</dd>
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
