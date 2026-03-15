import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import { marked } from 'marked';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { existsSync } from 'node:fs';

import type {
  AlignmentUnit,
  BookAbout,
  BookConfig,
  BookData,
  ChapterData,
  ChapterFrontmatter,
  ChapterLanguageDocument,
  LibraryData,
  ReaderBlock,
  SentenceAnnotation,
  SentenceRecord
} from './types';

const CONTENT_ROOT = fileURLToPath(new URL('../../content/books/', import.meta.url));

marked.setOptions({
  gfm: true,
  breaks: false
});

const LanguageMetaSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  dir: z.enum(['ltr', 'rtl']).default('ltr'),
  locale: z.string().optional(),
  sentenceJoiner: z.enum(['space', 'none']).default('space')
});

const BookConfigSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).optional(),
  title: z.record(z.string(), z.string().min(1)),
  summary: z.record(z.string(), z.string()).optional(),
  languages: z.array(LanguageMetaSchema).min(2),
  defaultPrimary: z.string().min(1),
  defaultSecondary: z.string().min(1).optional()
});

const ChapterFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    order: z.number().int().positive().optional()
  })
  .passthrough();

let cachedLibraryPromise: Promise<LibraryData> | null = null;

export async function getLibrary(): Promise<LibraryData> {
  if (!cachedLibraryPromise) {
    cachedLibraryPromise = loadLibrary();
  }

  return cachedLibraryPromise;
}

export async function getBookBySlug(bookSlug: string): Promise<BookData | undefined> {
  const library = await getLibrary();
  return library.bookMap[bookSlug];
}

export async function getChapterBySlug(
  bookSlug: string,
  chapterSlug: string
): Promise<{ book: BookData; chapter: ChapterData } | undefined> {
  const book = await getBookBySlug(bookSlug);
  if (!book) return undefined;

  const chapter = book.chapters.find((entry) => entry.slug === chapterSlug);
  if (!chapter) return undefined;

  return { book, chapter };
}

async function loadLibrary(): Promise<LibraryData> {
  const bookDirectories = await readdir(CONTENT_ROOT, { withFileTypes: true });
  const books: BookData[] = [];

  for (const entry of bookDirectories) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    books.push(await loadBook(path.join(CONTENT_ROOT, entry.name), entry.name));
  }

  books.sort((left, right) => left.config.slug.localeCompare(right.config.slug));

  const bookMap = Object.fromEntries(books.map((book) => [book.config.slug, book]));
  return { books, bookMap };
}

async function loadBook(bookDirectory: string, directoryName: string): Promise<BookData> {
  const bookConfigPath = path.join(bookDirectory, 'book.yml');
  const rawBookConfig = await readFile(bookConfigPath, 'utf8');
  const parsedBookConfig = BookConfigSchema.parse(parseYaml(rawBookConfig)) as BookConfig;
  const config = validateBookConfig(parsedBookConfig, directoryName, bookConfigPath);
  const languageCodes = config.languages.map((language) => language.code);

  const files = await readdir(bookDirectory, { withFileTypes: true });
  const chapterGroups = new Map<
    string,
    {
      chapterFiles: Map<string, string>;
      unitsPath?: string;
      notesPath?: string;
    }
  >();

  for (const file of files) {
    if (!file.isFile()) continue;
    if (file.name === 'book.yml' || file.name === 'about.md') continue;

    const notesMatch = file.name.match(/^(.*)\.notes\.ya?ml$/);
    if (notesMatch) {
      const chapterStem = notesMatch[1];
      const current = chapterGroups.get(chapterStem) ?? {
        chapterFiles: new Map<string, string>()
      };
      current.notesPath = path.join(bookDirectory, file.name);
      chapterGroups.set(chapterStem, current);
      continue;
    }

    const unitsMatch = file.name.match(/^(.*)\.units\.ya?ml$/);
    if (unitsMatch) {
      const chapterStem = unitsMatch[1];
      const current = chapterGroups.get(chapterStem) ?? {
        chapterFiles: new Map<string, string>()
      };
      current.unitsPath = path.join(bookDirectory, file.name);
      chapterGroups.set(chapterStem, current);
      continue;
    }

    const chapterMatch = file.name.match(/^(.*)\.([A-Za-z0-9-]+)\.md$/);
    if (chapterMatch) {
      const [, chapterStem, languageCode] = chapterMatch;
      const current = chapterGroups.get(chapterStem) ?? {
        chapterFiles: new Map<string, string>()
      };
      current.chapterFiles.set(languageCode, path.join(bookDirectory, file.name));
      chapterGroups.set(chapterStem, current);
    }
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const chapterStems = [...chapterGroups.keys()].sort(collator.compare);
  const chapters: ChapterData[] = [];

  for (const chapterStem of chapterStems) {
    const group = chapterGroups.get(chapterStem);
    if (!group) continue;

    if (!group.unitsPath) {
      throw new Error(
        `Missing units file for chapter "${chapterStem}" in book "${config.id}". Expected "${chapterStem}.units.yml".`
      );
    }

    for (const languageCode of languageCodes) {
      if (!group.chapterFiles.has(languageCode)) {
        throw new Error(
          `Missing chapter file for language "${languageCode}" in chapter "${chapterStem}" of book "${config.id}".`
        );
      }
    }

    chapters.push(await loadChapter(config, chapterStem, group.chapterFiles, group.unitsPath, group.notesPath));
  }

  const about = await loadAbout(bookDirectory);

  return {
    config,
    chapters,
    ...(about ? { about } : {})
  };
}

async function loadAbout(bookDirectory: string): Promise<BookAbout | undefined> {
  const aboutPath = path.join(bookDirectory, 'about.md');
  if (!existsSync(aboutPath)) return undefined;

  const raw = await readFile(aboutPath, 'utf8');
  const { data, content } = matter(raw);
  const synopsisHtml = String(await Promise.resolve(marked.parse(content))).trim();

  return {
    author: typeof data.author === 'string' ? data.author : undefined,
    translator: typeof data.translator === 'string' ? data.translator : undefined,
    copyright: typeof data.copyright === 'string' ? data.copyright : undefined,
    synopsisHtml
  };
}

function validateBookConfig(config: BookConfig, directoryName: string, filePath: string): BookData['config'] {
  const slug = config.slug ?? directoryName;
  const languageCodes = new Set<string>();

  for (const language of config.languages) {
    if (languageCodes.has(language.code)) {
      throw new Error(`Duplicate language code "${language.code}" in ${filePath}.`);
    }
    languageCodes.add(language.code);

    if (!config.title[language.code]) {
      throw new Error(`Missing title for language "${language.code}" in ${filePath}.`);
    }
  }

  if (!languageCodes.has(config.defaultPrimary)) {
    throw new Error(
      `defaultPrimary "${config.defaultPrimary}" is not declared in languages for ${filePath}.`
    );
  }

  if (config.defaultSecondary && !languageCodes.has(config.defaultSecondary)) {
    throw new Error(
      `defaultSecondary "${config.defaultSecondary}" is not declared in languages for ${filePath}.`
    );
  }

  return {
    ...config,
    slug,
    defaultSecondary:
      config.defaultSecondary ??
      config.languages.find((language) => language.code !== config.defaultPrimary)?.code
  };
}

async function loadChapter(
  bookConfig: BookData['config'],
  chapterStem: string,
  chapterFiles: Map<string, string>,
  unitsPath: string,
  notesPath?: string
): Promise<ChapterData> {
  const languages: Record<string, ChapterLanguageDocument> = {};
  const titles: Record<string, string> = {};
  const descriptions: Record<string, string> = {};
  let order: number | undefined;

  for (const language of bookConfig.languages) {
    const chapterFilePath = chapterFiles.get(language.code);
    if (!chapterFilePath) {
      throw new Error(
        `Internal error: chapter file missing for language "${language.code}" in chapter "${chapterStem}".`
      );
    }

    const parsed = await parseChapterMarkdown(chapterFilePath, language.code);
    languages[language.code] = parsed.document;
    titles[language.code] = parsed.frontmatter.title;

    if (parsed.frontmatter.description) {
      descriptions[language.code] = parsed.frontmatter.description;
    }

    if (parsed.frontmatter.order && order === undefined) {
      order = parsed.frontmatter.order;
    }
  }

  const units = await parseUnitsFile(unitsPath, bookConfig.languages.map((language) => language.code));
  const sentenceToUnit: Record<string, Record<string, string>> = Object.fromEntries(
    bookConfig.languages.map((language) => [language.code, {}])
  );

  const seenUnitIds = new Set<string>();

  for (const unit of units) {
    if (seenUnitIds.has(unit.id)) {
      throw new Error(`Duplicate unit id "${unit.id}" in ${unitsPath}.`);
    }
    seenUnitIds.add(unit.id);

    for (const [languageCode, sentenceIds] of Object.entries(unit.parts)) {
      const document = languages[languageCode];
      if (!document) {
        throw new Error(
          `Unit "${unit.id}" references undeclared language "${languageCode}" in ${unitsPath}.`
        );
      }

      for (const sentenceId of sentenceIds) {
        if (!document.sentences[sentenceId]) {
          throw new Error(
            `Unit "${unit.id}" references missing sentence "${sentenceId}" in language "${languageCode}" (${unitsPath}).`
          );
        }

        if (sentenceToUnit[languageCode][sentenceId]) {
          throw new Error(
            `Sentence "${sentenceId}" in language "${languageCode}" is assigned to multiple units in ${unitsPath}.`
          );
        }

        sentenceToUnit[languageCode][sentenceId] = unit.id;
      }
    }
  }

  const annotations = notesPath ? await parseNotesFile(notesPath) : [];

  const derivedOrder =
    order ??
    Number.parseInt(chapterStem.match(/^\d+/)?.[0] ?? '', 10) ??
    0;

  return {
    bookId: bookConfig.id,
    bookSlug: bookConfig.slug,
    id: chapterStem,
    slug: chapterStem,
    order: Number.isNaN(derivedOrder) ? 0 : derivedOrder,
    titles,
    descriptions,
    languages,
    units,
    sentenceToUnit,
    annotations
  };
}

async function parseChapterMarkdown(
  filePath: string,
  languageCode: string
): Promise<{ frontmatter: ChapterFrontmatter; document: ChapterLanguageDocument }> {
  const raw = await readFile(filePath, 'utf8');
  const { data, content } = matter(raw);
  const frontmatter = ChapterFrontmatterSchema.parse(data) as ChapterFrontmatter;
  const lines = content.replace(/\r\n?/g, '\n').split('\n');

  const blocks: ReaderBlock[] = [];
  const sentences: Record<string, SentenceRecord> = {};
  const sentenceOrder: string[] = [];

  let paragraphSentenceIds: string[] = [];
  let paragraphCount = 0;
  let headingCount = 0;
  let noteCount = 0;
  let dividerCount = 0;
  let lineIndex = 0;

  const flushParagraph = () => {
    if (paragraphSentenceIds.length === 0) return;
    paragraphCount += 1;
    blocks.push({
      type: 'paragraph',
      id: `${languageCode}-p-${String(paragraphCount).padStart(3, '0')}`,
      sentenceIds: [...paragraphSentenceIds]
    });
    paragraphSentenceIds = [];
  };

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      lineIndex += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      headingCount += 1;
      const [, hashes, text] = headingMatch;
      const html = String(await Promise.resolve(marked.parseInline(text))).trim();
      blocks.push({
        type: 'heading',
        id: `${languageCode}-h-${String(headingCount).padStart(3, '0')}`,
        depth: hashes.length,
        text,
        html
      });
      lineIndex += 1;
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      flushParagraph();
      dividerCount += 1;
      blocks.push({
        type: 'divider',
        id: `${languageCode}-d-${String(dividerCount).padStart(3, '0')}`
      });
      lineIndex += 1;
      continue;
    }

    const noteMatch = line.match(/^:::(\w+)\s*$/);
    if (noteMatch) {
      flushParagraph();
      noteCount += 1;
      const variant = noteMatch[1];
      const noteLines: string[] = [];
      lineIndex += 1;

      while (lineIndex < lines.length && lines[lineIndex].trim() !== ':::') {
        noteLines.push(lines[lineIndex]);
        lineIndex += 1;
      }

      if (lineIndex >= lines.length) {
        throw new Error(`Unclosed :::${variant} block in ${filePath}.`);
      }

      const html = String(await Promise.resolve(marked.parse(noteLines.join('\n')))).trim();
      blocks.push({
        type: 'note',
        id: `${languageCode}-n-${String(noteCount).padStart(3, '0')}`,
        variant,
        html
      });
      lineIndex += 1;
      continue;
    }

    const sentenceMatch = line.match(/^@([A-Za-z0-9._:-]+)\s+(.+)$/);
    if (sentenceMatch) {
      const [, sentenceId, initialContent] = sentenceMatch;
      if (sentences[sentenceId]) {
        throw new Error(`Duplicate sentence id "${sentenceId}" in ${filePath}.`);
      }

      const sentenceLines = [initialContent];
      lineIndex += 1;

      while (lineIndex < lines.length) {
        const lookahead = lines[lineIndex];
        if (!lookahead.trim()) break;
        if (/^\s{2,}\S/.test(lookahead) || /^\t\S/.test(lookahead)) {
          sentenceLines.push(lookahead.replace(/^\s+/, ''));
          lineIndex += 1;
          continue;
        }
        break;
      }

      const markdown = sentenceLines.join('\n');
      const html = String(await Promise.resolve(marked.parseInline(markdown))).trim();
      sentences[sentenceId] = {
        id: sentenceId,
        language: languageCode,
        markdown,
        html
      };
      sentenceOrder.push(sentenceId);
      paragraphSentenceIds.push(sentenceId);
      continue;
    }

    throw new Error(
      `Unexpected content in ${filePath} at line ${lineIndex + 1}. Sentence lines must start with @<sentence-id>.`
    );
  }

  flushParagraph();

  return {
    frontmatter,
    document: {
      code: languageCode,
      title: frontmatter.title,
      description: frontmatter.description,
      blocks,
      sentenceOrder,
      sentences
    }
  };
}

async function parseUnitsFile(filePath: string, allowedLanguages: string[]): Promise<AlignmentUnit[]> {
  const raw = await readFile(filePath, 'utf8');
  const parsed = parseYaml(raw) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Units file ${filePath} must contain an object with a top-level "units" array.`);
  }

  const rawUnits = (parsed as { units?: unknown }).units;
  if (!Array.isArray(rawUnits)) {
    throw new Error(`Units file ${filePath} must contain a top-level "units" array.`);
  }

  return rawUnits.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Unit entry #${index + 1} in ${filePath} must be an object.`);
    }

    const { id, note, ...rest } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error(`Unit entry #${index + 1} in ${filePath} must include a non-empty string id.`);
    }

    const parts: Record<string, string[]> = {};
    for (const [languageCode, value] of Object.entries(rest)) {
      if (!allowedLanguages.includes(languageCode)) {
        throw new Error(
          `Unit "${id}" in ${filePath} references language "${languageCode}" that is not declared in book.yml.`
        );
      }

      if (typeof value === 'string') {
        parts[languageCode] = [value];
        continue;
      }

      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        parts[languageCode] = value as string[];
        continue;
      }

      throw new Error(
        `Unit "${id}" in ${filePath} must map language "${languageCode}" to a string or an array of strings.`
      );
    }

    return {
      id,
      note: typeof note === 'string' ? note : undefined,
      parts
    } satisfies AlignmentUnit;
  });
}

async function parseNotesFile(filePath: string): Promise<SentenceAnnotation[]> {
  const raw = await readFile(filePath, 'utf8');
  const parsed = parseYaml(raw) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Notes file ${filePath} must contain an object with a top-level "notes" array.`);
  }

  const rawNotes = (parsed as { notes?: unknown }).notes;
  if (!Array.isArray(rawNotes)) {
    throw new Error(`Notes file ${filePath} must contain a top-level "notes" array.`);
  }

  return rawNotes.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Note entry #${index + 1} in ${filePath} must be an object.`);
    }

    const { sentence, label, text } = entry as Record<string, unknown>;
    if (typeof sentence !== 'string' || !sentence.trim()) {
      throw new Error(`Note entry #${index + 1} in ${filePath} must include a non-empty "sentence" field.`);
    }
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error(`Note entry #${index + 1} in ${filePath} must include a non-empty "text" field.`);
    }

    return {
      sentence,
      label: typeof label === 'string' ? label : undefined,
      text
    } satisfies SentenceAnnotation;
  });
}
