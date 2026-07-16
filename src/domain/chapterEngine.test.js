import assert from "node:assert/strict";
import test from "node:test";

import { ChapterEngineError, createChapterEngine } from "./chapterEngine.module.mjs";

function chapter(id, title, startTime, endTime = null, origin = "manual") {
  return { id, title, startTime, endTime, origin };
}

const standardChapters = [
  chapter("chapter-1", "Introduction", 0, 10),
  chapter("chapter-2", "Entretien", 10, 20),
  chapter("chapter-3", "Conclusion", 20),
];

test("gère un tableau vide", () => {
  const engine = createChapterEngine([]);

  assert.deepEqual(engine.toJSON(), []);
  assert.equal(engine.activeAt(0), null);
  assert.equal(engine.previous(0), null);
  assert.equal(engine.next(0), null);
  assert.equal(engine.findById("missing"), null);
  assert.deepEqual(engine.validate(), { valid: true, errors: [] });
});

test("gère un chapitre unique et une fin exclusive", () => {
  const engine = createChapterEngine([chapter("only", "Chapitre unique", 5, 10)]);

  assert.equal(engine.activeAt(4.99), null);
  assert.equal(engine.activeAt(5).id, "only");
  assert.equal(engine.activeAt(9.99).id, "only");
  assert.equal(engine.activeAt(10), null);
});

test("trouve le chapitre actif et choisit le suivant à une frontière", () => {
  const engine = createChapterEngine(standardChapters);

  assert.equal(engine.activeAt(4).id, "chapter-1");
  assert.equal(engine.activeAt(10).id, "chapter-2");
  assert.equal(engine.activeAt(20).id, "chapter-3");
});

test("trouve les chapitres précédent et suivant", () => {
  const engine = createChapterEngine(standardChapters);

  assert.equal(engine.previous(10).id, "chapter-1");
  assert.equal(engine.next(10).id, "chapter-3");
  assert.equal(engine.previous(0), null);
  assert.equal(engine.next(20), null);
});

test("trouve les voisins depuis un espace sans chapitre actif", () => {
  const engine = createChapterEngine([
    chapter("first", "Premier", 0, 5),
    chapter("second", "Second", 10, 15),
  ]);

  assert.equal(engine.activeAt(7), null);
  assert.equal(engine.previous(7).id, "first");
  assert.equal(engine.next(7).id, "second");
});

test("le dernier chapitre sans fin reste actif", () => {
  const engine = createChapterEngine(standardChapters);

  assert.equal(engine.activeAt(20).id, "chapter-3");
  assert.equal(engine.activeAt(10_000).id, "chapter-3");
});

test("retrouve un chapitre par son identifiant", () => {
  const engine = createChapterEngine(standardChapters);

  assert.equal(engine.findById("chapter-2").title, "Entretien");
  assert.equal(engine.findById("unknown"), null);
});

test("insère un chapitre dans l’ordre chronologique", () => {
  const engine = createChapterEngine([
    chapter("first", "Premier", 0, 5),
    chapter("third", "Troisième", 20),
  ]);

  const result = engine.insert(chapter("second", "Deuxième", 10, 20));

  assert.deepEqual(result.map(({ id }) => id), ["first", "second", "third"]);
  assert.deepEqual(engine.toJSON().map(({ id }) => id), ["first", "second", "third"]);
});

test("supprime un chapitre", () => {
  const engine = createChapterEngine(standardChapters);
  const result = engine.remove("chapter-2");

  assert.deepEqual(result.map(({ id }) => id), ["chapter-1", "chapter-3"]);
  assert.equal(engine.findById("chapter-2"), null);
});

test("renomme et normalise le titre d’un chapitre", () => {
  const engine = createChapterEngine(standardChapters);
  engine.rename("chapter-2", "  Nouvel   entretien  ");

  assert.equal(engine.findById("chapter-2").title, "Nouvel entretien");
});

test("normalise l’ordre et les fins absentes", () => {
  const engine = createChapterEngine([
    { id: "late", title: " Fin ", startTime: 20, origin: "imported" },
    { id: "early", title: " Début ", startTime: 0, endTime: 10, origin: "imported" },
  ]);

  assert.deepEqual(engine.normalize(), [
    chapter("early", "Début", 0, 10, "imported"),
    chapter("late", "Fin", 20, null, "imported"),
  ]);
});

test("signale les identifiants dupliqués", () => {
  const engine = createChapterEngine([
    chapter("duplicate", "Premier", 0, 10),
    chapter("duplicate", "Second", 10, 20),
  ]);
  const validation = engine.validate();

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(({ code }) => code === "DUPLICATE_ID"));
});

test("signale un titre vide", () => {
  const validation = createChapterEngine([chapter("empty", "   ", 0)]).validate();

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(({ code }) => code === "INVALID_TITLE"));
});

test("signale les temps invalides", () => {
  const validation = createChapterEngine([
    chapter("negative", "Négatif", -1),
    chapter("text", "Texte", "10"),
  ]).validate();

  assert.equal(validation.valid, false);
  assert.equal(validation.errors.filter(({ code }) => code === "INVALID_START_TIME").length, 2);
});

test("signale une fin antérieure au début", () => {
  const validation = createChapterEngine([chapter("invalid-end", "Fin invalide", 20, 10)]).validate();

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(({ code }) => code === "INVALID_END_TIME"));
});

test("rejette une origine inconnue", () => {
  const validation = createChapterEngine([chapter("origin", "Origine", 0, null, "external")]).validate();

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(({ code }) => code === "INVALID_ORIGIN"));
});

test("rejette un temps de lecture invalide", () => {
  const engine = createChapterEngine(standardChapters);

  assert.throws(() => engine.activeAt(-1), (error) => {
    return error instanceof ChapterEngineError && error.code === "INVALID_TIME";
  });
});

test("préserve les données d’origine et protège son état interne", () => {
  const original = standardChapters.map((item) => Object.freeze({ ...item }));
  const originalSnapshot = structuredClone(original);
  const engine = createChapterEngine(Object.freeze(original));

  const inserted = chapter("inserted", "Inséré", 15, 20);
  engine.insert(Object.freeze(inserted));
  engine.rename("chapter-1", "Introduction renommée");
  engine.remove("chapter-2");

  assert.deepEqual(original, originalSnapshot);
  assert.deepEqual(inserted, chapter("inserted", "Inséré", 15, 20));

  const exported = engine.toJSON();
  exported[0].title = "Mutation externe";
  assert.equal(engine.toJSON()[0].title, "Introduction renommée");
});

test("retourne une structure sérialisable", () => {
  const serialized = JSON.stringify(createChapterEngine(standardChapters).toJSON());

  assert.equal(typeof serialized, "string");
  assert.ok(serialized.includes("chapter-1"));
});
