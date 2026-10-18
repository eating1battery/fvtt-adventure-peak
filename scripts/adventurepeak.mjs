import { enabled, MODULE_ID, registerSettings } from "./settings.mjs";
import { registerRestHooks } from "./integrations/rest.mjs";
import { createCombatClass, registerCombatHooks } from "./integrations/combat.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerRestHooks();
  registerCombatHooks();
  if (enabled("sideInitiative")) CONFIG.Combat.documentClass = createCombatClass(CONFIG.Combat.documentClass);
});

Hooks.once("ready", () => {
  function sideCombat(combat) {
    if (!enabled("sideInitiative")) throw new Error("Enable Side Initiative and reload before using its API.");
    const target = combat ?? game.combat;
    if (!target) throw new Error("Select a combat encounter first.");
    return target;
  }
  game.modules.get(MODULE_ID).api = Object.freeze({
    establishSides: combat => sideCombat(combat).establishSides(),
    swapSideOrder: combat => sideCombat(combat).swapSideOrder()
  });
});
