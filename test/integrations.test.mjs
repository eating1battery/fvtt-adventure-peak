import test from "node:test";
import assert from "node:assert/strict";
import { prepareShortRest, prepareLongRest, recoverHitDieSlots, prepareRestResult }
  from "../scripts/integrations/rest.mjs";
import { createCombatClass } from "../scripts/integrations/combat.mjs";
import { registerSettings } from "../scripts/settings.mjs";

const settings = { restRules: false, sideInitiative: false };
globalThis.game = { settings: { get: (_scope, key) => settings[key] }, user: { isGM: true },
  messages: new Map() };
globalThis.ui = { notifications: { warn() {}, info() {} }, combat: { render() {} } };
globalThis.foundry = { utils: { flattenObject: object => ({ ...object }) } };

function actor() {
  return { uuid: "Actor.test", system: { attributes: { hp: { value: 20, max: 20 } },
    spells: { spell1: { value: 0, max: 4 } } } };
}

test("all four toggle combinations keep rest and combat behavior independent", async () => {
  let nativeStarts = 0;
  class Base {
    started = false;
    combatants = { contents: [{ initiative: 10, getFlag: () => "friendly" }] };
    flags = {};
    async startCombat() { nativeStarts++; return this; }
    async setFlag(_scope, key, value) { this.flags[key] = value; }
    getFlag(_scope, key) { return this.flags[key]; }
    setupTurns() {}
  }
  const Combat = createCombatClass(Base);
  for (const restRules of [false, true]) for (const sideInitiative of [false, true]) {
    Object.assign(settings, { restRules, sideInitiative });
    const a = actor();
    const config = { type: "short", duration: 5 };
    prepareShortRest(a, config);
    const updates = { actor: { "system.attributes.hp.value": 20 }, class: { "system.hd.spent": 1 } };
    recoverHitDieSlots([], { subject: a, updates });
    assert.equal(config.duration, restRules ? 60 : 5);
    assert.equal(updates.actor["system.spells.spell1.value"], restRules ? 2 : undefined);
    assert.equal(updates.actor["system.attributes.hp.value"], 20);
    const combat = new Combat();
    await combat.startCombat();
    assert.equal(Boolean(combat.flags.initiative), sideInitiative);
  }
  assert.equal(nativeStarts, 4);
});

test("unchecked recovery retains healing, and unspent die rolls grant no slots", () => {
  settings.restRules = true;
  const a = actor();
  const config = { adventurepeakRecoverSlots: false };
  prepareShortRest(a, config);
  const updates = { actor: { "system.attributes.hp.value": 20 }, class: { "system.hd.spent": 1 } };
  recoverHitDieSlots([], { subject: a, updates });
  assert.deepEqual(updates.actor, { "system.attributes.hp.value": 20 });
  config.adventurepeakRecoverSlots = true;
  const noSpend = { actor: {}, class: {} };
  recoverHitDieSlots([], { subject: a, updates: noSpend });
  assert.deepEqual(noSpend.actor, {});
});

test("Hit Dice outside a rest do not recover slots", () => {
  settings.restRules = true;
  const updates = { actor: {}, class: { "system.hd.spent": 1 } };
  recoverHitDieSlots([], { subject: actor(), updates });
  assert.deepEqual(updates.actor, {});
});

test("long rests require a DM or an existing DM-authored request; recover half Hit Dice", () => {
  settings.restRules = true;
  game.user.isGM = false;
  assert.equal(prepareLongRest(actor(), {}), false);
  assert.equal(prepareLongRest(actor(), { request: { id: "fake", author: { isGM: true } } }), false);
  const request = { id: "real", author: { isGM: true }, system: {
    handler: "rest", data: { type: "long" }, targets: [{ actor: "Actor.test", result: null }]
  } };
  game.messages.set(request.id, request);
  const config = { request, maxHitDice: 20 };
  assert.equal(prepareLongRest(actor(), config), undefined);
  assert.equal(config.fraction, 0.5);
  assert.equal(config.maxHitDice, undefined);
  request.system.data.type = "short";
  assert.equal(prepareLongRest(actor(), { request }), false);
  request.system.data.type = "long";
  request.system.targets[0].result = { id: "already-completed" };
  assert.equal(prepareLongRest(actor(), { request }), false);
  game.user.isGM = true;
  assert.equal(prepareLongRest(actor(), {}), undefined);
});

test("disabled rest rules leave native rest updates untouched", () => {
  settings.restRules = false;
  const result = { updateData: { "system.spells.spell1.value": 4 } };
  prepareRestResult(actor(), result, { type: "long" });
  assert.equal(result.updateData["system.spells.spell1.value"], 4);
});

test("both settings are world-scoped Booleans with reload requirements", () => {
  const registrations = [];
  game.settings.register = (...args) => registrations.push(args);
  registerSettings();
  assert.equal(registrations.length, 2);
  for (const [scope, , data] of registrations) {
    assert.equal(scope, "adventurepeak");
    assert.equal(data.scope, "world");
    assert.equal(data.type, Boolean);
    assert.equal(data.requiresReload, true);
  }
});
