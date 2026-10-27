// modes, simulate, framing, results and device (the small pure modules).
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { MODES, dispatchAllyPower, type AllyPowerEvent } from "./modes";
import { createPlayerSims, stepPlayerSims, type PlayerSimSpec } from "./simulate";
import { REF_BOX, REF_SPAN, createFraming, frameHeroes, sharedCameraPose, splitViewports } from "./framing";
import { podiumOrder, rankRace, teamResult, type Standing } from "./results";
import { multiplayerAllowed } from "./device";

describe("modes", () => {
   it("co-op wants unique heroes and combines powers; versus does neither", () => {
      expect(MODES.coop).toMatchObject({ uniqueHeroes: true, allyPowers: true, sharedCheckpoints: true, ranking: "team" });
      expect(MODES.versus).toMatchObject({ uniqueHeroes: false, allyPowers: false, sharedCheckpoints: false, ranking: "race" });
   });

   it("dispatchAllyPower calls onAllyPower for every active ally, only in co-op", () => {
      const sims = ["a", "b", "c", "d"];
      const got: AllyPowerEvent<string>[] = [];
      const hook = (e: AllyPowerEvent<string>) => got.push(e);
      expect(dispatchAllyPower(MODES.versus, sims, 1, "shield", hook)).toBe(0);
      expect(got).toHaveLength(0);
      expect(dispatchAllyPower(MODES.coop, sims, 1, "shield", hook, [true, true, false, true])).toBe(2);
      expect(got.map((e) => [e.from, e.to, e.ally, e.source, e.power])).toEqual([
         [1, 0, "a", "b", "shield"],
         [1, 3, "d", "b", "shield"],
      ]);
      expect(dispatchAllyPower(MODES.coop, sims, 0, "x", undefined)).toBe(0);
   });
});

describe("simulate: N sims, the same deterministic rules", () => {
   // a toy seeded rule: position advances by input plus a seeded drift
   interface Toy {
      seed: number;
      index: number;
      x: number;
      t: number;
   }
   const spec: PlayerSimSpec<Toy, number, { x: number }> = {
      create: (seed, index) => ({ seed, index, x: 0, t: 0 }),
      step(sim, dtMs, input) {
         sim.t += dtMs;
         sim.x += input * dtMs + ((sim.seed * 9301 + sim.t * 49297) % 233280) / 233280;
         return { x: sim.x };
      },
   };

   it("gives every player the same seed and steps them in lock-step", () => {
      const g = createPlayerSims(spec, 1234, 3);
      expect(g.sims.map((s) => [s.seed, s.index])).toEqual([
         [1234, 0],
         [1234, 1],
         [1234, 2],
      ]);
      for (let f = 0; f < 60; f++) stepPlayerSims(spec, g, 16, [1, 1, undefined], 0);
      expect(g.sims[0].x).toBe(g.sims[1].x);
      expect(g.sims[2].x).toBeLessThan(g.sims[0].x);
      expect(g.sims.every((s) => s.t === 960)).toBe(true);
      expect(g.events[0]).toEqual({ x: g.sims[0].x });
   });

   it("skips a dropped player", () => {
      const g = createPlayerSims(spec, 1, 2);
      stepPlayerSims(spec, g, 16, [0, 0], 0, (i) => i === 1);
      expect(g.sims[1].t).toBe(0);
      expect(g.sims[0].t).toBe(16);
   });
});

describe("framing (shared camera)", () => {
   it("frames one hero at the minimum span and every hero of a group", () => {
      const f = frameHeroes([{ x: 2, y: 5, z: -1 }], undefined, { minSpan: 6, maxSpan: 24, padding: 1, heroHeight: 1.5 });
      expect(f.span).toBe(6);
      expect([f.x, f.z]).toEqual([2, -1]);
      expect(f.inView).toEqual([true]);
      const g = frameHeroes(
         [
            { x: -4, y: 0, z: 0 },
            { x: 6, y: 2, z: -3 },
         ],
         undefined,
         { minSpan: 6, maxSpan: 24, padding: 1 },
      );
      expect(g.span).toBe(12);
      expect(g.clamped).toBe(false);
      expect(g.inView).toEqual([true, true]);
   });

   it("holds the zoom limit and keeps the anchor in frame", () => {
      const pts = [
         { x: 0, y: 0, z: 0 },
         { x: 0, y: 60, z: -40 },
      ];
      const f = frameHeroes(pts, undefined, { minSpan: 6, maxSpan: 20, padding: 1, heroHeight: 1.5, anchor: 1 });
      expect(f.span).toBe(20);
      expect(f.clamped).toBe(true);
      expect(f.inView).toEqual([false, true]);
      const c = frameHeroes(pts, undefined, { maxSpan: 20, anchor: 0 });
      expect(c.inView).toEqual([true, false]);
   });

   it("leaves inactive points out and keeps the old frame with none", () => {
      const out = createFraming();
      frameHeroes([{ x: 1, y: 0, z: 1 }, { x: 100, y: 0, z: 100 }], [true, false], {}, out);
      expect(out.count).toBe(1);
      expect(out.inView).toEqual([true, false]);
      const x = out.x;
      frameHeroes([{ x: 50, y: 0, z: 0 }], [false], {}, out);
      expect(out.count).toBe(0);
      expect(out.x).toBe(x);
   });

   it("the scaled reference fit keeps the frame cube on screen (perspective scales exactly)", () => {
      const width = 1280;
      const height = 720;
      const fov = 55;
      const ref = fitView({ width, height, fov, area: REF_BOX, pitch: 0.45, yaws: [0], margin: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 } });
      const framing = frameHeroes(
         [
            { x: 3, y: 12, z: -20 },
            { x: -5, y: 18, z: -26 },
            { x: 0, y: 14, z: -22 },
         ],
         undefined,
         { minSpan: 6, maxSpan: 30 },
      );
      const pose = sharedCameraPose(framing, ref.offset, { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 });
      const cam = new PerspectiveCamera(fov, width / height, 0.1, 1000);
      cam.position.set(pose.px, pose.py, pose.pz);
      cam.lookAt(pose.lx, pose.ly, pose.lz);
      cam.updateMatrixWorld();
      const h = framing.span / 2;
      const p = new Vector3();
      for (const dx of [-h, h]) {
         for (const dz of [-h, h]) {
            for (const y of [framing.y, framing.y + framing.span]) {
               p.set(framing.x + dx, y, framing.z + dz).project(cam);
               expect(Math.abs(p.x)).toBeLessThanOrEqual(0.9 + 1e-6);
               expect(Math.abs(p.y)).toBeLessThanOrEqual(0.9 + 1e-6);
            }
         }
      }
      expect(REF_SPAN).toBe(10);
   });

   it("splits 2 side by side (landscape) or stacked (portrait), 3-4 in a grid", () => {
      expect(splitViewports(2, 1000, 600, 0)).toEqual([
         { left: 0, top: 0, width: 500, height: 600 },
         { left: 500, top: 0, width: 500, height: 600 },
      ]);
      expect(splitViewports(2, 600, 1000, 0)[1]).toEqual({ left: 0, top: 500, width: 600, height: 500 });
      expect(splitViewports(3, 800, 600, 0)).toHaveLength(3);
      expect(splitViewports(4, 800, 600, 0)[3]).toEqual({ left: 400, top: 300, width: 400, height: 300 });
      expect(splitViewports(1, 800, 600)).toEqual([{ left: 0, top: 0, width: 800, height: 600 }]);
   });
});

describe("results (podium)", () => {
   const st = (index: number, finished: boolean, timeMs: number | null, score = 0, progress = 0): Standing => ({ index, finished, timeMs, score, progress });

   it("ranks finishers by time, then the rest by progress; ties share a place", () => {
      const placed = rankRace([st(0, false, null, 3, 40), st(1, true, 30000, 1), st(2, true, 25000, 0), st(3, false, null, 0, 55)]);
      expect(placed.map((p) => [p.index, p.place])).toEqual([
         [2, 1],
         [1, 2],
         [3, 3],
         [0, 4],
      ]);
      const tie = rankRace([st(0, true, 20000, 2), st(1, true, 20000, 2)]);
      expect(tie.map((p) => p.place)).toEqual([1, 1]);
   });

   it("draws the podium 2nd, 1st, 3rd, 4th", () => {
      const order = podiumOrder([{ place: 1, id: "a" }, { place: 2, id: "b" }, { place: 3, id: "c" }, { place: 4, id: "d" }]);
      expect(order.map((o) => o.id)).toEqual(["b", "a", "c", "d"]);
   });

   it("co-op is a team result: cleared only when all finish, timed by the last", () => {
      expect(teamResult([st(0, true, 30000, 4), st(1, true, 41000, 6)])).toEqual({ cleared: true, timeMs: 41000, score: 10, finishers: 2 });
      expect(teamResult([st(0, true, 30000), st(1, false, null)])).toMatchObject({ cleared: false, timeMs: null, finishers: 1 });
   });
});

describe("device: phones stay single player", () => {
   it("hides multiplayer under 700 px and on coarse-only pointers without a gamepad", () => {
      expect(multiplayerAllowed({ width: 1280, finePointer: true, gamepads: 0 })).toBe(true);
      expect(multiplayerAllowed({ width: 699, finePointer: true, gamepads: 2 })).toBe(false);
      expect(multiplayerAllowed({ width: 1024, finePointer: false, gamepads: 0 })).toBe(false);
      expect(multiplayerAllowed({ width: 1024, finePointer: false, gamepads: 1 })).toBe(true);
      expect(multiplayerAllowed({ width: Number.NaN, finePointer: true, gamepads: 0 })).toBe(false);
   });
});
