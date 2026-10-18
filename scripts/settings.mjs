export const MODULE_ID = "adventurepeak";

export function enabled(key) {
  return game.settings.get(MODULE_ID, key) === true;
}

export function registerSettings() {
  for (const key of ["restRules", "sideInitiative"]) {
    game.settings.register(MODULE_ID, key, {
      name: `ADVENTUREPEAK.Settings.${key}.Name`,
      hint: `ADVENTUREPEAK.Settings.${key}.Hint`,
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      requiresReload: true
    });
  }
}
