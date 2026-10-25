import { describe, expect, it, vi } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { VIEW } from "./camera";
import { GROUND, SCENERY, createStripScratch, createTrackFrame, fillStrip, groundY, sceneryS, stripFloats, toView, trackEnd, trackFrame } from "./ground";
import { decorOf } from "./looks";
import { COURSE, chunkAt, corridorAt, createRun, sampleTrack, stepRun, worldAt, type Run } from "./rules";

vi.mock("@/arcade3d/core/render", () => ({ DynamicInstanced: () => null, Instanced: () => null }));
vi.mock("@/arcade3d/core/gameTime", () => ({ useGameTime: () => ({ now: 0, delta: 0, play: 0 }) }));
vi.mock("@/arcade3d/core/quality", () => ({ scaledCount: (n: number) => n, useQuality: () => ({ decor: 1 }) }));

const { placeScenery } = await import("./Decor");
const { BASE_PLANE_Y } = await import("./Terrain");

const TONES = [[1, 1, 1], [0.9, 0.9, 0.9], [0.8, 0.8, 0.8], [0.7, 0.7, 0.7]] as const;
const DRIVE_INPUT = { steer: 0, left: false, right: false, jump: false };

function scratch() {
   return {
      frame: createTrackFrame(),
      p: { x: 0, y: 0, z: 0 },
      t: { x: 0, y: 0, z: 0 },
      q: { x: 0, y: 0, z: 0 },
      view: { x: 0, y: 0, z: 0 },
      at: new Vector3(),
      quat: new Quaternion(),
      scale: new Vector3(),
      up: new Vector3(0, 1, 0),
   };
}

/** Slides the run forward without crashing: the penguin rides the safe centre (visual tests only). */
function slide(run: Run, metres: number): void {
   const target = run.s + metres;
   while (run.s < target && !run.end) {
      stepRun(run, DRIVE_INPUT, 1 / 60);
      run.remaining = 30;
      run.tumble = 0;
      run.d = corridorAt(chunkAt(run, run.s), run.s - chunkAt(run, run.s).index * COURSE.chunk);
   }
}

describe("penguin-slide side scenery scrolls with the track and recycles ahead", () => {
   it("keeps every copy in the window, fixed on the track until it is recycled exactly one period ahead", () => {
      const bases = [-3, 0, 4.5, 11, 22];
      for (const base of bases) {
         for (let copy = 0; copy < SCENERY.copies; copy++) {
            let last = sceneryS(base, copy, 0);
            let recycled = 0;
            for (let s = 0; s <= 600; s += 0.37) {
               const now = sceneryS(base, copy, s);
               expect(now).toBeGreaterThanOrEqual(s - SCENERY.behind - 1e-9);
               expect(now).toBeLessThan(s - SCENERY.behind + SCENERY.period + 1e-9);
               if (Math.abs(now - last) > 1e-9) {
                  // a copy only ever moves by one whole period, forward, once it fell behind
                  expect(now - last).toBeCloseTo(SCENERY.period, 9);
                  recycled += 1;
               }
               last = now;
            }
            expect(recycled).toBeGreaterThanOrEqual(7);
         }
      }
      // the copies of one spot are evenly spaced along the period
      const s0 = [0, 1, 2].map((copy) => sceneryS(4, copy, 100)).sort((a, b) => a - b);
      expect(s0[1] - s0[0]).toBeCloseTo(SCENERY.period / SCENERY.copies, 9);
      expect(s0[2] - s0[1]).toBeCloseTo(SCENERY.period / SCENERY.copies, 9);
   });

   it("moves a drawn rock toward the camera by the distance slid (it is not painted on the screen)", () => {
      const run = createRun(42);
      const rocks = decorOf("rock");
      const k = scratch();
      const m = new Matrix4();
      const pos = new Vector3();
      const before: (number | null)[] = [];
      for (let i = 0; i < rocks.length * SCENERY.copies; i++) {
         before.push(placeScenery(run, rocks, i, m, k) ? pos.setFromMatrixPosition(m).z : null);
      }
      const s0 = run.s;
      slide(run, 6);
      const moved = run.s - s0;
      expect(moved).toBeGreaterThan(5);
      let checked = 0;
      for (let i = 0; i < rocks.length * SCENERY.copies; i++) {
         const was = before[i];
         if (was === null || !placeScenery(run, rocks, i, m, k)) continue;
         const now = pos.setFromMatrixPosition(m).z;
         if (now < was) continue; // recycled to the front
         // ahead is -z: a rock on the track's ground comes nearer by about the distance slid
         expect(Math.abs(now - was - moved)).toBeLessThan(0.35 * moved);
         checked += 1;
      }
      expect(checked).toBeGreaterThan(rocks.length);
   });

   it("covers the stretch ahead after any distance with the same pool, beside the track and on the snow", () => {
      const run = createRun(101);
      const spires = decorOf("spire");
      const k = scratch();
      const m = new Matrix4();
      const at = new Vector3();
      const p = { x: 0, y: 0, z: 0 };
      const t = { x: 0, y: 0, z: 0 };
      const q = { x: 0, y: 0, z: 0 };
      for (let leg = 0; leg < 6; leg++) {
         let ahead = 0;
         let farthest = 0;
         for (let i = 0; i < spires.length * SCENERY.copies; i++) {
            if (!placeScenery(run, spires, i, m, k)) continue;
            const spot = spires[i % spires.length];
            const s = sceneryS(-spot.z, Math.floor(i / spires.length), run.s);
            expect(s).toBeLessThan(trackEnd(run));
            const c = chunkAt(run, s);
            const local = s - c.index * COURSE.chunk;
            // lateral: outside the flat corridor the track lies in
            expect(Math.abs(spot.x)).toBeGreaterThanOrEqual(GROUND.flat);
            // vertical: standing on the snow, which sits under the track surface
            const ground = groundY(c, local, corridorAt(c, local) + spot.x, p, t, q);
            sampleTrack(c, local, corridorAt(c, local), q, t);
            expect(ground).toBeLessThan(q.y);
            at.setFromMatrixPosition(m);
            worldAt(run, s, corridorAt(c, local) + spot.x, p);
            expect(at.y).toBeCloseTo(p.y - (q.y - ground) + spot.y, 1);
            if (at.z < 0) ahead += 1;
            farthest = Math.min(farthest, at.z);
         }
         expect(ahead).toBeGreaterThan(spires.length);
         expect(farthest).toBeLessThan(-45);
         slide(run, 37);
      }
   });
});

describe("penguin-slide ground strips", () => {
   it("are built once per chunk in track coordinates, under the track, in place", () => {
      for (const seed of [42, 101, 777, 9999]) {
         const run = createRun(seed);
         const k = createStripScratch();
         const positions = new Float32Array(stripFloats());
         const colors = new Float32Array(stripFloats());
         for (const c of run.chunks) {
            fillStrip(c, positions, colors, TONES, k);
            const copy = positions.slice();
            fillStrip(c, positions, colors, TONES, k);
            expect(positions).toEqual(copy);
            expect(Number.isFinite(positions[positions.length - 1])).toBe(true);
            // every ground vertex sits under the track at its own distance along the strip
            for (let row = 0; row < GROUND.rows; row++) {
               const s = (COURSE.chunk * row) / (GROUND.rows - 1);
               for (const offset of GROUND.cols) {
                  const d = corridorAt(c, s) + offset;
                  const y = groundY(c, s, d, k.p, k.t, k.q);
                  sampleTrack(c, s, corridorAt(c, s), k.q, k.t);
                  expect(y).toBeLessThanOrEqual(k.q.y - GROUND.sink + 1e-9);
               }
            }
         }
      }
   });

   it("puts the snow right under the penguin through the track's own transform", () => {
      const run = createRun(777);
      slide(run, 40);
      const frame = trackFrame(run, createTrackFrame(), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
      const c = chunkAt(run, run.s);
      const local = run.s - c.index * COURSE.chunk;
      const p = { x: 0, y: 0, z: 0 };
      const y = groundY(c, local, corridorAt(c, local), p, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
      const view = toView(frame, p.x, y, p.z, { x: 0, y: 0, z: 0 });
      expect(view.y).toBeCloseTo(-GROUND.sink, 2);
      expect(Math.abs(view.z)).toBeLessThan(0.05);
      expect(Math.abs(view.x - corridorAt(c, local))).toBeLessThan(0.05);
      // the frame is cached: asking again without moving returns the same numbers
      const again = trackFrame(run, frame, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
      expect(again.yaw).toBe(frame.yaw);
   });

   it("reach sideways past the end of the fog at every screen shape, so no edge line shows on the horizon", () => {
      const outer = Math.min(-GROUND.cols[0], GROUND.cols[GROUND.cols.length - 1]);
      for (const [width, height] of [[1280, 800], [1920, 1080], [390, 844], [360, 740], [844, 390], [932, 430]]) {
         const fitted = fitView({ ...VIEW, width, height });
         for (const factor of [1, 1.2]) {
            // camera.tsx: the camera sits at offset x factor from the focus (0, 0, -10); fog far = penguin depth + 46
            const cam = new Vector3(fitted.offset[0] * factor, fitted.offset[1] * factor, -10 + fitted.offset[2] * factor);
            const forward = new Vector3(0, 0, -10).sub(cam).normalize();
            const far = -cam.dot(forward) + 46;
            const halfWide = Math.tan((VIEW.fov * Math.PI) / 360) * (width / height);
            // a lateral edge is unfogged only if it is in view at a depth under `far`; keep a 25 % margin for lens shift and banking
            expect(outer, `${width}x${height}`).toBeGreaterThan(far * halfWide * 1.25);
         }
      }
   });

   it("keeps the backing plane under every ground vertex in view, so it never cuts through the snow", () => {
      for (const seed of [42, 101, 777]) {
         const run = createRun(seed);
         slide(run, 30);
         const frame = trackFrame(run, createTrackFrame(), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
         const k = createStripScratch();
         const view = { x: 0, y: 0, z: 0 };
         let lowest = Infinity;
         for (const c of run.chunks) {
            for (let row = 0; row < GROUND.rows; row++) {
               const s = (COURSE.chunk * row) / (GROUND.rows - 1);
               for (const offset of GROUND.cols) {
                  const y = groundY(c, s, corridorAt(c, s) + offset, k.p, k.t, k.q);
                  toView(frame, k.p.x, y, k.p.z, view);
                  lowest = Math.min(lowest, view.y);
               }
            }
         }
         expect(lowest).toBeGreaterThan(BASE_PLANE_Y + 5);
      }
   });

   it("draws each grid quad in one tone, so no diagonal tone line crosses the snow", () => {
      const run = createRun(9999);
      const k = createStripScratch();
      const positions = new Float32Array(stripFloats());
      const colors = new Float32Array(stripFloats());
      for (const c of run.chunks) {
         fillStrip(c, positions, colors, TONES, k);
         for (let q = 0; q < colors.length; q += 18) {
            for (let v = 3; v < 18; v += 3) {
               expect(colors[q + v]).toBe(colors[q]);
               expect(colors[q + v + 2]).toBe(colors[q + 2]);
            }
         }
      }
   });
});
