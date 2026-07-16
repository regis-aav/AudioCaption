function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const parts = [minutes, remainingSeconds].map((part) => String(part).padStart(2, "0"));

  return hours ? `${String(hours).padStart(2, "0")}:${parts.join(":")}` : parts.join(":");
}

function parseTimestamp(value) {
  const parts = value.trim().replace(",", ".").split(":");

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

function parseCueBlock(block) {
  const lines = block.split("\n").filter(Boolean);
  const timeLineIndex = lines.findIndex((line) => line.includes("-->"));

  if (timeLineIndex === -1) {
    return null;
  }

  const [startValue, endValue] = lines[timeLineIndex].split("-->");

  if (!endValue) {
    return null;
  }

  const start = parseTimestamp(startValue);
  const end = parseTimestamp(endValue.trim().split(/\s+/, 1)[0]);
  const text = lines.slice(timeLineIndex + 1).join("\n").trim();

  if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return { start, end, text };
}

function parseVtt(content) {
  return content
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/^WEBVTT[^\n]*\n/i, "")
    .split(/\n{2,}/)
    .filter((block) => !/^(?:NOTE|STYLE|REGION)(?:\s|$)/.test(block.trim()))
    .map(parseCueBlock)
    .filter(Boolean);
}

function readEpisodeData() {
  const dataElement = document.querySelector("#ac-episode-data");

  if (!dataElement) {
    return {};
  }

  try {
    return JSON.parse(dataElement.textContent);
  } catch {
    return {};
  }
}

function isRelativePath(path) {
  return typeof path === "string" && path.length > 0 && !/^(?:[a-z]+:|[\\/])/i.test(path);
}

function getPlayerElements(root) {
  return {
    audio: root.querySelector(".ac-audio"),
    toggle: root.querySelector("[data-player-toggle]"),
    playIcon: root.querySelector("[data-player-icon]"),
    currentTime: root.querySelector("[data-player-current-time]"),
    duration: root.querySelector("[data-player-duration]"),
    progress: root.querySelector("[data-player-progress]"),
    volume: root.querySelector("[data-player-volume]"),
    playerStatus: root.querySelector("[data-player-status]"),
    transcript: root.querySelector("#ac-transcript"),
    search: root.querySelector("[data-transcript-search]"),
    searchCounter: root.querySelector("[data-search-counter]"),
    searchPrevious: root.querySelector("[data-search-previous]"),
    searchNext: root.querySelector("[data-search-next]"),
  };
}

function renderCueText(button, text, query) {
  if (!query) {
    button.textContent = text;
    return;
  }

  const normalizedText = text.toLocaleLowerCase();
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(query);

  while (matchIndex !== -1) {
    button.append(document.createTextNode(text.slice(cursor, matchIndex)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(matchIndex, matchIndex + query.length);
    button.append(mark);
    cursor = matchIndex + query.length;
    matchIndex = normalizedText.indexOf(query, cursor);
  }

  button.append(document.createTextNode(text.slice(cursor)));
}

function createTranscriptController(elements) {
  const state = {
    cues: [],
    activeCueIndex: -1,
    query: "",
    resultIndexes: [],
    selectedResultIndex: -1,
  };

  function getCueButtons() {
    return elements.transcript.querySelectorAll("[data-cue-index]");
  }

  function setActiveCue(index) {
    if (index === state.activeCueIndex) {
      return;
    }

    const buttons = getCueButtons();
    const previousButton = buttons[state.activeCueIndex];
    const activeButton = buttons[index];

    if (previousButton) {
      previousButton.classList.remove("is-active");
      previousButton.removeAttribute("aria-current");
    }

    state.activeCueIndex = index;

    if (activeButton) {
      activeButton.classList.add("is-active");
      activeButton.setAttribute("aria-current", "true");
      activeButton.scrollIntoView({ block: "nearest" });
    }
  }

  function updateSearchNavigation() {
    const count = state.resultIndexes.length;
    const position = state.selectedResultIndex === -1 ? 0 : state.selectedResultIndex + 1;
    elements.searchCounter.textContent = `${position} / ${count}`;
    elements.searchPrevious.disabled = count === 0;
    elements.searchNext.disabled = count === 0;
  }

  function renderTranscript() {
    elements.transcript.replaceChildren();
    const selectedCueIndex = state.resultIndexes[state.selectedResultIndex];

    state.cues.forEach((cue, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ac-cue";
      button.dataset.cueIndex = String(index);
      button.classList.toggle("is-active", index === state.activeCueIndex);
      button.classList.toggle("is-search-result", state.resultIndexes.includes(index));
      button.classList.toggle("is-search-muted", Boolean(state.query) && !state.resultIndexes.includes(index));
      button.classList.toggle("is-search-result-active", index === selectedCueIndex);

      if (index === state.activeCueIndex) {
        button.setAttribute("aria-current", "true");
      }

      renderCueText(button, cue.text, state.query);
      button.addEventListener("click", () => {
        elements.audio.currentTime = cue.start;
        sync();
      });
      elements.transcript.append(button);
    });
  }

  function updateSearch() {
    state.query = elements.search.value.trim().toLocaleLowerCase();
    state.resultIndexes = state.query
      ? state.cues.reduce((indexes, cue, index) => {
          if (cue.text.toLocaleLowerCase().includes(state.query)) {
            indexes.push(index);
          }

          return indexes;
        }, [])
      : [];
    state.selectedResultIndex = -1;
    renderTranscript();
    updateSearchNavigation();
  }

  function navigateSearch(direction) {
    if (!state.resultIndexes.length) {
      return;
    }

    if (state.selectedResultIndex === -1) {
      state.selectedResultIndex = direction > 0 ? 0 : state.resultIndexes.length - 1;
    } else {
      state.selectedResultIndex =
        (state.selectedResultIndex + direction + state.resultIndexes.length) % state.resultIndexes.length;
    }

    const cueIndex = state.resultIndexes[state.selectedResultIndex];
    elements.audio.currentTime = state.cues[cueIndex].start;
    renderTranscript();
    updateSearchNavigation();
    getCueButtons()[cueIndex].scrollIntoView({ block: "center" });
  }

  function sync() {
    const time = elements.audio.currentTime;
    const cueIndex = state.cues.findIndex((cue) => time >= cue.start && time <= cue.end);
    setActiveCue(cueIndex);
  }

  function setCues(cues) {
    state.cues = cues;
    elements.search.disabled = cues.length === 0;
    updateSearch();
  }

  elements.search.addEventListener("input", updateSearch);
  elements.searchPrevious.addEventListener("click", () => navigateSearch(-1));
  elements.searchNext.addEventListener("click", () => navigateSearch(1));

  return { setCues, sync };
}

function connectAudioControls(elements, transcriptController) {
  let isSeeking = false;
  elements.audio.controls = false;

  function playAudio() {
    elements.audio.play().catch(() => {
      elements.playerStatus.textContent = "La lecture audio n’a pas pu démarrer.";
    });
  }

  function updatePlayState() {
    const isPlaying = !elements.audio.paused;
    elements.playIcon.textContent = isPlaying ? "❚❚" : "▶";
    elements.toggle.setAttribute("aria-label", isPlaying ? "Mettre en pause" : "Lire");
  }

  function updateProgress() {
    elements.currentTime.textContent = formatTime(elements.audio.currentTime);
    elements.duration.textContent = formatTime(elements.audio.duration);

    if (!isSeeking && Number.isFinite(elements.audio.duration)) {
      elements.progress.max = String(elements.audio.duration);
      elements.progress.value = String(elements.audio.currentTime);
    }
  }

  elements.toggle.addEventListener("click", () => {
    if (elements.audio.paused) {
      playAudio();
    } else {
      elements.audio.pause();
    }
  });

  elements.progress.addEventListener("input", () => {
    isSeeking = true;
    elements.currentTime.textContent = formatTime(Number(elements.progress.value));
  });

  elements.progress.addEventListener("change", () => {
    elements.audio.currentTime = Number(elements.progress.value);
    isSeeking = false;
    transcriptController.sync();
  });

  elements.volume.addEventListener("input", () => {
    elements.audio.volume = Number(elements.volume.value);
  });

  elements.audio.addEventListener("loadedmetadata", () => {
    elements.toggle.disabled = false;
    elements.progress.disabled = false;
    updateProgress();
    elements.playerStatus.textContent = "Épisode prêt à être écouté.";
  });
  elements.audio.addEventListener("error", () => {
    elements.toggle.disabled = true;
    elements.progress.disabled = true;
    elements.playerStatus.textContent = "Le fichier audio est indisponible.";
  });
  elements.audio.addEventListener("play", updatePlayState);
  elements.audio.addEventListener("pause", updatePlayState);
  elements.audio.addEventListener("ended", updatePlayState);
  elements.audio.addEventListener("timeupdate", () => {
    updateProgress();
    transcriptController.sync();
  });

  updatePlayState();
  updateProgress();
}

async function loadTranscript(path, elements, transcriptController) {
  if (!isRelativePath(path)) {
    throw new Error("Le chemin de transcription doit être relatif.");
  }

  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Impossible de charger la transcription (${response.status}).`);
  }

  const cues = parseVtt(await response.text());

  if (!cues.length) {
    throw new Error("La transcription ne contient aucun passage valide.");
  }

  transcriptController.setCues(cues);
}

async function initializePlayer() {
  const root = document.querySelector(".ac-episode");

  if (!root) {
    return;
  }

  const elements = getPlayerElements(root);
  const episodeData = readEpisodeData();
  const transcriptPath = episodeData.media?.captions ?? elements.transcript.dataset.captionsSrc;
  const transcriptController = createTranscriptController(elements);
  connectAudioControls(elements, transcriptController);

  try {
    await loadTranscript(transcriptPath, elements, transcriptController);
  } catch {
    elements.transcript.textContent = "Transcription indisponible.";
    elements.search.disabled = true;
    elements.searchCounter.textContent = "0 / 0";
  }
}

if (typeof document !== "undefined") {
  void initializePlayer();
}
