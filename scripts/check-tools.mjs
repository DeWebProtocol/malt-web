import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  appFallbackStorageKey,
  ancestorDirectoryPaths,
  buildAppStatePath,
  buildContentURL,
  buildUnixFSWriteURL,
  buildResolveURL,
  decodeProofListHeader,
  extractProofListInput,
  isAppStateRoute,
  joinMaltPath,
  parseAppFallbackRoute,
  parseAppStatePath,
  pathBasename,
  pathParent,
  profileStorageKey
} from '../docs/.vitepress/theme/malt-client.mjs'

const root = new URL('..', import.meta.url)
const docsRoot = path.join(root.pathname, 'docs')
const packageManifest = JSON.parse(fs.readFileSync(path.join(root.pathname, 'package.json'), 'utf8'))

assert.match(packageManifest.dependencies?.['markdown-it'] || '', /\^?\d+\.\d+\.\d+/)

const requiredFiles = [
  '404.md',
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
assert.match(configText, /transformHtml/)
assert.match(configText, /malt-app-fallback-path/)
assert.match(configText, /404\.html/)

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
  /openVerifierPage/,
  /malt-app__repo-bar/,
  /malt-app__sidebar/,
  /malt-app__tree/,
  /malt-app__tree-row/,
  /malt-app__content/,
  /malt-app__crumbbar/,
  /malt-app__browser-layout/,
  /malt-app__file-list/,
  /malt-app__row-spacer/,
  /malt-app__preview/,
  /malt-app__preview-layout/,
  /malt-app__preview-body/,
  /malt-app__preview-toolbar/,
  /malt-app__preview-tabs/,
  /malt-app__code-view/,
  /codeLines/,
  /MarkdownIt/,
  /malt-app__file-actions/,
  /malt-app__proof-sidebar/,
  /malt-app__proof-json/,
  /previewView/,
  /previewMode/,
  /previewTabs/,
  /displayPath/,
  /copyPreviewContent/,
  /openBreadcrumbPath/,
  /malt-app__icon-button/,
  /settingsOpen/,
  /malt-app__settings/,
  /Daemon URL/,
  /CAS URL/,
  /compareEntries/,
  /entryKindOrder/,
  /directoryCache/,
  /loadedTreeDirectories/,
  /treeExpanded/,
  /treeRows/,
  /treeRowStyle/,
  /treeIndentBasePx/,
  /treeIndentStepPx/,
  /ancestorDirectoryPaths/,
  /cacheDirectoryEntries/,
  /loadTreeAncestors/,
  /seedTreePath/,
  /toggleTreeDirectory/,
  /loadTreeDirectory/,
  /readDirectoryByPayload/,
  /openDirectory/,
  /previewFile/,
  /renderMarkdown/,
  /createMarkdownRenderer/,
  /isMarkdownPreview/,
  /isVideoPreview/,
  /isAudioPreview/,
  /isPDFPreview/,
  /downloadFile/,
  /proofViewMatches/,
  /proofStatusLabel/,
  /showProof/,
  /openMenuPath/,
  /parseAppStatePath/,
  /buildAppStatePath/,
  /syncBrowserLocation/,
  /consumeAppFallbackRoute/,
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
assert.match(
  appSource,
  /<div class="malt-app__top-actions">[\s\S]*@click="openVerifierPage"[\s\S]*>Verify page<\/button>[\s\S]*@click="settingsOpen = !settingsOpen"[\s\S]*>Settings<\/button>/
)
assert.match(appSource, /class="malt-app__proof-sidebar" aria-label="Directory ProofList"/)
assert.match(appSource, /class="malt-app__proof-sidebar" aria-label="File ProofList"/)
assert.match(appSource, /aria-label="Directory ProofList"[\s\S]*<template v-if="proofView">/)
assert.match(appSource, /proofViewMatches\(preview\.path\)/)
assert.doesNotMatch(appSource, /class="malt-app__status"/)
assert.doesNotMatch(appSource, /currentDirectoryVerified/)
assert.doesNotMatch(appSource, /const statusText = computed/)
assert.doesNotMatch(appSource, />Current proof<\/button>/)
assert.doesNotMatch(appSource, /@click="sendToVerifier"/)
assert.doesNotMatch(appSource, /function sendToVerifier\(/)
assert.doesNotMatch(appSource, /v-if="proofView && !previewView"/)
assert.doesNotMatch(appSource, /<dt>Verify<\/dt>/)
assert.doesNotMatch(appSource, /malt-app__sidebar-controls/)
assert.doesNotMatch(appSource, />root<\/button>/)
const toggleTreeDirectorySource = appSource.match(
  /async function toggleTreeDirectory\(entry\) \{[\s\S]*?\n\}\n\nasync function loadTreeDirectory/
)?.[0]
assert.ok(toggleTreeDirectorySource, 'toggleTreeDirectory function is missing')
assert.match(toggleTreeDirectorySource, /loadTreeDirectory\(entry\)/)
assert.match(toggleTreeDirectorySource, /loadedTreeDirectories\.value\[entry\.path\]/)
assert.doesNotMatch(toggleTreeDirectorySource, /openDirectory\(entry\)/)
const openAppRouteStateSource = appSource.match(
  /async function openAppRouteState\(routeState, options = \{\}\) \{[\s\S]*?\n\}\n\nasync function refreshDirectory/
)?.[0]
assert.ok(openAppRouteStateSource, 'openAppRouteState function is missing')
assert.match(openAppRouteStateSource, /await loadRoot\(routePath, \{ syncURL: false \}\)/)
assert.doesNotMatch(openAppRouteStateSource, /loadRoot\(routePath,\s*\{[^}]*payload:\s*stat\.payload/)
const loadTreeAncestorsSource = appSource.match(
  /async function loadTreeAncestors\(path\) \{[\s\S]*?\n\}\n\nasync function previewFile/
)?.[0]
assert.ok(loadTreeAncestorsSource, 'loadTreeAncestors function is missing')
assert.match(loadTreeAncestorsSource, /ancestorDirectoryPaths\(path\)/)
assert.match(loadTreeAncestorsSource, /loadedTreeDirectories\.value\[ancestorPath\]/)
assert.doesNotMatch(loadTreeAncestorsSource, /directoryCache\.value\[ancestorPath\]/)
assert.doesNotMatch(appSource, />\[\]<|>\[\]/)
assert.doesNotMatch(appSource, /\? \(node\.expanded \? 'v' : '>'\)/)
assert.match(appSource, /v-for="\(?crumb, index\)? in breadcrumbs"/)
assert.match(appSource, /v-if="index < breadcrumbs\.length - 1"/)
assert.match(appSource, /const displayPath = computed/)
assert.match(appSource, /previewView\.value && preview\.value\?\.path/)
assert.match(appSource, /const segments = displayPath\.value/)
assert.match(appSource, /async function openBreadcrumbPath\(crumb\)/)
assert.match(appSource, /crumb\.path === displayPath\.value/)
assert.match(appSource, /@click="openBreadcrumbPath\(crumb\)"/)
assert.match(appSource, /const canCopyPreviewContent = computed\(\(\) =>/)
assert.match(appSource, /const copyFeedbackVisible = ref\(false\)/)
assert.match(appSource, /const copyFeedbackDurationMs = 1500/)
assert.match(appSource, /async function copyPreviewContent\(\)/)
assert.match(appSource, /navigator\.clipboard\.writeText\(preview\.value\.body\)/)
assert.match(appSource, /showCopyFeedback\(\)/)
assert.match(appSource, /function showCopyFeedback\(\)/)
assert.match(appSource, /copyFeedbackVisible\.value = true/)
assert.match(appSource, /window\.setTimeout\(\(\) => \{/)
assert.match(appSource, /function resetCopyFeedback\(\)/)
assert.match(appSource, /window\.clearTimeout\(copyFeedbackTimer\)/)
assert.match(appSource, /resetCopyFeedback\(\)[\s\S]*?preview\.value = null/)
assert.doesNotMatch(appSource, /navigator\.clipboard\.writeText\(preview\.value\.path\)/)
assert.match(appSource, /<div class="malt-app__preview-body">[\s\S]*?<div class="malt-app__preview-toolbar"/)
assert.match(appSource, /<div class="malt-app__file-actions" aria-label="File actions">/)
assert.match(appSource, /:disabled="busy \|\| !canCopyPreviewContent"/)
assert.match(appSource, /:class="\{ 'is-copied': copyFeedbackVisible \}"/)
assert.match(appSource, /:title="copyFeedbackVisible \? 'Copied!' : 'Copy file content'"/)
assert.match(appSource, /:aria-label="copyFeedbackVisible \? 'Copied!' : 'Copy file content'"/)
assert.match(appSource, /class="malt-app__copy-toast"[\s\S]*Copied!/)
assert.match(appSource, /v-if="!copyFeedbackVisible"[\s\S]*M0 6\.75/)
assert.match(appSource, /v-else[\s\S]*M13\.78 4\.22/)
assert.match(appSource, /aria-label="Download file"/)
assert.match(appSource, /@click="copyPreviewContent"/)
assert.match(appSource, /@click="downloadFile\(\{ name: preview\.name, path: preview\.path, kind: 'file' \}\)"/)
assert.match(appSource, /v-for="tab in previewTabs"/)
assert.match(appSource, /previewMode = tab\.id/)
assert.match(appSource, /label:\s*'Preview'/)
assert.match(appSource, /label:\s*'Code'/)
assert.match(appSource, /v-if="preview\.kind === 'markdown' && previewMode === 'preview'"/)
assert.match(appSource, /class="malt-app__markdown"[\s\S]*v-html="preview\.markup"/)
assert.match(appSource, /preview\.kind === 'markdown' && previewMode === 'code'/)
assert.match(appSource, /v-for="\(?line, index\)? in codeLines"/)
assert.match(appSource, /\{\{ index \+ 1 \}\}/)
assert.match(appSource, /<code[\s\S]*>\{\{ line \|\| ' ' \}\}<\/code>/)
assert.match(appSource, /const markdownRenderer = createMarkdownRenderer\(\)/)
assert.match(appSource, /html:\s*false/)
assert.match(appSource, /linkify:\s*true/)
assert.match(appSource, /v-else-if="preview\.kind === 'video'"/)
assert.match(appSource, /<video[\s\S]*controls[\s\S]*class="malt-app__media"/)
assert.match(appSource, /v-else-if="preview\.kind === 'audio'"/)
assert.match(appSource, /<audio[\s\S]*controls[\s\S]*class="malt-app__audio"/)
assert.match(appSource, /v-else-if="preview\.kind === 'pdf'"/)
assert.match(appSource, /class="malt-app__pdf"/)
assert.match(appSource, /class="malt-app__media-stage is-image"/)
assert.match(appSource, /class="malt-app__media-stage is-video"/)
assert.match(appSource, /class="malt-app__media-stage is-audio"/)
assert.match(appSource, /class="malt-app__media-stage is-pdf"/)
assert.doesNotMatch(appSource, /function renderInlineMarkdown\(/)
assert.doesNotMatch(appSource, /function escapeHtml\(/)
assert.doesNotMatch(appSource, /function safeMarkdownHref\(/)
assert.doesNotMatch(appSource, /malt-app__breadcrumb-actions/)
assert.doesNotMatch(appSource, /function backToBrowser\(/)
assert.doesNotMatch(appSource, /@click="backToBrowser"/)
assert.doesNotMatch(appSource, />Back<\/button>/)
assert.doesNotMatch(appSource, />Preview<\/span>/)
assert.doesNotMatch(appSource, /<h2>\{\{ preview\.path \}\}<\/h2>/)
assert.doesNotMatch(appSource, /malt-app__preview-head/)
assert.doesNotMatch(appSource, /malt-app__preview-actions/)
assert.doesNotMatch(appSource, /@click="showProof\(\{ path: preview\.path, kind: 'file' \}\)"/)
assert.doesNotMatch(appSource, /Use Proof to load the current file proof/)
const openDirectorySource = appSource.match(
  /async function openDirectory\(entry\) \{[\s\S]*?\n\}\n\nasync function toggleTreeDirectory/
)?.[0]
assert.ok(openDirectorySource, 'openDirectory function is missing')
assert.match(openDirectorySource, /await loadRoot\(entry\.path\)/)
assert.doesNotMatch(openDirectorySource, /payload:\s*entry\.payload/)
const loadTreeDirectorySource = appSource.match(
  /async function loadTreeDirectory\(entry\) \{[\s\S]*?\n\}\n\nasync function loadTreeAncestors/
)?.[0]
assert.ok(loadTreeDirectorySource, 'loadTreeDirectory function is missing')
assert.match(loadTreeDirectorySource, /loadDirectoryEntries\(path,\s*entry\.payload\)/)
assert.match(appSource, /:style="treeRowStyle\(node\.depth\)"/)
assert.match(appSource, /document\.title\s*=\s*'App \| MALT'/)
assert.match(appSource, /await loadTreeAncestors\(currentPath\.value\)/)
assert.doesNotMatch(appSource, /runEntryAction\('preview'/)
assert.doesNotMatch(appSource, /malt-app__browser-head/)
assert.doesNotMatch(appSource, /type="file" multiple/)
assert.doesNotMatch(appSource, /webkitdirectory directory/)

const themeSource = fs.readFileSync(path.join(docsRoot, '.vitepress/theme/index.ts'), 'utf8')
assert.match(themeSource, /MaltApp/)
assert.match(themeSource, /isAppStateRoute/)
assert.match(themeSource, /DefaultTheme\.Layout/)

const clientSource = fs.readFileSync(path.join(docsRoot, '.vitepress/theme/malt-client.mjs'), 'utf8')
assert.match(clientSource, /readDirectoryByPayload/)
assert.match(clientSource, /X-Malt-Proof['"],\s*['"]omit/)
assert.match(clientSource, /appFallbackStorageKey/)
assert.match(clientSource, /parseAppFallbackRoute/)
assert.match(clientSource, /isAppStateRoute/)
assert.match(clientSource, /ancestorDirectoryPaths/)

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
  /--malt-tree-row-height:\s*32px/,
  /font-family:\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif/,
  /grid-template-columns:\s*296px minmax\(0, 1fr\)/,
  /\.malt-app__file-list/,
  /\.malt-app__browser-layout/,
  /\.malt-app__proof-sidebar/,
  /\.malt-app__preview-tabs/,
  /\.malt-app__code-view/,
  /\.malt-app__code-line/,
  /\.malt-app__code-line-number/,
  /\.malt-app__markdown/,
  /\.malt-app__media-stage/,
  /\.malt-app__media/,
  /\.malt-app__audio/,
  /\.malt-app__pdf/,
  /malt-app__dropzone/
]) {
  assert.match(customCSS, pattern)
}
assert.match(customCSS, /\.malt-app__tree-row\s*\{[\s\S]*?grid-template-columns:\s*16px minmax\(0, 1fr\)/)
assert.match(customCSS, /\.malt-app__tree-row\.is-active::before/)
assert.match(customCSS, /\.malt-app \.malt-app__tree-toggle,\s*\n\.malt-app \.malt-app__tree-link\s*\{[\s\S]*?appearance:\s*none/)
assert.match(customCSS, /\.malt-app \.malt-app__tree-toggle,\s*\n\.malt-app \.malt-app__tree-link\s*\{[\s\S]*?border:\s*0 !important/)
assert.match(customCSS, /\.malt-app \.malt-app__tree-toggle\s*\{[\s\S]*?width:\s*16px;[\s\S]*?padding:\s*0;/)
assert.match(customCSS, /\.malt-app \.malt-app__tree-link\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*20px minmax\(0, 1fr\);[\s\S]*?justify-content:\s*flex-start;[\s\S]*?padding:\s*0 8px 0 2px;/)
assert.doesNotMatch(customCSS, /\.malt-app__row button,\s*\n\.malt-app__name/)
assert.doesNotMatch(customCSS, /malt-app__sidebar-controls/)
assert.match(customCSS, /padding-left:\s*var\(--tree-indent,\s*12px\)/)
assert.doesNotMatch(customCSS, /var\(--tree-depth[\s\S]*\*/)
const crumbbarCSSRules = [...customCSS.matchAll(/\.malt-app__crumbbar\s*\{[\s\S]*?\n\}/g)]
  .map((match) => match[0])
assert.ok(crumbbarCSSRules.length > 0, 'crumbbar CSS rule is missing')
assert.ok(
  crumbbarCSSRules.some((rule) => /justify-content:\s*flex-start/.test(rule)),
  'crumbbar must align breadcrumb content to the left'
)
assert.ok(
  crumbbarCSSRules.every((rule) => !/justify-content:\s*space-between/.test(rule)),
  'crumbbar must not space breadcrumb content against a right-side action'
)
assert.doesNotMatch(customCSS, /malt-app__preview-head/)
assert.doesNotMatch(customCSS, /malt-app__preview-actions/)
assert.doesNotMatch(customCSS, /malt-app__breadcrumb-actions/)
assert.doesNotMatch(customCSS, /\.malt-app__status\s*\{/)
assert.doesNotMatch(customCSS, /\.malt-app__status\.is-valid/)
assert.doesNotMatch(customCSS, /\.malt-app__browser-toolbar/)
assert.match(customCSS, /\.malt-app__preview-toolbar\s*\{[\s\S]*?display:\s*flex/)
assert.match(customCSS, /\.malt-app__preview-tabs button\.is-active\s*\{[\s\S]*?background:\s*var\(--malt-gh-bg\)/)
assert.match(customCSS, /\.malt-app__file-actions\s*\{[\s\S]*?display:\s*inline-flex/)
assert.match(customCSS, /\.malt-app__copy-toast\s*\{[\s\S]*?position:\s*absolute/)
assert.match(customCSS, /\.malt-app__copy-toast::after\s*\{[\s\S]*?content:\s*""/)
assert.match(customCSS, /\.malt-app \.malt-app__icon-button\.is-copied\s*\{[\s\S]*?color:\s*var\(--malt-gh-success\)/)
assert.match(customCSS, /\.malt-app__code-line\s*\{[\s\S]*?grid-template-columns:\s*64px minmax\(0, 1fr\)/)
assert.match(customCSS, /\.malt-app__code-line-number\s*\{[\s\S]*?user-select:\s*none/)
assert.match(customCSS, /\.malt-app \.malt-app__icon-button\s*\{[\s\S]*?width:\s*32px;[\s\S]*?padding:\s*0;/)
assert.doesNotMatch(customCSS, /\.malt-app__preview-body pre,\s*\n\.malt-app__proof-json/)
assert.doesNotMatch(customCSS, /\.malt-app__preview-body pre\s*\{/)
const codeViewRule = customCSS.match(/\.malt-app__code-view\s*\{[\s\S]*?\n\}/)?.[0]
assert.ok(codeViewRule, 'code preview CSS rule is missing')
assert.match(codeViewRule, /overflow-x:\s*auto/)
assert.doesNotMatch(codeViewRule, /max-height/)
const codeLineCodeRule = customCSS.match(/\.malt-app__code-line code\s*\{[\s\S]*?\n\}/)?.[0]
assert.ok(codeLineCodeRule, 'code line CSS rule is missing')
assert.match(codeLineCodeRule, /white-space:\s*pre/)
assert.match(codeLineCodeRule, /overflow-wrap:\s*anywhere/)
const mediaStageRule = customCSS.match(/\.malt-app__media-stage\s*\{[\s\S]*?\n\}/)?.[0]
assert.ok(mediaStageRule, 'media preview stage CSS rule is missing')
assert.match(mediaStageRule, /place-items:\s*center/)
assert.match(customCSS, /\.malt-app__media-stage\.is-image\s*\{[\s\S]*?background-color:\s*var\(--malt-gh-bg\)/)
assert.match(customCSS, /\.malt-app__media-stage\.is-video\s*\{[\s\S]*?background:\s*#0d1117/)
assert.match(customCSS, /\.malt-app__media-stage\.is-audio\s*\{[\s\S]*?min-height:\s*180px/)
assert.match(customCSS, /\.malt-app__proof-json\s*\{[\s\S]*?max-height:/)
assert.match(customCSS, /\.malt-app__proof-json\s*\{[\s\S]*?overflow:\s*auto/)

const notFoundPage = fs.readFileSync(path.join(docsRoot, '404.md'), 'utf8')
assert.match(notFoundPage, /^# 404/m)

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
assert.equal(isAppStateRoute('/app', '/app/bafkqaaa'), true)
assert.equal(isAppStateRoute('/app', '/app/bafkqaaa/docs/read%20me'), true)
assert.equal(isAppStateRoute('/app', '/app'), false)
assert.equal(isAppStateRoute('/app', '/docs/runtime'), false)
assert.deepEqual(ancestorDirectoryPaths('malt/layout/unixfs/internal/format'), [
  '',
  'malt',
  'malt/layout',
  'malt/layout/unixfs',
  'malt/layout/unixfs/internal'
])
assert.deepEqual(ancestorDirectoryPaths('malt'), [''])
assert.deepEqual(ancestorDirectoryPaths(''), [])
assert.equal(appFallbackStorageKey, 'malt-app-fallback-path')
assert.deepEqual(
  parseAppFallbackRoute('/app', JSON.stringify({ pathname: '/app/bafkqaaa/docs/read%20me' })),
  { root: 'bafkqaaa', path: 'docs/read me' }
)
assert.equal(parseAppFallbackRoute('/app', JSON.stringify({ pathname: '/docs/runtime' })), null)
assert.equal(parseAppFallbackRoute('/app', 'not-json'), null)

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
