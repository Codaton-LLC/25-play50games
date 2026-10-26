// Flooded Ruins Escape's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One ruin shaft (roofs.ts) and five configurations: layout, movers, sinking ledges, slick stone, current, jets.
// A rising step stays under the jump apex. A flat step is a same-height landing between rises.
import type { LevelId } from "@/arcade3d/types";

export interface RoofSpec {
   /** platforms including the start roof and the goal roof */
   surfaces: number;
   /** how many of the steps between them gain height (the plan's "climb N sections") */
   rises: number;
   /** the goal roof's top (m) */
   goalTop: number;
   /** centre-to-centre step toward -z (m) */
   gap: number;
   /** zigzag half-width (m): odd steps sit at -side, even steps at +side */
   side: number;
   /** roof width (x) and depth (z), metres */
   width: number;
   depth: number;
   /** every Nth roof that is not a checkpoint or the goal slides; 0 = none */
   moverEvery: number;
   moverTravel: number;
   moverPeriod: number;
   /** every Nth static roof blinks out; 0 = none */
   vanishEvery: number;
   /** every Nth static roof is icy (low traction); 0 = none */
   slipEvery: number;
   /** every Nth roof is a checkpoint plaza */
   checkpointEvery: number;
   /** a coin on every Nth gap */
   orbEvery: number;
   /** sideways gusts between towers, while airborne */
   wind: boolean;
   /** antenna arcs on the rim of some roofs */
   sparks: boolean;
}

export interface RoofLevel {
   id: LevelId;
   /** the plan's level name (meta.ts titles) */
   name: string;
   /** run clock cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   spec: RoofSpec;
}

const low: RoofSpec = {
   surfaces: 10,
   rises: 8,
   goalTop: 16,
   gap: 5.5,
   side: 1.05,
   width: 6.2,
   depth: 4.6,
   moverEvery: 0,
   moverTravel: 1.2,
   moverPeriod: 4400,
   vanishEvery: 0,
   slipEvery: 0,
   checkpointEvery: 4,
   orbEvery: 2,
   wind: false,
   sparks: false,
};

const office: RoofSpec = {
   surfaces: 14,
   rises: 12,
   goalTop: 22,
   gap: 5.35,
   side: 1.45,
   width: 5.4,
   depth: 4.2,
   moverEvery: 5,
   moverTravel: 1.25,
   moverPeriod: 4400,
   vanishEvery: 0,
   slipEvery: 0,
   checkpointEvery: 6,
   orbEvery: 2,
   wind: false,
   sparks: false,
};

const moving: RoofSpec = {
   surfaces: 18,
   rises: 16,
   goalTop: 30,
   gap: 5.25,
   side: 1.6,
   width: 5.2,
   depth: 4.1,
   moverEvery: 3,
   moverTravel: 1.35,
   moverPeriod: 3800,
   vanishEvery: 4,
   slipEvery: 5,
   checkpointEvery: 6,
   orbEvery: 3,
   wind: false,
   sparks: false,
};

const night: RoofSpec = {
   surfaces: 22,
   rises: 20,
   goalTop: 38,
   gap: 5.15,
   side: 1.9,
   width: 4.5,
   depth: 3.8,
   moverEvery: 3,
   moverTravel: 1.55,
   moverPeriod: 3000,
   vanishEvery: 4,
   slipEvery: 0,
   checkpointEvery: 7,
   orbEvery: 3,
   wind: true,
   sparks: true,
};

const high: RoofSpec = {
   surfaces: 28,
   rises: 25,
   goalTop: 46,
   gap: 5.1,
   side: 2.0,
   width: 4.6,
   depth: 4.0,
   moverEvery: 3,
   moverTravel: 1.45,
   moverPeriod: 3200,
   vanishEvery: 4,
   slipEvery: 5,
   checkpointEvery: 7,
   orbEvery: 3,
   wind: true,
   sparks: true,
};

export const LEVELS: Record<LevelId, RoofLevel> = {
   1: { id: 1, name: "Drain Entry", durationMs: 90_000, spec: low },
   2: { id: 2, name: "Pipe Maze", durationMs: 120_000, spec: office },
   3: { id: 3, name: "Valve Shaft", durationMs: 150_000, spec: moving },
   4: { id: 4, name: "Flood Rise", durationMs: 180_000, spec: night },
   5: { id: 5, name: "Final Escape", durationMs: 210_000, spec: high },
};
