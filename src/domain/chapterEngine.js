const CHAPTER_ORIGINS = new Set(["imported", "manual", "generated"]);

export class ChapterEngineError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "ChapterEngineError";
    this.code = code;
    this.details = details;
  }
}

function isChapterObject(chapter) {
  return chapter !== null && typeof chapter === "object" && !Array.isArray(chapter);
}

function cloneChapter(chapter) {
  return isChapterObject(chapter) ? { ...chapter } : chapter;
}

function normalizeTitle(title) {
  return typeof title === "string" ? title.trim().replace(/\s+/g, " ") : title;
}

function normalizeChapter(chapter) {
  if (!isChapterObject(chapter)) {
    return chapter;
  }

  return {
    ...chapter,
    title: normalizeTitle(chapter.title),
    endTime: chapter.endTime ?? null,
  };
}

function chronologicalValue(chapter) {
  return isChapterObject(chapter) && Number.isFinite(chapter.startTime)
    ? chapter.startTime
    : Number.POSITIVE_INFINITY;
}

function normalizeChapterList(chapters) {
  return chapters
    .map((chapter, sourceIndex) => ({ chapter: normalizeChapter(cloneChapter(chapter)), sourceIndex }))
    .sort((first, second) => {
      return chronologicalValue(first.chapter) - chronologicalValue(second.chapter)
        || first.sourceIndex - second.sourceIndex;
    })
    .map(({ chapter }) => chapter);
}

function createValidationError(code, message, index, chapter) {
  return {
    code,
    message,
    index,
    chapterId: isChapterObject(chapter) && typeof chapter.id === "string" ? chapter.id : null,
  };
}

function validateChapter(chapter, index) {
  const errors = [];

  if (!isChapterObject(chapter)) {
    return [createValidationError("INVALID_CHAPTER", "Le chapitre doit être un objet.", index, chapter)];
  }

  if (typeof chapter.id !== "string" || !chapter.id.trim()) {
    errors.push(createValidationError("INVALID_ID", "L’identifiant du chapitre est obligatoire.", index, chapter));
  }

  if (typeof chapter.title !== "string" || !chapter.title.trim()) {
    errors.push(createValidationError("INVALID_TITLE", "Le titre du chapitre est obligatoire.", index, chapter));
  }

  if (!Number.isFinite(chapter.startTime) || chapter.startTime < 0) {
    errors.push(createValidationError("INVALID_START_TIME", "Le début du chapitre doit être positif ou nul.", index, chapter));
  }

  if (
    chapter.endTime !== null &&
    chapter.endTime !== undefined &&
    (!Number.isFinite(chapter.endTime) || chapter.endTime < chapter.startTime)
  ) {
    errors.push(createValidationError("INVALID_END_TIME", "La fin du chapitre ne peut pas précéder son début.", index, chapter));
  }

  if (!CHAPTER_ORIGINS.has(chapter.origin)) {
    errors.push(createValidationError("INVALID_ORIGIN", "L’origine du chapitre n’est pas reconnue.", index, chapter));
  }

  return errors;
}

function validateChapterList(chapters) {
  const errors = chapters.flatMap(validateChapter);
  const knownIds = new Set();

  chapters.forEach((chapter, index) => {
    if (!isChapterObject(chapter) || typeof chapter.id !== "string" || !chapter.id.trim()) {
      return;
    }

    if (knownIds.has(chapter.id)) {
      errors.push(createValidationError(
        "DUPLICATE_ID",
        `L’identifiant « ${chapter.id} » est utilisé par plusieurs chapitres.`,
        index,
        chapter
      ));
    }

    knownIds.add(chapter.id);
  });

  return { valid: errors.length === 0, errors };
}

function assertValidChapters(chapters) {
  const validation = validateChapterList(chapters);

  if (!validation.valid) {
    throw new ChapterEngineError(
      "INVALID_CHAPTERS",
      `Les chapitres sont invalides : ${validation.errors.map((error) => error.message).join(" ")}`,
      validation.errors
    );
  }
}

function assertPlaybackTime(time) {
  if (!Number.isFinite(time) || time < 0) {
    throw new ChapterEngineError("INVALID_TIME", "Le temps de lecture doit être positif ou nul.");
  }
}

function activeChapterIndexAt(chapters, time) {
  for (let index = chapters.length - 1; index >= 0; index -= 1) {
    const chapter = chapters[index];

    if (time < chapter.startTime) {
      continue;
    }

    const nextStartTime = chapters[index + 1]?.startTime ?? Number.POSITIVE_INFINITY;
    const endTime = chapter.endTime ?? nextStartTime;

    if (time < endTime) {
      return index;
    }
  }

  return -1;
}

function copyResult(chapter) {
  return chapter ? { ...chapter } : null;
}

/**
 * Crée une façade isolant toutes les lectures et mutations de chapitres.
 * Les intervalles temporels sont semi-ouverts : début inclus, fin exclue.
 */
export function createChapterEngine(chapters = []) {
  if (!Array.isArray(chapters)) {
    throw new ChapterEngineError("INVALID_COLLECTION", "Les chapitres doivent être fournis dans un tableau.");
  }

  let state = chapters.map(cloneChapter);

  function normalizedState() {
    return normalizeChapterList(state);
  }

  function validState() {
    const normalized = normalizedState();
    assertValidChapters(normalized);
    return normalized;
  }

  function snapshot(chapterList = validState()) {
    return chapterList.map((chapter) => ({ ...chapter }));
  }

  function commit(chapterList) {
    const normalized = normalizeChapterList(chapterList);
    assertValidChapters(normalized);
    state = normalized.map(cloneChapter);
    return snapshot(normalized);
  }

  function findIndexById(chapterList, id) {
    return chapterList.findIndex((chapter) => chapter.id === id);
  }

  function activeAt(time) {
    assertPlaybackTime(time);
    const chaptersByTime = validState();
    return copyResult(chaptersByTime[activeChapterIndexAt(chaptersByTime, time)]);
  }

  function previous(time) {
    assertPlaybackTime(time);
    const chaptersByTime = validState();
    const activeIndex = activeChapterIndexAt(chaptersByTime, time);

    if (activeIndex !== -1) {
      return copyResult(chaptersByTime[activeIndex - 1]);
    }

    const previousChapters = chaptersByTime.filter((chapter) => chapter.startTime < time);
    return copyResult(previousChapters.at(-1));
  }

  function next(time) {
    assertPlaybackTime(time);
    const chaptersByTime = validState();
    const activeIndex = activeChapterIndexAt(chaptersByTime, time);

    if (activeIndex !== -1) {
      return copyResult(chaptersByTime[activeIndex + 1]);
    }

    return copyResult(chaptersByTime.find((chapter) => chapter.startTime > time));
  }

  function findById(id) {
    return copyResult(validState().find((chapter) => chapter.id === id));
  }

  function insert(chapter) {
    return commit([...state, cloneChapter(chapter)]);
  }

  function remove(id) {
    const chapterList = validState();
    const index = findIndexById(chapterList, id);

    if (index === -1) {
      throw new ChapterEngineError("CHAPTER_NOT_FOUND", `Aucun chapitre ne correspond à l’identifiant « ${id} ».`);
    }

    return commit(chapterList.filter((_, chapterIndex) => chapterIndex !== index));
  }

  function rename(id, title) {
    const chapterList = validState();
    const index = findIndexById(chapterList, id);

    if (index === -1) {
      throw new ChapterEngineError("CHAPTER_NOT_FOUND", `Aucun chapitre ne correspond à l’identifiant « ${id} ».`);
    }

    const renamedChapter = { ...chapterList[index], title };
    const nextChapters = chapterList.map((chapter, chapterIndex) => {
      return chapterIndex === index ? renamedChapter : chapter;
    });

    return commit(nextChapters);
  }

  function normalize() {
    state = normalizedState().map(cloneChapter);
    return state.map(cloneChapter);
  }

  function validate() {
    return validateChapterList(normalizedState());
  }

  function toJSON() {
    return snapshot();
  }

  return Object.freeze({
    activeAt,
    previous,
    next,
    findById,
    insert,
    remove,
    rename,
    normalize,
    validate,
    toJSON,
  });
}
