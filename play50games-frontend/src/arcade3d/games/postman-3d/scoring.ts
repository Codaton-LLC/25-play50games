import type { ScoringRules } from "@/arcade3d/types";

// Conservative geometric bounds; README explains why the spec sketch needs revision.
const pts = { kind: "points", unitLabel: "pts", display: "int", minDurationMs: 4000 } as const;
export const PROPOSED_LEVEL_LIMITS: Record<1 | 2 | 3 | 4 | 5, ScoringRules> = {
   1: { ...pts, maxScore: 1150, maxDurationMs: 120000, base: 560, maxPointsPerSec: 110 },
   2: { ...pts, maxScore: 1570, maxDurationMs: 150000, base: 840, maxPointsPerSec: 80 },
   3: { ...pts, maxScore: 2000, maxDurationMs: 180000, base: 1120, maxPointsPerSec: 75 },
   4: { ...pts, maxScore: 2250, maxDurationMs: 180000, base: 1400, maxPointsPerSec: 50 },
   5: { ...pts, maxScore: 2950, maxDurationMs: 210000, base: 1960, maxPointsPerSec: 50 },
};

