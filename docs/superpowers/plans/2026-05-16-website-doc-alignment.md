# MALT Website Documentation Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the MALT website into aligned research narrative and technical documentation lanes.

**Architecture:** Keep VitePress as the static site framework. Add a lightweight Node content check that verifies the new public documentation structure and core source-of-truth claims, then implement narrative pages, technical docs pages, updated landing copy, and navigation/sidebar wiring.

**Tech Stack:** VitePress 1.6, npm, Node.js filesystem checks, Markdown content pages, TypeScript VitePress config.

---

## File Structure

- Create: `scripts/check-content.mjs`
  - Node-based content contract for public docs structure and required phrases.
- Modify: `package.json`
  - Add `check:content` and `test` scripts.
- Create: `docs/narrative/problem.md`
  - Public research narrative for the Merkle-DAG structural problem.
- Create: `docs/narrative/abstraction.md`
  - Public research narrative for MALT list/map/ArcSet abstraction.
- Create: `docs/narrative/system-design.md`
  - Public research narrative for semantic layer, ArcTable, commitments, gateway, and layouts.
- Create: `docs/narrative/evaluation-story.md`
  - Public research narrative for read latency, write amplification, and cost attribution.
- Create: `docs/docs/runtime.md`
  - Current prototype runtime and package-role documentation.
- Create: `docs/docs/api.md`
  - Current root-centric HTTP surface documentation.
- Create: `docs/docs/prooflists.md`
  - ProofList contract and transport documentation.
- Create: `docs/docs/unixfs-layout.md`
  - MALT UnixFS layout and baseline terminology documentation.
- Create: `docs/docs/evaluation.md`
  - Benchmark protocol and artifact-caveat documentation.
- Modify: `docs/index.md`
  - Sharpen the homepage and expose the two lanes.
- Modify: `docs/overview.md`
  - Keep as compact overview and link to both lanes.
- Modify: `docs/gateway.md`
  - Link gateway contract to API and ProofList docs.
- Modify: `docs/service.md`
  - Preserve service boundary and link to technical docs.
- Modify: `docs/evaluation.md`
  - Turn the old top-level evaluation page into a bridge to narrative and technical evaluation docs.
- Modify: `docs/concepts/roots.md`
  - Cross-link to narrative abstraction, gateway, API, and ProofList docs.
- Modify: `docs/concepts/list-map.md`
  - Cross-link to abstraction and UnixFS layout docs.
- Modify: `docs/concepts/arctable.md`
  - Cross-link to system design and runtime docs.
- Modify: `docs/.vitepress/config.ts`
  - Add top-level Narrative and Docs navigation/sidebars.

## Task 1: Content Contract

**Files:**
- Create: `scripts/check-content.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing content check**

Create `scripts/check-content.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url)
const docsRoot = path.join(root.pathname, 'docs')

const requiredFiles = [
  'narrative/problem.md',
  'narrative/abstraction.md',
  'narrative/system-design.md',
  'narrative/evaluation-story.md',
  'docs/runtime.md',
  'docs/api.md',
  'docs/prooflists.md',
  'docs/unixfs-layout.md',
  'docs/evaluation.md'
]

const requiredPhrases = new Map([
  ['narrative/problem.md', ['Traversal, authentication, and identity', 'ancestor-dependent rewrite']],
  ['narrative/abstraction.md', ['authenticated graph semantic layer', 'CanonicalArcSet', '@payload']],
  ['narrative/system-design.md', ['Application layout', 'ArcTable', 'stateless commitment backend']],
  ['narrative/evaluation-story.md', ['Read latency', 'Write amplification', 'HAMT is a directory']],
  ['docs/runtime.md', ['malt add', 'malt-eval read', 'core/graph is runtime metadata']],
  ['docs/api.md', ['GET|HEAD /{root}/{path...}', 'GET /resolve/{root}[/{path...}]', 'legacy content-route `format=resolve` and `format=proof` modes are removed']],
  ['docs/prooflists.md', ['Read(root, query) -> result + ProofList', 'X-Malt-ProofList-Encoding', 'schema remains intentionally deferred']],
  ['docs/unixfs-layout.md', ['flat', 'hierarchical', 'dir-layout=basic|hamt|adaptive']],
  ['docs/evaluation.md', ['maltflat,merkledag,hamt', 'resolve_path', 'not a paper-grade result']]
])

const failures = []

for (const file of requiredFiles) {
  const absolute = path.join(docsRoot, file)
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing required page: ${file}`)
    continue
  }

  const text = fs.readFileSync(absolute, 'utf8')
  for (const phrase of requiredPhrases.get(file) ?? []) {
    if (!text.includes(phrase)) {
      failures.push(`Missing phrase in ${file}: ${phrase}`)
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Content contract passed for ${requiredFiles.length} pages.`)
```

Modify `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vitepress dev docs --host 127.0.0.1",
    "build": "vitepress build docs",
    "preview": "vitepress preview docs --host 127.0.0.1",
    "check:content": "node scripts/check-content.mjs",
    "test": "npm run check:content"
  }
}
```

- [ ] **Step 2: Run content check to verify RED**

Run:

```bash
npm run check:content
```

Expected: FAIL with missing required page messages for the new narrative and docs pages.

- [ ] **Step 3: Commit the RED check**

Run:

```bash
git add package.json scripts/check-content.mjs
git commit -m "test: add website content contract"
```

Expected: commit succeeds after the failing check has been observed.

## Task 2: Research Narrative Pages

**Files:**
- Create: `docs/narrative/problem.md`
- Create: `docs/narrative/abstraction.md`
- Create: `docs/narrative/system-design.md`
- Create: `docs/narrative/evaluation-story.md`

- [ ] **Step 1: Add the four research narrative pages**

Use public-facing English prose aligned to `../documents/memories/SPEC.md` and `../documents/memories/OUTLINE.md`.

Minimum required sections:

```markdown
# Problem: Structure Embedded in Identity

## Traversal, Authentication, and Identity
## Ancestor-Dependent Rewrite
## Retrieval Depth
## Expressiveness Limits
## What MALT Changes
```

```markdown
# MALT Abstraction

## Authenticated Graph Semantic Layer
## Graph Nodes and ArcSets
## List Semantic
## Map Semantic
## Payload Boundary
```

```markdown
# System Design

## Layering
## Semantic Layer
## ArcTable
## Commitment Backend
## Gateway and Layouts
## UnixFS as a Layout
```

```markdown
# Evaluation Story

## Read Latency
## Write Amplification
## Cost Breakdown
## Sensitivity Studies
## Deferred Semantic Reachability Demo
```

- [ ] **Step 2: Run content check**

Run:

```bash
npm run check:content
```

Expected: still FAIL because technical docs pages are not complete yet; no failures should remain for `narrative/*`.

## Task 3: Technical Docs Pages

**Files:**
- Create: `docs/docs/runtime.md`
- Create: `docs/docs/api.md`
- Create: `docs/docs/prooflists.md`
- Create: `docs/docs/unixfs-layout.md`
- Create: `docs/docs/evaluation.md`

- [ ] **Step 1: Add runtime documentation**

Include current `malt` and `malt-eval` commands, package-role mapping, and the statement:

```markdown
`core/graph` is runtime metadata and composition code. It is not the semantic abstraction.
```

- [ ] **Step 2: Add API documentation**

Include current root-centric HTTP routes and removal statements:

```markdown
GET|HEAD /{root}/{path...}
GET /resolve/{root}[/{path...}]
POST /_
POST /{root}/{path...}
POST /{root}/_mutate

The public bucket/head routes are removed.
The legacy content-route `format=resolve` and `format=proof` modes are removed.
```

- [ ] **Step 3: Add ProofList documentation**

Include read and verify contracts, transport headers, and the caveat that the paper-facing schema remains intentionally deferred.

- [ ] **Step 4: Add UnixFS layout documentation**

Include MALT `flat` and `hierarchical`, `@payload`, small-file and large-file materialization, and Merkle-DAG UnixFS terminology.

- [ ] **Step 5: Add benchmark documentation**

Include `maltflat,merkledag,hamt`, `resolve_path`, `content_range`, read evidence metrics, write accounting, and the smoke-artifact caveat.

- [ ] **Step 6: Run content check to verify GREEN**

Run:

```bash
npm run check:content
```

Expected: PASS with `Content contract passed for 9 pages.`

## Task 4: Navigation, Landing Page, and Cross-Links

**Files:**
- Modify: `docs/.vitepress/config.ts`
- Modify: `docs/index.md`
- Modify: `docs/overview.md`
- Modify: `docs/gateway.md`
- Modify: `docs/service.md`
- Modify: `docs/evaluation.md`
- Modify: `docs/concepts/roots.md`
- Modify: `docs/concepts/list-map.md`
- Modify: `docs/concepts/arctable.md`

- [ ] **Step 1: Update VitePress navigation**

Set nav groups:

```ts
nav: [
  { text: 'Overview', link: '/overview' },
  { text: 'Narrative', link: '/narrative/problem' },
  { text: 'Docs', link: '/docs/runtime' },
  { text: 'Gateway', link: '/gateway' },
  { text: 'Service', link: '/service' }
]
```

Set sidebar groups for Overview, Research Narrative, Technical Docs, Concepts, Gateway and Service.

- [ ] **Step 2: Update homepage**

Make the first viewport present MALT as an authenticated graph semantic layer and add actions for:

```yaml
Research narrative -> /narrative/problem
Technical docs -> /docs/runtime
```

- [ ] **Step 3: Update cross-links and bridge pages**

Add links from overview, gateway, service, top-level evaluation, and concept pages into the new narrative and technical pages.

- [ ] **Step 4: Run content check**

Run:

```bash
npm run check:content
```

Expected: PASS.

## Task 5: Verification and Commit

**Files:**
- All modified site files.

- [ ] **Step 1: Run stale-claim searches**

Run:

```bash
rg -n "compositional|core/graph is the semantic abstraction|latest head|authoritative head" docs --glob '!docs/superpowers/**'
rg -n "format=resolve|format=proof" docs/docs docs/gateway.md docs/overview.md
```

Expected:

- first command finds no stale positive claims
- second command only finds removal statements in API-oriented docs

- [ ] **Step 2: Run final checks**

Run:

```bash
npm run check:content
npm run build
```

Expected:

- content check passes
- VitePress build completes successfully

- [ ] **Step 3: Review diff**

Run:

```bash
git diff --stat
git diff -- docs/.vitepress/config.ts package.json scripts/check-content.mjs
```

Expected: diff is scoped to website docs, navigation, and content contract.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add package.json scripts/check-content.mjs docs
git commit -m "docs: split website narrative and docs"
```

Expected: commit succeeds on `codex/one-time/feature/website-doc-alignment`.
