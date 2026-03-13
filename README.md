# Dual Language Reader Starter

A static Astro starter for a sentence-aligned multilingual reading site.

The repo is designed for GitHub Pages deployment and markdown-first authoring:

- one book = one folder
- one chapter-language pair = one markdown file
- one chapter alignment map = one YAML file
- no server runtime
- sentence-level pairing with focus, split, and stacked layouts

## Why this starter exists

This project treats **alignment** as data and **layout** as presentation.
That means the same chapter can be read with English as primary today, Chinese as primary tomorrow, and a third language later without rewriting the content model.

## Quick start

```bash
npm install
npm run dev
```

Then open the local Astro URL.

## Build and validate

```bash
npm run validate:library
npm run build
```

The validation script checks:

- `book.yml` structure
- missing chapter files per declared language
- duplicate sentence ids
- missing alignment units files
- alignment references to sentence ids that do not exist
- sentences assigned to more than one alignment unit

## Deployment notes

Edit `astro.config.mjs` before deploying:

```js
export default defineConfig({
  site: 'https://YOUR_USERNAME.github.io',
  base: '/YOUR_REPOSITORY_NAME',
  output: 'static',
  trailingSlash: 'always'
});
```

For a user or organization site named `YOUR_USERNAME.github.io`, leave `base: '/'`.

## Authoring model

Book folder example:

```text
content/books/tea-house-at-dusk/
  book.yml
  01.en.md
  01.zh-Hans.md
  01.units.yml
  02.en.md
  02.zh-Hans.md
  02.units.yml
```

Sentence syntax inside chapter markdown:

```md
---
title: Chapter 1
---

# Chapter 1

@en-010 At dusk, Mira pushed open the tea house door.
@en-020 Bells chimed above her head.

:::note
This note is visible in the language document but not aligned.
:::
```

Alignment syntax:

```yaml
units:
  - id: u001
    en: [en-010]
    zh-Hans: [zh-010]

  - id: u002
    en: [en-020]
    zh-Hans: [zh-020, zh-030]
```

## Repo map

```text
src/
  components/
    BaseLayout.astro
    ReaderShell.astro
  lib/
    library.ts
    paths.ts
    types.ts
  pages/
    index.astro
    books/[book]/index.astro
    books/[book]/[chapter]/index.astro
    docs/design.astro
  scripts/
    dual-reader.ts
content/books/
  tea-house-at-dusk/
docs/
  design.md
  chapter-schema.md
  reader-contract.md
AGENTS.md
```

## The important idea

Do not model the project as “left language” and “right language.”
That path leads to a UI-shaped data model, and those become cursed surprisingly fast.

Model **alignment units** instead.

Each unit says which sentence ids belong together across languages. The UI can then decide whether to show them side by side, stacked, or only on demand.

## Docs for humans and coding agents

- `docs/design.md`
- `docs/chapter-schema.md`
- `docs/reader-contract.md`
- `AGENTS.md`
