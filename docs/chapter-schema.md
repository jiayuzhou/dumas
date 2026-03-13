# Chapter Schema

This document defines the authoring format for books, chapter markdown files, and sentence alignment maps.

## Goals

The chapter schema is designed to be:

- readable in GitHub
- easy to diff in pull requests
- stable under editing
- explicit about alignment
- tolerant of non-1:1 mappings
- extensible to more than two languages

## Folder contract

Each book lives in its own folder under `content/books/`.

Example:

```text
content/books/tea-house-at-dusk/
  book.yml
  01.en.md
  01.zh-Hans.md
  01.units.yml
```

## `book.yml`

`book.yml` is the book manifest.

Required fields:

```yaml
id: tea-house-at-dusk
slug: tea-house-at-dusk
title:
  en: The Tea House at Dusk
  zh-Hans: 黄昏茶馆
languages:
  - code: en
    label: English
    dir: ltr
    locale: en
    sentenceJoiner: space
  - code: zh-Hans
    label: 简体中文
    dir: ltr
    locale: zh-Hans
    sentenceJoiner: none
defaultPrimary: zh-Hans
defaultSecondary: en
```

### Field notes

- `id` is the canonical book id used by the code.
- `slug` is the route segment. It can equal `id`.
- `title` is a localized title map.
- `languages` defines the site-facing language metadata.
- `sentenceJoiner` controls whether the client inserts a space between sentence buttons when rebuilding paragraphs. Use `space` for English-like scripts and `none` for Chinese/Japanese-style scripts.
- `defaultPrimary` is the first reading language.
- `defaultSecondary` is the initially revealed comparison language.

## Chapter markdown files

Each chapter-language pair is a separate markdown file.

Filename pattern:

```text
<chapter-stem>.<language-code>.md
```

Examples:

- `01.en.md`
- `01.zh-Hans.md`
- `02.en.md`

The `chapter-stem` is the chapter slug and route segment.

## Chapter frontmatter

Supported frontmatter:

```yaml
---
title: Chapter 1 · The Door with Bells
description: Mira steps into a tea house that feels waiting and slightly impossible.
order: 1
---
```

Required:

- `title`

Optional:

- `description`
- `order`

If `order` is omitted, the loader derives it from the leading number in the chapter stem.

## Body syntax

The body supports four block types.

### 1. Headings

Standard markdown headings are supported.

```md
# Chapter Title
## Section Title
```

Headings are language-local blocks. They are not aligned.

### 2. Sentence lines

Aligned prose is written one sentence per line using the sentence marker syntax:

```md
@en-010 At dusk, Mira pushed open the tea house door.
@en-020 Bells chimed above her head.
```

Rules:

- sentence ids must be unique within the chapter-language file
- sentence ids should be stable
- use gaps like `010`, `020`, `030` instead of dense numbering to make later insertions easier
- sentence ids should be language-prefixed for readability, for example `en-010`, `zh-010`

### Multiline sentence content

If a sentence needs multiple source lines, continue it with indentation:

```md
@en-020 This sentence starts here
  and continues on the next indented line.
```

### Paragraph grouping

Consecutive sentence lines belong to the same paragraph until a blank line ends the paragraph.

```md
@en-010 Sentence one.
@en-020 Sentence two.

@en-030 New paragraph sentence one.
```

### 3. Note blocks

Language-local notes use fenced directives:

```md
:::note
This is a note block.
:::
```

The starter treats note blocks as visible prose blocks that are **not part of alignment**.

### 4. Dividers

Use `---` or `***` for thematic breaks.

## Alignment files

Each chapter stem has one alignment file.

Filename pattern:

```text
<chapter-stem>.units.yml
```

Example:

```yaml
units:
  - id: u001
    en: [en-010]
    zh-Hans: [zh-010]

  - id: u002
    en: [en-020]
    zh-Hans: [zh-020, zh-030]
    note: Example of a one-to-many alignment.
```

## Alignment unit rules

Each unit:

- has a unique `id`
- may contain one or more sentence ids per language
- may omit a language entirely if that passage has no counterpart yet
- may include an optional `note`

A sentence id may appear in **at most one** alignment unit.

## Why units instead of direct pairs

Direct pairs such as `en-010 -> zh-010` are okay only while the universe is being suspiciously cooperative.
Real translation alignment is not always 1:1.

Units handle:

- one-to-many
- many-to-one
- many-to-many
- future addition of a third or fourth language

## Loader behavior in the starter

The current loader:

- requires one markdown chapter file per declared language for each chapter stem
- requires one `.units.yml` file per chapter stem
- validates that all referenced sentence ids exist
- groups consecutive sentence lines into paragraph blocks
- renders sentence markdown as inline HTML
- renders note blocks as block HTML

## Authoring guidance

Recommended habits:

- keep sentence ids stable once published
- prefer semantic edits over renumbering
- use one alignment file per chapter, not per language pair
- align every sentence that should be clickable in the reader
- keep notes and headings language-local unless you later add a dedicated aligned block type

## Future extensions

A later version can add:

- gloss blocks
- footnotes with ids
- per-unit tags like `machine`, `manual`, `draft`
- paragraph-level alignment hints
- audio timing hooks per sentence
