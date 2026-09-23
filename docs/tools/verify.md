---
title: Verify
layout: page
sidebar: false
---

<script setup>
import MaltVerifyTool from '../.vitepress/theme/components/MaltVerifyTool.vue'
</script>

<MaltVerifyTool />

The local WebAssembly verifier from malt-ts checks `malt.authentication/3` requests
and results. Enter the expected request and untrusted result separately, or
import the JSON file saved by **Download proof JSON** in Gateway Console.
The file is read in this browser; it is not uploaded. Select an imported query,
check its root and opaque labels, then choose **Verify locally**.

Each query is checked independently. Verifying a range query against its
selected root does not establish a connection to another imported path query.
The application must check that relationship and bind downloaded payload bytes
to the authenticated CIDs and range geometry. Loading the page or importing a
proof never promotes a trusted root or proves freshness.

The bundled verifier comes from the exact malt-ts package pinned by the site.
`verifier-source.json` records that SDK commit, its published Core dependency,
and the asset and corpus digests. The SDK supports KZG and IPA and fails closed
when the current authentication export or initialization is missing.
