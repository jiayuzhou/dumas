# Dual Language Reader Design

This document is the high-level spec for the starter repo.
It is written to be useful both for humans and for coding agents that need a steady architectural rhythm instead of improvising a haunted labyrinth.

## 1. Product intent

Build a static website for reading aligned texts in multiple languages.

The reader should support:

- primary-language reading
- on-demand reveal of paired sentences
- side-by-side comparison
- stacked comparison
- switching any language into the primary role
- sentence-level alignment that survives non-1:1 translation structure

The website should be deployable to GitHub Pages and authored primarily from markdown and YAML.

## 2. Non-goals for the starter

The starter is **not** trying to solve everything at once.

Out of scope for v0:

- user accounts
- collaborative editing in-browser
- server-side search APIs
- audio synchronization
- OCR pipelines
- automatic sentence segmentation as canonical truth
- machine translation inside the production site

## 3. Architecture principles

### 3.1 Static first

Everything must work as a static build.
The browser handles interaction; the build step handles normalization and validation.

### 3.2 Content is canonical

The content repo is the source of truth.
The UI is a projection of normalized content data.

### 3.3 Alignment is language-neutral

Never store left/right pairs as the core model.
Store alignment units that map any number of sentence ids across any number of languages.

### 3.4 Stable ids beat clever heuristics

Sentence ids are explicit.
Automatic sentence splitting can be a helper tool later, but not the canonical source of truth.

### 3.5 Client JS should stay small

This is a reading product, not a JavaScript carnival.
Send only the interactivity needed for the reader.

## 4. Technology choice

### Framework

Use Astro as the site framework.

Rationale:

- static output is a natural fit
- content-driven sites are Astro’s home turf
- GitHub Pages deployment is straightforward
- the reader can be a small hydrated island or even plain client script

### Hosting

Use GitHub Pages.

### Data loading

Use a local filesystem loader in `src/lib/library.ts`.
This keeps the starter transparent and easy to debug.

A later iteration could migrate some pieces to Astro content collections if desired, but the current loader already gives strong control over cross-file validation.

## 5. Repository layout

```text
content/books/
  <book>/
    book.yml
    <chapter>.<lang>.md
    <chapter>.units.yml
src/
  components/
  lib/
  pages/
  scripts/
docs/
AGENTS.md
```

## 6. Content flow

### 6.1 Authoring inputs

For each book:

- one book manifest
- one markdown file per chapter-language pair
- one alignment file per chapter stem

### 6.2 Build-time normalization

The loader performs:

1. manifest parsing
2. chapter discovery
3. markdown frontmatter parsing
4. sentence-line parsing
5. block normalization
6. alignment file parsing
7. cross-file validation
8. production of a `LibraryData` object

### 6.3 Runtime rendering

At page render time, the current chapter is serialized as JSON into the page.
The client script reads that data and wires up interaction.

## 7. Domain model

### 7.1 Book

A book contains:

- localized title and optional summary
- declared languages
- default primary and secondary languages
- chapters

### 7.2 Chapter

A chapter contains:

- per-language normalized documents
- alignment units
- fast lookup from sentence id to unit id

### 7.3 Language document

A language document preserves reading order inside that language.
It contains block-level structure plus sentence records.

### 7.4 Alignment unit

An alignment unit is the cross-language bridge.
It maps zero or more sentence ids from each language into one conceptual unit.

## 8. Reader UX model

### Primary flow

The site should feel like reading first, comparing second.
That means the default layout is `focus`.

### Focus layout

The reader sees one language document and can click a sentence to reveal the aligned counterpart in a small peek panel.
This encourages reading without keeping the translation constantly visible.

### Split layout

Best for study, close comparison, and editing alignment.
Both documents stay visible.

### Stacked layout

Best for narrow screens or readers who dislike split columns.

### Swap behavior

A user can swap primary and secondary languages at any time.
The selection should remain anchored to the current alignment unit where possible.

## 9. Styling system

The visual system should feel bookish, not dashboard-ish.

Style goals:

- generous line height
- calm surfaces
- high contrast
- sticky but unobtrusive controls
- visible interaction affordances without neon chaos
- readable on phones
- sensible dark mode

Typography approach:

- UI uses a system sans stack
- reading panes use language-sensitive serif stacks when possible
- CJK languages use suitable serif fallbacks if present on the user’s system

## 10. Accessibility

The starter should maintain decent baseline accessibility.

Requirements:

- sentence segments are keyboard-focusable
- layout buttons expose pressed state
- semantic headings remain semantic headings
- focus mode counterpart panel uses `aria-live="polite"`
- language panels set `lang` and `dir`

Future improvements:

- visible shortcut help
- skip links
- reduced motion handling
- optional larger text presets

## 11. Validation rules

The loader must fail loudly when content is inconsistent.

At minimum validate:

- duplicate language codes in `book.yml`
- missing localized book titles for declared languages
- missing chapter markdown files per declared language
- missing alignment files
- duplicate sentence ids in a chapter-language file
- unknown languages in alignment files
- unknown sentence ids in alignment files
- any sentence assigned to more than one alignment unit

Recommended future validations:

- report unaligned sentence ids as warnings
- check consistent chapter titles across languages
- report suspiciously empty notes or units

## 12. URL and routing model

Routes:

- `/` library landing page
- `/books/<book>/` book overview
- `/books/<book>/<chapter>/` reader page

The current starter keeps language choice as client state, not part of the route.

Possible future route variants:

- query params for layout and language state
- deep links to sentence ids
- `/books/<book>/<chapter>#en-030`

## 13. Persistence model

Persist only the reading preferences that are cheap and useful:

- primary language
- secondary language
- layout mode

Do not persist everything under the sun in v0.
Tiny state is easier to keep sane.

## 14. Security and trust assumptions

The starter assumes the content repository is trusted.
That is why sentence markdown is rendered to HTML at build time without an additional sanitization layer.

If the site later accepts untrusted contributions or user-generated annotations, add sanitization and stricter rendering rules before exposing that path.

## 15. Extension roadmap

Suggested order for future work:

### Phase 1

- stable reader
- more books
- better authoring docs
- sentence deep-linking
- chapter previous/next controls

### Phase 2

- bookmarking
- chapter search
- inline glossary popovers
- URL persistence for settings

### Phase 3

- audio playback aligned to sentence ids
- annotations
- alignment editing tooling
- machine-assisted authoring support

## 16. Coding agent rules of engagement

Coding agents working in this repo should obey the following:

1. Do not rewrite the content model into left/right columns.
2. Do not make alignment 1:1 by assumption.
3. Do not move canonical text into the browser as raw markdown to be parsed at runtime.
4. Keep the site static-compatible.
5. Prefer explicit validation errors over silent fallback magic.
6. Preserve sentence ids unless there is a deliberate migration plan.
7. Treat `docs/` and `AGENTS.md` as part of the source of truth.

## 17. Why this starter uses a custom loader instead of a bigger framework abstraction

Because the hard part here is not page rendering.
It is cross-file content normalization and alignment validation.

A local filesystem loader is boring in a beautiful way:

- easy to understand
- easy to extend
- easy to debug
- good fit for coding agents

Sometimes the correct architecture is just a well-lit room with labeled drawers.
