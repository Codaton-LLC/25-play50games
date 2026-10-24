// Obstacle Race level configs (docs/arcade-levels.md §6.3; README "Levels"): the five levels, pure
// data. Level 1 is today's game bit for bit (buildCourse(LEVELS[1]) deep-equals rules.ts COURSE,
// levels.test.ts); each higher level lengthens the course (more jump platforms and blocks) and
// speeds the obstacles up, and levels 4-5 narrow the checkpoint pads. The titles live in meta.ts,
// the descriptions in index.tsx; the per-level server limits are rules.ts PROPOSED_LEVEL_LIMITS.
import type { LevelId } from "../../types";
import type { ObstacleLevel } from "./rules";

export const LEVELS: Record<LevelId, ObstacleLevel> = {
   1: { jumps: 5, blocks: 5, barOmega: 1.1, blockPeriodMs: 4000, blockTravel: 2.4, beamSlide: 1.8, padHalfX: 3 },
   2: { jumps: 6, blocks: 6, barOmega: 1.1, blockPeriodMs: 4000, blockTravel: 2.4, beamSlide: 1.8, padHalfX: 3 },
   3: { jumps: 6, blocks: 7, barOmega: 1.25, blockPeriodMs: 3500, blockTravel: 2.4, beamSlide: 2.0, padHalfX: 3 },
   4: { jumps: 7, blocks: 7, barOmega: 1.4, blockPeriodMs: 3200, blockTravel: 2.4, beamSlide: 2.2, padHalfX: 2.6 },
   5: { jumps: 7, blocks: 8, barOmega: 1.55, blockPeriodMs: 3000, blockTravel: 2.4, beamSlide: 2.4, padHalfX: 2.4 },
};
