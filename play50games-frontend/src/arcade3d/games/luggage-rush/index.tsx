"use client";

// Airport Luggage Rush: the GameDefinition GameShell runs. The shell owns the screens, the
// clock, pause and the score submit; the game owns Scene.tsx, rules.ts and assets.ts.
// Levels: one LevelSpec per meta.ts level, built from levels.ts (core/README.md "Levels").
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Hud from "./Hud";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { LEVELS, type LuggageLevel } from "./levels";
import { COLORS, FOG_RANGE } from "./looks";
import { DURATION_MS, RESULT_DELAY_MS, STRIKE_LIMIT } from "./rules";

/** One line under the level tiles. */
const DESCRIPTIONS: Record<LevelId, string> = {
   1: "120 seconds on the training belt. Three misses end the shift.",
   2: "Two Destinations: two airliners at the gates, 150 seconds, a faster belt.",
   3: "Four Destinations at sunset: four gates, 180 seconds, bags arrive faster.",
   4: "Rush Hour at night under blinking apron lights: the belt steps up every 10 s, more heavy bags.",
   5: "International Hub: widebodies, the tower, 200 seconds on the fastest belt.",
};

/** Lighting only. Fog and the hall colours stay the game's; level 1 keeps the definition. */
const MOOD: Partial<Record<LevelId, NonNullable<LevelSpec["environment"]>["lighting"]>> = {
   2: "day",
   3: "sunset",
   4: "night",
   5: "space",
};

function instructionsFor(level: LuggageLevel): string[] {
   return [
      `A / left, S / down and D / right flip diverters 1–3. W / up flips diverter 4 after ${level.phaseD4} s.`,
      "Or tap a diverter. Match each bag's colour and symbol to its chute.",
      "+20 a bag, up to ×3 in a row. A gold rim is a VIP and scores double. Three misses end the run.",
   ];
}

const definition: GameDefinition<LuggageLevel> = {
   slug: "luggage-rush",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   resultDelayMs: RESULT_DELAY_MS,
   camera: { position: [6, 16, 22], fov: 50, lookAt: [5.5, 0, 7] },
   environment: {
      background: COLORS.skyBottom,
      fog: [COLORS.fog, FOG_RANGE.near, FOG_RANGE.far],
      lighting: "indoor",
   },
   touchControls: ["tap"],
   hudStats: [
      { key: "strikes", label: "Strikes", max: STRIKE_LIMIT },
      { key: "combo", label: "Combo" },
   ],
   instructions: [
      "A / left, S / down and D / right flip diverters 1–3. W / up flips diverter 4 after 70 s.",
      "Or tap a diverter. Match each bag's colour and symbol to its chute.",
      "+20 a bag, up to ×3 in a row. A gold rim is a VIP and scores double. Three misses end the run.",
   ],
   levels: LEVEL_IDS.map((id) => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         durationMs: level.durationMs,
         environment: { lighting: MOOD[id] },
         instructions: instructionsFor(level),
      };
   }),
};

export default definition;
