// Lava Pillar Jump's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One volcanic cavern (pillars.ts): a sweeping route of uneven basalt pillars over a lava tide that
// surges on the volcano's heartbeat (World 1 card "4 Lava Pillar Jump"). Five configurations: the
// heartbeat, the vents that fire on it, sliding bridges, falling rocks, slugs, how fast the lava rises,
// and level 5's arena round Kalder the Magma Golem.
// A plain rising step stays under the jump apex; a vent step needs the vent's launch.
import type { LevelId } from "@/arcade3d/types";

/** A geyser vent on a pillar: it fires on the heartbeat (every `every`-th beat). */
export interface VentSpec {
   /** the pillar index (route order) */
   at: number;
   /** > 0: the next step up is this tall (m), too tall for a jump: only the vent's launch makes it */
   rise: number;
   /** fires on every beat (1) or only on every third (3: the level 3 secret vent) */
   every: number;
}

/** Level 5's arena: a ring of vent pillars round the golem, the route's last pillar is the ring's entry. */
export interface ArenaSpec {
   /** pillars in the ring (the entry included) */
   ring: number;
   /** the ring's radius (m), centre to pillar centre */
   radius: number;
   /** the ring pillars' half size (m) */
   half: number;
}

export interface LavaSpec {
   /** route pillars including the start shelf and the goal shelf (level 5: the arena entry) */
   surfaces: number;
   /** how many of the steps between them gain height */
   rises: number;
   /** the goal pillar's top (m); level 5: the arena's top */
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
   /** the slide's period (ms); 0 = one slide out and back per two heartbeats (bridges slide on the beat) */
   moverPeriod: number;
   /** every Nth static pillar blinks out; 0 = none */
   vanishEvery: number;
   /** every Nth static pillar is glassy (low traction); 0 = none */
   slipEvery: number;
   /** every Nth static pillar sinks after you land; 0 = none */
   collapseEvery: number;
   /** every Nth static pillar carries a magma slug: its top heats twice as fast; 0 = none */
   slugEvery: number;
   /** every Nth pillar is a checkpoint crystal */
   checkpointEvery: number;
   /** an ember on every Nth gap */
   orbEvery: number;
   /** sideways heat gusts while airborne */
   wind: boolean;
   /** rocks shaken loose on the rims of some pillars by each heartbeat */
   sparks: boolean;
   /** lava surface at ms 0 (m), under the start shelf */
   lava0: number;
   /** how fast the lava rises (m/s) */
   lavaRate: number;
   /** the steady rise stops here (m); null = never (level 5 holds it under the arena) */
   lavaCap: number | null;
   /** the heartbeat: a surge every beatMs (ms) */
   beatMs: number;
   vents: readonly VentSpec[];
   arena: ArenaSpec | null;
}

export interface LavaLevel {
   id: LevelId;
   /** the plan's level name (meta.ts titles) */
   name: string;
   /** run clock cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   spec: LavaSpec;
}

/** L1 Warm Cavern: learn the heat, outclimb the first surge, ride one vent on the beat to the exit ledge. */
const warm: LavaSpec = {
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
   slugEvery: 0,
   checkpointEvery: 3,
   orbEvery: 2,
   wind: false,
   sparks: false,
   lava0: -4.5,
   lavaRate: 0.18,
   lavaCap: null,
   beatMs: 6000,
   vents: [{ at: 8, rise: 4.4, every: 1 }],
   arena: null,
};

/** L2 Pillar Field: basalt bridges slide on the heartbeat, surges every 5 s, two vent climbs. */
const field: LavaSpec = {
   surfaces: 14,
   rises: 12,
   goalTop: 24,
   gap: 5.5,
   side: 5.2,
   wave: 0.55,
   harm: 0.0,
   uneven: true,
   width: 5.4,
   depth: 4.2,
   moverEvery: 5,
   moverTravel: 1.25,
   moverPeriod: 0,
   vanishEvery: 0,
   slipEvery: 0,
   collapseEvery: 0,
   slugEvery: 0,
   checkpointEvery: 4,
   orbEvery: 2,
   wind: false,
   sparks: false,
   lava0: -4.5,
   lavaRate: 0.28,
   lavaCap: null,
   beatMs: 5000,
   vents: [
      { at: 6, rise: 4.2, every: 1 },
      { at: 11, rise: 4.4, every: 1 },
   ],
   arena: null,
};

/** L3 Falling Rocks: every surge shakes rocks loose (shadows mark them), glassy and sinking shelves, a third-beat vent. */
const rocks: LavaSpec = {
   surfaces: 18,
   rises: 16,
   goalTop: 32,
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
   slugEvery: 0,
   checkpointEvery: 6,
   orbEvery: 3,
   wind: false,
   sparks: true,
   lava0: -4.5,
   lavaRate: 0.4,
   lavaCap: null,
   beatMs: 5000,
   vents: [
      { at: 10, rise: 0, every: 3 },
      { at: 16, rise: 4.4, every: 1 },
   ],
   arena: null,
};

/** L4 Fast Lava: magma slugs heat their tops twice as fast, surges every 4 s, narrower pillars. */
const fast: LavaSpec = {
   surfaces: 22,
   rises: 20,
   goalTop: 40,
   gap: 5.3,
   side: 6.3,
   wave: 0.6,
   harm: 0.28,
   uneven: true,
   width: 4.2,
   depth: 3.7,
   moverEvery: 3,
   moverTravel: 1.55,
   moverPeriod: 3000,
   vanishEvery: 4,
   slipEvery: 0,
   collapseEvery: 5,
   slugEvery: 2,
   checkpointEvery: 7,
   orbEvery: 3,
   wind: true,
   sparks: true,
   lava0: -4.5,
   lavaRate: 0.5,
   lavaCap: null,
   beatMs: 4000,
   vents: [
      { at: 10, rise: 4.3, every: 1 },
      { at: 20, rise: 4.4, every: 1 },
   ],
   arena: null,
};

/** L5 Volcano Core: everything on the way down to the core, then Kalder's ring of vent pillars. */
const core: LavaSpec = {
   surfaces: 16,
   rises: 14,
   goalTop: 28,
   gap: 5.3,
   side: 6.0,
   wave: 0.6,
   harm: 0.3,
   uneven: true,
   width: 4.6,
   depth: 4.0,
   moverEvery: 4,
   moverTravel: 1.45,
   moverPeriod: 3200,
   vanishEvery: 0,
   slipEvery: 0,
   collapseEvery: 7,
   slugEvery: 3,
   checkpointEvery: 5,
   orbEvery: 2,
   wind: false,
   sparks: true,
   lava0: -4.5,
   lavaRate: 0.6,
   lavaCap: 28 - 3.2,
   beatMs: 4000,
   vents: [{ at: 8, rise: 4.2, every: 1 }],
   arena: { ring: 6, radius: 7.5, half: 2.0 },
};

export const LEVELS: Record<LevelId, LavaLevel> = {
   1: { id: 1, name: "Warm Cavern", durationMs: 90_000, spec: warm },
   2: { id: 2, name: "Pillar Field", durationMs: 120_000, spec: field },
   3: { id: 3, name: "Falling Rocks", durationMs: 150_000, spec: rocks },
   4: { id: 4, name: "Fast Lava", durationMs: 180_000, spec: fast },
   5: { id: 5, name: "Volcano Core", durationMs: 240_000, spec: core },
};
