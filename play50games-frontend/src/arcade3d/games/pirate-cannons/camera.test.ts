// The fixed camera (pure fitView, the same math useFittedView runs): the three lanes and the cannon's
// muzzle on screen at the three test sizes, with the cookie banner open and closed.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitView, type ScreenRect } from "@/arcade3d/core/view";
import { AIM } from "./aim";
import { FOV, SEA_BOX, SEA_FOCUS, viewFor } from "./looks";
import { muzzleAt } from "./rules";

/** Where a world point lands on the canvas (CSS px), with the fit's offset and lens shift. */
function project(width: number, height: number, banner: number) {
   const hud: ScreenRect = { left: 0, top: 0, right: width, bottom: 56 };
   const avoid = banner > 0 ? [hud, { left: 0, top: height - banner, right: width, bottom: height }] : [hud];
   const v = viewFor(width, height);
   const view = fitView({ ...v, width, height, fov: FOV, avoid });
   const camera = new PerspectiveCamera(FOV, width / height, 0.1, 400);
   camera.position.set(SEA_FOCUS[0] + view.offset[0], SEA_FOCUS[1] + view.offset[1], SEA_FOCUS[2] + view.offset[2]);
   camera.lookAt(...SEA_FOCUS);
   camera.setViewOffset(width, height, (-view.shift[0] * width) / 2, (view.shift[1] * height) / 2, width, height);
   camera.updateMatrixWorld();
   camera.updateProjectionMatrix();
   return (x: number, y: number, z: number) => {
      const p = new Vector3(x, y, z).project(camera);
      return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
   };
}

describe("pirate-cannons camera", () => {
   for (const [w, h] of [[1280, 800], [390, 844], [844, 390]]) {
      for (const banner of [0, 110]) {
         it(`keeps the bay and the muzzle on screen at ${w} x ${h}, banner ${banner ? "open" : "closed"}`, () => {
            const at = project(w, h, banner);
            const { min, max } = SEA_BOX;
            for (const x of [min.x, max.x]) for (const z of [min.z, max.z]) {
               const p = at(x, 0, z);
               expect(p.x).toBeGreaterThanOrEqual(-1);
               expect(p.x).toBeLessThanOrEqual(w + 1);
               expect(p.y).toBeGreaterThanOrEqual(56 - 1);
               expect(p.y).toBeLessThanOrEqual(h - banner + 1);
            }
            for (const yaw of [-AIM.yawMax, 0, AIM.yawMax]) for (const el of [0, AIM.elMax]) {
               const m = muzzleAt(yaw, el, { x: 0, y: 0, z: 0 });
               const p = at(m.x, m.y, m.z);
               expect(p.x, `yaw ${yaw} el ${el}`).toBeGreaterThan(0);
               expect(p.x).toBeLessThan(w);
               expect(p.y).toBeGreaterThan(56);
               expect(p.y).toBeLessThan(h - banner);
            }
         });
      }
   }
});
