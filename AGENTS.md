# AGENTS

This file tells coding agents how to work in this repository without inventing bugs for sport.

## Core rules

- Preserve the **alignment unit** model.
- Never collapse the domain into hard-coded left/right language pairs.
- Keep the site static-compatible for GitHub Pages.
- Prefer explicit validation failures over silent fallback behavior.
- Preserve stable sentence ids unless a migration is deliberate and documented.

## Content rules

- Book metadata lives in `content/books/<book>/book.yml`.
- Chapter text lives in `content/books/<book>/<chapter>.<lang>.md`.
- Alignment data lives in `content/books/<book>/<chapter>.units.yml`.
- Sentence lines must use `@<sentence-id> ...` syntax.
- Notes and headings are language-local unless a later schema explicitly changes that.

## Code rules

- `src/lib/library.ts` is the canonical normalization layer.
- Reader runtime state lives in `src/scripts/dual-reader.ts`.
- Do not re-parse canonical markdown in the browser.
- New reader features should prefer emitted events over tight coupling.

## Validation rules

Do not relax these without a strong reason:

- duplicate sentence ids should fail the build
- unknown sentence ids in units files should fail the build
- sentences assigned to multiple units should fail the build
- missing chapter-language files for declared languages should fail the build

## UI rules

- Default to focus reading, not comparison overload.
- Keep primary and secondary language selectors independent of layout.
- Any layout feature must work on mobile.
- Styling should help reading, not fight it.

## Documentation rules

When changing architecture or contracts, update:

- `docs/design.md`
- `docs/chapter-schema.md`
- `docs/reader-contract.md`
- `README.md` if setup or authoring changed
