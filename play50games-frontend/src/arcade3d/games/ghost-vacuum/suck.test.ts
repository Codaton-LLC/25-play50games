import { describe, expect, it } from "vitest";
import { Matrix4, Vector3 } from "three";
import { createRun, HUNTER, PULL, pullPosition } from "./rules";
import { createSuckLook, suckLook, suckMatrix, suckScale, SUCK, type NozzleMouth } from "./suck";

// Pull starts the rules allow: inside the 12-degree / 4 m cone, or anywhere within the 0.6 m nozzle.
function* starts() {
   for (const d of [0.3, 0.55, 1, 2, 3, 4]) for (const deg of d <= PULL.nozzle ? [-150, -90, -30, 0, 45, 120, 180] : [-12, -6, 0, 6, 12]) yield { d, a: deg * Math.PI / 180 };
}
// Mouths around the right hand of the aiming hunter (forward reach, side offset, height).
const MOUTHS = [[0.45, -0.2, 0.8], [0.55, 0, 0.95], [0.7, 0.25, 1.1], [0.6, -0.1, 0.9], [0.42, -0.3, 0.9], [0.3, 0.4, 1]] as const;
const YAWS = [0, 1.1, Math.PI, -2.3];

function sweep(visit: (p: number, look: ReturnType<typeof createSuckLook>, m: NozzleMouth, hx: number, hz: number, ks: number) => void) {
   const run = createRun(7), g = run.ghosts[0], look = createSuckLook();
   for (const yaw of YAWS) for (const [reach, side, y] of MOUTHS) for (const { d, a } of starts()) for (const ks of [1, 1.2]) {
      const hx = 2, hz = -1, fx = Math.sin(yaw), fz = Math.cos(yaw);
      run.hunter.x = hx; run.hunter.z = hz; run.hunter.yaw = yaw;
      const m: NozzleMouth = { x: hx + fx * reach + fz * side, y, z: hz + fz * reach - fx * side, dirX: fx, dirZ: fz };
      g.ax = hx + Math.sin(yaw + a) * d; g.az = hz + Math.cos(yaw + a) * d; g.hx = hx; g.hz = hz; g.p0 = 0;
      for (let i = 0; i <= 100; i++) {
         g.progress = i / 100;
         if (i === 0) { g.x = g.ax; g.z = g.az; } else pullPosition(run, g);
         visit(g.progress, suckLook(g.progress, g.x, g.z, ks, 0.1 + SUCK.centreY * ks, hx, hz, m, look), m, hx, hz, ks);
      }
   }
}

describe("ghost suck-in look (visual only)", () => {
   it("shrinks monotonically to at most 0.15 at capture", () => {
      let last = Infinity;
      for (let i = 0; i <= 1000; i++) { const s = suckScale(i / 1000); expect(s).toBeLessThanOrEqual(last + 1e-12); last = s; }
      expect(suckScale(0)).toBe(1);
      expect(suckScale(1)).toBeLessThanOrEqual(0.15);
      expect(suckScale(0.6)).toBeGreaterThan(0.5); // most of the shrink is in the last 40 %
   });
   it("starts at the rules position and ends exactly at the nozzle mouth", () => {
      sweep((p, look, m, _hx, _hz, ks) => {
         if (p === 0) { expect(look.scale).toBe(ks); expect(look.stretch).toBe(1); }
         if (p === 1) { expect(Math.hypot(look.x - m.x, look.y - m.y, look.z - m.z)).toBeLessThan(1e-9); expect(look.scale).toBeLessThanOrEqual(0.15 * ks); }
      });
   });
   it("never draws the ghost over the hunter's body or behind the nozzle", () => {
      let worstClear = Infinity, worstAhead = Infinity;
      sweep((p, look, m, hx, hz, ks) => {
         if (p < SUCK.blendIn) return; // the first 15 % blends in from wherever the rules put the ghost
         const k = p <= SUCK.inStart ? 0 : 1, radius = SUCK.bodyRadius * look.scale;
         // Centre never inside the hunter's body; whole sheet clear of it until the suck-in starts.
         const d = Math.hypot(look.x - hx, look.z - hz);
         worstClear = Math.min(worstClear, d - HUNTER.radius - (k ? 0 : radius));
         // Never behind the mouth along the nozzle (it is drawn going INTO the mouth, not past it).
         const ahead = (look.x - m.x) * m.dirX + (look.z - m.z) * m.dirZ;
         if (Math.hypot(m.x - hx, m.z - hz) > HUNTER.radius + 0.05) worstAhead = Math.min(worstAhead, ahead);
         expect(look.scale).toBeLessThanOrEqual(ks + 1e-12);
      });
      expect(worstClear).toBeGreaterThanOrEqual(-1e-9);
      expect(worstAhead).toBeGreaterThanOrEqual(-1e-9);
   });
   it("builds a matrix that puts the body centre on the look and stretches along the axis", () => {
      const look = createSuckLook();
      const m: NozzleMouth = { x: 0.5, y: 1, z: 0.2, dirX: 0, dirZ: 1 };
      suckLook(0.8, 0.5, 2, 1, 0.9, 0, 0, m, look);
      const matrix = new Matrix4().fromArray(suckMatrix(look, new Array<number>(16).fill(0)));
      const centre = new Vector3(0, SUCK.centreY, 0).applyMatrix4(matrix);
      expect(centre.distanceTo(new Vector3(look.x, look.y, look.z))).toBeLessThan(1e-9);
      const axis = new Vector3(look.ax, look.ay, look.az);
      const stretched = axis.clone().applyMatrix4(matrix).sub(new Vector3().applyMatrix4(matrix)).length();
      expect(stretched).toBeCloseTo(look.scale * look.stretch, 9);
      expect(look.stretch).toBeGreaterThan(1.5);
   });
});
