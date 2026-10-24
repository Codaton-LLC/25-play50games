import type { LevelId } from "@/arcade3d/types";

export interface CastleLevel {
   counts: readonly (readonly [number, number, number, number])[];
   speed: number;
   period: number;
   clearAt: number;
}

// Today's five waves stay intact. The plan's shorter tutorial/4-wave gate are
// adapted upward so migrated level-one scores and difficulty remain meaningful.
export const LEVELS: Record<LevelId, CastleLevel> = {
   1: { counts: [[8, 0, 0, 0], [10, 4, 0, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 6, 6]], speed: 1, period: 28, clearAt: 24 },
   2: { counts: [[8, 2, 0, 0], [10, 4, 2, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 6, 6]], speed: 1.02, period: 27.5, clearAt: 23.5 },
   3: { counts: [[8, 2, 2, 0], [10, 4, 4, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 8, 6]], speed: 1.04, period: 27, clearAt: 23 },
   4: { counts: [[8, 2, 2, 0], [10, 4, 4, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 8, 6], [12, 6, 8, 6]], speed: 1.07, period: 26.5, clearAt: 22.5 },
   5: { counts: [[8, 2, 2, 0], [10, 4, 4, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 8, 6], [12, 6, 8, 6], [12, 6, 8, 6], [12, 6, 8, 6]], speed: 1.1, period: 26, clearAt: 22 },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Outer Wall", 2: "Main Gate", 3: "Twin Towers", 4: "Night Siege", 5: "Royal Defense",
};
export const LEVEL_DESCRIPTIONS: Record<LevelId, string> = {
   1: "The original five-wave siege: hold the gate, hit shields from behind, rock ladders.",
   2: "Five waves: shields arrive earlier and mixed packs move faster toward the main gate.",
   3: "Five waves: early runners split moving packs; keep your combo through shorter gaps.",
   4: "Six waves at night: more runners, faster targets and tighter breaks.",
   5: "Eight mixed waves: master shields, runners and ladders with only four upgrades.",
};
