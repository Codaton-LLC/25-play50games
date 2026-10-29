import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { fitView, setLensShift, type ScreenRect } from "@/arcade3d/core/view";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { HERO_HEIGHT } from "./assets";
import { AIM_INSET, FOV, aimBounds, aimFor, followOffset, viewFor } from "./looks";
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

describe("toy store framing: the close follow camera keeps the robot big and in the free part of the screen", () => {
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
                  const off = followOffset(fit.yaw, screen.w / screen.h);
                  cam.position.set(aim.x + off[0], aim.y + off[1], aim.z + off[2]);
                  cam.lookAt(aim.x, aim.y, aim.z);
                  setLensShift(cam, fit.shift[0], fit.shift[1], screen.w, screen.h);
                  cam.updateMatrixWorld();
                  for (const y of [0.1, 0.6, HERO_HEIGHT, HERO_HEIGHT + 0.5]) {
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

   it("the close follow camera draws the robot (its silhouette) at 1/6-1/5 of a 390 x 844 phone and over twice the old 6 % on a 1280 x 800 desktop", () => {
      const size = (w: number, h: number, id: LevelId) => {
         const v = viewFor(id);
         const fit = fitView({ width: w, height: h, fov: FOV, area: v.area, pitch: v.pitch, yaws: v.yaws, focus: v.focus, margin: v.margin, padding: v.padding, shift: true });
         const cam = new PerspectiveCamera(FOV, w / h, 0.1, 400);
         const aim = aimFor(LEVELS[id], 0, 0, fit.yaw, { x: 0, y: 0, z: 0 });
         const off = followOffset(fit.yaw, w / h);
         cam.position.set(aim.x + off[0], aim.y + off[1], aim.z + off[2]);
         cam.lookAt(aim.x, aim.y, aim.z);
         setLensShift(cam, fit.shift[0], fit.shift[1], w, h);
         cam.updateMatrixWorld();
         // the drawn silhouette: the body is a round 0.5 m across, so its top face and its feet both show
         let top = Infinity;
         let bottom = -Infinity;
         const p = new Vector3();
         for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            for (const y of [0, HERO_HEIGHT]) {
               p.set(Math.cos(a) * 0.25, y, Math.sin(a) * 0.25).project(cam);
               top = Math.min(top, -p.y);
               bottom = Math.max(bottom, -p.y);
            }
         }
         return (bottom - top) / 2;
      };
      for (const id of LEVEL_IDS) {
         const phone = size(390, 844, id);
         expect(phone, `L${id} phone`).toBeGreaterThanOrEqual(1 / 6);
         expect(phone, `L${id} phone`).toBeLessThanOrEqual(1 / 5);
         expect(size(1280, 800, id), `L${id} desktop`).toBeGreaterThan(0.12);
      }
   });
});
