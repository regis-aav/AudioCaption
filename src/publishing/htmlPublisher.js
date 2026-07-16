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

function optionalParagraph(className, label, value) {
  if (!value) {
    return "";
  }

  const prefix = label ? `${escapeHtml(label)} ` : "";
  return `        <p class="${className}">${prefix}${escapeHtml(value)}</p>\n`;
}

function buildIndexHtml(publication) {
  const { metadata, paths } = publication;
  const title = escapeHtml(metadata.title);
  const language = escapeHtml(metadata.language);
  const descriptionMeta = metadata.description
    ? `\n    <meta name="description" content="${escapeHtml(metadata.description)}">`
    : "";
  const description = optionalParagraph("ac-episode-description", "", metadata.description);
  const author = optionalParagraph("ac-episode-author", "Par", metadata.author);
  const episodeData = serializeEpisodeData(publication);

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">${descriptionMeta}
    <title>${title}</title>
    <link rel="stylesheet" href="${escapeHtml(paths.stylesheet)}">
  </head>
  <body>
    <main class="ac-page">
      <article class="ac-episode" data-episode-id="${escapeHtml(metadata.episodeId)}">
        <header class="ac-episode-header">
          <h1>${title}</h1>
${description}${author}        </header>

        <img class="ac-artwork" src="${escapeHtml(paths.artwork)}" alt="Illustration de ${title}">

        <audio class="ac-audio" controls preload="metadata" src="${escapeHtml(paths.audio)}">
          Votre navigateur ne permet pas la lecture de cet épisode audio.
        </audio>

        <section class="ac-transcript-section" aria-labelledby="ac-transcript-title">
          <h2 id="ac-transcript-title">Transcription</h2>
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
    <script src="${escapeHtml(paths.script)}" defer></script>
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
