// Temple Lantern Jump's five levels: pure data (no React, no three.js). core/README.md "Levels".

// A rising step stays under the jump apex. A flat step is a same-height landing between rises.
import type { LevelId } from "@/arcade3d/types";

export interface TempleSpec {
   /** platforms including the start balcony and the goal roof */
   surfaces: number;
   /** the goal roof's top (m) */
   goalTop: number;
   /** how far a lantern bounce pad throws the hero up (m, under the launch apex): the climb's big steps */
   padRise: number;
   /** the lanterns stand at x = +-side and throw you to the balcony across the courtyard */
   side: number;
   /** centre-to-centre step toward -z (m) */
   gap: number;
   /** balcony width (x) and depth (z), metres */
   width: number;
   depth: number;
   /** every Nth plain middle balcony swings (a swinging deck); 0 = none */
   moverEvery: number;
   moverTravel: number;
   moverPeriod: number;
   /** every Nth static plain middle balcony is a paper floor that tears away and returns; 0 = none */
   vanishEvery: number;
   /** every Nth remaining plain middle balcony is polished wood (low traction); 0 = none */
   slipEvery: number;
   /** every Nth group's middle balcony is a lantern-lighting checkpoint */
   checkpointEvery: number;
   /** a coin on every Nth gap */
   orbEvery: number;
   /** bells that swing out and strike the rim of some balconies */
   sparks: boolean;
   /** hillside wind gusts while airborne */
   wind: boolean;
}

export interface TempleLevel {
   id: LevelId;
   /** the plan's level name (meta.ts titles) */
   name: string;
   /** run clock cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   spec: TempleSpec;
}

// The courtyard climb (temple.ts): groups of three. A lantern bounce pad on one side of the courtyard throws
// the hero a big step up to a balcony on the other side (the only way up that step: a jump reaches 3.3 m, a pad 8 m),
// then a short hop to a middle balcony, then the next lantern. Level 1 is gentle; later levels add swinging decks,
// paper floors that tear away, polished wood and bells that strike the rims.
const base = { moverTravel: 1.3, moverPeriod: 4200 } as const;

const gate: TempleSpec = {
   ...base,
   surfaces: 10,
   goalTop: 24,
   padRise: 5.2,
   side: 3.1,
   gap: 3.8,
   width: 5.2,
   depth: 3.6,
   moverEvery: 0,
   vanishEvery: 0,
   slipEvery: 0,
   checkpointEvery: 2,
   orbEvery: 2,
   sparks: false,
   wind: false,
};

const hall: TempleSpec = {
   ...base,
   surfaces: 14,
   goalTop: 34,
   padRise: 5.6,
   side: 3.2,
   gap: 3.8,
   width: 5.0,
   depth: 3.5,
   moverEvery: 2,
   vanishEvery: 0,
   slipEvery: 0,
   checkpointEvery: 3,
   orbEvery: 2,
   sparks: false,
   wind: false,
};

const balcony: TempleSpec = {
   ...base,
   surfaces: 18,
   goalTop: 44,
   padRise: 6.0,
   side: 3.3,
   gap: 3.7,
   width: 4.8,
   depth: 3.4,
   moverEvery: 2,
   moverTravel: 1.5,
   moverPeriod: 3600,
   vanishEvery: 3,
   slipEvery: 1,
   checkpointEvery: 3,
   orbEvery: 3,
   sparks: false,
   wind: false,
};

const night: TempleSpec = {
   ...base,
   surfaces: 22,
   goalTop: 54,
   padRise: 6.3,
   side: 3.4,
   gap: 3.6,
   width: 4.5,
   depth: 3.3,
   moverEvery: 2,
   moverTravel: 1.6,
   moverPeriod: 3200,
   vanishEvery: 3,
   slipEvery: 0,
   checkpointEvery: 3,
   orbEvery: 3,
   sparks: true,
   wind: false,
};

const roof: TempleSpec = {
   ...base,
   surfaces: 28,
   goalTop: 68,
   padRise: 6.6,
   side: 3.5,
   gap: 3.6,
   width: 4.4,
   depth: 3.2,
   moverEvery: 2,
   moverTravel: 1.6,
   moverPeriod: 3000,
   vanishEvery: 3,
   slipEvery: 5,
   checkpointEvery: 3,
   orbEvery: 3,
   sparks: true,
   wind: true,
};

export const LEVELS: Record<LevelId, TempleLevel> = {
   1: { id: 1, name: "Temple Gate", durationMs: 90_000, spec: gate },
   2: { id: 2, name: "Lantern Hall", durationMs: 120_000, spec: hall },
   3: { id: 3, name: "Balcony Climb", durationMs: 150_000, spec: balcony },
   4: { id: 4, name: "Night Temple", durationMs: 180_000, spec: night },
   5: { id: 5, name: "Golden Roof", durationMs: 240_000, spec: roof },
};
