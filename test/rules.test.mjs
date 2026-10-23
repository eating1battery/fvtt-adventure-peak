import test from "node:test";
import assert from "node:assert/strict";
import { recoverSlots, adjustRestSlots } from "../scripts/rules/rest.mjs";
import { calculateSides } from "../scripts/rules/initiative.mjs";

test("Hit Dice recover two slots lowest first, crossing levels without mutating input", () => {
  const spells = { spell1: { value: 3, max: 4 }, spell2: { value: 0, max: 3 } };
  assert.deepEqual(recoverSlots(spells, 2), {
    "system.spells.spell1.value": 4, "system.spells.spell2.value": 1
  });
  assert.equal(spells.spell1.value, 3);
});

test("recovery reaches 9th level and excludes Pact Magic", () => {
  assert.deepEqual(recoverSlots({ spell9: { value: 0, max: 1 }, pact: { value: 0, max: 4 } }, 2), {
    "system.spells.spell9.value": 1
  });
});

test("one die restores a 3rd and 4th level slot when lower slots are full", () => {
  assert.deepEqual(recoverSlots({
    spell1: { value: 4, max: 4 }, spell3: { value: 2, max: 3 }, spell4: { value: 1, max: 2 }
  }, 2), { "system.spells.spell3.value": 3, "system.spells.spell4.value": 2 });
});

test("full or missing spell pools grant nothing and malformed counts fail", () => {
  assert.deepEqual(recoverSlots(undefined, 2), {});
  assert.deepEqual(recoverSlots({ spell1: { value: 4, max: 4 } }, 2), {});
  assert.throws(() => recoverSlots({}, -1), RangeError);
  assert.throws(() => recoverSlots({}, 0.5), RangeError);
});

test("long rest preserves all native spell refills, healing, and resources", () => {
  const updates = { "system.spells.spell1.value": 4, "system.spells.pact.value": 4,
    "system.attributes.hp.value": 40, "system.resources.primary.value": 3 };
  assert.deepEqual(adjustRestSlots({}, updates, { shortRest: false }), {
    "system.spells.spell1.value": 4, "system.spells.pact.value": 4,
    "system.attributes.hp.value": 40, "system.resources.primary.value": 3
  });
});

test("Pact Magic recovers two automatically and never exceeds capacity", () => {
  assert.equal(adjustRestSlots({ pact: { value: 0, max: 4 } }, {}, { shortRest: true })
    ["system.spells.pact.value"], 2);
  assert.equal(adjustRestSlots({ pact: { value: 3, max: 4 } }, {}, { shortRest: true })
    ["system.spells.pact.value"], 4);
});

test("initiative compares per-combatant averages", () => {
  assert.deepEqual(calculateSides([
    { side: "friendly", initiative: 18 }, { side: "friendly", initiative: 7 },
    { side: "hostile", initiative: 14 }, { side: "hostile", initiative: 13 }
  ]), { method: "average", totals: { friendly: 25, hostile: 27 }, counts: { friendly: 2, hostile: 2 },
    averages: { friendly: 12.5, hostile: 13.5 }, order: ["hostile", "friendly"] });
});

test("friendly wins ties, including negative initiative results", () => {
  assert.deepEqual(calculateSides([
    { side: "friendly", initiative: -2 }, { side: "hostile", initiative: -2 }
  ]).order, ["friendly", "hostile"]);
});

test("missing assignments or unrolled combatants prevent freezing totals", () => {
  assert.throws(() => calculateSides([]), /Add combatants/);
  assert.throws(() => calculateSides([{ initiative: 10 }]), /assign/);
  assert.throws(() => calculateSides([{ side: "friendly", initiative: null }]), /roll/);
});


test("a larger side does not win just because its sum is higher", () => {
  const state = calculateSides([
    { side: "friendly", initiative: 18 },
    { side: "hostile", initiative: 10 }, { side: "hostile", initiative: 10 }
  ]);
  assert.deepEqual(state.averages, { friendly: 18, hostile: 10 });
  assert.deepEqual(state.order, ["friendly", "hostile"]);
});

test("an empty side has no average and cannot beat a populated side", () => {
  const state = calculateSides([{ side: "hostile", initiative: -2 }]);
  assert.equal(state.averages.friendly, null);
  assert.deepEqual(state.order, ["hostile", "friendly"]);
});
