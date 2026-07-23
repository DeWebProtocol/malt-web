import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'

import {
	appendBucketStashValue,
	applyBucketStashResult,
	assertBucketStashLegacyBinding,
	assertBucketStashScope,
	bindLegacyBucketStashValue,
	appFallbackStorageKey,
	ancestorDirectoryPaths,
	buildAppStatePath,
	buildCASURL,
	buildBucketURL,
	buildReadURL,
	buildResolveURL,
	buildVerifyReadURL,
	buildVerifyResolveURL,
	bucketStashNamespace,
	bucketStashStorageKey,
	canonicalGatewayBaseURL,
	createBucketStashScope,
	decodeProofListHeader,
	extractProofListInput,
	extractVerificationInput,
	fetchBuckets,
	fetchBucketHead,
	fetchGatewayIdentity,
  isAppStateRoute,
	joinMaltPath,
	legacyBucketStashBindingNamespace,
	legacyBucketStashBindingStorageKey,
	legacyBucketStashStorageKey,
	mergeObservedBucketHead,
  parseAppFallbackRoute,
  parseAppStatePath,
  pathBasename,
  pathParent,
	profileStorageKey,
	pushBucketRoot,
	readPayloadBlock,
	readBucketStashValues,
	readLegacyBucketStashValues,
	readProfile,
	normalizeUploadPath,
	resolveProfile
} from '../docs/.vitepress/theme/malt-client.mjs'
import {
	createResolveVerification,
	readVerificationsFromProofList,
	resolveVerificationFromProofList,
	verifyContentProofLocally,
	verifyResolveLocally
} from '../docs/.vitepress/theme/malt-verifier.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const docsRoot = path.join(root, '..', 'docs')
const packageManifest = JSON.parse(fs.readFileSync(path.join(root, '..', 'package.json'), 'utf8'))
assert.match(packageManifest.dependencies?.['markdown-it'] || '', /\^?\d+\.\d+\.\d+/)
assert.match(packageManifest.dependencies?.shiki || '', /\^?\d+\.\d+\.\d+/)

const requiredFiles = [
  '404.md',
  'app.md',
  'tools/resolve.md',
  'tools/verify.md',
  '.vitepress/theme/components/MaltApp.vue',
  '.vitepress/theme/components/MaltResolveTool.vue',
  '.vitepress/theme/components/MaltVerifyTool.vue',
  '.vitepress/theme/malt-client.mjs',
  '.vitepress/theme/malt-payload-verifier.mjs',
  '.vitepress/theme/malt-verifier.mjs',
  'public/verifier/wasm_exec.js',
  'public/verifier/malt-verifier.wasm',
  'public/verifier/PROVENANCE.json',
  'public/verifier/SHA256SUMS'
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
  /import\('shiki'\)/,
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
  /bucketPickerOpen/,
  /malt-app__settings/,
  /Gateway URL/,
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
  /openDirectory/,
  /previewFile/,
  /renderMarkdown/,
  /createMarkdownRenderer/,
  /inferPreviewLanguage/,
  /previewLanguageByFilename/,
  /previewLanguageByExtension/,
  /highlightCode/,
  /highlightMarkdownFence/,
  /extractShikiLines/,
  /escapeHTML/,
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
for (const pattern of [
  /'go\.mod',\s*'shellscript'/,
  /'go\.sum',\s*'shellscript'/,
  /'dockerfile',\s*'docker'/,
  /'makefile',\s*'make'/,
  /'go',\s*'go'/,
  /'rs',\s*'rust'/,
  /'c',\s*'c'/,
  /'h',\s*'c'/,
  /'toml',\s*'toml'/,
  /'yaml',\s*'yaml'/
]) {
  assert.match(appSource, pattern)
}
assert.match(appSource, /\^\(go\\\.mod\|go\\\.sum\|Dockerfile\|Makefile\)\$/)
assert.match(appSource, /c\|h\|cc\|cpp\|cxx\|hpp/)
assert.match(
  appSource,
  /<div class="malt-app__top-actions">[\s\S]*@click="openVerifierPage"[\s\S]*>Verify page<\/button>[\s\S]*@click="bucketPickerOpen = !bucketPickerOpen"[\s\S]*Buckets[\s\S]*<\/button>/
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
  /async function loadTreeAncestors\(path, snapshot = captureWorkspaceSnapshot\(currentPath\.value\)\) \{[\s\S]*?\n\}\n\nasync function previewFile/
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
assert.match(appSource, /:disabled="interactionBusy \|\| !canCopyPreviewContent"/)
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
assert.match(appSource, /<code role="cell" v-html="line\.markup"><\/code>/)
assert.match(appSource, /const markdownRenderer = createMarkdownRenderer\(\)/)
assert.match(appSource, /html:\s*false/)
assert.match(appSource, /linkify:\s*true/)
assert.match(appSource, /highlight:\s*highlightMarkdownFence/)
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
assert.match(loadTreeDirectorySource, /loadDirectoryEntries\(path,\s*'',\s*\{ omitProof: false \}\)/)
assert.match(loadTreeDirectorySource, /await verifyContentAndMark\(path, manifest\)/)
assert.match(appSource, /:style="treeRowStyle\(node\.depth\)"/)
assert.match(appSource, /document\.title\s*=\s*'App \| MALT'/)
assert.match(appSource, /await loadTreeAncestors\(routePath, snapshot\)/)
assert.match(appSource, /directory response did not include ProofList material/)
assert.match(appSource, /file response did not include ProofList material/)
assert.match(appSource, /await verifyContentAndMark\(ancestorPath, manifest, snapshot\)/)
assert.match(appSource, /async function verifyContentAndMark\(path, payload, snapshot = null\)/)
assert.match(appSource, /resolveVerificationFromProofList/)
assert.match(appSource, /verifyContentProofLocally/)
assert.match(appSource, /verifyPayloadBytes/)
assert.match(appSource, /readPayloadBlock/)
assert.match(appSource, /async function acceptCandidateRoot\(\)/)
assert.match(appSource, />\s*Accept candidate root\s*</)
assert.match(appSource, /Gateway API key/)
assert.match(appSource, /Refresh head/)
assert.match(appSource, /fetchGatewayIdentity\(\{ baseURL: baseURL\.value, apiKey: token, signal \}\)/)
assert.match(appSource, /fetchBuckets\(\{ baseURL: baseURL\.value, apiKey: token, signal \}\)/)
assert.match(appSource, /async function selectBucket\(bucket\)/)
assert.match(appSource, /await observeBucketHead\(\)[\s\S]*await useObservedBucketHead\(\)/)
assert.match(appSource, /v-for="bucket in buckets"/)
assert.match(appSource, /VITE_MALT_MANAGED_GATEWAY_URL/)
assert.match(appSource, /v-if="!managedDeployment"[\s\S]*Gateway URL/)
const bucketPickerSource = appSource.match(
	/<section v-if="bucketPickerOpen"[\s\S]*?<\/section>\n\s*<\/section>/
)?.[0]
assert.ok(bucketPickerSource, 'Bucket picker is missing')
assert.doesNotMatch(bucketPickerSource, /<input/)
assert.doesNotMatch(bucketPickerSource, />\s*Root\s*</)
assert.doesNotMatch(bucketPickerSource, />\s*Gateway URL\s*</)
assert.doesNotMatch(bucketPickerSource, />\s*Bucket ID\s*</)
assert.doesNotMatch(bucketPickerSource, />\s*API key\s*</)
const signInSource = appSource.match(
	/async function signIn\(\) \{[\s\S]*?\n\}\n\nfunction signOut/
)?.[0]
assert.ok(signInSource, 'Gateway sign-in flow is missing')
assert.ok(
	signInSource.indexOf('fetchGatewayIdentity') < signInSource.indexOf('apiKey.value = token'),
	'The API key must not establish a signed-in session before identity validation succeeds'
)
assert.ok(
	signInSource.indexOf('fetchBuckets') < signInSource.indexOf('apiKey.value = token'),
	'The API key must not establish a signed-in session before Bucket discovery succeeds'
)
assert.doesNotMatch(signInSource, /localStorage/)
const selectBucketSource = appSource.match(
	/async function selectBucket\(bucket\) \{[\s\S]*?\n\}\n\nfunction gatewayAccess/
)?.[0]
assert.ok(selectBucketSource, 'Bucket selection flow is missing')
assert.ok(
	selectBucketSource.indexOf('resetBucketWorkspace()') <
		selectBucketSource.indexOf('bucketID.value = selected.id'),
	'Bucket selection must clear the previous Bucket workspace before binding the new Bucket'
)
assert.ok(
	selectBucketSource.indexOf('await observeBucketHead()') <
		selectBucketSource.indexOf('await useObservedBucketHead()'),
	'Bucket selection must validate the selected head before opening its root'
)
const signOutSource = appSource.match(
	/function signOut\(\) \{[\s\S]*?\n\}\n\nfunction resetBucketWorkspace/
)?.[0]
assert.ok(signOutSource, 'Sign-out flow is missing')
assert.match(signOutSource, /apiKey\.value = ''/)
assert.match(signOutSource, /identity\.value = null/)
assert.match(signOutSource, /buckets\.value = \[\]/)
assert.match(appSource, /async function pushUploadedCandidate\(candidateRoot, base\)/)
assert.match(appSource, /async function retryBucketStash\(stash\)/)
assert.match(appSource, /async function restoreBucketStash\(stash\)/)
assert.match(appSource, /window\.addEventListener\('storage', handleBucketStorageChange\)/)
assert.match(appSource, /event\.key\.startsWith\(loadedBucketStashNamespace\.value\)/)
assert.match(appSource, /readLegacyBucketStashValues\(window\.localStorage, scope\)/)
assert.match(appSource, /async function bindLegacyBucketStash\(stash\)/)
assert.match(appSource, />\s*Bind to this Gateway\s*</)
assert.match(appSource, /legacyBindingSupported/)
assert.match(appSource, /lockManager:\s*globalThis\.navigator\?\.locks/)
assert.match(appSource, /stash\.status === 'pending' && !stash\.legacy/)
assert.match(appSource, /:disabled="interactionBusy \|\| stash\.legacy \|\| !bucketConfigured"/)
assert.match(appSource, />\s*Retry push\s*</)
assert.match(appSource, />\s*Use candidate\s*</)
const pushUploadedCandidateSource = appSource.match(
	/async function pushUploadedCandidate\(candidateRoot, base\) \{[\s\S]*?\n\}/
)?.[0]
assert.ok(pushUploadedCandidateSource, 'Bucket push orchestration is missing')
assert.ok(
	pushUploadedCandidateSource.indexOf('saveBucketStash') <
		pushUploadedCandidateSource.indexOf('observeBucketHead'),
	'Bucket candidate must be stashed before fetching the remote head'
)
const retryBucketStashSource = appSource.match(
	/async function retryBucketStash\(stash\) \{[\s\S]*?\n\}\n\nasync function restoreBucketStash/
)?.[0]
assert.ok(retryBucketStashSource, 'Bucket stash retry is missing')
assert.match(retryBucketStashSource, /assertBucketStashScope\(stash, currentBucketStashScope\(\)\)/)
assert.match(retryBucketStashSource, /pushID:\s*stash\.pushID/)
assert.match(retryBucketStashSource, /baseCommit:\s*stash\.base\?\.commitID/)
assert.match(retryBucketStashSource, /baseRoot:\s*stash\.base\?\.root/)
assert.match(retryBucketStashSource, /baseRevision:\s*stash\.base\?\.revision/)
assert.match(retryBucketStashSource, /candidateRoot:\s*stash\.candidateRoot/)
assert.match(retryBucketStashSource, /baseURL:\s*scope\.baseURL/)
assert.match(retryBucketStashSource, /bucketID:\s*scope\.bucketID/)
assert.ok(
	retryBucketStashSource.match(/assertBucketStashLegacyBinding\(window\.localStorage, stash\)/g)?.length >= 3,
	'Legacy binding provenance must be checked before and after refresh and before retry push'
)
assert.ok(
	retryBucketStashSource.indexOf('assertBucketStashScope(stash, currentBucketStashScope())') <
		retryBucketStashSource.indexOf('await observeBucketHead(scope)'),
	'Bucket stash scope must be checked before any retry network request'
)
assert.ok(
	retryBucketStashSource.indexOf('await withDaemonTimeout') <
		retryBucketStashSource.indexOf('finishBucketStash(stash, result)'),
	'Bucket stash must only be finished after a validated retry result'
)
const finishBucketStashSource = appSource.match(
	/function finishBucketStash\(stash, result\) \{[\s\S]*?\n\}/
)?.[0]
assert.ok(finishBucketStashSource, 'Bucket stash completion is missing')
assert.match(finishBucketStashSource, /assertBucketStashScope\(stash, currentBucketStashScope\(\)\)/)
assert.match(finishBucketStashSource, /assertBucketStashLegacyBinding\(window\.localStorage, stash\)/)
assert.match(finishBucketStashSource, /applyBucketStashResult\(window\.localStorage, stash, result\)/)
const restoreBucketStashSource = appSource.match(
	/async function restoreBucketStash\(stash\) \{[\s\S]*?\n\}\n\nfunction captureBucketBase/
)?.[0]
assert.ok(restoreBucketStashSource, 'Bucket stash restore is missing')
assert.match(restoreBucketStashSource, /assertBucketStashScope\(stash, currentBucketStashScope\(\)\)/)
assert.match(restoreBucketStashSource, /assertBucketStashLegacyBinding\(window\.localStorage, stash\)/)
assert.ok(
	restoreBucketStashSource.indexOf('assertBucketStashScope(stash, currentBucketStashScope())') <
		restoreBucketStashSource.indexOf('await loadRoot'),
	'Unscoped legacy candidates must fail before any restore read'
)
assert.match(appSource, /function recordObservedBucketHead\(observed, scope\)/)
assert.match(appSource, /function calculateObservedBucketHead\(observed, scope\)/)
assert.match(appSource, /function storeObservedBucketHead\(observed, scope\)/)
assert.match(appSource, /mergeObservedBucketHead/)
for (const [source, label] of [
	[retryBucketStashSource, 'retry'],
	[pushUploadedCandidateSource, 'new push']
]) {
	const calculateIndex = source.indexOf('calculateObservedBucketHead(result.head, scope)')
	const finishIndex = source.indexOf('finishBucketStash(stash, result)')
	const storeIndex = source.indexOf('storeObservedBucketHead(mergedObservedHead, scope)')
	assert.ok(calculateIndex >= 0 && calculateIndex < finishIndex, `${label} must validate the observed head before finishing its stash`)
	assert.ok(finishIndex < storeIndex, `${label} must finish its stash before storing the validated observed head`)
	assert.ok(storeIndex < source.indexOf('persistProfile()'), `${label} must persist only after storing the validated observed head`)
}
const persistProfileSource = appSource.match(
	/function persistProfile\(\) \{[\s\S]*?\n\}/
)?.[0]
assert.ok(persistProfileSource, 'persistProfile is missing')
assert.doesNotMatch(persistProfileSource, /apiKey/)
const handleDropSource = appSource.match(
	/async function handleDrop\(event\) \{[\s\S]*?\n\}\n\nasync function droppedUploadItems/
)?.[0]
assert.ok(handleDropSource, 'drop handler is missing')
assert.ok(
	handleDropSource.indexOf('busy.value = true') <
		handleDropSource.indexOf('await droppedUploadItems(event.dataTransfer)'),
	'File-drop interaction must be locked before asynchronous directory traversal'
)
assert.ok(
	handleDropSource.indexOf('captureUploadContext()') <
		handleDropSource.indexOf('await droppedUploadItems(event.dataTransfer)'),
	'Upload scope/root/path must be captured before asynchronous directory traversal'
)
assert.match(handleDropSource, /uploadDropped\(uploadItems, uploadContext\)/)
const captureUploadContextSource = appSource.match(
	/function captureUploadContext\(\) \{[\s\S]*?\n\}\n\nasync function uploadDropped/
)?.[0]
assert.ok(captureUploadContextSource, 'upload-context capture is missing')
assert.match(captureUploadContextSource, /captureBucketBase\(materializationRoot\)/)
const uploadDroppedSource = appSource.match(
  /async function uploadDropped\(uploadItems, uploadContext\) \{[\s\S]*?\n\}\n\nasync function acceptCandidateRoot/
)?.[0]
assert.ok(uploadDroppedSource, 'uploadDropped function is missing')
assert.match(uploadDroppedSource, /pushUploadedCandidate\(currentRoot, bucketBase\)/)
assert.doesNotMatch(uploadDroppedSource, /root\.value\s*=\s*currentRoot/)
assert.match(uploadDroppedSource, /candidateRoot:\s*currentRoot/)
assert.match(uploadDroppedSource, /verifyExistingContent/)
assert.match(uploadDroppedSource, /verifyExistingResolve/)
assert.match(uploadDroppedSource, /verifyResolveLocally/)
assert.doesNotMatch(appSource, /readDirectoryByPayload/)
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
assert.match(clientSource, /buildCASURL/)
assert.match(clientSource, /putPayloadBlock/)
assert.match(clientSource, /createStructure/)
assert.match(clientSource, /appFallbackStorageKey/)
assert.match(clientSource, /parseAppFallbackRoute/)
assert.match(clientSource, /isAppStateRoute/)
assert.match(clientSource, /ancestorDirectoryPaths/)
assert.match(clientSource, /export async function readPayloadBlock/)
assert.match(clientSource, /assertBlockMatchesCID/)
assert.match(clientSource, /verified existing-root callbacks are required/)

const verifierSource = fs.readFileSync(
  path.join(docsRoot, '.vitepress/theme/malt-verifier.mjs'),
  'utf8'
)
assert.match(verifierSource, /globalThis\.maltVerifyResolve/)
assert.match(verifierSource, /globalThis\.maltVerifyRead/)
assert.match(verifierSource, /WebAssembly\.instantiateStreaming/)
assert.match(verifierSource, /source: 'local-wasm'/)
assert.match(verifierSource, /trusted resolve root is required/)
assert.doesNotMatch(verifierSource, /v1\/artifacts\/verify/)
assert.match(verifierSource, /readVerificationsFromProofList/)

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
assert.match(codeLineCodeRule, /tab-size:\s*2/)
assert.match(codeLineCodeRule, /overflow-wrap:\s*normal/)
assert.match(customCSS, /\.malt-app__code-line code span,[\s\S]*?\.malt-app__markdown \.shiki span\s*\{[\s\S]*?--shiki-light/)
assert.match(customCSS, /\.dark \.malt-app__code-line code span,[\s\S]*?\.dark \.malt-app__markdown \.shiki span\s*\{[\s\S]*?--shiki-dark/)
assert.match(customCSS, /\.malt-app__markdown table\s*\{[\s\S]*?border-collapse:\s*collapse/)
assert.match(customCSS, /\.malt-app__markdown th,[\s\S]*?\.malt-app__markdown td\s*\{[\s\S]*?border:\s*1px solid var\(--malt-gh-border\)/)
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
  buildResolveURL('http://127.0.0.1:8080/', 'bafkqaaa', 'docs/read me').toString(),
  'http://127.0.0.1:8080/v1/resolve'
)
assert.equal(
  buildReadURL('http://127.0.0.1:8080').toString(),
  'http://127.0.0.1:8080/v1/read'
)
assert.equal(
  buildVerifyResolveURL('http://127.0.0.1:8080').toString(),
  'http://127.0.0.1:8080/v1/verify/resolve'
)
assert.equal(
  buildVerifyReadURL('http://127.0.0.1:8080').toString(),
  'http://127.0.0.1:8080/v1/verify/read'
)
assert.equal(
  buildCASURL('http://127.0.0.1:8080', 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku').toString(),
  'http://127.0.0.1:8080/v1/cas/bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
)
assert.equal(
	buildBucketURL('http://127.0.0.1:8080', 'bkt_one', ['head']).toString(),
	'http://127.0.0.1:8080/v1/buckets/bkt_one/head'
)
assert.equal(
	buildResolveURL('http://127.0.0.1:8080', 'bafkqaaa', '', 'bkt_one').toString(),
	'http://127.0.0.1:8080/v1/buckets/bkt_one/resolve'
)
assert.equal(normalizeUploadPath('dir/read me.txt'), 'dir/read me.txt')
assert.equal(normalizeUploadPath('100%/value%2F.txt'), '100%/value%2F.txt')
for (const invalidPath of ['/absolute', 'trailing/', 'a//b', 'a/../b', '@payload']) {
  assert.throws(() => normalizeUploadPath(invalidPath), /upload path|unsupported UnixFS path/)
}

const originalFetch = globalThis.fetch
const accountRequests = []
globalThis.fetch = async (url, options = {}) => {
	accountRequests.push({ url: String(url), options })
	if (String(url).endsWith('/v1/me')) {
		return new Response(
			JSON.stringify({
				tenant_id: 'tenant-one',
				principal_id: 'alice',
				credential_id: 'key-one'
			})
		)
	}
	return new Response(
		JSON.stringify({
			buckets: [
				{
					id: 'bkt_one',
					tenant_id: 'tenant-one',
					name: 'Alice files',
					state: 'active',
					role: 'owner',
					created_by: 'alice',
					created_at: '2026-07-23T00:00:00Z',
					updated_at: '2026-07-23T00:00:00Z'
				}
			]
		})
	)
}
assert.deepEqual(
	await fetchGatewayIdentity({
		baseURL: 'https://alpha.example/api',
		apiKey: 'secret'
	}),
	{ tenant_id: 'tenant-one', principal_id: 'alice', credential_id: 'key-one' }
)
assert.deepEqual(
	await fetchBuckets({
		baseURL: 'https://alpha.example/api',
		apiKey: 'secret'
	}),
	[
		{
			id: 'bkt_one',
			tenant_id: 'tenant-one',
			name: 'Alice files',
			state: 'active',
			role: 'owner',
			created_by: 'alice',
			created_at: '2026-07-23T00:00:00Z',
			updated_at: '2026-07-23T00:00:00Z'
		}
	]
)
assert.equal(accountRequests[0].url, 'https://alpha.example/api/v1/me')
assert.equal(accountRequests[1].url, 'https://alpha.example/api/v1/buckets')
for (const request of accountRequests) {
	assert.equal(request.options.headers.Authorization, 'Bearer secret')
	assert.equal(request.options.redirect, 'error')
	assert.equal(request.options.cache, 'no-store')
}
globalThis.fetch = async () => new Response(JSON.stringify({ tenant_id: 'tenant-one' }))
await assert.rejects(
	fetchGatewayIdentity({ baseURL: 'https://alpha.example/api', apiKey: 'secret' }),
	/incomplete identity/
)
globalThis.fetch = async () =>
	new Response(
		JSON.stringify({
			buckets: [{ id: 'bkt_one', tenant_id: 'tenant-one', name: 'Alice files', state: 'active', role: 'invalid' }]
		})
	)
await assert.rejects(
	fetchBuckets({ baseURL: 'https://alpha.example/api', apiKey: 'secret' }),
	/invalid Bucket metadata/
)
const duplicateBucket = {
	id: 'bkt_one',
	tenant_id: 'tenant-one',
	name: 'Alice files',
	state: 'active',
	role: 'owner'
}
globalThis.fetch = async () =>
	new Response(JSON.stringify({ buckets: [duplicateBucket, duplicateBucket] }))
await assert.rejects(
	fetchBuckets({ baseURL: 'https://alpha.example/api', apiKey: 'secret' }),
	/duplicate Buckets/
)
globalThis.fetch = async () =>
	new Response(JSON.stringify({ message: 'tenant bearer token is required' }), { status: 401 })
await assert.rejects(
	fetchGatewayIdentity({ baseURL: 'https://alpha.example/api', apiKey: 'wrong' }),
	/gateway API error \(401\): tenant bearer token is required/
)
const casBytes = new TextEncoder().encode('verified CAS bytes')
const casCID = CID.createV1(raw.code, await sha256.digest(casBytes)).toString()
let payloadFetchCount = 0
globalThis.fetch = async () => {
	payloadFetchCount += 1
	return new Response(casBytes)
}
await assert.rejects(
	readPayloadBlock({ baseURL: 'http://127.0.0.1:8080', cid: casCID }),
	/managed Bucket ID and API key are required/
)
assert.equal(payloadFetchCount, 0, 'Unscoped payload reads must fail before fetch')
let payloadRequest
globalThis.fetch = async (url, options = {}) => {
	payloadRequest = { url: String(url), options }
	return new Response(casBytes)
}
assert.deepEqual(
	await readPayloadBlock({
		baseURL: 'http://127.0.0.1:8080',
		bucketID: 'bkt_one',
		apiKey: 'secret',
		cid: casCID
	}),
	casBytes
)
assert.equal(payloadRequest.url, `http://127.0.0.1:8080/v1/buckets/bkt_one/cas/${casCID}`)
assert.equal(payloadRequest.options.headers.Authorization, 'Bearer secret')
assert.equal(payloadRequest.options.redirect, 'error')
globalThis.fetch = async () => new Response(new TextEncoder().encode('tampered CAS bytes'))
await assert.rejects(
	readPayloadBlock({
		baseURL: 'http://127.0.0.1:8080',
		bucketID: 'bkt_one',
		apiKey: 'secret',
		cid: casCID
	}),
  /do not match requested CID/
)
let bucketRequest
globalThis.fetch = async (url, options = {}) => {
	bucketRequest = { url: String(url), options }
	return new Response(
		JSON.stringify({
			bucket_id: 'bkt_one',
			name: 'main',
			kind: 'main',
			state: 'open',
			commit_id: 'cmt_one',
			root: casCID,
			revision: 1
		}),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	)
}
const observedHead = await fetchBucketHead({
	baseURL: 'http://127.0.0.1:8080',
	bucketID: 'bkt_one',
	apiKey: 'secret'
})
assert.equal(observedHead.commit_id, 'cmt_one')
assert.equal(bucketRequest.options.headers.Authorization, 'Bearer secret')
assert.equal(bucketRequest.options.redirect, 'error')

await assert.rejects(
	fetchBucketHead({
		baseURL: 'http://gateway.example',
		bucketID: 'bkt_one',
		apiKey: 'secret'
	}),
	/require HTTPS or a loopback HTTP Gateway/
)

globalThis.fetch = async () =>
	new Response(JSON.stringify({ ...observedHead, kind: 'explicit' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	})
await assert.rejects(
	fetchBucketHead({
		baseURL: 'http://127.0.0.1:8080',
		bucketID: 'bkt_one',
		apiKey: 'secret'
	}),
	/unexpected Bucket ref/
)

const candidateCommit = {
	id: 'cmt_candidate',
	bucket_id: 'bkt_one',
	root: casCID,
	parents: ['cmt_one'],
	base_root: casCID,
	message: 'web upload',
	author: 'alice',
	created_at: '2026-07-22T00:00:00Z'
}
const bucketPushRequest = {
	baseURL: 'http://127.0.0.1:8080',
	bucketID: 'bkt_one',
	apiKey: 'secret',
	pushID: 'push_one',
	baseCommit: 'cmt_one',
	baseRoot: casCID,
	baseRevision: 1,
	candidateRoot: casCID,
	message: 'web upload'
}
globalThis.fetch = async (url, options = {}) => {
	bucketRequest = { url: String(url), options }
	return new Response(
		JSON.stringify({
			status: 'branched',
			head: observedHead,
			commit: candidateCommit,
			candidate: candidateCommit,
			branch: {
				...observedHead,
				name: 'conflicts/alice/one',
				kind: 'conflict',
				commit_id: candidateCommit.id,
				root: candidateCommit.root
			},
			merge_base: casCID,
			conflicts: [{ coordinate: 'docs/readme' }]
		}),
		{ status: 409, headers: { 'Content-Type': 'application/json' } }
	)
}
const pushed = await pushBucketRoot(bucketPushRequest)
assert.equal(pushed.status, 'branched')
const bucketPushBody = JSON.parse(bucketRequest.options.body)
assert.equal(bucketPushBody.base_commit, 'cmt_one')
assert.equal(bucketPushBody.base_revision, 1)
assert.equal('expected_head_revision' in bucketPushBody, false)

function storageClient(values, hooks = {}) {
	return {
		get length() {
			return values.size
		},
		key(index) {
			return Array.from(values.keys())[index] ?? null
		},
		getItem(key) {
			return values.get(key) ?? null
		},
		setItem(key, value) {
			hooks.beforeSet?.(key, value)
			values.set(key, value)
		},
		removeItem(key) {
			hooks.beforeRemove?.(key)
			values.delete(key)
		}
	}
}

function exclusiveLockManager() {
	const tails = new Map()
	const requests = []
	return {
		requests,
		request(name, options, callback) {
			requests.push({ name, options })
			const previous = tails.get(name) || Promise.resolve()
			const current = previous.then(() => callback({ name, mode: options?.mode }))
			tails.set(name, current.catch(() => undefined))
			return current
		}
	}
}

assert.equal(canonicalGatewayBaseURL('HTTP://LOCALHOST:80/gateway/'), 'http://localhost/gateway')
const stashScope = createBucketStashScope({
	profile: 'alice',
	baseURL: 'http://127.0.0.1:8080/',
	bucketID: 'bkt_one'
})
const otherGatewayScope = createBucketStashScope({
	profile: 'alice',
	baseURL: 'https://gateway.example',
	bucketID: 'bkt_one'
})
assert.notEqual(bucketStashNamespace(stashScope), bucketStashNamespace(otherGatewayScope))
assert.equal(
	legacyBucketStashBindingNamespace(stashScope),
	legacyBucketStashBindingNamespace(otherGatewayScope)
)
const newerHeadBytes = new TextEncoder().encode('newer observed Bucket head')
const newerHeadCID = CID.createV1(raw.code, await sha256.digest(newerHeadBytes)).toString()
const observedHead10 = {
	...observedHead,
	commit_id: 'cmt_ten',
	root: newerHeadCID,
	revision: 10
}
const stalePushHead6 = {
	...observedHead,
	commit_id: 'cmt_six',
	revision: 6
}
assert.strictEqual(
	mergeObservedBucketHead(observedHead10, stashScope, stalePushHead6, stashScope),
	observedHead10,
	'An older idempotent push response must not regress the observed head'
)
assert.strictEqual(
	mergeObservedBucketHead(stalePushHead6, stashScope, observedHead10, stashScope),
	observedHead10
)
assert.throws(
	() =>
		mergeObservedBucketHead(
			observedHead10,
			stashScope,
			{ ...observedHead10, commit_id: 'cmt_ten_other' },
			stashScope
		),
	/different Bucket heads at the same revision/
)
assert.throws(
	() =>
		mergeObservedBucketHead(
			observedHead10,
			stashScope,
			{ ...observedHead10, root: casCID },
			stashScope
		),
	/different Bucket heads at the same revision/
)
assert.strictEqual(
	mergeObservedBucketHead(observedHead10, stashScope, stalePushHead6, otherGatewayScope),
	stalePushHead6,
	'Observed heads from different Gateways have independent revision domains'
)
const pendingStash = {
	id: 'stash-one',
	pushID: 'web_stash-one',
	candidateRoot: casCID,
	base: { commitID: 'cmt_one', root: casCID, revision: 1 },
	message: 'web upload',
	scope: stashScope,
	status: 'pending',
	createdAt: '2026-07-22T00:00:00Z'
}
const concurrentStash = {
	...pendingStash,
	id: 'stash-two',
	pushID: 'web_stash-two',
	createdAt: '2026-07-22T00:00:01Z'
}
const sharedStashValues = new Map()
const secondStorageClient = storageClient(sharedStashValues)
let nestedAppendRan = false
const firstStorageClient = storageClient(sharedStashValues, {
	beforeSet(key) {
		if (!nestedAppendRan && key === bucketStashStorageKey(stashScope, pendingStash.id)) {
			nestedAppendRan = true
			appendBucketStashValue(secondStorageClient, concurrentStash)
		}
	}
})
appendBucketStashValue(firstStorageClient, pendingStash)
assert.equal(nestedAppendRan, true)
assert.deepEqual(
	readBucketStashValues(secondStorageClient, stashScope).map((stash) => stash.id),
	['stash-one', 'stash-two']
)
assert.deepEqual(readBucketStashValues(secondStorageClient, otherGatewayScope), [])
assert.throws(
	() => assertBucketStashScope(pendingStash, otherGatewayScope),
	/different profile, Gateway, or Bucket/
)

const thirdStash = {
	...pendingStash,
	id: 'stash-three',
	pushID: 'web_stash-three',
	createdAt: '2026-07-22T00:00:02Z'
}
let nestedFinishAppendRan = false
const finishingStorageClient = storageClient(sharedStashValues, {
	beforeRemove(key) {
		if (!nestedFinishAppendRan && key === bucketStashStorageKey(stashScope, pendingStash.id)) {
			nestedFinishAppendRan = true
			appendBucketStashValue(secondStorageClient, thirdStash)
		}
	}
})
const afterSuccessfulRetry = applyBucketStashResult(
	finishingStorageClient,
	pendingStash,
	{ status: 'fast_forward' }
)
assert.equal(nestedFinishAppendRan, true)
assert.deepEqual(
	afterSuccessfulRetry.map((stash) => stash.id),
	['stash-two', 'stash-three']
)
const branchedStashes = applyBucketStashResult(secondStorageClient, concurrentStash, pushed)
assert.equal(branchedStashes.find((stash) => stash.id === concurrentStash.id)?.status, 'branched')
assert.ok(readBucketStashValues(secondStorageClient, stashScope).some((stash) => stash.id === thirdStash.id))

const responseLossValues = new Map()
const responseLossStorage = storageClient(responseLossValues)
const responseLossStash = {
	...pendingStash,
	id: 'stash-response-loss',
	pushID: 'web_stash-response-loss'
}
appendBucketStashValue(responseLossStorage, responseLossStash)
const responseLossObservedHead = mergeObservedBucketHead(
	observedHead10,
	stashScope,
	stalePushHead6,
	stashScope
)
applyBucketStashResult(responseLossStorage, responseLossStash, { status: 'fast_forward' })
assert.deepEqual(readBucketStashValues(responseLossStorage, stashScope), [])
assert.strictEqual(
	responseLossObservedHead,
	observedHead10,
	'A validated older replay may complete its stash without regressing the observed head'
)

const inconsistentHeadValues = new Map()
const inconsistentHeadStorage = storageClient(inconsistentHeadValues)
const inconsistentHeadStash = {
	...pendingStash,
	id: 'stash-inconsistent-head',
	pushID: 'web_stash-inconsistent-head'
}
appendBucketStashValue(inconsistentHeadStorage, inconsistentHeadStash)
assert.throws(
	() =>
		mergeObservedBucketHead(
			observedHead10,
			stashScope,
			{ ...observedHead10, commit_id: 'cmt_same_revision_other' },
			stashScope
		),
	/different Bucket heads at the same revision/
)
assert.deepEqual(
	readBucketStashValues(inconsistentHeadStorage, stashScope).map((stash) => stash.id),
	['stash-inconsistent-head'],
	'An inconsistent observed-head result must leave the pending stash intact'
)

const legacyValues = new Map()
const legacyStorage = storageClient(legacyValues)
legacyStorage.setItem(
	legacyBucketStashStorageKey(stashScope),
	JSON.stringify([
		{
			id: 'legacy-one',
			candidateRoot: casCID,
			base: { commitID: 'cmt_one', root: casCID, revision: 1 },
			status: 'pending',
			createdAt: '2026-07-21T00:00:00Z',
			apiKey: 'must-not-migrate'
		}
	])
)
const unscopedAtGatewayB = readLegacyBucketStashValues(legacyStorage, otherGatewayScope)
assert.equal(unscopedAtGatewayB.length, 1)
assert.equal(unscopedAtGatewayB[0].legacy, true)
assert.equal('apiKey' in unscopedAtGatewayB[0], false)
assert.throws(
	() => assertBucketStashScope(unscopedAtGatewayB[0], otherGatewayScope),
	/no valid Gateway scope/
)
assert.throws(
	() => applyBucketStashResult(legacyStorage, unscopedAtGatewayB[0], { status: 'fast_forward' }),
	/invalid Bucket stash/
)
assert.notEqual(legacyStorage.getItem(legacyBucketStashStorageKey(stashScope)), null)

await assert.rejects(
	bindLegacyBucketStashValue(legacyStorage, unscopedAtGatewayB[0], otherGatewayScope),
	/Web Locks API is required/
)
assert.equal(legacyStorage.getItem(bucketStashStorageKey(otherGatewayScope, 'legacy-one')), null)
assert.equal(legacyStorage.getItem(legacyBucketStashBindingStorageKey(otherGatewayScope, 'legacy-one')), null)

const sequentialLocks = exclusiveLockManager()
const explicitlyBound = await bindLegacyBucketStashValue(
	legacyStorage,
	unscopedAtGatewayB[0],
	otherGatewayScope,
	{ lockManager: sequentialLocks, createdAt: '2026-07-22T00:00:03Z' }
)
assert.equal(explicitlyBound.stash.scope.baseURL, otherGatewayScope.baseURL)
assert.equal(explicitlyBound.stash.id, 'legacy-one')
assert.equal(explicitlyBound.stash.pushID, 'web_legacy-one')
assert.deepEqual(explicitlyBound.stash.legacyBinding, { version: 1, legacyID: 'legacy-one' })
const bindingKey = legacyBucketStashBindingStorageKey(otherGatewayScope, 'legacy-one')
assert.equal(bindingKey, legacyBucketStashBindingStorageKey(stashScope, 'legacy-one'))
assert.deepEqual(JSON.parse(legacyStorage.getItem(bindingKey)), {
	version: 1,
	legacyID: 'legacy-one',
	scope: otherGatewayScope
})

const reboundToSameScope = await bindLegacyBucketStashValue(
	legacyStorage,
	unscopedAtGatewayB[0],
	otherGatewayScope,
	{ lockManager: sequentialLocks, createdAt: 'should-not-replace-the-record' }
)
assert.deepEqual(reboundToSameScope.stash, explicitlyBound.stash)
await assert.rejects(
	bindLegacyBucketStashValue(legacyStorage, unscopedAtGatewayB[0], stashScope, {
		lockManager: sequentialLocks
	}),
	/already bound to a different Gateway/
)
assert.equal(legacyStorage.getItem(bucketStashStorageKey(stashScope, 'legacy-one')), null)
assert.ok(sequentialLocks.requests.every((request) => request.options?.mode === 'exclusive'))
assert.equal(readLegacyBucketStashValues(legacyStorage, otherGatewayScope).length, 0)
assert.equal(readLegacyBucketStashValues(legacyStorage, stashScope).length, 0)
assert.notEqual(legacyStorage.getItem(legacyBucketStashStorageKey(stashScope)), null)

// A tab holding the old scoped object must fail closed if the global marker
// changes before restore, retry, or completion. In particular, completion may
// not delete the still-present scoped candidate.
legacyStorage.setItem(
	bindingKey,
	JSON.stringify({ version: 1, legacyID: 'legacy-one', scope: stashScope })
)
assert.throws(
	() => assertBucketStashLegacyBinding(legacyStorage, explicitlyBound.stash),
	/no longer matches its Gateway scope/
)
assert.deepEqual(readBucketStashValues(legacyStorage, otherGatewayScope), [])
assert.throws(
	() => applyBucketStashResult(legacyStorage, explicitlyBound.stash, { status: 'fast_forward' }),
	/no longer matches its Gateway scope/
)
assert.notEqual(
	legacyStorage.getItem(bucketStashStorageKey(otherGatewayScope, explicitlyBound.stash.id)),
	null
)

// Two tabs binding the same legacy ID to different Gateways share one lock and
// one global marker. Exactly one scope wins; the loser writes no scoped record.
const racingValues = new Map()
const racingStorage = storageClient(racingValues)
racingStorage.setItem(
	legacyBucketStashStorageKey(stashScope),
	JSON.stringify([
		{
			id: 'legacy-race',
			candidateRoot: casCID,
			base: { commitID: 'cmt_one', root: casCID, revision: 1 },
			message: 'web upload',
			status: 'pending',
			createdAt: '2026-07-21T00:00:01Z'
		}
	])
)
const racingLegacy = readLegacyBucketStashValues(racingStorage, stashScope)[0]
const racingLocks = exclusiveLockManager()
const racingBindings = await Promise.allSettled([
	bindLegacyBucketStashValue(racingStorage, racingLegacy, stashScope, {
		lockManager: racingLocks,
		createdAt: '2026-07-22T00:00:04Z'
	}),
	bindLegacyBucketStashValue(racingStorage, racingLegacy, otherGatewayScope, {
		lockManager: racingLocks,
		createdAt: '2026-07-22T00:00:05Z'
	})
])
const fulfilledBindings = racingBindings.filter((result) => result.status === 'fulfilled')
const rejectedBindings = racingBindings.filter((result) => result.status === 'rejected')
assert.equal(fulfilledBindings.length, 1)
assert.equal(rejectedBindings.length, 1)
assert.match(String(rejectedBindings[0].reason), /already bound to a different Gateway/)
const winningStash = fulfilledBindings[0].value.stash
const losingScope = winningStash.scope.baseURL === stashScope.baseURL ? otherGatewayScope : stashScope
assert.equal(winningStash.id, 'legacy-race')
assert.equal(winningStash.pushID, 'web_legacy-race')
assert.equal(racingStorage.getItem(bucketStashStorageKey(losingScope, 'legacy-race')), null)
assert.deepEqual(
	JSON.parse(racingStorage.getItem(legacyBucketStashBindingStorageKey(stashScope, 'legacy-race'))),
	{ version: 1, legacyID: 'legacy-race', scope: winningStash.scope }
)
assert.equal(readLegacyBucketStashValues(racingStorage, stashScope).length, 0)
assert.equal(readLegacyBucketStashValues(racingStorage, otherGatewayScope).length, 0)
assert.equal(racingLocks.requests.length, 2)
assert.equal(racingLocks.requests[0].name, racingLocks.requests[1].name)
assert.ok(racingLocks.requests.every((request) => request.options?.mode === 'exclusive'))

globalThis.fetch = async () =>
	new Response(
		JSON.stringify({
			status: 'fast_forward',
			head: { ...observedHead, commit_id: candidateCommit.id, revision: 1 },
			commit: candidateCommit,
			candidate: candidateCommit,
			conflicts: []
		}),
		{ status: 201, headers: { 'Content-Type': 'application/json' } }
	)
assert.equal((await pushBucketRoot(bucketPushRequest)).status, 'fast_forward')

const validMergeCommit = {
	id: 'cmt_merge',
	bucket_id: 'bkt_one',
	root: casCID,
	parents: ['cmt_remote', candidateCommit.id],
	base_root: casCID,
	author: 'alice',
	created_at: '2026-07-22T00:00:01Z'
}
globalThis.fetch = async () =>
	new Response(
		JSON.stringify({
			status: 'merged',
			head: { ...observedHead, commit_id: validMergeCommit.id, revision: 1 },
			commit: validMergeCommit,
			candidate: candidateCommit,
			merge_base: casCID
		}),
		{ status: 201, headers: { 'Content-Type': 'application/json' } }
	)
assert.equal((await pushBucketRoot(bucketPushRequest)).status, 'merged')

globalThis.fetch = async () =>
	new Response(
		JSON.stringify({ status: 'fast_forward', head: { ...observedHead, revision: 2 }, commit: candidateCommit }),
		{ status: 201, headers: { 'Content-Type': 'application/json' } }
	)
await assert.rejects(pushBucketRoot(bucketPushRequest), /candidate commit/)

globalThis.fetch = async () =>
	new Response(
		JSON.stringify({
			status: 'fast_forward',
			head: { ...observedHead, commit_id: 'cmt_other', revision: 2 },
			commit: candidateCommit,
			candidate: candidateCommit
		}),
		{ status: 201, headers: { 'Content-Type': 'application/json' } }
	)
await assert.rejects(pushBucketRoot(bucketPushRequest), /does not match main/)

const mergeCommit = { ...validMergeCommit, parents: ['cmt_remote', 'cmt_not_candidate'] }
globalThis.fetch = async () =>
	new Response(
		JSON.stringify({
			status: 'merged',
			head: { ...observedHead, commit_id: mergeCommit.id, revision: 2 },
			commit: mergeCommit,
			candidate: candidateCommit,
			merge_base: casCID
		}),
		{ status: 201, headers: { 'Content-Type': 'application/json' } }
	)
await assert.rejects(pushBucketRoot(bucketPushRequest), /does not include the candidate/)

globalThis.fetch = async () =>
	new Response(
		JSON.stringify({
			status: 'branched',
			head: observedHead,
			commit: candidateCommit,
			candidate: candidateCommit,
			branch: {
				...observedHead,
				name: 'conflicts/alice/other',
				kind: 'conflict',
				commit_id: 'cmt_other'
			},
			merge_base: casCID,
			conflicts: [{ coordinate: 'docs/readme' }]
		}),
		{ status: 409, headers: { 'Content-Type': 'application/json' } }
	)
await assert.rejects(pushBucketRoot(bucketPushRequest), /does not preserve the candidate/)

globalThis.fetch = async () =>
	new Response(
		JSON.stringify({
			status: 'branched',
			head: { bucket_id: 'bkt_one', name: 'main', kind: 'main', state: 'open', revision: 0 },
			commit: candidateCommit,
			candidate: candidateCommit,
			branch: {
				...observedHead,
				name: 'conflicts/alice/one',
				kind: 'conflict',
				commit_id: candidateCommit.id
			},
			merge_base: casCID,
			conflicts: [{ coordinate: '@history' }]
		}),
		{ status: 409, headers: { 'Content-Type': 'application/json' } }
	)
assert.equal((await pushBucketRoot(bucketPushRequest)).status, 'branched')

globalThis.fetch = async () =>
	new Response(
		JSON.stringify({
			status: 'branched',
			head: observedHead,
			commit: candidateCommit,
			candidate: candidateCommit,
			branch: {
				...observedHead,
				name: 'conflicts/alice/extra/one',
				kind: 'conflict',
				commit_id: candidateCommit.id
			},
			merge_base: casCID,
			conflicts: [{ coordinate: 'docs/readme' }]
		}),
		{ status: 409, headers: { 'Content-Type': 'application/json' } }
	)
await assert.rejects(pushBucketRoot(bucketPushRequest), /inconsistent Bucket conflict commit/)

globalThis.fetch = async () =>
	new Response(JSON.stringify({ error: 'bucket push ID was already used for a different request' }), {
		status: 409,
		headers: { 'Content-Type': 'application/json' }
	})
await assert.rejects(
	pushBucketRoot(bucketPushRequest),
	/already used for a different request/
)
globalThis.fetch = originalFetch

const rootCID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const identityVerification = {
  request: { profile: resolveProfile, root: rootCID, segments: [] },
  result: {
    profile: resolveProfile,
    target: rootCID,
    prooflist: { root: { '/': rootCID }, query: '', steps: [] }
  }
}
const rootPayloadCID = 'bafkreib6qhwx2g5wgdgczgczumrq6rupl7u36po34ohfhn7rmvtpt7a3om'
const rootPayloadVerification = resolveVerificationFromProofList({
  proofList: {
    root: { '/': rootCID },
    query: '@payload',
    steps: [
      {
        kind: 'payload_binding',
        from: { '/': rootCID },
        path: '@payload',
        target: { '/': rootPayloadCID }
      }
    ]
  },
  root: rootCID,
  path: '',
  payload: true
})
assert.equal(rootPayloadVerification.request.segments.at(-1), '@payload')
assert.equal(rootPayloadVerification.result.target, rootPayloadCID)
const rawContentVerification = resolveVerificationFromProofList({
  proofList: { root: { '/': rootCID }, query: '', steps: [] },
  root: rootCID,
  path: '',
  payload: 'auto'
})
assert.deepEqual(rawContentVerification.request.segments, [])
assert.equal(rawContentVerification.result.target, rootCID)
assert.throws(
  () =>
    resolveVerificationFromProofList({
      proofList: rawContentVerification.result.prooflist,
      path: ''
    }),
  /trusted root is required/
)

for (const name of ['%', '%41', '%2F']) {
  const percentVerification = resolveVerificationFromProofList({
    proofList: {
      root: { '/': rootCID },
      query: name,
      steps: [
        {
          kind: 'map_step',
          from: { '/': rootCID },
          path: name,
          target: { '/': rootPayloadCID }
        }
      ]
    },
    root: rootCID,
    path: name
  })
  assert.deepEqual(percentVerification.request.segments, [name])
  assert.equal(percentVerification.result.prooflist.query, name)
}
assert.deepEqual(createResolveVerification(identityVerification), identityVerification)
assert.deepEqual(extractVerificationInput(identityVerification), identityVerification)
assert.throws(
  () =>
    createResolveVerification({
      request: { ...identityVerification.request, root: '' },
      result: identityVerification.result
    }),
  /trusted resolve root is required/
)
assert.throws(
  () =>
    createResolveVerification({
      request: { ...identityVerification.request, segments: ['different'] },
      result: identityVerification.result
    }),
  /client-selected segments/
)
const localValid = await verifyResolveLocally({
  ...identityVerification,
  provider: () => JSON.stringify({ profile: resolveProfile, valid: true })
})
assert.equal(localValid.valid, true)
assert.equal(localValid.source, 'local-wasm')
const malformedProvider = await verifyResolveLocally({
  ...identityVerification,
  provider: () => '{"valid":true}'
})
assert.equal(malformedProvider.valid, false)
assert.match(malformedProvider.error, /invalid result envelope/)
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
assert.deepEqual(ancestorDirectoryPaths('malt/model/unixfs/internal/format'), [
  '',
  'malt',
  'malt/model',
  'malt/model/unixfs',
  'malt/model/unixfs/internal'
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

const listRootCID = 'bafkreib6qhwx2g5wgdgczgczumrq6rupl7u36po34ohfhn7rmvtpt7a3om'
const listRangeProof = {
  root: { '/': rootCID },
  query: 'large.bin/@payload',
  steps: [
    {
      kind: 'payload_binding',
      from: { '/': rootCID },
      path: '@payload',
      target: { '/': listRootCID }
    },
    {
      kind: 'list_range',
      from: { '/': listRootCID },
      target: { '/': listRootCID },
      start: 0,
      end: 1,
      segments: []
    }
  ]
}
const listResolve = resolveVerificationFromProofList({
  proofList: listRangeProof,
  root: rootCID,
  path: 'large.bin',
  payload: true
})
assert.equal(listResolve.result.target, listRootCID)
const listReads = readVerificationsFromProofList(listRangeProof)
assert.equal(listReads.length, 1)
assert.equal(listReads[0].request.profile, readProfile)

const acceptingProvider = {
  resolve: () => JSON.stringify({ profile: resolveProfile, valid: true }),
  read: () => JSON.stringify({ profile: readProfile, valid: true })
}
const validComposite = await verifyContentProofLocally({
  proofList: listRangeProof,
  expectedRoot: rootCID,
  expectedPath: 'large.bin',
  provider: acceptingProvider
})
assert.equal(validComposite.valid, true)

const crossRootSplice = structuredClone(listRangeProof)
crossRootSplice.steps[1].from = { '/': rootCID }
crossRootSplice.steps[1].target = { '/': rootCID }
const splicedComposite = await verifyContentProofLocally({
  proofList: crossRootSplice,
  expectedRoot: rootCID,
  expectedPath: 'large.bin',
  provider: acceptingProvider
})
assert.equal(splicedComposite.valid, false)
assert.match(splicedComposite.error, /does not continue from authenticated target/)

assert.equal(joinMaltPath('', 'docs'), 'docs')
assert.equal(joinMaltPath('docs', 'readme.md'), 'docs/readme.md')
assert.equal(pathParent('docs/readme.md'), 'docs')
assert.equal(pathParent('docs'), '')
assert.equal(pathBasename('docs/readme.md'), 'readme.md')
assert.equal(profileStorageKey('alice'), 'malt-app-profile:alice')

console.log('Browser tool contract passed.')
