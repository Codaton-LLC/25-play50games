"use client";

// Lazy loaders for game code. Each game (and three.js) is a separate chunk,
// loaded only when /3d/<slug> opens. Owned by Claude.
import type { ArcadeSlug } from "./types";
import type { GameDefinition } from "./core/types";

type GameModule = { default: GameDefinition };

export const GAME_LOADERS: Record<ArcadeSlug, () => Promise<GameModule>> = {
   "robot-collector": () => import("./games/robot-collector"),
   "food-catcher": () => import("./games/food-catcher"),
   "office-escape": () => import("./games/office-escape"),
   "pigeon-crossing": () => import("./games/pigeon-crossing"),
   "penalty-hero": () => import("./games/penalty-hero"),
   "warehouse-rush": () => import("./games/warehouse-rush"),
   "tower-climb": () => import("./games/tower-climb"),
   "clean-city": () => import("./games/clean-city"),
   "escape-room": () => import("./games/escape-room"),
   "obstacle-race": () => import("./games/obstacle-race"),
};
