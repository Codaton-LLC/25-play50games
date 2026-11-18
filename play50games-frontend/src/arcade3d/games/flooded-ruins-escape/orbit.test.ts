// Flooded Ruins Escape with the shared orbit camera (menu2/camera): camera-relative movement through
// the rules' own input (StepInput.yaw), the honest bot unchanged at the default yaw, the proof's
// floor for any yaw, the intro ending on the orbit's first pose, the camera's solid boxes, and the
// preselected hero (W2: Nami).
import { describe, expect, it } from "vitest";
import { createRng, inputToWorld } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { RUIN_ORBIT, courseSolids, orbitLookUp, orbitPivot, orbitScale, playCamera, startSpot } from "./camera";
import { PROPOSED_LEVEL_LIMITS, courseFor, createRun, createStepInput, runTimeMs, step, type RuinRun, type StepInput } from "./rules";
import { pickedHero, resetHeroPick, selectHero } from "./heroes";

/** The honest bot to the end at 60 fps; `yaw` (if given) is written into every step input. */
function botRun(level: LevelId, yaw?: number): RuinRun {
   const run = createRun(1, level);
   const bot = createBot(run, 1000 / 60);
   const input: StepInput = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      if (yaw !== undefined) input.yaw = yaw;
      botInput(bot, run, input);
      step(run, 1000 / 60, input);
   }
   return run;
}

const outcome = (r: RuinRun) => ({ ended: r.ended, finishMs: r.finishMs, orbs: r.orbs, respawns: r.respawns, simMs: r.simMs, x: r.hero.x, y: r.hero.y, z: r.hero.z });

describe("camera-relative movement is part of the rules' input", () => {
   it("the honest bot's results are unchanged with the yaw fixed at the default (0) on every level", () => {
      expect(RUIN_ORBIT.yaw ?? 0).toBe(0);
      for (const level of LEVEL_IDS) {
         const plain = botRun(level);
         const fixed = botRun(level, RUIN_ORBIT.yaw ?? 0);
         expect(outcome(fixed)).toEqual(outcome(plain));
         expect(plain.ended).toBe("win");
      }
   }, 300_000);

   it("a turned camera turns the stick: up moves away from the camera at any yaw, the same as the world input", () => {
      for (const yaw of [0.5, Math.PI / 2, -2.4, Math.PI]) {
         const a = createRun(3);
         const b = createRun(3);
         const turned = createStepInput();
         turned.moveZ = -1; // stick up
         turned.yaw = yaw;
         const w = inputToWorld(0, -1, yaw);
         const world = createStepInput();
         world.moveX = w.x;
         world.moveZ = w.z;
         for (let f = 0; f < 15; f++) {
            step(a, 1000 / 60, turned);
            step(b, 1000 / 60, world);
         }
         expect(a.hero.x).toBeCloseTo(b.hero.x, 9);
         expect(a.hero.z).toBeCloseTo(b.hero.z, 9);
         // away from a camera at pivot + (sin yaw, cos yaw)
         const s = createRun(3).hero;
         expect((a.hero.x - s.x) * Math.sin(yaw) + (a.hero.z - s.z) * Math.cos(yaw)).toBeLessThan(0);
      }
   });

   it("spam with a random camera yaw every frame never beats the proof's floor (turning keeps the stick's length)", () => {
      const rng = createRng(7);
      for (let k = 0; k < 30; k++) {
         const run = createRun(k, 1);
         const input = createStepInput();
         for (let f = 0; f < 15_000 && run.ended === null; f++) {
            input.moveX = rng() * 2 - 1;
            input.moveZ = rng() * 2 - 1;
            input.yaw = (rng() * 2 - 1) * 10;
            input.jumpPressed = rng() < 0.3;
            input.jumpHeld = rng() < 0.5;
            input.actionPressed = rng() < 0.05;
            step(run, 4 + rng() * 40, input);
         }
         if (run.ended === "win") expect(runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].minDurationMs);
      }
   }, 120_000);

   it("a broken yaw (NaN, Infinity) counts as 0", () => {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
         const a = createRun(2);
         const b = createRun(2);
         const broken = createStepInput();
         broken.moveZ = -1;
         broken.yaw = bad;
         const ok = createStepInput();
         ok.moveZ = -1;
         for (let f = 0; f < 20; f++) {
            step(a, 16, broken);
            step(b, 16, ok);
         }
         expect(a.hero.z).toBe(b.hero.z);
         expect(a.hero.x).toBe(b.hero.x);
      }
   });
});

describe("orbit camera adoption", () => {
   it("the intro ends exactly on the orbit camera's first pose (seamless hand-over), on every level", () => {
      for (const id of LEVEL_IDS) {
         const course = courseFor(id);
         for (const aspect of [1.6, 390 / 844]) {
            const play = playCamera(course, aspect);
            const o = createOrbit(RUIN_ORBIT);
            const s = startSpot(course);
            const p = orbitPivot(s.x, s.y, s.z, { x: 0, y: 0, z: 0 });
            const c = orbitPosition(p.x, p.y, p.z, o.viewYaw, o.viewPitch, o.viewDistance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            expect(play.position[0]).toBeCloseTo(c.x, 9);
            expect(play.position[1]).toBeCloseTo(c.y, 9);
            expect(play.position[2]).toBeCloseTo(c.z, 9);
            expect(play.lookAt).toEqual([p.x, p.y + orbitLookUp(aspect), p.z]);
            // behind (+z) and above the hero
            expect(c.z).toBeGreaterThan(s.z);
            expect(c.y).toBeGreaterThan(s.y + 1);
         }
         const run = createRun(1, id);
         expect(startSpot(course)).toEqual({ x: run.hero.x, y: run.hero.y, z: run.hero.z });
      }
   });

   it("the camera's solids are the nearby blocks (crates where they float, broken brick left out)", () => {
      const run = createRun(1, 1);
      const out: AABB[] = Array.from({ length: 256 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const s = startSpot(run.course);
      const n = courseSolids(run, 0, s.x, s.y + 3, s.z + 6, out);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(run.course.supports.length);
      const start = run.course.supports[run.course.checkpoints[0]];
      expect(out.slice(0, n).some((b) => b.max.y === start.top && b.min.x <= s.x && b.max.x >= s.x)).toBe(true);
      // far away: nothing
      expect(courseSolids(run, 0, 500, 500, 500, out)).toBe(0);
      // capacity respected
      expect(courseSolids(run, 0, s.x, s.y, s.z, out.slice(0, 2))).toBeLessThanOrEqual(2);
   });
});

describe("the preselected hero", () => {
   it("Flooded Ruins Escape (W2 Sky & Sea) preselects Nami; the player's own pick is kept", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("flooded-ruins-escape")).toBe("nami");
      expect(pickedHero()).toBe("nami");
      selectHero("zuno");
      resetHeroPick(); // a reload
      expect(pickedHero()).toBe("zuno");
      // the rules' own default (bots, proofs) is World 2's lead too
      expect(createRun(1).heroId).toBe("nami");
      selectHero("nami");
   });
});
