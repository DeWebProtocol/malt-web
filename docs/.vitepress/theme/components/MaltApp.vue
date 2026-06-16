<script setup>
import MarkdownIt from 'markdown-it'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { withBase } from 'vitepress'
import {
  activeProfileStorageKey,
  ancestorDirectoryPaths,
  appFallbackStorageKey,
  buildAppStatePath,
  defaultCASURL,
  defaultDaemonURL,
  joinMaltPath,
  normalizeUploadPath,
  pathBasename,
  pathParent,
  parseAppFallbackRoute,
  parseAppStatePath,
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
const directoryCache = ref({})
const loadedTreeDirectories = ref({})
const treeExpanded = ref({ '': true })
const busy = ref(false)
const error = ref('')
const uploadResult = ref(null)
const preview = ref(null)
const previewMode = ref('code')
const previewView = ref(false)
const proofView = ref(null)
const verifiedPaths = ref({})
const settingsOpen = ref(false)
const openMenuPath = ref('')
const dropActive = ref(false)
const dragDepth = ref(0)
const uploadStatus = ref('')
const copyFeedbackVisible = ref(false)
const syntaxHighlighter = shallowRef(null)
const entryNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const daemonRequestTimeoutMs = 120_000
const uploadRequestTimeoutMs = 600_000
const copyFeedbackDurationMs = 1500
const markdownRenderer = createMarkdownRenderer()
const syntaxThemes = {
  light: 'github-light',
  dark: 'github-dark'
}
const syntaxLanguages = [
  'go',
  'rust',
  'c',
  'cpp',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'json',
  'jsonl',
  'yaml',
  'toml',
  'shellscript',
  'docker',
  'make',
  'markdown',
  'html',
  'css',
  'xml'
]
const syntaxLanguageSet = new Set(syntaxLanguages)
const previewLanguageByFilename = new Map([
  ['go.mod', 'shellscript'],
  ['go.sum', 'shellscript'],
  ['dockerfile', 'docker'],
  ['makefile', 'make']
])
const previewLanguageByExtension = new Map([
  ['go', 'go'],
  ['rs', 'rust'],
  ['c', 'c'],
  ['h', 'c'],
  ['cpp', 'cpp'],
  ['cc', 'cpp'],
  ['cxx', 'cpp'],
  ['hpp', 'cpp'],
  ['js', 'javascript'],
  ['mjs', 'javascript'],
  ['cjs', 'javascript'],
  ['ts', 'typescript'],
  ['jsx', 'jsx'],
  ['tsx', 'tsx'],
  ['py', 'python'],
  ['json', 'json'],
  ['jsonl', 'jsonl'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
  ['toml', 'toml'],
  ['sh', 'shellscript'],
  ['bash', 'shellscript'],
  ['zsh', 'shellscript'],
  ['md', 'markdown'],
  ['markdown', 'markdown'],
  ['html', 'html'],
  ['css', 'css'],
  ['xml', 'xml']
])
const previewLanguageAliases = new Map([
  ['bash', 'shellscript'],
  ['shell', 'shellscript'],
  ['sh', 'shellscript'],
  ['zsh', 'shellscript'],
  ['yml', 'yaml'],
  ['dockerfile', 'docker'],
  ['makefile', 'make'],
  ['md', 'markdown'],
  ['c++', 'cpp'],
  ['cc', 'cpp'],
  ['cxx', 'cpp'],
  ['hpp', 'cpp'],
  ['rs', 'rust'],
  ['py', 'python'],
  ['go.mod', 'shellscript'],
  ['go.sum', 'shellscript']
])
let dragResetTimer = 0
let copyFeedbackTimer = 0
let directoryHydrationGeneration = 0

const signedIn = computed(() => activeProfile.value !== '')
const currentLabel = computed(() => (currentPath.value ? `/${currentPath.value}` : '/'))
const proofText = computed(() =>
  proofView.value?.proofList ? JSON.stringify(proofView.value.proofList, null, 2) : ''
)
const treeIndentBasePx = 12
const treeIndentStepPx = 18

const displayPath = computed(() =>
  previewView.value && preview.value?.path ? preview.value.path : currentPath.value
)

const breadcrumbs = computed(() => {
  const crumbs = [{ label: 'root', path: '' }]
  const segments = displayPath.value ? displayPath.value.split('/').filter(Boolean) : []
  let cursor = ''
  for (const segment of segments) {
    cursor = joinMaltPath(cursor, segment)
    crumbs.push({ label: segment, path: cursor })
  }
  return crumbs
})

const treeRows = computed(() => buildTreeRows(directoryCache.value[''] || [], 0))

const previewTabs = computed(() => {
  if (!preview.value) {
    return []
  }
  if (preview.value.kind === 'markdown') {
    return [
      { id: 'preview', label: 'Preview' },
      { id: 'code', label: 'Code' }
    ]
  }
  if (['image', 'video', 'audio', 'pdf', 'binary'].includes(preview.value.kind)) {
    return [{ id: 'preview', label: 'Preview' }]
  }
  return [{ id: 'code', label: 'Code' }]
})

const codeLines = computed(() => {
  if (!preview.value?.body && !preview.value?.codeMarkup) {
    return []
  }
  const markup = preview.value.codeMarkup?.length
    ? preview.value.codeMarkup
    : plainCodeLineMarkup(preview.value.body)
  return markup.map((line) => ({
    markup: line || '&nbsp;'
  }))
})

const canCopyPreviewContent = computed(() => typeof preview.value?.body === 'string')

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
  document.title = 'App | MALT'
  window.addEventListener('dragenter', beginPageDrag)
  window.addEventListener('dragover', handlePageDragOver)
  window.addEventListener('dragleave', handlePageDragLeave)
  window.addEventListener('drop', handlePageDrop)
  window.addEventListener('dragend', cancelPageDrag)
  window.addEventListener('popstate', handleAppPopState)
  void initializeSyntaxHighlighter()
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
  window.removeEventListener('popstate', handleAppPopState)
  window.clearTimeout(dragResetTimer)
  resetCopyFeedback()
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
  const routeState = currentAppRouteState()
  const hasRouteRoot = Boolean(routeState?.root)
  baseURL.value = saved.baseURL || baseURL.value || defaultDaemonURL
  casURL.value = saved.casURL || casURL.value || defaultCASURL
  root.value = hasRouteRoot ? routeState.root : saved.root || ''
  currentPath.value = root.value ? (hasRouteRoot ? routeState.path : saved.currentPath || '') : ''
  prefix.value = saved.prefix || ''
  verifiedPaths.value = saved.verifiedPaths || {}
  settingsOpen.value = !root.value
  error.value = ''
  uploadResult.value = null
  preview.value = null
  previewView.value = false
  proofView.value = null
  entries.value = []
  resetTreeState()
  if (root.value) {
    if (hasRouteRoot) {
      void openAppRouteState(routeState, { history: 'replace' })
    } else {
      void loadRoot(currentPath.value, { history: 'replace' })
    }
  } else {
    syncBrowserLocation('replace')
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
  resetTreeState()
  uploadResult.value = null
  settingsOpen.value = false
  openMenuPath.value = ''
  cancelPageDrag()
  uploadStatus.value = ''
  clearPreview()
  proofView.value = null
  syncBrowserLocation('replace')
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
    resetTreeState()
    uploadResult.value = null
    clearPreview()
    proofView.value = null
    persistProfile()
    settingsOpen.value = false
    syncBrowserLocation('replace')
    return
  }
  settingsOpen.value = false
  resetTreeState()
  await loadRoot(currentPath.value, { history: 'replace' })
}

async function loadRoot(nextPath = '', options = {}) {
  if (!root.value.trim()) {
    error.value = 'root is required'
    return
  }
  openMenuPath.value = ''
  currentPath.value = normalizeOptionalPath(nextPath)
  seedTreePath(currentPath.value)
  expandTreeAncestors(currentPath.value)
  if (options.syncURL !== false) {
    syncBrowserLocation(options.history || 'push')
  }
  await loadTreeAncestors(currentPath.value)
  await refreshDirectory()
}

async function openAppRouteState(routeState, options = {}) {
  if (!routeState) {
    return
  }
  root.value = routeState.root
  const routePath = normalizeOptionalPath(routeState.path)
  if (!root.value) {
    currentPath.value = ''
    entries.value = []
    resetTreeState()
    clearPreview()
    proofView.value = null
    if (options.syncURL !== false) {
      syncBrowserLocation(options.history || 'replace')
    }
    persistProfile()
    return
  }
  if (!routePath) {
    await loadRoot('', { syncURL: false })
    if (options.syncURL !== false) {
      syncBrowserLocation(options.history || 'replace')
    }
    return
  }
  busy.value = true
  let stat
  try {
    stat = await withDaemonTimeout('stat route path', (signal) =>
      statPath({ baseURL: baseURL.value, root: root.value, path: routePath, signal })
    )
  } catch (err) {
    busy.value = false
    error.value = err instanceof Error ? err.message : String(err)
    if (options.syncURL !== false) {
      syncBrowserLocation(options.history || 'replace', routePath)
    }
    return
  }
  busy.value = false
  if (stat.kind === 'file') {
    const parentPath = pathParent(routePath)
    await loadRoot(parentPath, { syncURL: false })
    await previewFile(
      {
        name: pathBasename(routePath),
        path: routePath,
        kind: 'file',
        storageKind: stat.storageKind,
        key: stat.key,
        payload: stat.payload,
        size: stat.size,
        error: ''
      },
      { syncURL: false }
    )
  } else {
    await loadRoot(routePath, { syncURL: false })
  }
  if (options.syncURL !== false) {
    syncBrowserLocation(options.history || 'replace', routePath)
  }
}

async function refreshDirectory() {
  error.value = ''
  clearPreview()
  proofView.value = null
  busy.value = true
  try {
    const { manifest, loadedEntries } = await loadDirectoryEntries(currentPath.value, '', {
      omitProof: false
    })
    if (manifest.proofList) {
      proofView.value = {
        path: currentPath.value,
        kind: 'dir',
        proofList: manifest.proofList,
        verification: null
      }
    }
    entries.value = loadedEntries
    cacheDirectoryEntries(currentPath.value, entries.value)
    persistProfile()
    void hydrateDirectoryEntries(currentPath.value, loadedEntries)
  } catch (err) {
    entries.value = []
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function loadDirectoryEntries(path, payload, options = {}) {
  const directoryPath = normalizeOptionalPath(path)
  const directoryPayload = String(payload || '').trim()
  const omitProof = options.omitProof !== false
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
          path: directoryPath,
          signal,
          omitProof
        })
  )
  const loadedEntries = manifest.entries.map((name) => lazyDirectoryEntry(directoryPath, name))
  return {
    manifest,
    loadedEntries: loadedEntries.sort(compareEntries)
  }
}

function lazyDirectoryEntry(directoryPath, name) {
  return {
    name,
    path: joinMaltPath(directoryPath, name),
    kind: 'unknown',
    storageKind: '',
    key: '',
    payload: '',
    size: null,
    error: ''
  }
}

async function hydrateDirectoryEntries(directoryPath, sourceEntries) {
  const generation = ++directoryHydrationGeneration
  await mapWithConcurrency(sourceEntries, 6, async (entry) => {
    if (generation !== directoryHydrationGeneration || currentPath.value !== directoryPath) {
      return
    }
    if (!entry || entry.kind !== 'unknown') {
      return
    }
    await statEntry(entry, { silent: true, generation, directoryPath })
  })
}

function resetTreeState() {
  directoryCache.value = {}
  loadedTreeDirectories.value = {}
  treeExpanded.value = { '': true }
}

function cacheDirectoryEntries(path, nextEntries) {
  const cleanPath = normalizeOptionalPath(path)
  directoryCache.value = {
    ...directoryCache.value,
    [cleanPath]: nextEntries
  }
  loadedTreeDirectories.value = {
    ...loadedTreeDirectories.value,
    [cleanPath]: true
  }
  treeExpanded.value = {
    ...treeExpanded.value,
    [cleanPath]: true
  }
}

function seedTreePath(path) {
  const segments = normalizeOptionalPath(path).split('/').filter(Boolean)
  if (segments.length === 0) {
    return
  }

  const nextCache = { ...directoryCache.value }
  let parentPath = ''
  let cursor = ''
  for (const segment of segments) {
    cursor = joinMaltPath(cursor, segment)
    const parentEntries = nextCache[parentPath] || []
    if (!parentEntries.some((entry) => entry.path === cursor)) {
      nextCache[parentPath] = [
        ...parentEntries,
        {
          name: segment,
          path: cursor,
          kind: 'dir',
          storageKind: '',
          key: '',
          payload: '',
          size: null,
          error: ''
        }
      ].sort(compareEntries)
    }
    parentPath = cursor
  }
  directoryCache.value = nextCache
}

function expandTreeAncestors(path) {
  const next = { ...treeExpanded.value, '': true }
  const segments = normalizeOptionalPath(path).split('/').filter(Boolean)
  let cursor = ''
  for (const segment of segments) {
    cursor = joinMaltPath(cursor, segment)
    next[cursor] = true
  }
  treeExpanded.value = next
}

function buildTreeRows(parentEntries, depth) {
  const rows = []
  for (const entry of parentEntries) {
    const expanded = Boolean(treeExpanded.value[entry.path])
    rows.push({
      entry,
      depth,
      expanded
    })
    if (entry.kind === 'dir' && expanded) {
      rows.push(...buildTreeRows(directoryCache.value[entry.path] || [], depth + 1))
    }
  }
  return rows
}

function treeRowStyle(depth) {
  const level = Number.isFinite(depth) ? Math.max(0, depth) : 0
  return {
    '--tree-indent': `${treeIndentBasePx + level * treeIndentStepPx}px`
  }
}

async function openParentDirectory() {
  if (!currentPath.value) {
    return
  }
  await loadRoot(pathParent(currentPath.value))
}

async function openBreadcrumbPath(crumb) {
  if (crumb.path === displayPath.value) {
    return
  }
  await loadRoot(crumb.path)
}

async function copyPreviewContent() {
  if (!canCopyPreviewContent.value || typeof navigator === 'undefined' || !navigator.clipboard) {
    return
  }
  error.value = ''
  try {
    await navigator.clipboard.writeText(preview.value.body)
    showCopyFeedback()
  } catch (err) {
    resetCopyFeedback()
    error.value = err instanceof Error ? err.message : String(err)
  }
}

function showCopyFeedback() {
  window.clearTimeout(copyFeedbackTimer)
  copyFeedbackVisible.value = true
  copyFeedbackTimer = window.setTimeout(() => {
    copyFeedbackVisible.value = false
  }, copyFeedbackDurationMs)
}

function resetCopyFeedback() {
  window.clearTimeout(copyFeedbackTimer)
  copyFeedbackTimer = 0
  copyFeedbackVisible.value = false
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

function currentAppRouteState() {
  if (typeof window === 'undefined') {
    return null
  }
  const appBasePath = withBase('/app')
  const routeState = parseAppStatePath(appBasePath, window.location.pathname)
  if (routeState && !routeState.root) {
    const fallbackRoute = consumeAppFallbackRoute(appBasePath)
    if (fallbackRoute?.root) {
      return fallbackRoute
    }
  }
  return routeState
}

function consumeAppFallbackRoute(appBasePath) {
  try {
    const raw = window.sessionStorage.getItem(appFallbackStorageKey)
    if (!raw) {
      return null
    }
    const routeState = parseAppFallbackRoute(appBasePath, raw)
    window.sessionStorage.removeItem(appFallbackStorageKey)
    return routeState
  } catch {
    return null
  }
}

function syncBrowserLocation(mode = 'push', pathOverride = currentPath.value) {
  if (typeof window === 'undefined') {
    return
  }
  const state = {
    root: root.value.trim(),
    path: normalizeOptionalPath(pathOverride)
  }
  const url = new URL(window.location.href)
  url.pathname = buildAppStatePath(withBase('/app'), state.root, state.path)
  url.search = ''
  url.hash = ''
  if (url.pathname === window.location.pathname && !window.location.search && !window.location.hash) {
    return
  }
  if (mode === 'replace') {
    window.history.replaceState(state, '', url)
    return
  }
  window.history.pushState(state, '', url)
}

async function handleAppPopState() {
  if (!signedIn.value) {
    return
  }
  const routeState = currentAppRouteState()
  if (!routeState) {
    return
  }
  await openAppRouteState(routeState, { syncURL: false })
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
    syncBrowserLocation('replace')
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
  await loadRoot(entry.path)
}

async function openEntry(entry) {
  openMenuPath.value = ''
  if (!entry || entry.kind === 'unknown') {
    entry = await statEntry(entry)
  }
  if (!entry || entry.kind === 'unknown') {
    return
  }
  if (entry.kind === 'dir') {
    await openDirectory(entry)
    return
  }
  await previewFile(entry)
}

async function statEntry(entry, options = {}) {
  if (!entry) {
    return null
  }
  if (entry.kind !== 'unknown') {
    return entry
  }
  if (!options.silent) {
    error.value = ''
    busy.value = true
  }
  try {
    const stat = await withDaemonTimeout('stat path', (signal) =>
      statPath({ baseURL: baseURL.value, root: root.value, path: entry.path, signal })
    )
    const resolved = {
      ...entry,
      kind: stat.kind || 'unknown',
      storageKind: stat.storageKind,
      key: stat.key,
      payload: stat.payload,
      size: stat.size,
      error: ''
    }
    if (
      options.generation != null &&
      (options.generation !== directoryHydrationGeneration || currentPath.value !== options.directoryPath)
    ) {
      return resolved
    }
    replaceCachedEntry(resolved)
    return resolved
  } catch (err) {
    const failed = {
      ...entry,
      error: err instanceof Error ? err.message : String(err)
    }
    replaceCachedEntry(failed)
    if (!options.silent) {
      error.value = failed.error
    }
    return failed
  } finally {
    if (!options.silent) {
      busy.value = false
    }
  }
}

function replaceCachedEntry(nextEntry) {
  if (!nextEntry) {
    return
  }
  const parentPath = pathParent(nextEntry.path)
  const replace = (items) =>
    (items || []).map((item) => (item.path === nextEntry.path ? nextEntry : item)).sort(compareEntries)
  if (parentPath === currentPath.value) {
    entries.value = replace(entries.value)
  }
  if (directoryCache.value[parentPath]) {
    directoryCache.value = {
      ...directoryCache.value,
      [parentPath]: replace(directoryCache.value[parentPath])
    }
  }
}

async function toggleTreeDirectory(entry) {
  if (entry.kind === 'unknown') {
    entry = await statEntry(entry)
  }
  if (!entry || entry.kind !== 'dir') {
    return
  }
  const expanded = Boolean(treeExpanded.value[entry.path])
  if (expanded) {
    treeExpanded.value = {
      ...treeExpanded.value,
      [entry.path]: false
    }
    return
  }
  if (loadedTreeDirectories.value[entry.path]) {
    treeExpanded.value = {
      ...treeExpanded.value,
      [entry.path]: true
    }
    return
  }
  error.value = ''
  busy.value = true
  try {
    await loadTreeDirectory(entry)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function loadTreeDirectory(entry) {
  const path = normalizeOptionalPath(entry.path)
  const { loadedEntries } = await loadDirectoryEntries(path, entry.payload)
  cacheDirectoryEntries(path, loadedEntries)
}

async function loadTreeAncestors(path) {
  for (const ancestorPath of ancestorDirectoryPaths(path)) {
    if (loadedTreeDirectories.value[ancestorPath]) {
      continue
    }
    const { loadedEntries } = await loadDirectoryEntries(ancestorPath)
    cacheDirectoryEntries(ancestorPath, loadedEntries)
  }
}

async function previewFile(entry, options = {}) {
  openMenuPath.value = ''
  if (entry.kind !== 'file') {
    return
  }
  error.value = ''
  proofView.value = null
  clearPreview()
  if (options.syncURL !== false) {
    syncBrowserLocation(options.history || 'push', entry.path)
  }
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
    if (isMarkdownPreview(entry.name, contentType, blob.size)) {
      const body = await blob.text()
      const language = inferPreviewLanguage(entry.name, contentType) || 'markdown'
      showPreview({
        path: entry.path,
        name: entry.name,
        kind: 'markdown',
        language,
        contentType,
        size: blob.size,
        body,
        markup: renderMarkdown(body),
        codeMarkup: highlightCode(body, language)
      })
      return
    }
    if (isImagePreview(entry.name, contentType)) {
      showPreview({
        path: entry.path,
        name: entry.name,
        kind: 'image',
        contentType,
        size: blob.size,
        url: URL.createObjectURL(blob)
      })
      return
    }
    if (isVideoPreview(entry.name, contentType)) {
      showPreview({
        path: entry.path,
        name: entry.name,
        kind: 'video',
        contentType,
        size: blob.size,
        url: URL.createObjectURL(blob)
      })
      return
    }
    if (isAudioPreview(entry.name, contentType)) {
      showPreview({
        path: entry.path,
        name: entry.name,
        kind: 'audio',
        contentType,
        size: blob.size,
        url: URL.createObjectURL(blob)
      })
      return
    }
    if (isPDFPreview(entry.name, contentType)) {
      showPreview({
        path: entry.path,
        name: entry.name,
        kind: 'pdf',
        contentType,
        size: blob.size,
        url: URL.createObjectURL(blob)
      })
      return
    }
    if (isTextPreview(entry.name, contentType, blob.size)) {
      const body = await blob.text()
      const language = inferPreviewLanguage(entry.name, contentType)
      showPreview({
        path: entry.path,
        name: entry.name,
        kind: 'text',
        language,
        contentType,
        size: blob.size,
        body,
        codeMarkup: highlightCode(body, language)
      })
      return
    }
    showPreview({
      path: entry.path,
      name: entry.name,
      kind: 'binary',
      contentType,
      size: blob.size
    })
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

async function mapWithConcurrency(items, limit, mapper) {
  const source = Array.from(items || [])
  if (source.length === 0) {
    return []
  }
  const concurrency = Math.max(1, Math.min(Number(limit) || 1, source.length))
  const workers = Array.from({ length: concurrency }, async (_, workerIndex) => {
    for (let index = workerIndex; index < source.length; index += concurrency) {
      await mapper(source[index], index)
    }
  })
  await Promise.all(workers)
}

function toggleEntryMenu(entry) {
  openMenuPath.value = openMenuPath.value === entry.path ? '' : entry.path
}

async function runEntryAction(action, entry) {
  openMenuPath.value = ''
  if (entry?.kind === 'unknown') {
    entry = await statEntry(entry)
    if (!entry || entry.kind === 'unknown') {
      return
    }
  }
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

function showPreview(nextPreview) {
  resetCopyFeedback()
  preview.value = nextPreview
  previewMode.value = nextPreview.kind === 'text' ? 'code' : 'preview'
  previewView.value = true
}

function proofViewMatches(path) {
  return proofView.value?.path === normalizeOptionalPath(path)
}

function proofStatusLabel(path) {
  if (!proofViewMatches(path)) {
    return 'not loaded'
  }
  if (!proofView.value?.verification) {
    return 'loaded'
  }
  return proofView.value.verification.valid ? 'valid' : 'invalid'
}

function proofVerificationLabel(proof) {
  if (!proof) {
    return 'not loaded'
  }
  if (!proof.verification) {
    return 'loaded'
  }
  return proof.verification.valid ? 'valid' : 'invalid'
}

function clearPreview() {
  resetCopyFeedback()
  if (preview.value?.url) {
    URL.revokeObjectURL(preview.value.url)
  }
  preview.value = null
  previewMode.value = 'code'
  previewView.value = false
}

function openVerifierPage() {
  if (typeof window === 'undefined') {
    return
  }
  window.location.href = withBase('/verify')
}

function normalizeOptionalPath(path) {
  return String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
}

async function initializeSyntaxHighlighter() {
  try {
    const { createHighlighter } = await import('shiki')
    syntaxHighlighter.value = await createHighlighter({
      themes: Object.values(syntaxThemes),
      langs: syntaxLanguages
    })
    refreshPreviewRendering()
  } catch (err) {
    console.warn('MALT syntax highlighting is unavailable', err)
  }
}

function refreshPreviewRendering() {
  if (!preview.value?.body) {
    return
  }
  const language =
    preview.value.language || inferPreviewLanguage(preview.value.name, preview.value.contentType)
  if (preview.value.kind === 'markdown') {
    preview.value = {
      ...preview.value,
      language: language || 'markdown',
      markup: renderMarkdown(preview.value.body),
      codeMarkup: highlightCode(preview.value.body, language || 'markdown')
    }
    return
  }
  if (preview.value.kind === 'text') {
    preview.value = {
      ...preview.value,
      language,
      codeMarkup: highlightCode(preview.value.body, language)
    }
  }
}

function createMarkdownRenderer() {
  const renderer = new MarkdownIt({
    breaks: false,
    html: false,
    linkify: true,
    typographer: false,
    highlight: highlightMarkdownFence
  })
  const defaultLinkOpen =
    renderer.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
  renderer.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
    return defaultLinkOpen(tokens, idx, options, env, self)
  }
  return renderer
}

function renderMarkdown(source) {
  return markdownRenderer.render(String(source || ''))
}

function inferPreviewLanguage(name = '', contentType = '') {
  const cleanName = pathBasename(name).toLowerCase()
  const cleanContentType = String(contentType || '').toLowerCase()
  if (previewLanguageByFilename.has(cleanName)) {
    return previewLanguageByFilename.get(cleanName)
  }
  if (cleanContentType.includes('json')) {
    return 'json'
  }
  if (cleanContentType.includes('yaml') || cleanContentType.includes('yml')) {
    return 'yaml'
  }
  if (cleanContentType.includes('toml')) {
    return 'toml'
  }
  if (cleanContentType.includes('javascript')) {
    return 'javascript'
  }
  if (cleanContentType.includes('typescript')) {
    return 'typescript'
  }
  const extension = cleanName.includes('.') ? cleanName.split('.').pop() : ''
  return previewLanguageByExtension.get(extension) || ''
}

function highlightCode(source, language) {
  const text = String(source || '').replace(/\r\n/g, '\n')
  const normalizedLanguage = normalizePreviewLanguage(language)
  if (!syntaxHighlighter.value || !normalizedLanguage) {
    return plainCodeLineMarkup(text)
  }
  try {
    const html = syntaxHighlighter.value.codeToHtml(text, {
      lang: normalizedLanguage,
      themes: syntaxThemes,
      defaultColor: false
    })
    return extractShikiLines(html)
  } catch {
    return plainCodeLineMarkup(text)
  }
}

function highlightMarkdownFence(source, info) {
  const text = String(source || '').replace(/\r\n/g, '\n')
  const language = normalizePreviewLanguage(String(info || '').trim().split(/\s+/)[0])
  if (!syntaxHighlighter.value || !language) {
    return `<pre class="malt-app__markdown-code malt-app__plain-code"><code>${escapeHTML(text)}</code></pre>`
  }
  try {
    return syntaxHighlighter.value
      .codeToHtml(text, {
        lang: language,
        themes: syntaxThemes,
        defaultColor: false
      })
      .replace('<pre class="shiki', '<pre class="shiki malt-app__markdown-code')
  } catch {
    return `<pre class="malt-app__markdown-code malt-app__plain-code"><code>${escapeHTML(text)}</code></pre>`
  }
}

function normalizePreviewLanguage(language) {
  const raw = String(language || '')
    .replace(/^language-/, '')
    .trim()
    .toLowerCase()
  if (!raw) {
    return ''
  }
  const aliased = previewLanguageAliases.get(raw) || raw
  return syntaxLanguageSet.has(aliased) ? aliased : ''
}

function extractShikiLines(html) {
  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(html, 'text/html')
    const lines = Array.from(document.querySelectorAll('.line')).map(
      (line) => line.innerHTML || '&nbsp;'
    )
    if (lines.length > 0) {
      return lines
    }
  }
  const code = String(html).match(/<code>([\s\S]*)<\/code>/)?.[1] || ''
  if (!code) {
    return []
  }
  return code.split('\n').map((line) => {
    const content = line.replace(/^<span class="line">/, '').replace(/<\/span>$/, '')
    return content || '&nbsp;'
  })
}

function plainCodeLineMarkup(source) {
  return String(source || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => escapeHTML(line) || '&nbsp;')
}

function escapeHTML(source) {
  return String(source || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isMarkdownPreview(name, contentType, size) {
  if (size > 1024 * 1024) {
    return false
  }
  return /markdown/i.test(contentType) || /\.(md|markdown)$/i.test(name)
}

function isTextPreview(name, contentType, size) {
  if (size > 512 * 1024) {
    return false
  }
  const cleanName = pathBasename(name)
  const cleanContentType = String(contentType || '').toLowerCase()
  if (/^(go\.mod|go\.sum|Dockerfile|Makefile)$/i.test(cleanName)) {
    return true
  }
  if (cleanContentType.startsWith('text/') || cleanContentType.includes('json')) {
    return true
  }
  return /\.(txt|md|json|js|ts|tsx|jsx|go|rs|c|h|cc|cpp|cxx|hpp|py|css|html|xml|yaml|yml|toml|sh|bash|zsh)$/i.test(name)
}

function isImagePreview(name, contentType) {
  return contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
}

function isVideoPreview(name, contentType) {
  return contentType.startsWith('video/') || /\.(mp4|webm|ogv|mov|m4v)$/i.test(name)
}

function isAudioPreview(name, contentType) {
  return contentType.startsWith('audio/') || /\.(mp3|wav|ogg|oga|m4a|flac)$/i.test(name)
}

function isPDFPreview(name, contentType) {
  return contentType === 'application/pdf' || /\.pdf$/i.test(name)
}

function kindLabel(entry) {
  if (entry.kind === 'unknown') {
    return 'Load entry'
  }
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
          <button type="button" :disabled="busy" @click="openVerifierPage">Verify page</button>
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
        <aside class="malt-app__sidebar" aria-label="File tree">
          <div class="malt-app__sidebar-head">
            <span class="malt-app__sidebar-icon" aria-hidden="true">
              <svg class="malt-app__octicon" viewBox="0 0 16 16" width="16" height="16">
                <path
                  d="M2 2.75C2 1.784 2.784 1 3.75 1h8.5C13.216 1 14 1.784 14 2.75v10.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25H6.5v-11Zm4.25 11h4.25a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25H8Z"
                />
              </svg>
            </span>
            <strong>Files</strong>
          </div>
          <div class="malt-app__tree">
            <p v-if="treeRows.length === 0" class="malt-app__tree-empty">
              {{ root ? 'No files' : 'Set a root' }}
            </p>
            <div
              v-for="node in treeRows"
              v-else
              :key="node.entry.path"
              class="malt-app__tree-row"
              :class="{
                'is-active': node.entry.path === displayPath,
                'is-dir': node.entry.kind === 'dir',
                'is-file': node.entry.kind === 'file'
              }"
              :style="treeRowStyle(node.depth)"
            >
              <button
                v-if="node.entry.kind === 'dir'"
                type="button"
                class="malt-app__tree-toggle"
                :disabled="busy"
                :aria-label="node.expanded ? 'Collapse folder' : 'Expand folder'"
                @click="toggleTreeDirectory(node.entry)"
              >
                <svg
                  class="malt-app__octicon"
                  :class="{ 'is-expanded': node.expanded }"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                >
                  <path
                    d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"
                  />
                </svg>
              </button>
              <span v-else class="malt-app__tree-toggle-spacer" aria-hidden="true"></span>
              <button
                type="button"
                class="malt-app__tree-link"
                :disabled="busy"
                @click="openEntry(node.entry)"
              >
                <span
                  class="malt-app__file-icon"
                  :class="{ 'is-dir': node.entry.kind === 'dir', 'is-file': node.entry.kind === 'file' }"
                  aria-hidden="true"
                >
                  <svg
                    v-if="node.entry.kind === 'dir'"
                    class="malt-app__octicon"
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                  >
                    <path
                      d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2A1.75 1.75 0 0 0 5 1Zm0 1.5H5c.079 0 .153.037.2.1l.9 1.2c.331.441.85.7 1.4.7h6.75a.25.25 0 0 1 .25.25v8.5a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25V2.75a.25.25 0 0 1 .25-.25Z"
                    />
                  </svg>
                  <svg v-else class="malt-app__octicon" viewBox="0 0 16 16" width="16" height="16">
                    <path
                      d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"
                    />
                  </svg>
                </span>
                <span class="malt-app__tree-name">{{ node.entry.name }}</span>
              </button>
            </div>
          </div>
        </aside>

        <section class="malt-app__content" aria-label="Current directory">
          <p v-if="error" class="malt-app__error">{{ error }}</p>
          <p v-if="uploadStatus" class="malt-app__status-line">{{ uploadStatus }}</p>

          <div class="malt-app__repo-bar malt-app__crumbbar">
            <nav class="malt-app__breadcrumb" aria-label="breadcrumb">
              <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
                <button
                  type="button"
                  :disabled="busy || crumb.path === displayPath"
                  @click="openBreadcrumbPath(crumb)"
                >
                  {{ crumb.label }}
                </button>
                <span v-if="index < breadcrumbs.length - 1" aria-hidden="true">/</span>
              </template>
            </nav>
          </div>

        <section v-if="previewView && preview" class="malt-app__preview" aria-label="File preview">
          <div class="malt-app__preview-layout">
            <div class="malt-app__preview-body">
              <div class="malt-app__preview-toolbar">
                <div class="malt-app__preview-tabs" role="tablist" aria-label="File preview modes">
                  <button
                    v-for="tab in previewTabs"
                    :key="tab.id"
                    type="button"
                    role="tab"
                    :aria-selected="previewMode === tab.id"
                    :class="{ 'is-active': previewMode === tab.id }"
                    @click="previewMode = tab.id"
                  >
                    {{ tab.label }}
                  </button>
                </div>
                <div class="malt-app__file-actions" aria-label="File actions">
                  <button
                    type="button"
                    class="malt-app__icon-button"
                    :class="{ 'is-copied': copyFeedbackVisible }"
                    :disabled="busy || !canCopyPreviewContent"
                    :title="copyFeedbackVisible ? 'Copied!' : 'Copy file content'"
                    :aria-label="copyFeedbackVisible ? 'Copied!' : 'Copy file content'"
                    @click="copyPreviewContent"
                  >
                    <span v-if="copyFeedbackVisible" class="malt-app__copy-toast" role="status">Copied!</span>
                    <svg
                      v-if="!copyFeedbackVisible"
                      class="malt-app__octicon"
                      viewBox="0 0 16 16"
                      width="16"
                      height="16"
                      aria-hidden="true"
                    >
                      <path
                        d="M0 6.75C0 5.784.784 5 1.75 5h1a.75.75 0 0 1 0 1.5h-1a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1a.75.75 0 0 1 1.5 0v1A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"
                      />
                      <path
                        d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"
                      />
                    </svg>
                    <svg
                      v-else
                      class="malt-app__octicon"
                      viewBox="0 0 16 16"
                      width="16"
                      height="16"
                      aria-hidden="true"
                    >
                      <path
                        d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="malt-app__icon-button"
                    :disabled="busy"
                    title="Download file"
                    aria-label="Download file"
                    @click="downloadFile({ name: preview.name, path: preview.path, kind: 'file' })"
                  >
                    <svg class="malt-app__octicon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                      <path
                        d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"
                      />
                      <path
                        d="M7.25 1.75a.75.75 0 0 1 1.5 0v6.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22Z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div
                v-if="preview.kind === 'markdown' && previewMode === 'preview'"
                class="malt-app__markdown"
                v-html="preview.markup"
              ></div>
              <div
                v-else-if="
                  (preview.kind === 'markdown' && previewMode === 'code') ||
                  preview.kind === 'text'
                "
                class="malt-app__code-view"
                role="table"
                aria-label="Code preview"
              >
                <div v-for="(line, index) in codeLines" :key="index" class="malt-app__code-line" role="row">
                  <span class="malt-app__code-line-number" role="cell">{{ index + 1 }}</span>
                  <code role="cell" v-html="line.markup"></code>
                </div>
              </div>
              <div v-else-if="preview.kind === 'image'" class="malt-app__media-stage is-image">
                <img class="malt-app__image" :src="preview.url" :alt="preview.name" />
              </div>
              <div v-else-if="preview.kind === 'video'" class="malt-app__media-stage is-video">
                <video controls class="malt-app__media" :src="preview.url"></video>
              </div>
              <div v-else-if="preview.kind === 'audio'" class="malt-app__media-stage is-audio">
                <audio controls class="malt-app__audio" :src="preview.url"></audio>
              </div>
              <div v-else-if="preview.kind === 'pdf'" class="malt-app__media-stage is-pdf">
                <iframe class="malt-app__pdf" :src="preview.url" :title="preview.name"></iframe>
              </div>
              <p v-else class="malt-app__empty">Binary preview is not available. Use Download.</p>
            </div>
            <aside class="malt-app__proof-sidebar" aria-label="File ProofList">
              <div class="malt-app__proof-head">
                <h2>ProofList</h2>
                <span :class="{ 'is-valid': proofViewMatches(preview.path) && proofView?.verification?.valid }">
                  {{ proofStatusLabel(preview.path) }}
                </span>
              </div>
              <template v-if="proofViewMatches(preview.path)">
                <dl>
                  <div>
                    <dt>Path</dt>
                    <dd>{{ proofView.path || '/' }}</dd>
                  </div>
                </dl>
                <pre class="malt-app__proof-json">{{ proofText }}</pre>
              </template>
              <p v-else class="malt-app__empty">ProofList is not available for this file preview.</p>
            </aside>
          </div>
        </section>

        <div v-else class="malt-app__browser-layout">
          <section class="malt-app__browser malt-app__file-list" aria-label="File browser">
            <div v-if="entries.length === 0" class="malt-app__empty">
              {{ root ? 'No entries' : 'Drop files or set a root' }}
            </div>
            <div v-if="currentPath" class="malt-app__row">
              <button
                type="button"
                class="malt-app__name"
                :disabled="busy"
                title="Parent directory"
                @click="openParentDirectory"
              >
                <span class="malt-app__file-icon is-dir" aria-hidden="true">
                  <svg class="malt-app__octicon" viewBox="0 0 16 16" width="16" height="16">
                    <path
                      d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2A1.75 1.75 0 0 0 5 1Zm0 1.5H5c.079 0 .153.037.2.1l.9 1.2c.331.441.85.7 1.4.7h6.75a.25.25 0 0 1 .25.25v8.5a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25V2.75a.25.25 0 0 1 .25-.25Z"
                    />
                  </svg>
                </span>
                <span class="malt-app__name-text">..</span>
              </button>
              <span class="malt-app__row-spacer" aria-hidden="true"></span>
              <span class="malt-app__size"></span>
              <span class="malt-app__row-menu"></span>
            </div>
            <div v-for="entry in entries" :key="entry.path" class="malt-app__row">
              <button
                type="button"
                class="malt-app__name"
                :disabled="busy"
                :title="kindLabel(entry)"
                @click="openEntry(entry)"
              >
                <span
                  class="malt-app__file-icon"
                  :class="{ 'is-dir': entry.kind === 'dir', 'is-file': entry.kind === 'file' }"
                  aria-hidden="true"
                >
                  <svg
                    v-if="entry.kind === 'dir'"
                    class="malt-app__octicon"
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                  >
                    <path
                      d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2A1.75 1.75 0 0 0 5 1Zm0 1.5H5c.079 0 .153.037.2.1l.9 1.2c.331.441.85.7 1.4.7h6.75a.25.25 0 0 1 .25.25v8.5a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25V2.75a.25.25 0 0 1 .25-.25Z"
                    />
                  </svg>
                  <svg v-else class="malt-app__octicon" viewBox="0 0 16 16" width="16" height="16">
                    <path
                      d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"
                    />
                  </svg>
                </span>
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
                  :disabled="busy"
                  :aria-expanded="openMenuPath === entry.path"
                  aria-label="Actions"
                  @click="toggleEntryMenu(entry)"
                >
                  <svg class="malt-app__octicon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path
                      d="M8 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM9.5 14.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                    />
                  </svg>
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

          <aside class="malt-app__proof-sidebar" aria-label="Directory ProofList">
            <div class="malt-app__proof-head">
              <h2>ProofList</h2>
              <span :class="{ 'is-valid': proofView?.verification?.valid }">
                {{ proofVerificationLabel(proofView) }}
              </span>
            </div>
            <template v-if="proofView">
              <dl>
                <div>
                  <dt>Path</dt>
                  <dd>{{ proofView.path || '/' }}</dd>
                </div>
              </dl>
              <pre class="malt-app__proof-json">{{ proofText }}</pre>
            </template>
            <p v-else class="malt-app__empty">ProofList is not available for this directory.</p>
          </aside>
        </div>

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
        </section>
      </main>
    </template>
  </section>
</template>
