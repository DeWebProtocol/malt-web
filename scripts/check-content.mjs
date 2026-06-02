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
    ['authenticated graph semantic layer', 'CanonicalArcSet', '@payload']
  ],
  [
    'narrative/system-design.md',
    ['Application layout', 'ArcTable', 'stateless commitment backend']
  ],
  [
    'narrative/evaluation-story.md',
    ['Read latency', 'Write amplification', 'HAMT is a directory']
  ],
  [
    'docs/runtime.md',
    ['malt add', 'malt-eval read', 'graph boundary around resolver and writer ports']
  ],
  [
    'docs/api.md',
    [
      'GET|HEAD /{root}/{path...}',
      'GET /resolve/{root}[/{path...}]',
      'legacy content-route `format=resolve` and `format=proof` modes are removed'
    ]
  ],
  [
    'docs/prooflists.md',
    [
      'Read(root, query) -> result + ProofList',
      'X-Malt-ProofList-Encoding',
      'schema remains intentionally deferred'
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
