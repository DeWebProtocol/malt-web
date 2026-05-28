<script setup>
import { computed, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import {
  activeProfileStorageKey,
  defaultDaemonURL,
  joinMaltPath,
  normalizeUploadPath,
  pathBasename,
  profileStorageKey,
  readContentBlob,
  readDirectory,
  statPath,
  uploadPathForFile,
  uploadUnixFSFile,
  verifyProofList
} from '../malt-client.mjs'

const baseURL = ref(defaultDaemonURL)
const profileInput = ref('')
const activeProfile = ref('')
const root = ref('')
const currentPath = ref('')
const prefix = ref('')
const files = ref([])
const entries = ref([])
const busy = ref(false)
const error = ref('')
const uploadResult = ref(null)
const preview = ref(null)
const proofView = ref(null)
const verifiedPaths = ref({})

const signedIn = computed(() => activeProfile.value !== '')
const currentLabel = computed(() => (currentPath.value ? `/${currentPath.value}` : '/'))
const currentDirectoryVerified = computed(() => verificationState(currentPath.value) === true)
const proofText = computed(() =>
  proofView.value?.proofList ? JSON.stringify(proofView.value.proofList, null, 2) : ''
)

const breadcrumbs = computed(() => {
  const crumbs = [{ label: 'root', path: '' }]
  const segments = currentPath.value ? currentPath.value.split('/').filter(Boolean) : []
  let cursor = ''
  for (const segment of segments) {
    cursor = joinMaltPath(cursor, segment)
    crumbs.push({ label: segment, path: cursor })
  }
  return crumbs
})

const uploadText = computed(() => {
  if (!uploadResult.value) {
    return ''
  }
  return uploadResult.value.files
    .map((item, index) => `${index + 1}. ${item.path} -> ${item.newRoot}`)
    .join('\n')
})

onMounted(() => {
  const stored = window.localStorage.getItem(activeProfileStorageKey())
  if (stored) {
    profileInput.value = stored
    signIn()
  }
})

function signIn() {
  const name = profileInput.value.trim()
  if (!name) {
    error.value = 'profile name is required'
    return
  }

  activeProfile.value = name
  window.localStorage.setItem(activeProfileStorageKey(), name)
  const saved = loadStoredProfile(name)
  baseURL.value = saved.baseURL || baseURL.value || defaultDaemonURL
  root.value = saved.root || ''
  currentPath.value = saved.currentPath || ''
  verifiedPaths.value = saved.verifiedPaths || {}
  error.value = ''
  uploadResult.value = null
  preview.value = null
  proofView.value = null
  entries.value = []
  if (root.value) {
    void loadRoot(currentPath.value)
  }
}

function signOut() {
  persistProfile()
  activeProfile.value = ''
  profileInput.value = ''
  root.value = ''
  currentPath.value = ''
  entries.value = []
  files.value = []
  uploadResult.value = null
  clearPreview()
  proofView.value = null
}

function loadStoredProfile(name) {
  try {
    return JSON.parse(window.localStorage.getItem(profileStorageKey(name)) || '{}')
  } catch {
    return {}
  }
}

function persistProfile() {
  if (!activeProfile.value || typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(
    profileStorageKey(activeProfile.value),
    JSON.stringify({
      baseURL: baseURL.value,
      root: root.value,
      currentPath: currentPath.value,
      verifiedPaths: verifiedPaths.value
    })
  )
}

async function loadRoot(nextPath = '') {
  if (!root.value.trim()) {
    error.value = 'root is required'
    return
  }
  currentPath.value = normalizeOptionalPath(nextPath)
  await refreshDirectory()
}

async function refreshDirectory() {
  error.value = ''
  clearPreview()
  proofView.value = null
  busy.value = true
  try {
    const manifest = await readDirectory({
      baseURL: baseURL.value,
      root: root.value,
      path: currentPath.value
    })
    if (manifest.proofList) {
      await verifyAndMark(currentPath.value, manifest.proofList)
    }
    entries.value = await Promise.all(
      manifest.entries.map(async (name) => {
        const childPath = joinMaltPath(currentPath.value, name)
        try {
          const stat = await statPath({ baseURL: baseURL.value, root: root.value, path: childPath })
          return {
            name,
            path: childPath,
            kind: stat.kind || 'unknown',
            storageKind: stat.storageKind,
            size: stat.size,
            error: ''
          }
        } catch (err) {
          return {
            name,
            path: childPath,
            kind: 'unknown',
            storageKind: '',
            size: null,
            error: err instanceof Error ? err.message : String(err)
          }
        }
      })
    )
    persistProfile()
  } catch (err) {
    entries.value = []
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

function selectFiles(event) {
  files.value = Array.from(event.target.files || [])
  uploadResult.value = null
  error.value = ''
}

function targetPath(file) {
  const rel = uploadPathForFile(file)
  const cleanPrefix = prefix.value.trim() ? normalizeUploadPath(prefix.value) : ''
  return joinMaltPath(currentPath.value, joinMaltPath(cleanPrefix, rel))
}

async function uploadSelected() {
  error.value = ''
  uploadResult.value = null
  proofView.value = null
  clearPreview()
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
    verifiedPaths.value = {}
    uploadResult.value = {
      newRoot: currentRoot,
      files: writes
    }
    persistProfile()
    await refreshDirectory()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function openDirectory(entry) {
  if (entry.kind !== 'dir') {
    return
  }
  await loadRoot(entry.path)
}

async function previewFile(entry) {
  if (entry.kind !== 'file') {
    return
  }
  error.value = ''
  proofView.value = null
  clearPreview()
  busy.value = true
  try {
    const payload = await readContentBlob({
      baseURL: baseURL.value,
      root: root.value,
      path: entry.path
    })
    if (payload.proofList) {
      await verifyAndMark(entry.path, payload.proofList)
    }
    const blob = payload.blob
    const contentType = payload.contentType || blob.type || ''
    if (isImagePreview(entry.name, contentType)) {
      preview.value = {
        path: entry.path,
        name: entry.name,
        kind: 'image',
        contentType,
        size: blob.size,
        url: URL.createObjectURL(blob)
      }
      return
    }
    if (isTextPreview(entry.name, contentType, blob.size)) {
      preview.value = {
        path: entry.path,
        name: entry.name,
        kind: 'text',
        contentType,
        size: blob.size,
        body: await blob.text()
      }
      return
    }
    preview.value = {
      path: entry.path,
      name: entry.name,
      kind: 'binary',
      contentType,
      size: blob.size
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function downloadFile(entry) {
  if (entry.kind !== 'file' || typeof window === 'undefined') {
    return
  }
  error.value = ''
  busy.value = true
  try {
    const payload = await readContentBlob({
      baseURL: baseURL.value,
      root: root.value,
      path: entry.path
    })
    if (payload.proofList) {
      await verifyAndMark(entry.path, payload.proofList)
    }
    const url = URL.createObjectURL(payload.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = entry.name || pathBasename(entry.path) || 'malt-download'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function showProof(target) {
  error.value = ''
  proofView.value = null
  busy.value = true
  try {
    const path = target?.path ?? currentPath.value
    const kind = target?.kind ?? 'dir'
    const payload =
      kind === 'dir'
        ? await readDirectory({ baseURL: baseURL.value, root: root.value, path })
        : await readContentBlob({ baseURL: baseURL.value, root: root.value, path })
    if (!payload.proofList) {
      throw new Error('response did not include ProofList material')
    }
    const verification = await verifyAndMark(path, payload.proofList)
    proofView.value = {
      path,
      kind,
      proofList: payload.proofList,
      verification
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function verifyAndMark(path, proofList) {
  const verification = await verifyProofList({
    baseURL: baseURL.value,
    proofList
  })
  markVerification(path, verification.valid)
  return verification
}

function markVerification(path, valid) {
  verifiedPaths.value = {
    ...verifiedPaths.value,
    [verificationKey(root.value, path)]: Boolean(valid)
  }
  persistProfile()
}

function verificationState(path) {
  const key = verificationKey(root.value, path)
  if (!(key in verifiedPaths.value)) {
    return null
  }
  return verifiedPaths.value[key]
}

function verificationKey(rootValue, path) {
  return `${rootValue || ''}\n${normalizeOptionalPath(path)}`
}

function clearPreview() {
  if (preview.value?.url) {
    URL.revokeObjectURL(preview.value.url)
  }
  preview.value = null
}

function sendToVerifier() {
  if (!proofText.value || typeof window === 'undefined') {
    return
  }
  window.sessionStorage.setItem('malt-prooflist', proofText.value)
  window.location.href = withBase('/tools/verify')
}

function normalizeOptionalPath(path) {
  return String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
}

function isTextPreview(name, contentType, size) {
  if (size > 512 * 1024) {
    return false
  }
  if (contentType.startsWith('text/') || contentType.includes('json')) {
    return true
  }
  return /\.(txt|md|json|js|ts|tsx|jsx|go|rs|py|css|html|xml|yaml|yml|toml|sh)$/i.test(name)
}

function isImagePreview(name, contentType) {
  return contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
}

function formatSize(size) {
  if (size == null) {
    return ''
  }
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <section class="malt-tool malt-app" aria-labelledby="malt-app-heading">
    <div class="malt-tool__head">
      <div>
        <p class="malt-tool__eyebrow">Local daemon</p>
        <h2 id="malt-app-heading">{{ signedIn ? activeProfile : 'Sign in' }}</h2>
      </div>
      <span class="malt-tool__status" :class="{ 'is-valid': currentDirectoryVerified }">
        {{ busy ? 'working' : currentDirectoryVerified ? 'verified' : signedIn ? 'ready' : 'signed out' }}
      </span>
    </div>

    <form v-if="!signedIn" class="malt-app__login" @submit.prevent="signIn">
      <label>
        <span>Profile</span>
        <input v-model="profileInput" autocomplete="username" spellcheck="false" />
      </label>
      <label>
        <span>Daemon URL</span>
        <input v-model="baseURL" autocomplete="off" spellcheck="false" />
      </label>
      <div class="malt-tool__actions">
        <button type="submit">Sign in</button>
      </div>
    </form>

    <template v-else>
      <div class="malt-tool__grid">
        <label>
          <span>Daemon URL</span>
          <input v-model="baseURL" autocomplete="off" spellcheck="false" @change="persistProfile" />
        </label>
        <label>
          <span>Root</span>
          <input v-model="root" autocomplete="off" spellcheck="false" @change="persistProfile" />
        </label>
        <label>
          <span>Upload prefix</span>
          <input v-model="prefix" autocomplete="off" spellcheck="false" />
        </label>
        <div class="malt-tool__meta">{{ currentLabel }}</div>
        <label>
          <span>Files</span>
          <input type="file" multiple @change="selectFiles" />
        </label>
        <label>
          <span>Folder</span>
          <input type="file" multiple webkitdirectory directory @change="selectFiles" />
        </label>
      </div>

      <div class="malt-tool__actions">
        <button type="button" :disabled="busy" @click="loadRoot(currentPath)">Load root</button>
        <button type="button" :disabled="busy || files.length === 0" @click="uploadSelected">
          Upload
        </button>
        <button type="button" :disabled="busy || !root" @click="showProof({ path: currentPath, kind: 'dir' })">
          Current proof
        </button>
        <button type="button" :disabled="busy" @click="signOut">Sign out</button>
      </div>

      <p v-if="error" class="malt-tool__error">{{ error }}</p>

      <nav class="malt-app__breadcrumb" aria-label="breadcrumb">
        <button
          v-for="crumb in breadcrumbs"
          :key="crumb.path"
          type="button"
          :disabled="busy || crumb.path === currentPath"
          @click="loadRoot(crumb.path)"
        >
          {{ crumb.label }}
        </button>
      </nav>

      <div class="malt-app__browser">
        <div class="malt-app__browser-head">
          <span>Name</span>
          <span>Type</span>
          <span>Size</span>
          <span>Proof</span>
          <span>Actions</span>
        </div>
        <div v-if="entries.length === 0" class="malt-app__empty">
          {{ root ? 'No entries' : 'Set a root or upload files' }}
        </div>
        <div v-for="entry in entries" :key="entry.path" class="malt-app__row">
          <button
            type="button"
            class="malt-app__name"
            :disabled="busy || entry.kind === 'unknown'"
            @click="entry.kind === 'dir' ? openDirectory(entry) : previewFile(entry)"
          >
            <span
              class="verified-dot"
              :class="{ 'is-valid': verificationState(entry.path) === true, 'is-invalid': verificationState(entry.path) === false }"
            ></span>
            <span>{{ entry.name }}</span>
          </button>
          <span>{{ entry.kind }}</span>
          <span>{{ formatSize(entry.size) }}</span>
          <button type="button" :disabled="busy || entry.kind === 'unknown'" @click="showProof(entry)">
            Proof
          </button>
          <span class="malt-app__row-actions">
            <button v-if="entry.kind === 'dir'" type="button" :disabled="busy" @click="openDirectory(entry)">
              Open
            </button>
            <button v-if="entry.kind === 'file'" type="button" :disabled="busy" @click="previewFile(entry)">
              Preview
            </button>
            <button v-if="entry.kind === 'file'" type="button" :disabled="busy" @click="downloadFile(entry)">
              Download
            </button>
          </span>
        </div>
      </div>

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

      <div v-if="preview" class="malt-tool__panel">
        <h3>Preview: {{ preview.path }}</h3>
        <img v-if="preview.kind === 'image'" class="malt-app__image" :src="preview.url" :alt="preview.name" />
        <pre v-else-if="preview.kind === 'text'">{{ preview.body }}</pre>
        <p v-else class="malt-app__empty">
          Binary preview is not available. Use Download.
        </p>
      </div>

      <div v-if="proofView" class="malt-tool__result">
        <dl>
          <div>
            <dt>Path</dt>
            <dd>{{ proofView.path || '/' }}</dd>
          </div>
          <div>
            <dt>Verify</dt>
            <dd>{{ proofView.verification?.valid ? 'valid: true' : 'valid: false' }}</dd>
          </div>
        </dl>
        <div class="malt-tool__actions">
          <button type="button" :disabled="!proofText" @click="sendToVerifier">Verify page</button>
        </div>
        <div class="malt-tool__panel">
          <h3>ProofList</h3>
          <pre>{{ proofText }}</pre>
        </div>
      </div>
    </template>
  </section>
</template>
