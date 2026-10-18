export const SIDES = ["friendly", "hostile"];

/** Freeze precise per-combatant averages; visual grouping never changes weighting. */
export function calculateSides(combatants) {
  if (!combatants.length) throw new Error("Add combatants before establishing side initiative.");
  const totals = { friendly: 0, hostile: 0 };
  const counts = { friendly: 0, hostile: 0 };
  for (const combatant of combatants) {
    if (!SIDES.includes(combatant.side)) throw new Error("The DM must assign every combatant to a side.");
    if (!Number.isFinite(combatant.initiative)) throw new Error("Every combatant must roll initiative first.");
    totals[combatant.side] += combatant.initiative;
    counts[combatant.side]++;
  }
  const averages = Object.fromEntries(SIDES.map(side => [side, counts[side] ? totals[side] / counts[side] : null]));
  const first = counts.friendly === 0 ? "hostile" : counts.hostile === 0 ? "friendly"
    : averages.friendly >= averages.hostile ? "friendly" : "hostile";
  return { method: "average", totals, counts, averages, order: [first, ...SIDES.filter(side => side !== first)] };
}

export function compareSides(a, b, order) {
  const rank = side => order.indexOf(side) < 0 ? order.length : order.indexOf(side);
  return rank(a.side) - rank(b.side);
}
