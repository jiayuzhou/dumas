# Dumas Reader

[![Deploy to GitHub Pages](https://github.com/jiayuzhou/dumas/actions/workflows/deploy.yml/badge.svg)](https://github.com/jiayuzhou/dumas/actions/workflows/deploy.yml)

A static Astro site for sentence-aligned multilingual reading, deployed at **[jiayuzhou.github.io/dumas](https://jiayuzhou.github.io/dumas)**.

- One book = one folder
- One chapter-language pair = one markdown file
- One alignment map = one YAML file
- No server runtime — pure static output
- Focus, split, and stacked reading layouts

The project treats **alignment as data** and **layout as presentation**. The same chapter can be read with any language as primary without touching the content model.

---

## Quick start

```bash
npm install
npm run dev
```

Open the local URL printed by Astro (usually `http://localhost:4321`).

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start local dev server with hot reload |
| `npm run validate:library` | Validate all books and chapters before building |
| `npm run build` | Validate then build static output to `dist/` |
| `npm run preview` | Preview the built site locally |
| `npm run check` | Run Astro and TypeScript diagnostics |

`npm run build` always runs validation first. If validation fails the build stops and prints the error.

---

## Deployment

### GitHub Pages (recommended)

The repo ships with a GitHub Actions workflow at `.github/workflows/deploy.yml` that builds and deploys automatically on every push to `main`.

**One-time setup:**

1. Go to **Settings → Pages** in your GitHub repository
2. Set **Source** to **GitHub Actions**
3. Update `astro.config.mjs` with your own site URL and base path:

```js
export default defineConfig({
  site: 'https://YOUR_USERNAME.github.io',
  base: '/YOUR_REPOSITORY_NAME',
  output: 'static',
  trailingSlash: 'always'
});
```

For a root user/org site (`YOUR_USERNAME.github.io` with no sub-path), set `base: '/'`.

**After setup**, push to `main` and GitHub Actions will build and deploy. Check progress under the **Actions** tab. The live URL appears in **Settings → Pages** once the first deploy succeeds.

> **Note:** Make sure Pages source is set to "GitHub Actions", not "Deploy from a branch". The branch-based setting runs Jekyll against the raw source files, which fails on Astro syntax.

### Build status

The badge at the top of this file reflects the latest deploy status. Click it to see the Actions run log.

---

## Creating new content

### 1. Create a book folder

Add a new folder under `content/books/` using a URL-safe slug:

```text
content/books/my-book/
```

### 2. Write `book.yml`

```yaml
id: my-book
slug: my-book
title:
  en: My Book Title
  fr: Mon Titre de Livre
languages:
  - code: en
    label: English
    dir: ltr
    locale: en
    sentenceJoiner: space
  - code: fr
    label: Français
    dir: ltr
    locale: fr
    sentenceJoiner: space
defaultPrimary: fr
defaultSecondary: en
```

**Field notes:**
- `id` and `slug` can be the same value
- `title` requires a key for every declared language
- `sentenceJoiner`: use `space` for Latin-script languages, `none` for Chinese/Japanese
- `dir`: `ltr` or `rtl`

### 3. Write chapter files

One file per language per chapter, named `<chapter-stem>.<lang-code>.md`:

```text
content/books/my-book/
  01.en.md
  01.fr.md
```

Chapter markdown format:

```md
---
title: Chapter 1 · The Beginning
order: 1
---

# Chapter 1

@en-010 The first sentence of the chapter.
@en-020 The second sentence.
@en-030 A third sentence that belongs to a new paragraph.

:::note
This note is visible in the reader but not aligned to any other language.
:::

@en-040 Back to aligned prose.
```

**Sentence ID rules:**
- Prefix with the language code: `en-010`, `fr-010`
- Use gaps (`010`, `020`, `030`) so you can insert sentences later without renumbering
- IDs must be unique within the file
- Keep IDs stable once the chapter is published — the alignment map references them by ID

**Multiline sentences** — indent continuation lines by 2+ spaces:

```md
@en-020 This sentence is long
  and continues on the next line.
```

**Paragraph grouping** — consecutive sentence lines form one paragraph; a blank line starts a new paragraph.

### 4. Write the alignment file

One file per chapter stem, named `<chapter-stem>.units.yml`:

```yaml
units:
  - id: u001
    en: [en-010]
    fr: [fr-010]

  - id: u002
    en: [en-020]
    fr: [fr-020, fr-030]

  - id: u003
    note: "Idiomatic — not a literal translation"
    en: [en-030]
    fr: [fr-040]
```

Each unit groups sentence IDs that are translations of each other. A language key can hold multiple IDs (many-to-one or many-to-many). A language key can be omitted entirely if that passage has no counterpart yet.

### 5. Validate

```bash
npm run validate:library
```

The validator checks:
- `book.yml` structure and required fields
- All declared languages have a file for each chapter
- No duplicate sentence IDs within a chapter file
- All sentence IDs referenced in alignment maps exist
- No sentence ID appears in more than one alignment unit
- All alignment language codes match declared book languages

Fix any errors it reports before building.

### 6. Build and preview

```bash
npm run build
npm run preview
```

---

## Repo map

```text
content/books/          ← book folders live here
  les-trois-mousquetaires/
  tea-house-at-dusk/
src/
  components/
    BaseLayout.astro    ← page shell, site header
    ReaderShell.astro   ← reader toolbar + panels
  lib/
    library.ts          ← content loader and validator
    paths.ts            ← URL helpers
    types.ts            ← TypeScript interfaces
  pages/
    index.astro
    books/[book]/index.astro
    books/[book]/[chapter]/index.astro
    docs/design.astro
  scripts/
    dual-reader.ts      ← client-side reader logic
  styles/
    global.css
scripts/
  validate-library.ts   ← pre-build validation script
docs/
  design.md             ← architecture and design decisions
  chapter-schema.md     ← full authoring format reference
  reader-contract.md    ← client reader API
AGENTS.md               ← guidelines for coding agents
```

---

## Docs

- [`docs/design.md`](docs/design.md) — architecture, data model, layout system, accessibility
- [`docs/chapter-schema.md`](docs/chapter-schema.md) — full authoring format reference
- [`docs/reader-contract.md`](docs/reader-contract.md) — client-side reader events and API
- [`AGENTS.md`](AGENTS.md) — rules for coding agents working on this repo
