const audio = document.querySelector("#ac-audio");
const player = document.querySelector(".ac-player");
const cover = document.querySelector("#ac-cover");
const transcript = document.querySelector("#ac-transcript");
const playButton = document.querySelector("#ac-play");
const playIcon = document.querySelector(".ac-play-icon");
const progress = document.querySelector("#ac-progress");
const currentTime = document.querySelector("#ac-current-time");
const duration = document.querySelector("#ac-duration");
const volume = document.querySelector("#ac-volume");
const playerStatus = document.querySelector("#ac-player-status");
const episodeTitle = document.querySelector("#ac-episode-title");
const episodeDuration = document.querySelector("#ac-episode-duration");
const imageInput = document.querySelector("#ac-image-input");
const audioInput = document.querySelector("#ac-audio-input");
const subtitleInput = document.querySelector("#ac-subtitle-input");

let cues = [];
let activeCueIndex = -1;
let isSeeking = false;
let dragDepth = 0;
let ignoredFileNames = [];

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

function renderTranscript() {
  transcript.innerHTML = "";

  cues.forEach((cue, index) => {
    const button = document.createElement("button");
    button.className = "ac-cue";
    button.type = "button";
    button.textContent = cue.text;
    button.addEventListener("click", () => {
      audio.currentTime = cue.start;
      audio.play();
    });
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

function getFileExtension(file) {
  return file.name.split(".").pop().toLowerCase();
}

function getEpisodeTitle(file) {
  return file.name.replace(/\.[^/.]+$/, "") || "Titre de l’épisode";
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
  cover.src = URL.createObjectURL(file);
}

function loadAudioFile(file) {
  setControlsEnabled(false);
  isSeeking = false;
  episodeTitle.textContent = getEpisodeTitle(file);
  episodeDuration.textContent = "--:--";
  setPlayerStatus("Chargement de l'audio…");
  audio.src = URL.createObjectURL(file);
  audio.load();
}

async function loadSubtitleFile(file) {
  cues = parseSubtitles(await file.text());
  activeCueIndex = -1;
  renderTranscript();
  syncTranscript();
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

audio.addEventListener("loadedmetadata", () => {
  updateProgress();
  episodeDuration.textContent = formatTime(audio.duration);
  setControlsEnabled(true);
  setPlayerStatus("Audio chargé. Vous pouvez commencer la lecture.");
});
audio.addEventListener("error", () => {
  setControlsEnabled(false);
  setPlayerStatus("Impossible de charger ce fichier audio.");
});
audio.addEventListener("play", updatePlayState);
audio.addEventListener("pause", updatePlayState);
audio.addEventListener("ended", updatePlayState);
audio.addEventListener("timeupdate", () => {
  updateProgress();
  syncTranscript();
});

updatePlayState();
updateProgress();
