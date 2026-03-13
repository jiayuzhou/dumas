import type {
  AlignmentUnit,
  ChapterData,
  LanguageMeta,
  ReaderSettings,
  SentenceRecord
} from '../lib/types';

type ReaderPayload = {
  bookTitle: string;
  chapter: ChapterData;
  languages: LanguageMeta[];
  defaultPrimary: string;
  defaultSecondary?: string;
};

type ReaderState = ReaderSettings & {
  activeSentenceId: string | null;
  activeUnitId: string | null;
};

export function mountAllDualReaders() {
  const roots = document.querySelectorAll<HTMLElement>('[data-dual-reader-root]:not([data-reader-ready])');
  for (const root of roots) {
    mountDualReader(root);
  }
}

function mountDualReader(root: HTMLElement) {
  root.dataset.readerReady = 'true';

  const payloadNode = root.querySelector<HTMLScriptElement>('[data-role="payload"]');
  const primaryPanel = root.querySelector<HTMLElement>('[data-role="primary-panel"]');
  const secondaryPanel = root.querySelector<HTMLElement>('[data-role="secondary-panel"]');
  const peekPanel = root.querySelector<HTMLElement>('[data-role="peek-panel"]');
  const primarySelect = root.querySelector<HTMLSelectElement>('[data-role="primary-language"]');
  const secondarySelect = root.querySelector<HTMLSelectElement>('[data-role="secondary-language"]');
  const swapButton = root.querySelector<HTMLButtonElement>('[data-role="swap-languages"]');
  const layoutButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-layout-button]')];

  if (
    !payloadNode ||
    !primaryPanel ||
    !secondaryPanel ||
    !peekPanel ||
    !primarySelect ||
    !secondarySelect ||
    !swapButton
  ) {
    return;
  }

  const payload = JSON.parse(payloadNode.textContent ?? '{}') as ReaderPayload;
  const languageMap = new Map(payload.languages.map((language) => [language.code, language]));
  const unitMap = new Map(payload.chapter.units.map((unit) => [unit.id, unit]));
  const storageKey = `dual-reader:${payload.chapter.bookId}`;

  const saved = readSavedSettings(storageKey, payload.languages.map((language) => language.code));
  const initialPrimary = chooseLanguage(
    saved?.primary,
    payload.defaultPrimary,
    payload.languages[0]?.code ?? payload.defaultPrimary,
    payload.languages.map((language) => language.code)
  );
  const initialSecondary = chooseSecondaryLanguage(
    initialPrimary,
    saved?.secondary ?? payload.defaultSecondary,
    payload.languages.map((language) => language.code)
  );

  const state: ReaderState = {
    primary: initialPrimary,
    secondary: initialSecondary,
    layout: saved?.layout ?? 'focus',
    activeSentenceId: null,
    activeUnitId: null
  };

  let shouldScrollSecondaryToSelection = false;

  function persistSettings() {
    const data: ReaderSettings = {
      primary: state.primary,
      secondary: state.secondary,
      layout: state.layout
    };
    localStorage.setItem(storageKey, JSON.stringify(data));

    root.dispatchEvent(
      new CustomEvent('reader:settings-change', {
        bubbles: true,
        detail: data
      })
    );
  }

  function refreshToolbar() {
    fillLanguageSelect(primarySelect, payload.languages, state.primary);
    fillLanguageSelect(
      secondarySelect,
      payload.languages.filter((language) => language.code !== state.primary),
      state.secondary
    );

    for (const button of layoutButtons) {
      const layout = button.dataset.layoutButton as ReaderState['layout'];
      const isActive = layout === state.layout;
      button.classList.toggle('reader-button--active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  }

  function renderLanguageDocument(target: HTMLElement, languageCode: string) {
    target.innerHTML = '';

    const documentData = payload.chapter.languages[languageCode];
    const languageMeta = languageMap.get(languageCode);
    if (!documentData || !languageMeta) {
      target.innerHTML = '<p class="empty-state">Language data is unavailable.</p>';
      return;
    }

    target.lang = languageMeta.locale ?? languageCode;
    target.dir = languageMeta.dir;
    target.dataset.language = languageCode;

    const title = document.createElement('div');
    title.className = 'reader-panel__header';
    title.innerHTML = `
      <span class="badge">${escapeHtml(languageMeta.label)}</span>
      <strong>${escapeHtml(documentData.title)}</strong>
    `;
    target.append(title);

    for (const block of documentData.blocks) {
      if (block.type === 'heading') {
        const heading = document.createElement(`h${Math.min(Math.max(block.depth, 1), 6)}`);
        heading.className = 'reader-heading';
        heading.innerHTML = block.html;
        target.append(heading);
        continue;
      }

      if (block.type === 'divider') {
        const divider = document.createElement('hr');
        divider.className = 'reader-divider';
        target.append(divider);
        continue;
      }

      if (block.type === 'note') {
        const note = document.createElement('div');
        note.className = `reader-note reader-note--${block.variant}`;
        note.innerHTML = block.html;
        target.append(note);
        continue;
      }

      const paragraph = document.createElement('p');
      paragraph.className = 'reader-paragraph';
      paragraph.dataset.blockId = block.id;

      const joiner = languageMeta.sentenceJoiner === 'none' ? '' : ' ';
      block.sentenceIds.forEach((sentenceId, index) => {
        const sentence = documentData.sentences[sentenceId];
        paragraph.append(buildSentenceNode(languageCode, sentence));

        if (joiner && index < block.sentenceIds.length - 1) {
          paragraph.append(document.createTextNode(joiner));
        }
      });

      target.append(paragraph);
    }
  }

  function buildSentenceNode(languageCode: string, sentence: SentenceRecord) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reader-sentence';
    button.dataset.language = languageCode;
    button.dataset.sentenceId = sentence.id;
    button.dataset.unitId = payload.chapter.sentenceToUnit[languageCode]?.[sentence.id] ?? '';
    button.innerHTML = sentence.html;
    button.addEventListener('click', () => {
      selectSentence(languageCode, sentence.id, languageCode === state.primary);
    });

    return button;
  }

  function renderPeekPanel() {
    peekPanel.classList.toggle('reader-peek--visible', state.activeSentenceId !== null);
    peekPanel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'reader-peek__header';
    header.innerHTML = `
      <span class="badge">${escapeHtml(languageMap.get(state.secondary)?.label ?? state.secondary)}</span>
      <strong>Counterpart</strong>
    `;
    peekPanel.append(header);

    if (!state.activeSentenceId) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Pick a sentence to reveal the aligned text here.';
      peekPanel.append(empty);
      return;
    }

    if (!state.activeUnitId) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'This sentence does not have aligned text yet.';
      peekPanel.append(empty);
      return;
    }

    const unit = unitMap.get(state.activeUnitId);
    const secondaryDocument = payload.chapter.languages[state.secondary];
    const secondaryMeta = languageMap.get(state.secondary);
    const sentenceIds = unit?.parts[state.secondary] ?? [];

    if (!unit || !secondaryDocument || !secondaryMeta || sentenceIds.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No aligned segment exists in the current secondary language.';
      peekPanel.append(empty);
      return;
    }

    const paragraph = document.createElement('p');
    paragraph.className = 'reader-peek__paragraph';
    paragraph.lang = secondaryMeta.locale ?? state.secondary;
    paragraph.dir = secondaryMeta.dir;

    const joiner = secondaryMeta.sentenceJoiner === 'none' ? '' : ' ';
    sentenceIds.forEach((sentenceId, index) => {
      const sentence = secondaryDocument.sentences[sentenceId];
      if (!sentence) return;

      const span = document.createElement('span');
      span.className = 'reader-sentence reader-sentence--counterpart';
      span.dataset.language = state.secondary;
      span.dataset.sentenceId = sentenceId;
      span.dataset.unitId = unit.id;
      span.innerHTML = sentence.html;
      paragraph.append(span);

      if (joiner && index < sentenceIds.length - 1) {
        paragraph.append(document.createTextNode(joiner));
      }
    });

    peekPanel.append(paragraph);

    if (unit.note) {
      const note = document.createElement('p');
      note.className = 'peek-note';
      note.textContent = unit.note;
      peekPanel.append(note);
    }
  }

  function renderPanels() {
    root.dataset.layout = state.layout;
    renderLanguageDocument(primaryPanel, state.primary);

    if (state.layout === 'focus') {
      secondaryPanel.hidden = true;
      peekPanel.hidden = false;
      renderPeekPanel();
    } else {
      secondaryPanel.hidden = false;
      peekPanel.hidden = true;
      renderLanguageDocument(secondaryPanel, state.secondary);
    }

    updateSelectionClasses();
  }

  function updateSelectionClasses() {
    for (const element of root.querySelectorAll<HTMLElement>('.reader-sentence')) {
      element.classList.remove('reader-sentence--selected', 'reader-sentence--aligned');
    }

    if (state.activeSentenceId) {
      for (const element of root.querySelectorAll<HTMLElement>(
        `.reader-sentence[data-sentence-id="${cssEscape(state.activeSentenceId)}"]`
      )) {
        element.classList.add('reader-sentence--selected');
      }
    }

    if (state.activeUnitId) {
      for (const element of root.querySelectorAll<HTMLElement>(
        `.reader-sentence[data-unit-id="${cssEscape(state.activeUnitId)}"]`
      )) {
        element.classList.add('reader-sentence--aligned');
      }
    }
  }

  function selectSentence(languageCode: string, sentenceId: string, scrollSecondary: boolean) {
    state.activeSentenceId = sentenceId;
    state.activeUnitId = payload.chapter.sentenceToUnit[languageCode]?.[sentenceId] ?? null;
    updateSelectionClasses();

    if (state.layout === 'focus') {
      renderPeekPanel();
      updateSelectionClasses();
    }

    root.dispatchEvent(
      new CustomEvent('reader:sentence-select', {
        bubbles: true,
        detail: {
          language: languageCode,
          sentenceId,
          unitId: state.activeUnitId
        }
      })
    );

    if (scrollSecondary && state.layout !== 'focus') {
      shouldScrollSecondaryToSelection = true;
      scrollSecondaryIntoView();
    }
  }

  function scrollSecondaryIntoView() {
    if (!shouldScrollSecondaryToSelection || !state.activeUnitId || state.layout === 'focus') {
      return;
    }

    const unit = unitMap.get(state.activeUnitId);
    const secondarySentenceId = unit?.parts[state.secondary]?.[0];
    if (!secondarySentenceId) {
      return;
    }

    const target = secondaryPanel.querySelector<HTMLElement>(
      `.reader-sentence[data-sentence-id="${cssEscape(secondarySentenceId)}"]`
    );
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    shouldScrollSecondaryToSelection = false;
  }

  function reconcileSelectionForPrimaryChange() {
    if (!state.activeUnitId) {
      state.activeSentenceId = null;
      return;
    }

    const unit = unitMap.get(state.activeUnitId);
    const candidate = unit?.parts[state.primary]?.[0];
    state.activeSentenceId = candidate ?? null;
  }

  primarySelect.addEventListener('change', () => {
    state.primary = primarySelect.value;
    state.secondary = chooseSecondaryLanguage(
      state.primary,
      state.secondary,
      payload.languages.map((language) => language.code)
    );
    reconcileSelectionForPrimaryChange();
    refreshToolbar();
    renderPanels();
    persistSettings();
  });

  secondarySelect.addEventListener('change', () => {
    state.secondary = chooseSecondaryLanguage(
      state.primary,
      secondarySelect.value,
      payload.languages.map((language) => language.code)
    );
    refreshToolbar();
    renderPanels();
    persistSettings();
  });

  swapButton.addEventListener('click', () => {
    const previousPrimary = state.primary;
    state.primary = state.secondary;
    state.secondary = previousPrimary;
    reconcileSelectionForPrimaryChange();
    refreshToolbar();
    renderPanels();
    persistSettings();
  });

  for (const button of layoutButtons) {
    button.addEventListener('click', () => {
      const nextLayout = button.dataset.layoutButton as ReaderState['layout'];
      if (!nextLayout || nextLayout === state.layout) return;

      state.layout = nextLayout;
      refreshToolbar();
      renderPanels();
      persistSettings();
    });
  }

  refreshToolbar();
  renderPanels();
  persistSettings();

  root.dispatchEvent(
    new CustomEvent('reader:ready', {
      bubbles: true,
      detail: {
        primary: state.primary,
        secondary: state.secondary,
        layout: state.layout
      }
    })
  );
}

function fillLanguageSelect(
  select: HTMLSelectElement,
  languages: LanguageMeta[],
  selected: string
) {
  select.innerHTML = '';

  for (const language of languages) {
    const option = document.createElement('option');
    option.value = language.code;
    option.textContent = language.label;
    option.selected = language.code === selected;
    select.append(option);
  }
}

function readSavedSettings(
  storageKey: string,
  allowedLanguageCodes: string[]
): ReaderSettings | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    if (!parsed || typeof parsed !== 'object') return null;

    if (
      !parsed.primary ||
      !parsed.secondary ||
      !parsed.layout ||
      !allowedLanguageCodes.includes(parsed.primary) ||
      !allowedLanguageCodes.includes(parsed.secondary)
    ) {
      return null;
    }

    if (!['focus', 'split', 'stacked'].includes(parsed.layout)) {
      return null;
    }

    return parsed as ReaderSettings;
  } catch {
    return null;
  }
}

function chooseLanguage(
  preferred: string | undefined,
  fallback: string,
  finalFallback: string,
  allowed: string[]
) {
  if (preferred && allowed.includes(preferred)) return preferred;
  if (allowed.includes(fallback)) return fallback;
  return finalFallback;
}

function chooseSecondaryLanguage(
  primary: string,
  preferred: string | undefined,
  allowed: string[]
) {
  const filtered = allowed.filter((language) => language !== primary);
  if (preferred && filtered.includes(preferred)) return preferred;
  return filtered[0] ?? primary;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cssEscape(value: string) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}
