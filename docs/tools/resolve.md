---
title: Resolve Tool
---

<script setup>
import MaltResolveTool from '../.vitepress/theme/components/MaltResolveTool.vue'
</script>

# Resolve Tool

<MaltResolveTool />

This public tool sends an explicit-root typed resolve request and verifies the
returned authentication evidence locally. It intentionally does not request private
Bucket-scoped payload bytes or collect account/API-key credentials.

Enter `[]` for root identity. For example, a label `docs` is
`["ZG9jcw=="]`. Payload selection is explicit:
`["QHBheWxvYWQ="]`. For flat layout, encode the complete
application path as a single label. The tool sends the exact label steps;
it does not infer a UnixFS layout or append a payload selector.
