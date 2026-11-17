// Gate pins (2026-10-25 review): each test kills a mutation the level suite let through.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "../../types";
import { levelEnvironment } from "../../core/levels";
import { LEVELS } from "./levels";
import { CUP, createBall, createBallEvents, launchBall, placeBall, stepBall } from "./physics";
import { createRun, syncStore, type StoreActions } from "./rules";
import definition from "./index";
vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

describe("mini-golf level knobs the main suite does not reach", () => {
   it("the time-left pill starts at 90 % of the level's own cap and counts down to it", () => {
      for (const id of LEVEL_IDS) {
         const cap = LEVELS[id].capS;
         const stats: Record<string, number> = {};
         const store: StoreActions = { addScore: () => undefined, setStat: (k, v) => { stats[k] = v; }, end: () => undefined };
         const run = createRun(5, LEVELS[id]);
         run.time = cap * 0.9 - 0.01;
         syncStore(run, store);
         expect(stats.timeLeft, `L${id}`).toBeUndefined();
         run.time = cap * 0.9 + 0.5;
         syncStore(run, store);
         expect(stats.timeLeft, `L${id}`).toBe(Math.ceil(cap * 0.1 - 0.5));
      }
      expect(LEVELS[1].capS * 0.9).toBe(540); // today's RUN.warnAt
   });

   it("a lip-out turns the ball by the level's cup radius (1 - miss / radius)", () => {
      const turned = (id: 1 | 4, offset: number) => {
         const h = createRun(19, LEVELS[id]).course[0];
         const at = { x: h.cup.x + offset, z: h.cup.z + 0.001 };
         const b = createBall(at, false), ev = createBallEvents();
         placeBall(h, b, at, false); launchBall(b, 0, 3);
         const before = Math.atan2(b.vx, -b.vz);
         stepBall(h, b, 0, 1 / 240, ev);
         expect(ev.lipOut).toBe(true);
         return Math.abs(Math.atan2(b.vx, -b.vz) - before) / CUP.lipTurn;
      };
      expect(turned(1, 0.05)).toBeCloseTo(0.5, 1);
      expect(turned(4, 0.05)).toBeCloseTo(1 - 0.05 / LEVELS[4].cupRadius, 1);
   });

   it("a ball that stops just outside a smaller cup stays out (and inside it drops)", () => {
      const rest = (id: 1 | 4, offset: number) => {
         const h = createRun(19, LEVELS[id]).course[0];
         const at = { x: h.cup.x + offset, z: h.cup.z };
         const b = createBall(at, false), ev = createBallEvents();
         placeBall(h, b, at, false); launchBall(b, Math.PI / 2, 0.02);
         for (let i = 0; i < 2400 && b.mode !== "rest" && !ev.captured; i++) stepBall(h, b, i / 240, 1 / 240, ev);
         return ev.captured;
      };
      expect(rest(1, 0.09)).toBe(true);
      expect(rest(4, 0.09)).toBe(false);
      expect(rest(4, 0.07)).toBe(true);
   });

   it("each level's lighting reaches the stage", () => {
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["day", "day", "sunset", "night", "sunset"]);
   });
});
