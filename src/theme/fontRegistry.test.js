import assert from "node:assert/strict";
import test from "node:test";

import {
  FONT_REGISTRY,
  getFontOptions,
  normalizeTypography,
  resolveFontStack,
} from "./fontRegistry.module.mjs";

test("expose les sept piles de polices système attendues", () => {
  assert.deepEqual(Object.keys(FONT_REGISTRY), [
    "system",
    "helvetica",
    "georgia",
    "verdana",
    "trebuchet",
    "times",
    "mono",
  ]);
  assert.equal(getFontOptions().length, 7);
});

test("normalise une typographie absente ou inconnue", () => {
  assert.deepEqual(normalizeTypography(), { heading: "system", body: "system" });
  assert.deepEqual(normalizeTypography({ heading: "unknown", body: null }), {
    heading: "system",
    body: "system",
  });
});

test("conserve uniquement les identifiants reconnus", () => {
  assert.deepEqual(normalizeTypography({ heading: "georgia", body: "verdana", extra: "ignored" }), {
    heading: "georgia",
    body: "verdana",
  });
  assert.equal(resolveFontStack("georgia"), FONT_REGISTRY.georgia);
  assert.equal(resolveFontStack("unknown"), FONT_REGISTRY.system);
});
