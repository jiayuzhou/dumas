import { getLibrary } from '../src/lib/library.js';

async function main() {
  const library = await getLibrary();
  const chapterCount = library.books.reduce((sum, book) => sum + book.chapters.length, 0);

  console.log(`Validated ${library.books.length} book(s) and ${chapterCount} chapter(s).`);
  for (const book of library.books) {
    console.log(`- ${book.config.slug}: ${book.chapters.length} chapter(s), ${book.config.languages.length} language(s)`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
