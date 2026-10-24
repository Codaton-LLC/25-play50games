// The cameras (pure fitView, the math useFittedView runs): every hole in view at the three test
// sizes with the banner open and closed, and the size rule on phones (ball >= 10 px, cup >= 14 px,
// banner open): the fixed view where it clears the rule by 10 %, else the gentle follow, opened by
// an establishing shot of the whole hole at the follow's yaw (README "Size rule").
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { fitView, type FittedView, type ScreenRect } from "@/arcade3d/core/view";
import { HOLE_COUNT, buildHole, heightAt, type Hole } from "./course";
import {
   DECOR_TREE_HALF,
   FIXED_MIN_PX_PER_M,
   FOV,
   MIN_PX_PER_M,
   decorSpots,
   surroundingsSpots,
   establishView,
   feltRects,
   fixedView,
   followViews,
   holeArea,
   holeFocus,
   holeZ,
   minPxPerMetre,
   pickCamera,
} from "./looks";
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

   it("decor stands on the lateral sides only: no tree beyond the far rail or over any felt, at either yaw", () => {
      for (let i = 0; i < HOLE_COUNT; i++) {
         for (const mirrored of [false, true]) {
            const hole = buildHole(i, mirrored);
            const b = hole.box;
            const rects = feltRects(hole);
            for (const yaw of [0, Math.PI / 2]) {
               const { trees, rocks } = decorSpots([hole], [yaw]);
               for (const t of [...trees, ...rocks]) {
                  const x = t.x;
                  const z = t.z - holeZ(i);
                  // depth towards the camera (+z at yaw 0, +x at PI / 2): never past the far rail
                  const far = yaw === 0 ? z - b.z0 : x - b.x0;
                  expect(far, `hole ${i + 1} yaw ${yaw}`).toBeGreaterThan(0);
                  // never on the felt, and the trees' canopies clear every felt rect (its rails) by >= 0.1 m
                  const gap = Math.min(...rects.map((r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1))));
                  expect(gap, `hole ${i + 1} yaw ${yaw}`).toBeGreaterThan(0.4);
                  if (trees.includes(t)) expect(gap - DECOR_TREE_HALF, `hole ${i + 1} tree`).toBeGreaterThanOrEqual(0.1);
               }
               // beside the lane: level with the tee and the cup
               const along = (p: { x: number; z: number }) => (yaw === 0 ? p.z : p.x);
               expect(along({ x: trees[0].x, z: trees[0].z - holeZ(i) })).toBeCloseTo(along(hole.tee), 9);
               expect(along({ x: trees[1].x, z: trees[1].z - holeZ(i) })).toBeCloseTo(along(hole.cup), 9);
            }
         }
      }
   });

   it("all surroundings (flower beds, palms, flags, hills, clubhouse) sit strictly outside the play bounds of all holes", () => {
      const allHoles: Hole[] = [];
      for (let i = 0; i < HOLE_COUNT; i++) {
         allHoles.push(buildHole(i, false), buildHole(i, true));
      }

      for (let i = 0; i < HOLE_COUNT; i++) {
         for (const mirrored of [false, true]) {
            const hole = buildHole(i, mirrored);
            const rects = feltRects(hole);
            const z0 = holeZ(i);

            for (const yaw of [0, Math.PI / 2]) {
               const surr = surroundingsSpots([hole], [yaw]);
               const allSpots = [...surr.palms, ...surr.flowers, ...surr.pennants, ...surr.hills, ...surr.clubhouse];

               for (const s of allSpots) {
                  // Must never lie on any felt or inside rails of this hole (gap >= 0.4 m)
                  const relZ = s.z - z0;
                  const gap = Math.min(...rects.map((r) => Math.hypot(Math.max(r.x0 - s.x, 0, s.x - r.x1), Math.max(r.z0 - relZ, 0, relZ - r.z1))));
                  expect(gap, `spot ${s.x},${s.z} on hole ${i + 1}`).toBeGreaterThan(0.4);

                  // Must never lie inside the play area of any OTHER hole on the course
                  for (const h of allHoles) {
                     if (h.index === i) continue;
                     const hz = holeZ(h.index);
                     const a = holeArea(h);
                     const insideOther = s.x >= a.min.x && s.x <= a.max.x && s.z >= hz + a.min.z && s.z <= hz + a.max.z;
                     expect(insideOther, `spot ${s.x},${s.z} inside play bounds of other hole ${h.index + 1}`).toBe(false);
                  }
               }
            }
         }
      }
   });

   it("no decor mesh sits between the camera and the ball, cup, or aim path at any test resolution", () => {
      const resolutions = [
         [1280, 800],
         [390, 844],
         [844, 390],
      ];

      for (const [w, h] of resolutions) {
         for (const banner of [0, 110]) {
            for (let i = 0; i < HOLE_COUNT; i++) {
               const hole = buildHole(i, false);
               const z0 = holeZ(i);
               const v = views(hole, w, h, banner);
               const viewOpts = v.pick < 0 ? fixedView(hole) : followViews(hole)[v.pick].options;
               const fitResult = fit(viewOpts, w, h, banner);
               const f = viewOpts.focus![0];

               CAM.aspect = w / h;
               CAM.position.set(f.x + fitResult.offset[0], f.y + fitResult.offset[1], z0 + f.z + fitResult.offset[2]);
               CAM.lookAt(f.x, f.y, z0 + f.z);
               CAM.setViewOffset(w, h, (-fitResult.shift[0] * w) / 2, (fitResult.shift[1] * h) / 2, w, h);
               CAM.updateMatrixWorld();
               CAM.updateProjectionMatrix();

               const { trees, rocks } = decorSpots([hole], [v.yaw]);
               const surr = surroundingsSpots([hole], [v.yaw]);
               const allDecor = [...trees, ...rocks, ...surr.palms, ...surr.flowers, ...surr.pennants, ...surr.hills, ...surr.clubhouse];

               // Play area points that must stay visible: tee, cup, and 5 samples along the aim path
               const teePt = new Vector3(hole.tee.x, (heightAt(hole, hole.tee.x, hole.tee.z) ?? 0) + BALL.radius, z0 + hole.tee.z);
               const cupPt = new Vector3(hole.cup.x, (heightAt(hole, hole.cup.x, hole.cup.z) ?? 0) + 0.05, z0 + hole.cup.z);
               const targets = [teePt, cupPt];
               for (let step = 1; step <= 5; step++) {
                  const t = step / 6;
                  targets.push(new Vector3().lerpVectors(teePt, cupPt, t));
               }

               for (const target of targets) {
                  const pTarget = target.clone().project(CAM);
                  const sxTarget = ((pTarget.x + 1) / 2) * w;
                  const syTarget = ((1 - pTarget.y) / 2) * h;
                  const distTarget = CAM.position.distanceTo(target);

                  for (const d of allDecor) {
                     const dPos = new Vector3(d.x, d.y, d.z);
                     const pDecor = dPos.clone().project(CAM);
                     const sxDecor = ((pDecor.x + 1) / 2) * w;
                     const syDecor = ((1 - pDecor.y) / 2) * h;
                     const pxDist = Math.hypot(sxDecor - sxTarget, syDecor - syTarget);
                     const distDecor = CAM.position.distanceTo(dPos);

                     // If decor is close to the target on screen (within 25 px), it must sit BEHIND the target
                     if (pxDist < 25) {
                        expect(distDecor, `decor at ${d.x},${d.z} occluding target at ${target.x},${target.z} on hole ${i + 1} at ${w}x${h}`).toBeGreaterThan(distTarget);
                     }
                  }
               }
            }
         }
      }
   });

   it("the sea ground covers the entire screen at all three sizes (no void below the scene)", () => {
      // Sea plane is 260 x 320 at y = -1.3, z = -50: x in [-130, 130], z in [-210, 110]
      const SEA_X_MIN = -130;
      const SEA_X_MAX = 130;
      const SEA_Z_MIN = -210;
      const SEA_Z_MAX = 110;
      const WATER_Y = -1.3;

      const resolutions = [
         [1280, 800],
         [390, 844],
         [844, 390],
      ];

      for (const [w, h] of resolutions) {
         for (const banner of [0, 110]) {
            for (let i = 0; i < HOLE_COUNT; i++) {
               const hole = buildHole(i, false);
               const z0 = holeZ(i);
               const v = views(hole, w, h, banner);
               const viewOpts = v.pick < 0 ? fixedView(hole) : followViews(hole)[v.pick].options;
               const fitResult = fit(viewOpts, w, h, banner);
               const f = viewOpts.focus![0];

               CAM.aspect = w / h;
               CAM.position.set(f.x + fitResult.offset[0], f.y + fitResult.offset[1], z0 + f.z + fitResult.offset[2]);
               CAM.lookAt(f.x, f.y, z0 + f.z);
               CAM.setViewOffset(w, h, (-fitResult.shift[0] * w) / 2, (fitResult.shift[1] * h) / 2, w, h);
               CAM.updateMatrixWorld();
               CAM.updateProjectionMatrix();

               // Test 4 screen corners: ray from camera must intersect water plane within the sea bounds
               const corners = [
                  [0, 0],
                  [w, 0],
                  [0, h],
                  [w, h],
               ];

               for (const [cx, cy] of corners) {
                  const ndcX = (cx / w) * 2 - 1;
                  const ndcY = 1 - (cy / h) * 2;
                  const pNear = new Vector3(ndcX, ndcY, 0).unproject(CAM);
                  const pFar = new Vector3(ndcX, ndcY, 1).unproject(CAM);
                  const dir = pFar.sub(pNear).normalize();

                  // Camera pitched down: ray points downwards towards ground
                  expect(dir.y, `corner ${cx},${cy} ray points down on hole ${i + 1}`).toBeLessThan(0);
                  const t = (WATER_Y - pNear.y) / dir.y;
                  expect(t, `corner ${cx},${cy} ray hits ground in front of camera`).toBeGreaterThan(0);

                  const hit = pNear.addScaledVector(dir, t);
                  expect(hit.x, `corner ${cx},${cy} x within sea bounds`).toBeGreaterThanOrEqual(SEA_X_MIN);
                  expect(hit.x, `corner ${cx},${cy} x within sea bounds`).toBeLessThanOrEqual(SEA_X_MAX);
                  expect(hit.z, `corner ${cx},${cy} z within sea bounds`).toBeGreaterThanOrEqual(SEA_Z_MIN);
                  expect(hit.z, `corner ${cx},${cy} z within sea bounds`).toBeLessThanOrEqual(SEA_Z_MAX);
               }
            }
         }
      }
   });
});
