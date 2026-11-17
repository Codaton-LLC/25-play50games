"use client";

// Pizza Kitchen 3D. GameShell owns the clock (durationMs per level), pause and the result.
// Level 1 is the definition; levels 2-5 swap tickets, toppings, ovens, windows, patience and the box step.
import type { GameDefinition, LevelSpec } from "@/arcade3d/core/types";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import Hud from "./Hud";
import { LEVELS, LEVEL_LINES, type PizzaLevel } from "./levels";
import { FOV, environment } from "./looks";
import { TUNING } from "./rules";
import Scene from "./Scene";

const LINES = [
   "Move with WASD, the arrows or the stick. E, Enter or Use works the station you stand at.",
   "Dough, then sauce, cheese and the toppings in ticket order, then the oven. A wrong one spoils the pizza.",
   "Take it out while the ring is green (the first part pays a perfect bake), then serve it at the hatch.",
];

function instructionsFor(id: LevelId): string[] {
   if (id === 4) return [...LINES, "Tickets do not wait forever: one may expire, a second ends the run."];
   if (id === 5) return [...LINES, "One ticket may expire, a second ends the run. Box each pizza before the hatch."];
   return LINES;
}

const stats = (l: PizzaLevel) => [{ key: "served", label: "Served", max: l.orders }];

const definition: GameDefinition<PizzaLevel> = {
   slug: "pizza-kitchen-3d",
   Scene,
   Hud,
   assets: ASSETS,
   durationMs: LEVELS[1].durationMs,
   resultDelayMs: TUNING.resultDelayMs,
   camera: { position: [0, 14, 9], fov: FOV, lookAt: [0, 0, 0.5] },
   environment: environment(LEVELS[1]),
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Use" },
   hudStats: stats(LEVELS[1]),
   instructions: LINES,
   levels: LEVEL_IDS.map((id): LevelSpec<PizzaLevel> => {
      const spec: LevelSpec<PizzaLevel> = {
         id,
         description: LEVEL_LINES[id],
         config: LEVELS[id],
         durationMs: LEVELS[id].durationMs,
         environment: environment(LEVELS[id]),
      };
      if (id !== 1) {
         spec.hudStats = stats(LEVELS[id]);
         spec.instructions = instructionsFor(id);
      }
      return spec;
   }),
};

export default definition;
