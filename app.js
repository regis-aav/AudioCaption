const audio = document.querySelector("#ac-audio");
const player = document.querySelector(".ac-player");
const cover = document.querySelector("#ac-cover");
const transcript = document.querySelector("#ac-transcript");
const subtitleWindow = document.querySelector("#ac-subtitle-window");
const transcriptSearch = document.querySelector("#ac-transcript-search");
const searchResults = document.querySelector("#ac-search-results");
const searchCounter = document.querySelector("#ac-search-counter");
const searchPreviousButton = document.querySelector("#ac-search-previous");
const searchNextButton = document.querySelector("#ac-search-next");
const playButton = document.querySelector("#ac-play");
const playIcon = document.querySelector(".ac-play-icon");
const progress = document.querySelector("#ac-progress");
const currentTime = document.querySelector("#ac-current-time");
const duration = document.querySelector("#ac-duration");
const volume = document.querySelector("#ac-volume");
const playerStatus = document.querySelector("#ac-player-status");
const chaptersNavigation = document.querySelector("#ac-chapters");
const chaptersCount = document.querySelector("#ac-chapters-count");
const chaptersList = document.querySelector("#ac-chapters-list");
const episodeTitle = document.querySelector("#ac-episode-title");
const episodeDuration = document.querySelector("#ac-episode-duration");
const episodeSeries = document.querySelector('[data-episode-field="series"]');
const episodeNumber = document.querySelector('[data-episode-field="episodeNumber"]');
const episodeNumberWrap = document.querySelector("[data-episode-number]");
const episodeDescription = document.querySelector('[data-episode-field="description"]');
const episodeAuthor = document.querySelector('[data-episode-field="author"]');
const sobrietyActualSize = document.querySelector("#ac-sobriety-actual-size");
const sobrietyVideoSize = document.querySelector("#ac-sobriety-video-size");
const sobrietySavings = document.querySelector("#ac-sobriety-savings");
const imageInput = document.querySelector("#ac-image-input");
const audioInput = document.querySelector("#ac-audio-input");
const subtitleInput = document.querySelector("#ac-subtitle-input");
const loaders = document.querySelector(".ac-loaders");
const importsReady = document.querySelector("#ac-imports-ready");
const importsEditButton = document.querySelector("#ac-imports-edit");
const publicationEditButton = document.querySelector("#ac-publication-edit");
const publicationDialog = document.querySelector("#ac-publication-dialog");
const publicationCloseButton = document.querySelector("#ac-publication-close");
const publicationCancelButton = document.querySelector("#ac-publication-cancel");
const publicationSaveButton = document.querySelector("#ac-publication-save");
const publicationCoverButton = document.querySelector("#ac-publication-cover-change");
const publicationStatus = document.querySelector("#ac-publication-status");
const publicationFields = {
  series: document.querySelector("#ac-publication-series"),
  episodeNumber: document.querySelector("#ac-publication-number"),
  title: document.querySelector("#ac-publication-episode-title"),
  author: document.querySelector("#ac-publication-author"),
  description: document.querySelector("#ac-publication-description"),
};
const publicationTypographyFields = {
  heading: document.querySelector("#ac-publication-heading-font"),
  body: document.querySelector("#ac-publication-body-font"),
};
const publicationFontMatch = document.querySelector("#ac-publication-font-match");
const publicationFieldErrors = {
  series: document.querySelector("#ac-publication-series-error"),
  title: document.querySelector("#ac-publication-title-error"),
};
const publicationPreview = {
  card: document.querySelector(".ac-publication-preview-card"),
  cover: document.querySelector("#ac-publication-preview-cover"),
  series: document.querySelector("#ac-publication-preview-series"),
  episodeNumber: document.querySelector("#ac-publication-preview-number"),
  episodeNumberWrap: document.querySelector("#ac-publication-preview-number-wrap"),
  title: document.querySelector("#ac-publication-preview-episode-title"),
  author: document.querySelector("#ac-publication-preview-author"),
};
const importCards = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-import-card]"), (card) => [card.dataset.importCard, card])
);

let cues = [];
let activeCueIndex = -1;
let isSeeking = false;
let dragDepth = 0;
let ignoredFileNames = [];
let loadedAudioDuration = Number.NaN;
let transcriptSearchQuery = "";
let activeSearchResultIndex = -1;
let pendingImageImportFile = null;
let pendingAudioImportFile = null;
let areImportCardsExpanded = true;
let audioChapterImportVersion = 0;
let publicationDraft = null;
const defaultEpisodeMetadata = Object.freeze({
  series: "",
  episodeNumber: "",
  title: "Titre de l’épisode",
  author: "",
  description: "Une courte présentation de cet épisode sera bientôt disponible.",
  language: "fr",
});
const {
  createChapterEngine,
  getFontOptions,
  importAudioChapters,
  normalizeTypography,
  resolveFontStack,
} = globalThis.AudioCaption;
const embeddedEpisode = readEmbeddedEpisode();
let episode = {
  ...embeddedEpisode,
  metadata: normalizeEpisodeMetadata(embeddedEpisode.metadata),
  presentation: normalizeEpisodePresentation(embeddedEpisode.presentation),
  navigation: {
    ...embeddedEpisode.navigation,
    chapters: Array.isArray(embeddedEpisode.navigation?.chapters) ? embeddedEpisode.navigation.chapters : [],
  },
};
let chapterEngine = createChapterEngine(episode.navigation.chapters);

const loadedFileSizes = {
  image: null,
  audio: null,
  subtitles: null,
};

const fullHdVideoBitrate = 5_000_000;

function readEmbeddedEpisode() {
  const dataElement = document.querySelector("#ac-episode-data");

  if (!dataElement) {
    return {};
  }

  try {
    const data = JSON.parse(dataElement.textContent);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function normalizeEpisodeMetadata(metadata = {}) {
  const source = metadata && typeof metadata === "object" ? metadata : {};

  return {
    ...source,
    ...Object.fromEntries(
      Object.entries(defaultEpisodeMetadata).map(([key, fallback]) => [
        key,
        typeof source[key] === "string" ? source[key] : fallback,
      ])
    ),
  };
}

function normalizeEpisodePresentation(presentation = {}) {
  const source = presentation && typeof presentation === "object" && !Array.isArray(presentation)
    ? presentation
    : {};

  return {
    ...source,
    theme: typeof source.theme === "string" && source.theme.trim()
      ? source.theme
      : "audio-caption",
    typography: normalizeTypography(source.typography),
  };
}

function applyTypography(element, typography) {
  const normalized = normalizeTypography(typography);
  element.style.setProperty("--ac-font-heading", resolveFontStack(normalized.heading));
  element.style.setProperty("--ac-font-body", resolveFontStack(normalized.body));
}

function renderEpisodeTypography() {
  applyTypography(player, episode.presentation.typography);
}

function initializeTypographyFields() {
  for (const field of Object.values(publicationTypographyFields)) {
    for (const { id, label } of getFontOptions()) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      field.append(option);
    }
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "00:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function parseTimestamp(value) {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");

  if (parts.length !== 2 && parts.length !== 3) {
    return Number.NaN;
  }

  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts[0]) : 0;

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    minutes < 0 ||
    minutes >= 60 ||
    seconds < 0 ||
    seconds >= 60
  ) {
    return Number.NaN;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function parseSubtitles(content) {
  // Supports SRT and WebVTT blocks while preserving the existing audio-time sync model.
  return content
    .replace(/\r/g, "")
    .replace(/^WEBVTT.*\n/i, "")
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      const timeLineIndex = lines.findIndex((line) => line.includes("-->"));

      if (timeLineIndex === -1) {
        return null;
      }

      const [startValue, endValue] = lines[timeLineIndex].split("-->");
      const start = parseTimestamp(startValue);
      const end = parseTimestamp(endValue.trim().split(/\s+/, 1)[0]);
      const text = lines.slice(timeLineIndex + 1).join("\n").trim();

      if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return null;
      }

      return { start, end, text };
    })
    .filter(Boolean);
}

function cueMatchesSearch(cue) {
  return !transcriptSearchQuery || cue.text.toLocaleLowerCase().includes(transcriptSearchQuery);
}

function getSearchResultIndexes() {
  if (!transcriptSearchQuery) {
    return [];
  }

  return cues.reduce((indexes, cue, index) => {
    if (cueMatchesSearch(cue)) {
      indexes.push(index);
    }

    return indexes;
  }, []);
}

function renderCueText(button, text) {
  if (!transcriptSearchQuery) {
    button.textContent = text;
    return;
  }

  const normalizedText = text.toLocaleLowerCase();
  let textIndex = 0;
  let matchIndex = normalizedText.indexOf(transcriptSearchQuery, textIndex);

  while (matchIndex !== -1) {
    button.append(document.createTextNode(text.slice(textIndex, matchIndex)));

    const mark = document.createElement("mark");
    mark.textContent = text.slice(matchIndex, matchIndex + transcriptSearchQuery.length);
    button.append(mark);

    textIndex = matchIndex + transcriptSearchQuery.length;
    matchIndex = normalizedText.indexOf(transcriptSearchQuery, textIndex);
  }

  button.append(document.createTextNode(text.slice(textIndex)));
}

function updateSearchResults() {
  if (!cues.length) {
    searchResults.textContent = "Aucune transcription chargée.";
    searchResults.hidden = false;
    searchCounter.hidden = true;
    searchPreviousButton.hidden = true;
    searchNextButton.hidden = true;
    searchPreviousButton.disabled = true;
    searchNextButton.disabled = true;
    return;
  }

  if (!transcriptSearchQuery) {
    searchResults.textContent = "";
    searchResults.hidden = true;
    searchCounter.hidden = true;
    searchPreviousButton.hidden = true;
    searchNextButton.hidden = true;
    searchPreviousButton.disabled = true;
    searchNextButton.disabled = true;
    return;
  }

  const resultIndexes = getSearchResultIndexes();
  const resultCount = resultIndexes.length;
  const activeResultNumber = activeSearchResultIndex + 1;

  searchCounter.hidden = resultCount === 0;
  searchCounter.textContent = resultCount === 0 ? "" : `${activeResultNumber} / ${resultCount}`;
  searchPreviousButton.hidden = resultCount === 0;
  searchNextButton.hidden = resultCount === 0;
  searchPreviousButton.disabled = resultCount === 0;
  searchNextButton.disabled = resultCount === 0;
  searchResults.hidden = resultCount > 0;
  searchResults.textContent = resultCount === 0 ? "Aucun résultat" : "";
}

function renderTranscript() {
  transcript.replaceChildren();
  const activeSearchCueIndex = getSearchResultIndexes()[activeSearchResultIndex];

  cues.forEach((cue, index) => {
    const button = document.createElement("button");
    button.className = "ac-cue";
    button.type = "button";
    button.classList.toggle("is-search-muted", Boolean(transcriptSearchQuery) && !cueMatchesSearch(cue));
    button.classList.toggle("is-search-result-active", index === activeSearchCueIndex);
    renderCueText(button, cue.text);
    button.addEventListener("click", () => {
      audio.currentTime = cue.start;
      audio.play();
    });

    if (index === activeCueIndex) {
      button.classList.add("is-active");
    }

    transcript.appendChild(button);
  });
}

function renderSubtitleWindow() {
  subtitleWindow.replaceChildren();

  if (activeCueIndex === -1) {
    subtitleWindow.hidden = true;
    return;
  }

  const cue = cues[activeCueIndex];
  const button = document.createElement("button");

  button.className = "ac-contextual-cue";
  button.type = "button";
  button.textContent = cue.text;
  button.setAttribute("aria-current", "true");
  button.addEventListener("click", () => {
    audio.currentTime = cue.start;
    audio.play();
  });

  subtitleWindow.appendChild(button);

  subtitleWindow.hidden = false;
}

function setActiveCue(index) {
  if (index === activeCueIndex) {
    return;
  }

  const cueButtons = transcript.querySelectorAll(".ac-cue");

  if (cueButtons[activeCueIndex]) {
    cueButtons[activeCueIndex].classList.remove("is-active");
  }

  activeCueIndex = index;

  if (index === -1) {
    renderSubtitleWindow();
    return;
  }

  const activeButton = cueButtons[index];

  activeButton.classList.add("is-active");
  activeButton.scrollIntoView({ behavior: "smooth", block: "center" });
  renderSubtitleWindow();
}

function syncTranscript() {
  const time = audio.currentTime;
  const index = cues.findIndex((cue) => time >= cue.start && time <= cue.end);
  setActiveCue(index);
}

function updateProgress() {
  currentTime.textContent = formatTime(audio.currentTime);
  duration.textContent = formatTime(audio.duration);

  if (!isSeeking && Number.isFinite(audio.duration) && audio.duration > 0) {
    progress.value = String((audio.currentTime / audio.duration) * 100);
  }
}

function updatePlayState() {
  const isPlaying = !audio.paused;
  playIcon.textContent = isPlaying ? "❚❚" : "▶";
  playButton.setAttribute("aria-label", isPlaying ? "Mettre en pause" : "Lire");
}

function setControlsEnabled(isEnabled) {
  playButton.disabled = !isEnabled;
  progress.disabled = !isEnabled;
  volume.disabled = !isEnabled;
}

function setPlayerStatus(message) {
  const ignoredFilesMessage = ignoredFileNames.length
    ? ` Fichiers ignorés : ${ignoredFileNames.join(", ")}.`
    : "";

  playerStatus.textContent = `${message}${ignoredFilesMessage}`;
}

function updateActiveChapter() {
  if (!chapterEngine) {
    return;
  }

  const activeChapter = chapterEngine.activeAt(audio.currentTime);

  chaptersList.querySelectorAll(".ac-chapter-button").forEach((button) => {
    if (button.dataset.chapterId === activeChapter?.id) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function renderChapters() {
  const chapters = chapterEngine.toJSON();
  chaptersList.replaceChildren();
  chaptersNavigation.hidden = chapters.length === 0;

  if (!chapters.length) {
    chaptersCount.textContent = "";
    return;
  }

  chaptersCount.textContent = `${chapters.length} chapitre${chapters.length > 1 ? "s" : ""}`;

  chapters.forEach((chapter) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const startTime = formatTime(chapter.startTime);

    button.className = "ac-chapter-button";
    button.type = "button";
    button.dataset.chapterId = chapter.id;
    button.setAttribute("aria-label", `${chapter.title}, ${startTime}`);

    const time = document.createElement("span");
    const title = document.createElement("span");

    time.className = "ac-chapter-time";
    time.setAttribute("aria-hidden", "true");
    time.textContent = startTime;
    title.className = "ac-chapter-title";
    title.textContent = chapter.title;
    button.append(time, title);
    button.addEventListener("click", () => {
      audio.currentTime = chapter.startTime;
      updateActiveChapter();
    });

    item.appendChild(button);
    chaptersList.appendChild(item);
  });

  updateActiveChapter();
}

function replaceEpisodeChapters(chapters) {
  const nextEngine = createChapterEngine(chapters);
  const validation = nextEngine.validate();

  if (!validation.valid) {
    throw new Error("Les chapitres importés ne respectent pas le modèle Episode.");
  }

  episode = {
    ...episode,
    navigation: {
      ...episode.navigation,
      chapters: nextEngine.toJSON(),
    },
  };
  chapterEngine = createChapterEngine(episode.navigation.chapters);
  renderChapters();
}

async function loadAudioChapters(file, importVersion) {
  let result;

  try {
    result = await importAudioChapters(file);
  } catch {
    result = { chapters: [] };
  }

  if (importVersion !== audioChapterImportVersion) {
    return;
  }

  replaceEpisodeChapters(result.chapters);
}

function getFileExtension(file) {
  return file.name.split(".").pop().toLowerCase();
}

function getEpisodeTitle(file) {
  return file.name.replace(/\.[^/.]+$/, "") || "Titre de l’épisode";
}

function renderEpisodeMetadata() {
  const metadata = normalizeEpisodeMetadata(episode.metadata);
  const hasEpisodeNumber = Boolean(metadata.episodeNumber.trim());

  episodeSeries.textContent = metadata.series.trim() || "Épisode";
  episodeNumber.textContent = metadata.episodeNumber;
  episodeNumberWrap.hidden = !hasEpisodeNumber;
  episodeTitle.textContent = metadata.title;
  episodeDescription.textContent = metadata.description;
  episodeDescription.hidden = !metadata.description.trim();
  episodeAuthor.textContent = metadata.author.trim() || "À venir";
}

function syncPublicationPreviewCover() {
  const source = cover.getAttribute("src");

  if (source) {
    publicationPreview.cover.src = source;
  } else {
    publicationPreview.cover.removeAttribute("src");
  }
}

function renderPublicationPreview() {
  if (!publicationDraft) {
    return;
  }

  const hasEpisodeNumber = Boolean(publicationDraft.episodeNumber.trim());
  publicationPreview.series.textContent = publicationDraft.series.trim() || "Épisode";
  publicationPreview.episodeNumber.textContent = publicationDraft.episodeNumber;
  publicationPreview.episodeNumberWrap.hidden = !hasEpisodeNumber;
  publicationPreview.title.textContent = publicationDraft.title.trim() || "Titre de l’épisode";
  publicationPreview.author.textContent = publicationDraft.author.trim() || "À venir";
  applyTypography(publicationPreview.card, publicationDraft.typography);
}

function clearPublicationValidation() {
  publicationStatus.textContent = "";

  for (const [name, error] of Object.entries(publicationFieldErrors)) {
    error.textContent = "";
    publicationFields[name].removeAttribute("aria-invalid");
  }
}

function openPublicationDialog() {
  publicationDraft = {
    ...normalizeEpisodeMetadata(episode.metadata),
    typography: normalizeTypography(episode.presentation.typography),
  };

  for (const [name, field] of Object.entries(publicationFields)) {
    field.value = publicationDraft[name];
  }

  for (const [name, field] of Object.entries(publicationTypographyFields)) {
    field.value = publicationDraft.typography[name];
  }

  publicationFontMatch.checked = publicationDraft.typography.heading === publicationDraft.typography.body;
  publicationTypographyFields.body.disabled = publicationFontMatch.checked;

  clearPublicationValidation();
  renderPublicationPreview();
  syncPublicationPreviewCover();
  publicationDialog.showModal();
  publicationFields.title.focus();
  publicationFields.title.select();
}

function closePublicationDialog() {
  publicationDraft = null;
  publicationPreview.card.style.removeProperty("--ac-font-heading");
  publicationPreview.card.style.removeProperty("--ac-font-body");
  clearPublicationValidation();
  publicationDialog.close();
}

function validatePublicationDraft() {
  const requiredFields = {
    series: "La série est obligatoire.",
    title: "Le titre est obligatoire.",
  };
  let firstInvalidField = null;

  clearPublicationValidation();

  for (const [name, message] of Object.entries(requiredFields)) {
    if (publicationDraft[name].trim()) {
      continue;
    }

    publicationFields[name].setAttribute("aria-invalid", "true");
    publicationFieldErrors[name].textContent = message;
    firstInvalidField ??= publicationFields[name];
  }

  if (firstInvalidField) {
    publicationStatus.textContent = "Complétez les informations obligatoires.";
    firstInvalidField.focus();
    return false;
  }

  return true;
}

function savePublicationMetadata() {
  if (!publicationDraft || !validatePublicationDraft()) {
    return;
  }

  const savedMetadata = Object.fromEntries(
    Object.keys(publicationFields).map((name) => [name, publicationDraft[name].trim()])
  );

  episode = {
    ...episode,
    metadata: {
      ...episode.metadata,
      ...savedMetadata,
    },
    presentation: {
      ...episode.presentation,
      typography: normalizeTypography(publicationDraft.typography),
    },
  };
  renderEpisodeMetadata();
  renderEpisodeTypography();
  closePublicationDialog();
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }

  const units = ["o", "kB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes || 1) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

function updateImportsVisibility({ collapseWhenReady = false } = {}) {
  const isEpisodeReady = Object.values(importCards).every((card) => card.classList.contains("is-loaded"));

  if (!isEpisodeReady) {
    areImportCardsExpanded = true;
  } else if (collapseWhenReady) {
    areImportCardsExpanded = false;
  }

  loaders.hidden = isEpisodeReady && !areImportCardsExpanded;
  importsReady.hidden = !isEpisodeReady;
  importsEditButton.setAttribute("aria-expanded", String(!loaders.hidden));
}

function closeMediaPanel() {
  areImportCardsExpanded = false;
  updateImportsVisibility();
}

function resetImportCard(type) {
  const card = importCards[type];

  if (!card) {
    return;
  }

  card.classList.remove("is-loaded");
  card.querySelector(".ac-file-default").hidden = false;
  card.querySelector(".ac-file-success").hidden = true;
  card.querySelector("[data-import-file-name]").textContent = "";
  card.querySelector("[data-import-file-size]").textContent = "";
  updateImportsVisibility();
}

function updateImportCard(type, file) {
  const card = importCards[type];

  if (!card) {
    return;
  }

  card.querySelector("[data-import-file-name]").textContent = file.name;
  card.querySelector("[data-import-file-size]").textContent = formatFileSize(file.size);
  card.querySelector(".ac-file-default").hidden = true;
  card.querySelector(".ac-file-success").hidden = false;
  card.classList.add("is-loaded");
  closeMediaPanel();
}

function updateSobrietyIndicator() {
  const fileSizes = Object.values(loadedFileSizes).filter(Number.isFinite);

  if (!fileSizes.length) {
    sobrietyActualSize.textContent = "—";
    sobrietyVideoSize.textContent = "—";
    sobrietySavings.textContent = "—";
    return;
  }

  const actualSize = fileSizes.reduce((total, size) => total + size, 0);
  sobrietyActualSize.textContent = formatFileSize(actualSize);

  if (!Number.isFinite(loadedAudioDuration) || loadedAudioDuration <= 0) {
    sobrietyVideoSize.textContent = "—";
    sobrietySavings.textContent = "—";
    return;
  }

  const estimatedVideoSize = (loadedAudioDuration * fullHdVideoBitrate) / 8;
  const savings = Math.max(0, Math.min(100, Math.round((1 - actualSize / estimatedVideoSize) * 100)));

  sobrietyVideoSize.textContent = formatFileSize(estimatedVideoSize);
  sobrietySavings.textContent = `${savings} %`;
}

function isImageFile(file) {
  return ["jpg", "jpeg", "png", "webp"].includes(getFileExtension(file)) || [
    "image/jpeg",
    "image/png",
    "image/webp",
  ].includes(file.type);
}

function isAudioFile(file) {
  return file.type.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac", "flac"].includes(getFileExtension(file));
}

function isSubtitleFile(file) {
  return ["srt", "vtt"].includes(getFileExtension(file));
}

function loadImageFile(file) {
  pendingImageImportFile = file;
  resetImportCard("image");
  loadedFileSizes.image = file.size;
  updateSobrietyIndicator();
  cover.src = URL.createObjectURL(file);
}

function loadAudioFile(file) {
  const chapterImportVersion = ++audioChapterImportVersion;

  pendingAudioImportFile = file;

  if (chapterEngine) {
    replaceEpisodeChapters([]);
  }

  void loadAudioChapters(file, chapterImportVersion);
  resetImportCard("audio");
  setControlsEnabled(false);
  isSeeking = false;
  episode = {
    ...episode,
    metadata: {
      ...episode.metadata,
      title: getEpisodeTitle(file),
    },
  };
  renderEpisodeMetadata();
  episodeDuration.textContent = "--:--";
  loadedFileSizes.audio = file.size;
  loadedAudioDuration = Number.NaN;
  updateSobrietyIndicator();
  setPlayerStatus("Chargement de l'audio…");
  audio.src = URL.createObjectURL(file);
  audio.load();
}

async function loadSubtitleFile(file) {
  resetImportCard("subtitles");
  loadedFileSizes.subtitles = file.size;
  updateSobrietyIndicator();
  cues = parseSubtitles(await file.text());
  activeCueIndex = -1;
  activeSearchResultIndex = -1;

  if (getSearchResultIndexes().length) {
    selectSearchResult(0, false);
  } else {
    renderTranscript();
    updateSearchResults();
    syncTranscript();
  }

  if (cues.length) {
    updateImportCard("subtitles", file);
  }
}

function handleDroppedFiles(fileList) {
  const files = Array.from(fileList);
  const imageFile = files.find(isImageFile);
  const audioFile = files.find(isAudioFile);
  const subtitleFile = files.find(isSubtitleFile);

  ignoredFileNames = files
    .filter((file) => !isImageFile(file) && !isAudioFile(file) && !isSubtitleFile(file))
    .map((file) => file.name);

  if (imageFile) {
    loadImageFile(imageFile);
  }

  if (audioFile) {
    loadAudioFile(audioFile);
  }

  if (subtitleFile) {
    void loadSubtitleFile(subtitleFile);
  }

  if (!audioFile) {
    setPlayerStatus(
      imageFile || subtitleFile
        ? "Fichiers chargés. Chargez un fichier audio pour commencer."
        : "Aucun fichier pris en charge. Déposez une image, un audio ou un fichier SRT/VTT."
    );
  }
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];

  if (file) {
    ignoredFileNames = [];
    loadImageFile(file);
  }
});

audioInput.addEventListener("change", () => {
  const file = audioInput.files[0];

  if (file) {
    ignoredFileNames = [];
    loadAudioFile(file);
  }
});

subtitleInput.addEventListener("change", async () => {
  const file = subtitleInput.files[0];

  if (!file) {
    return;
  }

  ignoredFileNames = [];
  await loadSubtitleFile(file);
});

importsEditButton.addEventListener("click", () => {
  areImportCardsExpanded = !areImportCardsExpanded;
  updateImportsVisibility();

  if (areImportCardsExpanded) {
    imageInput.focus();
  }
});

publicationEditButton.addEventListener("click", openPublicationDialog);
publicationCloseButton.addEventListener("click", closePublicationDialog);
publicationCancelButton.addEventListener("click", closePublicationDialog);
publicationSaveButton.addEventListener("click", savePublicationMetadata);
publicationCoverButton.addEventListener("click", () => imageInput.click());

publicationDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePublicationDialog();
});

for (const [name, field] of Object.entries(publicationFields)) {
  field.addEventListener("input", () => {
    if (!publicationDraft) {
      return;
    }

    publicationDraft[name] = field.value;

    if (publicationFieldErrors[name]) {
      publicationFieldErrors[name].textContent = "";
      field.removeAttribute("aria-invalid");
    }

    publicationStatus.textContent = "";
    renderPublicationPreview();
  });
}

for (const [name, field] of Object.entries(publicationTypographyFields)) {
  field.addEventListener("change", () => {
    if (!publicationDraft) {
      return;
    }

    publicationDraft.typography[name] = field.value;

    if (name === "heading" && publicationFontMatch.checked) {
      publicationDraft.typography.body = field.value;
      publicationTypographyFields.body.value = field.value;
    }

    renderPublicationPreview();
  });
}

publicationFontMatch.addEventListener("change", () => {
  if (!publicationDraft) {
    return;
  }

  publicationTypographyFields.body.disabled = publicationFontMatch.checked;

  if (publicationFontMatch.checked) {
    publicationDraft.typography.body = publicationDraft.typography.heading;
    publicationTypographyFields.body.value = publicationDraft.typography.heading;
  }

  renderPublicationPreview();
});

transcriptSearch.addEventListener("input", () => {
  transcriptSearchQuery = transcriptSearch.value.trim().toLocaleLowerCase();
  const resultIndexes = getSearchResultIndexes();

  if (resultIndexes.length) {
    selectSearchResult(0, false);
    return;
  }

  activeSearchResultIndex = -1;
  renderTranscript();
  updateSearchResults();
});

function selectSearchResult(resultIndex, shouldScroll = true) {
  const resultIndexes = getSearchResultIndexes();

  if (!resultIndexes.length) {
    return;
  }

  activeSearchResultIndex = (resultIndex + resultIndexes.length) % resultIndexes.length;

  const cueIndex = resultIndexes[activeSearchResultIndex];
  audio.currentTime = cues[cueIndex].start;
  syncTranscript();
  setActiveCue(cueIndex);
  renderTranscript();
  updateSearchResults();

  if (shouldScroll) {
    transcript.querySelectorAll(".ac-cue")[cueIndex].scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function navigateSearchResults(direction) {
  const resultIndexes = getSearchResultIndexes();

  if (!resultIndexes.length) {
    return;
  }

  const nextResultIndex = activeSearchResultIndex === -1
    ? direction > 0 ? 0 : resultIndexes.length - 1
    : activeSearchResultIndex + direction;

  selectSearchResult(nextResultIndex);
}

searchPreviousButton.addEventListener("click", () => {
  navigateSearchResults(-1);
});

searchNextButton.addEventListener("click", () => {
  navigateSearchResults(1);
});

player.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragDepth += 1;
  player.classList.add("is-dragging");
});

player.addEventListener("dragover", (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

player.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);

  if (dragDepth === 0) {
    player.classList.remove("is-dragging");
  }
});

player.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  player.classList.remove("is-dragging");
  handleDroppedFiles(event.dataTransfer.files);
});

playButton.addEventListener("click", () => {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
});

progress.addEventListener("input", () => {
  isSeeking = true;
  currentTime.textContent = formatTime((Number(progress.value) / 100) * audio.duration);
});

progress.addEventListener("change", () => {
  if (Number.isFinite(audio.duration)) {
    audio.currentTime = (Number(progress.value) / 100) * audio.duration;
  }

  isSeeking = false;
});

volume.addEventListener("input", () => {
  audio.volume = Number(volume.value);
});

cover.addEventListener("load", () => {
  syncPublicationPreviewCover();

  if (pendingImageImportFile) {
    updateImportCard("image", pendingImageImportFile);
    pendingImageImportFile = null;
  }
});
cover.addEventListener("error", () => {
  publicationPreview.cover.removeAttribute("src");
  pendingImageImportFile = null;
  resetImportCard("image");
});
audio.addEventListener("loadedmetadata", () => {
  if (pendingAudioImportFile) {
    updateImportCard("audio", pendingAudioImportFile);
    pendingAudioImportFile = null;
  }

  updateProgress();
  episodeDuration.textContent = formatTime(audio.duration);
  loadedAudioDuration = audio.duration;
  updateSobrietyIndicator();
  setControlsEnabled(true);
  setPlayerStatus("Audio chargé. Vous pouvez commencer la lecture.");
});
audio.addEventListener("error", () => {
  audioChapterImportVersion += 1;
  pendingAudioImportFile = null;

  if (chapterEngine) {
    replaceEpisodeChapters([]);
  }

  resetImportCard("audio");
  setControlsEnabled(false);
  setPlayerStatus("Impossible de charger ce fichier audio.");
});
audio.addEventListener("play", updatePlayState);
audio.addEventListener("pause", updatePlayState);
audio.addEventListener("ended", updatePlayState);
audio.addEventListener("timeupdate", () => {
  updateProgress();
  syncTranscript();
  updateActiveChapter();
});

updatePlayState();
updateProgress();
updateImportsVisibility({ collapseWhenReady: true });
initializeTypographyFields();
renderEpisodeMetadata();
renderEpisodeTypography();
