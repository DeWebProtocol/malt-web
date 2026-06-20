---
layout: home

hero:
  name: MALT
  text: Authenticated graph-normalized structure
  tagline: MALT authenticates structured data whose relationships can be normalized as graph-shaped nodes and relations, using list/map semantics and local ProofList verification without embedding every relation as a Merkle-DAG edge.
  actions:
    - theme: brand
      text: Research narrative
      link: /narrative/problem
    - theme: alt
      text: Technical docs
      link: /docs/runtime

features:
  - title: Research narrative
    details: Problem framing, abstraction, system design, and evaluation story aligned with the current paper memory.
  - title: Technical docs
    details: Runtime status, root-centric HTTP routes, ProofList transport, UnixFS layout, and benchmark protocol.
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
        as graph-shaped nodes and relations. It authenticates those relations
        through list and map semantics, ArcTable materialization, and stateless
        commitment proofs.
      </p>
      <p>
        Immutable payloads can still live naturally in CAS. MALT keeps their
        storage separate from the structural authentication boundary, so reads
        return results plus ProofLists that clients verify locally.
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
      <strong>Technical docs</strong>
      <span>Read the current prototype surface: CLI, HTTP API, ProofLists, UnixFS layout, and benchmark protocol.</span>
    </div>
    <div class="malt-strip">
      <strong>Server runtime model</strong>
      <span>Understand the root-centric resolver/writer contract: apply explicit-root mutations and return result + ProofList.</span>
    </div>
  </div>
</section>
