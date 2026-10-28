"use client";

// Magic Carpet Ride. GameShell owns the clock, the lives, pause and the result.
// Level 1 is the definition; levels 2-5 swap the biome, the lane, the flyers, the clock and the light (levels.ts).
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type CarpetLevel } from "./levels";
import { FOG_NEAR, FOV } from "./looks";
import { LIVES } from "./rules";
import Scene from "./Scene";

const LINES = [
   "WASD, the arrows or the stick fly left, right, up and down. The carpet stays where you leave it. 📷 or C changes the view.",
   "Fly through the rings: rings in a row build a combo. Follow the coin arcs, reach for the gems.",
   "Grab a rocket for a burst of speed. Gulls, balloons, bats, hawks and rocks cost a life.",
];

function goalLine(level: CarpetLevel): string {
   return `Reach the end of the route with ${level.ringQuota} of ${level.rings} rings.`;
}

function instructionsFor(id: LevelId): string[] {
   return [goalLine(LEVELS[id]), ...LINES];
}

function stats(level: CarpetLevel): GameDefinition["hudStats"] {
   return [
      { key: "rings", label: "Rings", max: level.rings },
      { key: "gems", label: "Gems", max: level.gems },
   ];
}

const environmentFor = (level: CarpetLevel) => ({
   background: level.background,
   fog: [level.background, FOG_NEAR, level.fogFar] as [string, number, number],
   lighting: level.lighting,
});

const definition: GameDefinition<CarpetLevel> = {
   slug: "magic-carpet-ride",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   lives: LIVES,
   resultDelayMs: 1200,
   camera: { position: [0, 22, -6], fov: FOV, lookAt: [0, 20, 12] },
   environment: environmentFor(LEVELS[1]),
   touchControls: ["joystick"],
   hudStats: stats(LEVELS[1]),
   instructions: instructionsFor(1),
   levels: LEVEL_IDS.map((id): LevelSpec<CarpetLevel> => {
      const level = LEVELS[id];
      const spec: LevelSpec<CarpetLevel> = { id, description: LEVEL_LINES[id], config: level, durationMs: level.durationMs, environment: environmentFor(level) };
      if (id !== 1) {
         spec.instructions = instructionsFor(id);
         spec.hudStats = stats(level);
      }
      return spec;
   }),
};

export default definition;
