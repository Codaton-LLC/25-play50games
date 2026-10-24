import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitLiveView } from "@/arcade3d/core/useFittedView";
import { setLensShift } from "@/arcade3d/core/view";
import type { SafeArea } from "@/arcade3d/core/safeArea";
import {
   CAMERA,
   FOCUS,
   getSlotX,
   viewFor,
   PORTRAIT_AREA,
   LANDSCAPE_AREA,
   DESKTOP_AREA,
} from "./camera";
import { BOARD } from "./rules";

function safeArea(width: number, height: number, bannerHeight: number): SafeArea {
   return {
      width,
      height,
      hud: [{ left: 0, top: 0, right: width, bottom: 50 }],
      controls: [],
      obstructions: bannerHeight > 0 ? [{ left: 0, top: height - bannerHeight, right: width, bottom: height }] : [],
   };
}

/** Shortest part in height is the dome head (0.28 m); other parts span 0.34–0.465 m. */
const SHORTEST_PART_H = 0.28;
/** Claw head height (fingers to collar, 0.45 m). */
const CLAW_HEAD_H = 0.45;
/** Blueprint card height on the 3D board (0.587 m). */
const CARD_Y_BOTTOM = 1.086;
const CARD_Y_TOP = 1.673;

describe("robot-factory camera fits and sizes (>= 24 CSS px)", () => {
   it("portrait phone (390x844, banner open): parts, claw and card >= 24 px", () => {
      for (const banner of [92, 162]) {
         const width = 390;
         const height = 844;
         const safe = safeArea(width, height, banner);
         const { view } = fitLiveView({ ...viewFor(width, height), width, height, fov: CAMERA.fov }, safe, null);

         const cam = new PerspectiveCamera(CAMERA.fov, width / height, 0.1, 200);
         cam.position.set(FOCUS.x + view.offset[0], FOCUS.y + view.offset[1], FOCUS.z + view.offset[2]);
         cam.lookAt(FOCUS.x, FOCUS.y, FOCUS.z);
         setLensShift(cam, view.shift[0], view.shift[1], width, height);
         cam.updateMatrixWorld();

         const p0 = new Vector3(0, 0.75, 0.35).project(cam);
         const p1 = new Vector3(0, 0.75 + SHORTEST_PART_H, 0.35).project(cam);
         const partPx = Math.abs((p1.y - p0.y) * 0.5 * height);

         const c0 = new Vector3(0, 1.42, 0.35).project(cam);
         const c1 = new Vector3(0, 1.42 + CLAW_HEAD_H, 0.35).project(cam);
         const clawPx = Math.abs((c1.y - c0.y) * 0.5 * height);

         const b0 = new Vector3(0, CARD_Y_BOTTOM, BOARD.z).project(cam);
         const b1 = new Vector3(0, CARD_Y_TOP, BOARD.z).project(cam);
         const cardPx = Math.abs((b1.y - b0.y) * 0.5 * height);

         expect(partPx, `390x844 banner ${banner} part px`).toBeGreaterThanOrEqual(24);
         expect(clawPx, `390x844 banner ${banner} claw px`).toBeGreaterThanOrEqual(24);
         expect(cardPx, `390x844 banner ${banner} card px`).toBeGreaterThanOrEqual(24);
      }
   });

   it("landscape phone (844x390, banner open): parts, claw and card >= 24 px", () => {
      for (const banner of [72, 83]) {
         const width = 844;
         const height = 390;
         const safe = safeArea(width, height, banner);
         const { view } = fitLiveView({ ...viewFor(width, height), width, height, fov: CAMERA.fov }, safe, null);

         const cam = new PerspectiveCamera(CAMERA.fov, width / height, 0.1, 200);
         cam.position.set(FOCUS.x + view.offset[0], FOCUS.y + view.offset[1], FOCUS.z + view.offset[2]);
         cam.lookAt(FOCUS.x, FOCUS.y, FOCUS.z);
         setLensShift(cam, view.shift[0], view.shift[1], width, height);
         cam.updateMatrixWorld();

         const p0 = new Vector3(0, 0.75, 0.35).project(cam);
         const p1 = new Vector3(0, 0.75 + SHORTEST_PART_H, 0.35).project(cam);
         const partPx = Math.abs((p1.y - p0.y) * 0.5 * height);

         const c0 = new Vector3(0, 1.42, 0.35).project(cam);
         const c1 = new Vector3(0, 1.42 + CLAW_HEAD_H, 0.35).project(cam);
         const clawPx = Math.abs((c1.y - c0.y) * 0.5 * height);

         const b0 = new Vector3(0, CARD_Y_BOTTOM, BOARD.z).project(cam);
         const b1 = new Vector3(0, CARD_Y_TOP, BOARD.z).project(cam);
         const cardPx = Math.abs((b1.y - b0.y) * 0.5 * height);

         expect(partPx, `844x390 banner ${banner} part px`).toBeGreaterThanOrEqual(24);
         expect(clawPx, `844x390 banner ${banner} claw px`).toBeGreaterThanOrEqual(24);
         expect(cardPx, `844x390 banner ${banner} card px`).toBeGreaterThanOrEqual(24);
      }
   });

   it("desktop (1280x800) keeps the original 6 m wide area at pitch 38 deg", () => {
      const v = viewFor(1280, 800);
      expect(v.area.max.x - v.area.min.x).toBeCloseTo(6.0);
      expect(v.area.max.z - v.area.min.z).toBeCloseTo(2.4);
      expect(v.pitch).toBeCloseTo((38 * Math.PI) / 180);

      const width = 1280;
      const height = 800;
      const safe = safeArea(width, height, 80);
      const { view } = fitLiveView({ ...v, width, height, fov: CAMERA.fov }, safe, null);

      const cam = new PerspectiveCamera(CAMERA.fov, width / height, 0.1, 200);
      cam.position.set(FOCUS.x + view.offset[0], FOCUS.y + view.offset[1], FOCUS.z + view.offset[2]);
      cam.lookAt(FOCUS.x, FOCUS.y, FOCUS.z);
      setLensShift(cam, view.shift[0], view.shift[1], width, height);
      cam.updateMatrixWorld();

      const p0 = new Vector3(0, 0.75, 0.35).project(cam);
      const p1 = new Vector3(0, 0.75 + SHORTEST_PART_H, 0.35).project(cam);
      const partPx = Math.abs((p1.y - p0.y) * 0.5 * height);
      expect(partPx).toBeGreaterThanOrEqual(24);
   });

   it("viewFor returns the same object reference for unchanged category", () => {
      expect(viewFor(390, 844)).toBe(viewFor(390, 844));
      expect(viewFor(844, 390)).toBe(viewFor(844, 390));
      expect(viewFor(1280, 800)).toBe(viewFor(1280, 800));
   });
});

describe("robot-factory claw rod vs blueprint card no-overlap", () => {
   it("ensures claw rod never overlaps any card at desktop and landscape", () => {
      const viewports = [
         { name: "desktop", width: 1280, height: 800, banner: 80 },
         { name: "landscape", width: 844, height: 390, banner: 72 },
      ];

      for (const vp of viewports) {
         const safe = safeArea(vp.width, vp.height, vp.banner);
         const { view } = fitLiveView({ ...viewFor(vp.width, vp.height), width: vp.width, height: vp.height, fov: CAMERA.fov }, safe, null);

         const cam = new PerspectiveCamera(CAMERA.fov, vp.width / vp.height, 0.1, 200);
         cam.position.set(FOCUS.x + view.offset[0], FOCUS.y + view.offset[1], FOCUS.z + view.offset[2]);
         cam.lookAt(FOCUS.x, FOCUS.y, FOCUS.z);
         setLensShift(cam, view.shift[0], view.shift[1], vp.width, vp.height);
         cam.updateMatrixWorld();

         // Claw rod at rest: cylinder radius 0.03 (x in [-0.03, 0.03]), y in [1.92, 2.82], z = 0.35
         const rL = new Vector3(-0.03, 1.92, 0.35).project(cam);
         const rR = new Vector3(0.03, 2.82, 0.35).project(cam);
         const rodScreen = {
            x0: ((Math.min(rL.x, rR.x) + 1) / 2) * vp.width,
            x1: ((Math.max(rL.x, rR.x) + 1) / 2) * vp.width,
            y0: ((1 - Math.max(rL.y, rR.y)) / 2) * vp.height,
            y1: ((1 - Math.min(rL.y, rR.y)) / 2) * vp.height,
         };

         for (const size of [3, 4, 5]) {
            for (let i = 0; i < size; i++) {
               const slot = getSlotX(size, i);
               const xM0 = BOARD.x - BOARD.width / 2 + (slot.x / 1024) * BOARD.width;
               const xM1 = BOARD.x - BOARD.width / 2 + ((slot.x + slot.w) / 1024) * BOARD.width;

               const cTL = new Vector3(xM0, CARD_Y_TOP, BOARD.z).project(cam);
               const cBR = new Vector3(xM1, CARD_Y_BOTTOM, BOARD.z).project(cam);

               const cardScreen = {
                  x0: ((Math.min(cTL.x, cBR.x) + 1) / 2) * vp.width,
                  x1: ((Math.max(cTL.x, cBR.x) + 1) / 2) * vp.width,
                  y0: ((1 - Math.max(cTL.y, cBR.y)) / 2) * vp.height,
                  y1: ((1 - Math.min(cTL.y, cBR.y)) / 2) * vp.height,
               };

               const overlapX = cardScreen.x0 <= rodScreen.x1 && cardScreen.x1 >= rodScreen.x0;
               const overlapY = cardScreen.y0 <= rodScreen.y1 && cardScreen.y1 >= rodScreen.y0;
               const overlaps = overlapX && overlapY;

               expect(
                  overlaps,
                  `${vp.name} size ${size} card ${i} overlaps rod! rod X [${rodScreen.x0.toFixed(1)}, ${rodScreen.x1.toFixed(1)}] vs card X [${cardScreen.x0.toFixed(1)}, ${cardScreen.x1.toFixed(1)}]`
               ).toBe(false);
            }
         }
      }
   });
});
