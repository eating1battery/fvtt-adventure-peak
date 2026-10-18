import { enabled, MODULE_ID } from "../settings.mjs";
import { calculateSides, compareSides, SIDES } from "../rules/initiative.mjs";

export function sideOf(combatant) {
  const assigned = combatant.getFlag(MODULE_ID, "side");
  if (SIDES.includes(assigned)) return assigned;
  if (combatant.actor?.type === "character") return "friendly";
  if (combatant.actor?.type === "npc") return "hostile";
  return undefined;
}

export function formatTotal(total) {
  return new Intl.NumberFormat(game.i18n?.lang ?? "en", { maximumFractionDigits: 0 }).format(total);
}

export async function assignSide(combat, combatants, side) {
  if (!enabled("sideInitiative") || !game.user.isGM) throw new Error("Only the DM can assign combat sides.");
  if (!SIDES.includes(side)) throw new Error("Choose a friendly or hostile side.");
  // Before combat, changed assignments invalidate any previously calculated totals.
  if (!combat.started && combat.getFlag(MODULE_ID, "initiative")) await combat.unsetFlag(MODULE_ID, "initiative");
  await combat.updateEmbeddedDocuments("Combatant", combatants.map(c => ({
    _id: c.id, [`flags.${MODULE_ID}.side`]: side
  })), { turnEvents: false });
}

/** Extend the configured system class rather than replacing dnd5e's recovery hooks. */
export function createCombatClass(BaseCombat) {
  return class AdventurepeakCombat extends BaseCombat {
    createGroups() {
      const groups = super.createGroups();
      if (!enabled("sideInitiative")) return groups;
      const split = new Map();
      for (const [key, group] of groups) {
        for (const combatant of group.combatants) {
          const sideKey = `${key}:adventurepeak:${sideOf(combatant) ?? "unassigned"}`;
          if (!split.has(sideKey)) split.set(sideKey, {
            ...group, combatants: [], expanded: this.expandedGroups.has(sideKey)
          });
          split.get(sideKey).combatants.push(combatant);
        }
      }
      return split;
    }

    _sortCombatants(a, b) {
      const state = a.parent?.getFlag(MODULE_ID, "initiative");
      if (enabled("sideInitiative") && state) {
        const result = compareSides({ side: sideOf(a) }, { side: sideOf(b) }, state.order);
        if (result) return result;
      }
      return super._sortCombatants(a, b);
    }

    async establishSides() {
      if (!enabled("sideInitiative") || !game.user.isGM) throw new Error("Only the DM can establish side initiative.");
      if (this.started) throw new Error("Side totals are fixed once combat starts.");
      const state = calculateSides(this.combatants.contents.map(c => ({
        side: sideOf(c), initiative: c.initiative
      })));
      await this.setFlag(MODULE_ID, "initiative", state);
      this.setupTurns();
      ui.combat.render();
      return state;
    }

    async startCombat() {
      if (enabled("sideInitiative")) {
        if (!game.user.isGM) throw new Error("Only the DM can start side initiative combat.");
        if (!this.getFlag(MODULE_ID, "initiative")) await this.establishSides();
        // A snapshot may have been prepared before the start button was pressed.
        // Recheck assignments/rolls, but preserve its totals and any explicit swap.
        calculateSides(this.combatants.contents.map(c => ({ side: sideOf(c), initiative: c.initiative })));
      }
      return super.startCombat();
    }

    async swapSideOrder() {
      if (!enabled("sideInitiative") || !game.user.isGM) throw new Error("Only the DM can swap side initiative.");
      const state = this.getFlag(MODULE_ID, "initiative");
      if (!state) throw new Error("Establish side initiative first.");
      if (this.started) {
        // Preserve current turns and apply the new order at a round boundary.
        await this.setFlag(MODULE_ID, "pendingOrder", [...state.order].reverse());
        ui.notifications.info("Adventurepeak: side order will swap next round.");
      } else {
        await this.setFlag(MODULE_ID, "initiative", { ...state, order: [...state.order].reverse() });
        this.setupTurns();
        ui.combat.render();
      }
    }

    async nextRound() {
      const pending = this.getFlag(MODULE_ID, "pendingOrder");
      if (enabled("sideInitiative") && pending && game.user.isGM) {
        const state = this.getFlag(MODULE_ID, "initiative");
        const turn = this.turn === null || !this.turns.length ? null : 0;
        const round = this.round + 1;
        const updateData = {
          round, turn,
          [`flags.${MODULE_ID}.initiative`]: { ...state, order: pending },
          [`flags.${MODULE_ID}.-=pendingOrder`]: null
        };
        const options = { direction: 1, worldTime: { delta: this.getTimeDelta(this.round, this.turn, round, turn) } };
        Hooks.callAll("combatRound", this, updateData, options);
        await this.update(updateData, options);
        return this;
      }
      return super.nextRound();
    }

    _onUpdate(changed, options, userId) {
      // Keep remote clients' prepared order in sync with persisted flags.
      if (changed.flags?.[MODULE_ID]?.initiative) {
        const previousCurrent = this.current;
        this.setupTurns();
        this.current = previousCurrent;
      }
      return super._onUpdate(changed, options, userId);
    }
  };
}

function report(error) {
  console.error("Adventurepeak |", error);
  ui.notifications.error(`Adventurepeak: ${error.message}`);
}

export function renderSideControls(app, html) {
  if (!enabled("sideInitiative") || !app.viewed) return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;
  const combat = app.viewed;
  root.querySelectorAll(".adventurepeak-sides, .adventurepeak-side-select, .adventurepeak-side-buttons")
    .forEach(el => el.remove());
  root.querySelectorAll(".adventurepeak-controls-row").forEach(el => el.replaceWith(...el.childNodes));
  const panel = document.createElement("div");
  panel.className = "adventurepeak-sides";
  const state = combat.getFlag(MODULE_ID, "initiative");
  const summary = document.createElement("span");
  // Totals can reveal hidden enemies; retain hidden information for the DM only.
  summary.textContent = state
    ? game.user.isGM
      ? `Friendly ${formatTotal(state.totals.friendly)} · Hostile ${formatTotal(state.totals.hostile)} · ${state.order[0]} first`
      : `${state.order[0]} side acts first`
    : "Side initiative: awaiting DM assignments and rolls";
  panel.append(summary);
  if (game.user.isGM) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = combat.started ? "Swap sides next round" : "Calculate side initiative";
    button.addEventListener("click", () => {
      button.disabled = true;
      Promise.resolve(combat.started ? combat.swapSideOrder() : combat.establishSides())
        .catch(report).finally(() => { button.disabled = false; });
    });
    panel.append(button);
    const addButtons = (container, combatants, label) => {
      const buttons = document.createElement("span");
      buttons.className = "adventurepeak-side-buttons";
      buttons.setAttribute("role", "group");
      buttons.setAttribute("aria-label", `Side for ${label}`);
      const sides = new Set(combatants.map(sideOf));
      const selected = sides.size === 1 ? sideOf(combatants[0]) : undefined;
      // Keep native controls and group headers from handling assignment clicks.
      for (const type of ["click", "pointerdown", "dblclick"]) {
        buttons.addEventListener(type, event => event.stopPropagation());
      }
      for (const side of SIDES) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "inline-control adventurepeak-side-button";
        button.dataset.side = side;
        button.title = `Assign ${side}: ${label}`;
        button.setAttribute("aria-label", button.title);
        button.setAttribute("aria-pressed", String(selected === side));
        const icon = document.createElement("i");
        icon.className = `fa-solid ${side === "friendly" ? "fa-handshake" : "fa-skull-crossbones"}`;
        icon.setAttribute("aria-hidden", "true");
        button.append(icon);
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const controls = Array.from(buttons.querySelectorAll("button"));
          controls.forEach(control => { control.disabled = true; });
          assignSide(combat, combatants, side).then(() => {
            controls.forEach(control => control.setAttribute("aria-pressed", String(control.dataset.side === side)));
          }).catch(report).finally(() => { controls.forEach(control => { control.disabled = false; }); });
        });
        buttons.append(button);
      }
      const existing = container.querySelector(".combatant-controls");
      if (existing) {
        const row = document.createElement("div");
        row.className = "adventurepeak-controls-row";
        const separator = document.createElement("span");
        separator.className = "adventurepeak-controls-separator";
        separator.textContent = "|";
        separator.setAttribute("aria-hidden", "true");
        buttons.prepend(separator);
        existing.replaceWith(row);
        row.append(existing, buttons);
      } else {
        (container.querySelector(".token-name") ?? container).append(buttons);
      }
    };
    for (const c of combat.combatants) {
      const row = root.querySelector(`[data-combatant-id="${c.id}"]`);
      if (row) addButtons(row, [c], c.name);
    }
    // dnd5e's visual groups are wrappers without a combatant ID of their own.
    for (const row of root.querySelectorAll(".combatant-group")) {
      const members = Array.from(row.querySelectorAll("[data-combatant-id]"), element =>
        combat.combatants.get(element.dataset.combatantId)).filter(Boolean);
      const header = row.querySelector(".group-header");
      if (header && members.length) addButtons(header, members, "this entire group");
    }
  }
  root.prepend(panel);
}

export function registerCombatHooks() {
  Hooks.on("renderCombatTracker", renderSideControls);
}
