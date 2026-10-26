// Sky Tower Jump's five levels: pure data (no React, no three.js). core/README.md "Levels".
// Level 1 "Training Sky" is the hand-built slice (rules.ts COURSE_ROWS). Levels 2-5 are generated
// from these specs (rules.ts buildTower): their own layouts, the plan's heights and timers.
// A pad step rises 2.8x a normal step, and a normal step stays under the jump apex (rules.test.ts).
import type { LevelId } from "@/arcade3d/types";

export interface TowerSpec {
   /** the goal platform's top (m) */
   goalTop: number;
   /** steps after the start; the last one is the goal */
   climbs: number;
   /** centre-to-centre step toward -z (m) */
   gap: number;
   /** zigzag half-width (m): odd steps sit at -side, even steps at +side */
   side: number;
   /** island width (x) and depth (z), metres */
   width: number;
   depth: number;
   /** every Nth climb is a bounce pad (the goal never is) */
   padEvery: number;
   /** every Nth climb that is not a pad or a checkpoint is a moving block; 0 = none */
   moverEvery: number;
   moverTravel: number;
   moverPeriod: number;
   /** every Nth climb is a checkpoint plaza */
   checkpointEvery: number;
   /** an orb on every Nth gap */
   orbEvery: number;
   /** sideways gusts while airborne */
   wind: boolean;
   /** lightning on the rim of some islands */
   lightning: boolean;
}

export interface SkyLevel {
   id: LevelId;
   /** the plan's level name (meta.ts titles) */
   name: string;
   /** run clock cap (ms): reaching it ends the run "timeup" (unranked). The plan's timer. */
   durationMs: number;
   /** null: the hand-built Training Sky course */
   tower: TowerSpec | null;
}

const cloud: TowerSpec = {
   goalTop: 100,
   climbs: 36,
   gap: 5.2,
   side: 1.5,
   width: 4.6,
   depth: 4.4,
   padEvery: 6,
   moverEvery: 5,
   moverTravel: 1.4,
   moverPeriod: 4600,
   checkpointEvery: 9,
   orbEvery: 3,
   wind: false,
   lightning: false,
};

const moving: TowerSpec = {
   goalTop: 150,
   climbs: 48,
   gap: 4.8,
   side: 1.8,
   width: 4.2,
   depth: 4.0,
   padEvery: 4,
   moverEvery: 5,
   moverTravel: 1.3,
   moverPeriod: 4800,
   checkpointEvery: 12,
   orbEvery: 3,
   wind: false,
   lightning: false,
};

const storm: TowerSpec = {
   goalTop: 220,
   climbs: 60,
   gap: 4.7,
   side: 2.0,
   width: 3.5,
   depth: 3.4,
   padEvery: 3,
   moverEvery: 4,
   moverTravel: 1.7,
   moverPeriod: 3000,
   checkpointEvery: 15,
   orbEvery: 4,
   wind: true,
   lightning: true,
};

const infinite: TowerSpec = {
   goalTop: 300,
   climbs: 84,
   gap: 4.9,
   side: 2.0,
   width: 3.3,
   depth: 3.3,
   padEvery: 3,
   moverEvery: 4,
   moverTravel: 1.5,
   moverPeriod: 4000,
   checkpointEvery: 16,
   orbEvery: 4,
   wind: true,
   lightning: true,
};

export const LEVELS: Record<LevelId, SkyLevel> = {
   1: { id: 1, name: "Training Sky", durationMs: 90_000, tower: null },
   2: { id: 2, name: "Cloud Steps", durationMs: 120_000, tower: cloud },
   3: { id: 3, name: "Moving Platforms", durationMs: 150_000, tower: moving },
   4: { id: 4, name: "Storm Heights", durationMs: 180_000, tower: storm },
   5: { id: 5, name: "Infinite Tower", durationMs: 240_000, tower: infinite },
};
