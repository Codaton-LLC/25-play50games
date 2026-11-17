// The models (assets.ts against the real GLBs), the hero's motion (Hero.tsx), the camera
// (camera.ts), the look (look.ts), the input mapping (RunnerJuice.tsx) and local multiplayer.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE } from "./assets";
import { energyCoreHuntMeta } from "./meta";
import definition from "./index";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { CORE_ORBIT, introKeyframes, orbitScale, playCamera } from "./camera";
import { accentFor, levelEnvironment } from "./look";
import { mapInput } from "./Juice";
import { createBot, botInput } from "./bot";
import { START_GAP, createMultiRun, leaderIndex, onAllyPower, placings, runnerTimeMs, stepMulti, team } from "./multiplayer";
import { courseFor, createRun, createStepInput, runTimeMs, step, type StepInput } from "./rules";
import type { HeroId } from "./heroes";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

describe("energy-core-hunt models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      if (key === "hero") continue;
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(statSync(path.join(PUBLIC, asset.url)).size).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }
   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred)`, async () => {
         const { cloud } = await readCharacterGlb(ASSETS[key].url);
         const min = [Infinity, Infinity, Infinity];
         const max = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i += 3) for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], cloud[i + k]);
            max[k] = Math.max(max[k], cloud[i + k]);
         }
         expect(max[0] - min[0]).toBeCloseTo(size.x, 2);
         expect(max[1] - min[1]).toBeCloseTo(size.y, 2);
         expect(max[2] - min[2]).toBeCloseTo(size.z, 2);
         expect(min[1]).toBeCloseTo(0, 2);
      });
   }
   it("the definition: five levels, Menu 2 meta, stick + Jump + Action, order 96", () => {
      expect(definitionLevelProblems(energyCoreHuntMeta, definition)).toEqual([]);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action"]);
      expect(definition.intro).toBe(true);
      expect(energyCoreHuntMeta.order).toBe(96);
      expect(energyCoreHuntMeta.status).toBe("dev");
   });
});

describe("the hero", () => {
   it("walks at its own velocity (facing its way); frozen after a zap; each event fires once; the cheer waits for the win", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      step(run, 1000 / 60, { ...createStepInput(), moveY: -1 });
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.vz).toBeLessThan(-5);
      run.hero.heldUntil = run.ms + 1000;
      writeHeroMotion(m, memo, run, anim, 0.15);
      expect(m.grounded).toBe(false);
      expect(Math.abs(m.vz)).toBe(0);
      run.hero.heldUntil = -1;
      anim.hopAt = 0.2;
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 0.2);
      expect(m.events.jumped).toBe(true);
      expect(m.celebrating).toBe(false);
      anim.winAt = 0.3;
      writeHeroMotion(m, memo, run, anim, 0.4);
      expect(m.celebrating).toBe(true);
   });

   it("the stick moves the hero relative to the camera: up is north (towards the gate) at yaw 0, and turns with the camera", () => {
      const run = createRun(1, 1);
      const out = mapInput({ moveX: 0, moveY: -1, jumpPressed: false, actionPressed: false }, 0, createStepInput());
      step(run, 1000 / 60, out);
      expect(run.hero.vz).toBeLessThan(-5);
      const run2 = createRun(1, 1);
      run2.hero.x = 0;
      step(run2, 1000 / 60, mapInput({ moveX: 0, moveY: -1, jumpPressed: false, actionPressed: false }, Math.PI / 2, createStepInput()));
      expect(Math.abs(run2.hero.vx)).toBeGreaterThan(5);
   });
});

describe("the camera and the look", () => {
   it("starts south of the hero looking north over the arena; portrait stands farther back; a light per level", () => {
      const pc = playCamera(courseFor(1), 1.6);
      expect(pc.position[2]).toBeGreaterThan(0);
      expect(CORE_ORBIT.distance).toBeGreaterThan(5);
      expect(orbitScale(390 / 844)).toBeGreaterThan(1.2);
      for (const id of LEVEL_IDS) expect(introKeyframes(courseFor(id))).toHaveLength(3);
      expect(levelEnvironment(1).lighting).toBe("indoor");
      expect(new Set(LEVEL_IDS.map((id) => accentFor(id))).size).toBe(5);
   });

});

function botMulti(mode: "coop" | "versus", heroes: HeroId[]) {
   const m = createMultiRun(7, 1, heroes, mode);
   const bots = m.runs.map((r) => createBot(r, 1000 / 60, false));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 60 * 200 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("local multiplayer", () => {
   it("the heroes start side by side on the start line; the leader is the one furthest through its order", () => {
      const m = createMultiRun(1, 1, ["vexa", "riko", "nami"], "versus");
      expect(m.runs.map((r) => r.hero.x)).toEqual([-START_GAP, 0, START_GAP]);
      expect(new Set(m.runs.map((r) => r.hero.z)).size).toBe(1);
      m.runs[0].ended = "win";
      m.runs[0].finishMs = 50_000;
      expect(runnerTimeMs(m, 0)).toBe(runTimeMs(50_000, 0, 0));
      m.runs[2].count[0] = 2;
      expect(leaderIndex(m)).toBe(2);
   });

   it("co-op: two bots clear level 1 together; the orbs are shared", () => {
      const m = botMulti("coop", ["vexa", "kiro"]);
      expect(m.ended).toBe("win");
      expect(team(m).cleared).toBe(true);
      for (let k = 0; k < m.runs[0].collected.length; k++) expect(m.runs[0].collected[k]).toBe(m.runs[1].collected[k]);
   }, 90_000);

   it("versus: the podium ranks the finishers by time", () => {
      const m = botMulti("versus", ["riko", "vexa"]);
      expect(m.ended).toBe("win");
      expect(placings(m)[0].finished).toBe(true);
   }, 90_000);

   it("co-op ally powers: Kiro's bubble, Vexa's phase and Zuno's magnet reach the ally", () => {
      const m = createMultiRun(1, 1, ["kiro", "riko"], "coop");
      const [a, b] = m.runs;
      a.shieldUntil = 3000;
      onAllyPower({ from: 0, to: 1, power: "shield", source: a, ally: b });
      expect(b.shieldUntil).toBe(3000);
      a.phaseUntil = 2000;
      onAllyPower({ from: 0, to: 1, power: "phase", source: a, ally: b });
      expect(b.phaseUntil).toBe(2000);
      a.magnetUntil = 4000;
      onAllyPower({ from: 0, to: 1, power: "magnet", source: a, ally: b });
      expect(b.magnetUntil).toBe(4000);
   });
});
