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
   "treasure-island": () => import("./games/treasure-island"),
   "museum-guard": () => import("./games/museum-guard"),
   "luggage-rush": () => import("./games/luggage-rush"),
   "dino-egg-rescue": () => import("./games/dino-egg-rescue"),
   "delivery-drone": () => import("./games/delivery-drone"),
   "shopping-cart": () => import("./games/shopping-cart"),
   "snowball-battle": () => import("./games/snowball-battle"),
   "ghost-vacuum": () => import("./games/ghost-vacuum"),
   "construction-worker": () => import("./games/construction-worker"),
   "alien-farm": () => import("./games/alien-farm"),
   "mini-golf": () => import("./games/mini-golf"),
   "robot-factory": () => import("./games/robot-factory"),
   "pirate-cannons": () => import("./games/pirate-cannons"),
   "castle-defender": () => import("./games/castle-defender"),
   "penguin-slide": () => import("./games/penguin-slide"),
   "space-repair": () => import("./games/space-repair"),
   "monster-kitchen": () => import("./games/monster-kitchen"),
   "knight-arena": () => import("./games/knight-arena"),
   "zoo-escape": () => import("./games/zoo-escape"),
   "rocket-landing": () => import("./games/rocket-landing"),
};
