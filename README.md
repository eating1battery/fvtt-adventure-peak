# AdventurePeak

A Foundry Virtual Tabletop module for table rules and modifications to the base dnd5e system. This is pretty much just table rules for the world I play in. If you found this module, feel free to try it out, but it likely won't have any practical application outside of the game I participate in. 

Release **0.1.1** for **Foundry 13.351** and **dnd5e 5.3.0**. See the [design document](docs/design.md) for the agreed rules and [development notes](docs/development.md) for current coverage and remaining work.

Two independent world settings control rest rules and side initiative. Both currently default to disabled, and changing either requires a reload.

## Installation

In Foundry Setup, open **Add-on Modules → Install Module** and paste this **Manifest URL**:

```text
https://github.com/eating1battery/fvtt-adventure-peak/releases/latest/download/module.json
```

Enable **AdventurePeak** in your world's **Manage Modules**, then enable the desired rules in module settings and reload.

Downloads and known limitations are listed on the [releases page](https://github.com/eating1battery/fvtt-adventure-peak/releases).

## Development

Requires Node.js 20 or later. The Foundry module has no runtime dependencies or build step. Install development dependencies to run the DOM regression tests.

```sh
npm ci
npm test
npm run check
npm run package
```

Packaging also requires Python 3 and produces `dist/module.json`, `dist/adventurepeak.zip`, and `dist/SHA256SUMS`. The ZIP contains the manifest at its root, runtime assets, and documentation; development dependencies and tests are excluded.

The module is installed in this development LXC at `/opt/foundrydata/Data/modules/adventurepeak`. The source repository remains at `/root/adventurepeak`. See [development notes](docs/development.md#local-installation) for syncing code changes.

In Foundry, enable Adventurepeak in **Manage Modules**, then enable the desired rules in module settings and reload. Installing the files does not activate the module in a world.

This is an incomplete development version: Song of Rest sequence tracking and independent combatant completion remain to be implemented. Foundry's native turn controls currently track turns within each ordered side. In-world validation is pending.
