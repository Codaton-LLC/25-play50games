import type { LevelId } from "@/arcade3d/types";

/** One street, five configurations. Stage progression remains separate from the selected level. */
export interface PigeonLevel {
   id: LevelId;
   sections: number;
   tierOffset: number;
   speedFactor: number;
   packExtra: number;
   grassEvery: number;
   parkedEdges: number;
   pointsFactor: number;
   durationMs: number;
}

export const LEVELS: Record<LevelId, PigeonLevel> = {
   1: { id: 1, sections: 3, tierOffset: 0, speedFactor: 1, packExtra: 0, grassEvery: 3, parkedEdges: 0, pointsFactor: 1, durationMs: 1800000 },
   2: { id: 2, sections: 4, tierOffset: 1, speedFactor: 1.05, packExtra: 1, grassEvery: 3, parkedEdges: 1, pointsFactor: 1.5, durationMs: 1800000 },
   3: { id: 3, sections: 5, tierOffset: 2, speedFactor: 1.1, packExtra: 1, grassEvery: 3, parkedEdges: 2, pointsFactor: 2, durationMs: 1800000 },
   4: { id: 4, sections: 6, tierOffset: 3, speedFactor: 1.15, packExtra: 1, grassEvery: 4, parkedEdges: 2, pointsFactor: 2.5, durationMs: 1800000 },
   5: { id: 5, sections: 8, tierOffset: 4, speedFactor: 1.2, packExtra: 1, grassEvery: 5, parkedEdges: 2, pointsFactor: 3, durationMs: 1800000 },
};

/** Section targets become score clears; every run stays endless after clearing. */
export const CLEAR_SCORES: Record<LevelId, number> = { 1: 90, 2: 180, 3: 300, 4: 850, 5: 1800 };
