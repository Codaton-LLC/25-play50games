// The course: five levels, each a chain of legs from pad to pad; the card's twists per level; the whip
// corners block a straight jump; every wall's tiles cover it; the secrets line up with progression.ts.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { G, V_JUMP, V_RUN, courseFor, createRun, createStepInput, step } from "./rules";
import { SECRETS } from "./progression";
import { tilesOf } from "./CourseView";

describe("the five levels", () => {
   it("each level is a chain of legs from the start pad to the finish, every pad on it a checkpoint", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.legs[0].from).toBe(0);
         expect(c.legs[c.legs.length - 1].to).toBe(c.finish);
         for (let k = 1; k < c.legs.length; k++) expect(c.legs[k].from).toBe(c.legs[k - 1].to);
         for (const l of c.legs) expect(c.pads[l.to].cp).toBe(true);
         expect(c.secrets).toHaveLength(SECRETS[id].length);
      }
   });

   it("the card's twists: L1 a floored first wall, L2 sliding panels, L3 column chains and spike panels, L4 crumbling walls and rams, L5 Umbra's arena", () => {
      expect(courseFor(1).pads.some((p) => p.kind === "floor")).toBe(true);
      expect(courseFor(2).walls.some((w) => w.kind === "moving")).toBe(true);
      expect(courseFor(3).legs.some((l) => l.kind === "whip" && l.columns.length >= 3)).toBe(true);
      expect(courseFor(3).spikes.length).toBeGreaterThanOrEqual(8);
      expect(courseFor(4).walls.filter((w) => w.kind === "crumble").length).toBeGreaterThanOrEqual(8);
      expect(courseFor(4).rams.length).toBeGreaterThanOrEqual(4);
      const a = courseFor(5).arena!;
      expect(a.mirror).toHaveLength(4);
      expect(a.hall.length).toBe(4);
      expect(a.shaft).toHaveLength(2);
      expect(courseFor(5).blocks.filter((b) => b.kind === "gate").map((b) => b.gatePhase)).toEqual([1, 2]);
   });

   it("no leg can be skipped with a plain jump: corridor pads are out of reach, and a whip corner's block stops the cut", () => {
      const reach = V_RUN * ((2 * V_JUMP) / G + 0.3) + 0.5;
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (const l of c.legs) {
            const a = c.pads[l.from];
            const b = c.pads[l.to];
            if (l.kind === "walls") {
               const gx = Math.max(0, Math.abs(a.x - b.x) - a.r - b.r);
               const gz = Math.max(0, Math.abs(a.z - b.z) - a.r - b.r);
               expect(Math.hypot(gx, gz), `L${id} leg ${l.from}->${l.to}`).toBeGreaterThan(reach);
               continue;
            }
            if (l.kind !== "whip") continue;
            // jump from every point of A's edge straight at B, whips turned off: never on B
            for (let k = 0; k <= 8; k++) {
               const run = createRun(1, id, "kiro");
               run.simMs = 30_000;
               run.colCooldown.fill(1e9);
               const h = run.hero;
               const t = k / 8;
               h.x = a.x + (b.x > a.x ? a.r - 0.1 : -(a.r - 0.1)) * (Math.abs(b.x - a.x) > 1 ? 1 : 0) + (Math.abs(b.x - a.x) > 1 ? 0 : (t - 0.5) * 2 * a.r);
               h.z = a.z + (b.z > a.z ? a.r - 0.1 : -(a.r - 0.1)) * (Math.abs(b.z - a.z) > 1 ? 1 : 0) + (Math.abs(b.z - a.z) > 1 ? 0 : (t - 0.5) * 2 * a.r);
               h.y = a.y;
               h.support = l.from;
               h.mode = "ground";
               const input = createStepInput();
               const dx = b.x - h.x;
               const dz = b.z - h.z;
               const d = Math.hypot(dx, dz);
               input.moveX = dx / d;
               input.moveZ = dz / d;
               input.jumpPressed = true;
               let landed = -1;
               for (let f = 0; f < 200 && run.hero.mode !== "lost"; f++) {
                  const ev = step(run, 16, input);
                  input.jumpPressed = false;
                  if (ev.landed) landed = ev.landedOn;
               }
               expect(landed, `L${id} whip leg ${l.from}->${l.to} from ${k}`).not.toBe(l.to);
            }
         }
      }
   });

   it("the wall tiles cover every wall exactly once", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const tiles = tilesOf(c.walls);
         c.walls.forEach((_, i) => expect(tiles.filter((t) => t.wall === i).length).toBeGreaterThan(0));
      }
   });
});
