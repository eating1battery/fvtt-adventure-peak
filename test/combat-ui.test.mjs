import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderSideControls, sideOf, createCombatClass, assignSide, formatTotal }
  from "../scripts/integrations/combat.mjs";
import { calculateSides } from "../scripts/rules/initiative.mjs";

globalThis.game = { settings: { get: () => true }, user: { isGM: true }, i18n: { lang: "en" } };
globalThis.ui = { notifications: { error(message) { throw new Error(message); } } };

function combatant(id, type, side) {
  return { id, name: id, actor: { type }, side,
    getFlag() { return this.side; } };
}

test("characters default friendly, NPCs hostile, and DM overrides take priority", () => {
  assert.equal(sideOf(combatant("pc", "character")), "friendly");
  assert.equal(sideOf(combatant("npc", "npc")), "hostile");
  assert.equal(sideOf(combatant("ally", "npc", "friendly")), "friendly");
  assert.equal(sideOf(combatant("enemy", "character", "hostile")), "hostile");
  assert.equal(sideOf(combatant("vehicle", "vehicle")), undefined);
});

test("fractional totals decide the winner while the displayed sums use whole numbers", () => {
  const state = calculateSides([
    { side: "friendly", initiative: 10.1 }, { side: "hostile", initiative: 10.2 }
  ]);
  assert.deepEqual(state.order, ["hostile", "friendly"]);
  assert.equal(state.totals.friendly, 10.1);
  assert.equal(formatTotal(state.totals.friendly), "10");
  assert.equal(formatTotal(state.totals.hostile), "10");
  assert.equal(formatTotal(25.8), "26");
});

test("visual enemy groups split when members have different sides", () => {
  const enemy = combatant("enemy", "npc");
  const ally = combatant("ally", "npc", "friendly");
  class Base {
    expandedGroups = new Set(["g:adventurepeak:friendly"]);
    createGroups() { return new Map([["g", { combatants: [enemy, ally], expanded: false }]]); }
  }
  const groups = new (createCombatClass(Base))().createGroups();
  assert.equal(groups.size, 2);
  assert.deepEqual(groups.get("g:adventurepeak:hostile").combatants, [enemy]);
  assert.deepEqual(groups.get("g:adventurepeak:friendly").combatants, [ally]);
  assert.equal(groups.get("g:adventurepeak:friendly").expanded, true);
});

test("group side buttons update all members without collapsing, with individual controls beside native controls", async () => {
  const dom = new JSDOM(`<div id="tracker"><ol><li class="combatant-group">
    <div class="group-header">Enemies</div><div class="collapsible-content"><ol>
    <li data-combatant-id="a"><div class="token-name"><div class="combatant-controls"><button>Native</button></div></div></li><li data-combatant-id="b"><div class="token-name"><div class="combatant-controls"></div></div></li>
    </ol></div></li></ol></div>`);
  const { document, HTMLElement, MouseEvent } = dom.window;
  Object.assign(globalThis, { document, HTMLElement });
  const members = [combatant("a", "npc"), combatant("b", "npc")];
  members.get = id => members.find(c => c.id === id);
  let changes = [];
  const state = { totals: { friendly: 25.8, hostile: 27.2 }, order: ["hostile", "friendly"] };
  const combat = {
    combatants: members, started: true, getFlag: () => state,
    async updateEmbeddedDocuments(type, updates, options) {
      changes = updates;
      assert.equal(type, "Combatant");
      assert.equal(options.turnEvents, false);
      for (const update of updates) members.get(update._id).side = update["flags.adventurepeak.side"];
    }
  };
  const root = document.querySelector("#tracker");
  let collapsed = false;
  root.querySelector(".combatant-group").addEventListener("click", () => { collapsed = true; });
  renderSideControls({ viewed: combat }, root);
  const friendly = root.querySelector('.group-header button[data-side="friendly"]');
  const hostile = root.querySelector('.group-header button[data-side="hostile"]');
  assert.ok(friendly && hostile);
  assert.equal(friendly.disabled, false);
  assert.equal(hostile.getAttribute("aria-pressed"), "true");
  const native = root.querySelector('[data-combatant-id="a"] .combatant-controls');
  assert.ok(native.nextElementSibling.matches(".adventurepeak-side-buttons"));
  assert.equal(native.nextElementSibling.firstElementChild.textContent, "|");
  assert.equal(native.querySelector("button").textContent, "Native");
  assert.match(root.querySelector(".adventurepeak-sides").textContent, /Friendly 26 · Hostile 27/);
  friendly.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.equal(collapsed, false);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(changes.map(c => c._id), ["a", "b"]);
  assert.ok(members.every(c => sideOf(c) === "friendly"));
  assert.equal(state.totals.hostile, 27.2);
  renderSideControls({ viewed: combat }, root);
  assert.equal(root.querySelectorAll(".group-header .adventurepeak-side-buttons").length, 1);
  assert.equal(root.querySelector('.group-header button[data-side="friendly"]').getAttribute("aria-pressed"), "true");
  assert.equal(root.querySelectorAll("[data-combatant-id] .adventurepeak-side-buttons").length, 2);
  assert.equal(root.querySelectorAll(".adventurepeak-controls-row").length, 2);
  assert.equal(root.querySelectorAll("select").length, 0);
  const individualHostile = root.querySelector('[data-combatant-id="a"] button[data-side="hostile"]');
  individualHostile.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(changes.map(c => c._id), ["a"]);
  assert.equal(sideOf(members[0]), "hostile");
  assert.equal(sideOf(members[1]), "friendly");
  dom.window.close();
});

test("pre-combat side changes invalidate stale totals; players cannot assign sides", async () => {
  let invalidated = false;
  let updated = false;
  const combat = { started: false, getFlag: () => ({}),
    async unsetFlag() { invalidated = true; },
    async updateEmbeddedDocuments() { updated = true; }
  };
  await assignSide(combat, [combatant("a", "npc")], "friendly");
  assert.ok(invalidated && updated);
  game.user.isGM = false;
  try { await assert.rejects(() => assignSide(combat, [], "friendly"), /Only the DM/); }
  finally { game.user.isGM = true; }
});
