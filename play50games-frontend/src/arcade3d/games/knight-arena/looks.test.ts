// Per-level look for knight-arena (looks.ts): level 1 is byte-identical to today's scene, every
// level's look differs, and all scenery props stay outside the fenced play area.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "../../types";
import { DECOR_RADIUS_M, LEVEL_LOOKS } from "./looks";
import { ARENA, POSTS, TARGETS } from "./rules";

describe("knight-arena looks: per-level scenery", () => {
   it("level 1 is today's scene: palette, backdrop and no decor", () => {
      const look = LEVEL_LOOKS[1];
      expect(look.skyTop).toBe("#1e1b4b");
      expect(look.skyBottom).toBe("#fdba74");
      expect(look.grass).toBe("#557a3a");
      expect(look.floor).toBe("#c7a36e");
      expect(look.curb).toBe("#8a857d");
      expect(look.banner).toBe("#2563eb");
      expect(look.towers).toEqual(ARENA.TOWER_POSITIONS);
      expect(look.trees).toEqual(ARENA.TREE_POSITIONS);
      expect(look.decor).toEqual([]);
   });

   it("every level's look differs from every other level's", () => {
      for (const a of LEVEL_IDS) {
         for (const b of LEVEL_IDS) {
            if (a >= b) continue;
            expect(JSON.stringify(LEVEL_LOOKS[a]), `L${a} vs L${b}`).not.toBe(JSON.stringify(LEVEL_LOOKS[b]));
         }
      }
      // and not merely by name: levels 2-5 all have scenery of their own
      for (const id of [2, 3, 4, 5] as const) {
         expect(LEVEL_LOOKS[id].decor.length, `L${id} has set pieces`).toBeGreaterThan(0);
      }
   });

   it("levels 2-5 dress for their names: day field, torch-lit course, night fires, royal court", () => {
      expect(LEVEL_LOOKS[2].decor.map((d) => d.kind)).toContain("tent");
      expect(LEVEL_LOOKS[3].decor.map((d) => d.kind)).toContain("hourglass");
      expect(LEVEL_LOOKS[3].decor.filter((d) => d.kind === "torch").length).toBeGreaterThanOrEqual(4);
      expect(LEVEL_LOOKS[4].decor.map((d) => d.kind)).toContain("brazier");
      expect(LEVEL_LOOKS[5].decor.map((d) => d.kind)).toContain("throne");
      expect(LEVEL_LOOKS[5].banner).not.toBe(LEVEL_LOOKS[1].banner);
   });

   it("props stay out of the play area: body clear of the fence, discs, posts and the knight", () => {
      for (const id of LEVEL_IDS) {
         for (const d of LEVEL_LOOKS[id].decor) {
            const clearance = Math.hypot(d.x, d.z) - DECOR_RADIUS_M[d.kind];
            expect(clearance, `L${id} ${d.kind} at (${d.x}, ${d.z})`).toBeGreaterThanOrEqual(ARENA.RADIUS_M + 0.3);
            // never on top of a target post (far ring + disc) or the knight at the origin
            for (const post of POSTS) {
               const dist = Math.hypot(d.x - post.x, d.z - post.z);
               expect(dist, `L${id} ${d.kind} vs post ${post.index}`).toBeGreaterThan(DECOR_RADIUS_M[d.kind] + TARGETS.DISC_RADIUS_M);
            }
            expect(Math.hypot(d.x, d.z)).toBeGreaterThan(DECOR_RADIUS_M[d.kind] + 1.0);
         }
      }
   });

   it("backdrop trees and towers also stay outside the fence", () => {
      for (const id of LEVEL_IDS) {
         const look = LEVEL_LOOKS[id];
         for (const [x, z] of [...look.trees, ...look.towers]) {
            expect(Math.hypot(x, z), `L${id} backdrop at (${x}, ${z})`).toBeGreaterThan(ARENA.RADIUS_M);
         }
      }
   });
});
