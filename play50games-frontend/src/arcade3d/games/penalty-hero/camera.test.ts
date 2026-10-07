import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitLiveView } from "@/arcade3d/core/useFittedView";
import { setLensShift, type ScreenRect } from "@/arcade3d/core/view";
import type { SafeArea } from "@/arcade3d/core/safeArea";
import { CAMERA_FOV, CAMERA_LOOK_AT, PENALTY_FIT_AREA, PENALTY_VIEW } from "./camera";

const FIT_TABLE = [
   { width: 1280, height: 720, banner: 0, distance: 20.192, striker: [506.02, 330.71, 682.63, 579.43], ball: [628.33, 498.03, 651.67, 529.44] },
   { width: 1280, height: 720, banner: 79, distance: 20.870, striker: [516.35, 269.48, 679.34, 498.88], ball: [629.12, 425.79, 650.88, 454.75] },
   { width: 1280, height: 800, banner: 0, distance: 20.192, striker: [491.14, 367.45, 687.37, 643.81], ball: [627.04, 553.37, 652.96, 588.27] },
   { width: 1280, height: 800, banner: 79, distance: 20.241, striker: [492.01, 296.38, 687.09, 571.08], ball: [627.10, 481.36, 652.90, 516.05] },
   { width: 390, height: 844, banner: 0, distance: 36.348, striker: [142.46, 461.14, 211.72, 557.85], ball: [189.99, 534.33, 200.01, 546.43] },
   { width: 390, height: 844, banner: 162, distance: 36.348, striker: [142.46, 461.14, 211.72, 557.85], ball: [189.99, 534.33, 200.01, 546.43] },
   { width: 360, height: 740, banner: 0, distance: 35.137, striker: [131.52, 406.02, 195.43, 495.29], ball: [175.39, 473.36, 184.61, 484.54] },
   { width: 360, height: 740, banner: 183, distance: 35.137, striker: [131.52, 358.27, 195.43, 447.54], ball: [175.39, 425.60, 184.61, 436.78] },
   { width: 844, height: 390, banner: 0, distance: 22.574, striker: [153.72, 172.41, 227.69, 276.36], ball: [204.81, 245.06, 214.87, 258.18] },
   { width: 844, height: 390, banner: 83, distance: 24.720, striker: [127.25, 150.65, 188.67, 236.82], ball: [169.59, 212.27, 178.10, 223.13] },
   { width: 740, height: 360, banner: 0, distance: 23.705, striker: [127.88, 162.21, 189.52, 248.76], ball: [170.40, 223.49, 178.88, 234.41] },
   { width: 740, height: 360, banner: 83, distance: 25.851, striker: [107.69, 139.63, 159.73, 212.59], ball: [143.54, 192.30, 150.80, 201.48] },
] as const;

function safeArea(width: number, height: number, bannerHeight: number): SafeArea {
   const obstructionTop = height - bannerHeight;
   const bottom = height - bannerHeight;
   return {
      width,
      height,
      hud: [
         { left: 10, top: 10, right: 202, bottom: 54 },
         { left: width - 104, top: 10, right: width - 10, bottom: 54 },
         { left: width / 2 - 69, top: bottom - 73, right: width / 2 + 69, bottom: bottom - 14 },
         { left: width / 2 - 69, top: 70, right: width / 2 + 69, bottom: 98 },
      ],
      controls: [],
      obstructions: bannerHeight > 0 ? [{ left: 0, top: obstructionTop, right: width, bottom: height }] : [],
   };
}

function projectBox(width: number, height: number, box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }, camera: PerspectiveCamera) {
   const projected: Array<[number, number]> = [];
   const point = new Vector3();
   for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
         for (const z of [box.min.z, box.max.z]) {
            point.set(x, y, z).project(camera);
            projected.push([(point.x + 1) * width / 2, (1 - point.y) * height / 2]);
         }
      }
   }
   return projected;
}

function projectedComposition(width: number, height: number, bannerHeight: number) {
   const safe = safeArea(width, height, bannerHeight);
   const { view } = fitLiveView(
      { ...PENALTY_VIEW, width, height, fov: CAMERA_FOV },
      safe,
      null
   );
   const camera = new PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 400);
   camera.position.set(
      CAMERA_LOOK_AT[0] + view.offset[0],
      CAMERA_LOOK_AT[1] + view.offset[1],
      CAMERA_LOOK_AT[2] + view.offset[2]
   );
   camera.lookAt(...CAMERA_LOOK_AT);
   setLensShift(camera, view.shift[0], view.shift[1], width, height);
   camera.updateMatrixWorld();

   const boxes = [
      projectBox(width, height, { min: { x: -4.06, y: -0.4, z: 0 }, max: { x: 4.06, y: 2.84, z: 0 } }, camera),
      projectBox(width, height, { min: { x: -1.1, y: 0, z: 10.8 }, max: { x: 0.35, y: 1.85, z: 12.1 } }, camera),
      projectBox(width, height, { min: { x: -0.11, y: 0, z: 10.89 }, max: { x: 0.11, y: 0.22, z: 11.11 } }, camera),
   ];
   return {
      view,
      safe,
      boxes,
   };
}

function hull(points: Array<[number, number]>): Array<[number, number]> {
   const ordered = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
   const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
   const lower: Array<[number, number]> = [];
   const upper: Array<[number, number]> = [];
   for (const point of ordered) {
      while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
      lower.push(point);
   }
   for (const point of ordered.reverse()) {
      while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
      upper.push(point);
   }
   lower.pop();
   upper.pop();
   return lower.concat(upper);
}

function overlaps(points: Array<[number, number]>, rect: ScreenRect): boolean {
   const polygon = hull(points);
   const rectangle: Array<[number, number]> = [
      [rect.left, rect.top], [rect.right, rect.top], [rect.right, rect.bottom], [rect.left, rect.bottom],
   ];
   const axes: Array<[number, number]> = [[1, 0], [0, 1]];
   for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      axes.push([-(b[1] - a[1]), b[0] - a[0]]);
   }
   for (const [ax, ay] of axes) {
      const a = polygon.map(([x, y]) => x * ax + y * ay);
      const b = rectangle.map(([x, y]) => x * ax + y * ay);
      if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false;
   }
   return true;
}

describe("penalty-hero whole-composition fitted view", () => {
   it("fits the goal, ball/spot and the striker's animated bounds clear of HUD and banner", () => {
      for (const expected of FIT_TABLE) {
         const { width, height, banner: bannerHeight } = expected;
         const { view, boxes, safe } = projectedComposition(width, height, bannerHeight);
         const rects = boxes.map((points) => ({
            left: Math.min(...points.map(([x]) => x)),
            right: Math.max(...points.map(([x]) => x)),
            top: Math.min(...points.map(([, y]) => y)),
            bottom: Math.max(...points.map(([, y]) => y)),
         }));
         expect(view.distance).toBeCloseTo(expected.distance, 1);
         [rects[1], rects[2]].forEach((rect, i) => {
            const measured = i === 0 ? expected.striker : expected.ball;
            expect(rect.left).toBeCloseTo(measured[0], 0);
            expect(rect.top).toBeCloseTo(measured[1], 0);
            expect(rect.right).toBeCloseTo(measured[2], 0);
            expect(rect.bottom).toBeCloseTo(measured[3], 0);
         });
         for (const points of boxes) {
            const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
            expect(Math.min(...xs), `${width}x${height}, banner ${bannerHeight}: left edge`).toBeGreaterThanOrEqual(-0.5);
            expect(Math.max(...xs), `${width}x${height}, banner ${bannerHeight}: right edge`).toBeLessThanOrEqual(width + 0.5);
            expect(Math.min(...ys), `${width}x${height}, banner ${bannerHeight}: top edge`).toBeGreaterThanOrEqual(-0.5);
            expect(Math.max(...ys), `${width}x${height}, banner ${bannerHeight}: bottom edge`).toBeLessThanOrEqual(height + 0.5);
            for (const rect of [...safe.hud, ...safe.controls, ...safe.obstructions]) {
               expect(overlaps(points, rect), `${width}x${height}, banner ${bannerHeight}: ${JSON.stringify(rect)}`).toBe(false);
            }
         }
      }
   });

   it("pins the fit area to include the README goal guard, penalty spot, ball and striker motion", () => {
      expect(PENALTY_FIT_AREA).toEqual({
         min: { x: -4.06, y: -0.4, z: 0 },
         max: { x: 4.06, y: 2.84, z: 12.1 },
      });
      expect(PENALTY_VIEW).toMatchObject({ area: PENALTY_FIT_AREA, shift: true, yaws: [0], fov: 40 });
   });
});
