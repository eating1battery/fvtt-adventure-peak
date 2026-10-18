import { enabled, MODULE_ID } from "../settings.mjs";
import { calculateSides, compareSides, SIDES } from "../rules/initiative.mjs";

const sideOf = combatant => combatant.getFlag(MODULE_ID, "side");

/** Extend the configured system class rather than replacing dnd5e's recovery hooks. */
export function createCombatClass(BaseCombat) {
  return class AdventurepeakCombat extends BaseCombat {
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
  root.querySelectorAll(".adventurepeak-sides, .adventurepeak-side-select").forEach(el => el.remove());
  const panel = document.createElement("div");
  panel.className = "adventurepeak-sides";
  const state = combat.getFlag(MODULE_ID, "initiative");
  const summary = document.createElement("span");
  // Totals can reveal hidden enemies; retain hidden information for the DM only.
  summary.textContent = state
    ? game.user.isGM
      ? `Friendly ${state.totals.friendly} · Hostile ${state.totals.hostile} · ${state.order[0]} first`
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
    for (const c of combat.combatants) {
      const row = root.querySelector(`[data-combatant-id="${c.id}"]`);
      if (!row) continue;
      const select = document.createElement("select");
      select.className = "adventurepeak-side-select";
      select.setAttribute("aria-label", `Side for ${c.name}`);
      select.add(new Option("Assign side", ""));
      for (const side of SIDES) select.add(new Option(side === "friendly" ? "Friendly" : "Hostile", side));
      select.value = sideOf(c) ?? "";
      // Assign before starting. Late joiners can be assigned without changing totals.
      select.disabled = combat.started && SIDES.includes(sideOf(c));
      select.addEventListener("change", event => {
        event.stopPropagation();
        if (SIDES.includes(select.value)) c.setFlag(MODULE_ID, "side", select.value).catch(report);
      });
      row.append(select);
    }
  }
  root.prepend(panel);
}

export function registerCombatHooks() {
  Hooks.on("renderCombatTracker", renderSideControls);
}
