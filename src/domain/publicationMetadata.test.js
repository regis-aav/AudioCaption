import assert from "node:assert/strict";
import test from "node:test";

import {
  formatEpisodeDuration,
  formatPublicationDate,
  normalizePublicationDate,
  normalizeTakeaways,
} from "./publicationMetadata.module.mjs";

test("normalise et formate une date de publication", () => {
  assert.equal(normalizePublicationDate("2026-07-21"), "2026-07-21");
  assert.equal(formatPublicationDate("2026-07-21", "fr"), "21 juillet 2026");
});

test("utilise la date de création comme repli", () => {
  assert.equal(normalizePublicationDate("", "2025-04-03T10:30:00"), "2025-04-03");
});

test("utilise aujourd'hui lorsque aucune date exploitable n'existe", () => {
  assert.match(normalizePublicationDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test("formate la durée éditoriale sans modifier le temps du lecteur", () => {
  assert.equal(formatEpisodeDuration(222.9), "3 min 42");
  assert.equal(formatEpisodeDuration(180), "3 min");
  assert.equal(formatEpisodeDuration(Number.NaN), "");
});

test("normalise au maximum trois points à retenir", () => {
  assert.deepEqual(normalizeTakeaways([" Premier ", "", "Deuxième", 42, "Troisième", "Quatrième"]), [
    "Premier",
    "Deuxième",
    "Troisième",
  ]);
  assert.deepEqual(normalizeTakeaways(undefined), []);
});
