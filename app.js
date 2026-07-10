const audio = document.querySelector("#ac-audio");
const cover = document.querySelector("#ac-cover");
const caption = document.querySelector("#ac-caption");
const transcript = document.querySelector("#ac-transcript");
const playButton = document.querySelector("#ac-play");
const playIcon = document.querySelector(".ac-play-icon");
const progress = document.querySelector("#ac-progress");
const currentTime = document.querySelector("#ac-current-time");
const duration = document.querySelector("#ac-duration");
const volume = document.querySelector("#ac-volume");
const imageInput = document.querySelector("#ac-image-input");
const audioInput = document.querySelector("#ac-audio-input");
const subtitleInput = document.querySelector("#ac-subtitle-input");

let cues = [];
let activeCueIndex = -1;
let isSeeking = false;

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

  if (parts.length !== 3) {
    return 0;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);

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

      const [start, end] = lines[timeLineIndex].split("-->").map(parseTimestamp);
      const text = lines.slice(timeLineIndex + 1).join("\n").trim();

      return text ? { start, end, text } : null;
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
    caption.textContent = "";
    return;
  }

  const activeButton = cueButtons[index];
  const activeCue = cues[index];

  caption.textContent = activeCue.text;
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

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];

  if (file) {
    cover.src = URL.createObjectURL(file);
  }
});

audioInput.addEventListener("change", () => {
  const file = audioInput.files[0];

  if (file) {
    audio.src = URL.createObjectURL(file);
    audio.load();
  }
});

subtitleInput.addEventListener("change", async () => {
  const file = subtitleInput.files[0];

  if (!file) {
    return;
  }

  cues = parseSubtitles(await file.text());
  activeCueIndex = -1;
  caption.textContent = cues.length ? "Transcription chargée." : "Aucun sous-titre détecté.";
  renderTranscript();
  syncTranscript();
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

audio.addEventListener("loadedmetadata", updateProgress);
audio.addEventListener("play", updatePlayState);
audio.addEventListener("pause", updatePlayState);
audio.addEventListener("ended", updatePlayState);
audio.addEventListener("timeupdate", () => {
  updateProgress();
  syncTranscript();
});

updatePlayState();
updateProgress();
