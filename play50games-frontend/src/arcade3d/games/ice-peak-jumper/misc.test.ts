// The hero's animation motion (Hero.tsx writeHeroMotion), the camera's pure parts (camera.ts), the
// look (look.ts) and local multiplayer (multiplayer.ts).
import { describe, expect, it } from "vitest";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { LEVEL_IDS } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { createHeroAnim, createMotionMemo, onIce, writeHeroMotion } from "./Hero";
import { FOV, FOV_PORTRAIT, FOV_SPEED, PEAK_ORBIT, fovFor, introKeyframes, orbitPivot, orbitScale, playCamera } from "./camera";
import { levelEnvironment, peakLight } from "./look";
import { START_SPACING, createMultiRun, leaderIndex, onAllyPower, placings, stepMulti, team } from "./multiplayer";
import { courseFor, createRun, createStepInput, type StepInput } from "./rules";
import type { HeroId } from "./heroes";

describe("the hero's motion", () => {
   it("snow walks at the hero's speed; ice glides (barely a stride); each event fires once; the cheer waits for the win", () => {
      const run = createRun(1, 1, "zuno");
      const m = createHeroMotion();
      const memo = createMotionMemo();
      const anim = createHeroAnim();
      run.hero.vx = 4;
      writeHeroMotion(m, memo, run, anim, 0);
      expect(onIce(run)).toBe(false);
      expect(m.vx).toBeCloseTo(4, 6);
      const sheet = run.course.plats[run.course.route[1]];
      run.hero.ground = sheet.id;
      writeHeroMotion(m, memo, run, anim, 0.1);
      expect(onIce(run)).toBe(true);
      expect(m.vx).toBeLessThan(1);
      anim.jumpAt = 0.2;
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 0.2);
      expect(m.events.jumped).toBe(true);
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 0.25);
      expect(m.events.jumped).toBe(false);
      expect(m.celebrating).toBe(false);
      anim.winAt = 0.5;
      writeHeroMotion(m, memo, run, anim, 0.6);
      expect(m.celebrating).toBe(true);
   });
});

describe("the camera", () => {
   it("starts behind the hero looking up the first run (north) and above; a portrait screen stands farther back", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const pc = playCamera(c, 16 / 10);
         const s = c.plats[c.start];
         expect(pc.position[2]).toBeGreaterThan(s.z + 4);
         expect(pc.position[1]).toBeGreaterThan(s.y + 2);
         expect(introKeyframes(c)).toHaveLength(3);
      }
      expect(orbitScale(390 / 844)).toBeGreaterThan(1.2);
      expect(orbitScale(1280 / 800)).toBe(1);
      const p = orbitPivot(0, 0, 0, 20, 0, { x: 0, y: 0, z: 0 });
      expect(p.x).toBeCloseTo(2, 6);
      const cam = orbitPosition(0, 1, 0, PEAK_ORBIT.yaw ?? 0, PEAK_ORBIT.pitch ?? 0, 8, { x: 0, y: 0, z: 0 });
      expect(cam.z).toBeGreaterThan(0);
   });

   it("the view widens +6 degrees from 7 to 9 m/s (the card's speed juice)", () => {
      expect(fovFor(1.6, 0)).toBe(FOV);
      expect(fovFor(1.6, 7)).toBe(FOV);
      expect(fovFor(1.6, 9)).toBeCloseTo(FOV + FOV_SPEED, 6);
      expect(fovFor(0.5, 0)).toBe(FOV_PORTRAIT);
   });
});

describe("the look", () => {
   it("level 4 is night, the rest a snowy day; the summit is greyer", () => {
      expect(levelEnvironment(4, true).lighting).toBe("night");
      expect(levelEnvironment(1, false).lighting).toBe("snow");
      expect(peakLight(4, true).ambient).toBeLessThan(peakLight(1, false).ambient);
      expect(peakLight(5, false).fog.far).toBeLessThan(peakLight(1, false).fog.far);
   });
});

function botMulti(mode: "coop" | "versus", heroes: HeroId[]) {
   const m = createMultiRun(7, 1, heroes, mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 60 * 240 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("local multiplayer", () => {
   it("the heroes start side by side on the start patch", () => {
      const m = createMultiRun(1, 1, ["zuno", "riko", "nami"], "versus");
      expect(m.runs[1].hero.x - m.runs[0].hero.x).toBeCloseTo(START_SPACING, 6);
      expect(leaderIndex(m)).toBe(0);
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

   it("co-op ally powers: Kiro's shield, Zuno's magnet and Vexa's phase reach the ally", () => {
      const m = createMultiRun(1, 1, ["kiro", "riko"], "coop");
      const [a, b] = m.runs;
      a.shieldUntil = 3000;
      onAllyPower({ from: 0, to: 1, power: "shield", source: a, ally: b });
      expect(b.shieldUntil).toBe(3000);
      a.phaseUntil = 2000;
      onAllyPower({ from: 0, to: 1, power: "phase", source: a, ally: b });
      expect(b.phaseUntil).toBe(2000);
      a.magnetUntil = 1000;
      onAllyPower({ from: 0, to: 1, power: "magnet", source: a, ally: b });
      expect(b.magnetUntil).toBe(1000);
   });
});
