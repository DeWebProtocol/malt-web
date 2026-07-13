---
title: Verify
layout: page
sidebar: false
---

<script setup>
import MaltVerifyTool from '../.vitepress/theme/components/MaltVerifyTool.vue'
</script>

<MaltVerifyTool />

The trust decision runs entirely in this page through the portable MALT
WebAssembly verifier. Enter the caller-constructed request and the untrusted
result separately. The request contains the root obtained from a trusted source
and the exact segments or typed query the application intended to execute.

The verifier binds that trusted root and query to the returned target, ordered
ProofList, and every KZG or IPA proof. Failure to load or initialize the local
verifier fails closed. The optional gateway diagnostic calls the managed API
only for interoperability testing and never changes the local result.

Proof verification authenticates the returned graph relation. Applications
must additionally verify downloaded payload bytes against the authenticated
payload CID; range/list payload verification may require the application
adapter to fetch authenticated segments.
