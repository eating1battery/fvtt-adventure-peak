# Adventurepeak design

Status: initial feature scope defined; development started. Remaining rule details and unfinished implementation are tracked below and in [development notes](development.md).

## Purpose

Create a Foundry VTT module named `adventurepeak` that contains table rules and modifications to the base dnd5e system.

## Agreed decisions

- Package ID and repository name: `adventurepeak`.
- Display name: Adventurepeak.
- Extend the dnd5e system through a Foundry module.
- Define scope and behavior together in this document before implementation.

## Compatibility

- Current development and validation target: Foundry VTT **13.351** with dnd5e **5.3.0**.
- Planned future upgrade: Foundry VTT **v14** with dnd5e **6**. Support for that combination is deferred until the upgrade work and validation occur.
- Prefer supported, non-deprecated APIs available in the current target versions. Avoid deprecated APIs where possible; document any necessary exception and its migration path.
- Rules baseline: a mix of 2014 and 2024 rules. Specify the applicable baseline and any table-specific differences for each feature as it is defined.
- Required or optional companion modules: to be decided.

## Rules and modifications

### Rest-based spell slot recovery

Status: core rule agreed; details below remain open.

- Long rests restore spell slots normally, including Pact Magic. Hit Die spell slot recovery is an additional short-rest benefit.
- Each Hit Die spent while resting restores two expended spell slots, starting with the lowest spell slot level.
- Wizard Arcane Recovery is unaffected and may be used before this recovery.
- The 2014 bard Song of Rest can be used to recover two spell slots, like a Hit Die.
- Rules baseline: table-specific rest rule, explicitly incorporating 2014 Song of Rest.
- Short rests occur in one-hour intervals.
- A long rest occurs only when the DM allows it; reaching or exceeding eight hours does not automatically grant a long rest.
- Players may initiate long rests themselves. Without a targeted DM request, show a reminder to obtain DM permission and allow the rest to continue; the module does not block it.
- Long rests otherwise broadly follow normal 5e behavior, subject to the spell slot recovery exception above. Any remaining baseline differences will be specified when needed.
- Healing works normally: spending Hit Dice retains its normal healing benefit, and Song of Rest provides both its healing benefit and two recovered spell slots.
- Players may spend Hit Dice to recover spell slots even at full HP; missing HP is not a requirement for spending a Hit Die this way.
- The rest interface includes a checkbox to automatically restore spell slots when spending Hit Dice. It is checked by default; players may uncheck it to spend Hit Dice without restoring spell slots. Healing still works normally in either case.
- Slot recovery moves upward through expended slots from 1st through 9th level as lower levels fill. There is no maximum recoverable slot level within that range.
- Song of Rest applies only once across a consecutive sequence of rest intervals; another hour of uninterrupted resting does not grant another use.
- Pact Magic automatically recovers up to two expended Pact Magic slots per short rest, without spending a Hit Die. This two-slot limit is provisional and may be revisited.
- A DM-authorized long rest restores spent Hit Dice using the 2014 rule: up to half the character's total Hit Dice, rounded down, with a minimum of one.

Details to resolve:

- How Hit Dice spending is handled during a DM-authorized long rest, including whether it includes short rest intervals.
- Whether Hit Dice and Song of Rest can also restore Pact Magic slots, and how recovery prioritizes Pact Magic versus Spellcasting slots.
- Who receives Song of Rest slot recovery and what activity ends a consecutive rest sequence, allowing another use.
- Any other long rest benefits where the mixed rules baseline requires an explicit choice.
- Placement of the recovery checkbox and any additional player/GM controls beyond the agreed checkbox.

Confirmed acceptance criteria:

- Spending one Hit Die retains normal healing and restores up to two expended spell slots, choosing the lowest levels first.
- A character at full HP can spend a Hit Die to restore expended spell slots.
- The automatic spell slot recovery checkbox is checked by default.
- With the checkbox checked, each Hit Die spent automatically restores up to two expended slots, lowest level first.
- With the checkbox unchecked, spending Hit Dice provides normal healing without restoring spell slots.
- If the only expended slots are one 3rd-level and one 4th-level slot, spending one Hit Die restores both.
- Expended slots up to 9th level are eligible for Hit Die recovery.
- Song of Rest retains its healing benefit while also providing two recovered spell slots.
- Eight or more hours of rest alone does not qualify as a long rest without DM authorization.
- A long rest replenishes spell slots normally, including Pact Magic.
- Consecutive rest intervals do not grant additional uses of Song of Rest.
- A short rest automatically restores up to two expended Pact Magic slots without spending a Hit Die.
- A DM-authorized long rest restores up to half the character's total Hit Dice (rounded down, minimum one), limited to spent Hit Dice.

Further acceptance criteria will be added as the remaining details are settled.

### Side-based combat initiative

Status: core rule agreed; details below remain open.

- All combatants roll initiative individually.
- Calculate each side's average initiative: sum every member's individual result and divide by the number of combatants on that side. Visual groups do not change the weighting.
- The side with the higher average acts first.
- The DM decides which combatants belong to the friendly side and which belong to the hostile side.
- PCs (character actors) default to friendly; NPC actors default to hostile. Explicit DM assignments override these defaults, including during combat.
- Grouped enemies have group-level friendly/hostile buttons that change every member. Individual members can be assigned separately; the visual grouping separates different sides.
- Side assignment uses two compact icon buttons beside the native `combatant-controls` div, separated from the native controls by `|`. Buttons show the selected side and include accessible labels and tooltips. Group headers also provide assignment buttons.
- The combatant name, HP/resource display, and initiative share the top row. Native controls and friendly/hostile assignment buttons sit beneath it.
- Initiative averages are displayed as rounded whole numbers. Preserve fractional individual rolls and precise stored averages for deciding which side acts first.
- If the side averages tie, the friendly side acts first.
- Once initiative is established, side averages and the resulting order stay fixed for the encounter, including when combatants join or leave.
- The DM may swap the side order when needed, overriding which side acts first without changing the recorded initiative rolls or averages.
- Members of the active side may take their turns more or less simultaneously; individual initiative results do not impose a strict turn order within the side.
- Preserve and display individual initiative results because they remain useful information.
- Each combatant can mark their own turn complete in the combat tracker.
- Once all members of the active side are marked complete, combat automatically advances to the next side. After both sides complete, advance to the next round.
- The DM can override completion and advance combat without waiting for every member of a side to finish.
- Turn-start and turn-end effects trigger individually for each creature when it starts and completes its own turn, rather than together at the side boundary.
- Defer individual turn start/end controls to Foundry's default controls; do not introduce custom Start Turn or End Turn buttons. How those controls integrate with side completion tracking and concurrent acting will be resolved during technical design.
- Rules baseline: table-specific initiative rule.

Details to resolve:

- Whether encounters ever need neutral combatants or more than the agreed friendly/hostile sides.
- How a DM-initiated side-order swap takes effect during an in-progress round.
- When completion markers reset and how the DM corrects an accidental completion or advancement.
- How Foundry's default turn controls integrate with side completion tracking, concurrent acting, turn-based durations, and DM overrides while preserving individual start/end triggers.
- Desired display of side averages and individual rolls.

Confirmed acceptance criteria:

- Each combatant retains a visible individual initiative result.
- For sides with rolls of 18 and 7 versus 14 and 13, the side averaging 13.5 acts before the side averaging 12.5.
- One friendly combatant rolling 18 acts before two hostile combatants rolling 10 each: compare averages of 18 and 10.
- Members of the active side can act without following descending individual initiative order.
- The DM can assign combatants to the friendly or hostile side.
- When friendly and hostile initiative averages are equal, the friendly side acts first.
- An unassigned PC defaults to friendly and an unassigned NPC defaults to hostile; explicit assignments take priority.
- Group assignment buttons update every member, and an individual override separates that member into the appropriate visual side group.
- Display rounding does not affect which side wins, even if distinct decimal averages display as the same whole number.
- Each combatant has a turn-completion control in the tracker.
- Completing the last unfinished turn on the active side automatically advances combat to the next side, or to the next round after both sides finish.
- The DM can advance combat even if some members of the active side have not marked their turns complete.
- Combatants joining or leaving do not change the established side averages or order.
- The DM can swap the established side order while preserving individual initiative results and side averages.
- A creature's turn-start effects trigger when its individual turn starts; its turn-end effects trigger when its individual turn completes.
- Starting or ending a side's shared turn does not, by itself, trigger every member's individual turn-start or turn-end effects.

### Feature specification checklist

For each proposed rule, record:

- Current behavior and desired behavior, with a concrete example.
- Applicable rules baseline (2014, 2024, or a table-specific combination).
- Who and what it applies to.
- Whether it provides reference text, manual tools, or automation.
- Whether it is always enabled or controlled by a setting.
- Exceptions and interactions with other rules or modules.
- Observable acceptance criteria.

## Initial release scope

The initial scope consists of the two features above:

1. Rest-based spell slot recovery and the related rest rules.
2. Side-based combat initiative.

### Module settings

- Provide separate world-level Boolean settings, controlled by the GM: **Enable Rest Rules** and **Enable Side Initiative**.
- The settings are independent: either feature, both features, or neither feature can be enabled.
- Disabling a feature restores the base system's behavior for that feature; enabling the other feature does not activate it indirectly.
- The rest rules setting controls the complete rest feature, including Hit Die slot recovery, Song of Rest changes, Pact Magic recovery, and DM-authorized long rests.
- The side initiative setting controls the complete combat feature, including side assignment, averages, ordering, completion, and DM overrides.
- The in-rest automatic slot recovery checkbox remains a separate player choice within the enabled rest feature.
- Development defaults: both settings disabled, with a reload required on change. These defaults are provisional pending user preference; the rest dialog's automatic slot recovery checkbox remains checked by default when rest rules are enabled.

Acceptance criteria: validate all four combinations of the settings. With both disabled, Adventurepeak applies neither set of rule changes.

## Deferred work

- Foundry v14 and dnd5e 6 compatibility work and validation.
- Additional table rules beyond the two features in the initial scope.

## Implementation approach

Implementation has started with pure rule calculations and separate rest/combat adapters. See [development notes](development.md) for implemented behavior, provisional choices, and remaining scope.

- Build for Foundry 13.351 and dnd5e 5.3.0 first.
- Check API choices against the documentation and source for the target versions before implementation.
- Prefer public extension points and keep version-sensitive integration code localized to make the planned upgrade easier.
- Do not claim compatibility with Foundry v14 or dnd5e 6 until validated against those versions.

## Validation

Define in-world checks for each accepted rule and identify any automated checks needed once the implementation approach is known.

## Open questions

1. Resolve the remaining details listed under each feature before implementing the affected behavior.
2. Confirm the provisional module setting defaults and next-round application of DM side swaps.
3. Confirm any required or optional companion modules during technical design.

## Decision log

- Target Foundry 13.351 and dnd5e 5.3.0 now; plan for a later move to Foundry v14 and dnd5e 6. Avoid deprecated APIs where possible.
- Use a mixed 2014/2024 rules baseline, with the applicable rules specified per feature.
- Limit the initial scope to rest rules and side initiative, each controlled by its own independent module setting.
