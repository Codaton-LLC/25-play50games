// Ultimate Color Trial with the shared orbit camera (menu2/camera): camera-relative movement through
// the rules' own input (StepInput.yaw), the start view looking down the corridor, the intro ending on
// the orbit's first pose, the camera's solid boxes (walls, shut exits, door rows, nook barriers), the
// level 5 framing that keeps the Sentinel in shot, and the preselected hero (no lead: Riko).
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, orbitPosition, orbitRotate, stepOrbit } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { BOSS_FRAME, FOV, FOV_PORTRAIT, bossInFrame, trialOrbit, courseSolids, orbitLookUp, orbitPivot, orbitScale, playCamera, steerBossFraming } from "./camera";
import { createBot, botInput } from "./bot";
import { createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";

const boxes = () => Array.from({ length: 96 }, (): AABB => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));

describe("camera-relative movement is part of the rules' input", () => {
   it("a turned camera turns the stick exactly like the world input", () => {
      for (const yaw of [0.5, Math.PI / 2, -2.4, Math.PI]) {
         const a = createRun(3, 1);
         const b = createRun(3, 1);
         const turned = createStepInput();
         turned.moveX = 0.3;
         turned.moveZ = -1;
         turned.yaw = yaw;
         const w = inputToWorld(0.3, -1, yaw);
         const world = createStepInput();
         world.moveX = w.x;
         world.moveZ = w.z;
         for (let f = 0; f < 60; f++) {
            step(a, 1000 / 60, turned);
            step(b, 1000 / 60, world);
         }
         expect(a.hero.x).toBeCloseTo(b.hero.x, 9);
         expect(a.hero.z).toBeCloseTo(b.hero.z, 9);
      }
   });

   it("from each level's start view, up on the stick runs down the corridor (+z)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, id);
         const i = createStepInput();
         i.moveZ = -1;
         i.yaw = trialOrbit(run.course).yaw ?? 0;
         const z0 = run.hero.z;
         for (let f = 0; f < 20; f++) step(run, 1000 / 60, i);
         expect(run.hero.z, `L${id}`).toBeGreaterThan(z0 + 0.5);
      }
   });

   it("the intro ends on the orbit's first pose, at every aspect", () => {
      for (const id of LEVEL_IDS) {
         const c = createRun(1, id).course;
         for (const aspect of [1.6, 0.46]) {
            const o = trialOrbit(c);
            const pose = playCamera(c, aspect);
            const want = orbitPosition(c.startX, 1.1, c.startZ, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 0) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            expect(pose.position[0]).toBeCloseTo(want.x, 9);
            expect(pose.position[1]).toBeCloseTo(want.y, 9);
            expect(pose.position[2]).toBeCloseTo(want.z, 9);
            expect(pose.lookAt[1]).toBeCloseTo(1.1 + orbitLookUp(aspect), 9);
         }
      }
   });

   it("the camera's solids: the walls, a shut exit gate (gone once the section is done), a door of another colour, the crystal wall until it is broken", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const out = boxes();
      const rings = c.sections.find((s) => s.kind === "rings")!;
      const shut = courseSolids(run, 0, rings.z1, out);
      expect(shut).toBeGreaterThan(0);
      run.secDone[rings.index] = 1;
      expect(courseSolids(run, 0, rings.z1, out)).toBe(shut - 1);
      const row = c.rows[0];
      const noCharge = courseSolids(run, 0, row.z, out);
      run.charge = row.doors[0].color;
      expect(courseSolids(run, 0, row.z, out)).toBe(noCharge - 1);
      const wi = c.nooks.findIndex((n) => n.kind === "wall");
      const w = c.nooks[wi];
      const before = courseSolids(run, w.disc.x, w.disc.z, out);
      run.wallBroken[wi] = 1;
      expect(courseSolids(run, w.disc.x, w.disc.z, out)).toBe(before - 1);
   });
});

describe("level 5's boss framing keeps the Sentinel in shot", () => {
   it("through every vulnerable window of an honest run, the hero and the Sentinel stay on screen, under the boss bar (desktop and phone)", () => {
      for (const aspect of [1280 / 800, 390 / 844]) {
         for (const fps of [30, 60]) {
            const dt = 1 / fps;
            const run = createRun(1, 5);
            const bot = createBot(run, 1000 / fps);
            const input = createStepInput();
            const orbit = createOrbit(trialOrbit(run.course));
            const fov = aspect < 1 ? FOV_PORTRAIT : FOV;
            let samples = 0;
            let framed = 0;
            for (let f = 0; f < fps * 200 && run.ended === null; f++) {
               botInput(bot, run, input);
               step(run, 1000 / fps, input);
               steerBossFraming(orbit, run, dt, aspect);
               stepOrbit(orbit, dt, 0, 0, false);
               if (run.boss && run.bossAwake && run.boss.hp > 0 && run.boss.step === "vulnerable") {
                  samples++;
                  if (bossInFrame(run, orbit.viewYaw, orbit.viewPitch, orbit.viewDistance * orbitScale(aspect), orbitLookUp(aspect), fov, aspect)) framed++;
               }
            }
            expect(run.ended, `${fps}`).toBe("win");
            expect(samples).toBeGreaterThan(fps * 5);
            expect(framed, `aspect ${aspect.toFixed(2)} at ${fps} fps`).toBe(samples);
         }
      }
   }, 180_000);

   it("without the framing, the level's own view loses him (the check is not vacuous)", () => {
      const run = createRun(1, 5);
      const bot = createBot(run);
      const input = createStepInput();
      const orbit = createOrbit(trialOrbit(run.course));
      let samples = 0;
      let framed = 0;
      for (let f = 0; f < 60 * 200 && run.ended === null; f++) {
         botInput(bot, run, input);
         step(run, 1000 / 60, input);
         stepOrbit(orbit, 1 / 60, 0, 0, false);
         if (run.boss && run.bossAwake && run.boss.hp > 0 && run.boss.step === "vulnerable") {
            samples++;
            if (bossInFrame(run, orbit.viewYaw, orbit.viewPitch, orbit.viewDistance * orbitScale(1.6), orbitLookUp(1.6), FOV, 1.6)) framed++;
         }
      }
      expect(samples).toBeGreaterThan(0);
      expect(framed).toBeLessThan(samples);
   }, 90_000);

   it("the pivot leans toward the Sentinel (at most BOSS_FRAME.maxLead) once he is awake; other levels keep the small lead", () => {
      const run = createRun(1, 5);
      const bs = run.course.bossSpec!;
      run.bossAwake = true;
      run.hero.x = bs.x;
      run.hero.z = bs.z - 26;
      const p = orbitPivot(run, { x: 0, y: 0, z: 0 });
      expect(p.z - run.hero.z).toBeCloseTo(BOSS_FRAME.maxLead, 6);
      const r1 = createRun(1, 1);
      const p1 = orbitPivot(r1, { x: 0, y: 0, z: 0 });
      expect(Math.hypot(p1.x - r1.hero.x, p1.z - r1.hero.z)).toBeLessThanOrEqual(2.5 + 1e-9);
   });

   it("manual input wins: no steering until the orbit has been idle for its auto-follow delay; none before he wakes, on other levels, or after the defeat", () => {
      const run = createRun(1, 5);
      const bs = run.course.bossSpec!;
      run.hero.x = -4;
      run.hero.z = bs.z - 20;
      const orbit = createOrbit(trialOrbit(run.course));
      orbit.idle = 99;
      expect(steerBossFraming(orbit, run, 1 / 60)).toBe(false);
      run.bossAwake = true;
      orbitRotate(orbit, 1, 0);
      const yaw = orbit.yaw;
      expect(steerBossFraming(orbit, run, 1 / 60)).toBe(false);
      expect(orbit.yaw).toBe(yaw);
      orbit.idle = orbit.settings.autoFollowDelay;
      expect(steerBossFraming(orbit, run, 1 / 60)).toBe(true);
      expect(orbit.yaw).not.toBe(yaw);
      run.boss!.hp = 0;
      expect(steerBossFraming(orbit, run, 1 / 60)).toBe(false);
      const r1 = createRun(1, 1);
      const o1 = createOrbit(trialOrbit(r1.course));
      o1.idle = 99;
      expect(steerBossFraming(o1, r1, 1 / 60)).toBe(false);
   });
});

describe("the preselected hero", () => {
   it("the finale has no lead hero: Riko by default; a pick is remembered for the next run", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("ultimate-color-trial", null)).toBe("riko");
      expect(DEFAULT_HERO).toBe("riko");
      expect(pickedHero()).toBe("riko");
      selectHero("vexa");
      expect(pickedHero()).toBe("vexa");
      resetHeroPick();
   });
});
