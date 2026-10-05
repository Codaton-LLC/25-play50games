// The list of 3D Arcade games. Server-safe: imports only plain-data meta files.
// Owned by Claude. Game owners change their own meta.ts, never this file.
import type { ArcadeGameMeta, ArcadeSlug } from "./types";
import { robotCollectorMeta } from "./games/robot-collector/meta";
import { foodCatcherMeta } from "./games/food-catcher/meta";
import { officeEscapeMeta } from "./games/office-escape/meta";
import { pigeonCrossingMeta } from "./games/pigeon-crossing/meta";
import { penaltyHeroMeta } from "./games/penalty-hero/meta";
import { warehouseRushMeta } from "./games/warehouse-rush/meta";
import { towerClimbMeta } from "./games/tower-climb/meta";
import { cleanCityMeta } from "./games/clean-city/meta";
import { escapeRoomMeta } from "./games/escape-room/meta";
import { obstacleRaceMeta } from "./games/obstacle-race/meta";

export const ARCADE_GAMES: ArcadeGameMeta[] = [
   robotCollectorMeta,
   foodCatcherMeta,
   officeEscapeMeta,
   pigeonCrossingMeta,
   penaltyHeroMeta,
   warehouseRushMeta,
   towerClimbMeta,
   cleanCityMeta,
   escapeRoomMeta,
   obstacleRaceMeta,
].sort((a, b) => a.order - b.order);

export function getGameMeta(slug: string): ArcadeGameMeta | undefined {
   return ARCADE_GAMES.find((game) => game.slug === slug);
}

export function getLiveGames(): ArcadeGameMeta[] {
   return ARCADE_GAMES.filter((game) => game.status === "live");
}

export type { ArcadeGameMeta, ArcadeSlug };
