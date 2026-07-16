(function initializeChapterImporter(global) {
"use strict";

const UNKNOWN_FORMAT_WARNING = "Le format de chapitres de ce fichier n’est pas encore pris en charge.";

function readAscii(bytes, start, length) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function readSyncSafeInteger(bytes, offset) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

async function readAudioBytes(audioSource) {
  const source = audioSource?.data ?? audioSource?.reference ?? audioSource;

  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }

  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }

  if (source && typeof source.arrayBuffer === "function") {
    return new Uint8Array(await source.arrayBuffer());
  }

  throw new TypeError("La source audio doit fournir des données binaires exploitables.");
}

function getSourceMetadata(audioSource) {
  return {
    name: typeof audioSource?.name === "string" ? audioSource.name.toLowerCase() : "",
    mediaType: typeof audioSource?.mediaType === "string"
      ? audioSource.mediaType.toLowerCase()
      : typeof audioSource?.type === "string"
        ? audioSource.type.toLowerCase()
        : "",
  };
}

function detectAudioFormat(bytes, metadata) {
  if (bytes.length >= 3 && readAscii(bytes, 0, 3) === "ID3") {
    return "mp3";
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return "mp3";
  }

  if (bytes.length >= 12 && readAscii(bytes, 4, 4) === "ftyp") {
    return "m4a";
  }

  if (metadata.mediaType === "audio/mpeg" || metadata.name.endsWith(".mp3")) {
    return "mp3";
  }

  if (
    ["audio/mp4", "audio/x-m4a", "video/mp4"].includes(metadata.mediaType) ||
    metadata.name.endsWith(".m4a") ||
    metadata.name.endsWith(".mp4")
  ) {
    return "m4a";
  }

  return "unknown";
}

function readId3Frames(bytes, start, end, version, warnings) {
  const frames = [];
  let offset = start;

  while (offset + 10 <= end) {
    const id = readAscii(bytes, offset, 4);

    if (/^\x00{4}$/.test(id)) {
      break;
    }

    if (!/^[A-Z0-9]{4}$/.test(id)) {
      warnings.push(`Une trame ID3 invalide a été ignorée à l’octet ${offset}.`);
      break;
    }

    const size = version === 4 ? readSyncSafeInteger(bytes, offset + 4) : readUint32(bytes, offset + 4);
    const formatFlags = bytes[offset + 9];
    const dataStart = offset + 10;
    const dataEnd = dataStart + size;

    if (size === 0) {
      offset = dataStart;
      continue;
    }

    if (dataEnd > end) {
      warnings.push(`La trame ID3 ${id} est tronquée et a été ignorée.`);
      break;
    }

    const unsupportedFlags = version === 4 ? formatFlags & 0x4f : formatFlags & 0xe0;

    if ((id === "CHAP" || id === "TIT2") && unsupportedFlags) {
      warnings.push(`La trame ID3 ${id} utilise un encodage de trame non pris en charge.`);
      offset = dataEnd;
      continue;
    }

    frames.push({ id, data: bytes.subarray(dataStart, dataEnd) });
    offset = dataEnd;
  }

  return frames;
}

function decodeText(bytes, encoding) {
  if (encoding === 0) {
    return new TextDecoder("windows-1252").decode(bytes);
  }

  if (encoding === 1) {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder("utf-16be").decode(bytes.subarray(2));
    }

    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder("utf-16le").decode(bytes.subarray(2));
    }

    return new TextDecoder("utf-16le").decode(bytes);
  }

  if (encoding === 2) {
    return new TextDecoder("utf-16be").decode(bytes);
  }

  if (encoding === 3) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  return "";
}

function extractChapterTitle(bytes, version, warnings) {
  const titleFrame = readId3Frames(bytes, 0, bytes.length, version, warnings)
    .find((frame) => frame.id === "TIT2");

  if (!titleFrame?.data.length) {
    return "";
  }

  const encoding = titleFrame.data[0];
  const textBytes = titleFrame.data.subarray(1);

  try {
    return decodeText(textBytes, encoding).replace(/\u0000/g, "").trim();
  } catch {
    warnings.push("Un titre de chapitre n’a pas pu être décodé.");
    return "";
  }
}

function extractChapterFrame(frame, version, warnings) {
  const separatorIndex = frame.data.indexOf(0);
  const timingOffset = separatorIndex + 1;

  if (separatorIndex === -1 || timingOffset + 16 > frame.data.length) {
    warnings.push("Une trame CHAP incomplète a été ignorée.");
    return null;
  }

  const startMilliseconds = readUint32(frame.data, timingOffset);
  const endMilliseconds = readUint32(frame.data, timingOffset + 4);
  const titleBytes = frame.data.subarray(timingOffset + 16);

  return {
    title: extractChapterTitle(titleBytes, version, warnings),
    startTime: startMilliseconds === 0xffffffff ? Number.NaN : startMilliseconds / 1000,
    endTime: endMilliseconds === 0xffffffff ? null : endMilliseconds / 1000,
  };
}

function getId3FrameRange(bytes, version, flags, tagEnd, warnings) {
  let start = 10;

  if ((flags & 0x40) === 0) {
    return { start, end: tagEnd };
  }

  if (start + 4 > tagEnd) {
    warnings.push("L’en-tête étendu ID3 est tronqué.");
    return null;
  }

  const extendedSize = version === 4 ? readSyncSafeInteger(bytes, start) : readUint32(bytes, start);
  start += version === 4 ? extendedSize : extendedSize + 4;

  if (start > tagEnd) {
    warnings.push("La taille de l’en-tête étendu ID3 est invalide.");
    return null;
  }

  return { start, end: tagEnd };
}

function extractMp3Chapters(bytes) {
  const warnings = [];

  if (bytes.length < 10 || readAscii(bytes, 0, 3) !== "ID3") {
    return { chapters: [], warnings: ["Aucun tag ID3 contenant des chapitres n’a été trouvé."] };
  }

  const version = bytes[3];
  const flags = bytes[5];

  if (version !== 3 && version !== 4) {
    return {
      chapters: [],
      warnings: [`Les chapitres ID3v2.${version} ne sont pas pris en charge.`],
    };
  }

  if ((flags & 0x80) !== 0) {
    return {
      chapters: [],
      warnings: ["Les tags ID3 utilisant la désynchronisation ne sont pas encore pris en charge."],
    };
  }

  const declaredEnd = 10 + readSyncSafeInteger(bytes, 6);
  const tagEnd = Math.min(declaredEnd, bytes.length);

  if (declaredEnd > bytes.length) {
    warnings.push("Le tag ID3 est tronqué ; seuls les chapitres complets seront analysés.");
  }

  const range = getId3FrameRange(bytes, version, flags, tagEnd, warnings);

  if (!range) {
    return { chapters: [], warnings };
  }

  const chapters = readId3Frames(bytes, range.start, range.end, version, warnings)
    .filter((frame) => frame.id === "CHAP")
    .map((frame) => extractChapterFrame(frame, version, warnings))
    .filter(Boolean);

  if (!chapters.length && !warnings.length) {
    warnings.push("Aucun chapitre ID3 CHAP n’a été trouvé dans ce fichier MP3.");
  }

  return { chapters, warnings };
}

function validateChapters(chapters) {
  const validChapters = [];
  const warnings = [];

  chapters.forEach((chapter, index) => {
    const number = index + 1;
    const title = typeof chapter.title === "string" ? chapter.title.trim().replace(/\s+/g, " ") : "";
    const startTime = chapter.startTime;
    const endTime = chapter.endTime ?? null;

    if (!title) {
      warnings.push(`Le chapitre source ${number} a été ignoré car son titre est vide.`);
      return;
    }

    if (!Number.isFinite(startTime) || startTime < 0) {
      warnings.push(`Le chapitre « ${title} » a été ignoré car son début est invalide.`);
      return;
    }

    if (endTime !== null && (!Number.isFinite(endTime) || endTime < startTime)) {
      warnings.push(`Le chapitre « ${title} » a été ignoré car sa fin précède son début.`);
      return;
    }

    validChapters.push({ title, startTime, endTime, sourceIndex: index });
  });

  return { chapters: validChapters, warnings };
}

function normalizeChapters(chapters) {
  const validation = validateChapters(chapters);
  const warnings = [...validation.warnings];
  const sortedChapters = validation.chapters
    .sort((first, second) => first.startTime - second.startTime || first.sourceIndex - second.sourceIndex);
  const uniqueChapters = [];
  const knownStartTimes = new Set();

  sortedChapters.forEach((chapter) => {
    if (knownStartTimes.has(chapter.startTime)) {
      warnings.push(`Le chapitre « ${chapter.title} » a été ignoré car son temps de début est dupliqué.`);
      return;
    }

    knownStartTimes.add(chapter.startTime);
    uniqueChapters.push(chapter);
  });

  const normalizedChapters = uniqueChapters.map((chapter, index) => {
    const nextChapter = uniqueChapters[index + 1];
    const endTime = chapter.endTime ?? nextChapter?.startTime ?? null;

    if (nextChapter && chapter.endTime !== null && chapter.endTime > nextChapter.startTime) {
      warnings.push(`Le chapitre « ${chapter.title} » chevauche le chapitre suivant.`);
    }

    return {
      id: `chapter-${index + 1}`,
      title: chapter.title,
      startTime: chapter.startTime,
      endTime,
      origin: "imported",
    };
  });

  return { chapters: normalizedChapters, warnings };
}

function unsupportedResult(format, warning = UNKNOWN_FORMAT_WARNING) {
  return {
    supported: false,
    format,
    chapters: [],
    warnings: [warning],
  };
}

/**
 * Extrait les chapitres MP3 ID3v2.3/v2.4 CHAP depuis une source binaire.
 * Les autres formats sont détectés mais ne sont pas annoncés comme pris en charge.
 */
async function importAudioChapters(audioSource) {
  let bytes;

  try {
    bytes = await readAudioBytes(audioSource);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "La source audio n’a pas pu être lue.";
    return unsupportedResult("unknown", message);
  }

  const format = detectAudioFormat(bytes, getSourceMetadata(audioSource));

  if (format === "m4a") {
    return unsupportedResult("m4a", "Les chapitres M4A / MP4 ne sont pas encore pris en charge.");
  }

  if (format !== "mp3") {
    return unsupportedResult("unknown");
  }

  const extracted = extractMp3Chapters(bytes);
  const normalized = normalizeChapters(extracted.chapters);

  return {
    supported: true,
    format: "mp3",
    chapters: normalized.chapters,
    warnings: [...extracted.warnings, ...normalized.warnings],
  };
}

global.AudioCaption = Object.assign(global.AudioCaption ?? {}, {
  importAudioChapters,
});
})(globalThis);
