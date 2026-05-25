# MALT Website Documentation Alignment Design

Status: superseded by the PR #74 graph-port terminology pass
Date: 2026-05-16
Target repository: `web`

Update note: this historical spec originally used an older public runtime label.
Current website docs use `graph` as the abstraction boundary, `resolver` as the
read/proof port, `writer` as the mutation port, and server/runtime node for the
untrusted deployment surface.

## Goal

Rework the public MALT website so it has two clearly separated but mutually
consistent parts:

- a research narrative that explains the problem, abstraction, system design,
  and evaluation story
- technical documentation that describes the current prototype, root-centric
  HTTP/CLI surface, ProofList semantics, UnixFS layout, and benchmark protocol

Both parts must be aligned with the current source-of-truth documents in
`../documents`, especially `memories/SPEC.md`, `memories/OUTLINE.md`,
`memories/IMPLEMENTATION_STATUS.md`, `memories/notes/Root-Centric Graph Port Model.md`,
`memories/notes/Module Boundaries and Semantic Layering.md`, and
`memories/benchmarks/BENCHMARK_PROTOCOL.md`.

## Current Gaps

The existing VitePress site has the right broad direction, but it is too thin
for the current state of the project.

- It does not expose a separate research narrative path.
- It does not expose a separate developer/prototype documentation path.
- It underuses the paper memory around Merkle-DAG structural limits,
  list/map/ArcSet abstraction, and evaluation framing.
- It does not document the current implementation surface in enough detail:
  `malt` commands, `malt-eval` commands, root-centric HTTP routes,
  `X-Malt-ProofList`, and removed legacy `format=` modes.
- It does not explain MALT UnixFS `flat` versus `hierarchical` layouts or the
  relationship to IPLD UnixFS and HAMT baselines.
- It does not make the current prototype caveats and open paper-grade
  evaluation gaps easy to find.

## Information Architecture

The site should use two top-level documentation lanes.

### Research Narrative

The narrative lane is public-facing and paper-aligned. It should avoid
implementation package details unless they clarify the system design.

Pages:

- `narrative/problem.md`
  - Explain why embedded Merkle-DAG parent links couple traversal semantics,
    authentication, and object identity.
  - Frame rewrite amplification, retrieval depth, metadata movement, and graph
    expressiveness limits as structural issues rather than implementation bugs.
- `narrative/abstraction.md`
  - Define MALT as an authenticated graph semantic layer over immutable CAS.
  - Describe CAS blob nodes, `list`, `map`, ArcSets, canonical ArcSet shape,
    and the payload boundary.
  - State that every map semantic object carries a reserved `@payload` binding,
    while list objects do not auto-redirect through `@payload`.
- `narrative/system-design.md`
  - Present the layering: application layout, list/map semantic layer,
    ArcTable, stateless commitment backend, KV state and CAS payloads.
  - Explain ArcTable as root-recoverable persistence/materialization, not a
    trust root.
  - Explain commitment backends as stateless proof primitives over
    semantic-layer representations.
  - Explain the server/runtime node as an untrusted root-relative resolver,
    writer executor, and prover.
- `narrative/evaluation-story.md`
  - Present read latency, write amplification, cost breakdown, sensitivity
    studies, and deferred semantic reachability demo.
  - Separate semantic depth, retrieval depth, and commitment depth.
  - State that HAMT is a directory/map-relation baseline, not a large-file
    content layout baseline.

### Technical Docs

The docs lane is implementation-facing and should describe the current public
prototype without redefining the research abstraction around package names.

Pages:

- `docs/runtime.md`
  - List the current public `malt` commands: `add`, `daemon`, `init`,
    `resolve`, and `verify`.
  - List the separate `malt-eval` commands: `read`, `write`, and `metrics`.
  - Map current implementation packages to their roles, including
    `core/commitment`, `core/arctable`, `core/structure/list`,
    `core/structure/mapping`, `cmd/eval/internal/baseline/indexedmap`,
    `layout/unixfs`, `core/resolver`, `core/writer`, `core/graph`,
    `core/querypath`, and `core/manifest`.
  - State that `core/graph` is the graph boundary around resolver and writer
    ports, not the list/map semantic owner.
- `docs/api.md`
  - Document current root-centric HTTP shapes:
    `GET|HEAD /{root}/{path...}`, `GET /resolve/{root}[/{path...}]`,
    `POST /_`, `POST /{root}/{path...}`, and `POST /{root}/_mutate`.
  - State that public bucket/head routes are removed.
  - State that legacy content-route `format=resolve` and `format=proof` modes
    are removed.
  - Explain proof omission through `?proof=false` or `X-Malt-Proof: omit`.
- `docs/prooflists.md`
  - Explain `Read(root, query) -> result + ProofList` and
    `VerifyRead(root, query, result, ProofList) -> valid / invalid`.
  - Document the current transport headers:
    `X-Malt-ProofList`, `X-Malt-ProofList-Encoding: base64url-json`, and
    `Vary: X-Malt-Proof`.
  - Avoid promising a final stable concrete ProofList step schema; note that
    the implementation currently exposes a compatibility transport while the
    paper-facing schema remains intentionally deferred.
- `docs/unixfs-layout.md`
  - Explain pure MALT structure UnixFS as an application layout built from
    map/list/CAS blob composition.
  - Document directory maps, small-file `@payload` to CAS blob, large-file
    `@payload` to list node, list entries as chunk CIDs, path lookup as map
    reads, and range load as list reads.
  - Explain `flat` and `hierarchical` MALT layouts.
  - Explain Merkle-DAG UnixFS `file-layout=balanced|trickle` and
    `dir-layout=basic|hamt|adaptive` terminology.
- `docs/evaluation.md`
  - Align with `memories/benchmarks/BENCHMARK_PROTOCOL.md`.
  - Document `malt-eval read` systems `maltflat,merkledag,hamt`.
  - Describe `resolve_path` and `content_range` operations.
  - Explain read evidence metrics and write amplification accounting.
  - State that the checked-in smoke artifact is not a paper-grade result and
    that repeated benchmark artifacts and plotting inputs still need to be
    stabilized.

## Existing Page Treatment

- `index.md` becomes a more precise public landing page with two clear entry
  links: Research Narrative and Technical Docs.
- `overview.md` remains the short canonical overview and links into both lanes.
- `runtime.md` remains focused on the root-centric server/runtime contract and
  should link to `docs/api.md` and `docs/prooflists.md`.
- `service.md` remains the managed-service boundary page and should keep
  product conveniences separate from MALT core correctness.
- `concepts/roots.md`, `concepts/list-map.md`, and `concepts/arctable.md`
  remain reusable concept pages, but should cross-link to the fuller narrative
  and technical docs.
- `.vitepress/config.ts` should expose the new lanes in navigation and sidebar
  groups.

## Terminology Rules

Use these terms consistently:

- MALT is an authenticated graph semantic layer over immutable CAS payloads.
- `list` describes complex graph nodes with ordered/indexed child references.
- `map` describes authenticated keyed/path-like relations among graph nodes.
- ArcTable is root-recoverable arcset persistence/materialization and is not a
  trust root.
- Commitment backends are stateless proof primitives over semantic-layer
  arcset/cell/node representations.
- Server/runtime nodes apply writer mutations and return `result + ProofList`
  for explicit roots; they do not own authoritative heads, choose the latest
  root, or provide freshness.
- Head publication, freshness, merge, multi-writer arbitration, tenant policy,
  quota, ACL, pinning, GC, and global CAS availability are application or
  deployment concerns.
- UnixFS is an application layout above list/map/CAS blob composition, not the
  core MALT abstraction.

Avoid these mistakes:

- Do not define MALT primarily as a hybrid resolver.
- Do not treat current `core/graph` as the list/map semantic owner.
- Do not describe runtime bucket or namespace placement as semantic identity,
  commitment input, ProofList input, verifier input, or authoritative head
  state.
- Do not describe HAMT as the large-file content baseline.
- Do not imply legacy `format=` read modes are still part of the current public
  API.

## Visual and Copy Direction

The site should feel like a serious research and systems project, not a
marketing page.

- Keep the homepage concise, with a strong first-viewport signal for MALT and
  the two information lanes.
- Use existing visuals where they clarify root-centric reads and proof
  verification.
- Prefer dense, scannable technical pages with precise headings and examples.
- Keep all public website copy in English.
- Avoid internal planning language, speculative unfinished-task wording, and raw
  memory file phrasing.

## Verification

After implementation:

- Run `npm run build` from `web`.
- Inspect the generated VitePress sidebar and navigation for the new lanes.
- Search the site content for stale public claims:
  - `format=`
  - public bucket/head route wording
  - `compositional` as a user-facing layout name
  - `core/graph` as semantic abstraction
- Confirm the docs still distinguish research abstraction, system design,
  implementation status, and deployment policy.

## Non-Goals

- Do not create a full hosted server service or service console.
- Do not promise a finalized ProofList schema beyond the currently documented
  transport and verifier-facing contract.
- Do not publish benchmark numbers as paper-grade results.
- Do not change the implementation repository as part of this website update.
- Do not move source-of-truth research notes out of `../documents`.
