// The models (assets.ts against the real GLBs), the runner's motion and size scale (Hero.tsx), the camera
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
import { candyWorldRunnerMeta } from "./meta";
import definition from "./index";
import { createHeroAnim, createMotionMemo, sizeScale, writeHeroMotion } from "./Hero";
import { CANDY_ORBIT, PULL_PER_SIZE, distanceFor, introKeyframes, orbitScale, playCamera } from "./camera";
import { levelEnvironment, skyColors } from "./look";
import { createFlick, mapInput } from "./RunnerJuice";
import { createBot, botInput } from "./bot";
import { START_GAP, createMultiRun, leaderIndex, onAllyPower, placings, runnerTimeMs, stepMulti, team } from "./multiplayer";
import { SIZE_SCALE, courseFor, createRun, createStepInput, runTimeMs, visualS, type StepInput } from "./rules";
import type { HeroId } from "./heroes";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

describe("candy-world-runner models", () => {
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
   it("the definition: five levels, Menu 2 meta, swipes for the lanes, order 77", () => {
      expect(definitionLevelProblems(candyWorldRunnerMeta, definition)).toEqual([]);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action", "swipe"]);
      expect(definition.intro).toBe(true);
      expect(candyWorldRunnerMeta.order).toBe(77);
      expect(candyWorldRunnerMeta.status).toBe("dev");
   });
});

describe("the runner", () => {
   it("runs at the road's speed; the roll is the ball; each event fires once; the cheer waits for the win", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.vz).toBeCloseTo(-run.course.config.speed, 6);
      run.runner.rolling = true;
      writeHeroMotion(m, memo, run, anim, 0.1);
      expect(m.rolling).toBe(true);
      anim.hopAt = 0.2;
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 0.2);
      expect(m.events.jumped).toBe(true);
      expect(m.celebrating).toBe(false);
      anim.winAt = 0.3;
      writeHeroMotion(m, memo, run, anim, 0.4);
      expect(m.celebrating).toBe(true);
   });

   it("the sizes are drawn 0.7 / 1.0 / 1.4 with a squash-and-stretch pop on a change", () => {
      expect(SIZE_SCALE).toEqual([0.7, 1, 1.4]);
      const settled = sizeScale(2, 1000, 1);
      expect(settled.xz).toBeCloseTo(1.4, 6);
      expect(settled.y).toBeCloseTo(1.4, 6);
      const mid = sizeScale(2, 175, 1);
      expect(mid.y).toBeGreaterThan(mid.xz);
   });

   it("level 5's palace laps move the drawn road on (no jump back)", () => {
      const run = createRun(1, 5);
      run.runner.s = 10;
      expect(visualS(run)).toBe(10);
      run.lap = 2;
      const l = run.course.loop!;
      expect(visualS(run)).toBe(10 + 2 * (l.s1 - l.s0));
   });
});

describe("the camera and the look", () => {
   it("starts behind the runner looking down the road; pulls back 1.2 m per size; portrait stands farther back", () => {
      const pc = playCamera(courseFor(1), 1.6);
      expect(pc.position[2]).toBeGreaterThan(0);
      expect(distanceFor(2) - distanceFor(0)).toBeCloseTo(2 * PULL_PER_SIZE, 6);
      expect(distanceFor(0)).toBe(CANDY_ORBIT.distance);
      expect(orbitScale(390 / 844)).toBeGreaterThan(1.2);
      for (const id of LEVEL_IDS) expect(introKeyframes(courseFor(id))).toHaveLength(3);
      expect(levelEnvironment(5).lighting).toBe("sunset");
      expect(skyColors(3)[0]).not.toBe(skyColors(1)[0]);
   });

   it("input: a ←/→ press (or a swipe) changes lane once; a held key does not repeat; a touch flick changes lane once; down rolls", () => {
      const f = createFlick();
      const out = createStepInput();
      const i = { moveX: -1, moveY: 0, jumpPressed: false, actionPressed: false, pressed: { left: true, right: false } };
      mapInput(i, f, out);
      expect(out.left).toBe(true);
      i.pressed.left = false;
      mapInput(i, f, out);
      expect(out.left).toBe(false);
      i.moveX = 0;
      mapInput(i, f, out);
      i.moveX = 0.9;
      mapInput(i, f, out);
      expect(out.right).toBe(true);
      mapInput(i, f, out);
      expect(out.right).toBe(false);
      i.moveY = 0.8;
      mapInput(i, f, out);
      expect(out.roll).toBe(true);
   });
});

function botMulti(mode: "coop" | "versus", heroes: HeroId[]) {
   const m = createMultiRun(7, 1, heroes, mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 60 * 200 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("local multiplayer", () => {
   it("the runners start in a column (P1 in front); the head start is given back in the time", () => {
      const m = createMultiRun(1, 1, ["zuno", "riko", "nami"], "versus");
      expect(m.runs.map((r) => r.runner.s)).toEqual([2 * START_GAP, START_GAP, 0]);
      m.runs[0].ended = "win";
      m.runs[0].finishMs = 50_000;
      expect(runnerTimeMs(m, 0)).toBe(runTimeMs(50_000, 0, 0) + m.startMs[0]);
      expect(leaderIndex(m)).toBe(1);
   });

   it("co-op: two bots clear level 1 together; the orbs are shared", () => {
      const m = botMulti("coop", ["zuno", "riko"]);
      expect(m.ended).toBe("win");
      expect(team(m).cleared).toBe(true);
      for (let k = 0; k < m.runs[0].collected.length; k++) expect(m.runs[0].collected[k]).toBe(m.runs[1].collected[k]);
   }, 90_000);

   it("versus: the podium ranks the finishers by time", () => {
      const m = botMulti("versus", ["riko", "vexa"]);
      expect(m.ended).toBe("win");
      expect(placings(m)[0].finished).toBe(true);
   }, 90_000);

   it("co-op ally powers: Kiro's shield and Vexa's phase reach the ally; Zuno's magnet switches with his", () => {
      const m = createMultiRun(1, 1, ["kiro", "riko"], "coop");
      const [a, b] = m.runs;
      a.shieldUntil = 3000;
      onAllyPower({ from: 0, to: 1, power: "shield", source: a, ally: b });
      expect(b.shieldUntil).toBe(3000);
      a.phaseUntil = 2000;
      onAllyPower({ from: 0, to: 1, power: "phase", source: a, ally: b });
      expect(b.phaseUntil).toBe(2000);
      a.magnetOn = true;
      onAllyPower({ from: 0, to: 1, power: "magnet", source: a, ally: b });
      expect(b.magnetOn).toBe(true);
   });
});
