import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildContentURL,
  buildUnixFSWriteURL,
  buildResolveURL,
  decodeProofListHeader,
  extractProofListInput,
  joinMaltPath,
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
  /Sign out/,
  /breadcrumb/,
  /handleDrop/,
  /malt-app__dropzone/,
  /settingsOpen/,
  /malt-app__settings/,
  /Daemon URL/,
  /CAS URL/,
  /openDirectory/,
  /previewFile/,
  /downloadFile/,
  /showProof/,
  /openMenuPath/,
  /malt-app__menu/,
  /⋮/,
  /verified-dot/,
  /malt-app__file-icon/
]) {
  assert.match(appSource, pattern)
}
assert.doesNotMatch(appSource, /type="file" multiple/)
assert.doesNotMatch(appSource, /webkitdirectory directory/)

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
