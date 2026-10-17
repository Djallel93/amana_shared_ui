// scripts/phone.test.mjs — `npm test` (Node ≥ 22.12 : type stripping pour importer le .ts)
import assert from "node:assert/strict";
import { test } from "node:test";
import { formaterTelephoneFr, lienTelephone } from "../src/lib/phone.ts";

test("formaterTelephoneFr normalise toutes les saisies françaises acceptées", () => {
  for (const tel of [
    "01 23 45 67 89",
    "0123456789",
    "+33 1 23 45 67 89",
    "+33123456789",
    "0033 1 23 45 67 89",
    "01.23.45.67.89",
    "01-23-45-67-89",
  ]) {
    assert.equal(formaterTelephoneFr(tel), "+33 1 23 45 67 89", tel);
  }
  assert.equal(formaterTelephoneFr("0612345678"), "+33 6 12 34 56 78");
});

test("formaterTelephoneFr laisse intact ce qu'il ne reconnaît pas et vide le vide", () => {
  assert.equal(formaterTelephoneFr(null), "");
  assert.equal(formaterTelephoneFr(undefined), "");
  assert.equal(formaterTelephoneFr("   "), "");
  assert.equal(formaterTelephoneFr("+44 20 7946 0958"), "+44 20 7946 0958");
  assert.equal(formaterTelephoneFr("06 12 34"), "06 12 34");
});

test("lienTelephone renvoie une valeur composable sans espace", () => {
  assert.equal(lienTelephone("01 23 45 67 89"), "+33123456789");
  assert.equal(lienTelephone("+33 6 12 34 56 78"), "+33612345678");
  assert.equal(lienTelephone("+44 20 7946 0958"), "+442079460958");
  assert.equal(lienTelephone(null), null);
  assert.equal(lienTelephone("abc"), null);
});
