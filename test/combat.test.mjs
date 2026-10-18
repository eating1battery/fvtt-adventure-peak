import test from "node:test";
import assert from "node:assert/strict";
import { createCombatClass } from "../scripts/integrations/combat.mjs";

globalThis.game = { settings: { get: () => true }, user: { isGM: true } };
globalThis.ui = { combat: { render() {} }, notifications: { info() {} } };
globalThis.Hooks = { callAll() {} };

class NativeCombat {
  flags = {};
  round = 0;
  turn = null;
  turns = [];
  current = {};
  combatants = { contents: [] };
  get started() { return this.round > 0; }
  getFlag(_scope, key) { return this.flags[key]; }
  async setFlag(_scope, key, value) {
    this.flags[key] = structuredClone(value);
    this._onUpdate({ flags: { adventurepeak: { [key]: value } } }, {}, "gm");
  }
  setupTurns() {
    this.turns = [...this.combatants.contents].sort(this._sortCombatants);
    this.current = { round: this.round, turn: this.turn, combatantId: this.turns[this.turn]?.id };
  }
  _sortCombatants(a, b) { return b.initiative - a.initiative; }
  _onUpdate() { this.current = { round: this.round, turn: this.turn, combatantId: this.turns[this.turn]?.id }; }
  async startCombat() { this.round = 1; this.turn = 0; this.setupTurns(); return this; }
  async nextRound() { this.round++; this.turn = 0; this.setupTurns(); return this; }
  getTimeDelta() { return 6; }
  async update(data, options) {
    this.lastUpdate = { data, options };
    this.round = data.round ?? this.round;
    if ("turn" in data) this.turn = data.turn;
    if (data["flags.adventurepeak.initiative"]) this.flags.initiative = data["flags.adventurepeak.initiative"];
    if ("flags.adventurepeak.-=pendingOrder" in data) delete this.flags.pendingOrder;
    this._onUpdate({ flags: { adventurepeak: { initiative: this.flags.initiative } } }, options, "gm");
  }
}
const Combat = createCombatClass(NativeCombat);

function makeCombat() {
  const combat = new Combat();
  combat.combatants.contents = [["a", "friendly", 18], ["b", "friendly", 7],
    ["c", "hostile", 14], ["d", "hostile", 13]].map(([id, side, initiative]) => ({
      id, initiative, parent: combat, getFlag: () => side
    }));
  return combat;
}

test("system combat class remains in the inheritance chain and individual rolls survive sorting", async () => {
  const combat = makeCombat();
  await combat.startCombat();
  assert.ok(combat instanceof NativeCombat);
  assert.deepEqual(combat.turns.map(c => c.id), ["c", "d", "a", "b"]);
  assert.deepEqual(combat.combatants.contents.map(c => c.initiative), [18, 7, 14, 13]);
});

test("joining, leaving, or rerolling cannot recalculate established totals during combat", async () => {
  const combat = makeCombat();
  await combat.startCombat();
  const snapshot = structuredClone(combat.flags.initiative);
  combat.combatants.contents[0].initiative = 100;
  combat.combatants.contents.pop();
  combat.combatants.contents.push({ id: "new", initiative: 200, parent: combat, getFlag: () => "friendly" });
  combat.setupTurns();
  assert.deepEqual(combat.flags.initiative, snapshot);
  assert.equal(combat.turns[0].getFlag(), "hostile");
  await assert.rejects(() => combat.establishSides(), /fixed/);
});

test("DM side swaps preserve totals and apply atomically at the next round", async () => {
  const combat = makeCombat();
  await combat.startCombat();
  const totals = structuredClone(combat.flags.initiative.totals);
  await combat.swapSideOrder();
  assert.deepEqual(combat.flags.initiative.order, ["hostile", "friendly"]);
  await combat.nextRound();
  assert.deepEqual(combat.flags.initiative.order, ["friendly", "hostile"]);
  assert.deepEqual(combat.flags.initiative.totals, totals);
  assert.equal(combat.round, 2);
  assert.equal(combat.flags.pendingOrder, undefined);
  assert.equal(combat.turns[0].getFlag(), "friendly");
  assert.equal(combat.lastUpdate.options.worldTime.delta, 6);
});

test("players cannot freeze totals or swap side order", async () => {
  game.user.isGM = false;
  try {
    await assert.rejects(() => makeCombat().establishSides(), /Only the DM/);
    await assert.rejects(() => makeCombat().swapSideOrder(), /Only the DM/);
  } finally { game.user.isGM = true; }
});

test("an existing sum-based encounter can convert once without changing the active creature", async () => {
  const combat = makeCombat();
  combat.flags.initiative = { totals: { friendly: 25, hostile: 27 }, order: ["hostile", "friendly"] };
  combat.round = 1;
  combat.turn = 1;
  combat.setupTurns();
  Object.defineProperty(combat, "combatant", { get() { return this.turns[this.turn]; } });
  const active = combat.combatant.id;
  await combat.establishSides();
  assert.deepEqual(combat.flags.initiative.averages, { friendly: 12.5, hostile: 13.5 });
  assert.equal(combat.combatant.id, active);
  assert.equal(combat.lastUpdate.options.turnEvents, false);
  await assert.rejects(() => combat.establishSides(), /fixed/);
});
