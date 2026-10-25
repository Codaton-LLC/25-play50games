"use client";
import type { GameDefinition } from "../../core/types";
import { LEVEL_IDS, type ArcadeSlug } from "../../types";
import { ASSETS } from "./assets";
import { LEVELS, LEVEL_LINES, type BurgerLevel } from "./levels";
import { CAMERA, environment } from "./looks";
import Scene from "./Scene";
import Hud from "./Hud";
const instructions = [
   "Stop at the pink shop to load, then stop inside the green door ring for 0.45 seconds.",
   "Up accelerates, Down brakes or reverses, Left / Right steer. Space / Hop clears barriers.",
   "Hits and dark wet patches spoil quality. Three spoiled orders end the run.",
   "Each drop: quality points +40 within 25 seconds. Win: +4 per full second left.",
];
const stats = (c: BurgerLevel) => [{ key: "orders", label: "Orders", max: c.orders }, { key: "quality", label: "Quality", max: 100 }];
const definition: GameDefinition<BurgerLevel> = {
   slug: "burger-delivery-scooter" as ArcadeSlug, Scene, Hud, assets: ASSETS,
   durationMs: LEVELS[1].durationMs, lives: 3, camera: CAMERA, environment: environment(LEVELS[1]),
   touchControls: ["joystick", "jump"], touchLabels: { jump: "Hop" },
   instructions, hudStats: stats(LEVELS[1]),
   levels: LEVEL_IDS.map((id) => ({ id, description: LEVEL_LINES[id - 1], config: LEVELS[id],
      durationMs: LEVELS[id].durationMs, environment: environment(LEVELS[id]),
      instructions: [...instructions, "Deliver all " + LEVELS[id].orders + " orders with average quality at least " + LEVELS[id].qualityMin + "."],
      hudStats: stats(LEVELS[id]) })),
};
export default definition;
