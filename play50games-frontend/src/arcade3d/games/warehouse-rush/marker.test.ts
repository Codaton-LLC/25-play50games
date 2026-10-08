// The order markers (marker.ts, looks only): which pallets show them, the arrow's bounce and tuck,
// and, through the game's own fitted cameras, that the arrow never covers a box or its lid letter
// and stays inside the fitted warehouse (so never under the HUD or the controls).
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { BOX, LID_LETTER } from "./assets";
import { FOV, LOOK_AT, PITCH, VIEW, WAREHOUSE } from "./camera";
import {
   ARROW,
   BOX_TURN_MAX,
   LID_TOP,
   POP_MAX,
   RING,
   arrowTipAt,
   beat,
   clearTipY,
   easeOutBack,
   marked,
   ringOpacity,
   ringScale,
   robotAtPallet,
   tuckStep,
   type CameraAxes,
} from "./marker";
import { NONE, PALLET_COUNT, PALLET_HALF, PALLET_HEIGHT, PALLET_SLOTS, PICK_GAP, createRun } from "./rules";

describe("warehouse-rush order markers: which pallets", () => {
   it("marks exactly the boxes of the order colour, only while the robot is empty-handed", () => {
      for (const seed of [1, 7, 42, 2026]) {
         const run = createRun(seed);
         for (let order = 0; order < 4; order++) {
            run.order = order;
            run.carrying = NONE;
            for (let i = 0; i < PALLET_COUNT; i++) {
               expect(marked(run, i), `seed ${seed} order ${order} pallet ${i}`).toBe(run.pallets[i].box === order);
            }
            run.carrying = order;
            for (let i = 0; i < PALLET_COUNT; i++) expect(marked(run, i)).toBe(false);
         }
      }
   });

   it("never marks an empty pallet, whatever the order", () => {
      const run = createRun(3);
      for (let order = 0; order < 4; order++) {
         run.order = order;
         for (let i = 0; i < PALLET_COUNT; i++) {
            run.pallets[i].box = NONE;
            expect(marked(run, i)).toBe(false);
         }
      }
   });

   it("tucks the arrow away exactly where an Action would pick the box (the rules' reach)", () => {
      const run = createRun(11);
      const pallet = run.pallets[0];
      run.robot.z = pallet.z;
      run.robot.x = pallet.x + PALLET_HALF + PICK_GAP;
      expect(robotAtPallet(run, 0)).toBe(true);
      run.robot.x += 0.01;
      expect(robotAtPallet(run, 0)).toBe(false);
      // the start pad is in no pallet's reach: every arrow shows at the start
      run.robot.x = 0;
      run.robot.z = 0;
      for (let i = 0; i < PALLET_COUNT; i++) expect(robotAtPallet(run, i)).toBe(false);
   });
});

describe("warehouse-rush order markers: motion", () => {
   it("bounces between its clear height and the bounce height, tapping down at t = 0", () => {
      const clearY = 2;
      expect(arrowTipAt(clearY, 0, 1)).toBe(clearY);
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k <= 4000; k++) {
         const y = arrowTipAt(clearY, k / 1000, 1);
         lo = Math.min(lo, y);
         hi = Math.max(hi, y);
      }
      expect(lo).toBeGreaterThanOrEqual(clearY);
      expect(hi).toBeLessThanOrEqual(clearY + ARROW.bounce + 1e-12);
      expect(hi).toBeGreaterThan(clearY + ARROW.bounce * 0.99);
      // one tap every 1 / rate seconds
      expect(beat(1 / ARROW.rate)).toBeCloseTo(0, 9);
   });

   it("pops in with its box: the arrow rises out of the box, at its full height once the pop settles", () => {
      expect(arrowTipAt(2, 0.3, 0)).toBe(PALLET_HEIGHT);
      expect(arrowTipAt(2, 0.3, 0.5)).toBeCloseTo(PALLET_HEIGHT + (arrowTipAt(2, 0.3, 1) - PALLET_HEIGHT) / 2, 12);
      expect(arrowTipAt(2, 0, 1)).toBe(2);
      expect(easeOutBack(0)).toBeCloseTo(0, 12);
      expect(easeOutBack(1)).toBe(1);
      expect(POP_MAX).toBeGreaterThan(1);
      expect(POP_MAX).toBeLessThan(1.11);
   });

   it("the floor frame is brightest and widest when the arrow taps down, never invisible", () => {
      expect(ringOpacity(0)).toBe(RING.opacityTap);
      expect(ringScale(0)).toBeCloseTo(1 + RING.swell, 12);
      for (let k = 0; k <= 2000; k++) {
         const t = k / 1000;
         expect(ringOpacity(t)).toBeGreaterThanOrEqual(RING.opacityRest - 1e-12);
         expect(ringOpacity(t)).toBeLessThanOrEqual(RING.opacityTap);
         expect(ringScale(t)).toBeGreaterThanOrEqual(1);
      }
   });

   it("tucks and comes back over ARROW.tuckS, and a paused frame (dt 0) changes nothing", () => {
      expect(tuckStep(1, 0, 0)).toBe(1);
      expect(tuckStep(0.4, 1, 0)).toBe(0.4);
      let v = 1;
      let frames = 0;
      while (v > 0 && frames < 1000) {
         v = tuckStep(v, 0, 1 / 60);
         frames += 1;
      }
      expect(v).toBe(0);
      expect(frames).toBe(Math.ceil(ARROW.tuckS * 60 - 1e-9));
      expect(tuckStep(0, 1, 10)).toBe(1);
      expect(tuckStep(1, 1, 1 / 60)).toBe(1);
   });
});

// ---------- through the game's cameras ----------

/** The fitted camera at `distance` and `yaw` (core fitView's placement: the lens shift moves the whole picture, so it changes no overlap). */
function cameraAt(yaw: number, distance: number, aspect = 16 / 9): PerspectiveCamera {
   const cam = new PerspectiveCamera(FOV, aspect, 0.1, 1000);
   const flat = Math.cos(PITCH) * distance;
   cam.position.set(LOOK_AT[0] + Math.sin(yaw) * flat, LOOK_AT[1] + Math.sin(PITCH) * distance, LOOK_AT[2] + Math.cos(yaw) * flat);
   cam.lookAt(LOOK_AT[0], LOOK_AT[1], LOOK_AT[2]);
   cam.updateMatrixWorld();
   return cam;
}

const ndc = (cam: PerspectiveCamera, p: Vector3) => p.clone().project(cam);

/** The camera as Scene.tsx reads it for clearTipY: position, screen up, view direction. */
function axesOf(cam: PerspectiveCamera): CameraAxes {
   const up = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
   const forward = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
   return {
      px: cam.position.x,
      py: cam.position.y,
      pz: cam.position.z,
      ux: up.x,
      uy: up.y,
      uz: up.z,
      fx: forward.x,
      fy: forward.y,
      fz: forward.z,
   };
}

/** The arrow quad's corners in the world, as Scene.tsx composes it: tip, the camera's rotation, the scale. */
function arrowCorners(cam: PerspectiveCamera, x: number, tipY: number, z: number, scale: number): Vector3[] {
   const q: Quaternion = cam.quaternion;
   const tip = new Vector3(x, tipY, z);
   const w = (ARROW.width / 2) * scale;
   const h = ARROW.height * scale;
   return [
      [-w, 0],
      [w, 0],
      [-w, h],
      [w, h],
   ].map(([lx, ly]) => new Vector3(lx, ly, 0).applyQuaternion(q).add(tip));
}

/** The 8 corners of a box on pallet (x, z), turned by `turn`, at pop scale `scale`. */
function boxCorners(x: number, z: number, turn: number, scale: number): Vector3[] {
   const c = Math.cos(turn);
   const s = Math.sin(turn);
   const out: Vector3[] = [];
   for (const lx of [-BOX.width / 2, BOX.width / 2]) {
      for (const lz of [-BOX.depth / 2, BOX.depth / 2]) {
         for (const ly of [0, BOX.height]) {
            out.push(new Vector3(x + (c * lx + s * lz) * scale, PALLET_HEIGHT + ly * scale, z + (-s * lx + c * lz) * scale));
         }
      }
   }
   return out;
}

/** The lid letter's corners: a flat square turned to read upright from the camera (yaw), at pop scale `scale`. */
function letterCorners(x: number, z: number, yaw: number, scale: number): Vector3[] {
   const c = Math.cos(yaw);
   const s = Math.sin(yaw);
   const h = (LID_LETTER.size / 2) * scale;
   return [
      [-h, -h],
      [h, -h],
      [-h, h],
      [h, h],
   ].map(([lx, lz]) => new Vector3(x + c * lx + s * lz, PALLET_HEIGHT + LID_LETTER.y * scale, z - s * lx + c * lz));
}

const YAWS = VIEW.yaws ?? [0];
/**
 * Every camera the game can fit. The nearest is 15.3 m: a screen wide enough for the height to
 * bind, with nothing to avoid (the HUD, the controls and the banner only push the camera back).
 * The farthest here is far beyond a narrow phone with the cookie banner open (about 40 m).
 */
const DISTANCES = [15, 16, 18, 20, 23, 26, 30, 35, 42, 52, 65, 80, 100, 150];
const SCALES = [0.25, 0.6, 1, POP_MAX];
const TURNS = [-BOX_TURN_MAX, 0, BOX_TURN_MAX];

describe("warehouse-rush order markers: from the game camera", () => {
   it("the distance sweep covers every fit", () => {
      let nearest = Infinity;
      for (const aspect of [0.2, 0.35, 0.46, 0.56, 0.75, 1, 1.33, 1.6, 1.78, 2.17, 2.6, 3, 4, 6, 10, 30]) {
         const fit = fitView({ ...VIEW, width: 1000 * aspect, height: 1000, fov: FOV, avoid: [] });
         expect(fit.distance, `aspect ${aspect}`).toBeGreaterThan(DISTANCES[0]);
         expect(fit.distance, `aspect ${aspect}`).toBeLessThan(DISTANCES[DISTANCES.length - 1]);
         nearest = Math.min(nearest, fit.distance);
      }
      expect(nearest).toBeCloseTo(15.3, 1);
      // a HUD to avoid only pushes the camera back
      const hud = fitView({
         ...VIEW,
         width: 3000,
         height: 1000,
         fov: FOV,
         avoid: [{ left: 10, top: 10, right: 218, bottom: 52 }],
      });
      expect(hud.distance).toBeGreaterThanOrEqual(nearest);
   });

   it("the arrow, at the bottom of its bounce, stays above every box and its lid letter on screen, ARROW.gap above at full size", () => {
      let lowest = Infinity;
      let highest = -Infinity;
      for (const yaw of YAWS) {
         for (const distance of DISTANCES) {
            const cam = cameraAt(yaw, distance);
            const axes = axesOf(cam);
            for (const slot of PALLET_SLOTS) {
               for (const turn of TURNS) {
                  const clearY = clearTipY(axes, slot.x, slot.z, turn);
                  lowest = Math.min(lowest, clearY - LID_TOP);
                  highest = Math.max(highest, clearY - LID_TOP);
                  for (const scale of SCALES) {
                     const where = `yaw ${yaw} d ${distance} slot ${slot.x},${slot.z} turn ${turn} scale ${scale}`;
                     // the lowest tip: the tap of the bounce, scaled about the pallet's top with the box
                     const arrow = arrowCorners(cam, slot.x, arrowTipAt(clearY, 0, scale), slot.z, scale).map((p) => ndc(cam, p));
                     const arrowBottom = Math.min(...arrow.map((p) => p.y));
                     const boxTop = Math.max(...boxCorners(slot.x, slot.z, turn, scale).map((p) => ndc(cam, p).y));
                     const letterTop = Math.max(...letterCorners(slot.x, slot.z, yaw, scale).map((p) => ndc(cam, p).y));
                     expect(arrowBottom, `${where}: box`).toBeGreaterThan(boxTop);
                     expect(arrowBottom, `${where}: letter`).toBeGreaterThan(letterTop);
                     if (scale === 1) {
                        // the gap in metres at the box: NDC height of 1 m on the screen plane at its depth
                        const box = new Vector3(slot.x, LID_TOP, slot.z).sub(cam.position);
                        const depth = box.dot(new Vector3(axes.fx, axes.fy, axes.fz));
                        const ndcPerMetre = 1 / (Math.tan(((FOV / 2) * Math.PI) / 180) * depth);
                        const gap = (arrowBottom - Math.max(boxTop, letterTop)) / ndcPerMetre;
                        // at least the gap, a little more: clearTipY raises the whole lid to the letter's 1.2 cm
                        expect(gap, where).toBeGreaterThan(ARROW.gap - 1e-6);
                        expect(gap, where).toBeLessThan(ARROW.gap + 0.02);
                     }
                  }
               }
            }
         }
      }
      // in the world the tip floats this far over the lid (the README's range)
      expect(lowest).toBeGreaterThan(0.6);
      expect(highest).toBeLessThan(1.4);
   });

   it("the whole arrow, at the top of its bounce, stays inside the fitted warehouse on screen", () => {
      const corners: Vector3[] = [];
      for (const x of [WAREHOUSE.min.x, WAREHOUSE.max.x]) {
         for (const y of [WAREHOUSE.min.y, WAREHOUSE.max.y]) {
            for (const z of [WAREHOUSE.min.z, WAREHOUSE.max.z]) corners.push(new Vector3(x, y, z));
         }
      }
      const tHigh = 1 / (2 * ARROW.rate); // the top of the bounce
      expect(beat(tHigh)).toBeCloseTo(1, 9);
      for (const yaw of YAWS) {
         for (const distance of DISTANCES) {
            const cam = cameraAt(yaw, distance);
            const axes = axesOf(cam);
            const hull = convexHull(corners.map((p) => ndc(cam, p)));
            for (const slot of PALLET_SLOTS) {
               for (const turn of TURNS) {
                  const clearY = clearTipY(axes, slot.x, slot.z, turn);
                  for (const p of arrowCorners(cam, slot.x, arrowTipAt(clearY, tHigh, POP_MAX), slot.z, POP_MAX)) {
                     const q = ndc(cam, p);
                     expect(inside(hull, q.x, q.y), `yaw ${yaw} d ${distance} slot ${slot.x},${slot.z}`).toBe(true);
                  }
               }
            }
         }
      }
   });

   it("the settled arrow, at the top of its bounce, never covers the box on another pallet (the next one up a portrait column)", () => {
      const tHigh = 1 / (2 * ARROW.rate);
      // the nearest fit for each yaw: the portrait yaw only wins on narrow screens, which fit from farther away
      const nearest = new Map<number, number>();
      for (let aspect = 0.2; aspect <= 3; aspect += 0.01) {
         const fit = fitView({ ...VIEW, width: 1000 * aspect, height: 1000, fov: FOV, avoid: [] });
         nearest.set(fit.yaw, Math.min(nearest.get(fit.yaw) ?? Infinity, fit.distance));
      }
      expect(nearest.get(Math.PI / 2)).toBeGreaterThan(23);
      let tightest = Infinity;
      for (const yaw of YAWS) {
         for (const distance of DISTANCES.filter((d) => d >= (nearest.get(yaw) ?? 0) - 1)) {
            const cam = cameraAt(yaw, distance);
            const axes = axesOf(cam);
            for (const a of PALLET_SLOTS) {
               for (const turn of TURNS) {
                  // a billboard faces the camera: on screen it is an upright rectangle
                  const arrow = arrowCorners(cam, a.x, arrowTipAt(clearTipY(axes, a.x, a.z, turn), tHigh, 1), a.z, 1).map((p) => ndc(cam, p));
                  const ax0 = Math.min(...arrow.map((p) => p.x));
                  const ax1 = Math.max(...arrow.map((p) => p.x));
                  const ay1 = Math.max(...arrow.map((p) => p.y));
                  for (const b of PALLET_SLOTS) {
                     if (b === a) continue;
                     for (const other of TURNS) {
                        const box = boxCorners(b.x, b.z, other, 1).map((p) => ndc(cam, p));
                        const bx0 = Math.min(...box.map((p) => p.x));
                        const bx1 = Math.max(...box.map((p) => p.x));
                        const by0 = Math.min(...box.map((p) => p.y));
                        if (bx1 < ax0 || bx0 > ax1 || by0 < Math.min(...arrow.map((p) => p.y))) continue;
                        // the box is beside or above the arrow on screen: the arrow's top stays below it
                        expect(ay1, `yaw ${yaw} d ${distance} arrow ${a.x},${a.z} box ${b.x},${b.z}`).toBeLessThan(by0);
                        tightest = Math.min(tightest, by0 - ay1);
                     }
                  }
               }
            }
         }
      }
      expect(tightest).toBeGreaterThan(0);
   });

   it("keeps the arrow just over the lid for a camera that does not look down", () => {
      const level = { px: 0, py: 1, pz: 20, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: -1 };
      const y = clearTipY(level, 0, 3.4, 0);
      expect(Number.isFinite(y)).toBe(true);
      expect(y).toBeGreaterThanOrEqual(LID_TOP);
   });

   it("neighbouring floor frames never touch, and each one clears its pallet", () => {
      expect(RING.half - RING.band).toBeGreaterThan(PALLET_HALF);
      const gap = Math.min(
         ...PALLET_SLOTS.flatMap((a, i) => PALLET_SLOTS.slice(i + 1).map((b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z))))
      );
      expect(gap - 2 * RING.half * (1 + RING.swell) * POP_MAX).toBeGreaterThan(0.5);
   });
});

/** Counter-clockwise convex hull of NDC points (x, y). */
function convexHull(points: Vector3[]): Array<[number, number]> {
   const p = points.map((v) => [v.x, v.y] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
   const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
   const half = (list: Array<[number, number]>) => {
      const out: Array<[number, number]> = [];
      for (const q of list) {
         while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
         out.push(q);
      }
      out.pop();
      return out;
   };
   return [...half(p), ...half([...p].reverse())];
}

function inside(hull: Array<[number, number]>, x: number, y: number): boolean {
   for (let k = 0; k < hull.length; k++) {
      const a = hull[k];
      const b = hull[(k + 1) % hull.length];
      if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) <= 0) return false;
   }
   return true;
}
