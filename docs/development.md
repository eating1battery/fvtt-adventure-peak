# Development notes

## Current implementation

The first development increment includes:

- A Foundry module manifest, English settings labels, and browser ES modules without a build step.
- Independent, GM-controlled world settings for rest rules and side initiative. Both default to disabled in this development build. A reload is required when changing either setting so document classes are selected consistently on every client.
- Pure rule calculations separated from Foundry-specific integration code.
- One-hour short rests and a checked-by-default automatic spell slot recovery checkbox in the native short rest dialog.
- Two regular slots recovered per spent Hit Die, lowest level first, through 9th level. Recovery is added to the native actor update; healing is left to dnd5e. Full HP does not prevent spending a die in the native dialog.
- Normal long rest spell slot refills suppressed. Player-initiated long rests require a real GM-authored, uncompleted long rest request targeting that actor; the GM can initiate long rests directly.
- The native long rest Hit Dice calculation configured with the 2014 half-total recovery fraction.
- Automatic recovery of up to two Pact Magic slots per short rest.
- Explicit GM assignment of combatants to friendly or hostile sides, including assignment of late joiners.
- Frozen summed initiative totals, friendly-side tie breaks, and side ordering that preserves individual initiative results.
- A GM side-swap control. In this build, swaps apply at the next round to avoid reordering an unfinished round. Totals are preserved.
- An API at `game.modules.get("adventurepeak").api` with `establishSides(combat)` and `swapSideOrder(combat)`. Both require side initiative to be enabled and a GM caller.

The module does not change the Arcane Recovery feature. Slot recovery reads current slot values, so recovery already performed through Arcane Recovery is accounted for when a Hit Die is spent.

## Remaining implementation

These remain part of the agreed scope:

- Song of Rest recovery alongside healing, with once-per-consecutive-rest enforcement and a defined rest-sequence reset.
- Independent combatant completion, automatic side advancement after all members finish, and the DM completion override.
- Integration of that completion model with Foundry's default controls and individual start/end effects, including turn-based durations. The current build only orders combatants by side and uses native individual turn progression; it does not yet provide the agreed concurrent completion model.
- In-world verification of the dialog, permissions, multi-client updates, native effects, and interactions with other modules.

Details still requiring a design decision are retained in `docs/design.md`. For this increment, Hit Dice restore regular Spellcasting slots only; Pact Magic uses its separate automatic recovery. This is a provisional implementation choice pending clarification, not a new agreed table rule. Long rest Hit Die spending has not been added; the native short rest dialog is the spending interface for now.

## Source verification

The installed target sources were inspected directly:

- `/opt/foundryvtt/resources/app/package.json`: generation 13, build 351.
- `/opt/foundrydata/Data/systems/dnd5e/system.json`: version 5.3.0.
- dnd5e `Actor5e.initiateRest`, `rollHitDie`, `_rest`, Hit Dice recovery, rest dialogs, and `Combat5e` in the installed `dnd5e.mjs`.
- Foundry's combat sorting, round advancement, and turn-event implementation in the installed `foundry.mjs`.

Public background references: [dnd5e hooks](https://github.com/foundryvtt/dnd5e/wiki/Hooks) and [Foundry module development](https://foundryvtt.com/article/module-development/). Target-version source is authoritative when current documentation differs.

Integration uses the documented rest hooks. Combat extends the configured dnd5e document class, including its documented sorting extension point, and delegates native behavior to the superclass. No core or system files are modified. The combat adapter is intentionally localized for the later v14/dnd5e 6 migration.

## Validation

Run `npm test` for rule and adapter tests and `npm run check` for JavaScript syntax, JSON parsing, and manifest asset existence. Adapter tests use controlled Foundry substitutes; passing them does not establish in-world compatibility.

Manual checks to perform in a separate development world:

1. Load with both settings disabled and check normal rests and initiative.
2. Enable only rest rules. Spend a Hit Die with expended slots while injured, then at full HP. Confirm two lowest slots recover and normal healing/Hit Die consumption occur. Repeat with the checkbox unchecked.
3. Fill lower-level slots and spend a die with expended 3rd-, 4th-, and 9th-level slots. Confirm priority and capacity limits.
4. Cancel a rest dialog, then roll a Hit Die outside a rest. Confirm the outside roll grants no slots.
5. Use Arcane Recovery first, then spend Hit Dice. Confirm the already-restored slots are not counted as missing.
6. Complete short rests with a warlock missing four, one, and zero Pact Magic slots. Confirm recovery of two, one, and zero respectively.
7. Attempt an unrequested long rest as a player, then a targeted GM-requested long rest and a GM-initiated long rest. Check authorization, healing, absence of slot refill, and 2014 Hit Dice recovery, including level one and multiclass actors.
8. Enable only side initiative. Assign sides, roll all combatants, and calculate totals. Check the 25-versus-27 example, ties, missing assignments, and unrolled combatants.
9. Start combat, add/remove combatants, and reroll an individual. Confirm totals and side order remain frozen, with individual rolls visible.
10. Queue a side swap and advance a round. Check both clients' order, unchanged totals, and individual effects at the boundary. This is especially important because automated substitutes do not reproduce Foundry's private turn-event dispatcher.
11. Enable both settings and repeat representative rest and combat checks to verify independence.

The remaining scope above requires additional acceptance checks once implemented. No manual check is recorded as passed yet.
