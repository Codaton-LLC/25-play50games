// The verbs: the wall-run (catch, hold, droop, the 1.6 s limit), the wall-kick, the column whip (90°),
// the wall-roll under spike panels, sliding panels, crumbling panels, the safety floor and determinism.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { createRun, createStepInput, rolled, step, CRUMBLE_MS, DROOP_START_MS, KICK_UP, PANEL_IN, RUN_MS, V_WALL, type WallRun } from "./rules";
import { wallOut } from "./course";

/** put the hero in the air just off a wall's face, moving into it, late enough that the reach bound is far */
function nearWall(level: 1 | 2 | 3 | 4 | 5, kind: string, hero: "kiro" = "kiro"): { run: WallRun; wi: number } {
   const run = createRun(1, level, hero);
   run.simMs = 120_000;
   const wi = run.course.walls.findIndex((w) => w.kind === kind);
   const w = run.course.walls[wi];
   const h = run.hero;
   const a = (w.a0 + w.a1) / 2 - 2;
   const y = w.y0 + 3;
   if (w.axis === "x") {
      h.x = a;
      h.z = w.c + w.n * 0.6;
      h.vz = -w.n * 6;
      h.vx = 5;
   } else {
      h.z = a;
      h.x = w.c + w.n * 0.6;
      h.vx = -w.n * 6;
      h.vz = 5;
   }
   h.y = y;
   h.vy = 0;
   h.mode = "air";
   return { run, wi };
}

function idle(run: WallRun, ms: number): void {
   const input = createStepInput();
   for (let t = 0; t < ms; t += 16) step(run, 16, input);
}

describe("wall-run", () => {
   it("moving into a glyph wall catches it: the run holds its height 0.6 s, then droops, and ends after 1.6 s", () => {
      const { run, wi } = nearWall(1, "run");
      const ev = step(run, 16, createStepInput());
      expect(ev.caught).toBe(wi);
      expect(run.hero.mode).toBe("wall");
      const y0 = run.hero.y;
      idle(run, DROOP_START_MS - 50);
      expect(run.hero.y).toBeCloseTo(y0, 6);
      expect(Math.abs(run.hero.vx) + Math.abs(run.hero.vz)).toBeCloseTo(V_WALL, 6);
      idle(run, 500);
      expect(run.hero.y).toBeLessThan(y0);
      idle(run, RUN_MS);
      expect(run.hero.mode).not.toBe("wall");
   });

   it("drifting along a wall without moving into it does not stick, unless the stick holds toward it", () => {
      const { run } = nearWall(1, "run");
      const h = run.hero;
      const w = run.course.walls.find((x) => x.kind === "run")!;
      if (w.axis === "x") h.vz = 0;
      else h.vx = 0;
      expect(step(run, 16, createStepInput()).caught).toBe(-1);
      const toward = createStepInput();
      // stick input with yaw 0 maps (moveX, moveZ) to world (x, z)
      if (w.axis === "x") toward.moveZ = -w.n;
      else toward.moveX = -w.n;
      h.mode = "air";
      expect(step(run, 16, toward).caught).toBeGreaterThanOrEqual(0);
   });

   it("Jump on a wall kicks up and across; the facing wall catches the kick and the chain links the combo", () => {
      const { run } = nearWall(2, "run");
      step(run, 16, createStepInput());
      idle(run, 300);
      const jump = createStepInput();
      jump.jumpPressed = true;
      const ev = step(run, 16, jump);
      expect(ev.kicked).toBe(true);
      expect(run.hero.vy).toBeLessThanOrEqual(KICK_UP);
      expect(run.hero.vy).toBeGreaterThan(KICK_UP - 1);
      let caught = -1;
      for (let i = 0; i < 80 && caught < 0; i++) caught = step(run, 16, createStepInput()).caught;
      expect(caught).toBeGreaterThanOrEqual(0);
      expect(run.combo.chain).toBe(1);
   });
});

describe("column whip", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: passing a column at speed swings exactly 90° round it`, () => {
         const run = createRun(1, level, "kiro");
         run.simMs = 120_000;
         const c = run.course.columns[0];
         const h = run.hero;
         // come at it along +x, 1.2 m to its side, slightly early
         h.x = c.x - 1.0;
         h.z = c.z - 1.2;
         h.y = (c.y0 + c.y1) / 2;
         h.vx = 8;
         h.vz = 0;
         h.vy = 0;
         h.mode = "air";
         const ev = step(run, 16, createStepInput());
         expect(ev.whipped).toBe(0);
         let end = false;
         for (let i = 0; i < 60 && !end; i++) end = step(run, 16, createStepInput()).whipEnd;
         expect(end).toBe(true);
         expect(Math.abs(h.vx)).toBeLessThan(0.5);
         expect(Math.abs(h.vz)).toBeGreaterThan(7.5);
      });
   }
});

describe("hazards and wall kinds", () => {
   it("a spike panel kills a runner, and a roll (Action on the wall) passes under it", () => {
      for (const roll of [false, true]) {
         const run = createRun(1, 3, "kiro");
         run.simMs = 120_000;
         const s = run.course.spikes[0];
         const w = run.course.walls[s.wall];
         const h = run.hero;
         const mid = w.axis === "x" ? (s.x0 + s.x1) / 2 : (s.z0 + s.z1) / 2;
         h.mode = "wall";
         h.wall = s.wall;
         h.wallT = 100;
         h.runDir = 1;
         h.y = s.y0 + 3;
         if (w.axis === "x") {
            h.x = mid - 1.6;
            h.z = w.c + w.n * 0.4;
         } else {
            h.z = mid - 1.6;
            h.x = w.c + w.n * 0.4;
         }
         const input = createStepInput();
         input.actionPressed = roll;
         let lost = false;
         for (let i = 0; i < 40 && !lost; i++) {
            lost = step(run, 16, input).lost || lost;
            input.actionPressed = false;
         }
         expect(lost, roll ? "rolled" : "ran").toBe(!roll);
         if (roll) expect(rolled(h, run.simMs) || (h.mode as string) !== "lost").toBe(true);
      }
   });

   it("a crumbling panel cracks 0.8 s after the run on it starts and drops the runner", () => {
      const { run, wi } = nearWall(4, "crumble");
      expect(step(run, 16, createStepInput()).caught).toBe(wi);
      let crumbled = -1;
      for (let t = 0; t < CRUMBLE_MS + 100 && crumbled < 0; t += 16) crumbled = step(run, 16, createStepInput()).crumbled;
      expect(crumbled).toBeGreaterThanOrEqual(0);
      expect(run.hero.mode).not.toBe("wall");
   });

   it("a sliding panel is runnable only while it is out, and an in panel still stops the hero 1.2 m back", () => {
      const { run, wi } = nearWall(2, "moving");
      const w = run.course.walls[wi];
      // find a moment the panel is in
      while (wallOut(w, run.simMs)) run.simMs += 50;
      const h = run.hero;
      for (let i = 0; i < 40; i++) step(run, 16, createStepInput());
      expect(h.mode).not.toBe("wall");
      const d = ((w.axis === "x" ? h.z : h.x) - w.c) * w.n;
      expect(d).toBeGreaterThan(-PANEL_IN - 0.05);
   });

   it("level 1's safety floor resets to the checkpoint without counting a fall", () => {
      const run = createRun(1, 1, "kiro");
      const f = run.course.pads.find((p) => p.kind === "floor")!;
      const h = run.hero;
      run.simMs = 60_000;
      h.mode = "air";
      h.x = f.x;
      h.z = f.z;
      h.y = f.y + 1;
      h.vy = -5;
      let reset = false;
      for (let i = 0; i < 30 && !reset; i++) reset = step(run, 16, createStepInput()).floorReset;
      expect(reset).toBe(true);
      expect(run.hits).toBe(0);
   });

   it("repeats a run from the same inputs", () => {
      const a = createRun(3, 2, "nami");
      const b = createRun(3, 2, "nami");
      const input = createStepInput();
      input.moveX = 1;
      for (let i = 0; i < 200; i++) {
         input.jumpPressed = i % 37 === 0;
         step(a, 16, input);
         step(b, 16, input);
      }
      expect(a.hero.x).toBe(b.hero.x);
      expect(a.hero.y).toBe(b.hero.y);
      expect(a.hero.mode).toBe(b.hero.mode);
   });
});
