import assert from "node:assert/strict";
import test from "node:test";

import { buildHtmlPublication } from "./htmlPublisher.js";
import { publishEpisode } from "./publishEpisode.js";

function createEpisode(presentation) {
  return {
    id: "episode-theme-test",
    modelVersion: "1.0",
    status: "ready",
    metadata: {
      series: "AudioCaption",
      episodeNumber: "1",
      title: "Typographie",
      description: "Test de publication typographique.",
      author: "AudioCaption",
      language: "fr",
    },
    media: {
      artwork: { name: "cover.webp", mediaType: "image/webp", reference: "cover" },
      audio: { name: "episode.mp3", mediaType: "audio/mpeg", reference: "audio" },
      captions: { name: "captions.vtt", mediaType: "text/vtt", reference: "captions" },
    },
    ...(presentation === undefined ? {} : { presentation }),
  };
}

test("publie un ancien Episode sans présentation avec les valeurs système", () => {
  const publication = publishEpisode(createEpisode(), "html");

  assert.deepEqual(publication.presentation, {
    theme: "audio-caption",
    typography: { heading: "system", body: "system" },
  });
  assert.doesNotThrow(() => JSON.stringify(publication));
});

test("transmet les identifiants typographiques reconnus", () => {
  const publication = publishEpisode(createEpisode({
    theme: "audio-caption",
    typography: { heading: "georgia", body: "verdana" },
  }), "html");

  assert.deepEqual(publication.presentation.typography, { heading: "georgia", body: "verdana" });
});

test("normalise les identifiants inconnus avant l'export", () => {
  const publication = publishEpisode(createEpisode({
    typography: { heading: "remote-font", body: "unknown" },
  }), "html");

  assert.deepEqual(publication.presentation.typography, { heading: "system", body: "system" });
});

test("injecte les piles résolues et sérialise la présentation dans le HTML", () => {
  const publication = publishEpisode(createEpisode({
    typography: { heading: "georgia", body: "mono" },
  }), "html");
  const output = buildHtmlPublication(publication);
  const html = output.files["index.html"].content;

  assert.match(html, /--ac-font-heading: Georgia, "Times New Roman", serif;/);
  assert.match(html, /--ac-font-body: "SFMono-Regular", Consolas, "Liberation Mono", monospace;/);
  assert.match(html, /"typography":\{"heading":"georgia","body":"mono"\}/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
});

test("construit encore un ancien objet Publication sans présentation", () => {
  const publication = publishEpisode(createEpisode(), "html");
  delete publication.presentation;

  const html = buildHtmlPublication(publication).files["index.html"].content;

  assert.match(html, /--ac-font-heading: system-ui,/);
  assert.match(html, /"typography":\{"heading":"system","body":"system"\}/);
});

test("normalise et exporte la date de publication sans auteur par défaut", () => {
  const episode = createEpisode();
  episode.metadata.publishedAt = "2026-07-21";
  episode.metadata.author = "";
  const publication = publishEpisode(episode, "html");
  const html = buildHtmlPublication(publication).files["index.html"].content;

  assert.equal(publication.metadata.publishedAt, "2026-07-21");
  assert.match(html, /<time datetime="2026-07-21">21 juillet 2026<\/time>/);
  assert.doesNotMatch(html, /À venir/);
});

test("utilise la date de création d'un ancien Episode sans date de publication", () => {
  const episode = createEpisode();
  episode.createdAt = "2024-02-14T09:30:00";

  const publication = publishEpisode(episode, "html");

  assert.equal(publication.metadata.publishedAt, "2024-02-14");
});
