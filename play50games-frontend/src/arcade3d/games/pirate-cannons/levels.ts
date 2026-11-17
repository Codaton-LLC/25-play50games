// Pirate Cannon Battle's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One bay, five configurations of the same five waves. Level 1 is today's game and must never change:
// its waves are rules.ts WAVES (the array below), sloops zig-zag from wave 4.
// levels.test.ts pins it.
//
// The plan's attempt-limited target gallery (a shot limit, a win state) is not built: the game is
// today's 90 s / 3-lives wave fight on every level, and a level clears at its score target. A harder
// level adds ships to every wave, pushes every ship one lane farther out (longer shots, a bigger lane
// bonus), makes the ships faster and the wind stronger, and zig-zags the sloops from the first wave.
// More ships and farther lanes mean a harder level offers more points (README "Levels").
import type { LevelId } from "@/arcade3d/types";
import type { ShipType } from "./rules";

export interface WaveSpec {
   start: number;
   speed: number;
   span: number;
   /** max wind (m/s²) */
   wind: number;
   types: readonly ShipType[];
   /** lane indices (0 = 25 m, 1 = 40 m, 2 = 55 m) */
   lanes: readonly number[];
}

export interface PirateLevel {
   waves: readonly WaveSpec[];
   /** sloops zig-zag from this wave (1-based; rules ZIG.sloopFromWave) */
   zigFrom: number;
}

/** Today's five waves (rules.ts WAVES). */
const TODAY: readonly WaveSpec[] = [
   { start: 0, speed: 1.0, span: 16, wind: 1.0, types: ["sloop", "sloop", "dinghy"], lanes: [0, 0, 1] },
   { start: 20, speed: 1.1, span: 16, wind: 1.5, types: ["sloop", "sloop", "dinghy", "galleon"], lanes: [0, 1, 1, 2] },
   { start: 40, speed: 1.2, span: 16, wind: 2.0, types: ["sloop", "sloop", "dinghy", "dinghy", "galleon"], lanes: [0, 1, 1, 2, 2] },
   { start: 60, speed: 1.3, span: 16, wind: 2.5, types: ["galleon", "galleon", "sloop", "sloop", "dinghy", "dinghy"], lanes: [0, 0, 1, 1, 2, 2] },
   { start: 80, speed: 1.4, span: 8, wind: 3.0, types: ["galleon", "sloop", "dinghy", "dinghy"], lanes: [0, 1, 2, 2] },
];

/** Today's waves with `extra` ships added to each (on the far lanes), every lane one farther out, faster and windier. */
function harder(extra: readonly ShipType[], speed: number, wind: number): readonly WaveSpec[] {
   return TODAY.map((w) => ({
      start: w.start,
      span: w.span,
      speed: Math.round(w.speed * speed * 1000) / 1000,
      wind: Math.round(w.wind * wind * 1000) / 1000,
      types: [...w.types, ...extra],
      lanes: [...w.lanes.map((l) => Math.min(2, l + 1)), ...extra.map((_t, i) => 2 - (i % 2))],
   }));
}

export const LEVELS: Record<LevelId, PirateLevel> = {
   // Training Deck: today's game.
   1: { waves: TODAY, zigFrom: 4 },
   // Harbor Targets: every ship a lane farther out, one more dinghy per wave.
   2: { waves: harder(["dinghy"], 1, 1.2), zigFrom: 4 },
   // Moving Boats: sloops zig-zag from the first wave, faster ships.
   3: { waves: harder(["dinghy"], 1.1, 1.3), zigFrom: 1 },
   // Storm Battle: two more dinghies per wave, faster again, a stronger wind.
   4: { waves: harder(["dinghy", "dinghy"], 1.15, 1.4), zigFrom: 1 },
   // Captain Challenge: a dinghy and a sloop more per wave, the fastest ships and the strongest wind.
   5: { waves: harder(["dinghy", "sloop"], 1.2, 1.5), zigFrom: 1 },
};

/** The most ships any level sails in one run (the ship pools' size). */
export const SHIP_POOL = Math.max(...Object.values(LEVELS).map((l) => l.waves.reduce((n, w) => n + w.types.length, 0)));
