<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'
import {
  activeProfileStorageKey,
  defaultCASURL,
  defaultDaemonURL,
  joinMaltPath,
  normalizeUploadPath,
  pathBasename,
  profileStorageKey,
  readContentBlob,
  readDirectory,
  readDirectoryByPayload,
  statPath,
  uploadPathForFile,
  uploadUnixFSFile,
  verifyProofList
} from '../malt-client.mjs'

const baseURL = ref(defaultDaemonURL)
const casURL = ref(defaultCASURL)
const profileInput = ref('')
const activeProfile = ref('')
const root = ref('')
const currentPath = ref('')
const prefix = ref('')
const entries = ref([])
const busy = ref(false)
const error = ref('')
const uploadResult = ref(null)
const preview = ref(null)
const previewView = ref(false)
const proofView = ref(null)
const verifiedPaths = ref({})
const settingsOpen = ref(false)
const openMenuPath = ref('')
const dropActive = ref(false)
const dragDepth = ref(0)
const uploadStatus = ref('')
const entryNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const daemonRequestTimeoutMs = 120_000
const uploadRequestTimeoutMs = 600_000
let dragResetTimer = 0

const signedIn = computed(() => activeProfile.value !== '')
const currentLabel = computed(() => (currentPath.value ? `/${currentPath.value}` : '/'))
const currentDirectoryVerified = computed(() => verificationState(currentPath.value) === true)
const statusText = computed(() => {
  if (!signedIn.value) {
    return 'signed out'
  }
  if (busy.value) {
    return 'working'
  }
  if (currentDirectoryVerified.value) {
    return 'verified'
  }
  return root.value ? 'ready' : 'no root'
})
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
  document.body.classList.add('malt-app-page')
  window.addEventListener('dragenter', beginPageDrag)
  window.addEventListener('dragover', handlePageDragOver)
  window.addEventListener('dragleave', handlePageDragLeave)
  window.addEventListener('drop', handlePageDrop)
  window.addEventListener('dragend', cancelPageDrag)
  const stored = window.localStorage.getItem(activeProfileStorageKey())
  if (stored) {
    profileInput.value = stored
    signIn()
  }
})

onUnmounted(() => {
  document.body.classList.remove('malt-app-page')
  window.removeEventListener('dragenter', beginPageDrag)
  window.removeEventListener('dragover', handlePageDragOver)
  window.removeEventListener('dragleave', handlePageDragLeave)
  window.removeEventListener('drop', handlePageDrop)
  window.removeEventListener('dragend', cancelPageDrag)
  window.clearTimeout(dragResetTimer)
  clearPreview()
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
  casURL.value = saved.casURL || casURL.value || defaultCASURL
  root.value = saved.root || ''
  currentPath.value = root.value ? saved.currentPath || '' : ''
  prefix.value = saved.prefix || ''
  verifiedPaths.value = saved.verifiedPaths || {}
  settingsOpen.value = !root.value
  error.value = ''
  uploadResult.value = null
  preview.value = null
  previewView.value = false
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
  baseURL.value = defaultDaemonURL
  casURL.value = defaultCASURL
  root.value = ''
  currentPath.value = ''
  prefix.value = ''
  entries.value = []
  uploadResult.value = null
  settingsOpen.value = false
  openMenuPath.value = ''
  cancelPageDrag()
  uploadStatus.value = ''
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
      casURL: casURL.value,
      root: root.value,
      currentPath: currentPath.value,
      prefix: prefix.value,
      verifiedPaths: verifiedPaths.value
    })
  )
}

async function applySettings() {
  error.value = ''
  openMenuPath.value = ''
  if (!root.value.trim()) {
    currentPath.value = ''
    entries.value = []
    uploadResult.value = null
    clearPreview()
    proofView.value = null
    persistProfile()
    settingsOpen.value = false
    return
  }
  settingsOpen.value = false
  await loadRoot(currentPath.value)
}

async function loadRoot(nextPath = '', options = {}) {
  if (!root.value.trim()) {
    error.value = 'root is required'
    return
  }
  openMenuPath.value = ''
  currentPath.value = normalizeOptionalPath(nextPath)
  await refreshDirectory({ payload: options.payload })
}

async function refreshDirectory(options = {}) {
  error.value = ''
  clearPreview()
  proofView.value = null
  busy.value = true
  try {
    const directoryPayload = String(options.payload || '').trim()
    const manifest = await withDaemonTimeout('read directory', (signal) =>
      directoryPayload
        ? readDirectoryByPayload({
            baseURL: baseURL.value,
            payload: directoryPayload,
            signal
          })
        : readDirectory({
            baseURL: baseURL.value,
            root: root.value,
            path: currentPath.value,
            signal
          })
    )
    if (manifest.proofList) {
      await verifyAndMark(currentPath.value, manifest.proofList)
    }
    const loadedEntries = await Promise.all(
      manifest.entries.map(async (name) => {
        const childPath = joinMaltPath(currentPath.value, name)
        try {
          const stat = await withDaemonTimeout('stat path', (signal) =>
            statPath({ baseURL: baseURL.value, root: root.value, path: childPath, signal })
          )
          return {
            name,
            path: childPath,
            kind: stat.kind || 'unknown',
            storageKind: stat.storageKind,
            key: stat.key,
            payload: stat.payload,
            size: stat.size,
            error: ''
          }
        } catch (err) {
          return {
            name,
            path: childPath,
            kind: 'unknown',
            storageKind: '',
            key: '',
            payload: '',
            size: null,
            error: err instanceof Error ? err.message : String(err)
          }
        }
      })
    )
    entries.value = loadedEntries.sort(compareEntries)
    persistProfile()
  } catch (err) {
    entries.value = []
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

function beginPageDrag(event) {
  if (!isFileDrag(event)) {
    return
  }
  event.preventDefault()
  if (!canAcceptFileDrop()) {
    setDropEffect(event, 'none')
    return
  }
  dragDepth.value += 1
  showPageDropTarget(event)
}

function handlePageDragOver(event) {
  if (!isFileDrag(event)) {
    return
  }
  event.preventDefault()
  if (!canAcceptFileDrop()) {
    setDropEffect(event, 'none')
    return
  }
  showPageDropTarget(event)
}

function handlePageDragLeave(event) {
  if (!isFileDrag(event)) {
    return
  }
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (isOutsideViewport(event) || dragDepth.value === 0) {
    schedulePageDragReset()
  }
}

async function handlePageDrop(event) {
  if (!isFileDrag(event)) {
    return
  }
  event.preventDefault()
  cancelPageDrag()
  if (!signedIn.value) {
    error.value = 'sign in before uploading'
    return
  }
  await handleDrop(event)
}

function showPageDropTarget(event) {
  dropActive.value = true
  setDropEffect(event, 'copy')
  schedulePageDragReset()
}

function setDropEffect(event, effect) {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = effect
  }
}

function canAcceptFileDrop() {
  return signedIn.value && !busy.value
}

function schedulePageDragReset() {
  window.clearTimeout(dragResetTimer)
  dragResetTimer = window.setTimeout(() => {
    dragDepth.value = 0
    dropActive.value = false
  }, 160)
}

function cancelPageDrag() {
  window.clearTimeout(dragResetTimer)
  dragDepth.value = 0
  dropActive.value = false
}

function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files')
}

function isOutsideViewport(event) {
  return (
    event.clientX <= 0 ||
    event.clientY <= 0 ||
    event.clientX >= window.innerWidth ||
    event.clientY >= window.innerHeight
  )
}

async function handleDrop(event) {
  if (busy.value) {
    return
  }
  error.value = ''
  uploadResult.value = null
  uploadStatus.value = ''
  try {
    const uploadItems = await droppedUploadItems(event.dataTransfer)
    await uploadDropped(uploadItems)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function droppedUploadItems(dataTransfer) {
  if (!dataTransfer) {
    return []
  }
  const transferItems = Array.from(dataTransfer.items || [])
  const entriesFromItems = transferItems
    .map((item) =>
      typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
    )
    .filter(Boolean)

  if (entriesFromItems.length > 0) {
    const uploadItems = []
    for (const entry of entriesFromItems) {
      await collectDroppedEntry(entry, '', uploadItems)
    }
    return uploadItems
  }

  return Array.from(dataTransfer.files || []).map((file) => ({
    file,
    path: uploadPathForFile(file)
  }))
}

async function collectDroppedEntry(entry, basePath, uploadItems) {
  const entryPath = joinMaltPath(basePath, entry.name || '')
  if (entry.isFile) {
    const file = await readDroppedFile(entry)
    uploadItems.push({
      file,
      path: entryPath || uploadPathForFile(file)
    })
    return
  }

  if (!entry.isDirectory) {
    return
  }

  const reader = entry.createReader()
  const children = await readDroppedDirectoryEntries(reader)
  for (const child of children) {
    await collectDroppedEntry(child, entryPath, uploadItems)
  }
}

function readDroppedFile(entry) {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

async function readDroppedDirectoryEntries(reader) {
  const entries = []
  for (;;) {
    const batch = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (batch.length === 0) {
      return entries
    }
    entries.push(...batch)
  }
}

function targetUploadPath(rawPath) {
  const rel = normalizeUploadPath(rawPath)
  const cleanPrefix = prefix.value.trim() ? normalizeUploadPath(prefix.value) : ''
  return joinMaltPath(currentPath.value, joinMaltPath(cleanPrefix, rel))
}

async function uploadDropped(uploadItems) {
  error.value = ''
  uploadResult.value = null
  proofView.value = null
  clearPreview()
  openMenuPath.value = ''
  uploadStatus.value = ''
  if (uploadItems.length === 0) {
    error.value = 'drop files or folders first'
    return
  }

  busy.value = true
  try {
    let currentRoot = root.value.trim()
    const writes = []
    for (const [index, item] of uploadItems.entries()) {
      const writePath = targetUploadPath(item.path)
      uploadStatus.value = `Uploading ${index + 1}/${uploadItems.length}: ${writePath}`
      const write = await withDaemonTimeout(
        `upload ${writePath}`,
        (signal) =>
          uploadUnixFSFile({
            baseURL: baseURL.value,
            root: currentRoot,
            path: writePath,
            file: item.file,
            signal
          }),
        uploadRequestTimeoutMs
      )
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
    uploadStatus.value = `Uploaded ${writes.length} item${writes.length === 1 ? '' : 's'}`
    persistProfile()
    await refreshDirectory()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function openDirectory(entry) {
  openMenuPath.value = ''
  if (entry.kind !== 'dir') {
    return
  }
  await loadRoot(entry.path, { payload: entry.payload })
}

async function previewFile(entry) {
  openMenuPath.value = ''
  if (entry.kind !== 'file') {
    return
  }
  error.value = ''
  proofView.value = null
  clearPreview()
  busy.value = true
  try {
    const payload = await withDaemonTimeout('read file', (signal) =>
      readContentBlob({
        baseURL: baseURL.value,
        root: root.value,
        path: entry.path,
        signal
      })
    )
    if (payload.proofList) {
      const verification = await verifyAndMark(entry.path, payload.proofList)
      proofView.value = {
        path: entry.path,
        kind: 'file',
        proofList: payload.proofList,
        verification
      }
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
      previewView.value = true
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
      previewView.value = true
      return
    }
    preview.value = {
      path: entry.path,
      name: entry.name,
      kind: 'binary',
      contentType,
      size: blob.size
    }
    previewView.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function downloadFile(entry) {
  openMenuPath.value = ''
  if (entry.kind !== 'file' || typeof window === 'undefined') {
    return
  }
  error.value = ''
  busy.value = true
  try {
    const payload = await withDaemonTimeout('download file', (signal) =>
      readContentBlob({
        baseURL: baseURL.value,
        root: root.value,
        path: entry.path,
        signal
      })
    )
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
  openMenuPath.value = ''
  error.value = ''
  proofView.value = null
  busy.value = true
  try {
    const path = target?.path ?? currentPath.value
    const kind = target?.kind ?? 'dir'
    const payload =
      kind === 'dir'
        ? await withDaemonTimeout('read proof directory', (signal) =>
            readDirectory({ baseURL: baseURL.value, root: root.value, path, signal })
          )
        : await withDaemonTimeout('read proof file', (signal) =>
            readContentBlob({ baseURL: baseURL.value, root: root.value, path, signal })
          )
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

function toggleEntryMenu(entry) {
  openMenuPath.value = openMenuPath.value === entry.path ? '' : entry.path
}

async function runEntryAction(action, entry) {
  openMenuPath.value = ''
  if (action === 'open') {
    await openDirectory(entry)
  } else if (action === 'download') {
    await downloadFile(entry)
  } else if (action === 'proof') {
    await showProof(entry)
  }
}

async function verifyAndMark(path, proofList) {
  const verification = await withDaemonTimeout('verify proof', (signal) =>
    verifyProofList({
      baseURL: baseURL.value,
      proofList,
      signal
    })
  )
  markVerification(path, verification.valid)
  return verification
}

async function withDaemonTimeout(label, operation, timeoutMs = daemonRequestTimeoutMs) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await operation(controller.signal)
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`)
    }
    throw err
  } finally {
    window.clearTimeout(timeout)
  }
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
  previewView.value = false
}

function backToBrowser() {
  clearPreview()
  proofView.value = null
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

function kindLabel(entry) {
  if (entry.kind === 'dir') {
    return 'Folder'
  }
  if (entry.kind === 'file') {
    return 'File'
  }
  return 'Unknown'
}

function entryKindOrder(entry) {
  if (entry.kind === 'dir') {
    return 0
  }
  if (entry.kind === 'file') {
    return 1
  }
  return 2
}

function compareEntries(left, right) {
  const kindDiff = entryKindOrder(left) - entryKindOrder(right)
  if (kindDiff !== 0) {
    return kindDiff
  }
  return entryNameCollator.compare(left.name, right.name)
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
  <section
    class="malt-app"
    :class="{ 'is-login': !signedIn, 'is-dropping': dropActive }"
    aria-label="MALT app"
  >
    <form v-if="!signedIn" class="malt-app__login" @submit.prevent="signIn">
      <div class="malt-app__login-brand">MALT</div>
      <h1>Sign in</h1>
      <label>
        <span>Profile</span>
        <input v-model="profileInput" autocomplete="username" spellcheck="false" />
      </label>
      <button type="submit">Continue</button>
      <p v-if="error" class="malt-app__error">{{ error }}</p>
    </form>

    <template v-else>
      <header class="malt-app__topbar">
        <div class="malt-app__identity">
          <strong>MALT</strong>
          <span>{{ activeProfile }}</span>
        </div>
        <div class="malt-app__top-actions">
          <span class="malt-app__status" :class="{ 'is-valid': currentDirectoryVerified }">
            {{ statusText }}
          </span>
          <button type="button" :disabled="busy" @click="settingsOpen = !settingsOpen">Settings</button>
          <button type="button" :disabled="busy" @click="signOut">Sign out</button>
        </div>
      </header>

      <section v-if="settingsOpen" class="malt-app__settings" aria-label="App settings">
        <div class="malt-app__settings-grid">
          <label>
            <span>Root</span>
            <input v-model="root" autocomplete="off" spellcheck="false" />
          </label>
          <label>
            <span>Daemon URL</span>
            <input v-model="baseURL" autocomplete="off" spellcheck="false" />
          </label>
          <label>
            <span>CAS URL</span>
            <input v-model="casURL" autocomplete="off" spellcheck="false" />
          </label>
          <label>
            <span>Upload prefix</span>
            <input v-model="prefix" autocomplete="off" spellcheck="false" />
          </label>
        </div>
        <div class="malt-app__button-row">
          <button type="button" :disabled="busy" @click="applySettings">Apply</button>
          <button type="button" :disabled="busy" @click="settingsOpen = false">Close</button>
        </div>
      </section>

      <div v-show="dropActive" class="malt-app__dropzone" aria-live="polite">
        <strong>Drop files or folders</strong>
        <span>{{ root ? `Target: ${currentLabel}` : 'Target: new root' }}</span>
      </div>

      <main class="malt-app__main">
        <p v-if="error" class="malt-app__error">{{ error }}</p>
        <p v-if="uploadStatus" class="malt-app__status-line">{{ uploadStatus }}</p>

        <div class="malt-app__repo-bar malt-app__pathbar">
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
          <button
            type="button"
            :disabled="busy || !root"
            @click="showProof({ path: currentPath, kind: 'dir' })"
          >
            Current proof
          </button>
        </div>

        <section v-if="previewView && preview" class="malt-app__preview" aria-label="File preview">
          <div class="malt-app__preview-head">
            <button type="button" :disabled="busy" @click="backToBrowser">Back</button>
            <div>
              <span>Preview</span>
              <h2>{{ preview.path }}</h2>
            </div>
            <div class="malt-app__preview-actions">
              <button
                type="button"
                :disabled="busy"
                @click="downloadFile({ name: preview.name, path: preview.path, kind: 'file' })"
              >
                Download
              </button>
              <button
                type="button"
                :disabled="busy"
                @click="showProof({ path: preview.path, kind: 'file' })"
              >
                Proof
              </button>
            </div>
          </div>
          <div class="malt-app__preview-layout">
            <div class="malt-app__preview-body">
              <img
                v-if="preview.kind === 'image'"
                class="malt-app__image"
                :src="preview.url"
                :alt="preview.name"
              />
              <pre v-else-if="preview.kind === 'text'">{{ preview.body }}</pre>
              <p v-else class="malt-app__empty">Binary preview is not available. Use Download.</p>
            </div>
            <aside class="malt-app__proof-sidebar" aria-label="ProofList">
              <div class="malt-app__proof-head">
                <h2>ProofList</h2>
                <span :class="{ 'is-valid': proofView?.path === preview.path && proofView?.verification?.valid }">
                  {{
                    proofView?.path === preview.path
                      ? proofView.verification?.valid
                        ? 'valid'
                        : 'invalid'
                      : 'not loaded'
                  }}
                </span>
              </div>
              <template v-if="proofView?.path === preview.path">
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
                <div class="malt-app__button-row">
                  <button type="button" :disabled="!proofText" @click="sendToVerifier">Verify page</button>
                </div>
                <pre class="malt-app__proof-json">{{ proofText }}</pre>
              </template>
              <p v-else class="malt-app__empty">Use Proof to load the current file proof.</p>
            </aside>
          </div>
        </section>

        <section v-else class="malt-app__browser malt-app__file-list" aria-label="File browser">
          <div v-if="entries.length === 0" class="malt-app__empty">
            {{ root ? 'No entries' : 'Drop files or set a root' }}
          </div>
          <div v-for="entry in entries" :key="entry.path" class="malt-app__row">
            <button
              type="button"
              class="malt-app__name"
              :disabled="busy || entry.kind === 'unknown'"
              :title="kindLabel(entry)"
              @click="entry.kind === 'dir' ? openDirectory(entry) : previewFile(entry)"
            >
              <span
                class="malt-app__file-icon"
                :class="{ 'is-dir': entry.kind === 'dir', 'is-file': entry.kind === 'file' }"
                aria-hidden="true"
              ></span>
              <span class="malt-app__name-text">{{ entry.name }}</span>
              <span
                class="verified-dot"
                :class="{
                  'is-valid': verificationState(entry.path) === true,
                  'is-invalid': verificationState(entry.path) === false
                }"
              ></span>
            </button>
            <span class="malt-app__row-spacer" aria-hidden="true"></span>
            <span class="malt-app__size">{{ formatSize(entry.size) }}</span>
            <span class="malt-app__row-menu">
              <button
                type="button"
                class="malt-app__more"
                :disabled="busy || entry.kind === 'unknown'"
                :aria-expanded="openMenuPath === entry.path"
                aria-label="Actions"
                @click="toggleEntryMenu(entry)"
              >
                ⋮
              </button>
              <span v-if="openMenuPath === entry.path" class="malt-app__menu">
                <button v-if="entry.kind === 'dir'" type="button" @click="runEntryAction('open', entry)">
                  Open
                </button>
                <button v-if="entry.kind === 'file'" type="button" @click="runEntryAction('download', entry)">
                  Download
                </button>
                <button type="button" @click="runEntryAction('proof', entry)">Proof</button>
              </span>
            </span>
          </div>
        </section>

        <section v-if="uploadResult" class="malt-app__result">
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
          <div class="malt-app__panel">
            <h2>Uploads</h2>
            <pre>{{ uploadText }}</pre>
          </div>
        </section>

        <section v-if="proofView && !previewView" class="malt-app__result">
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
          <div class="malt-app__button-row">
            <button type="button" :disabled="!proofText" @click="sendToVerifier">Verify page</button>
          </div>
          <div class="malt-app__panel">
            <h2>ProofList</h2>
            <pre>{{ proofText }}</pre>
          </div>
        </section>
      </main>
    </template>
  </section>
</template>
