# menu2/worldMap

The Menu 2 menu page: the six worlds (00-framework.md) on a map. Each game is a node on a winding trail with its stars and its state, and each world's colour fills in as its games are cleared.

## Rules (`mapModel.ts`, pure)

- A game is **cleared** once every one of its levels was cleared (with the levels flag off: level 1 only).
- Inside a world the games unlock **in order**: the first is open, and each next one opens when the one before it is cleared.
- W1-W5 are open from the start. **W6 opens once each of W1-W5 is at least `W6_UNLOCK_FRACTION` (0.5) cleared.**
- Node states: `soon` (not built or not visible), `locked`, `new` (open, never played), `unlocked` (played) and `cleared`.
- `unlockAll` (the preview flag) opens every built game. The map has a "Preview: open every game" switch so you can still see the real locks.

API: `buildMap(progress, { built, unlockAll })` returns `MapWorld[]` (`nodes`, `fill`, `stars`, `unlocked`); also `buildWorld`, `isWorldUnlocked`, `worldFraction`, `gamesToW6` and `isPerfect`. Data: `worlds.ts` `WORLDS` (50 games; each slug is the kebab-case title) and `worldOfSlug`.

## Page

`WorldMap.tsx` (client, CSS module, site vars) has:
- a story line;
- stat tiles: stars, shards, XP level, games restored;
- one region card per world: a colour wash by `--fill`, a restore ring, and a snake trail through 4 columns of round node plates (thumbnail, number or lock, a NEW tag, a clear check that turns gold when perfect);
- W6 sealed, with the number of games still needed.

Hover lifts a node, `:focus-visible` rings it, and reduced motion stops the pulse. One column on phones, two from 960 px (W6 full width).

Wiring: `/3d` (`app/3d/page.tsx`) passes `sectionViews={{ rollheroes: <WorldMap games preview /> }}` to `ArcadeGrid`, **only on preview builds** with grouped sections. Every other section (Menu 1 included) keeps the card grid. Production shows no Menu 2 game, so nothing changes there.

## Adoption (each new Menu 2 game)

Nothing beyond its `meta.ts` (`collection: "rollheroes"`, the slug of its title) and recording progress at the level end (menu2/progress). The node appears and unlocks by itself.
