export type LanguageCode = string;

export interface LanguageMeta {
  code: LanguageCode;
  label: string;
  dir: 'ltr' | 'rtl';
  locale?: string;
  sentenceJoiner?: 'space' | 'none';
}

export interface BookConfig {
  id: string;
  slug?: string;
  title: Record<LanguageCode, string>;
  summary?: Partial<Record<LanguageCode, string>>;
  languages: LanguageMeta[];
  defaultPrimary: LanguageCode;
  defaultSecondary?: LanguageCode;
}

export interface AlignmentUnit {
  id: string;
  note?: string;
  parts: Record<LanguageCode, string[]>;
}

export interface SentenceRecord {
  id: string;
  language: LanguageCode;
  markdown: string;
  html: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  id: string;
  sentenceIds: string[];
}

export interface HeadingBlock {
  type: 'heading';
  id: string;
  depth: number;
  text: string;
  html: string;
}

export interface NoteBlock {
  type: 'note';
  id: string;
  variant: string;
  html: string;
}

export interface DividerBlock {
  type: 'divider';
  id: string;
}

export type ReaderBlock = ParagraphBlock | HeadingBlock | NoteBlock | DividerBlock;

export interface ChapterFrontmatter {
  title: string;
  description?: string;
  order?: number;
}

export interface ChapterLanguageDocument {
  code: LanguageCode;
  title: string;
  description?: string;
  blocks: ReaderBlock[];
  sentenceOrder: string[];
  sentences: Record<string, SentenceRecord>;
}

export interface ChapterData {
  bookId: string;
  bookSlug: string;
  id: string;
  slug: string;
  order: number;
  titles: Record<LanguageCode, string>;
  descriptions: Partial<Record<LanguageCode, string>>;
  languages: Record<LanguageCode, ChapterLanguageDocument>;
  units: AlignmentUnit[];
  sentenceToUnit: Record<LanguageCode, Record<string, string>>;
}

export interface BookData {
  config: BookConfig & { slug: string };
  chapters: ChapterData[];
}

export interface LibraryData {
  books: BookData[];
  bookMap: Record<string, BookData>;
}

export interface ReaderSettings {
  primary: LanguageCode;
  secondary: LanguageCode;
  layout: 'focus' | 'split' | 'stacked';
}
