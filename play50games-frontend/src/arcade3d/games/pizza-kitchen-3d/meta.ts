import type { ArcadeGameMeta, ArcadeSlug, LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, TITLES } from "./levels";
// Conservative analytical bounds preserve every earned point; see README.
export const LIMITS: Record<LevelId, ScoringRules> = Object.fromEntries(([1, 2, 3, 4, 5] as LevelId[]).map(id => {
   const l = LEVELS[id];
   return [id, { kind: "points", maxScore: 230 * l.orders + 4 * l.durationMs / 1000, minDurationMs: 4000, maxDurationMs: l.durationMs, base: 230 * l.orders, maxPointsPerSec: 40, unitLabel: "pts", display: "int" }];
})) as Record<LevelId, ScoringRules>;
export const pizzaKitchen3dMeta: ArcadeGameMeta = {
   slug: "pizza-kitchen-3d" as ArcadeSlug, title: "Pizza Kitchen 3D", tagline: "Make it. Bake it. Serve it golden.",
   description: "Run an open kitchen: follow tickets, bake golden pizzas and keep hungry customers happy.",
   order: 45, status: "dev", difficulty: 2, orientation: "any", owner: "claude",
   controls: { scheme: "joystick", keyboard: "WASD / arrows move · E / Enter Use", touch: "Joystick + Use" },
   scoring: LIMITS[1], levels: ([1, 2, 3, 4, 5] as LevelId[]).map(id => ({ id, title: TITLES[id - 1], scoring: LIMITS[id] })),
   thumbnail: "/images/3d/pizza-kitchen-3d.webp", accent: "#ef4444",
};
