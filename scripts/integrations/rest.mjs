import { enabled } from "../settings.mjs";
import { adjustRestSlots, recoverSlots } from "../rules/rest.mjs";

// Session state stays local to the client running the native rest workflow.
const sessions = new WeakMap();

export function prepareShortRest(actor, config) {
  if (!enabled("restRules")) return;
  config.duration = 60; // dnd5e rest durations are minutes.
  config.adventurepeakRecoverSlots ??= true;
  sessions.set(actor, config);
}

export function prepareLongRest(actor, config) {
  if (!enabled("restRules")) return;
  const request = config.request;
  const gmRequest = request?.author?.isGM && game.messages.get(request.id) === request
    && request.system?.handler === "rest" && request.system.data?.type === "long"
    && request.system.targets?.some(target => target.actor === actor.uuid && !target.result);
  if (!game.user.isGM && !gmRequest) {
    ui.notifications.warn("Adventurepeak: the DM must authorize a long rest. Ask the DM to initiate or request it.");
    return false;
  }
  // Use the system's existing recovery calculation with the 2014 fraction.
  config.fraction = 0.5;
  delete config.maxHitDice;
}

export function recoverHitDieSlots(_rolls, { subject: actor, updates }) {
  const config = sessions.get(actor);
  if (!enabled("restRules") || !config || config.adventurepeakRecoverSlots === false) return;
  // A roll configured without spending a die must not grant slot recovery.
  const spent = Object.keys(updates.class ?? {}).some(k => k === "system.hd.spent")
    || Object.keys(updates.actor ?? {}).some(k => k === "system.attributes.hd.spent");
  if (!spent) return;
  Object.assign(updates.actor, recoverSlots(actor.system.spells, 2));
}

export function prepareRestResult(actor, result, config) {
  if (!enabled("restRules")) return;
  // The system's merge helpers may expand paths; flatten before removing native refills.
  result.updateData = adjustRestSlots(actor.system.spells,
    foundry.utils.flattenObject(result.updateData), { shortRest: config.type === "short" });
}

export function renderRestDialog(app, html) {
  if (!enabled("restRules") || app.config?.type !== "short") return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || root.querySelector(".adventurepeak-rest")) return;
  const container = document.createElement("div");
  container.className = "adventurepeak-rest";
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = "adventurepeakRecoverSlots";
  checkbox.checked = app.config.adventurepeakRecoverSlots !== false;
  checkbox.addEventListener("change", () => {
    app.config.adventurepeakRecoverSlots = checkbox.checked;
  });
  label.append(checkbox, document.createTextNode("Automatically restore spell slots"));
  container.append(label);
  (root.querySelector('[data-application-part="content"]') ?? root.querySelector("section") ?? root).append(container);
  sessions.set(app.actor, app.config);
}

export function registerRestHooks() {
  Hooks.on("dnd5e.preShortRest", prepareShortRest);
  Hooks.on("dnd5e.preLongRest", prepareLongRest);
  Hooks.on("dnd5e.rollHitDie", recoverHitDieSlots);
  Hooks.on("dnd5e.preRestCompleted", prepareRestResult);
  Hooks.on("dnd5e.restCompleted", actor => sessions.delete(actor));
  Hooks.on("renderShortRestDialog", renderRestDialog);
  Hooks.on("closeShortRestDialog", app => {
    if (!app.rested) sessions.delete(app.actor);
  });
}
