// The five climbs (course.ts from levels.ts beats): the route starts on the start branch and ends on the
// goal (level 5: the arena), every gap is one a swing or a hop can make, the card's heights and beats
// are there (L1's three lessons, L2's bobbing, L3's dry vines and snappers, L4's arches and monkeys,
// L5's arena), five orbs on still vines, and the hidden places (hollow, canopy, glow vine) exist.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ORB_GRIP, PAD_UNDER_VINE, RING, TRUNK_R, VINE_OVER_PAD, courseFor, routePoint } from "./course";
import { GRIP_MAX, GRIP_MIN } from "./rules";

describe("jungle-vine-jump courses", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: a route from the start branch to the goal, every gap swingable or hoppable`, () => {
         const c = courseFor(id);
         const first = c.route[0];
         expect(c.pads[first.pad].kind).toBe("start");
         const last = c.route[c.route.length - 1];
         expect(last.pad).toBe(c.goal);
         expect(c.pads[c.goal].kind).toBe(c.cfg.boss ? "arena" : "goal");
         for (let k = 1; k < c.route.length; k++) {
            const a = c.route[k - 1];
            const b = c.route[k];
            const pa = a.pad >= 0 ? c.pads[a.pad] : c.vines[a.vine];
            const pb = b.pad >= 0 ? c.pads[b.pad] : c.vines[b.vine];
            const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
            if (a.vine >= 0 && b.vine >= 0) {
               // vine to vine: at most 8.5 m apart, the next anchor at most 2.5 m higher
               expect(d).toBeLessThanOrEqual(8.5);
               expect(pb.y - pa.y).toBeLessThanOrEqual(2.5);
            } else if (a.pad >= 0 && b.vine >= 0) {
               // platform to vine: a jump reaches its grip range
               expect(pb.y - pa.y).toBeCloseTo(VINE_OVER_PAD, 6);
               expect(d).toBeLessThanOrEqual(3.6 + c.pads[a.pad].r);
            } else if (a.vine >= 0 && b.pad >= 0) {
               expect(pa.y - pb.y).toBeCloseTo(PAD_UNDER_VINE, 6);
            } else {
               // a hop: at most 1.5 m up and 2.8 m round
               expect(pb.y - pa.y).toBeLessThanOrEqual(1.5 + 1e-9);
               expect(d).toBeLessThanOrEqual(2.8);
            }
         }
         // the grip range covers the jump in: a standing hero's hands are inside it
         expect(VINE_OVER_PAD - 1.4).toBeGreaterThanOrEqual(GRIP_MIN);
         expect(VINE_OVER_PAD - 1.4).toBeLessThanOrEqual(GRIP_MAX);
      });

      it(`L${id}: five orbs on still vines at the bot's grip, the hollow, the canopy and the glow vine`, () => {
         const c = courseFor(id);
         expect(c.orbs).toHaveLength(5);
         for (const o of c.orbs) {
            const v = c.vines[o.vine];
            expect(v.kind === "live" || v.kind === "glow").toBe(true);
            expect(o.y).toBeCloseTo(v.y - ORB_GRIP - 0.5, 9);
         }
         expect(c.pads[c.hollow].kind).toBe("hollow");
         expect(c.pads[c.canopy].kind).toBe("canopy");
         expect(c.glow).toBeGreaterThanOrEqual(0);
         expect(c.vines[c.glow].kind).toBe("glow");
         expect(c.emeralds.length).toBeGreaterThanOrEqual(6);
         // nothing on the route comes near the trunk
         for (const p of c.pads) expect(Math.hypot(p.x, p.z)).toBeGreaterThan(TRUNK_R + 0.5);
      });
   }

   it("the card's beats: heights, L1's net, L2's bobbing, L3's dry vines and snappers, L4's arches and monkeys, L5's arena", () => {
      const tops = LEVEL_IDS.map((id) => courseFor(id).top);
      expect(tops[0]).toBeGreaterThanOrEqual(30);
      expect(tops[3]).toBeGreaterThanOrEqual(70);
      expect(courseFor(1).pads.some((p) => p.kind === "net")).toBe(true);
      expect(courseFor(2).pads.some((p) => p.bob > 0)).toBe(true);
      expect(courseFor(2).vines.some((v) => v.bob > 0)).toBe(true);
      expect(courseFor(3).vines.filter((v) => v.kind === "dry").length).toBeGreaterThanOrEqual(5);
      expect(courseFor(3).snappers.length).toBeGreaterThan(0);
      expect(courseFor(4).vines.some((v) => v.kind === "arch")).toBe(true);
      expect(courseFor(4).monkeys).toHaveLength(3);
      expect(courseFor(5).arena).not.toBeNull();
      for (const id of [1, 2, 3, 4] as const) expect(courseFor(id).arena).toBeNull();
      // a dry vine is never the first after a platform (you would arrive with no swing to commit with)
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (let k = 1; k < c.route.length; k++) {
            if (c.route[k].vine >= 0 && c.route[k - 1].pad >= 0) expect(c.vines[c.route[k].vine].kind).not.toBe("dry");
         }
      }
   });

   it("the route circle: every stop on the ring round the trunk", () => {
      for (const u of [0, 7, 33.3, 100]) expect(Math.hypot(routePoint(u).x, routePoint(u).z)).toBeCloseTo(RING, 9);
   });
});
