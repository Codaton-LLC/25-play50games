// course.ts: every level's climb is built from its card (counts, heights, beats), is reachable ledge to
// ledge with the real jump numbers, and the side things (galleries, the lantern room, the express
// column, the arena) are where the rules expect them.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { DECK_R, GALLERY_RING, LEDGE_R, RIM, ROOM_RING, WALL_RING, courseFor } from "./course";
import { LEVELS } from "./levels";
import { GRAV, LAND_SLACK, V_BOUNCE, V_JUMP, V_WALK } from "./rules";

const APEX = (V_JUMP * V_JUMP) / (2 * GRAV);
const BOUNCE_APEX = (V_BOUNCE * V_BOUNCE) / (2 * GRAV);

/** The farthest a flight reaches (m) from a ledge onto a pad `rise` higher (walking speed in the air). */
function reach(rise: number, v0: number): number {
   const disc = v0 * v0 - 2 * GRAV * rise;
   return disc < 0 ? 0 : V_WALK * ((v0 + Math.sqrt(disc)) / GRAV);
}

describe("the five courses", () => {
   it("match the card: lantern counts 9 / 12 / 15 / 18 / 21, heights 12 / 20 / 28 / 36 / 40 m", () => {
      expect(LEVEL_IDS.map((id) => courseFor(id).lanterns.length)).toEqual([9, 12, 15, 18, 21]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].height)).toEqual([12, 20, 28, 36, 40]);
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.pads[c.chain[0]].kind).toBe("deck");
         expect(c.pads[c.chain.at(-1)!].y).toBeCloseTo(LEVELS[id].height, 6);
         expect(c.goal).toBe(c.chain.at(-1));
         expect(c.pads[c.goal].kind).toBe(LEVELS[id].boss ? "lantern" : "goal");
         expect(courseFor(id)).toBe(c);
      }
   });

   it("is the same every time (one course per level, no random)", () => {
      for (const id of LEVEL_IDS) {
         const a = courseFor(id);
         expect(a.pads.map((p) => [p.kind, p.x, p.y, p.z])).toEqual(courseFor(id).pads.map((p) => [p.kind, p.x, p.y, p.z]));
      }
   });

   it("level 1 teaches in three beats: plain ledges first, glyph ledges after, a long dark stretch of six", () => {
      const c = courseFor(1);
      const kinds = c.chain.map((id) => c.pads[id].kind);
      const firstGlyph = kinds.indexOf("glyph");
      expect(kinds.slice(0, firstGlyph).filter((k) => k === "plain").length).toBeGreaterThanOrEqual(3);
      expect(kinds.slice(0, firstGlyph).filter((k) => k === "lantern").length).toBe(2);
      expect(LEVELS[1].gaps[5]).toBe(6);
      expect(c.pads[c.lanterns[0]].lantern).toBe(0);
      expect(c.decks.length).toBe(1);
   });

   it("every step of the climb can be made: the rise and the distance fit a jump (a bounce from a lantern)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (let i = 0; i < c.chain.length - 1; i++) {
            const a = c.pads[c.chain[i]];
            const b = c.pads[c.chain[i + 1]];
            const rise = b.y - a.y;
            const apex = a.kind === "lantern" ? BOUNCE_APEX : APEX;
            expect(rise, `L${id} step ${i}`).toBeLessThanOrEqual(apex - 0.15);
            const chord = Math.hypot(a.x - b.x, a.z - b.z);
            const v0 = a.kind === "lantern" ? V_BOUNCE : V_JUMP;
            // a jump from the rim of a to the rim of b
            expect(chord - a.r - b.r - 2 * LAND_SLACK, `L${id} step ${i} chord`).toBeLessThanOrEqual(reach(Math.max(0, rise), v0));
         }
      }
   });

   it("level 5: the climb ends on four lanterns in a row (the arena), under the Queen's roof; levels 1-4 end on a roof pad", () => {
      const c = courseFor(5);
      expect(c.arena.length).toBe(4);
      const idx = c.arena.map((id) => c.chain.indexOf(id));
      expect(idx).toEqual([idx[0], idx[0] + 1, idx[0] + 2, idx[0] + 3]);
      expect(idx[3]).toBe(c.chain.length - 1);
      expect(c.roofBrazier).not.toBeNull();
      expect(c.roofY).toBeGreaterThan(c.top + BOUNCE_APEX);
      for (const id of [1, 2, 3, 4] as const) {
         expect(courseFor(id).arena.length).toBe(0);
         expect(courseFor(id).roofBrazier).toBeNull();
      }
   });
});

describe("the side things", () => {
   it("five orbs a level, two in dark galleries with a brazier each, three above ledges", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.orbs.length).toBe(5);
         expect(c.orbs.filter((o) => o.gallery).length).toBe(2);
         expect(c.braziers.length).toBe(2);
         for (const b of c.braziers) {
            const g = c.pads[b.pad];
            expect(g.kind).toBe("gallery");
            expect(Math.hypot(g.x, g.z)).toBeCloseTo(GALLERY_RING, 5);
            expect(Math.hypot(b.x - g.x, b.z - g.z)).toBeLessThan(g.r);
         }
         for (const o of c.orbs.filter((q) => !q.gallery)) {
            const pad = c.pads.find((p) => Math.hypot(p.x - o.x, p.z - o.z) < 0.01)!;
            expect(["glyph", "plain", "balcony"]).toContain(pad.kind);
            expect(o.y - pad.y).toBeCloseTo(1.9, 6);
         }
      }
   });

   it("a gallery is one jump from its ledge (a gap of about 2 m) and inside the rim", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (const b of c.braziers) {
            const g = c.pads[b.pad];
            const near = c.chain
               .map((i) => c.pads[i])
               .filter((p) => p.kind !== "lantern")
               .sort((p, q) => Math.hypot(p.x - g.x, p.z - g.z) - Math.hypot(q.x - g.x, q.z - g.z))[0];
            const gap = Math.hypot(near.x - g.x, near.z - g.z) - near.r - g.r;
            expect(gap).toBeGreaterThan(0.5);
            expect(gap).toBeLessThan(3.2);
            expect(Math.hypot(g.x, g.z) + g.r).toBeLessThan(WALL_RING + 0.5);
         }
      }
   });

   it("the hidden lantern room sits beyond the ghost wall, with a stepping ledge in front of it", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const room = c.pads[c.room];
         expect(room.kind).toBe("lantern");
         expect(room.lantern).toBe(-1);
         expect(Math.hypot(room.x, room.z)).toBeCloseTo(ROOM_RING, 5);
         expect(Math.hypot(room.x, room.z) - room.r).toBeGreaterThan(WALL_RING);
         expect(Math.hypot(room.x, room.z) + room.r).toBeLessThan(RIM);
      }
   });

   it("an express column through a fire jet from level 2 (three ledges on the axis); none on level 1", () => {
      expect(courseFor(1).jet).toBeNull();
      for (const id of [2, 3, 4, 5] as const) {
         const c = courseFor(id);
         expect(c.jet).not.toBeNull();
         expect(c.express.length).toBe(3);
         for (const e of c.express) {
            const p = c.pads[e];
            expect(Math.hypot(p.x, p.z)).toBe(0);
            expect(p.y).toBeGreaterThan(c.jet!.y0);
            expect(p.y).toBeLessThan(c.jet!.y1);
         }
      }
   });

   it("three bats on level 4 only, three ember sparks a level, two twin plates on level 1", () => {
      expect(LEVEL_IDS.map((id) => courseFor(id).bats.length)).toEqual([0, 0, 0, 3, 0]);
      for (const id of LEVEL_IDS) expect(courseFor(id).sparks.length).toBe(3);
      expect(courseFor(1).plates.length).toBe(2);
      expect(courseFor(2).plates.length).toBe(0);
   });

   it("checkpoint decks: one on level 1, three from level 2 (the start and two more)", () => {
      expect(LEVEL_IDS.map((id) => courseFor(id).decks.length)).toEqual([1, 3, 3, 3, 3]);
      for (const id of [2, 3, 4, 5] as const) {
         const c = courseFor(id);
         for (const d of c.decks.slice(1)) expect(c.pads[d].r).toBe(DECK_R);
      }
      expect(LEDGE_R).toBeLessThan(DECK_R);
   });
});
