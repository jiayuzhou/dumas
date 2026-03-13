# Book Processing Guide

This guide is for AI agents (Claude, Codex, etc.) and human editors who need to convert raw manuscript text into the Dumas Reader format. Follow it step by step.

## Overview

The pipeline converts raw text into three output files per chapter:

```
Input:  manuscripts/<book-id>/raw/chapter-01.txt  (or similar)
Output: content/books/<book-id>/01.en.md
        content/books/<book-id>/01.zh-Hans.md
        content/books/<book-id>/01.units.yml
```

Plus one `book.yml` manifest per book (created once, before processing chapters).

## Directory layout

```
manuscripts/
  <book-id>/
    README.md           ← source info, language pair, progress tracker
    raw/                ← original unprocessed text files
      chapter-01.txt
      chapter-02.txt
      ...

content/books/
  <book-id>/
    book.yml            ← book manifest (create first)
    01.en.md            ← processed chapter files
    01.zh-Hans.md
    01.units.yml
    ...
```

## Step 0: Set up the book

Before processing any chapters, create the book folder and manifest.

### Create `manuscripts/<book-id>/README.md`

Record the source, languages, and chapter list:

```markdown
# Book Title

- Source: [where the raw text came from]
- Languages: English (en), Simplified Chinese (zh-Hans)
- Total chapters: N

## Progress

- [ ] Chapter 1
- [ ] Chapter 2
- ...
```

### Create `content/books/<book-id>/book.yml`

Use this template and adapt it to your book:

```yaml
id: <book-id>
slug: <book-id>
title:
  en: English Title
  zh-Hans: 中文标题
summary:
  en: One-line English summary.
  zh-Hans: 一行中文摘要。
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

Adjust `defaultPrimary` based on which language the reader is primarily learning. If the reader is learning Chinese, set `zh-Hans` as primary. If learning English, set `en`.

For other language pairs, replace `zh-Hans` with the appropriate BCP 47 code (e.g., `ja` for Japanese, `fr` for French, `de` for German). Set `sentenceJoiner` to `none` for CJK languages and `space` for everything else.

## Step 1: Prepare raw text

Place the raw chapter text into `manuscripts/<book-id>/raw/`. Acceptable formats:

- **One file per chapter** (preferred): `chapter-01.txt`, `chapter-02.txt`, etc.
- **One big file**: a single file with clear chapter boundaries (headings, page breaks, `---` separators).
- **Bilingual file**: both languages interleaved or side by side — note which format it uses in the README.
- **Two monolingual files**: `chapter-01.en.txt` and `chapter-01.zh.txt`.

The raw text does not need any special formatting. It can be plain prose copied from a book, PDF extraction, or web scrape.

## Step 2: Process one chapter

Process chapters one at a time. Each chapter produces exactly three files.

### 2a: Segment into sentences

Read the raw text for one chapter. Split it into individual sentences for each language.

**Rules for sentence segmentation:**

- One sentence = one meaningful unit of prose. Typically ends with `.` `!` `?` `。` `！` `？`
- Keep quoted dialogue as one sentence even if it contains multiple punctuation marks, unless it is very long.
- Short consecutive sentences that form a tight unit (e.g., "He nodded. She smiled.") may stay separate — they can be grouped later in alignment.
- Do NOT split mid-sentence at commas, semicolons, or clause boundaries.
- For Chinese/Japanese, split at `。` `！` `？` and keep `，` `、` `；` within the sentence.
- Preserve paragraph boundaries — you will need them in the output.

### 2b: Assign sentence IDs

Each sentence gets a unique ID within its chapter-language file.

**ID format:** `@<lang>-<number>`

**Numbering rules:**
- Use zero-padded three-digit numbers: `010`, `020`, `030`, ...
- Increment by 10 to leave room for future insertions.
- Start each chapter at `010`.
- The prefix must match the language code: `en-010`, `zh-010`, `ja-010`, etc.
- For `zh-Hans`, use the short prefix `zh`: `@zh-010`, `@zh-020`, etc.

**Example:**

```
@en-010 The old man sat by the window.
@en-020 Rain streaked the glass.
@en-030 He had been waiting since morning.
```

### 2c: Write the chapter markdown files

Create `<chapter-stem>.<lang>.md` for each language.

**Template:**

```markdown
---
title: Chapter N · Chapter Title in This Language
description: Optional one-line summary in this language.
---

# Chapter Title

@en-010 First sentence of first paragraph.
@en-020 Second sentence of first paragraph.

@en-030 First sentence of second paragraph.
@en-040 Second sentence of second paragraph.
@en-050 Third sentence of second paragraph.
```

**Formatting rules:**
- Blank line between paragraphs (consecutive sentence lines = same paragraph).
- Headings (`#`, `##`) for chapter titles and section breaks. Headings are not aligned.
- `---` for scene breaks / thematic dividers.
- `:::note` blocks for translator notes or context (language-local, not aligned).
- Inline markdown (`*italic*`, `**bold**`) is allowed within sentences.
- Do NOT use block-level markdown (lists, tables, code blocks) inside sentence lines.

### 2d: Create the alignment file

Create `<chapter-stem>.units.yml` mapping sentences across languages.

**Template:**

```yaml
units:
  - id: u001
    en: [en-010]
    zh-Hans: [zh-010]

  - id: u002
    en: [en-020]
    zh-Hans: [zh-020]
```

**Alignment rules:**

- Unit IDs: `u001`, `u002`, `u003`, ... (zero-padded three digits, sequential).
- Most units will be 1:1 — one sentence in each language.
- Use 1:many when one language needs multiple sentences to express what the other says in one:
  ```yaml
  - id: u015
    en: [en-150]
    zh-Hans: [zh-150, zh-160]
  ```
- Use many:many when the sentence boundaries don't align across languages:
  ```yaml
  - id: u020
    en: [en-200, en-210]
    zh-Hans: [zh-200, zh-210]
  ```
- Every sentence that should be interactive in the reader MUST appear in exactly one unit.
- A sentence may appear in at most one unit (the build will fail otherwise).
- If a sentence has no counterpart (e.g., a translator's addition), you may omit that language from the unit or leave it as an empty array.

### 2e: Validate

After creating all three files for a chapter, run:

```bash
npm run validate:library
```

This checks:
- All sentence IDs referenced in units exist in the markdown files.
- No sentence ID appears in multiple units.
- No duplicate sentence IDs within a file.
- All declared languages have a markdown file for the chapter.

Fix any errors before moving on.

## Step 3: Update progress

After a chapter passes validation, update `manuscripts/<book-id>/README.md`:

```markdown
- [x] Chapter 1
- [ ] Chapter 2
```

## Common patterns and edge cases

### Sentences that exist in only one language

Sometimes a translator adds a clarifying sentence with no direct counterpart. Create a unit with only one language:

```yaml
  - id: u033
    en: []
    zh-Hans: [zh-330]
```

### Section headings mid-chapter

Use markdown headings. They are not aligned and don't need sentence IDs:

```markdown
@en-100 Last sentence before the break.

## Part Two

@en-110 First sentence after the break.
```

### Very long sentences

If a sentence is very long, you can wrap it with indentation:

```markdown
@en-050 This is a very long sentence that describes
  the entire landscape in painstaking detail and just
  keeps going.
```

### Dialogue with speaker attribution

Keep the attribution and dialogue together as one sentence:

```markdown
@en-070 "I don't think so," said the professor, shaking his head.
```

### Poetry or verse

Each line of verse can be a separate sentence, aligned line-by-line:

```yaml
  - id: u040
    en: [en-400]
    zh-Hans: [zh-400]
  - id: u041
    en: [en-410]
    zh-Hans: [zh-410]
```

## Quality checklist

Before considering a chapter done, verify:

- [ ] Every sentence has a unique ID with the correct language prefix
- [ ] IDs increment by 10 (gaps are fine, duplicates are not)
- [ ] Paragraph breaks match the original text's paragraph structure
- [ ] Alignment units cover all sentences that should be interactive
- [ ] No sentence appears in more than one unit
- [ ] `npm run validate:library` passes with no errors
- [ ] Chapter titles exist in both languages in the frontmatter
- [ ] The prose reads naturally — don't split sentences in awkward places

## Tips for AI agents

- **Process one chapter per session.** Don't try to do the whole book at once.
- **Read the raw text fully before segmenting.** Understand the paragraph structure and narrative flow first.
- **When in doubt, keep sentences together** rather than over-splitting. It's easier to split later than to merge.
- **Match paragraph structure across languages.** If the English has 3 paragraphs, the Chinese should too (where the source allows).
- **Alignment is about meaning, not grammar.** Two English sentences might map to one Chinese sentence if they express the same idea. Align by meaning.
- **Run validation after every chapter.** Don't batch — catch errors early.
- **If the raw text has errors** (OCR artifacts, encoding issues), fix them in the output. Note significant corrections in a `:::note` block.
