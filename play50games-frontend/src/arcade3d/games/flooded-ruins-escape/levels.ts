// Flooded Ruins Escape's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One ruin shaft (roofs.ts) and five configurations: layout, movers, sinking ledges, slick stone, current, jets.
// A rising step stays under the jump apex. A flat step is a same-height landing between rises.
import type { LevelId } from "@/arcade3d/types";

export interface RoofSpec {
   /** the shape of the course: doubling-back rows, or a spiral round the flooded shaft */
   layout: "switchback" | "spiral";
   /** spiral: how much the ring narrows per lap (m); 0 for a switchback */
   shrink: number;
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
   /** sideways gusts while airborne (none in the ruins) */
   wind: boolean;
   /** water jets on the rim of some ledges (shield and phase get through them) */
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

// Ruins layouts (roofs.ts): "switchback" rows of ledges that double back on each other (gentle levels), and a
// "spiral" of ledges that winds round the central flooded shaft and narrows as it climbs. `gap` is the
// centre-to-centre step along the path, `side` the switchback's half-length or the spiral's first half-size.
// Crumbling stones are the vanishing ledges, levers are the checkpoints (each lowers the water for a while).
const base = { moverTravel: 1.2, moverPeriod: 4400, wind: false, sparks: false } as const;

const low: RoofSpec = {
   ...base,
   layout: "switchback",
   surfaces: 10,
   rises: 8,
   goalTop: 16,
   gap: 6.6,
   side: 9.9,
   width: 5.8,
   depth: 5.0,
   shrink: 0,
   moverEvery: 0,
   vanishEvery: 0,
   slipEvery: 0,
   checkpointEvery: 4,
   orbEvery: 2,
};

const hall: RoofSpec = {
   ...base,
   layout: "switchback",
   surfaces: 15,
   rises: 12,
   goalTop: 22,
   gap: 6.4,
   side: 9.6,
   width: 5.4,
   depth: 4.6,
   shrink: 0,
   moverEvery: 5,
   moverTravel: 1.3,
   vanishEvery: 0,
   slipEvery: 0,
   checkpointEvery: 6,
   orbEvery: 2,
};

const stairs: RoofSpec = {
   ...base,
   layout: "spiral",
   surfaces: 19,
   rises: 16,
   goalTop: 30,
   gap: 6.2,
   side: 9.3,
   width: 5.0,
   depth: 4.4,
   shrink: 1.4,
   moverEvery: 0,
   vanishEvery: 3,
   slipEvery: 5,
   checkpointEvery: 6,
   sparks: true,
   orbEvery: 3,
};

const rising: RoofSpec = {
   ...base,
   layout: "spiral",
   surfaces: 24,
   rises: 21,
   goalTop: 38,
   gap: 6.0,
   side: 9.0,
   width: 4.6,
   depth: 4.1,
   shrink: 1.5,
   moverEvery: 4,
   moverTravel: 1.5,
   moverPeriod: 3200,
   vanishEvery: 3,
   slipEvery: 0,
   checkpointEvery: 7,
   sparks: true,
   orbEvery: 3,
};

const temple: RoofSpec = {
   ...base,
   layout: "spiral",
   surfaces: 30,
   rises: 26,
   goalTop: 46,
   gap: 5.9,
   side: 9.0,
   width: 4.5,
   depth: 4.0,
   shrink: 1.7,
   moverEvery: 4,
   moverTravel: 1.5,
   moverPeriod: 3000,
   vanishEvery: 3,
   slipEvery: 5,
   checkpointEvery: 7,
   sparks: true,
   orbEvery: 3,
};

export const LEVELS: Record<LevelId, RoofLevel> = {
   1: { id: 1, name: "Ruined Gate", durationMs: 90_000, spec: low },
   2: { id: 2, name: "Flooded Hall", durationMs: 120_000, spec: hall },
   3: { id: 3, name: "Sunken Stairs", durationMs: 150_000, spec: stairs },
   4: { id: 4, name: "Rising Water", durationMs: 180_000, spec: rising },
   5: { id: 5, name: "Temple Escape", durationMs: 210_000, spec: temple },
};
