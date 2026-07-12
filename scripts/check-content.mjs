import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const docsRoot = path.join(root, '..', 'docs')

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
  [
    'narrative/problem.md',
    ['Traversal, authentication, and identity', 'ancestor-dependent rewrite']
  ],
  [
    'narrative/abstraction.md',
    [
      'Authenticated Graph-Normalized Structure',
      'Payload storage',
      'Relation authentication',
      'Execution and access'
    ]
  ],
  [
    'narrative/system-design.md',
    ['Portable authentication kernel', 'ArcTable', 'untrusted materialization']
  ],
  [
    'narrative/evaluation-story.md',
    ['Read latency', 'Write amplification', 'HAMT is a directory']
  ],
  [
    'docs/runtime.md',
    [
      'package malt',
      'auth/verifier',
      'graph/verifier',
      'graph boundary around resolver and writer ports'
    ]
  ],
  [
    'docs/api.md',
    [
			'POST /v1/artifacts/resolve',
			'POST /v1/artifacts/prove',
			'POST /v1/artifacts/verify',
			'GET|HEAD /v1/roots/{root}/content'
    ]
  ],
  [
    'docs/prooflists.md',
    [
      'Read(root, query) -> result + ProofList',
      'X-Malt-ProofList-Encoding',
			'layout/unixfs.VerifyRangeBody',
			'malt.artifact/v0alpha2'
    ]
  ],
  [
    'docs/unixfs-layout.md',
    ['flat', 'hierarchical', 'dir-layout=basic|hamt|adaptive']
  ],
  [
    'docs/evaluation.md',
    ['maltflat,merkledag,hamt', 'resolve_path', 'not a paper-grade result']
  ]
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
