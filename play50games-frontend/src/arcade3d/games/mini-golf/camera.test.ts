// The cameras (pure fitView, the math useFittedView runs): every hole in view at the three test
// sizes with the banner open and closed, and the size rule on phones (ball >= 10 px, cup >= 14 px,
// banner open): the fixed view where it clears the rule by 10 %, else the gentle follow, opened by
// an establishing shot of the whole hole at the follow's yaw (README "Size rule").
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { fitView, type FittedView, type ScreenRect } from "@/arcade3d/core/view";
import { HOLE_COUNT, buildHole, type Hole } from "./course";
import { DECOR_TREE_HALF, DECOR_TREE_OUT, FIXED_MIN_PX_PER_M, FOV, MIN_PX_PER_M, decorSpots, establishView, fixedView, followViews, holeArea, holeZ, minPxPerMetre, pickCamera } from "./looks";
import { BALL, CUP } from "./physics";

/** The shell HUD strip, the game's power / scorecard panel (Hud.module.css) and the cookie banner. */
function avoid(width: number, height: number, banner: number): ScreenRect[] {
   const bottom = height - banner - 12;
   return [
      { left: 0, top: 0, right: width, bottom: 56 },
      { left: 12, top: bottom - 46, right: 12 + 214, bottom },
      ...(banner > 0 ? [{ left: 0, top: height - banner, right: width, bottom: height }] : []),
   ];
}

const fit = (o: FittedViewOptions, w: number, h: number, banner: number) => fitView({ ...o, width: w, height: h, fov: FOV, avoid: avoid(w, h, banner) });

function views(hole: Hole, width: number, height: number, banner: number) {
   const fixedOpts = fixedView(hole);
   const fixed = fit(fixedOpts, width, height, banner);
   const fixedPx = minPxPerMetre(fixedOpts, fixed, width, height);
   const follows = followViews(hole).map((f) => {
      const view = fit(f.options, width, height, banner);
      return { view, px: minPxPerMetre(f.options, view, width, height, f.window) };
   });
   const pick = pickCamera(fixedPx, follows.map((f) => f.px));
   return { fixed, fixedPx, follows, pick, px: pick < 0 ? fixedPx : follows[pick].px, yaw: pick < 0 ? fixed.yaw : follows[pick].view.yaw };
}

const CAM = new PerspectiveCamera(FOV, 1, 0.1, 400);
const P = new Vector3();

/** Is the point (hole frame) drawn inside the free screen (the canvas minus the avoided rects)? */
function onFreeScreen(o: FittedViewOptions, v: FittedView, w: number, h: number, banner: number, x: number, y: number, z: number): boolean {
   const f = o.focus![0];
   CAM.aspect = w / h;
   CAM.position.set(f.x + v.offset[0], f.y + v.offset[1], f.z + v.offset[2]);
   CAM.lookAt(f.x, f.y, f.z);
   CAM.setViewOffset(w, h, (-v.shift[0] * w) / 2, (v.shift[1] * h) / 2, w, h);
   CAM.updateMatrixWorld();
   CAM.updateProjectionMatrix();
   P.set(x, y, z).project(CAM);
   const sx = ((P.x + 1) / 2) * w;
   const sy = ((1 - P.y) / 2) * h;
   if (sx < 0 || sx > w || sy < 0 || sy > h) return false;
   return !avoid(w, h, banner).some((r) => sx > r.left && sx < r.right && sy > r.top && sy < r.bottom);
}

/** Expected camera per hole (1-6) at 390 x 844 / 844 x 390 with the banner open: "fixed" or the follow. */
const EXPECTED: Record<string, string[]> = {
   "390x844": ["fixed", "fixed", "fixed", "fixed", "follow", "follow"],
   "844x390": ["fixed", "follow", "fixed", "follow", "follow", "follow"],
};

describe("mini-golf cameras", () => {
   it("the size rule's scale: 56 px/m draws the 0.18 m ball 10 px and the 0.26 m cup 14 px; the fixed view needs 10 % more", () => {
      expect(MIN_PX_PER_M * 2 * BALL.drawnRadius).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(MIN_PX_PER_M * 2 * CUP.drawnRadius).toBeGreaterThanOrEqual(14 - 1e-9);
      expect(FIXED_MIN_PX_PER_M).toBeCloseTo(1.1 * MIN_PX_PER_M, 9);
      expect(pickCamera(FIXED_MIN_PX_PER_M, [0])).toBe(-1);
      expect(pickCamera(FIXED_MIN_PX_PER_M - 1e-6, [MIN_PX_PER_M - 1, MIN_PX_PER_M])).toBe(1);
      expect(pickCamera(0, [MIN_PX_PER_M, 999])).toBe(0);
   });

   for (const [w, h] of [[390, 844], [844, 390]]) {
      it(`every hole meets the size rule at ${w} x ${h} with the banner open, on the expected camera`, () => {
         const rows: string[] = [];
         for (let i = 0; i < HOLE_COUNT; i++) {
            for (const mirrored of [false, true]) {
               const v = views(buildHole(i, mirrored), w, h, 110);
               const mode = v.pick < 0 ? "fixed" : "follow";
               expect(mode, `hole ${i + 1}${mirrored ? " mirrored" : ""}: fixed ${(v.fixedPx * 2 * BALL.drawnRadius).toFixed(1)} px`).toBe(EXPECTED[`${w}x${h}`][i]);
               expect(v.px, `hole ${i + 1} ${mode}`).toBeGreaterThanOrEqual(MIN_PX_PER_M);
               if (!mirrored) rows.push(`${i + 1}:${mode}${v.pick > 0 ? v.pick : ""} ball ${(v.px * 2 * BALL.drawnRadius).toFixed(1)} cup ${(v.px * 2 * CUP.drawnRadius).toFixed(1)}`);
            }
         }
         // eslint-disable-next-line no-console
         console.log(`${w}x${h}`, rows.join(" | "));
      });
   }

   it("portrait hole 5 sits at the border: its fixed view would draw a 10.2 px ball, under the 10 % margin, so it follows", () => {
      const v = views(buildHole(4, false), 390, 844, 110);
      expect(v.fixedPx).toBeGreaterThanOrEqual(MIN_PX_PER_M);
      expect(v.fixedPx).toBeLessThan(FIXED_MIN_PX_PER_M);
      expect(v.fixedPx * 2 * BALL.drawnRadius).toBeCloseTo(10.2, 1);
      expect(v.pick).toBe(0);
   });

   it("hole 4 on a landscape phone: the whole windmill with the banner closed, the blade disc's window with it open", () => {
      for (const mirrored of [false, true]) {
         const hole = buildHole(3, mirrored);
         expect(views(hole, 844, 390, 0).pick).toBe(0);
         expect(views(hole, 844, 390, 110).pick).toBe(1);
      }
   });

   it("the establishing shot shows the whole hole (rail box corners and the cup) at the follow's yaw", () => {
      for (const [w, h] of [[390, 844], [844, 390]]) {
         for (let i = 0; i < HOLE_COUNT; i++) {
            for (const mirrored of [false, true]) {
               const hole = buildHole(i, mirrored);
               const v = views(hole, w, h, 110);
               if (v.pick < 0) continue;
               const o = establishView(hole, v.yaw);
               const e = fit(o, w, h, 110);
               expect(e.yaw, `hole ${i + 1}`).toBe(v.yaw);
               const a = holeArea(hole);
               for (const x of [a.min.x + 0.15, a.max.x - 0.15]) {
                  for (const z of [a.min.z + 0.15, a.max.z - 0.15]) expect(onFreeScreen(o, e, w, h, 110, x, 0, z), `${w}x${h} hole ${i + 1} corner ${x},${z}`).toBe(true);
               }
               expect(onFreeScreen(o, e, w, h, 110, hole.cup.x, 0, hole.cup.z), `${w}x${h} hole ${i + 1} cup`).toBe(true);
            }
         }
      }
   });

   it("desktop (1280 x 800) shows every whole hole with the fixed view, banner open or closed", () => {
      for (let i = 0; i < HOLE_COUNT; i++) {
         for (const banner of [0, 110]) expect(views(buildHole(i, false), 1280, 800, banner).pick, `hole ${i + 1}`).toBe(-1);
      }
   });

   it("decor stands on the lateral sides only: no tree beyond the far rail or over the rails, at either yaw", () => {
      for (let i = 0; i < HOLE_COUNT; i++) {
         for (const mirrored of [false, true]) {
            const hole = buildHole(i, mirrored);
            const b = hole.box;
            for (const yaw of [0, Math.PI / 2]) {
               const { trees, rocks } = decorSpots([hole], [yaw]);
               for (const t of [...trees, ...rocks]) {
                  const x = t.x;
                  const z = t.z - holeZ(i);
                  // depth towards the camera (+z at yaw 0, +x at PI / 2): never past the far rail
                  const far = yaw === 0 ? z - b.z0 : x - b.x0;
                  expect(far, `hole ${i + 1} yaw ${yaw}`).toBeGreaterThan(0);
                  // outside the rail box (lateral)
                  const lateral = yaw === 0 ? Math.max(b.x0 - x, x - b.x1) : Math.max(b.z0 - z, z - b.z1);
                  expect(lateral, `hole ${i + 1} yaw ${yaw}`).toBeGreaterThan(0.4);
               }
               for (const t of trees) {
                  const gap = yaw === 0 ? Math.max(b.x0 - t.x, t.x - b.x1) : Math.max(b.z0 - (t.z - holeZ(i)), t.z - holeZ(i) - b.z1);
                  expect(gap - DECOR_TREE_HALF, `hole ${i + 1} tree clears the rails`).toBeGreaterThanOrEqual(0.1);
                  expect(gap).toBeCloseTo(DECOR_TREE_OUT, 9);
               }
            }
         }
      }
   });
});
