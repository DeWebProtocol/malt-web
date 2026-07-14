---
layout: home

hero:
  name: MALT
  text: Arc-granularity data authentication
  tagline: Authenticate graph-shaped relations with vector commitments, keep payloads in CAS, and verify locally without making a Merkle-DAG block the proof carrier.
  actions:
    - theme: brand
      text: Research narrative
      link: /narrative/problem
    - theme: alt
      text: Technical docs
      link: /docs/runtime
    - theme: alt
      text: v0.0.6 release
      link: https://github.com/DeWebProtocol/malt/releases/tag/v0.0.6

features:
  - title: Research narrative
    details: Problem framing, abstraction, system design, and evaluation story aligned with the current paper memory.
  - title: Technical docs
    details: The released v0.0.6 SDK-only core plus independent gateway and trusted clients, with frozen v0.0.4 artifact compatibility.
  - title: Root-centric verification
    details: Readers verify result plus ProofList against an explicit trusted root. The server runtime does not publish heads or decide freshness.
---

<script setup>
import { withBase } from 'vitepress'
</script>

<section class="malt-band">
  <div class="malt-band-inner">
    <div>
      <p class="malt-kicker">Design focus</p>
      <h2>Authenticate structure as graph-shaped relations, keep verification local.</h2>
      <p>
        MALT starts from structured data whose relationships can be normalized
        as graph-shaped nodes and relations. It authenticates individual arcs
        through list and map semantics, vector-commitment proofs, and a portable
        verifier.
      </p>
      <p>
        Immutable payloads can still live naturally in CAS. MALT keeps their
        storage separate from arc authentication and from execution/access.
        ArcTable, caches, executors, and gateways are untrusted materialization
        and delivery components; reads return results plus ProofLists that
        clients verify locally.
      </p>
      <p>
        A public MALT service can accelerate root-relative reads. It is not the
        authority for the latest root. Applications publish roots; readers
        verify every returned result against those roots.
      </p>
    </div>
    <img class="malt-diagram" :src="withBase('/visuals/root-proof-flow.svg')" alt="Root-centric read and ProofList verification flow">
  </div>
  <div class="malt-strips">
    <div class="malt-strip">
      <strong>Research narrative</strong>
      <span>Follow the problem, abstraction, system design, and evaluation story for MALT as a systems research project.</span>
    </div>
    <div class="malt-strip">
      <strong>Current pre-v1 contracts</strong>
      <span>Use canonical segments with malt.resolve/v0alpha1 and malt.read/v0alpha1 through the gateway; the API remains pre-v1.</span>
    </div>
    <div class="malt-strip">
      <strong>Server runtime model</strong>
      <span>Understand the root-centric resolver/writer contract: apply explicit-root mutations and return result + ProofList.</span>
    </div>
  </div>
</section>
