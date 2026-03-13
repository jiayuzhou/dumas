# Reader Component Contract

This document describes the client-side reader contract used by the starter.

## Component shape

The starter mounts one reader instance onto a root element marked with:

```html
<section data-dual-reader-root>
```

Inside the root, the server renders:

- toolbar controls
- primary panel container
- secondary panel container
- focus peek panel container
- one JSON payload script tag

The client script hydrates behavior by reading the payload and attaching interaction handlers.

## Payload contract

The JSON payload contains:

```ts
type ReaderPayload = {
  bookTitle: string;
  chapter: ChapterData;
  languages: LanguageMeta[];
  defaultPrimary: string;
  defaultSecondary?: string;
};
```

Important detail: the reader does **not** ingest raw markdown files directly. It consumes a normalized `ChapterData` object produced by the loader.

## `ChapterData`

```ts
type ChapterData = {
  bookId: string;
  bookSlug: string;
  id: string;
  slug: string;
  order: number;
  titles: Record<string, string>;
  descriptions: Partial<Record<string, string>>;
  languages: Record<string, ChapterLanguageDocument>;
  units: AlignmentUnit[];
  sentenceToUnit: Record<string, Record<string, string>>;
};
```

## `ChapterLanguageDocument`

```ts
type ChapterLanguageDocument = {
  code: string;
  title: string;
  description?: string;
  blocks: ReaderBlock[];
  sentenceOrder: string[];
  sentences: Record<string, SentenceRecord>;
};
```

## `ReaderBlock`

```ts
type ReaderBlock = ParagraphBlock | HeadingBlock | NoteBlock | DividerBlock;
```

This is intentionally UI-friendly.
The client does not need to re-parse markdown structure, only render normalized blocks.

## State contract

The runtime state is:

```ts
type ReaderState = {
  primary: string;
  secondary: string;
  layout: 'focus' | 'split' | 'stacked';
  activeSentenceId: string | null;
  activeUnitId: string | null;
};
```

## Layout semantics

### `focus`

- render full primary document
- hide the full secondary document
- render only the currently aligned counterpart in a peek panel

### `split`

- render full primary document
- render full secondary document beside it
- clicking a sentence highlights aligned sentences across both panels
- clicking in primary scrolls the secondary counterpart into view

### `stacked`

- render full primary document
- render full secondary document below it
- interaction semantics are the same as split, except the panes stack vertically

## Public events

The reader dispatches bubbling custom events.

### `reader:ready`

```ts
{
  primary: string;
  secondary: string;
  layout: 'focus' | 'split' | 'stacked';
}
```

### `reader:settings-change`

```ts
{
  primary: string;
  secondary: string;
  layout: 'focus' | 'split' | 'stacked';
}
```

### `reader:sentence-select`

```ts
{
  language: string;
  sentenceId: string;
  unitId: string | null;
}
```

These events are the extension seam for analytics, bookmarking, annotations, audio sync, or glossary sidebars.

## Persistence contract

The starter persists only view settings:

```ts
{
  primary: string;
  secondary: string;
  layout: 'focus' | 'split' | 'stacked';
}
```

Storage key:

```text
dual-reader:<bookId>
```

The active sentence is not persisted in the starter.

## Invariants

The client relies on these invariants:

- `primary` and `secondary` must refer to declared languages
- `primary !== secondary` whenever more than one language exists
- a sentence id belongs to at most one unit in a given chapter
- `sentenceToUnit[lang][sentenceId]` must resolve consistently with `units`
- blocks preserve reading order inside each language document

## Extension points

Safe extension points:

- add new layout modes
- add keyboard shortcuts
- add search within current chapter
- add bookmarking and URL fragment persistence
- add audio playback using sentence ids as anchors
- add notes, glosses, and dictionaries as sidecars

Danger zone extension points:

- re-parsing raw markdown in the browser
- converting the canonical data model into left/right arrays
- assuming all alignments are 1:1
- storing layout semantics in content files

## Performance expectations

The starter is optimized for a static content site and typical chapter sizes.

Current choices:

- documents are rendered once per language/layout change
- selection updates only toggle classes and refresh the focus peek panel
- no framework runtime is required

If chapters become very large, future optimization should focus on:

- incremental DOM patching
- virtualized long documents
- scroll position preservation across language swaps
- precomputed sentence lookup indexes
