"use client";

import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { THEMES } from "./arenaLooks";
import { ASSETS, DECOR_ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, type SnowLevel } from "./levels";
import Scene from "./Scene";

const HUD: NonNullable<GameDefinition["hudStats"]> = [
   { key: "time", label: "Time" },
   { key: "ammo", label: "Ammo" },
   { key: "rivals", label: "Rivals" },
];

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Three rivals in the snow yard. Tag each one three times.",
   2: "Frozen Park at noon: hedges at the edges, long throws, and two frozen ponds you slide across.",
   3: "Snow Fort at sunset: the rivals hold a wall of five. Their walls get packed back up.",
   4: "Ice Village at blue hour: igloos that crumble in two hits, deep drifts and an icy square.",
   5: "Championship Arena under floodlights: ice-block barriers, an ice rink and every rival at once.",
};

/** Each level's own twist, as a fourth start-card line (level 1 keeps its three). */
const TWISTS: Record<Exclude<LevelId, 1>, string> = {
   2: "Frozen ponds: on the ice you slide and stop slowly. Hedges sit far apart, so throws are long.",
   3: "Snow Fort: a wall knocked flat is packed back up after 8 seconds. Deep drifts at the sides slow you.",
   4: "Igloos fall in two hits. Deep drifts slow everyone; the icy square in front of you is slippery.",
   5: "The final: rink ice, corner drifts, and barriers rebuilt after 10 seconds. All three rivals attack early.",
};

/** The level's sky, fog and core light preset (arenaLooks.ts THEMES). */
function environmentFor(id: LevelId) {
   const t = THEMES[LEVELS[id].arena.theme];
   return { background: t.background, fog: [t.fog[0], t.fog[1], t.fog[2]] as [string, number, number], lighting: t.lighting };
}

const INSTRUCTIONS = [
   "Hold Scoop to pack a snowball. Space throws at the rival you are aiming at.",
   "On a phone, tap a rival or the arrow at the edge of the screen.",
   "Three tags knock a rival out. Five tags on you and the fight is over.",
];

const definition: GameDefinition<SnowLevel> = {
   slug: "snowball-battle",
   Scene,
   Hud,
   assets: { kid: ASSETS.kid, pine: ASSETS.pine, snowman: ASSETS.snowman, ...DECOR_ASSETS },
   camera: { position: [0, 8, 12], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: "#e0f2fe", fog: ["#e0f2fe", 26, 48], lighting: "snow" },
   touchControls: ["joystick", "action", "tap"],
   touchLabels: { action: "Scoop" },
   hudStats: HUD,
   instructions: INSTRUCTIONS,
   resultDelayMs: 1200,
   clockChip: false,
   levels: LEVEL_IDS.map((id): LevelSpec<SnowLevel> => {
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: LEVELS[id], hudStats: HUD };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: LEVELS[id],
         hudStats: HUD,
         environment: environmentFor(id),
         instructions: [...INSTRUCTIONS, TWISTS[id]],
      };
   }),
};

export default definition;
