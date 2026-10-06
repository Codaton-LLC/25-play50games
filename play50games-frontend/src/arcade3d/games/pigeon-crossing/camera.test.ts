import { describe, expect, it } from "vitest";
import { Group, Matrix4, PerspectiveCamera, Vector3 } from "three";
import { fitView, setLensShift, type ScreenRect } from "@/arcade3d/core/view";
import { createRun, fillHorizon, ROW_PITCH } from "./rules";
import * as street from "./camera";
import { createStreetParts, disposeStreetParts } from "./Primitives";
import { ASSETS } from "./assets";
import { VEHICLE_TYPES } from "./rules";
import {
   STREET_VIEW, createProjectionScratch, createEnvelope, measureEnvelope, guardedRows,
   maximumRows, fallbackVertices, pigeonHull, projectedHeight, minimumPigeonHeight,
   viewGate, createStreetCache, configureStreetView, updateStreetHorizon, createHorizon,
   createPigeonPose, writePigeonPose, placePigeon,
} from "./camera";

function fixture(w: number, h: number, banner = 0) {
   const avoid: ScreenRect[] = [
      { left: 10, top: 10, right: 218, bottom: 52 },
      { left: w - 104, top: 10, right: w - 10, bottom: 54 },
   ];
   if (banner) avoid.push({ left: 0, top: h - banner, right: w, bottom: h });
   const view = fitView({ ...STREET_VIEW, width: w, height: h, fov: 45, avoid });
   const camera = new PerspectiveCamera(45, w / h, 0.1, 400);
   camera.position.set(view.offset[0], view.offset[1], view.offset[2] - 3.6);
   camera.lookAt(0, 0, -3.6);
   setLensShift(camera, view.shift[0], view.shift[1], w, h);
   camera.updateMatrixWorld();
   const scratch = createProjectionScratch(), envelope = createEnvelope();
   measureEnvelope(camera, scratch, envelope, 0);
   return { view, camera, scratch, envelope, w, h };
}

describe("pigeon-crossing fitted view", () => {
   it("pins the approved view, lag, occluder height and size gate", () => {
      expect(street).toMatchObject({ FOV: 45, PITCH: 55 * Math.PI / 180, FOLLOW_DAMPING: 12, FOLLOW_LAG: 0.3, COVER_HEIGHT: 1.8, MIN_PIGEON_PX: 24 });
      expect(STREET_VIEW).toMatchObject({
         area: { min: { x: -5.6, y: 0, z: -11.1 }, max: { x: 5.6, y: 1.8, z: 3.9 } },
         yaws: [0], focus: [{ x: 0, y: 0, z: -3.6 }],
         margin: { top: 0.11, bottom: 0.09, left: 0.02, right: 0.02 }, padding: 8, shift: true,
      });
   });

   it("reproduces the README projection table with actual fallback vertices", () => {
      const vertices = fallbackVertices(), hull = pigeonHull(vertices);
      const table = [
         [375, 812, 0, 36.270, 0, 28, 28.49, 27.68, null],
         [375, 812, 162, 36.270, 0, 28, 28.49, 27.68, null],
         [360, 640, 0, 30.813, 0, 25, 26.57, 25.82, null],
         [360, 640, 162, 30.813, 0.1336, 23, 26.57, 25.82, null],
         [812, 375, 0, 21.185, 0.0585, 18, 22.97, 22.34, "size"],
         [812, 375, 83, 25.808, 0.1750, 20, 18.70, 18.18, "size"],
         [1280, 800, 0, 21.185, 0.0585, 18, 49.01, 47.66, null],
         [1280, 800, 83, 21.782, 0.0760, 18, 47.61, 46.29, null],
      ] as const;
      for (const [w, h, banner, distance, shiftY, rows, rest, minimum, reason] of table) {
         const f = fixture(w, h, banner);
         expect(f.view.distance).toBeCloseTo(distance, 2);
         expect(f.view.shift[1]).toBeCloseTo(shiftY, 3);
         expect(f.envelope.valid).toBe(true);
         expect(maximumRows(f.envelope)).toBe(rows);
         expect(projectedHeight(f.camera, hull, h, 1, 0, 0, f.scratch.point)).toBeCloseTo(rest, 1);
         expect(minimumPigeonHeight(f.camera, hull, h, f.scratch.point)).toBeGreaterThan(minimum - 0.5);
         expect(minimumPigeonHeight(f.camera, hull, h, f.scratch.point)).toBeLessThan(minimum + 0.5);
         expect(viewGate(f.camera, f.envelope, hull, h, false, f.scratch.point).reason).toBe(reason);
      }
   });

   it("uses the full frustum and height envelope, instead of the active box", () => {
      const f = fixture(375, 812);
      expect(f.envelope.minX).toBeCloseTo(-9.773, 2);
      expect(f.envelope.maxX).toBeCloseTo(9.773, 2);
      expect(f.envelope.minZ).toBeCloseTo(-29.433, 2);
      expect(f.envelope.maxZ).toBeCloseTo(11.016, 2);
      const rows = createHorizon(); guardedRows(f.envelope, 0, rows);
      expect(rows.first).toBe(0); expect(rows.last).toBe(18);
      expect(rows.coverX).toBeCloseTo(12.073, 2);
      expect(rows.coverMaxZ).toBeGreaterThan(11.016);
      const run = createRun(1);
      expect(fillHorizon(run, rows.first, rows.last)).toBe(true);
      expect(run.lanes.some((l) => l.row === 18)).toBe(true); // well beyond the six-ahead box
      for (let row = 0; row < 200; row++) for (const fraction of [0, 0.01, 0.5, 0.99]) for (const lag of [-0.3, 0, 0.3]) {
         guardedRows(f.envelope, -(row + fraction) * ROW_PITCH + lag, rows);
         if (rows.last - rows.first + 1 > 28) throw new Error("Portrait horizon grew beyond its measured bound");
      }
   });

   it("names the fix for an oversized pool or tiny silhouette, while preserving the coarse-pointer exception", () => {
      const hull = pigeonHull(fallbackVertices());
      for (const [w, h, reason] of [[400, 1440, null], [400, 1480, "pool"], [900, 400, "size"], [900, 410, null]] as const) {
         const f = fixture(w, h);
         expect(viewGate(f.camera, f.envelope, hull, h, false, f.scratch.point).reason).toBe(reason);
      }
      const narrow = fixture(320, 568);
      expect(viewGate(narrow.camera, narrow.envelope, hull, 568, false, narrow.scratch.point).reason).toBe("size");
      expect(viewGate(narrow.camera, narrow.envelope, hull, 568, true, narrow.scratch.point).reason).toBe(null);
      const bad = fixture(800, 600);
      bad.camera.position.set(0, 1, 0); bad.camera.lookAt(0, 1, -1); bad.camera.updateMatrixWorld();
      measureEnvelope(bad.camera, bad.scratch, bad.envelope, 0);
      expect(bad.envelope.valid).toBe(false);
      expect(viewGate(bad.camera, bad.envelope, hull, 600, false, bad.scratch.point).reason).toBe("rays");
      bad.camera.position.set(0, 1.8, 0); bad.camera.lookAt(0, 0, -1); bad.camera.updateMatrixWorld();
      measureEnvelope(bad.camera, bad.scratch, bad.envelope, 0);
      expect(bad.envelope.valid).toBe(false); // meeting the height plane at the camera is not ahead
   });

   it("projects the yz hull exactly like every mesh vertex, including dense hop/squash poses", () => {
      const vertices = fallbackVertices(), hull = pigeonHull(vertices), f = fixture(375, 812), p = new Vector3();
      expect(hull.length / 2).toBeLessThan(100);
      let lowest = Infinity;
      for (let i = 0; i <= 1000; i++) {
         const u = i / 1000, sy = 0.95 + 0.05 * Math.sin(Math.PI * u);
         const lift = 0.25 * Math.sin(Math.PI * u) + 0.006 * Math.sin(2 * Math.PI * u);
         const z = -0.3 - 0.015 * Math.sin(Math.PI * u);
         let lo = Infinity, hi = -Infinity;
         for (let k = 0; k < vertices.length; k += 3) {
            p.set(vertices[k], vertices[k + 1] * sy + lift, vertices[k + 2] + z).project(f.camera);
            lo = Math.min(lo, p.y); hi = Math.max(hi, p.y);
         }
         const full = (hi - lo) * f.h / 2;
         const outline = projectedHeight(f.camera, hull, f.h, sy, lift, z, p);
         if (Math.abs(full - outline) > 0.01) throw new Error("Hull differs from the real pigeon silhouette");
         lowest = Math.min(lowest, full);
      }
      expect(lowest).toBeGreaterThanOrEqual(24);
      expect(minimumPigeonHeight(f.camera, hull, f.h, p)).toBeLessThanOrEqual(lowest + 0.01);
   });

   it("prefills the union of previous, target and actual camera horizons during eased refits", () => {
      const f = fixture(375, 812), next = fixture(1280, 800, 83);
      const cache = createStreetCache(), horizon = createHorizon();
      configureStreetView(cache, f.view, 375, 812);
      f.camera.position.z -= 36; f.camera.lookAt(0, 0, -39.6); f.camera.updateMatrixWorld();
      updateStreetHorizon(cache, f.camera, -36, horizon);
      const oldLast = horizon.last;
      configureStreetView(cache, next.view, 1280, 800);
      for (let frame = 0; frame <= 30; frame++) {
         const k = frame / 30;
         f.camera.aspect = 1280 / 800;
         f.camera.position.set(0, f.view.offset[1] + (next.view.offset[1] - f.view.offset[1]) * k, -39.6 + f.view.offset[2] + (next.view.offset[2] - f.view.offset[2]) * k);
         f.camera.lookAt(0, 0, -39.6);
         setLensShift(f.camera, next.view.shift[0] * k, next.view.shift[1] * k, 1280, 800);
         f.camera.updateMatrixWorld();
         updateStreetHorizon(cache, f.camera, -36, horizon);
         expect(horizon.last - horizon.first + 1).toBeLessThanOrEqual(40);
         const actual = createEnvelope(); measureEnvelope(f.camera, f.scratch, actual, 0);
         const visible = createHorizon(); guardedRows(actual, 0, visible);
         expect(horizon.first).toBeLessThanOrEqual(visible.first);
         expect(horizon.last).toBeGreaterThanOrEqual(visible.last);
         if (frame < 30) expect(horizon.last).toBeGreaterThanOrEqual(oldLast);
      }
   });

   it("keeps a valid 40-row view bounded during ordinary fractional scrolling and follow lag", () => {
      const f = fixture(400, 1440), cache = createStreetCache(), horizon = createHorizon();
      configureStreetView(cache, f.view, 400, 1440);
      for (let sample = 0; sample < 100; sample++) for (const lag of [-0.3, 0, 0.3]) {
         const z = -(200 + sample / 100) * 1.8;
         f.camera.position.z = z + f.view.offset[2] - 3.6 + lag;
         f.camera.lookAt(0, 0, z - 3.6 + lag); f.camera.updateMatrixWorld();
         updateStreetHorizon(cache, f.camera, z, horizon);
         if (horizon.last - horizon.first + 1 > 40) throw new Error(`Steady follow inflated the ring at phase ${sample / 100}, lag ${lag}`);
      }
   });
});

describe("pigeon-crossing model stand-ins", () => {
   it("keeps rigid poses inside the width bound and grounds a mid-air crash in 250 ms", () => {
      const pose = createPigeonPose(), root = new Group(), body = new Group(), shadow = new Group();
      const player = { x: 1.6, y: 0.25, z: -1.8 };
      for (let i = 0; i <= 100; i++) {
         writePigeonPose(i / 100, 0, -1, pose);
         expect(pose.sx * 0.56).toBeLessThanOrEqual(0.588);
         expect(pose.sy).toBeGreaterThanOrEqual(0.95); expect(pose.sy).toBeLessThanOrEqual(1);
      }
      writePigeonPose(-1, 0, -1, pose); expect(pose.sy).toBe(0.95);
      writePigeonPose(-1, 80, -1, pose); expect(pose.sy).toBe(1);
      writePigeonPose(0.5, 0, 250, pose); placePigeon(player, pose, root, body, shadow);
      expect(root.position.toArray()).toEqual([1.6, 0, -1.8]);
      expect(body.scale.x).toBe(1); expect(body.scale.y).toBeCloseTo(0.3, 8); expect(body.scale.z).toBe(1);
      expect(shadow.position.y).toBe(0); expect(shadow.scale.x).toBe(1);
      expect(player.y).toBe(0.25); // visual ending never edits the simulation's frozen contact
   });

   it("uses the approved pigeon normalization and fixed folded-wing primitive bounds", () => {
      expect(ASSETS.pigeon).toMatchObject({ scale: 0.658, stretch: [0.86, 1, 1], rotationY: Math.PI, rigged: false });
      const vertices = fallbackVertices();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < vertices.length; i += 3) {
         minX = Math.min(minX, vertices[i]); maxX = Math.max(maxX, vertices[i]);
         minY = Math.min(minY, vertices[i + 1]); maxY = Math.max(maxY, vertices[i + 1]);
      }
      expect(maxX - minX).toBeCloseTo(0.56, 6);
      expect(minY).toBeCloseTo(0, 6); expect(maxY).toBeCloseTo(1.25, 6);
      expect((maxX - minX) * 1.03).toBeLessThan(0.588);
   });

   it("draws two parts per vehicle and completely hides every birth/death under solid side cover", () => {
      const parts = createStreetParts(), p = new Vector3(), world = new Matrix4(), placement = new Matrix4();
      try {
         for (let kind = 0; kind < 3; kind++) {
            const type = VEHICLE_TYPES[kind];
            expect(parts.vehicles[kind]).toHaveLength(2);
            for (const direction of [-1, 1]) for (const edge of [-1, 1]) {
               placement.makeRotationY(direction * Math.PI / 2).setPosition(edge * (6 + type.length / 2), 0, 0);
               for (const part of parts.vehicles[kind]) {
                  const positions = part.geometry.getAttribute("position");
                  for (const local of part.locals!) {
                     world.multiplyMatrices(placement, local);
                     for (let i = 0; i < positions.count; i++) {
                        p.fromBufferAttribute(positions, i).applyMatrix4(world);
                        if (Math.abs(p.x) < 6 - 1e-6 || p.y < -1e-6 || p.y > 1.5 + 1e-6 || Math.abs(p.z) > type.depth / 2 + 1e-6) throw new Error(`${type.name} escapes its covered birth/death box`);
                     }
                  }
               }
            }
         }
      } finally { disposeStreetParts(parts); }
   });
});
