---
layout: home

hero:
  name: MALT
  text: Authenticated mutable structure over immutable CAS
  tagline: MALT separates payload identity from structure semantics so evolving graphs can be read, updated, and verified without encoding every relation as an embedded Merkle-DAG edge.
  actions:
    - theme: brand
      text: Read the design
      link: /overview
    - theme: alt
      text: Gateway model
      link: /gateway

features:
  - title: Root-centric correctness
    details: Readers verify result plus ProofList against an explicit trusted root. The gateway does not publish heads or decide freshness.
  - title: List and map semantics
    details: List models indexed or ranged child references. Map models authenticated keyed relations and exact binding proofs.
  - title: CAS payload boundary
    details: Payload stays ordinary content-addressed data. MALT commits and proves the mutable structure above it.
---

<script setup>
import { withBase } from 'vitepress'
</script>

<section class="malt-band">
  <div class="malt-band-inner">
    <div>
      <p class="malt-kicker">Design focus</p>
      <h2>Move structure out of payload identity, keep verification local.</h2>
      <p>
        Merkle DAGs bind traversal, authentication, and object identity through
        parent hash links. MALT keeps immutable CAS payloads, but represents
        evolving structure through list and map semantics, ArcTable
        materialization, and stateless commitment proofs.
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
      <strong>Writer</strong>
      <span>Converts source data into semantic mutations, computes a new root, and publishes that root through application policy.</span>
    </div>
    <div class="malt-strip">
      <strong>Gateway</strong>
      <span>Materializes ArcSets and assembles ProofLists for explicit roots. It is a performance component, not a trust root.</span>
    </div>
    <div class="malt-strip">
      <strong>Reader</strong>
      <span>Obtains a trusted root, queries any gateway, and verifies root + query + result + ProofList locally.</span>
    </div>
  </div>
</section>
