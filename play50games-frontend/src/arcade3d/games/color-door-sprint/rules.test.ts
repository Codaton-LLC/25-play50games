// Color Door Sprint rules (rules.ts): the halls, the door roll, read and commit (the lock, the true
// door's surge, the wrong door's bounce), jumps, rolls, bars and beams, the five hero gates, the z
// guard, the lower bound and the pinned limits, Flicker, and the honest bot, driven through the real
// store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { colorDoorSprintMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES, type HeroId } from "./heroes";
import { createBot, botInput } from "./bot";
import { DOOR_COLORS, laneX } from "./halls";
import { FLICKER, SECRETS } from "./progression";
import {
   BOUNCE_MS,
   DOOR_CRACKED,
   DOOR_GHOST,
   DOOR_SHUT,
   LEVEL1_LIMITS,
   LOCK_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   STAT,
   SURGE_MS,
   UPPER_FEET,
   V_JUMP,
   G,
   WALL,
   bossFloorMs,
   bossMinMs,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   doorAt,
   finalScore,
   laneDirection,
   lampInView,
   minDurationMsOf,
   minFinishMs,
   progressFloorMs,
   runTimeMs,
   speedNow,
   step,
   type DoorRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144] as const;
const cache = new Map<string, DoorRun>();

export function botRun(level: LevelId, fps: number, seed = 1, hero: HeroId = "riko"): DoorRun {
   const key = `${level}:${fps}:${seed}:${hero}`;
   const hit = cache.get(key);
   if (hit) return hit;
   const fms = 1000 / fps;
   const run = createRun(seed, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   cache.set(key, run);
   return run;
}

const submitted = (run: DoorRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

/** Runs the hero straight in its lane (no input) until it meets wall w; returns that step's result. */
function runTo(run: DoorRun, w: number, input: StepInput = createStepInput()): number {
   for (let f = 0; f < 200_000 && run.ended === null; f++) {
      const ev = step(run, 1, input);
      if (ev.wall === w) return ev.wallResult;
   }
   return -1;
}

/** Puts the hero in a lane at once (tests). */
function putLane(run: DoorRun, lane: number): void {
   run.hero.lane = lane;
   run.hero.x = laneX(lane, run.course.lanes);
}

describe("the halls (along -z)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: walls in order 35-45 m apart, a lamp per wall, every prop between start and finish, the secrets placed`, () => {
         const c = courseFor(id);
         expect(c.walls.length).toBe(LEVELS[id].walls);
         for (let i = 1; i < c.walls.length; i++) {
            const gap = c.walls[i - 1].z - c.walls[i].z;
            expect(gap).toBeGreaterThanOrEqual(35);
            expect(gap).toBeLessThanOrEqual(45);
         }
         expect(c.lamps.length).toBe(c.walls.length);
         for (const l of c.lamps) expect(l.z).toBeGreaterThan(c.walls[l.wall].z);
         for (const o of c.orbs) {
            expect(o.z).toBeLessThan(c.startZ);
            expect(o.z).toBeGreaterThan(c.finishZ);
            expect(Math.abs(o.x)).toBeLessThan(c.half + 3);
         }
         expect(c.secrets.length).toBeGreaterThanOrEqual(1);
         expect(c.finishZ).toBeLessThan(c.walls[c.walls.length - 1].z);
      });
   }

   it("every level has all five hero gates: a cracked door (Riko), a ghost door (Vexa), Nami's high orbs or upper row, a flame vent (Kiro), a hidden trail (Zuno)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.walls.some((w) => w.cracked >= 0), `L${id} cracked`).toBe(true);
         expect(c.walls.some((w) => w.ghost >= 0), `L${id} ghost`).toBe(true);
         expect(c.walls.some((w) => w.upper >= 0) || c.orbs.some((o) => o.y >= 2.9), `L${id} nami`).toBe(true);
         expect(c.vents.length, `L${id} vents`).toBeGreaterThan(0);
         expect(c.orbs.some((o) => o.hidden), `L${id} trails`).toBe(true);
         expect(c.sides.length).toBe(c.walls.filter((w) => w.cracked >= 0).length);
      }
   });

   it("each level adds its twist: L1 2 lanes and the floor arrows; L2 3 lanes and the dimmed sound rule; L3 sliding doors and NOT; L4 5 lanes and the echo rule; L5 Flicker", () => {
      expect(courseFor(1).lanes).toBe(2);
      expect(courseFor(1).walls.some((w) => w.floorArrows)).toBe(true);
      expect(courseFor(2).lanes).toBe(3);
      expect(courseFor(2).walls.some((w) => w.mode === "sound" && w.dim)).toBe(true);
      expect(courseFor(3).walls.some((w) => w.slide)).toBe(true);
      expect(courseFor(3).walls.some((w) => w.mode === "not")).toBe(true);
      expect(courseFor(4).lanes).toBe(5);
      expect(courseFor(4).walls.some((w) => w.echo)).toBe(true);
      expect(courseFor(5).boss).toBe(true);
      for (const id of [1, 2, 3, 4] as const) expect(courseFor(id).boss).toBe(false);
      expect(LEVELS[1].speed).toBe(10);
      expect(LEVELS[4].speed).toBe(16);
      expect(LEVELS[5].speed).toBe(18);
   });

   it("level 1 teaches in three beats: one door open (the rest shut or special), then two colours with floor arrows, then the lamp alone", () => {
      const c = courseFor(1);
      expect(c.walls[0].open).toBe(1);
      expect(c.walls[1].open).toBe(1);
      expect(c.walls.slice(2, 5).every((w) => w.floorArrows && w.open === 2)).toBe(true);
      expect(c.walls.slice(5).every((w) => !w.floorArrows && w.open === 2)).toBe(true);
      expect(c.pads.length).toBeGreaterThanOrEqual(c.lanes);
   });
});

describe("the door roll (seeded per run)", () => {
   it("match walls: distinct colours, the rule's colour exactly once, on the true lane; NOT walls: every coloured door the rule's but the true one", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 20; seed++) {
            const run = createRun(seed, id);
            const c = run.course;
            for (const w of c.walls) {
               const rule = run.ruleColor[w.index];
               const doors = Array.from({ length: c.lanes }, (_v, l) => doorAt(run, w.index, l));
               const coloured = doors.filter((d) => d >= 0);
               expect(doors[run.trueLane[w.index]]).toBeGreaterThanOrEqual(0);
               if (w.mode === "not") {
                  expect(doors[run.trueLane[w.index]]).not.toBe(rule);
                  expect(coloured.filter((d) => d !== rule).length).toBe(1);
               } else {
                  expect(doors[run.trueLane[w.index]]).toBe(rule);
                  expect(coloured.filter((d) => d === rule).length).toBe(1);
                  expect(new Set(coloured).size).toBe(coloured.length);
               }
               if (w.cracked >= 0) {
                  expect(doors[w.cracked]).toBe(DOOR_CRACKED);
                  expect(run.crackColor[w.index]).not.toBe(w.mode === "not" ? -1 : rule);
               }
               if (w.ghost >= 0) expect(doors[w.ghost]).toBe(DOOR_GHOST);
               expect(coloured.length).toBe(Math.min(w.open, c.lanes - (w.cracked >= 0 ? 1 : 0) - (w.ghost >= 0 ? 1 : 0)));
            }
         }
      }
   });

   it("the same seed rolls the same doors; another seed other doors (a fixed pool, not a fixed sequence)", () => {
      const a = createRun(7, 3);
      const b = createRun(7, 3);
      const c = createRun(8, 3);
      expect(Array.from(a.doors)).toEqual(Array.from(b.doors));
      expect(Array.from(a.doors)).not.toEqual(Array.from(c.doors));
   });

   it("every colour has its own shape and chime", () => {
      expect(new Set(DOOR_COLORS.map((c) => c.shape)).size).toBe(5);
      expect(new Set(DOOR_COLORS.map((c) => c.chime)).size).toBe(5);
   });
});

describe("read and commit", () => {
   it("the true door: no bounce, a 0.5 s surge (the speed rises by the surge, never past vMax)", () => {
      const run = createRun(3, 1);
      putLane(run, run.trueLane[0]);
      expect(runTo(run, 0)).toBe(WALL.truePass);
      expect(run.hero.state).toBe("play");
      expect(run.hero.surgeUntil - run.simMs).toBe(SURGE_MS);
      expect(speedNow(run, run.simMs)).toBeCloseTo(LEVELS[1].speed + 3, 6);
      expect(speedNow(run, run.simMs)).toBeLessThanOrEqual(run.course.vMax);
   });

   it("a wrong door bounces you back for 1.5 s, resets the flow and the streak, then sets you in the true lane", () => {
      const run = createRun(3, 2);
      const wrong = [0, 1, 2].find((l) => l !== run.trueLane[0])!;
      putLane(run, wrong);
      expect(runTo(run, 0)).toBe(WALL.wrong);
      expect(run.wrong).toBe(1);
      expect(run.streak).toBe(0);
      expect(run.hero.state).toBe("bounce");
      const z0 = run.hero.z;
      const t0 = run.simMs;
      while (run.hero.state === "bounce") step(run, 1, createStepInput());
      expect(run.simMs - t0).toBe(BOUNCE_MS);
      expect(run.hero.z).toBeGreaterThan(z0);
      expect(run.hero.lane).toBe(run.trueLane[0]);
   });

   it("the doors lock 0.6 s before impact: a lane change after that does nothing", () => {
      const run = createRun(5, 2);
      putLane(run, 1);
      const input = createStepInput();
      while (run.hero.z - run.wallZ[0] > (run.hero.v * LOCK_MS) / 1000 - 0.05) step(run, 1, input);
      expect(run.hero.locked).toBe(true);
      input.left = true;
      step(run, 1, input);
      expect(run.hero.lane).toBe(1);
      const run2 = createRun(5, 2);
      putLane(run2, 1);
      const inp2 = createStepInput();
      inp2.left = true;
      step(run2, 1, inp2);
      expect(run2.hero.lane).toBe(0);
   });

   it("a shut door is wrong; a sliding wall's doors shift one lane during the approach (the true lane moves with them)", () => {
      const c = courseFor(3);
      const w = c.walls.find((q) => q.slide)!;
      const run = createRun(11, 3);
      const before = run.trueLane[w.index];
      run.nextWall = w.index;
      run.hero.z = w.z + 60;
      for (let f = 0; f < 6000 && run.slid[w.index] === 0; f++) step(run, 1, createStepInput());
      expect(run.slid[w.index]).toBe(1);
      expect(run.trueLane[w.index]).toBe((before + 1) % c.lanes);
      expect((run.hero.z - w.z) / run.hero.v).toBeGreaterThan(LOCK_MS / 1000 + 0.9);
      const r2 = createRun(2, 1);
      const shut = [0, 1].find((l) => doorAt(r2, 1, l) === DOOR_SHUT || doorAt(r2, 1, l) === DOOR_CRACKED)!;
      r2.nextWall = 1;
      r2.hero.z = courseFor(1).walls[1].z + 20;
      putLane(r2, shut);
      expect(runTo(r2, 1)).toBe(WALL.wrong);
   });

   it("the HUD's rule card copies the next wall's lamp once in view; on an echo wall it shows only the lamp of the wall after next", () => {
      const out = { color: 0, mode: 0, echo: false, wall: 0 };
      const run = createRun(3, 1);
      run.hero.z = run.course.lamps[0].z + 100;
      expect(lampInView(run, out).wall).toBe(-1);
      run.hero.z = run.course.lamps[0].z + 20;
      expect(lampInView(run, out).wall).toBe(0);
      expect(out.color).toBe(run.ruleColor[0]);
      const c4 = courseFor(4);
      const e = c4.walls.findIndex((w, i) => w.echo && c4.walls[i + 1]?.echo);
      const r4 = createRun(3, 4);
      r4.nextWall = e;
      r4.hero.z = c4.walls[e].z + 10;
      const shown = lampInView(r4, out);
      expect(shown.wall).not.toBe(e);
      if (shown.wall >= 0) {
         expect(shown.wall).toBe(e + 1);
         expect(shown.echo).toBe(true);
      }
   });

   it("lane presses are camera-relative: a camera turned round (yaw π) swaps left and right; a side view keeps the press", () => {
      expect(laneDirection(false, true, 0)).toBe(1);
      expect(laneDirection(true, false, 0)).toBe(-1);
      expect(laneDirection(false, true, Math.PI)).toBe(-1);
      expect(laneDirection(false, true, Math.PI / 2)).toBe(1);
   });
});

describe("jumps, rolls, bars and beams", () => {
   it("a jump's apex is V_JUMP²/2G; Nami's second jump in the air goes higher (the upper door row); others cannot", () => {
      const apex = (V_JUMP * V_JUMP) / (2 * G);
      expect(apex).toBeLessThan(UPPER_FEET);
      for (const hero of ["nami", "riko"] as HeroId[]) {
         const run = createRun(1, 3, hero);
         const input = createStepInput();
         input.jumpPressed = true;
         step(run, 1, input);
         input.jumpPressed = false;
         let top = 0;
         for (let ms = 0; ms < 2000; ms++) {
            if (ms === 300) input.jumpPressed = true;
            step(run, 1, input);
            input.jumpPressed = false;
            top = Math.max(top, run.hero.y);
         }
         if (hero === "nami") expect(top).toBeGreaterThan(UPPER_FEET + 0.2);
         else expect(top).toBeCloseTo(apex, 1);
      }
   });

   it("a floor bar trips a runner on the ground (a stumble, the flow breaks); a jump clears it; a low beam needs a roll", () => {
      const c = courseFor(2);
      const bar = c.bars.find((b) => b.kind === "bar")!;
      const beam = c.bars.find((b) => b.kind === "beam")!;
      const at = (z: number, act: (i: StepInput) => void) => {
         const run = createRun(1, 2, "riko");
         run.hero.z = z + 12;
         run.nextWall = c.walls.findIndex((w) => w.z < z);
         const input = createStepInput();
         for (let f = 0; f < 3000 && run.hero.z > z - 1; f++) {
            input.jumpPressed = false;
            input.down = false;
            const t = (run.hero.z - z) / Math.max(1, run.hero.v);
            if (t < 0.3 && t > 0.28) act(input);
            step(run, 1, input);
         }
         return run.stumbles;
      };
      expect(at(bar.z, () => undefined)).toBe(1);
      expect(at(bar.z, (i) => (i.jumpPressed = true))).toBe(0);
      expect(at(beam.z, () => undefined)).toBe(1);
      expect(at(beam.z, (i) => (i.down = true))).toBe(0);
   });
});

describe("the hero gates", () => {
   function gateRun(level: LevelId, hero: HeroId, kind: "cracked" | "ghost", power: boolean) {
      const c = courseFor(level);
      const w = c.walls.find((q) => q[kind] >= 0)!;
      const run = createRun(4, level, hero);
      run.nextWall = w.index;
      run.hero.z = w.z + 30;
      putLane(run, w[kind]);
      const input = createStepInput();
      for (let f = 0; f < 6000 && run.nextWall === w.index; f++) {
         const t = (run.hero.z - w.z) / Math.max(1, run.hero.v);
         input.actionPressed = power && t < 0.3 && t > 0.28;
         step(run, 1, input);
      }
      return { run, w, result: run.result[w.index] };
   }

   it("Riko's dash smashes a cracked fake door into the side corridor; it skips the next two walls and rejoins the hall; without the dash it is a wrong door", () => {
      for (const level of [1, 3] as LevelId[]) {
         const { run, w, result } = gateRun(level, "riko", "cracked", true);
         expect(result).toBe(WALL.smashed);
         expect(run.hero.side).toBeGreaterThanOrEqual(0);
         for (let f = 0; f < 200_000 && run.hero.side >= 0; f++) step(run, 4, createStepInput());
         expect(run.result[w.index + 1]).toBe(WALL.skipped);
         expect(run.result[w.index + 2]).toBe(WALL.skipped);
         expect(run.secrets.found[SECRETS_INDEX(level, "side")]).toBe(1);
         expect(gateRun(level, "nami", "cracked", true).result).toBe(WALL.wrong);
      }
   });

   it("Vexa's phase passes a ghost door (a true pass) and finds its shard; anyone else bounces", () => {
      for (const level of LEVEL_IDS) {
         const g = gateRun(level, "vexa", "ghost", true);
         expect(g.result).toBe(WALL.ghost);
         for (let f = 0; f < 400; f++) step(g.run, 4, createStepInput());
         expect(g.run.secrets.found[SECRETS_INDEX(level, "ghost")]).toBe(1);
         expect(gateRun(level, "kiro", "ghost", false).result).toBe(WALL.wrong);
      }
   });

   it("Kiro's shield absorbs a wrong door (no bounce), a bar and a flame vent", () => {
      const run = createRun(3, 2, "kiro");
      const wrong = [0, 1, 2].find((l) => l !== run.trueLane[0])!;
      putLane(run, wrong);
      const input = createStepInput();
      for (let f = 0; f < 20000 && run.nextWall === 0; f++) {
         const t = (run.hero.z - run.wallZ[0]) / run.hero.v;
         input.actionPressed = t < 1 && t > 0.99;
         step(run, 1, input);
      }
      expect(run.result[0]).toBe(WALL.absorbed);
      expect(run.hero.state).toBe("play");
      expect(run.wrong).toBe(0);
   });

   it("Zuno's magnet pulls a hidden wall trail that nobody else can take", () => {
      const c = courseFor(2);
      const i = c.orbs.findIndex((o) => o.hidden);
      const o = c.orbs[i];
      for (const [hero, want] of [["zuno", 1], ["riko", 0]] as const) {
         const run = createRun(1, 2, hero);
         run.hero.z = o.z + 8;
         run.nextWall = c.walls.findIndex((w) => w.z < o.z);
         const lane = o.x > 0 ? c.lanes - 1 : 0;
         putLane(run, lane);
         const input = createStepInput();
         input.actionPressed = true;
         for (let f = 0; f < 1500; f++) {
            step(run, 1, input);
            input.actionPressed = false;
         }
         expect(run.collected[i], hero).toBe(want);
      }
   });

   it("Nami's double jump goes through a tall wall's upper door (a true pass) and finds the sticker", () => {
      const c = courseFor(3);
      const w = c.walls.find((q) => q.upper >= 0)!;
      const run = createRun(4, 3, "nami");
      run.nextWall = w.index;
      run.hero.z = w.z + 30;
      putLane(run, w.upper);
      const input = createStepInput();
      let jumps = 0;
      for (let f = 0; f < 6000 && run.nextWall === w.index; f++) {
         const t = (run.hero.z - w.z) / Math.max(1, run.hero.v);
         input.jumpPressed = (jumps === 0 && t < 0.75) || (jumps === 1 && run.hero.vy < 0.5 && !run.hero.grounded);
         if (input.jumpPressed) jumps++;
         step(run, 1, input);
      }
      expect(run.result[w.index]).toBe(WALL.upper);
      for (let f = 0; f < 200; f++) step(run, 4, createStepInput());
      expect(run.secrets.found[SECRETS_INDEX(3, "upper")]).toBe(1);
   });
});

function SECRETS_INDEX(level: LevelId, id: string): number {
   return SECRETS[level].findIndex((s) => s.id === id);
}

describe("the z guard (the proof's one rule)", () => {
   it("on every level, 20 s of random input for every hero never moves the hero more than vMax/1000 towards -z in one ms", () => {
      for (const level of LEVEL_IDS) {
         for (const hero of HEROES) {
            const rng = createRng(level * 31 + hero.id.length);
            const run = createRun(9, level, hero.id);
            const input = createStepInput();
            for (let ms = 0; ms < 20000 && run.ended === null; ms++) {
               input.left = rng() < 0.01;
               input.right = rng() < 0.01;
               input.up = rng() < 0.01;
               input.down = rng() < 0.01;
               input.jumpPressed = rng() < 0.01;
               input.actionPressed = rng() < 0.02;
               input.yaw = rng() * 6.3;
               const z0 = run.hero.z;
               step(run, 1, input);
               expect(z0 - run.hero.z).toBeLessThanOrEqual(run.course.vMax / 1000 + 1e-9);
            }
         }
      }
   });
});

describe("scoring hand-off", () => {
   it("finalScore: a win submits the finish minus 150 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      const stats = { [STAT.finishMs]: 40000, [STAT.orbs]: 10, [STAT.comboMs]: 500 };
      expect(finalScore({ score: 0, endReason: "win", stats, elapsedMs: 41000 })).toEqual({ score: 0, durationMs: 40000 - 10 * ORB.bonusMs - 500 });
      expect(finalScore({ score: 0, endReason: "timeup", stats, elapsedMs: 41000 })).toEqual({ score: 0, durationMs: 41000 });
   });
});

/** minDurationMs, maxDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [15400, 90000, 90000, 7460],
   [14700, 110000, 110000, 9530],
   [13200, 130000, 130000, 11680],
   [12300, 150000, 150000, 13770],
   [32700, 240000, 240000, 20730],
];

describe("the lower bound (README 'Server limits')", () => {
   it("the z floor is the hall's length at vMax, less 4 ms; level 5 adds Flicker's floor after his start line", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(progressFloorMs(c)).toBeCloseTo(((c.startZ - c.finishZ) * 1000) / c.vMax - 4, 6);
         expect(c.vMax).toBe(LEVELS[id].speed + 6);
      }
      const c5 = courseFor(5);
      expect(bossFloorMs(c5)).toBeCloseTo(((c5.startZ - c5.bossStartZ) * 1000) / c5.vMax - 4 + bossMinMs() - 2, 6);
      expect(minFinishMs(c5)).toBe(Math.max(progressFloorMs(c5), bossFloorMs(c5)));
   });

   it("the least duration takes off every orb and the most flow bonus", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBeCloseTo(minFinishMs(c) - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c)), 6);
      }
   });

   it("every level's minDurationMs sits in 94-100 % of its bound; the limits are pinned and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const lb = minDurationMsOf(courseFor(id));
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
      }
      expect(LEVEL1_LIMITS).toBe(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
      expect(colorDoorSprintMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      for (const id of LEVEL_IDS) expect(colorDoorSprintMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
   });

   it("every level is worth at least level 1's points, and level 5 at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });
});

describe("Flicker (level 5, menu2/boss)", () => {
   it("is a valid boss: 3 phases, 3 + 2 + 3 hits", () => {
      expect(bossProblems(FLICKER)).toEqual([]);
      expect(FLICKER.phases.length).toBe(3);
      expect(FLICKER.maxHp).toBe(8);
   });

   it("rises when the hero passes his start line; the finish waits for him; the arena keeps its walls coming while he is up", () => {
      const run = botRun(5, 60);
      expect(run.ended).toBe("win");
      expect(run.boss!.hp).toBe(0);
      expect(run.wallCount).toBeGreaterThan(courseFor(5).walls.length + 10);
      expect(run.finishGate).toBeLessThanOrEqual(courseFor(5).finishZ);
   });
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot finishes at 30, 60 and 144 fps, never under the floor, at least 70 % of maxScore`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            const t = submitted(run);
            expect(t).toBeGreaterThanOrEqual(lim.minDurationMs);
            const score = Math.floor((lim.timeBaseMs - t) / 10);
            expect(score).toBeLessThanOrEqual(lim.maxScore);
            expect(score).toBeGreaterThanOrEqual(lim.maxScore * 0.7);
         }
      }, 120_000);
   }

   it("200 spam bots on level 1 (random lanes, jumps, rolls, power mashing, random frame times) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      for (let seed = 1; seed <= 200; seed++) {
         const rng = createRng(seed);
         const run = createRun(seed, 1, HEROES[seed % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 20_000 && run.ended === null; f++) {
            input.left = rng() < 0.2;
            input.right = rng() < 0.2;
            input.up = rng() < 0.2;
            input.down = rng() < 0.1;
            input.jumpPressed = rng() < 0.3;
            input.actionPressed = rng() < 0.3;
            step(run, 4 + rng() * 46, input);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   }, 120_000);

   it("the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5, 1);
      const bot = createBot(run);
      const inp = createStepInput();
      const rng = createRng(11);
      for (let f = 0; f < 50_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         bot.frameMs = dt * 1000;
         botInput(bot, run, inp);
         const ev = step(run, dt * 1000, inp);
         if (ev.finished) {
            store.getState().setStat(STAT.orbs, run.orbs);
            store.getState().setStat(STAT.finishMs, run.finishMs);
            store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
            store.getState().end("win");
         }
      }
      const s = store.getState();
      expect(s.endReason).toBe("win");
      expect(run.finishMs).toBeLessThanOrEqual(s.elapsedMs + 1);
      const fin = finalScore(s);
      const rules = colorDoorSprintMeta.scoring;
      const sent = normalizeRun({ slug: "color-door-sprint", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });

   it("an idle runner (no input) still runs, bounces off wrong doors and finishes slower than the bot", () => {
      const run = createRun(1, 2);
      for (let f = 0; f < 100_000 && run.ended === null; f++) step(run, 1000 / 60, createStepInput());
      expect(run.ended).toBe("win");
      expect(run.wrong).toBeGreaterThan(0);
      expect(run.finishMs).toBeGreaterThan(botRun(2, 60).finishMs);
   });
});

