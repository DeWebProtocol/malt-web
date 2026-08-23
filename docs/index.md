---
layout: home

hero:
  name: MALT
  text: A user-controlled local data runtime
  tagline: Keep keys and accepted roots on the user's device, authenticate structured relationships with malt-core, and treat gateways or peers as replaceable untrusted data sources.
  actions:
    - theme: brand
      text: Research narrative
      link: /narrative/problem
    - theme: alt
      text: Technical docs
      link: /docs/runtime
    - theme: alt
      text: malt-core v0.0.8
      link: https://github.com/DeWebProtocol/malt-core/releases/tag/v0.0.8

features:
  - title: Local runtime
    details: The malt CLI and daemon own local trust, keys, UnixFS application behavior, backup/sync orchestration, and verified payload exposure.
  - title: MALT Core v0.0.8
    details: The application-neutral malt-core SDK defines canonical relations, roots, commitments, ProofLists, and local verification.
  - title: Optional Gateway
    details: Gateways provide Bucket, CAS, proof generation, and managed execution, but cannot promote an observed head or bypass local verification.
---

<script setup>
import { withBase } from 'vitepress'
</script>

<section class="malt-band">
  <div class="malt-band-inner">
    <div>
      <p class="malt-kicker">Product boundary</p>
      <h2>Keep user data control local, and make storage and transport replaceable.</h2>
      <p>
        MALT is a local data runtime that runs on the user's device. Its daemon
        is the primary long-running process, while CLI, future GUI, foreground
        mode, and local APIs share the same application and trust boundaries.
      </p>
      <p>
        MALT Core authenticates graph-shaped relationships through list/map
        semantics, typed roots, and ProofLists. Payloads may live on local
        disk, in CAS, behind a Gateway, or in future peer transports; every
        remote proof and payload CID is checked locally before use.
      </p>
      <p>
        A Gateway can accelerate execution and provide Bucket/CAS services. It
        is optional and untrusted: observed heads remain observations,
        candidate roots remain separate, and only local policy promotes an
        accepted root.
      </p>
    </div>
    <img class="malt-diagram" :src="withBase('/visuals/root-proof-flow.svg')" alt="Root-centric read and ProofList verification flow">
  </div>
  <div class="malt-strips">
    <div class="malt-strip">
      <strong>Current runtime</strong>
      <span>The current implementation provides the malt CLI/daemon, local trust state, Gateway/local/hybrid CAS, backup/sync flows, and authenticated UnixFS mounts.</span>
    </div>
    <div class="malt-strip">
      <strong>Current pre-v1 contracts</strong>
      <span>Use canonical segments with malt.resolve/v0alpha1 and malt.read/v0alpha1; the wire API remains pre-v1 even though the Core module is formally released.</span>
    </div>
    <div class="malt-strip">
      <strong>Filesystem boundary</strong>
      <span>Linux supports daemon-managed authenticated Bucket mounts with read-only default and explicit write-back; peer networking and non-Linux mount adapters remain future work.</span>
    </div>
  </div>
</section>
