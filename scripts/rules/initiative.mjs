export const SIDES = ["friendly", "hostile"];

/** Validate explicit DM assignments and freeze the initial rolled totals. */
export function calculateSides(combatants) {
  if (!combatants.length) throw new Error("Add combatants before establishing side initiative.");
  const totals = { friendly: 0, hostile: 0 };
  for (const combatant of combatants) {
    if (!SIDES.includes(combatant.side)) throw new Error("The DM must assign every combatant to a side.");
    if (!Number.isFinite(combatant.initiative)) throw new Error("Every combatant must roll initiative first.");
    totals[combatant.side] += combatant.initiative;
  }
  const order = totals.friendly >= totals.hostile ? ["friendly", "hostile"] : ["hostile", "friendly"];
  return { totals, order };
}

export function compareSides(a, b, order) {
  const rank = side => order.indexOf(side) < 0 ? order.length : order.indexOf(side);
  return rank(a.side) - rank(b.side);
}
