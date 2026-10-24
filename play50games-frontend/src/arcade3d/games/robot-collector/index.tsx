"use client";

// Robot Collector: the GameDefinition GameShell runs (loaded lazily by arcade3d/loaders.ts).
// Start here when copying this game: the shell owns screens, HUD, timer, pause and score submit;
// the game owns Scene.tsx (frame loop + moving things), rules.ts (logic) and assets.ts (models).
// Levels: one LevelSpec per meta.ts level, built from levels.ts (core/README.md "Levels").
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import { ASSETS } from "./assets";
import { LEVELS, type RobotLevel } from "./levels";
import { BATTERY_COUNT, DURATION_MS, batteryCount } from "./rules";

/** The start card's lines for a level; level 1's are today's. */
function instructionsFor(level: RobotLevel): string[] {
   const lines = [
      `Collect all ${batteryCount(level)} batteries before the clock runs out.`,
      "They light up two at a time: grab both and the next pair appears.",
   ];
   if (level.slowZones > 0) lines.push("Oil patches slow the robot down.");
   if (level.belts > 0) lines.push("Conveyor belts carry the robot along their arrows.");
   lines.push("+100 per battery. Finish early for +10 per second left.");
   return lines;
}

const DESCRIPTIONS: Record<LevelId, string> = {
   1: "10 batteries in 60 seconds.",
   2: "12 batteries, more crates and oil patches.",
   3: "14 batteries and two conveyor belts.",
   4: "Dark storage: 16 batteries, three faster belts.",
   5: "18 batteries, four fast belts, the most crates and oil.",
};

const ENVIRONMENTS: Record<LevelId, LevelSpec["environment"]> = {
   1: undefined,
   2: { background: "#13233a", lighting: "day" },
   3: { background: "#1f1530", lighting: "sunset" },
   4: { background: "#05070d", lighting: "night" },
   5: { background: "#2a0f14", lighting: "sunset" },
};

const definition: GameDefinition<RobotLevel> = {
   slug: "robot-collector",
   Scene,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // only the first frame uses this: Scene's own CameraRig (core useFittedView) fits the warehouse
   // to the screen, clear of the HUD and the joystick (turning it for portrait phones), and follows the robot
   camera: { position: [0, 19, 13], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: "#0b1220", lighting: "indoor" },
   touchControls: ["joystick"],
   hudStats: [{ key: "batteries", label: "Batteries", max: BATTERY_COUNT }],
   instructions: instructionsFor(LEVELS[1]),
   levels: LEVEL_IDS.map((id): LevelSpec<RobotLevel> => {
      const level = LEVELS[id];
      if (id === 1) return { id, description: DESCRIPTIONS[id], config: level };
      return {
         id,
         description: DESCRIPTIONS[id],
         config: level,
         instructions: instructionsFor(level),
         environment: ENVIRONMENTS[id],
         durationMs: level.durationMs,
         hudStats: [{ key: "batteries", label: "Batteries", max: batteryCount(level) }],
      };
   }),
};

export default definition;
