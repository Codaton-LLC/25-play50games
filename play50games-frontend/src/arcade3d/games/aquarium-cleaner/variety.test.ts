// Per-level variety: the five levels are five distinct maps with five distinct looks, and every
// set piece stays out of the play area. Pure checks (no three.js): reads the layout, the look
// and the seeded decor spots.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   archStations, causticsOf, fog, frameGlowOf, glowSpots, kelpSpots, lampSpots, lookOf, sandTint, waterTint, wreckAnchor,
} from "./looks";
import { CASTLE_PLACE, ROCK_PLACE, createRun, tankHalf } from "./rules";

describe("aquarium levels differ", () => {
   it("each level has its own map flavour and look", () => {
      const layouts = LEVEL_IDS.map((id) => LEVELS[id].layout);
      expect(new Set(layouts).size).toBe(5);
      const signatures = LEVEL_IDS.map((id) => {
         const level = LEVELS[id];
         const look = lookOf(level);
         return JSON.stringify([level.layout, level.lighting, level.background, fog(level), sandTint(level), waterTint(level), causticsOf(level), frameGlowOf(level), look.coralCount, look.schoolCount, look.kelpCount, look.arches, look.lamps, look.glowCount, look.wreck]);
      });
      expect(new Set(signatures).size).toBe(5);
      // the castle and the rocks hunt different boxes on different levels
      const castleBoxes = LEVEL_IDS.map((id) => JSON.stringify(CASTLE_PLACE[LEVELS[id].layout]));
      expect(new Set(castleBoxes).size).toBe(5);
      const rockSpecs = LEVEL_IDS.map((id) => JSON.stringify(ROCK_PLACE[LEVELS[id].layout]));
      expect(new Set(rockSpecs).size).toBe(5);
   });

   it("level 1 keeps the original look and map", () => {
      const level = LEVELS[1];
      expect(fog(level)).toEqual([level.background, 42, 120]);
      expect(sandTint(level)).toBe("#ffffff");
      expect(waterTint(level)).toBe("#0891b2");
      expect(causticsOf(level)).toBe(0.16);
      expect(frameGlowOf(level)).toBe(0.55);
      expect(lookOf(level).coralCount).toBe(5);
      expect(CASTLE_PLACE[level.layout]).toEqual({ x0: -0.3, x1: 0.3, z0: -0.4, z1: 0.05, scale: 1 });
      expect(ROCK_PLACE[level.layout]).toEqual({ extra: 0, zBack: false, zBackAt: 0, s0: 0.8, s1: 1.25 });
   });

   it("castle and rock placement honours the layout's hunting box (40 seeds x 5 levels)", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const { hx, hz } = tankHalf(level);
         const box = CASTLE_PLACE[level.layout];
         const spec = ROCK_PLACE[level.layout];
         for (let seed = 0; seed < 40; seed++) {
            const run = createRun(seed, level);
            const castle = run.solids.find((s) => s.kind === "castle")!;
            expect(castle.x).toBeGreaterThanOrEqual(hx * box.x0 - 1e-9);
            expect(castle.x).toBeLessThanOrEqual(hx * box.x1 + 1e-9);
            expect(castle.z).toBeGreaterThanOrEqual(hz * box.z0 - 1e-9);
            expect(castle.z).toBeLessThanOrEqual(hz * box.z1 + 1e-9);
            expect(castle.scale).toBeCloseTo(box.scale, 9);
            const rocks = run.solids.filter((s) => s.kind === "rock");
            expect(rocks.length).toBeLessThanOrEqual(3 + Math.floor(level.width / 8) + spec.extra);
            for (const r of rocks) {
               if (spec.zBack) expect(r.z).toBeLessThanOrEqual(-hz * spec.zBackAt + 1e-9);
               expect(r.scale).toBeGreaterThanOrEqual(spec.s0 - 1e-9);
               expect(r.scale).toBeLessThanOrEqual(spec.s1 + 1e-9);
            }
         }
      }
   });
});

describe("aquarium set pieces stay out of the play area", () => {
   it("tunnel arch legs land outside the glass, lamps on the back plinth, the rest on the back strip (80 seeds x 5 levels)", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const look = lookOf(level);
         const { hx, hz } = tankHalf(level);
         // tunnel ribs: legs at the plinth, crown above the glass
         for (const z of archStations(level)) {
            expect(Math.abs(z)).toBeLessThan(hz);
         }
         for (const lamp of lampSpots(level, look.lamps)) {
            expect(lamp.z).toBeLessThan(-hz);
            expect(Math.abs(lamp.x)).toBeLessThanOrEqual(hx);
         }
         for (let seed = 0; seed < 80; seed++) {
            const run = createRun(seed, level);
            // kelp and glow stalks hug the back glass or the side corners: inside the tank, never
            // in front of the diver's half, clear of the solids and the walk zones
            for (const spot of [...kelpSpots(run, look.kelpCount), ...glowSpots(run, look.glowCount)]) {
               expect(Math.abs(spot.x)).toBeLessThanOrEqual(hx - 0.5);
               expect(spot.z).toBeGreaterThanOrEqual(-hz + 0.4);
               expect(spot.z).toBeLessThanOrEqual(-hz + 1 + level.depth * 0.55);
               expect(run.solids.every((s) => Math.hypot(s.x - spot.x, s.z - spot.z) >= s.r + 0.6)).toBe(true);
               expect(run.algae.every((a) => Math.hypot(a.x - spot.x, a.z - spot.z) >= 1.6)).toBe(true);
               for (const zone of [run.entry, run.basket, run.column, run.hatch]) {
                  expect(Math.hypot(zone.x - spot.x, zone.z - spot.z)).toBeGreaterThan(2.8);
               }
            }
            // the sunken ruin lies against the back glass, inside the tank, clear of the solids' circles
            const wreck = wreckAnchor(run);
            expect(wreck.x).toBeGreaterThanOrEqual(-hx + 2);
            expect(wreck.x).toBeLessThanOrEqual(-hx + 4.2);
            expect(wreck.z).toBeGreaterThanOrEqual(-hz + 0.5);
            expect(wreck.z).toBeLessThanOrEqual(-hz + 1.4);
            expect(run.solids.every((s) => Math.hypot(s.x - wreck.x, s.z - wreck.z) >= s.r + 0.2)).toBe(true);
         }
      }
   });
});
