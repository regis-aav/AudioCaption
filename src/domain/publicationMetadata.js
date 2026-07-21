(function initializePublicationMetadata(global) {
"use strict";

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parsePublicationDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalizedValue = value.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedValue);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch.map(Number);
    const date = new Date(year, month - 1, day, 12);

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }

  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePublicationDate(value, fallbackValue) {
  return toDateValue(parsePublicationDate(value) ?? parsePublicationDate(fallbackValue) ?? new Date());
}

function formatPublicationDate(value, locale = "fr") {
  const date = parsePublicationDate(value) ?? parsePublicationDate(normalizePublicationDate());
  return new Intl.DateTimeFormat(locale || "fr", { dateStyle: "long" }).format(date);
}

function formatEpisodeDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (!minutes) {
    return `${remainingSeconds} s`;
  }

  return remainingSeconds ? `${minutes} min ${remainingSeconds}` : `${minutes} min`;
}

function normalizeTakeaways(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

global.AudioCaption = Object.assign(global.AudioCaption ?? {}, {
  formatEpisodeDuration,
  formatPublicationDate,
  normalizePublicationDate,
  normalizeTakeaways,
});
})(globalThis);
