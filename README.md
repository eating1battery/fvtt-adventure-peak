# Adventurepeak

A Foundry Virtual Tabletop module for table rules and modifications to the base dnd5e system.

Initial development build for **Foundry 13.351** and **dnd5e 5.3.0**. See the [design document](docs/design.md) for the agreed rules and [development notes](docs/development.md) for current coverage and remaining work.

Two independent world settings control rest rules and side initiative. Both currently default to disabled, and changing either requires a reload.

## Development

Requires Node.js 20 or later. No dependencies or build step are needed.

```sh
npm test
npm run check
```

To load in a development Foundry installation, copy this directory into `Data/modules/adventurepeak`, restart Foundry, and enable Adventurepeak in the test world's module management. Enable the desired rules in module settings and reload. This repository has not been installed into the existing campaign.

This is an incomplete development version: Song of Rest sequence tracking and independent combatant completion remain to be implemented. Foundry's native turn controls currently track turns within each ordered side. In-world validation is pending.
