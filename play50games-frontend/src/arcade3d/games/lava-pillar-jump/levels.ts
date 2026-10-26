// Lava Pillar Jump's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One volcanic cavern (pillars.ts): a sweeping route of uneven basalt pillars, five configurations: movers, sinking tops,
// ice, heat gusts, falling rocks, and how fast the lava rises.
// A rising step stays under the jump apex. A flat step is a same-height landing between rises.
import type { LevelId } from "@/arcade3d/types";

export interface LavaSpec {
   /** pillars including the start shelf and the goal shelf */
   surfaces: number;
   /** how many of the steps between them gain height */
   rises: number;
   /** the goal pillar's top (m) */
   goalTop: number;
   /** centre-to-centre step toward -z (m) */
   gap: number;
   /** the sweep's amplitude (m): the route swings +/-side across the cavern in long arcs (pillars.ts pillarXZ) */
   side: number;
   /** radians of the sweep per pillar, and the strength (0..1) of a second, faster swing riding on it */
   wave: number;
   harm: number;
   /** uneven basalt: each step up is 0.7x to 1.3x the even share, pillar tops vary in size */
   uneven: boolean;
   /** pillar top width (x) and depth (z), metres */
   width: number;
   depth: number;
   /** every Nth pillar that is not a checkpoint or the goal slides; 0 = none */
   moverEvery: number;
   moverTravel: number;
   moverPeriod: number;
   /** every Nth static pillar blinks out; 0 = none */
   vanishEvery: number;
   /** every Nth static pillar is glassy (low traction); 0 = none */
   slipEvery: number;
   /** every Nth static pillar sinks after you land; 0 = none */
   collapseEvery: number;
   /** every Nth pillar is a checkpoint shelf */
   checkpointEvery: number;
   /** an ember on every Nth gap */
   orbEvery: number;
   /** sideways heat gusts while airborne */
   wind: boolean;
   /** falling rocks on the rim of some pillars */
   sparks: boolean;
   /** lava surface at ms 0 (m), under the start shelf */
   lava0: number;
   /** how fast the lava rises (m/s) */
   lavaRate: number;
}

export interface LavaLevel {
   id: LevelId;
   /** the plan's level name (meta.ts titles) */
   name: string;
   /** run clock cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   spec: LavaSpec;
}

const low: LavaSpec = {
   surfaces: 10,
   rises: 8,
   goalTop: 16,
   gap: 5.6,
   side: 4.0,
   wave: 0.5,
   harm: 0.0,
   uneven: true,
   width: 6.0,
   depth: 4.6,
   moverEvery: 0,
   moverTravel: 1.2,
   moverPeriod: 4400,
   vanishEvery: 0,
   slipEvery: 0,
   collapseEvery: 0,
   checkpointEvery: 4,
   orbEvery: 2,
   wind: false,
   sparks: false,
   lava0: -4.5,
   lavaRate: 0.18,
};

const field: LavaSpec = {
   surfaces: 14,
   rises: 12,
   goalTop: 22,
   gap: 5.5,
   side: 5.2,
   wave: 0.55,
   harm: 0.0,
   uneven: true,
   width: 5.4,
   depth: 4.2,
   moverEvery: 5,
   moverTravel: 1.25,
   moverPeriod: 4400,
   vanishEvery: 0,
   slipEvery: 0,
   collapseEvery: 0,
   checkpointEvery: 6,
   orbEvery: 2,
   wind: false,
   sparks: false,
   lava0: -4.5,
   lavaRate: 0.28,
};

const rocks: LavaSpec = {
   surfaces: 18,
   rises: 16,
   goalTop: 30,
   gap: 5.4,
   side: 6.0,
   wave: 0.58,
   harm: 0.25,
   uneven: true,
   width: 5.0,
   depth: 4.1,
   moverEvery: 3,
   moverTravel: 1.35,
   moverPeriod: 3800,
   vanishEvery: 4,
   slipEvery: 5,
   collapseEvery: 7,
   checkpointEvery: 6,
   orbEvery: 3,
   wind: false,
   sparks: true,
   lava0: -4.5,
   lavaRate: 0.42,
};

const fast: LavaSpec = {
   surfaces: 22,
   rises: 20,
   goalTop: 38,
   gap: 5.3,
   side: 6.3,
   wave: 0.6,
   harm: 0.28,
   uneven: true,
   width: 4.6,
   depth: 3.9,
   moverEvery: 3,
   moverTravel: 1.55,
   moverPeriod: 3000,
   vanishEvery: 4,
   slipEvery: 0,
   collapseEvery: 5,
   checkpointEvery: 7,
   orbEvery: 3,
   wind: true,
   sparks: true,
   lava0: -4.5,
   lavaRate: 0.6,
};

const core: LavaSpec = {
   surfaces: 28,
   rises: 25,
   goalTop: 46,
   gap: 5.3,
   side: 6.0,
   wave: 0.6,
   harm: 0.3,
   uneven: true,
   width: 4.6,
   depth: 4.0,
   moverEvery: 3,
   moverTravel: 1.45,
   moverPeriod: 3200,
   vanishEvery: 4,
   slipEvery: 5,
   collapseEvery: 11,
   checkpointEvery: 7,
   orbEvery: 3,
   wind: true,
   sparks: true,
   lava0: -4.5,
   lavaRate: 0.8,
};

export const LEVELS: Record<LevelId, LavaLevel> = {
   1: { id: 1, name: "Warm Cavern", durationMs: 90_000, spec: low },
   2: { id: 2, name: "Pillar Field", durationMs: 120_000, spec: field },
   3: { id: 3, name: "Falling Rocks", durationMs: 150_000, spec: rocks },
   4: { id: 4, name: "Fast Lava", durationMs: 180_000, spec: fast },
   5: { id: 5, name: "Volcano Core", durationMs: 210_000, spec: core },
};
