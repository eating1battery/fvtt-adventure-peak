/** Compute regular spell slot recovery without changing the supplied actor data. */
export function recoverSlots(spells, count) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError("Slot count must be a nonnegative integer.");
  const updates = {};
  for (let level = 1; level <= 9 && count > 0; level++) {
    const key = `spell${level}`;
    const slot = spells?.[key];
    if (!slot || !Number.isFinite(slot.value) || !Number.isFinite(slot.max)) continue;
    const restored = Math.min(count, Math.max(0, slot.max - slot.value));
    if (restored === 0) continue;
    updates[`system.spells.${key}.value`] = slot.value + restored;
    count -= restored;
  }
  return updates;
}

/** Replace native rest slot refill with Adventurepeak's Pact Magic exception. */
export function adjustRestSlots(spells, updates, { shortRest }) {
  for (const path of Object.keys(updates)) {
    if (/^system\.spells\.[^.]+\.value$/.test(path)) delete updates[path];
  }
  const pact = spells?.pact;
  if (shortRest && Number.isFinite(pact?.value) && Number.isFinite(pact?.max)) {
    updates["system.spells.pact.value"] = Math.min(pact.max, pact.value + 2);
  }
  return updates;
}
