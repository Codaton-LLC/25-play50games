// Test fixtures for the camera (phone.test.ts, hints.test.ts): the safe area GameShell measured at the
// phone viewports, the live fit for a camera setup, and a three.js camera placed as CameraRig places
// it at rest. Not imported by the game.
import { PerspectiveCamera, Vector3 } from "three";
import type { Vec3Like } from "@/arcade3d/core/collision";
import { fitView, followAim, type FittedView, type ScreenRect } from "@/arcade3d/core/view";
import { FOV, LOOK_AT, type CameraSetup } from "./camera";

/** The safe area GameShell measured on the production build (2026-10-08, mobile emulation): shell HUD, map pill, joystick, banner. */
export const PHONE_SAFE_AREAS: Array<{ w: number; h: number; banner: boolean; rects: ScreenRect[] }> = (
   [
      [360, 740, true, [[10, 10, 248, 100], [256, 10, 350, 54], [196, 487, 344, 523], [20, 399, 152, 531], [0, 551, 360, 740]]],
      [360, 740, false, [[10, 10, 248, 100], [256, 10, 350, 54], [196, 676, 344, 712], [20, 588, 152, 720]]],
      [390, 844, true, [[10, 10, 261, 52], [286, 10, 380, 54], [226, 612, 374, 648], [20, 524, 152, 656], [0, 676, 390, 844]]],
      [390, 844, false, [[10, 10, 261, 52], [286, 10, 380, 54], [226, 780, 374, 816], [20, 692, 152, 824]]],
      [740, 360, true, [[10, 10, 261, 52], [636, 10, 730, 54], [576, 211, 724, 247], [20, 123, 152, 255], [0, 275, 740, 360]]],
      [740, 360, false, [[10, 10, 261, 52], [636, 10, 730, 54], [576, 296, 724, 332], [20, 208, 152, 340]]],
      [844, 390, true, [[10, 10, 261, 52], [740, 10, 834, 54], [680, 241, 828, 277], [20, 153, 152, 285], [0, 305, 844, 390]]],
      [844, 390, false, [[10, 10, 261, 52], [740, 10, 834, 54], [680, 326, 828, 362], [20, 238, 152, 370]]],
   ] as Array<[number, number, boolean, number[][]]>
).map(([w, h, banner, r]) => ({ w, h, banner, rects: r.map(([left, top, right, bottom]) => ({ left, top, right, bottom })) }));

/** The live fit (useFittedView: every safe-area rect is avoided) for a setup. */
export function fitSetup(setup: CameraSetup, w: number, h: number, avoid: readonly ScreenRect[]): FittedView {
   return fitView({ ...setup.view, width: w, height: h, fov: FOV, avoid });
}

/** CameraRig at rest following `runner`: screen px (CSS, lens shift included) of a world point. */
export function rigProjector(setup: CameraSetup, fitted: FittedView, w: number, h: number, runner: Vec3Like) {
   const aim = followAim(runner, LOOK_AT, setup.followFraction, setup.bounds, { x: 0, y: 0, z: 0 });
   const cam = new PerspectiveCamera(FOV, w / h, 0.1, 1000);
   cam.position.set(aim.x + fitted.offset[0], aim.y + fitted.offset[1], aim.z + fitted.offset[2]);
   cam.lookAt(aim.x, aim.y, aim.z);
   cam.updateMatrixWorld();
   const v = new Vector3();
   return (x: number, y: number, z: number): [number, number, number] => {
      v.set(x, y, z).project(cam);
      return [((v.x + fitted.shift[0] + 1) / 2) * w, ((1 - (v.y + fitted.shift[1])) / 2) * h, v.z];
   };
}

