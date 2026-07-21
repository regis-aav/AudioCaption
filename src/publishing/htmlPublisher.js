import { normalizeTypography, resolveFontStack } from "../theme/fontRegistry.module.mjs";
import {
  formatPublicationDate,
  normalizePublicationDate,
  normalizeTakeaways,
} from "../domain/publicationMetadata.module.mjs";

const HTML_ENTITIES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

function serializeEpisodeData(publication) {
  const data = {
    metadata: publication.metadata,
    presentation: {
      ...publication.presentation,
      typography: normalizeTypography(publication.presentation?.typography),
    },
    media: {
      artwork: publication.paths.artwork,
      audio: publication.paths.audio,
      captions: publication.paths.captions,
    },
  };

  return JSON.stringify(data)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildTypographyStyle(publication) {
  const typography = normalizeTypography(publication.presentation?.typography);
  const headingStack = resolveFontStack(typography.heading);
  const bodyStack = resolveFontStack(typography.body);

  return `    <style>
      :root {
        --ac-font-heading: ${headingStack};
        --ac-font-body: ${bodyStack};
      }

      body,
      button,
      input {
        font-family: var(--ac-font-body);
      }

      h1,
      h2,
      h3,
      .ac-episode-series {
        font-family: var(--ac-font-heading);
      }
    </style>`;
}

function optionalParagraph(className, label, value) {
  if (!value) {
    return "";
  }

  const prefix = label ? `${escapeHtml(label)} ` : "";
  return `        <p class="${className}">${prefix}${escapeHtml(value)}</p>\n`;
}

function buildEpisodeMetadata(metadata) {
  const publishedAt = normalizePublicationDate(metadata.publishedAt, metadata.createdAt);
  const parts = [
    `<time datetime="${escapeHtml(publishedAt)}">${escapeHtml(formatPublicationDate(publishedAt, metadata.language))}</time>`,
  ];

  if (metadata.author) {
    parts.push(`<span>${escapeHtml(metadata.author)}</span>`);
  }

  return `        <p class="ac-episode-meta">${parts.join(' <span aria-hidden="true">•</span> ')}</p>\n`;
}

function buildTakeaways(metadata) {
  const takeaways = normalizeTakeaways(metadata.takeaways);

  if (!takeaways.length) {
    return "";
  }

  const items = takeaways.map((takeaway) => `          <li>${escapeHtml(takeaway)}</li>`).join("\n");

  return `
        <section class="ac-takeaways" aria-labelledby="ac-takeaways-title">
          <h2 id="ac-takeaways-title">À retenir</h2>
          <ul>
${items}
          </ul>
        </section>
`;
}

function buildIndexHtml(publication) {
  const { metadata, paths } = publication;
  const title = escapeHtml(metadata.title);
  const language = escapeHtml(metadata.language);
  const series = escapeHtml(metadata.series);
  const episodeNumber = metadata.episodeNumber ? ` · ${escapeHtml(metadata.episodeNumber)}` : "";
  const descriptionMeta = metadata.description
    ? `\n    <meta name="description" content="${escapeHtml(metadata.description)}">`
    : "";
  const description = optionalParagraph("ac-episode-description", "", metadata.description);
  const episodeMetadata = buildEpisodeMetadata(metadata);
  const takeaways = buildTakeaways(metadata);
  const episodeData = serializeEpisodeData(publication);
  const typographyStyle = buildTypographyStyle(publication);

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">${descriptionMeta}
    <title>${title}</title>
    <link rel="stylesheet" href="${escapeHtml(paths.stylesheet)}">
${typographyStyle}
  </head>
  <body>
    <main class="ac-page">
      <article class="ac-episode" data-episode-id="${escapeHtml(metadata.episodeId)}">
        <header class="ac-episode-header">
          <p class="ac-episode-series">${series}${episodeNumber}</p>
          <h1>${title}</h1>
${description}${episodeMetadata}        </header>

        <img class="ac-artwork" src="${escapeHtml(paths.artwork)}" alt="Illustration de ${title}">${takeaways}

        <audio class="ac-audio" controls preload="metadata" src="${escapeHtml(paths.audio)}">
          Votre navigateur ne permet pas la lecture de cet épisode audio.
        </audio>

        <div class="ac-player-controls" aria-label="Lecteur audio">
          <button class="ac-play" type="button" data-player-toggle aria-label="Lire" disabled>
            <span data-player-icon aria-hidden="true">▶</span>
          </button>
          <div class="ac-timeline">
            <div class="ac-time-row">
              <span data-player-current-time>00:00</span>
              <span data-player-duration>00:00</span>
            </div>
            <input
              type="range"
              min="0"
              max="0"
              value="0"
              step="0.01"
              data-player-progress
              aria-label="Progression audio"
              disabled
            >
          </div>
          <label class="ac-volume">
            <span>Volume</span>
            <input type="range" min="0" max="1" value="1" step="0.01" data-player-volume>
          </label>
        </div>
        <p class="ac-player-status" data-player-status role="status">Chargement de l’épisode…</p>

        <section class="ac-transcript-section" aria-labelledby="ac-transcript-title">
          <h2 id="ac-transcript-title">Transcription</h2>
          <div class="ac-transcript-tools">
            <label>
              <span>Rechercher dans la transcription</span>
              <input
                type="search"
                data-transcript-search
                aria-controls="ac-transcript"
                placeholder="Mot ou expression"
                disabled
              >
            </label>
            <div class="ac-search-navigation" role="group" aria-label="Navigation dans les résultats">
              <span data-search-counter role="status" aria-live="polite">0 / 0</span>
              <button type="button" data-search-previous aria-label="Résultat précédent" disabled>Précédent</button>
              <button type="button" data-search-next aria-label="Résultat suivant" disabled>Suivant</button>
            </div>
          </div>
          <div
            class="ac-transcript"
            id="ac-transcript"
            lang="${escapeHtml(metadata.transcriptLanguage)}"
            data-captions-src="${escapeHtml(paths.captions)}"
          >
            <p>La transcription synchronisée sera chargée par le lecteur.</p>
          </div>
        </section>
      </article>
    </main>

    <script type="application/json" id="ac-episode-data">${episodeData}</script>
    <script type="module" src="${escapeHtml(paths.script)}"></script>
  </body>
</html>
`;
}

function buildReadme(publication) {
  return `AudioCaption — ${publication.metadata.title}

Ce dossier contient un épisode AudioCaption autonome.

Publication
-----------

1. Conservez la structure complète du dossier "${publication.paths.root}".
2. Déposez son contenu sur un hébergement web statique.
3. Ouvrez index.html depuis une adresse HTTP ou HTTPS.

Les chemins utilisés par le lecteur sont relatifs. Aucun service AudioCaption distant n'est requis.
`;
}

function createTextFile(path, mediaType, content) {
  return { path, kind: "text", mediaType, content };
}

function createRuntimeReference(path, resource) {
  return {
    path,
    kind: "runtime-reference",
    mediaType: resource === "player.css" ? "text/css" : "text/javascript",
    reference: { runtime: "audio-caption-player", resource },
  };
}

function getOutputMediaType(asset) {
  if (asset.destination.endsWith(".webp")) {
    return "image/webp";
  }

  if (asset.destination.endsWith(".vtt")) {
    return "text/vtt";
  }

  return asset.source.mediaType;
}

function createAssetReference(asset) {
  return {
    path: asset.destination,
    kind: "asset-reference",
    mediaType: getOutputMediaType(asset),
    sourceMediaType: asset.source.mediaType,
    reference: asset.source.reference,
    operation: asset.operation,
  };
}

function createFiles(publication) {
  const { assets, paths } = publication;

  return {
    [paths.index]: createTextFile(paths.index, "text/html", buildIndexHtml(publication)),
    [paths.readme]: createTextFile(paths.readme, "text/plain", buildReadme(publication)),
    [paths.stylesheet]: createRuntimeReference(paths.stylesheet, "player.css"),
    [paths.script]: createRuntimeReference(paths.script, "player.js"),
    [paths.artwork]: createAssetReference(assets.artwork),
    [paths.audio]: createAssetReference(assets.audio),
    [paths.captions]: createAssetReference(assets.captions),
  };
}

function createManifest(publication, files) {
  return {
    version: "1.0",
    target: publication.target,
    root: publication.paths.root,
    episodeId: publication.metadata.episodeId,
    entries: Object.values(files).map(({ path, kind, mediaType }) => ({ path, kind, mediaType })),
    tree: publication.tree,
    warnings: [...publication.warnings],
  };
}

/**
 * Transforme une Publication HTML validée en contenus et références virtuels.
 * Cette fonction ne valide, ne copie et n'écrit aucune ressource.
 */
export function buildHtmlPublication(publication) {
  const files = createFiles(publication);

  return {
    target: publication.target,
    root: publication.paths.root,
    files,
    manifest: createManifest(publication, files),
  };
}
