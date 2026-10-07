import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitView, setLensShift, type ScreenRect } from "@/arcade3d/core/view";
import { AREA, FOV, LOOK_AT, VIEW, FOLLOW_DAMPING } from "./camera";
import { HINT_SLOT } from "./hint";

function projection(width: number, height: number, banner = 0) {
   const avoid: ScreenRect[] = [
      { left: 0, top: 0, right: width, bottom: 64 },
      { left: 20, right: 152, top: height - banner - 152, bottom: height - banner - 20 },
      { left: width - 92, right: width - 20, top: height - banner - 92, bottom: height - banner - 20 },
   ];
   if (banner) avoid.push({ left: 0, right: width, top: height - banner, bottom: height });
   const fit = fitView({ ...VIEW, fov: FOV, width, height, avoid });
   const camera = new PerspectiveCamera(FOV, width / height, 0.1, 400);
   setLensShift(camera, fit.shift[0], fit.shift[1], width, height);
   return { fit, camera, avoid };
}

function aim(camera: PerspectiveCamera, offset: readonly number[], y: number) {
   camera.position.set(offset[0], offset[1] + y, offset[2]); camera.lookAt(0, y, 0); camera.updateMatrixWorld(true);
}

describe("tower-climb core fitted column", () => {
   it("pins the 6 m column, fixed yaw, follow lag range and 45 degree lens", () => {
      expect(AREA).toEqual({ min: { x: -2.3, y: -2, z: -0.6 }, max: { x: 2.3, y: 4, z: 0.6 } });
      expect(FOV).toBe(45); expect(LOOK_AT).toEqual([0, 1, 0]); expect(FOLLOW_DAMPING).toBe(8);
      expect(VIEW.yaws).toEqual([Math.atan(3 / 12)]); expect(VIEW.pitch).toBe(Math.atan(2 / Math.sqrt(153)));
      expect(VIEW.focus!.map(p => p.y)).toContain(0.5); expect(VIEW.focus!.map(p => p.y)).toContain(1);
      expect(VIEW.shift).toBe(true); expect(VIEW.padding).toBe(8);
   });

   for (const [width, height, distance] of [[375, 812, 13.502], [812, 375, 11.032]]) {
      it(`matches the approved ${width}x${height} fit and projects the column clear of padded UI`, () => {
         const { fit, camera, avoid } = projection(width, height);
         expect(fit.distance).toBeCloseTo(distance, 2);
         const point = new Vector3();
         for (const focus of [0.5, 1]) {
            aim(camera, fit.offset, focus);
            for (let xi = 0; xi <= 20; xi++) for (let yi = 0; yi <= 20; yi++) for (const z of [-0.6, 0.6]) {
               point.set(-2.3 + xi * 4.6 / 20, -2 + yi * 6 / 20, z).project(camera);
               const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
               expect(x).toBeGreaterThanOrEqual(width * 0.02 - 0.1); expect(x).toBeLessThanOrEqual(width * 0.98 + 0.1);
               expect(y).toBeGreaterThanOrEqual(height * 0.02 - 0.1); expect(y).toBeLessThanOrEqual(height * 0.98 + 0.1);
               for (const rect of avoid) if (x > rect.left - 7.9 && x < rect.right + 7.9 && y > rect.top - 7.9 && y < rect.bottom + 7.9)
                  throw new Error(`Column covered at ${x},${y}`);
            }
         }
         if (width === 375) {
            let minimumHeight = Infinity, minimumWidth = Infinity;
            for (const focus of [0.5, 1]) for (const x of [-1.98, 1.98]) for (const foot of [-2, 0]) {
               aim(camera, fit.offset, focus);
               const bottom = new Vector3(x, foot, 0).project(camera), top = new Vector3(x, foot + 0.55, 0).project(camera);
               minimumHeight = Math.min(minimumHeight, (top.y - bottom.y) * height / 2);
            }
            for (const focus of [0.5, 1]) for (const x of [-1.2, 1.2]) for (const y of [-2, 4]) {
               aim(camera, fit.offset, focus);
               const left = new Vector3(x - 0.7, y, 0).project(camera), right = new Vector3(x + 0.7, y, 0).project(camera);
               minimumWidth = Math.min(minimumWidth, (right.x - left.x) * width / 2);
            }
            expect(minimumHeight).toBeCloseTo(35.85, 1); expect(minimumHeight).toBeGreaterThan(32);
            expect(minimumWidth).toBeCloseTo(91.44, 1); expect(minimumWidth).toBeGreaterThan(44);
         }
      });
   }

   it("the game HUD's hint slot never changes the fit: centred on desktop, the same lens with and without it", () => {
      // the shell HUD as GameShell lays it out (one rect per group: chips left, mute/pause right)
      const shell = (width: number): ScreenRect[] => [
         { left: 10, top: 10, right: 220, bottom: 52 }, { left: width - 104, top: 10, right: width - 10, bottom: 54 },
      ];
      const fine = ({ left, top, width, height } = HINT_SLOT.fine): ScreenRect => ({ left, top, right: left + width, bottom: top + height });
      const coarse = (width: number, height: number, banner: number): ScreenRect => ({
         left: HINT_SLOT.coarse.left, right: width - HINT_SLOT.coarse.right,
         top: height - banner - HINT_SLOT.coarse.bottom - HINT_SLOT.coarse.height, bottom: height - banner - HINT_SLOT.coarse.bottom,
      });
      const fitWith = (width: number, height: number, avoid: ScreenRect[]) => fitView({ ...VIEW, fov: FOV, width, height, avoid });
      for (const [width, height] of [[1280, 800], [1440, 900], [1024, 768], [1366, 768], [1920, 1080]]) for (const banner of [0, 120]) {
         const base = shell(width);
         if (banner) base.push({ left: 0, top: height - banner, right: width, bottom: height });
         const without = fitWith(width, height, base), withHint = fitWith(width, height, [...base, fine()]);
         expect(withHint).toEqual(without);
         if (width === 1280) expect(Math.abs(without.shift[0])).toBeLessThan(0.01);
      }
      for (const [width, height] of [[375, 812], [390, 844], [360, 740], [414, 896]]) for (const banner of [0, 162]) {
         const base = [...shell(width),
            { left: 20, right: 152, top: height - banner - 152, bottom: height - banner - 20 },
            { left: width - 92, right: width - 20, top: height - banner - 92, bottom: height - banner - 20 }];
         if (banner) base.push({ left: 0, top: height - banner, right: width, bottom: height });
         expect(fitWith(width, height, [...base, coarse(width, height, banner)])).toEqual(fitWith(width, height, base));
      }
      // the old centred panel under the chips (x 530..749, y 77..105) pushed the column off centre
      const old = fitWith(1280, 800, [...shell(1280), { left: 530, top: 77, right: 749, bottom: 105 }]);
      expect(Math.abs(old.shift[0])).toBeGreaterThan(0.1);
   });

   it("keeps its yaw when the cookie banner lifts the controls and is invariant under vertical translation", () => {
      const { fit, camera } = projection(375, 812, 162);
      expect(fit.yaw).toBe(VIEW.yaws![0]);
      aim(camera, fit.offset, 1);
      const before = new Vector3(-2.3, 4, 0.6).project(camera);
      aim(camera, fit.offset, 1601);
      const after = new Vector3(-2.3, 1604, 0.6).project(camera);
      expect(after.x).toBeCloseTo(before.x, 12); expect(after.y).toBeCloseTo(before.y, 12);
   });
});
