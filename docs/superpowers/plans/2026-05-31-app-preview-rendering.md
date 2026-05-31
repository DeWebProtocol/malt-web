# App Preview Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub-like Markdown rendering and syntax-colored code previews to the MALT browser app.

**Architecture:** Keep the rendering logic inside `MaltApp.vue`, where previews are already classified and displayed. Add a small language inference helper, initialize a Shiki highlighter during mount, render Markdown fenced code through Shiki when ready, and render text previews as highlighted rows with a plain escaped fallback.

**Tech Stack:** Vue 3, VitePress, `markdown-it`, Shiki, existing Node assertion checks.

---

### Task 1: Regression Checks

**Files:**
- Modify: `scripts/check-tools.mjs`

- [ ] Add assertions that `package.json` declares Shiki as a dependency, the app imports `createHighlighter`, and helper names for `previewLanguage`, `highlightCode`, `highlightMarkdownFence`, and `escapeHTML` exist.
- [ ] Add assertions for representative filename mappings: `go.mod`, `go.sum`, `.rs`, `.c`, `.h`, `.toml`, `.yaml`, `Dockerfile`, and `Makefile`.
- [ ] Run `npm test` and confirm the new assertions fail before implementation.

### Task 2: Renderer Implementation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/.vitepress/theme/components/MaltApp.vue`

- [ ] Add `shiki` as a direct dependency.
- [ ] Load `createHighlighter` from `shiki` on the client.
- [ ] Initialize a highlighter for GitHub light/dark themes and common language grammars during `onMounted`.
- [ ] Add filename-to-language inference for the supported source and config files.
- [ ] Store `language` and highlighted `codeMarkup` on text and Markdown preview objects.
- [ ] Render code preview rows with `v-html` from highlighted line markup and escaped fallback line markup.
- [ ] Render Markdown fenced code through Shiki when the highlighter is ready.

### Task 3: Preview Styling

**Files:**
- Modify: `docs/.vitepress/theme/custom.css`

- [ ] Keep the existing GitHub-like preview frame.
- [ ] Add Shiki-aware styles for code rows, token spans, Markdown fenced blocks, tables, checkboxes, and dark mode.
- [ ] Preserve stable line-number width, horizontal scrolling, and readable fallback text.

### Task 4: Verification And Commit

**Files:**
- Verify all changed files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Review `git diff`.
- [ ] Commit the web repository change on `main`.
- [ ] Push `main` to `origin`.
