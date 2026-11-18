// The models (assets.ts against the real GLBs), the runner's motion (Hero.tsx), the camera
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
import { alienLaneEscapeMeta } from "./meta";
import definition from "./index";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { ALIEN_ORBIT, introKeyframes, orbitScale, playCamera } from "./camera";
import { levelEnvironment, skyColors } from "./look";
import { createFlick, mapInput } from "./RunnerJuice";
import { createBot, botInput } from "./bot";
import { START_GAP, createMultiRun, leaderIndex, onAllyPower, placings, runnerTimeMs, stepMulti, team } from "./multiplayer";
import { courseFor, createRun, createStepInput, runTimeMs, visualS, type StepInput } from "./rules";
import type { HeroId } from "./heroes";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));

describe("alien-lane-escape models", () => {
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
   it("the definition: five levels, Menu 2 meta, swipes for the lanes, order 85", () => {
      expect(definitionLevelProblems(alienLaneEscapeMeta, definition)).toEqual([]);
      expect(definition.touchControls).toEqual(["joystick", "jump", "action", "swipe"]);
      expect(definition.intro).toBe(true);
      expect(alienLaneEscapeMeta.order).toBe(85);
      expect(alienLaneEscapeMeta.status).toBe("live");
   });
});

describe("the runner", () => {
   it("runs at the track's speed; the slide is the ball; held by the beam it hangs; each event fires once; the cheer waits for the win", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.vz).toBeCloseTo(-run.course.config.speed, 6);
      run.runner.sliding = true;
      writeHeroMotion(m, memo, run, anim, 0.1);
      expect(m.rolling).toBe(true);
      run.runner.sliding = false;
      run.runner.heldUntil = run.ms + 1000;
      writeHeroMotion(m, memo, run, anim, 0.15);
      expect(m.grounded).toBe(false);
      expect(Math.abs(m.vz)).toBe(0);
      run.runner.heldUntil = -1;
      anim.hopAt = 0.2;
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 0.2);
      expect(m.events.jumped).toBe(true);
      expect(m.celebrating).toBe(false);
      anim.winAt = 0.3;
      writeHeroMotion(m, memo, run, anim, 0.4);
      expect(m.celebrating).toBe(true);
   });

   it("level 5's launch-road laps move the drawn track on (no jump back)", () => {
      const run = createRun(1, 5);
      run.runner.s = 10;
      expect(visualS(run)).toBe(10);
      run.lap = 2;
      const l = run.course.loop!;
      expect(visualS(run)).toBe(10 + 2 * (l.s1 - l.s0));
   });
});

describe("the camera and the look", () => {
   it("starts behind the runner looking down the track; portrait stands farther back; a sky per level", () => {
      const pc = playCamera(courseFor(1), 1.6);
      expect(pc.position[2]).toBeGreaterThan(0);
      expect(ALIEN_ORBIT.distance).toBeGreaterThan(5);
      expect(orbitScale(390 / 844)).toBeGreaterThan(1.2);
      for (const id of LEVEL_IDS) expect(introKeyframes(courseFor(id))).toHaveLength(3);
      expect(levelEnvironment(5).lighting).toBe("night");
      expect(new Set(LEVEL_IDS.map((id) => skyColors(id)[1])).size).toBe(5);
      expect(skyColors(3)[0]).not.toBe(skyColors(1)[0]);
   });

   it("input: a ←/→ press (or a swipe) changes lane once; a held key does not repeat; a touch flick changes lane once; down slides; up / a swipe up jumps; a swipe down slides a moment", () => {
      const f = createFlick();
      const out = createStepInput();
      const i = { moveX: -1, moveY: 0, jumpPressed: false, actionPressed: false, pressed: { left: true, right: false, up: false, down: false } };
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
      expect(out.slide).toBe(true);
      i.moveY = 0;
      i.pressed.up = true;
      mapInput(i, f, out);
      expect(out.jumpPressed).toBe(true);
      i.pressed.up = false;
      i.pressed.down = true;
      mapInput(i, f, out);
      i.pressed.down = false;
      mapInput(i, f, out);
      expect(out.slide).toBe(true);
      for (let k = 0; k < 40; k++) mapInput(i, f, out);
      expect(out.slide).toBe(false);
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
      const m = createMultiRun(1, 1, ["vexa", "riko", "nami"], "versus");
      expect(m.runs.map((r) => r.runner.s)).toEqual([2 * START_GAP, START_GAP, 0]);
      m.runs[0].ended = "win";
      m.runs[0].finishMs = 50_000;
      expect(runnerTimeMs(m, 0)).toBe(runTimeMs(50_000, 0, 0) + m.startMs[0]);
      expect(leaderIndex(m)).toBe(1);
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
