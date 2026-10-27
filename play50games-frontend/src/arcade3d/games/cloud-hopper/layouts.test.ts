// Cloud Hopper plays its own game (the card's GLIDE): a horizontal run across, not up; gaps a plain
// jump cannot clear, so you glide on feathers; clouds that sink under you; one new twist per level;
// and a hero-gated route or secret for every hero. These checks read only this game's own data, so
// they do not depend on any other game's code.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { SCRIPTS } from "./sea";
import { G, H_JUMP, V_GLIDE, V_JUMP, V_RUN, GLIDE_FALL, FEATHER, courseFor } from "./rules";

/** The furthest a plain jump carries forward and lands `drop` m lower (m): run speed over the flight. */
function plainReach(drop: number): number {
   const t = (V_JUMP + Math.sqrt(V_JUMP * V_JUMP + 2 * G * drop)) / G;
   return V_RUN * t;
}

describe("across, not up", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: the run is at least 30x longer than it is high, and it goes forward the whole way`, () => {
         const c = courseFor(id);
         const tops = c.route.map((i) => c.clouds[i].top);
         const span = Math.max(...tops) - Math.min(...tops);
         const length = c.startZ - c.goalNearZ;
         expect(length / Math.max(1, span)).toBeGreaterThan(30);
         expect(length).toBeGreaterThan(LEVELS[id].length - 20);
      });
   }
});

describe("the glide is the engine", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: glide gaps a plain jump cannot clear, each with a feather on its launch cloud, and one feather's glide clears them`, () => {
         const c = courseFor(id);
         let glideGaps = 0;
         for (let k = 1; k < c.route.length; k++) {
            const a = c.clouds[c.route[k - 1]];
            const b = c.clouds[c.route[k]];
            const gap = a.cz - a.hd - (b.cz + b.hd);
            const drop = Math.max(0, a.top - b.top);
            if (gap <= plainReach(drop) - 1) continue;
            glideGaps += 1;
            // a feather sits on the launch cloud
            expect(c.feathers.some((f) => Math.abs(f.z - a.cz) <= a.hd && Math.abs(f.x - a.cx) <= a.hw), `L${id} gap ${k}`).toBe(true);
            // a jump to the apex, then one feather's glide (plus a ring's second where there is one), lands it
            const ring = c.rings.some((r) => r.kind === "wind" && r.z < a.cz && r.z > b.cz) ? 1000 : 0;
            const reach = V_RUN * (V_JUMP / G) + (V_GLIDE * (FEATHER.glideMs + ring)) / 1000;
            expect(reach, `L${id} gap ${k}: ${gap} m`).toBeGreaterThan(gap);
         }
         expect(glideGaps, `L${id} glide gaps`).toBeGreaterThanOrEqual(4);
         // a glide falls far slower than a jump: 1.2 m/s against up to V_JUMP
         expect(GLIDE_FALL).toBeLessThan(V_JUMP / 10);
         expect(H_JUMP).toBeLessThan(3);
      });
   }

   it("most clouds sink under you (the run never lets you stand still)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const route = c.route.map((i) => c.clouds[i]).filter((x) => x.kind === "cloud");
         const sinking = route.filter((x) => x.sinks).length;
         expect(sinking / route.length, `L${id}`).toBeGreaterThan(id === 4 ? 0.4 : 0.8);
      }
   });
});

describe("one twist per level (the card)", () => {
   it("L2 drifting clouds, L3 wind bands (head, tail, cross), L4 pulse clouds and thunder strikes, L5 Gloom Nimbus with three rods", () => {
      const d = (id: 1 | 2 | 3 | 4 | 5) => courseFor(id);
      expect(d(1).clouds.some((c) => c.drift || c.pulse)).toBe(false);
      expect(d(1).bands).toHaveLength(0);
      expect(d(2).clouds.filter((c) => c.drift).length).toBeGreaterThanOrEqual(8);
      expect(d(3).bands.some((b) => b.wz < 0) && d(3).bands.some((b) => b.wz > 0) && d(3).bands.some((b) => b.wx !== 0)).toBe(true);
      expect(d(3).orbs.some((o) => o.kind === "main" && d(3).bands.some((b) => b.wz < 0 && o.z <= b.z0 && o.z > b.z1) && !d(3).clouds.some((c) => Math.abs(o.z - c.cz) <= c.hd))).toBe(true);
      expect(d(4).clouds.filter((c) => c.pulse).length).toBeGreaterThanOrEqual(8);
      expect(d(4).strikes.length).toBeGreaterThanOrEqual(3);
      expect(d(5).boss).toBe(true);
      expect(d(5).rods).toHaveLength(3);
      for (const id of [1, 2, 3, 4] as const) expect(d(id).boss).toBe(false);
      for (const id of LEVEL_IDS) expect(LEVELS[id].length).toBeGreaterThanOrEqual(250);
      expect(LEVELS[5].length).toBeLessThanOrEqual(600);
   });
});

describe("every hero matters (pillar 2)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: Riko's storm wall, Nami's sun shelf, Kiro's thunderhead orb, Zuno's hidden trail and Vexa's ghost veil are all on the level`, () => {
         const c = courseFor(id);
         const script = SCRIPTS[id];
         expect(c.walls.some((w) => w.kind === "storm"), "Riko").toBe(true);
         expect(c.clouds.some((x) => x.kind === "shelf"), "Nami").toBe(true);
         expect(c.orbs.some((o) => o.hero === "kiro"), "Kiro").toBe(true);
         expect(c.orbs.some((o) => o.hidden && o.hero === "zuno"), "Zuno").toBe(true);
         expect(c.walls.some((w) => w.kind === "ghost"), "Vexa").toBe(true);
         // the gated orbs are a bonus: the all-orbs star counts the main ones
         expect(c.mainOrbs).toBeLessThan(c.orbs.length);
         expect(c.mainOrbs).toBeGreaterThanOrEqual(15);
         expect(script.length).toBeGreaterThan(20);
      });
   }

   it("Nami's sun shelf is out of a plain jump's reach from the glide line, and inside a double jump's", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (const s of c.clouds.filter((x) => x.kind === "shelf")) {
            const launch = c.route.map((i) => c.clouds[i]).filter((x) => x.cz > s.cz).pop()!;
            expect(s.top - launch.top).toBeGreaterThan(H_JUMP + 0.5);
            expect(s.top - launch.top).toBeLessThan(H_JUMP + 2.2 + H_JUMP);
         }
      }
   });
});
