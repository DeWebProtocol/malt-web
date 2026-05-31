# App Preview Rendering Design

## Goal

Improve the browser app file preview so Markdown documents render with stronger
GitHub-like structure and common source/configuration files render with syntax
coloring.

## Scope

This change is limited to the app preview surface in `docs/.vitepress/theme`.
It does not change MALT daemon APIs, proof verification, routing, uploads, or
the public documentation copy.

## Rendering Model

Markdown previews continue to use `markdown-it` with HTML disabled. The renderer
should preserve the current external-link behavior, keep links safe, and add
syntax-highlighted fenced code blocks when a block language is known.

Code previews use Shiki. The app infers a preview language from the filename
and extension before rendering, then falls back to plain escaped text when a
file is unknown or when highlighting fails. The first supported set includes Go,
Rust, C, C++, JavaScript, TypeScript, Python, JSON, YAML, TOML, shell scripts,
Dockerfiles, Makefiles, Markdown, and Go module files.

## UI

The preview keeps the existing file tree, breadcrumb, toolbar, copy, download,
and ProofList panels. Markdown receives denser document styling for tables,
lists, blockquotes, inline code, and fenced code. Code previews keep line
numbers and horizontal scrolling, but the code cells contain Shiki token spans.

## Validation

Automated checks should cover language inference for representative filenames,
presence of the Shiki integration, Markdown fenced-code rendering, and fallback
escaping for unknown text. Build validation remains `npm test`, `npm run build`,
and `git diff --check` from the `web/` repository.
