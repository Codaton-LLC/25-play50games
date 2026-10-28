// Ring Jump Challenge rules: the canyon of each level, the fall (spread, dive, boost, updrafts),
// threading, misses and Nami's rescue, the landings and the splash, the hero powers, the hazards, the
// hand-off to the store, and the server-limit proof (README "Server limits and why they hold"): the
// vy clamp on every ms, the pinned limits, and an honest, an idle and a spam bot, driven through the
// real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { comboConfigProblems } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ringJumpChallengeMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES, POWER_MS, FLIP_RISE, MAGNET_REACH, heroById } from "./heroes";
import { createBot, botInput } from "./bot";
import { COMBO, CYCLONE_RAY, SECRETS, starSpecFor } from "./progression";
import { PAD_TOP, shaftRadius } from "./canyon";
import {
   BOOST_CAP,
   BOOST_RING,
   BOOST_SPEED,
   CENTRE_FRAC,
   HERO_R,
   LEAP,
   MISS_LANE,
   PROPOSED_LEVEL_LIMITS,
   PTS,
   RESPAWN_HEIGHT,
   SPLASH_MS,
   STEER_DIVE,
   STEER_SPREAD,
   TIME_PTS,
   UPDRAFT_FALL,
   V_DIVE,
   V_SPREAD,
   VMAX,
   bossHitsToDefeat,
   bossMinMs,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   finalScore,
   maxScoreOf,
   minFinishMs,
   proposeLimits,
   step,
   timeBonusFor,
   type RingRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144] as const;
const cache = new Map<string, RingRun>();

export function botRun(level: LevelId, fps = 60, seed = 1, hero = HEROES[1].id): RingRun {
   const key = `${level}:${fps}:${seed}:${hero}`;
   const hit = cache.get(key);
   if (hit) return hit;
   const fms = 1000 / fps;
   const run = createRun(seed, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 600_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   cache.set(key, run);
   return run;
}

function hold(run: RingRun, ms: number, input: StepInput): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(16, left);
      step(run, d, input);
      left -= d;
   }
}

/** A run already falling at (x, y, z) at rest on the plane, at the spread speed. */
function falling(level: LevelId, x: number, y: number, z: number, hero = HEROES[1].id): RingRun {
   const run = createRun(1, level, hero);
   const leap = createStepInput();
   leap.jumpPressed = true;
   step(run, 1, leap);
   Object.assign(run.hero, { x, y, z, vx: 0, vz: 0, vy: -V_SPREAD, leapAt: -10_000 });
   return run;
}

describe("the canyon (a drop, not a climb)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: ${LEVELS[id].depth} m from the column to the sea; rings and main orbs inside the shaft; the pad on the floor; secrets as SECRETS says`, () => {
         const c = courseFor(id);
         expect(c.top).toBe(LEVELS[id].depth);
         expect(c.startZ).toBeGreaterThan(c.radius);
         for (const r of c.rings) {
            if (r.kind === "gold" || r.kind === "bonus") continue;
            expect(r.y).toBeGreaterThan(0);
            expect(r.y).toBeLessThan(c.top);
            const amp = r.motion ? r.motion.amp : 0;
            expect(Math.hypot(r.x, r.z) + amp + r.r, `ring at ${r.y}`).toBeLessThanOrEqual(shaftRadius(c, r.y) + 0.01);
         }
         for (const o of c.orbs) if (o.gate === "none") expect(Math.hypot(o.x, o.z)).toBeLessThan(shaftRadius(c, o.y) - HERO_R);
         expect(c.mainOrbs).toBe(c.orbs.filter((o) => o.gate === "none").length);
         expect(c.secrets.length).toBe(SECRETS[id].length);
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, c.mainOrbs))).toEqual([]);
         if (!c.boss) expect(c.pad.y).toBe(PAD_TOP);
         // every hero has a route of its own on every level
         for (const gate of ["riko", "nami", "kiro", "zuno", "vexa"] as const) expect(c.orbs.some((o) => o.gate === gate) || c.rings.some((r) => r.kind === "bonus" && gate === "vexa"), gate).toBe(true);
         expect(c.pockets.some((p) => p.kind === "seal")).toBe(true);
         expect(c.pockets.some((p) => p.kind === "ghost")).toBe(true);
         expect(c.storms.length).toBeGreaterThan(0);
         expect(c.rings.filter((r) => r.kind === "gold")).toHaveLength(1);
      });
   }

   it("level 1 teaches in three beats: a column of big rings, then offset rings, then a gap and a closing trio over a wide pad", () => {
      const c = courseFor(1);
      const main = c.rings.filter((r) => r.main).sort((a, b) => b.y - a.y);
      const beat1 = main.slice(0, 5);
      for (const r of beat1) expect(r.r).toBeGreaterThanOrEqual(5);
      for (let k = 1; k < 5; k++) expect(Math.hypot(beat1[k].x - beat1[k - 1].x, beat1[k].z - beat1[k - 1].z)).toBeLessThanOrEqual(3.5);
      const beat2 = main.slice(5, 10);
      expect(Math.max(...beat2.map((r) => Math.abs(r.x)))).toBeGreaterThanOrEqual(4);
      const trio = main.filter((r) => r.closeMs === r.closeMs);
      expect(trio).toHaveLength(3);
      expect(c.trioY).toBeGreaterThan(trio[0].y + 60);
      expect(c.pad.r).toBeGreaterThanOrEqual(4);
   });

   it("level 2's rings move at 2-4 m/s; level 3 has geysers and speed rings; level 4 pinches into 8 m slots with blade gates; level 5 has the storm eye", () => {
      const moving = courseFor(2).rings.filter((r) => r.motion);
      expect(moving.length).toBeGreaterThanOrEqual(15);
      for (const r of moving) {
         const v = r.motion!.amp * r.motion!.omega;
         expect(v).toBeGreaterThanOrEqual(2);
         expect(v).toBeLessThanOrEqual(4);
      }
      expect(courseFor(3).updrafts.length).toBe(3);
      expect(courseFor(3).rings.filter((r) => r.kind === "speed").length).toBeGreaterThanOrEqual(6);
      const l4 = courseFor(4);
      expect(l4.sections.every((s) => s.r <= 8)).toBe(true);
      expect(l4.blades.length).toBeGreaterThanOrEqual(9);
      // a slot's centre is clear of the blades' balls (diving straight down the middle is the fast, honest line)
      for (const b of l4.blades) expect(b.arm - 1.3 - HERO_R).toBeGreaterThan(2.5);
      const l5 = courseFor(5);
      expect(l5.arena).not.toBeNull();
      for (const r of l5.rings) if (r.kind !== "bonus") expect(r.y > l5.arena!.top || r.y < l5.arena!.stop - l5.arena!.floor, `ring ${r.y} in the eye`).toBe(true);
   });

   it("the same level is the same canyon for every seed", () => {
      expect(JSON.stringify(createRun(1, 2).course.rings)).toBe(JSON.stringify(createRun(999, 2).course.rings));
   });
});

describe("the fall", () => {
   it("the column: Jump leaps (up, towards the shaft); with no input it leaps by itself after autoMs", () => {
      const run = createRun(1, 1);
      const none = createStepInput();
      hold(run, LEAP.autoMs - 20, none);
      expect(run.hero.mode).toBe("perch");
      hold(run, 40, none);
      expect(run.hero.mode).toBe("fall");
      const b = createRun(1, 1);
      const jump = createStepInput();
      jump.jumpPressed = true;
      const ev = step(b, 16, jump);
      expect(ev.leaped).toBe(true);
      expect(b.hero.vy).toBeGreaterThan(0);
      expect(b.hero.vz).toBeLessThan(0);
   });

   it("spread falls at 18 m/s and steers at 9; Dive falls at 40 and steers at 4.5", () => {
      const run = falling(1, -16, 200, 0);
      const input = createStepInput();
      input.moveX = 1;
      hold(run, 1500, input);
      expect(-run.hero.vy).toBeCloseTo(V_SPREAD + run.hero.boost, 1);
      expect(run.hero.vx).toBeCloseTo(STEER_SPREAD, 1);
      input.jumpHeld = true;
      run.hero.x = -16;
      hold(run, 1500, input);
      expect(-run.hero.vy).toBeCloseTo(V_DIVE + run.hero.boost, 1);
      expect(run.hero.vx).toBeCloseTo(STEER_DIVE, 1);
   });

   it("a ring adds +2 m/s, a speed ring +6, the extra caps at 10 and wears off", () => {
      const c = courseFor(3);
      const i = c.rings.findIndex((r) => r.kind === "speed");
      const r = c.rings[i];
      const run = falling(3, r.x, r.y + 1, r.z);
      run.hero.boost = 0;
      hold(run, 100, createStepInput());
      expect(run.threaded[i]).toBe(1);
      expect(run.hero.boost).toBeGreaterThan(BOOST_SPEED - 0.5);
      run.hero.boost = BOOST_CAP - 1;
      const n = c.rings.findIndex((q, k) => k !== i && q.kind === "ring" && !q.motion);
      Object.assign(run.hero, { x: c.rings[n].x, y: c.rings[n].y + 0.5, z: c.rings[n].z });
      step(run, 30, createStepInput());
      expect(run.hero.boost).toBeLessThanOrEqual(BOOST_CAP);
      expect(BOOST_RING).toBe(2);
      const before = run.hero.boost;
      hold(run, 1000, createStepInput());
      expect(run.hero.boost).toBeLessThan(before);
   });

   it("an updraft holds the fall to 6 m/s (10 diving)", () => {
      const u = courseFor(3).updrafts[0];
      const run = falling(3, u.x, u.y1 - 2, u.z);
      hold(run, 1500, createStepInput());
      expect(-run.hero.vy).toBeCloseTo(UPDRAFT_FALL.spread, 1);
   });

   it("the proof's one rule: on every level, random input never falls faster than VMAX in any ms", () => {
      for (const id of LEVEL_IDS) {
         const rng = createRng(id * 31);
         const run = createRun(id, id, HEROES[id % 5].id);
         const input = createStepInput();
         let prev = run.hero.y;
         for (let ms = 0; ms < 30_000 && run.ended === null; ms++) {
            if (ms % 50 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1;
               input.jumpHeld = rng() < 0.7;
               input.actionPressed = rng() < 0.2;
               input.jumpPressed = rng() < 0.3;
            }
            step(run, 1, input);
            if (run.hero.mode === "fall") expect(prev - run.hero.y).toBeLessThanOrEqual(VMAX / 1000 + 1e-9);
            prev = run.hero.y;
         }
      }
   });
});

describe("threading", () => {
   it("the centre (inner 30 %) doubles a ring; inside it scores; a near pass is a miss that breaks the flow; Nami's flip can still thread it after", () => {
      const c = courseFor(1);
      const r = c.rings[0];
      const centre = falling(1, r.x, r.y + 1, r.z);
      hold(centre, 120, createStepInput());
      expect(centre.score).toBe(PTS.centre);
      expect(centre.centres).toBe(1);
      const inner = falling(1, r.x + r.r * (CENTRE_FRAC + 0.2), r.y + 1, r.z);
      hold(inner, 120, createStepInput());
      expect(inner.rings).toBe(1);
      expect(inner.centres).toBe(0);
      expect(inner.score).toBe(PTS.ring);
      const miss = falling(1, r.x + r.r + MISS_LANE - 1, r.y + 1, r.z, "nami");
      hold(miss, 120, createStepInput());
      expect(miss.misses).toBe(1);
      expect(miss.rings).toBe(0);
      // Nami: flip back up 3 m and steer in
      const flip = createStepInput();
      flip.actionPressed = true;
      step(miss, 16, flip);
      expect(miss.hero.vy).toBeGreaterThan(0);
      const back = createStepInput();
      back.moveX = -1;
      for (let f = 0; f < 120 && miss.rings === 0; f++) step(miss, 16, back);
      expect(miss.rings).toBe(1);
      expect(miss.misses).toBe(0);
   });

   it("a ring far away is neither a thread nor a miss", () => {
      const r = courseFor(1).rings[0];
      const run = falling(1, r.x + r.r + MISS_LANE + 2, r.y + 1, r.z);
      hold(run, 120, createStepInput());
      expect(run.rings + run.misses).toBe(0);
   });
});

describe("landing", () => {
   it("the bull's-eye, the pad, the pool; anywhere else a splash and a new drop 70 m up beside the pad", () => {
      const c = courseFor(1);
      const bull = falling(1, c.pad.x, c.pad.y + 2, c.pad.z);
      hold(bull, 500, createStepInput());
      expect(bull.ended).toBe("win");
      expect(bull.landing).toBe("bull");
      expect(bull.secrets.found[1]).toBeTruthy();
      const pad = falling(1, c.pad.x + c.pad.r - 0.5, c.pad.y + 2, c.pad.z);
      hold(pad, 500, createStepInput());
      expect(pad.landing).toBe("pad");
      const pool = falling(1, c.pool!.x, 3, c.pool!.z);
      hold(pool, 500, createStepInput());
      expect(pool.landing).toBe("pool");
      const sea = falling(1, -12, 3, 0);
      hold(sea, 500, createStepInput());
      expect(sea.ended).toBeNull();
      expect(sea.hero.mode).toBe("splash");
      expect(sea.splashes).toBe(1);
      hold(sea, SPLASH_MS + 20, createStepInput());
      expect(sea.hero.mode).toBe("fall");
      expect(sea.hero.y).toBeGreaterThan(c.pad.y + RESPAWN_HEIGHT - 6);
      expect(Math.hypot(sea.hero.x - c.pad.x, sea.hero.z - c.pad.z)).toBeGreaterThan(c.pad.r);
   });

   it("a landing pays the landing and the speed bonus (20 points a second under par)", () => {
      const c = courseFor(1);
      const run = falling(1, c.pad.x, c.pad.y + 1, c.pad.z);
      run.simMs = 10_000;
      hold(run, 200, createStepInput());
      expect(run.parts.landing).toBe(PTS.bull);
      expect(run.timeBonus).toBe(timeBonusFor(c, run.finishMs));
      expect(run.timeBonus).toBe(Math.floor(((c.parMs - run.finishMs) * TIME_PTS) / 1000));
   });
});

describe("the hero powers (the card's roles)", () => {
   it("Riko's air dash crosses 8 m in 250 ms and breaks a cracked seal; nobody else gets past it", () => {
      const c = courseFor(1);
      const p = c.pockets.findIndex((q) => q.kind === "seal");
      const seal = c.pockets[p];
      const R = shaftRadius(c, seal.y1 - 3);
      const inX = Math.cos((seal.a * Math.PI) / 180);
      const inZ = Math.sin((seal.a * Math.PI) / 180);
      for (const hero of ["riko", "kiro"] as const) {
         const run = falling(1, inX * (R - 7), seal.y1 - 3, inZ * (R - 7), hero);
         const input = createStepInput();
         input.moveX = inX;
         input.moveZ = inZ;
         input.actionPressed = true;
         step(run, 16, input);
         input.actionPressed = false;
         hold(run, 600, input);
         if (hero === "riko") {
            expect(run.broken[p]).toBe(1);
            expect(run.hero.pocket).toBe(p);
         } else {
            expect(run.broken[p]).toBe(0);
            expect(run.hero.pocket).toBe(-1);
            expect(Math.hypot(run.hero.x, run.hero.z)).toBeLessThanOrEqual(R - HERO_R + 0.01);
         }
      }
      expect(POWER_MS.dash * 32 / 1000).toBeCloseTo(8, 5);
   });

   it("Nami's flip rises 3 m", () => {
      const run = falling(1, 0, 150, 0, "nami");
      const input = createStepInput();
      input.actionPressed = true;
      step(run, 1, input);
      const y0 = run.hero.y;
      let top = y0;
      input.actionPressed = false;
      for (let ms = 0; ms < POWER_MS.flip; ms++) {
         step(run, 1, input);
         top = Math.max(top, run.hero.y);
      }
      expect(top - y0).toBeCloseTo(FLIP_RISE, 0);
   });

   it("Kiro's shield holds him in a storm pocket; anyone else is blown out", () => {
      const s = courseFor(1).storms[0];
      for (const hero of ["kiro", "zuno"] as const) {
         const run = falling(1, s.x, s.y1 - 1, s.z, hero);
         const input = createStepInput();
         input.actionPressed = true;
         step(run, 16, input);
         input.actionPressed = false;
         hold(run, 500, input);
         const d = Math.hypot(run.hero.x - s.x, run.hero.z - s.z);
         if (hero === "kiro") expect(d).toBeLessThan(1);
         else expect(d).toBeGreaterThan(s.r);
      }
   });

   it("Zuno's magnet reaches 7 m and pulls the orbs hidden in the wall; without it they stay put", () => {
      const c = courseFor(1);
      const i = c.orbs.findIndex((o) => o.gate === "zuno");
      const o = c.orbs[i];
      const R = shaftRadius(c, o.y);
      const k = (R - 1.5) / Math.hypot(o.x, o.z);
      for (const hero of ["zuno", "riko"] as const) {
         const run = falling(1, o.x * k, o.y + 2, o.z * k, hero);
         const input = createStepInput();
         input.actionPressed = hero === "zuno";
         hold(run, 300, input);
         expect(run.taken[i], hero).toBe(hero === "zuno" ? 1 : 0);
      }
      expect(MAGNET_REACH).toBe(7);
   });

   it("Vexa's phase slips through a ghost panel into the inner shaft; without it the wall holds", () => {
      const c = courseFor(2);
      const p = c.pockets.findIndex((q) => q.kind === "ghost");
      const g = c.pockets[p];
      const y = g.y1 - 4;
      const R = shaftRadius(c, y);
      const inX = Math.cos((g.a * Math.PI) / 180);
      const inZ = Math.sin((g.a * Math.PI) / 180);
      for (const hero of ["vexa", "nami"] as const) {
         const run = falling(2, inX * (R - 1), y, inZ * (R - 1), hero);
         const input = createStepInput();
         input.moveX = inX;
         input.moveZ = inZ;
         input.actionPressed = hero === "vexa";
         step(run, 16, input);
         input.actionPressed = false;
         hold(run, 500, input);
         if (hero === "vexa") expect(run.hero.pocket).toBe(p);
         else expect(run.hero.pocket).toBe(-1);
      }
   });

   it("cooldowns: a power fires once per cooldown", () => {
      for (const h of HEROES) {
         const run = falling(1, 0, 300, 0, h.id);
         const input = createStepInput();
         let fired = 0;
         for (let f = 0; f < 100; f++) {
            input.actionPressed = true;
            if (step(run, 10, input).powered) fired++;
         }
         expect(fired, h.id).toBe(1 + Math.floor(990 / heroById(h.id).cooldownMs));
      }
   });
});

describe("hazards", () => {
   it("a blade gate's spiked ball knocks the hero, breaks the flow and gives a short grace; Kiro's shield and Vexa's phase pass", () => {
      const b = courseFor(4).blades[0];
      for (const hero of ["nami", "kiro"] as const) {
         const run = falling(4, 0, b.y + 3, 0, hero);
         run.simMs = 10_000;
         const a = (b.omega * 10_000) / 1000 + b.phase;
         Object.assign(run.hero, { x: b.x + Math.cos(a) * b.arm, z: b.z + Math.sin(a) * b.arm, y: b.y + 0.6 });
         const input = createStepInput();
         input.actionPressed = hero === "kiro";
         step(run, 30, input);
         expect(run.hits, hero).toBe(hero === "kiro" ? 0 : 1);
      }
   });
});

describe("scoring hand-off and the boss", () => {
   it("finalScore: the store's score and the run time (a points game)", () => {
      expect(finalScore({ score: 1234, endReason: "win", stats: {}, elapsedMs: 15_000 })).toEqual({ score: 1234, durationMs: 15_000 });
      expect(finalScore({ score: 50, endReason: "timeup", stats: {}, elapsedMs: 90_100 })).toEqual({ score: 50, durationMs: 90_100 });
   });

   it("Cyclone Ray is a valid menu2/boss with 3 phases; 6 hits defeat it (2 strikes, 3 rams, the tail pad); the combo config is valid", () => {
      expect(bossProblems(CYCLONE_RAY)).toEqual([]);
      expect(CYCLONE_RAY.phases).toHaveLength(3);
      expect(bossHitsToDefeat()).toBe(6);
      expect(bossMinMs()).toBeGreaterThan(20_000);
      expect(comboConfigProblems(COMBO)).toEqual([]);
   });
});

describe("the bound (README 'Server limits')", () => {
   it("the least finish: the drop to the pad at VMAX (level 5: the eye's entry plus the Ray's least defeat)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const fall = Math.floor(((c.top - c.pad.y) * 1000) / VMAX) - 2;
         if (!c.arena) expect(minFinishMs(c)).toBe(fall);
         else expect(minFinishMs(c)).toBe(Math.max(fall, Math.floor(((c.top - c.arena.top) * 1000) / VMAX) - 2 + bossMinMs()));
      }
   });

   it("maxScore: every ring as a centre, every orb, the most flow, the best landing, the speed bonus at the least finish (and level 5's hits)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const flow = comboMaxBonus(comboSpecOf(c));
         const boss = c.boss ? 6 * PTS.bossHit + PTS.defeat : 0;
         expect(maxScoreOf(c)).toBe(c.rings.length * PTS.centre + c.orbs.length * PTS.orb + flow + PTS.bull + timeBonusFor(c, minFinishMs(c)) + boss);
      }
   });

   it("the pinned limits (meta, arcade-games.json and these numbers move together)", () => {
      const pinned = LEVEL_IDS.map((id) => {
         const l = PROPOSED_LEVEL_LIMITS[id];
         return [l.maxScore, l.minDurationMs, l.maxDurationMs, l.maxPointsPerSec];
      });
      expect(pinned).toEqual(PINNED);
      for (const id of LEVEL_IDS) {
         const l = PROPOSED_LEVEL_LIMITS[id];
         const lb = minFinishMs(courseFor(id));
         expect(l.minDurationMs).toBeLessThanOrEqual(lb);
         expect(l.minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
         expect(l.base).toBe(0);
         // the rate holds for every run: score <= maxScore and duration >= minDuration
         expect(l.maxScore * 1000).toBeLessThanOrEqual(l.maxPointsPerSec * l.minDurationMs);
         expect(ringJumpChallengeMeta.levels![id - 1].scoring.maxScore).toBe(l.maxScore);
         expect(l).toEqual(proposeLimits(id, courseFor(id)));
      }
   });
});

/** maxScore, minDurationMs, maxDurationMs, maxPointsPerSec per level (README "Server limits"). */
const PINNED = [
   [9421, 6100, 91000, 1545],
   [11935, 7800, 101000, 1531],
   [17755, 9700, 121000, 1831],
   [14353, 11300, 131000, 1271],
   [16228, 33500, 221000, 485],
];

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot lands at 30, 60 and 144 fps, inside the server limits, never under the least finish`, () => {
         const lim = ringJumpChallengeMeta.levels![level - 1].scoring;
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
            expect(withinServerLimits(run.score, run.finishMs, lim), `${fps} fps ${run.score} in ${run.finishMs}`).toBe(true);
            expect(run.score).toBeGreaterThanOrEqual(lim.maxScore * 0.35);
         }
      }, 120_000);
   }

   it("the honest bot clears level 5's boss (all three phases) and lands on the tail pad", () => {
      const run = botRun(5);
      expect(run.boss?.hp).toBe(0);
      expect(run.parts.boss).toBe(6 * PTS.bossHit + PTS.defeat);
   });

   it("idle: the hero leaps by itself, splashes beside the pad and never lands; the clock cap ends it (points kept, inside the limits)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 60_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("timeup");
         expect(run.simMs).toBe(LEVELS[id].durationMs);
         expect(withinServerLimits(run.score, run.simMs + 50, ringJumpChallengeMeta.levels![id - 1].scoring)).toBe(true);
      }
   });

   it("200 spam bots on level 1 (random stick, dive mashing and holding, power, random frame times, any hero) stay inside the limits", () => {
      const lim = ringJumpChallengeMeta.levels![0].scoring;
      for (let seed = 1; seed <= 200; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1, HEROES[seed % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 10_000 && run.ended === null; f++) {
            if (f % 8 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1;
               input.jumpHeld = rng() < 0.6;
            }
            input.jumpPressed = rng() < 0.5;
            input.actionPressed = rng() < 0.15;
            step(run, 4 + rng() * 46, input);
         }
         const d = run.ended === "win" ? run.finishMs : run.simMs;
         expect(withinServerLimits(run.score, Math.max(d, lim.minDurationMs), lim)).toBe(true);
         if (run.ended === "win") expect(run.finishMs).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   });

   it("the honest bot through the real store with ragged frames: a ranked win the server accepts", () => {
      for (const level of [1, 5] as LevelId[]) {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1800 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level);
         const bot = createBot(run);
         const input = createStepInput();
         const rng = createRng(11 + level);
         for (let f = 0; f < 80_000 && store.getState().phase !== "over"; f++) {
            advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt <= 0) continue;
            bot.frameMs = dt * 1000;
            botInput(bot, run, input);
            const ev = step(run, dt * 1000, input);
            store.getState().setScore(run.score);
            if (ev.finished) store.getState().end("win");
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         expect(run.finishMs).toBeLessThanOrEqual(s.elapsedMs + 1);
         const rules = ringJumpChallengeMeta.levels![level - 1].scoring;
         const fin = finalScore(s);
         const sent = normalizeRun({ slug: "ring-jump-challenge", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.score).toBe(run.score);
         expect(withinServerLimits(sent.score, sent.durationMs, rules)).toBe(true);
      }
   }, 120_000);
});
