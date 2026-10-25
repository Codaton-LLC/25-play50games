"use client";
import type { GameDefinition } from "@/arcade3d/core/types";
import type { ArcadeSlug, LevelId } from "@/arcade3d/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { LEVELS, LINES, type PizzaLevel } from "./levels";
import { environment } from "./looks";
const instructions = ["Move with WASD / arrows or the joystick. E / Enter / Use works at the nearest station.", "Dough ? sauce ? cheese ? toppings in ticket order ? oven. Take out in green, then serve.", "+150 served, +50 perfect bake, +30 fresh ticket. Win: +4 per full second left."];
const definition: GameDefinition<PizzaLevel> = {
   slug: "pizza-kitchen-3d" as ArcadeSlug, Scene, Hud, assets: ASSETS,
   durationMs: LEVELS[1].durationMs, camera: { position: [0, 18, 10.4], fov: 42, lookAt: [0, 0, 0] },
   environment: environment(LEVELS[1]), touchControls: ["joystick", "action"], touchLabels: { action: "Use" },
   instructions, hudStats: [{ key: "served", label: "Served", max: 3 }],
   levels: ([1, 2, 3, 4, 5] as LevelId[]).map(id => ({ id, config: LEVELS[id], description: LINES[id - 1], durationMs: LEVELS[id].durationMs,
      environment: environment(LEVELS[id]), hudStats: [{ key: "served", label: "Served", max: LEVELS[id].orders }],
      instructions: [...instructions, ...(id >= 4 ? ["One expired ticket is allowed. A second ends the run."] : []), ...(id === 5 ? ["Box the pizza before serving."] : [])],
   })),
};
export default definition;
