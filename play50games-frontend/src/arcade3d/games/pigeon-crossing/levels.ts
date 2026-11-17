import type { LevelId } from "@/arcade3d/types";
import { MAP_1, MAP_2, MAP_3, MAP_4, MAP_5, type DistrictMap, type DistrictTheme, type ParkedPattern } from "./maps";

/** Five distinct street districts and traffic configurations; Stage progression remains endless. */
export interface PigeonLevel {
   id: LevelId;
   theme: DistrictTheme;
   sections: number;
   tierOffset: number;
   speedFactor: number;
   packExtra: number;
   grassEvery: number;
   parkedEdges: number;
   parkedPattern: ParkedPattern;
   /** Integer 7-bucket vehicle draw weights [car, taxi, van] (sum = 7; L1 is [4, 2, 1]). */
   vehicleWeights: readonly [number, number, number];
   pointsFactor: number;
   durationMs: number;
   map: DistrictMap;
}

export const LEVELS: Record<LevelId, PigeonLevel> = {
   // Quiet Street: today's live game, unchanged.
   1: { id: 1, theme: "quiet-street", sections: 3, tierOffset: 0, speedFactor: 1, packExtra: 0, grassEvery: 3, parkedEdges: 0, parkedPattern: "none", vehicleWeights: [4, 2, 1], pointsFactor: 1, durationMs: 1800000, map: MAP_1 },
   // Main Road: suburban commercial avenue, alternating curb lay-bys, delivery vans.
   2: { id: 2, theme: "main-road", sections: 4, tierOffset: 1, speedFactor: 1.05, packExtra: 1, grassEvery: 3, parkedEdges: 1, parkedPattern: "alternating-curb", vehicleWeights: [3, 2, 2], pointsFactor: 1.5, durationMs: 1800000, map: MAP_2 },
   // City Crossing: golden-hour midtown, dual-curb parked vans and downtown taxi surge.
   3: { id: 3, theme: "city-crossing", sections: 5, tierOffset: 2, speedFactor: 1.1, packExtra: 1, grassEvery: 3, parkedEdges: 2, parkedPattern: "dual-curb", vehicleWeights: [2, 4, 1], pointsFactor: 2, durationMs: 1800000, map: MAP_3 },
   // Night Traffic: nocturnal expressway, 4-row crossings, staggered median chicanes, night freight.
   4: { id: 4, theme: "night-traffic", sections: 6, tierOffset: 3, speedFactor: 1.15, packExtra: 1, grassEvery: 4, parkedEdges: 2, parkedPattern: "night-chicane", vehicleWeights: [2, 2, 3], pointsFactor: 2.5, durationMs: 1800000, map: MAP_4 },
   // Rush Hour: crimson-dusk metropolitan artery, 5-row crossings, pinched medians, rush-hour convoys.
   5: { id: 5, theme: "rush-hour", sections: 8, tierOffset: 4, speedFactor: 1.2, packExtra: 1, grassEvery: 5, parkedEdges: 2, parkedPattern: "rush-pinch", vehicleWeights: [1, 3, 3], pointsFactor: 3, durationMs: 1800000, map: MAP_5 },
};

/** Section targets become score clears; every run stays endless after clearing. */
export const CLEAR_SCORES: Record<LevelId, number> = { 1: 90, 2: 180, 3: 300, 4: 850, 5: 1800 };
