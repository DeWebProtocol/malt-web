import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const gatewayState = vi.hoisted(() => ({
  directoryEntries: [],
  directoryReads: [],
  directoryGate: null,
  statReads: [],
  statGate: null,
  statError: null,
  uploadCalls: [],
  pushCalls: [],
  candidateRoot: '',
  pushStatus: 'fast_forward'
}))

vi.mock('vitepress', () => ({
  withBase: (path) => path
}))

vi.mock('shiki', () => ({
  createHighlighter: vi.fn(async () => ({
    codeToHtml: (source) =>
      `<pre><code>${String(source)
        .split('\n')
        .map((line) => `<span class="line">${line}</span>`)
        .join('\n')}</code></pre>`
  }))
}))

vi.mock('../docs/.vitepress/theme/malt-client.mjs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    readDirectory: vi.fn(async (request) => {
      gatewayState.directoryReads.push(request)
      if (gatewayState.directoryGate) await gatewayState.directoryGate(request)
      const entries =
        typeof gatewayState.directoryEntries === 'function'
          ? gatewayState.directoryEntries(request)
          : gatewayState.directoryEntries
      const body = JSON.stringify({ entries })
      return {
        bytes: new TextEncoder().encode(body),
        body,
        entries: [...entries],
        proofList: {
          profile: 'malt.resolve/v0alpha1',
          root: request.root,
          steps: []
        }
      }
    }),
    statPath: vi.fn(async (request) => {
      gatewayState.statReads.push(request)
      if (gatewayState.statGate) await gatewayState.statGate(request)
      const statError =
        typeof gatewayState.statError === 'function'
          ? gatewayState.statError(request)
          : gatewayState.statError
      if (statError) throw statError
      return {
        kind: 'dir',
        storageKind: 'list',
        key: '',
        payload: '',
        size: 0
      }
    }),
    uploadUnixFSFile: vi.fn(async (request) => {
      gatewayState.uploadCalls.push(request)
      return {
        path: request.path,
        newRoot: gatewayState.candidateRoot
      }
    }),
    pushBucketRoot: vi.fn(async (request) => {
      gatewayState.pushCalls.push(request)
      if (gatewayState.pushStatus === 'branched') {
        return {
          status: 'branched',
          head: populatedHead(request.bucketID),
          branch: { name: 'conflicts/bernard/web-test' },
          conflicts: [{ coordinate: request.candidateRoot }]
        }
      }
      return {
        status: 'fast_forward',
        head: {
          ...populatedHead(request.bucketID),
          revision: 4,
          commit_id: 'commit-4',
          root: request.candidateRoot
        }
      }
    })
  }
})

vi.mock('../docs/.vitepress/theme/malt-payload-verifier.mjs', () => ({
  verifyPayloadBytes: vi.fn(async () => ({ valid: true }))
}))

vi.mock('../docs/.vitepress/theme/malt-verifier.mjs', () => ({
  resolveVerificationFromProofList: vi.fn(() => ({})),
  verifyContentProofLocally: vi.fn(async () => ({ valid: true })),
  verifyResolveLocally: vi.fn(async () => ({ valid: true }))
}))

import MaltApp from '../docs/.vitepress/theme/components/MaltApp.vue'

const apiKey = 'maltgw_test_secret_that_must_not_be_persisted'
const rootCID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const candidateCID = 'bafkreidiqndfbaoyau2jsmxtqzfmtrsdep3ruexdjyu7jj43jntzovxxge'
const identity = {
  tenant_id: 'tenant-1',
  principal_id: 'bernard',
  credential_id: 'key-1'
}

function bucket(id, role = 'writer', state = 'active') {
  return {
    id,
    tenant_id: identity.tenant_id,
    name: id.replaceAll('-', ' '),
    state,
    role,
    created_by: identity.principal_id,
    created_at: '2026-07-23T00:00:00Z',
    updated_at: '2026-07-23T00:00:00Z'
  }
}

function emptyHead(bucketID) {
  return {
    bucket_id: bucketID,
    name: 'main',
    kind: 'main',
    state: 'open',
    revision: 0,
    commit_id: '',
    root: ''
  }
}

function populatedHead(bucketID) {
  return {
    bucket_id: bucketID,
    name: 'main',
    kind: 'main',
    state: 'open',
    revision: 3,
    commit_id: 'commit-3',
    root: rootCID
  }
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function installGateway({ buckets, heads }) {
  const requests = []
  globalThis.fetch = vi.fn(async (input, options = {}) => {
    const url = new URL(String(input))
    requests.push({ url, options })
    if (url.pathname === '/api/v1/me') return jsonResponse(identity)
    if (url.pathname === '/api/v1/buckets') return jsonResponse({ buckets })
    const headMatch = url.pathname.match(/^\/api\/v1\/buckets\/([^/]+)\/head$/)
    if (headMatch) {
      const bucketID = decodeURIComponent(headMatch[1])
      return jsonResponse(heads[bucketID] ?? emptyHead(bucketID))
    }
    throw new Error(`unexpected Gateway request: ${url}`)
  })
  return requests
}

async function signIn(wrapper) {
  await wrapper.get('input[type="password"]').setValue(apiKey)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

function bucketCard(wrapper, bucketID) {
  const card = wrapper
    .findAll('.malt-app__bucket-card')
    .find((candidate) => candidate.text().includes(bucketID))
  if (!card) throw new Error(`Bucket card not found: ${bucketID}`)
  return card
}

async function openBucket(wrapper, bucketID) {
  await bucketCard(wrapper, bucketID).trigger('click')
  await flushPromises()
}

async function openPicker(wrapper) {
  const button = wrapper
    .findAll('.malt-app__top-actions button')
    .find((candidate) => candidate.text().trim() === 'Buckets')
  if (!button) throw new Error('Buckets button not found')
  await button.trigger('click')
}

function dispatchFileDrag(type) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const dataTransfer = { types: ['Files'], dropEffect: '' }
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  window.dispatchEvent(event)
  return dataTransfer
}

function dispatchFileDrop(dataTransfer) {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  window.dispatchEvent(event)
  return event
}

function buttonByText(wrapper, label) {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text().trim() === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  return button
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

function storedValues(storage) {
  return Array.from({ length: storage.length }, (_, index) => storage.getItem(storage.key(index)))
}

describe('managed MALT app Bucket login', () => {
  let wrapper

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/app')
    gatewayState.directoryEntries = []
    gatewayState.directoryReads = []
    gatewayState.directoryGate = null
    gatewayState.statReads = []
    gatewayState.statGate = null
    gatewayState.statError = null
    gatewayState.uploadCalls = []
    gatewayState.pushCalls = []
    gatewayState.candidateRoot = candidateCID
    gatewayState.pushStatus = 'fast_forward'
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
  })

  it('authenticates through the same-origin managed Gateway and opens an empty Bucket', async () => {
    const writable = bucket('writer-active')
    const requests = installGateway({
      buckets: [writable],
      heads: { [writable.id]: emptyHead(writable.id) }
    })

    wrapper = mount(MaltApp, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Gateway URL')
    await signIn(wrapper)

    expect(requests.slice(0, 2).map(({ url }) => url.pathname)).toEqual([
      '/api/v1/me',
      '/api/v1/buckets'
    ])
    for (const { options } of requests.slice(0, 2)) {
      expect(options.headers.Authorization).toBe(`Bearer ${apiKey}`)
      expect(options.cache).toBe('no-store')
      expect(options.redirect).toBe('error')
    }
    expect(wrapper.text()).toContain('bernard · tenant-1')
    expect(wrapper.text()).toContain('Your Buckets')

    await openBucket(wrapper, writable.id)

    expect(requests.at(-1).url.pathname).toBe('/api/v1/buckets/writer-active/head')
    expect(wrapper.text()).toContain('This Bucket is empty. Drop files to create its first root.')
    expect(wrapper.text()).toContain('Drop files to add them to this Bucket')
    expect(gatewayState.directoryReads).toHaveLength(0)
    expect(window.history.state).toEqual({
      bucketID: writable.id,
      root: '',
      path: ''
    })
  })

  it('does not establish a session when account validation fails', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input))
      if (url.pathname === '/api/v1/me') {
        return jsonResponse({ message: 'tenant bearer token is required' }, 401)
      }
      if (url.pathname === '/api/v1/buckets') {
        return jsonResponse({ buckets: [] })
      }
      throw new Error(`unexpected Gateway request: ${url}`)
    })

    wrapper = mount(MaltApp, { attachTo: document.body })
    await signIn(wrapper)

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).toContain('tenant bearer token is required')
    expect(wrapper.text()).not.toContain('Your Buckets')
    expect(storedValues(window.localStorage).join('\n')).not.toContain(apiKey)
    expect(storedValues(window.sessionStorage).join('\n')).not.toContain(apiKey)
  })

  it('loads the selected Bucket head root and binds browser history to that Bucket and root', async () => {
    const writable = bucket('project-files')
    const requests = installGateway({
      buckets: [writable],
      heads: { [writable.id]: populatedHead(writable.id) }
    })

    wrapper = mount(MaltApp, { attachTo: document.body })
    await signIn(wrapper)
    await openBucket(wrapper, writable.id)

    expect(requests.at(-1).url.pathname).toBe('/api/v1/buckets/project-files/head')
    expect(gatewayState.directoryReads).toHaveLength(1)
    expect(gatewayState.directoryReads[0]).toMatchObject({
      baseURL: 'https://malt.example/api',
      bucketID: writable.id,
      apiKey,
      root: rootCID,
      path: ''
    })
    expect(wrapper.text()).toContain('Using main revision 3.')
    expect(window.location.pathname).toBe(`/app/${rootCID}`)
    expect(window.history.state).toEqual({
      bucketID: writable.id,
      root: rootCID,
      path: ''
    })

    const staleState = {
      bucketID: 'another-bucket',
      root: 'stale-root',
      path: 'old/path'
    }
    window.history.pushState(staleState, '', '/app/stale-root/old/path')
    window.dispatchEvent(new PopStateEvent('popstate', { state: staleState }))
    await flushPromises()

    expect(window.location.pathname).toBe(`/app/${rootCID}`)
    expect(window.history.state).toEqual({
      bucketID: writable.id,
      root: rootCID,
      path: ''
    })
    expect(gatewayState.directoryReads).toHaveLength(1)
  })

  it('discards a delayed hydration failure after switching Buckets', async () => {
    const first = bucket('bucket-a')
    const second = bucket('bucket-b')
    installGateway({
      buckets: [first, second],
      heads: {
        [first.id]: populatedHead(first.id),
        [second.id]: { ...populatedHead(second.id), root: candidateCID }
      }
    })
    gatewayState.directoryEntries = ['shared']
    const firstStat = deferred()
    gatewayState.statGate = async (request) => {
      if (request.bucketID === first.id) await firstStat.promise
    }
    gatewayState.statError = (request) =>
      request.bucketID === first.id ? new Error('stale Bucket stat failed') : null

    wrapper = mount(MaltApp, { attachTo: document.body })
    await signIn(wrapper)
    await openBucket(wrapper, first.id)
    expect(gatewayState.statReads.some(({ bucketID }) => bucketID === first.id)).toBe(true)

    await openPicker(wrapper)
    await openBucket(wrapper, second.id)
    await flushPromises()
    expect(wrapper.get('.malt-app__tree-row').classes()).toContain('is-dir')

    firstStat.resolve()
    await flushPromises()
    expect(wrapper.get('.malt-app__tree-row').classes()).toContain('is-dir')
    expect(wrapper.text()).not.toContain('stale Bucket stat failed')
  })

  it('enforces Bucket state and role at every upload entry point', async () => {
    const reader = bucket('reader-active', 'reader')
    const readOnlyWriter = bucket('writer-read-only', 'writer', 'read_only')
    const writer = bucket('writer-active')
    const archived = bucket('owner-archived', 'owner', 'archived')
    const buckets = [reader, readOnlyWriter, writer, archived]
    const requests = installGateway({
      buckets,
      heads: Object.fromEntries(buckets.map(({ id }) => [id, emptyHead(id)]))
    })

    wrapper = mount(MaltApp, { attachTo: document.body })
    await signIn(wrapper)

    expect(bucketCard(wrapper, archived.id).attributes('disabled')).toBeDefined()
    await bucketCard(wrapper, archived.id).trigger('click')
    await flushPromises()
    expect(requests.filter(({ url }) => url.pathname.endsWith('/head'))).toHaveLength(0)

    await openBucket(wrapper, reader.id)
    expect(wrapper.text()).toContain('This Bucket is empty')
    expect(wrapper.text()).not.toContain('Drop files to add them to this Bucket')
    expect(dispatchFileDrag('dragenter').dropEffect).toBe('none')
    expect(wrapper.get('.malt-app__dropzone').attributes('style')).toContain('display: none')

    await openPicker(wrapper)
    await openBucket(wrapper, readOnlyWriter.id)
    expect(dispatchFileDrag('dragenter').dropEffect).toBe('none')
    expect(wrapper.get('.malt-app__dropzone').attributes('style')).toContain('display: none')

    await openPicker(wrapper)
    await openBucket(wrapper, writer.id)
    expect(dispatchFileDrag('dragenter').dropEffect).toBe('copy')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.malt-app__dropzone').attributes('style') || '').not.toContain(
      'display: none'
    )
    dispatchFileDrag('dragend')

    writer.state = 'archived'
    await openPicker(wrapper)
    await buttonByText(wrapper, 'Refresh list').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('previously selected Bucket is archived')
    expect(wrapper.find('.malt-app__main').exists()).toBe(false)
    expect(bucketCard(wrapper, writer.id).attributes('disabled')).toBeDefined()
  })

  it('locks the captured upload target while an asynchronous directory drop is enumerated', async () => {
    const writable = bucket('writer-active')
    installGateway({
      buckets: [writable],
      heads: { [writable.id]: emptyHead(writable.id) }
    })

    wrapper = mount(MaltApp, { attachTo: document.body })
    await signIn(wrapper)
    await openBucket(wrapper, writable.id)

    let finishEnumeration
    const directory = {
      name: 'slow-folder',
      isDirectory: true,
      isFile: false,
      createReader: () => ({
        readEntries: (resolve) => {
          finishEnumeration = resolve
        }
      })
    }
    dispatchFileDrop({
      types: ['Files'],
      dropEffect: '',
      files: [],
      items: [{ webkitGetAsEntry: () => directory }]
    })
    await wrapper.vm.$nextTick()

    expect(finishEnumeration).toBeTypeOf('function')
    expect(buttonByText(wrapper, 'Buckets').attributes('disabled')).toBeDefined()
    expect(window.history.state.bucketID).toBe(writable.id)

    finishEnumeration([])
    await flushPromises()
    expect(buttonByText(wrapper, 'Buckets').attributes('disabled')).toBeUndefined()
    expect(gatewayState.uploadCalls).toHaveLength(0)
  })

  it('keeps candidate navigation locked through delayed ancestor reads and preserves branched uploads', async () => {
    const writable = bucket('writer-active')
    installGateway({
      buckets: [writable],
      heads: { [writable.id]: populatedHead(writable.id) }
    })
    gatewayState.directoryEntries = ({ path }) => (path ? [] : ['folder'])

    wrapper = mount(MaltApp, { attachTo: document.body })
    await signIn(wrapper)
    await openBucket(wrapper, writable.id)
    await flushPromises()

    const folderLink = wrapper
      .findAll('.malt-app__tree-link')
      .find((candidate) => candidate.text().trim() === 'folder')
    expect(folderLink).toBeDefined()
    await folderLink.trigger('click')
    await flushPromises()
    expect(window.location.pathname).toBe(`/app/${rootCID}/folder`)

    gatewayState.pushStatus = 'branched'
    dispatchFileDrop({
      types: ['Files'],
      dropEffect: '',
      items: [],
      files: [new File(['hello'], 'note.txt', { type: 'text/plain' })]
    })
    await flushPromises()

    expect(gatewayState.uploadCalls).toHaveLength(1)
    expect(gatewayState.uploadCalls[0]).toMatchObject({
      bucketID: writable.id,
      root: rootCID,
      path: 'folder/note.txt'
    })
    expect(gatewayState.pushCalls).toHaveLength(1)
    expect(wrapper.text()).toContain('preserved the conflicting candidate')
    expect(storedValues(window.localStorage).join('\n')).toContain('"status":"branched"')

    const ancestorGate = deferred()
    let ancestorReadBlocked = false
    gatewayState.directoryGate = async (request) => {
      if (!ancestorReadBlocked && request.root === candidateCID && request.path === '') {
        ancestorReadBlocked = true
        await ancestorGate.promise
      }
    }

    await buttonByText(wrapper, 'Accept candidate root').trigger('click')
    await wrapper.vm.$nextTick()
    expect(ancestorReadBlocked).toBe(true)
    expect(buttonByText(wrapper, 'Buckets').attributes('disabled')).toBeDefined()

    ancestorGate.resolve()
    await flushPromises()
    expect(buttonByText(wrapper, 'Buckets').attributes('disabled')).toBeUndefined()
    expect(window.location.pathname).toBe(`/app/${candidateCID}/folder`)
    expect(window.history.state).toEqual({
      bucketID: writable.id,
      root: candidateCID,
      path: 'folder'
    })
  })

  it('never persists the API key in localStorage, sessionStorage, or history', async () => {
    const writable = bucket('private-files')
    installGateway({
      buckets: [writable],
      heads: { [writable.id]: populatedHead(writable.id) }
    })

    wrapper = mount(MaltApp, { attachTo: document.body })
    await signIn(wrapper)
    await openBucket(wrapper, writable.id)

    expect(storedValues(window.localStorage).join('\n')).not.toContain(apiKey)
    expect(storedValues(window.sessionStorage).join('\n')).not.toContain(apiKey)
    expect(JSON.stringify(window.history.state)).not.toContain(apiKey)
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)

    const signOutButton = wrapper
      .findAll('.malt-app__top-actions button')
      .find((candidate) => candidate.text().trim() === 'Sign out')
    expect(signOutButton).toBeDefined()
    await signOutButton.trigger('click')

    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })
})
