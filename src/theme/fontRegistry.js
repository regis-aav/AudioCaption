(function initializeFontRegistry(global) {
"use strict";

const DEFAULT_FONT_ID = "system";

const FONT_REGISTRY = Object.freeze({
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  verdana: 'Verdana, Geneva, sans-serif',
  trebuchet: '"Trebuchet MS", Arial, sans-serif',
  times: '"Times New Roman", Times, serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
});

const FONT_LABELS = Object.freeze({
  system: "Système",
  helvetica: "Helvetica",
  georgia: "Georgia",
  verdana: "Verdana",
  trebuchet: "Trebuchet",
  times: "Times",
  mono: "Monospace",
});

function normalizeFontId(value) {
  return typeof value === "string" && Object.hasOwn(FONT_REGISTRY, value)
    ? value
    : DEFAULT_FONT_ID;
}

function normalizeTypography(typography = {}) {
  const source = typography && typeof typography === "object" && !Array.isArray(typography)
    ? typography
    : {};

  return {
    heading: normalizeFontId(source.heading),
    body: normalizeFontId(source.body),
  };
}

function resolveFontStack(fontId) {
  return FONT_REGISTRY[normalizeFontId(fontId)];
}

function getFontOptions() {
  return Object.keys(FONT_REGISTRY).map((id) => ({ id, label: FONT_LABELS[id] }));
}

global.AudioCaption = Object.assign(global.AudioCaption ?? {}, {
  DEFAULT_FONT_ID,
  FONT_REGISTRY,
  getFontOptions,
  normalizeFontId,
  normalizeTypography,
  resolveFontStack,
});
})(globalThis);
