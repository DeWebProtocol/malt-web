import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildAppStatePath,
  buildContentURL,
  buildUnixFSWriteURL,
  buildResolveURL,
  decodeProofListHeader,
  extractProofListInput,
  joinMaltPath,
  parseAppStatePath,
  pathBasename,
  pathParent,
  profileStorageKey
} from '../docs/.vitepress/theme/malt-client.mjs'

const root = new URL('..', import.meta.url)
const docsRoot = path.join(root.pathname, 'docs')

const requiredFiles = [
  'app.md',
  'tools/resolve.md',
  'tools/verify.md',
  '.vitepress/theme/components/MaltApp.vue',
  '.vitepress/theme/components/MaltResolveTool.vue',
  '.vitepress/theme/components/MaltVerifyTool.vue',
  '.vitepress/theme/malt-client.mjs'
]

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(docsRoot, file)), `Missing browser tool file: ${file}`)
}

const configText = fs.readFileSync(path.join(docsRoot, '.vitepress/config.ts'), 'utf8')
assert.match(configText, /text:\s*'App'/)
assert.match(configText, /link:\s*'\/app'/)
assert.match(configText, /text:\s*'Tools'/)
assert.match(configText, /link:\s*'\/tools\/resolve'/)
assert.match(configText, /link:\s*'\/tools\/verify'/)

const appPage = fs.readFileSync(path.join(docsRoot, 'app.md'), 'utf8')
assert.match(appPage, /<MaltApp\s*\/>/)
assert.doesNotMatch(appPage, /^# App/m)

const appSource = fs.readFileSync(
  path.join(docsRoot, '.vitepress/theme/components/MaltApp.vue'),
  'utf8'
)
for (const pattern of [
  /localStorage/,
  /profileStorageKey/,
  /is-login/,
  /malt-app-page/,
  /Sign out/,
  /breadcrumb/,
  /handleDrop/,
  /beginPageDrag/,
  /handlePageDrop/,
  /dragDepth/,
  /window\.addEventListener\('drop', handlePageDrop\)/,
  /malt-app__dropzone/,
  /v-show="dropActive"/,
  /withDaemonTimeout/,
  /AbortController/,
  /malt-app__status-line/,
  /malt-app__repo-bar/,
  /malt-app__sidebar/,
  /malt-app__tree/,
  /malt-app__tree-row/,
  /malt-app__content/,
  /malt-app__crumbbar/,
  /malt-app__file-list/,
  /malt-app__row-spacer/,
  /malt-app__preview/,
  /malt-app__preview-layout/,
  /malt-app__preview-body/,
  /malt-app__proof-sidebar/,
  /malt-app__proof-json/,
  /backToBrowser/,
  /previewView/,
  /settingsOpen/,
  /malt-app__settings/,
  /Daemon URL/,
  /CAS URL/,
  /compareEntries/,
  /entryKindOrder/,
  /directoryCache/,
  /treeExpanded/,
  /treeRows/,
  /cacheDirectoryEntries/,
  /seedTreePath/,
  /toggleTreeDirectory/,
  /loadTreeDirectory/,
  /readDirectoryByPayload/,
  /openDirectory/,
  /previewFile/,
  /downloadFile/,
  /showProof/,
  /openMenuPath/,
  /parseAppStatePath/,
  /buildAppStatePath/,
  /syncBrowserLocation/,
  /window\.history\.pushState/,
  /window\.history\.replaceState/,
  /window\.addEventListener\('popstate', handleAppPopState\)/,
  /malt-app__menu/,
  /malt-app__more/,
  /verified-dot/,
  /malt-app__file-icon/,
  /malt-app__octicon/
]) {
  assert.match(appSource, pattern)
}
const toggleTreeDirectorySource = appSource.match(
  /async function toggleTreeDirectory\(entry\) \{[\s\S]*?\n\}\n\nasync function loadTreeDirectory/
)?.[0]
assert.ok(toggleTreeDirectorySource, 'toggleTreeDirectory function is missing')
assert.match(toggleTreeDirectorySource, /loadTreeDirectory\(entry\)/)
assert.doesNotMatch(toggleTreeDirectorySource, /openDirectory\(entry\)/)
assert.doesNotMatch(appSource, />\[\]<|>\[\]/)
assert.doesNotMatch(appSource, /\? \(node\.expanded \? 'v' : '>'\)/)
assert.match(appSource, /payload:\s*entry\.payload/)
assert.doesNotMatch(appSource, /runEntryAction\('preview'/)
assert.doesNotMatch(appSource, /malt-app__browser-head/)
assert.doesNotMatch(appSource, /type="file" multiple/)
assert.doesNotMatch(appSource, /webkitdirectory directory/)

const clientSource = fs.readFileSync(path.join(docsRoot, '.vitepress/theme/malt-client.mjs'), 'utf8')
assert.match(clientSource, /readDirectoryByPayload/)
assert.match(clientSource, /X-Malt-Proof['"],\s*['"]omit/)

const customCSS = fs.readFileSync(path.join(docsRoot, '.vitepress/theme/custom.css'), 'utf8')
for (const pattern of [
  /body\.malt-app-page\s+\.VPNav/,
  /body\.malt-app-page\s+\.VPSidebar/,
  /body\.malt-app-page\s+\.VPLocalNav/,
  /body\.malt-app-page\s+\.VPContent\.has-sidebar/,
  /body\.malt-app-page\s+\.VPDocFooter/,
  /body\.malt-app-page\s+\.VPFooter/,
  /--malt-gh-border/,
  /--malt-gh-muted/,
  /font-family:\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif/,
  /grid-template-columns:\s*296px minmax\(0, 1fr\)/,
  /\.malt-app__file-list/,
  /\.malt-app__proof-sidebar/,
  /malt-app__dropzone/
]) {
  assert.match(customCSS, pattern)
}

const resolvePage = fs.readFileSync(path.join(docsRoot, 'tools/resolve.md'), 'utf8')
assert.match(resolvePage, /<MaltResolveTool\s*\/>/)

const verifyPage = fs.readFileSync(path.join(docsRoot, 'tools/verify.md'), 'utf8')
assert.match(verifyPage, /<MaltVerifyTool\s*\/>/)

assert.equal(
  buildResolveURL('http://127.0.0.1:4317/', 'bafkqaaa', 'docs/read me').toString(),
  'http://127.0.0.1:4317/resolve/bafkqaaa/docs/read%20me'
)
assert.equal(
  buildContentURL('http://127.0.0.1:4317', 'bafkqaaa', 'docs/read me').toString(),
  'http://127.0.0.1:4317/bafkqaaa/docs/read%20me'
)
assert.equal(
  buildUnixFSWriteURL('http://127.0.0.1:4317', '', 'docs/read me').toString(),
  'http://127.0.0.1:4317/_unixfs?path=docs%2Fread+me'
)
assert.equal(
  buildUnixFSWriteURL('http://127.0.0.1:4317', 'bafkqaaa', 'docs/read me').toString(),
  'http://127.0.0.1:4317/bafkqaaa/docs/read%20me'
)
assert.equal(
  buildAppStatePath('/app', 'bafkqaaa', 'docs/read me'),
  '/app/bafkqaaa/docs/read%20me'
)
assert.equal(
  buildAppStatePath('/malt/app/', 'bafkqaaa', 'docs/read me'),
  '/malt/app/bafkqaaa/docs/read%20me'
)
assert.deepEqual(parseAppStatePath('/app', '/app/bafkqaaa/docs/read%20me'), {
  root: 'bafkqaaa',
  path: 'docs/read me'
})
assert.deepEqual(parseAppStatePath('/malt/app', '/malt/app/bafkqaaa/docs/read%20me'), {
  root: 'bafkqaaa',
  path: 'docs/read me'
})
assert.deepEqual(parseAppStatePath('/app', '/app'), { root: '', path: '' })
assert.equal(parseAppStatePath('/app', '/docs/runtime'), null)

const proofList = { root: 'bafkqaaa', query: 'docs/readme', target: 'bafkreihash', steps: [] }
const encoded = Buffer.from(JSON.stringify(proofList), 'utf8').toString('base64url')
assert.deepEqual(decodeProofListHeader(encoded), proofList)
assert.deepEqual(extractProofListInput(JSON.stringify({ prooflist: proofList })), proofList)
assert.deepEqual(extractProofListInput(JSON.stringify(proofList)), proofList)

assert.equal(joinMaltPath('', 'docs'), 'docs')
assert.equal(joinMaltPath('docs', 'readme.md'), 'docs/readme.md')
assert.equal(pathParent('docs/readme.md'), 'docs')
assert.equal(pathParent('docs'), '')
assert.equal(pathBasename('docs/readme.md'), 'readme.md')
assert.equal(profileStorageKey('alice'), 'malt-app-profile:alice')

console.log('Browser tool contract passed.')
