"use client";

// Treasure Island: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts). The
// shell owns the screens, the HUD, the 90 s timer, pause and the score submit; the game owns
// Scene.tsx (the frame loop and what moves), rules.ts (the logic) and assets.ts (the models).
// Levels: one LevelSpec per meta.ts level, built from levels.ts (core/README.md "Levels"), each with its
// own light (looks.ts THEMES): morning, noon, golden hour, jungle shade, a storm at sunset.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Hud from "./Hud";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { LEVELS, type IslandLevel } from "./levels";
import { mapPiecesOf } from "./guide";
import { FOV, THEMES } from "./looks";
import { DURATION_MS, TREASURE_COUNT } from "./rules";

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Starter Beach in the morning: five treasures, 90 seconds. The tide turns at 70 s.",
   2: "Palm Grove at noon: dense palms, huts and a stream with two bridges. A fallen palm blocks one.",
   3: "Rocky Cove at golden hour: cliffs, tide pools, a sea cave and a ravine with one rope bridge.",
   4: "Jungle Interior: walls of foliage, vine gates that open as you dig, and a temple.",
   5: "Pirate Peak in a storm: a wrecked ship, cannons, and the final chest on the summit.",
};

/** Each level's own twist, as a fourth start-card line (level 1 keeps its three). */
const TWISTS: Record<Exclude<LevelId, 1>, string> = {
   2: "Cross the stream on the bridges. Your 2nd find clears the fallen palm off the east bridge.",
   3: "A clue, then map pieces: the last piece reveals the final chest. The rope bridge is the only way east.",
   4: "A clue, then map pieces, then the final chest. Vines open after your 1st and 3rd finds.",
   5: "A clue, then map pieces: the full map clears the rockfall to the summit chest. The tide turns at 45 s.",
};

/** Start-card lines for levels 2-5. Level 1 keeps the definition's own lines. */
function instructionsFor(level: IslandLevel, id: Exclude<LevelId, 1>): string[] {
   return [
      "Walk until the detector ring turns gold and pulses fast.",
      `Hold Dig (E, Enter or Space) to dig: find all ${level.treasures} treasures before the tide.`,
      "+200 a treasure, +50 with no wrong dig before it, +10 per second left.",
      TWISTS[id],
   ];
}

/** The level's sky, fog and core light preset (looks.ts THEMES). */
const environmentFor = (id: LevelId) => {
   const t = THEMES[id];
   return { background: t.background, fog: [t.fog[0], t.fog[1], t.fog[2]] as [string, number, number], lighting: t.lighting };
};

/** The HUD chips: the treasures, and on a chain level the map pieces. */
function hudFor(level: IslandLevel): NonNullable<GameDefinition["hudStats"]> {
   const chips: NonNullable<GameDefinition["hudStats"]> = [{ key: "treasures", label: "Treasures", max: level.treasures }];
   if (level.map?.chain) chips.push({ key: "map", label: "Map", max: mapPiecesOf(level.map) });
   return chips;
}

const definition: GameDefinition<IslandLevel> = {
   slug: "treasure-island",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // only the first frame uses this: Scene's CameraRig (core useFittedView, looks.ts viewFor) fits a
   // window around the explorer clear of the HUD, the joystick and the cookie banner, and follows it
   camera: { position: [0, 14, 20], fov: FOV, lookAt: [0, 0, 9] },
   environment: environmentFor(1),
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Dig" },
   hudStats: [{ key: "treasures", label: "Treasures", max: TREASURE_COUNT }],
   // the last reveal (often the chest), the confetti and the cheer are seen before the result
   resultDelayMs: 1600,
   instructions: [
      "Walk until the detector ring turns gold and pulses fast.",
      "Hold Dig (E, Enter or Space) to dig: find all 5 treasures before the tide.",
      "+200 a treasure, +50 with no wrong dig before it, +10 per second left.",
   ],
   levels: LEVEL_IDS.map((id): LevelSpec<IslandLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level, id),
         environment: environmentFor(id),
         hudStats: hudFor(level),
      };
   }),
};

export default definition;
