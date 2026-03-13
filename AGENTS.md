# Repository Guidelines

Concise contributor guide for this dual-language reader starter. Keep the site static-compatible, align sentences as data, and favor explicit validation over silent fallback.

## Project Structure & Module Organization

- Content: `content/books/<book>/` with `book.yml`, `<chapter>.<lang>.md`, `<chapter>.units.yml`.
- Source: `src/` (Astro pages, components, styles). Normalization lives in `src/lib/library.ts`.
- Reader runtime: `src/scripts/dual-reader.ts` (mounts, state, events).
- Docs: `docs/` (design, schema, reader contract). Utilities in `scripts/`.

Example chapter files:
`content/books/tea-house-at-dusk/01.en.md`, `01.zh-Hans.md`, `01.units.yml`.

## Build, Test, and Development Commands

- `npm run dev`: Start Astro dev server.
- `npm run validate:library`: Validate content model (books, chapters, units).
- `npm run check`: Type and Astro diagnostics.
- `npm run build`: Validate then build static site for GitHub Pages.

## Coding Style & Naming Conventions

- TypeScript, ES modules. Prefer small, pure functions in `src/lib`.
- Do not parse markdown in the browser; use normalized `ChapterData` only.
- Sentence lines: `@<sentence-id> <markdown>`, e.g., `@en-010 Bells chimed.`
- Filenames: `<chapter-stem>.<lang>.md` and `<chapter-stem>.units.yml` (e.g., `02.en.md`).

## Testing Guidelines

- Treat validation as tests: run `npm run validate:library` and `npm run check` before PRs.
- Validation must fail on: duplicate sentence ids, unknown unit references, multi-assigned sentences, or missing chapter-language files.

## Commit & Pull Request Guidelines

- Commits: imperative mood, scoped changes, reference issues (`Fix reader layout (#123)`).
- PRs: clear description, rationale, and screenshots/GIFs for UI changes. Link issues and include reproduction steps.
- Do not change sentence ids unless performing a deliberate, documented migration.

## Agent-Specific Rules

- Preserve the alignment-unit model; never hard-code left/right language pairs.
- Keep primary/secondary language selectors independent of layout; all layouts must work on mobile.
- Prefer emitted events over tight coupling in the reader.

## Security & Configuration Tips

- Configure `astro.config.mjs` for GitHub Pages (`site`, `base`, `output: 'static'`).
- No server runtime or network calls in the reader; keep it static-friendly.
