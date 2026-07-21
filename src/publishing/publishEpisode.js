import { normalizeTypography } from "../theme/fontRegistry.module.mjs";

const SUPPORTED_TARGET = "html";

const HTML_PATHS = Object.freeze({
  root: "episode",
  index: "index.html",
  readme: "README.txt",
  stylesheet: "css/player.css",
  script: "js/player.js",
  artwork: "media/artwork.webp",
  audio: "media/episode.mp3",
  captions: "media/captions.vtt",
});

const MEDIA_RULES = Object.freeze({
  artwork: {
    acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
    destination: HTML_PATHS.artwork,
  },
  audio: {
    acceptedTypes: ["audio/mpeg", "audio/mp3"],
    destination: HTML_PATHS.audio,
  },
  captions: {
    acceptedTypes: ["text/vtt", "application/x-subrip", "text/plain"],
    destination: HTML_PATHS.captions,
  },
});

export class PublicationError extends Error {
  constructor(code, message, issues = []) {
    super(message);
    this.name = "PublicationError";
    this.code = code;
    this.issues = issues;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "object" || ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);
  const values = Array.isArray(value) ? value : isPlainObject(value) ? Object.values(value) : null;
  const isValid = values !== null && values.every((item) => isJsonValue(item, ancestors));
  ancestors.delete(value);

  return isValid;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isLanguageCode(value) {
  return isNonEmptyString(value) && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value);
}

function isAbsoluteLocalReference(value) {
  return typeof value === "string" && /^(?:file:|[a-z]:[\\/]|[\\/]{1,2})/i.test(value);
}

function validateRequiredString(value, path, issues) {
  if (!isNonEmptyString(value)) {
    issues.push(`${path} doit être une chaîne non vide.`);
  }
}

function validateOptionalString(value, path, issues) {
  if (value !== undefined && typeof value !== "string") {
    issues.push(`${path} doit être une chaîne lorsqu'il est renseigné.`);
  }
}

function validateAsset(asset, role, issues) {
  const rule = MEDIA_RULES[role];

  if (!isPlainObject(asset)) {
    issues.push(`media.${role} est obligatoire pour une publication HTML.`);
    return;
  }

  validateRequiredString(asset.name, `media.${role}.name`, issues);
  validateRequiredString(asset.mediaType, `media.${role}.mediaType`, issues);

  if (isNonEmptyString(asset.mediaType) && !rule.acceptedTypes.includes(asset.mediaType.toLowerCase())) {
    issues.push(`media.${role}.mediaType n'est pas pris en charge : ${asset.mediaType}.`);
  }

  if (!("reference" in asset) || !isJsonValue(asset.reference)) {
    issues.push(`media.${role}.reference doit être une valeur sérialisable.`);
  } else if (isAbsoluteLocalReference(asset.reference)) {
    issues.push(`media.${role}.reference ne doit pas contenir de chemin local absolu.`);
  }

  if (asset.size !== undefined && (!Number.isInteger(asset.size) || asset.size < 0)) {
    issues.push(`media.${role}.size doit être un entier positif ou nul.`);
  }
}

/**
 * Valide le profil de publication HTML V1 sans modifier l'Episode.
 * Un Episode au statut "draft" est accepté uniquement s'il est complet.
 */
export function validateEpisode(episode) {
  const issues = [];

  if (!isPlainObject(episode)) {
    throw new PublicationError("INVALID_EPISODE", "L'Episode doit être un objet.");
  }

  validateRequiredString(episode.id, "id", issues);
  validateRequiredString(episode.modelVersion, "modelVersion", issues);

  if (!["draft", "ready"].includes(episode.status)) {
    issues.push('status doit être "draft" ou "ready".');
  }

  if (!isPlainObject(episode.metadata)) {
    issues.push("metadata est obligatoire.");
  } else {
    validateRequiredString(episode.metadata.series, "metadata.series", issues);
    validateOptionalString(episode.metadata.episodeNumber, "metadata.episodeNumber", issues);
    validateRequiredString(episode.metadata.title, "metadata.title", issues);
    validateOptionalString(episode.metadata.description, "metadata.description", issues);
    validateOptionalString(episode.metadata.author, "metadata.author", issues);
    validateOptionalString(episode.metadata.publishedAt, "metadata.publishedAt", issues);

    if (!isLanguageCode(episode.metadata.language)) {
      issues.push("metadata.language doit être un code de langue BCP 47 valide.");
    }
  }

  if (!isPlainObject(episode.media)) {
    issues.push("media est obligatoire.");
  } else {
    validateAsset(episode.media.artwork, "artwork", issues);
    validateAsset(episode.media.audio, "audio", issues);
    validateAsset(episode.media.captions, "captions", issues);
  }

  if (episode.presentation !== undefined && !isPlainObject(episode.presentation)) {
    issues.push("presentation doit être un objet lorsqu'elle est renseignée.");
  } else if (
    episode.presentation?.theme !== undefined &&
    !isNonEmptyString(episode.presentation.theme)
  ) {
    issues.push("presentation.theme doit être une chaîne non vide lorsqu'il est renseigné.");
  }

  if (episode.brand !== undefined) {
    if (!isPlainObject(episode.brand)) {
      issues.push("brand doit être un objet lorsqu'il est renseigné.");
    } else {
      validateOptionalString(episode.brand.name, "brand.name", issues);
    }
  }

  if (episode.accessibility !== undefined) {
    if (!isPlainObject(episode.accessibility)) {
      issues.push("accessibility doit être un objet lorsqu'il est renseigné.");
    } else if (
      episode.accessibility.transcriptLanguage !== undefined &&
      !isLanguageCode(episode.accessibility.transcriptLanguage)
    ) {
      issues.push("accessibility.transcriptLanguage doit être un code de langue BCP 47 valide.");
    }
  }

  if (issues.length) {
    throw new PublicationError(
      "INVALID_EPISODE",
      `L'Episode ne peut pas être publié : ${issues.join(" ")}`,
      issues
    );
  }

  return episode;
}

function createAssetPlan(asset, role) {
  const rule = MEDIA_RULES[role];
  const normalizedType = asset.mediaType.toLowerCase();
  let operation = "copy";

  if (role === "artwork" && normalizedType !== "image/webp") {
    operation = "convert-to-webp";
  }

  if (role === "captions" && normalizedType !== "text/vtt") {
    operation = "normalize-to-vtt";
  }

  return {
    role,
    source: {
      name: asset.name,
      mediaType: asset.mediaType,
      size: asset.size ?? null,
      reference: asset.reference,
    },
    destination: rule.destination,
    operation,
  };
}

/** Prépare un plan sérialisable. Aucune ressource n'est lue ou copiée. */
export function prepareAssets(episode) {
  return {
    artwork: createAssetPlan(episode.media.artwork, "artwork"),
    audio: createAssetPlan(episode.media.audio, "audio"),
    captions: createAssetPlan(episode.media.captions, "captions"),
  };
}

function compactObject(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

function createMetadata(episode, presentation) {
  return compactObject([
    ["episodeId", episode.id],
    ["modelVersion", episode.modelVersion],
    ["series", episode.metadata.series.trim()],
    ["episodeNumber", episode.metadata.episodeNumber],
    ["title", episode.metadata.title.trim()],
    ["description", episode.metadata.description],
    ["author", episode.metadata.author],
    ["language", episode.metadata.language],
    ["publishedAt", episode.metadata.publishedAt],
    ["transcriptLanguage", episode.accessibility?.transcriptLanguage ?? episode.metadata.language],
    ["brandName", episode.brand?.name],
    ["theme", presentation.theme],
  ]);
}

function createPresentation(episode) {
  return {
    theme: isNonEmptyString(episode.presentation?.theme)
      ? episode.presentation.theme.trim()
      : "audio-caption",
    typography: normalizeTypography(episode.presentation?.typography),
  };
}

function createWarnings(episode, assets) {
  const warnings = [];

  if (episode.status === "draft") {
    warnings.push("L'Episode est encore marqué comme brouillon, mais il satisfait le profil d'export HTML V1.");
  }

  if (assets.artwork.operation === "convert-to-webp") {
    warnings.push("L'illustration devra être convertie en WebP lors de la génération réelle.");
  }

  if (assets.captions.operation === "normalize-to-vtt") {
    warnings.push("La transcription devra être normalisée en WebVTT lors de la génération réelle.");
  }

  return warnings;
}

function validateTarget(target) {
  if (target !== SUPPORTED_TARGET) {
    throw new PublicationError(
      "UNSUPPORTED_TARGET",
      `Cible de publication inconnue : ${String(target)}. Seule la cible "html" est disponible.`
    );
  }
}

/** Assemble les données de publication sans produire de fichier. */
export function createPublicationContext(episode, target, assets) {
  validateTarget(target);
  const presentation = createPresentation(episode);

  return {
    target,
    metadata: createMetadata(episode, presentation),
    presentation,
    assets,
    paths: { ...HTML_PATHS },
    warnings: createWarnings(episode, assets),
  };
}

function fileNode(name, path) {
  return { type: "file", name, path };
}

function directoryNode(name, path, children) {
  return { type: "directory", name, path, children };
}

/** Construit une représentation virtuelle de l'arborescence cible. */
export function createPublicationTree(context) {
  const { paths } = context;

  return directoryNode(paths.root, ".", [
    fileNode("index.html", paths.index),
    fileNode("README.txt", paths.readme),
    directoryNode("css", "css", [fileNode("player.css", paths.stylesheet)]),
    directoryNode("js", "js", [fileNode("player.js", paths.script)]),
    directoryNode("media", "media", [
      fileNode("artwork.webp", paths.artwork),
      fileNode("episode.mp3", paths.audio),
      fileNode("captions.vtt", paths.captions),
    ]),
  ]);
}

/**
 * Prépare une Publication sérialisable.
 * Cette étape ne génère, ne copie et ne télécharge aucun fichier.
 */
export function publishEpisode(episode, target) {
  const validatedEpisode = validateEpisode(episode);
  const assets = prepareAssets(validatedEpisode);
  const context = createPublicationContext(validatedEpisode, target, assets);
  const tree = createPublicationTree(context);

  return { ...context, tree };
}
