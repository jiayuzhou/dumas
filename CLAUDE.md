# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dumas Reader is a static Astro site for sentence-aligned multilingual reading. It treats **alignment as data** and **layout as presentation** — the same chapter can be read with any language as primary without touching the content model. Deployed to GitHub Pages at jiayuzhou.github.io/dumas.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (usually localhost:4321) |
| `npm run build` | Validate content + build static site to `dist/` |
| `npm run preview` | Preview built site locally |
| `npm run check` | Astro and TypeScript diagnostics |
| `npm run validate:library` | Validate content model only (books, chapters, alignment units) |

There is no test suite. Treat `npm run validate:library` and `npm run check` as the pre-PR quality gates.

## Architecture

**Content model** (`content/books/<book>/`):
- `book.yml` — book metadata, language declarations, defaults
- `<stem>.<lang>.md` — one markdown file per chapter-language pair, with sentence lines (`@en-010 Text here.`)
- `<stem>.units.yml` — alignment map grouping sentence IDs across languages
- `<stem>.notes.yml` — optional sentence annotations

**Build-time** (`src/lib/`):
- `library.ts` — content loader and validator. Discovers books, parses markdown into normalized `ReaderBlock` objects, validates alignment integrity. Uses Zod for schema validation and `marked` for markdown parsing. Results are cached in memory.
- `types.ts` — core interfaces: `BookConfig`, `ChapterData`, `AlignmentUnit`, `ReaderBlock`, `SentenceAnnotation`
- `paths.ts` — URL helpers respecting Astro's base path

**Pages** (`src/pages/`): Static routes generated via `getStaticPaths()`:
- `/` — library listing
- `/books/[book]/` — book overview
- `/books/[book]/[chapter]/` — reader page (embeds chapter data as JSON for the client)

**Client runtime** (`src/scripts/dual-reader.ts`):
- Mounts on `[data-dual-reader-root]`, reads embedded JSON, manages reader state
- Three layouts: focus (with peek panel), split (side-by-side), stacked
- Persists preferences to localStorage (`dual-reader:{bookId}`, `dual-reader-fontsize:{bookId}`)
- Emits custom events: `reader:ready`, `reader:settings-change`, `reader:sentence-select`

**Styling** (`src/styles/global.css`): CSS custom properties with light/dark theme support. Purple accent palette.

## Key Design Rules

- **Alignment-unit model**: Never hard-code left/right language pairs. Use language-neutral alignment units.
- **Static only**: No server runtime or network calls in the reader. Everything must deploy to GitHub Pages.
- **Content is canonical**: Markdown/YAML is the source of truth. Do not parse markdown in the browser.
- **Stable sentence IDs**: Use explicit IDs (`@en-010`), never auto-generate. Don't change IDs unless doing a deliberate migration.
- **Independent selectors**: Primary/secondary language choice is independent of layout mode. All layouts must work on mobile.
- **Prefer events over coupling**: Use emitted custom events for reader communication.

## Content Authoring

- `sentenceJoiner`: use `space` for Latin scripts, `none` for CJK
- Sentence IDs use gaps (010, 020, 030) to allow future insertions
- Blank lines between sentence lines start new paragraphs
- Multiline sentences: indent continuation lines by 2+ spaces
- `:::note` / `:::` blocks create language-specific notes

## Configuration

`astro.config.mjs`: static output, GitHub Pages base path (`/dumas`), trailing slash enforced. Path alias `@/*` → `src/*` (in tsconfig.json).
