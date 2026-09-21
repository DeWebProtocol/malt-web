---
title: Verify
layout: page
sidebar: false
---

<script setup>
import MaltVerifyTool from '../.vitepress/theme/components/MaltVerifyTool.vue'
</script>

<MaltVerifyTool />

The local Core WebAssembly verifier checks `malt.authentication/1` requests
and results. Enter the expected request and untrusted result separately, or
import the JSON file saved by **Download proof JSON** in Gateway Console.
The file is read in this browser; it is not uploaded. Select an imported query,
check its root and typed inputs, then choose **Verify locally**.

Each query is checked independently. Verifying a range query against its
selected root does not establish a connection to another imported path query.
The application must check that relationship and bind downloaded payload bytes
to the authenticated CIDs and range geometry. Loading the page or importing a
proof never promotes a trusted root or proves freshness.

The bundled verifier is built from the exact Core source revision in
`verifier-source.json`. It supports KZG and IPA and fails closed when the
current authentication export or initialization is missing.
