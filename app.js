const audio = document.querySelector("#ac-audio");
const player = document.querySelector(".ac-player");
const cover = document.querySelector("#ac-cover");
const transcript = document.querySelector("#ac-transcript");
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
const sobrietyActualSize = document.querySelector("#ac-sobriety-actual-size");
const sobrietyVideoSize = document.querySelector("#ac-sobriety-video-size");
const sobrietySavings = document.querySelector("#ac-sobriety-savings");
const imageInput = document.querySelector("#ac-image-input");
const audioInput = document.querySelector("#ac-audio-input");
const subtitleInput = document.querySelector("#ac-subtitle-input");
const loaders = document.querySelector(".ac-loaders");
const importsReady = document.querySelector("#ac-imports-ready");
const importsEditButton = document.querySelector("#ac-imports-edit");
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
let createChapterEngine;
let importAudioChapters;
let episode = {
  navigation: {
    chapters: [],
  },
};
let chapterEngine = null;

const chapterModulesReady = Promise.all([
  import("./src/domain/chapterEngine.js"),
  import("./src/importers/chapterImporter.js"),
])
  .then(([engineModule, importerModule]) => {
    createChapterEngine = engineModule.createChapterEngine;
    importAudioChapters = importerModule.importAudioChapters;
    chapterEngine = createChapterEngine(episode.navigation.chapters);
    renderChapters();
    return true;
  })
  .catch(() => false);

const loadedFileSizes = {
  image: null,
  audio: null,
  subtitles: null,
};

const fullHdVideoBitrate = 5_000_000;

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
    searchCounter.textContent = "0 / 0";
    searchPreviousButton.disabled = true;
    searchNextButton.disabled = true;
    return;
  }

  if (!transcriptSearchQuery) {
    searchResults.textContent = `${cues.length} passages dans la transcription.`;
    searchCounter.textContent = "0 / 0";
    searchPreviousButton.disabled = true;
    searchNextButton.disabled = true;
    return;
  }

  const resultIndexes = getSearchResultIndexes();
  const resultCount = resultIndexes.length;
  const activeResultNumber = activeSearchResultIndex + 1;

  searchCounter.textContent = `${Math.max(0, activeResultNumber)} / ${resultCount}`;
  searchPreviousButton.disabled = resultCount === 0;
  searchNextButton.disabled = resultCount === 0;
  searchResults.textContent = `${Math.max(0, activeResultNumber)} / ${resultCount} résultat${resultCount > 1 ? "s" : ""} trouvé${resultCount > 1 ? "s" : ""}.`;
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
    return;
  }

  const activeButton = cueButtons[index];

  activeButton.classList.add("is-active");
  activeButton.scrollIntoView({ behavior: "smooth", block: "center" });
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
  const modulesAreReady = await chapterModulesReady;

  if (!modulesAreReady || importVersion !== audioChapterImportVersion) {
    return;
  }

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
  importsReady.hidden = !isEpisodeReady || areImportCardsExpanded;
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
  updateImportsVisibility({ collapseWhenReady: true });
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
  episodeTitle.textContent = getEpisodeTitle(file);
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
  renderTranscript();
  updateSearchResults();
  syncTranscript();

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
  areImportCardsExpanded = true;
  updateImportsVisibility();
  imageInput.focus();
});

transcriptSearch.addEventListener("input", () => {
  transcriptSearchQuery = transcriptSearch.value.trim().toLocaleLowerCase();
  activeSearchResultIndex = -1;
  renderTranscript();
  updateSearchResults();
});

function navigateSearchResults(direction) {
  const resultIndexes = getSearchResultIndexes();

  if (!resultIndexes.length) {
    return;
  }

  if (activeSearchResultIndex === -1) {
    activeSearchResultIndex = direction > 0 ? 0 : resultIndexes.length - 1;
  } else {
    activeSearchResultIndex = (activeSearchResultIndex + direction + resultIndexes.length) % resultIndexes.length;
  }

  const cueIndex = resultIndexes[activeSearchResultIndex];
  audio.currentTime = cues[cueIndex].start;
  renderTranscript();
  updateSearchResults();

  transcript.querySelectorAll(".ac-cue")[cueIndex].scrollIntoView({ behavior: "smooth", block: "center" });
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
  if (pendingImageImportFile) {
    updateImportCard("image", pendingImageImportFile);
    pendingImageImportFile = null;
  }
});
cover.addEventListener("error", () => {
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
updateImportsVisibility();
