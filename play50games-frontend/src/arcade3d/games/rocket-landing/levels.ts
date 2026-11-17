import type { LevelId } from "@/arcade3d/types";

/**
 * One landing of a level (rules.ts `worldsOf`): its gravity, pad width and fuel, how it is dressed
 * (`look`, an index into looks.ts PLANET_LOOKS) and its hazards. `wind` scales the level's
 * windAmplitude (0 = calm), `swing` makes the pad slide on a rail (the level's padAmplitude, 16 s
 * period), `roof` closes the sky over the pad with the cavern slab (enter from a side shaft), and
 * `towers` stands two rock towers beside the pad (rules.ts TOWER: under the cruise height).
 * Level 1 has no `worlds`: it flies today's five planets (rules.ts PLANETS) exactly.
 */
export interface World {
   name: string;
   gravity: number;
   width: number;
   fuel: number;
   look: number;
   wind: number;
   swing: boolean;
   roof: boolean;
   towers: boolean;
}

const w = (name: string, gravity: number, width: number, fuel: number, look: number, extra: Partial<Pick<World, "wind" | "swing" | "roof" | "towers">> = {}): World =>
   ({ name, gravity, width, fuel, look, wind: 0, swing: false, roof: false, towers: false, ...extra });

/** Look indices (looks.ts PLANET_LOOKS): 0-4 today's planets, then one family per level. */
export const LOOK = { moon: 0, desert: 1, ice: 2, gas: 3, asteroid: 4, crater: 5, dustBasin: 6, mars: 7, marsStorm: 8, cavern: 9, gale: 10, precision: 11, dock: 12 } as const;

export interface RocketLevel {
   id: LevelId;
   title: string;
   planets: number;
   durationMs: number;
   windAmplitude: number;
   padAmplitude: number;
   contactVy: number;
   contactAngle: number;
   cleanBonus: number;
   clearScore: number;
   /** the five landings (absent on level 1: today's planets) */
   worlds?: readonly World[];
}

export const LEVELS: Record<LevelId, RocketLevel> = {
   1: {
      id: 1,
      title: "Five Worlds",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.4,
      padAmplitude: 2.0,
      contactVy: 2.0,
      contactAngle: Math.PI / 18,
      cleanBonus: 300,
      clearScore: 2000,
   },
   2: {
      id: 2,
      title: "Breezy Approach",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.44,
      padAmplitude: 2.1,
      contactVy: 1.85,
      contactAngle: Math.PI / 19,
      cleanBonus: 500,
      clearScore: 2050,
      // Wide Crater: five landings inside one big crater, a steady breeze on the middle three (a
      // windsock shows it), wide pads, and the last pad rides a sled along the crater floor.
      worlds: [
         w("Crater Rim", 1.6, 6, 100, LOOK.crater),
         w("Dust Basin", 2.2, 5.5, 100, LOOK.dustBasin, { wind: 0.8 }),
         w("Breezy Floor", 3, 5.5, 100, LOOK.crater, { wind: 1 }),
         w("Twin Craters", 2.5, 5, 95, LOOK.dustBasin, { wind: 1 }),
         w("Crater Sled", 1.4, 5, 95, LOOK.crater, { swing: true }),
      ],
   },
   3: {
      id: 3,
      title: "Turbulent Orbit",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.48,
      padAmplitude: 2.2,
      contactVy: 1.75,
      contactAngle: Math.PI / 20,
      cleanBonus: 700,
      clearScore: 2100,
      // Mars Ridge: red rock towers stand beside the pads (stay high until lined up), dust-storm
      // turbulence on two landings, and the last pad slides along the ridge.
      worlds: [
         w("Red Plain", 3.7, 5.5, 100, LOOK.mars, { towers: true }),
         w("Ridge Gap", 3, 5, 100, LOOK.mars, { towers: true, wind: 0.8 }),
         w("Dust Storm", 3, 5, 95, LOOK.marsStorm, { wind: 1.15 }),
         w("Canyon Ledge", 3.7, 4.5, 95, LOOK.mars, { towers: true }),
         w("Olympus Rail", 2.5, 4.5, 90, LOOK.marsStorm, { swing: true }),
      ],
   },
   4: {
      id: 4,
      title: "High Winds & Cavern",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.52,
      padAmplitude: 2.3,
      contactVy: 1.65,
      contactAngle: Math.PI / 22,
      cleanBonus: 900,
      clearScore: 2150,
      // High Winds & Cavern: crystal caverns whose roof closes over the pad (enter from a side
      // shaft), a gale ridge in between, and a storm cavern with a sliding pad.
      worlds: [
         w("Cave Mouth", 1.6, 5.5, 100, LOOK.gale),
         w("Crystal Cavern", 1.2, 5, 95, LOOK.cavern, { roof: true }),
         w("Gale Ridge", 2.5, 5, 95, LOOK.gale, { wind: 1.05 }),
         w("Deep Cavern", 1.4, 4.5, 90, LOOK.cavern, { roof: true }),
         w("Storm Cavern", 1, 4, 85, LOOK.cavern, { roof: true, swing: true }),
      ],
   },
   5: {
      id: 5,
      title: "Precision Landing",
      planets: 5,
      durationMs: 240_000,
      windAmplitude: 0.55,
      padAmplitude: 2.4,
      contactVy: 1.5,
      contactAngle: Math.PI / 24,
      cleanBonus: 1100,
      clearScore: 2200,
      // Precision Landing: a night beacon field of needle-narrow pads, two on rails, one in the
      // wind, and a final orbital dock (rail pad under a roof).
      worlds: [
         w("Beacon Field", 1.6, 3.9, 100, LOOK.precision),
         w("Needle Pad", 2.5, 3.6, 95, LOOK.precision),
         w("Shuttle Rail", 1.6, 3.9, 95, LOOK.dock, { swing: true }),
         w("Windward Needle", 2.5, 3.8, 90, LOOK.precision, { wind: 1 }),
         w("Orbital Dock", 1, 3.6, 85, LOOK.dock, { roof: true, swing: true }),
      ],
   },
};
