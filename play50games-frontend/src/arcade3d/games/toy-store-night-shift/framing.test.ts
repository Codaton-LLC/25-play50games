import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { fitView, setLensShift, type ScreenRect } from "@/arcade3d/core/view";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { AIM_INSET, FOV, aimBounds, aimFor, viewFor } from "./looks";
import { RADIUS, createRun, standable, storeHalf } from "./rules";

/** The kinds panel (Hud.module.css: top 74, left 12, about 28 px a row + padding, 140 px wide). */
const panel = (id: LevelId): ScreenRect => ({ left: 12, top: 74, right: 152, bottom: 74 + 16 + 28 * LEVELS[id].categories });

const SCREENS: Array<{ name: string; w: number; h: number; avoid: (id: LevelId) => ScreenRect[] }> = [
   // desktop: the shell chips across the top, the kinds panel
   { name: "1280x800", w: 1280, h: 800, avoid: (id) => [{ left: 0, top: 0, right: 1280, bottom: 64 }, panel(id)] },
   // phone, cookie banner open: two rows of chips, the panel, joystick + Use, the banner strip
   {
      name: "390x844",
      w: 390,
      h: 844,
      avoid: (id) => [
         { left: 0, top: 0, right: 390, bottom: 110 },
         panel(id),
         { left: 20, top: 520, right: 152, bottom: 660 },
         { left: 296, top: 582, right: 372, bottom: 660 },
         { left: 0, top: 676, right: 390, bottom: 844 },
      ],
   },
];

const inside = (x: number, y: number, r: ScreenRect) => x > r.left && x < r.right && y > r.top && y < r.bottom;

describe("toy store framing: the robot stays in the free part of the screen", () => {
   it("the aim follows the robot to within a step and a half, even at the walls", () => {
      for (const id of LEVEL_IDS) {
         const { hx, hz } = storeHalf(LEVELS[id]);
         const b = aimBounds(LEVELS[id]);
         expect(b.max.x).toBeCloseTo(hx - AIM_INSET, 9);
         expect(b.max.z).toBeCloseTo(hz - AIM_INSET, 9);
         const out = { x: 0, y: 0, z: 0 };
         for (const [x, z] of [[-hx + RADIUS, -hz + RADIUS], [hx - RADIUS, hz - RADIUS], [0, 0]]) {
            for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
               aimFor(LEVELS[id], x, z, yaw, out);
               expect(Math.hypot(out.x - x, out.z - z)).toBeLessThan(1.6);
            }
         }
      }
   });

   for (const screen of SCREENS) {
      it(`${screen.name}: from every spot the robot can stand on (and the start), its body projects clear of the HUD, the panel and the controls`, () => {
         const cam = new PerspectiveCamera(FOV, screen.w / screen.h, 0.1, 400);
         const p = new Vector3();
         const aim = { x: 0, y: 0, z: 0 };
         for (const id of LEVEL_IDS) {
            const v = viewFor(id);
            const avoid = screen.avoid(id);
            const fit = fitView({ width: screen.w, height: screen.h, fov: FOV, area: v.area, pitch: v.pitch, yaws: v.yaws, focus: v.focus, margin: v.margin, padding: v.padding, avoid, shift: true });
            const run = createRun(1, LEVELS[id]);
            const spots: Array<[number, number]> = [[run.start.x, run.start.z]];
            for (let x = -run.hx; x <= run.hx; x += 1) for (let z = -run.hz; z <= run.hz; z += 1) if (standable(run, x, z)) spots.push([x, z]);
            for (const [x, z] of spots) {
               for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
                  aimFor(LEVELS[id], x, z, yaw, aim);
                  cam.position.set(aim.x + fit.offset[0], aim.y + fit.offset[1], aim.z + fit.offset[2]);
                  cam.lookAt(aim.x, aim.y, aim.z);
                  setLensShift(cam, fit.shift[0], fit.shift[1], screen.w, screen.h);
                  cam.updateMatrixWorld();
                  for (const y of [0.1, 0.9, 1.7]) {
                     p.set(x, y, z).project(cam);
                     const sx = ((p.x + 1) / 2) * screen.w;
                     const sy = ((1 - p.y) / 2) * screen.h;
                     const where = `L${id} robot (${x.toFixed(1)}, ${z.toFixed(1)}) yaw ${yaw.toFixed(2)} y ${y} at ${sx.toFixed(0)},${sy.toFixed(0)}`;
                     expect(sx > 4 && sx < screen.w - 4 && sy > 4 && sy < screen.h - 4, where).toBe(true);
                     for (const r of avoid) expect(inside(sx, sy, r), `${where} under ${JSON.stringify(r)}`).toBe(false);
                  }
               }
            }
         }
      });
   }
});
