// Rooftop Roll Climb rules: the zigzag skyline, slope momentum (the curled ball banks speed down a
// slanted roof and keeps it into the leap), falls and respawns, the coin and flow bonus, the hand-off
// to the store, and the server-limit proof (README "Server limits and why they hold") with an honest
// bot, an idle bot and a spam bot, driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { rooftopRollClimbMeta } from "./meta";
import { LEVELS } from "./levels";
import { lipOf } from "./roofs";
import { createBot, botInput } from "./bot";
import {
   BRAKE,
   BUFFER_MS,
   COURSE,
   COYOTE_MS,
   EXTRA_NONE,
   FALL_DEPTH,
   G,
   H_JUMP,
   LEVEL1_LIMITS,
   LOST_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   ROLL_BLEED,
   SPAWN_MS,
   START_DZ,
   STAT,
   V_JUMP,
   V_ROLL_MAX,
   V_RUN,
   V_TOP,
   airTimeS,
   courseFor,
   coyoteJumpS,
   createRun,
   createStepInput,
   finalScore,
   heroSpeed,
   layeredArrival,
   minArrivalMs,
   minDurationMsOf,
   minFinishMs,
   moverOffset,
   moverTopSpeed,
   reachMax,
   riseLandS,
   runTimeMs,
   standGap,
   step,
   supportX,
   supportZ,
   surfaceY,
   type RoofRun,
   type StepInput,
   type Support,
} from "./rules";

const FPS = [30, 60, 144] as const;

const botCache = new Map<string, RoofRun>();

/** Runs the honest bot to the end at a fixed frame rate (rules only). Cached: the proof reads each run once. */
function botRun(level: LevelId, fps: number, seed = 1): RoofRun {
   const key = `${level}:${fps}:${seed}`;
   const hit = botCache.get(key);
   if (hit) return hit;
   const fms = 1000 / fps;
   const run = createRun(seed, level);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   botCache.set(key, run);
   return run;
}

/** The submitted duration of a finished run: finish minus the coin and the flow bonus. */
const submitted = (run: RoofRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

/** A run standing at rest on support `i` at x (feet on its surface). */
function standOn(run: RoofRun, i: number, x: number): void {
   const s = run.course.supports[i];
   const h = run.hero;
   h.x = x;
   h.z = s.cz;
   h.y = surfaceY(s, x);
   h.vx = 0;
   h.vz = 0;
   h.support = i;
   h.from = i;
   h.grounded = true;
   h.lastTop = h.y;
   h.slopeMin = 0;
   h.apexCap = h.y + H_JUMP;
}

const firstSlope = (c = COURSE) => c.supports.findIndex((s) => s.slope && !s.keep && !s.arena);

describe("the skyline", () => {
   it("level 1 is Low Roofs: five switchback blocks (deck, fire-escape climb, top deck, slanted roof), a chained slope, the helipad, a catch roof, no hazards", () => {
      const s = COURSE.supports;
      expect(s[0].kind).toBe("start");
      expect(s[COURSE.goal].role).toBe("helipad");
      expect(s.filter((x) => x.role === "deck")).toHaveLength(5);
      expect(s.filter((x) => x.role === "top")).toHaveLength(5);
      // five block slopes plus the chained one, which keeps the roll of a ball that lands on it
      expect(s.filter((x) => x.slope)).toHaveLength(6);
      expect(s.filter((x) => x.keep)).toHaveLength(1);
      expect(s[COURSE.goal - 1].keep).toBe(true);
      expect(s.filter((x) => x.role === "catch")).toHaveLength(1);
      expect(s.filter((x) => x.mover || x.vanish || x.slippery || x.launch > 0)).toHaveLength(0);
      expect(s.filter((x) => x.slope?.wet)).toHaveLength(0);
      expect(COURSE.strikes).toHaveLength(0);
      expect(COURSE.arena).toBeNull();
      expect(COURSE.durationMs).toBe(90_000);
      // the switchback: consecutive block slopes fall away in opposite directions
      const dirs = s.filter((x) => x.slope && !x.keep).map((x) => x.slope!.dir);
      for (let i = 1; i < dirs.length; i++) expect(dirs[i]).toBe(-dirs[i - 1]);
   });

   it("is the same race for every seed (the seed only places decor)", () => {
      const a = createRun(1, 1);
      const b = createRun(987654321, 1);
      expect(a.course).toBe(b.course);
      const input: StepInput = { moveX: 0, moveZ: -1, jumpPressed: false, actionPressed: false };
      for (let f = 0; f < 240; f++) {
         input.jumpPressed = f % 40 === 10;
         step(a, 1000 / 60, input);
         step(b, 1000 / 60, input);
      }
      expect(a.hero).toEqual(b.hero);
   });

   it("each level adds the card's twist: gondolas (L2), crane slabs, wet tin and blinking roofs (L3), chimney updrafts and spark arcs (L4), everything and Ashback's arena (L5)", () => {
      const has = (id: LevelId) => {
         const c = courseFor(id);
         const s = c.supports;
         return {
            movers: s.some((x) => x.mover),
            vanish: s.some((x) => x.vanish),
            wet: s.some((x) => x.slope?.wet),
            updraft: s.some((x) => x.launch > 0),
            sparks: c.strikes.some((st) => !st.air),
            arena: c.arena !== null,
         };
      };
      expect(has(1)).toEqual({ movers: false, vanish: false, wet: false, updraft: false, sparks: false, arena: false });
      expect(has(2)).toEqual({ movers: true, vanish: false, wet: false, updraft: false, sparks: false, arena: false });
      expect(has(3)).toEqual({ movers: true, vanish: true, wet: true, updraft: false, sparks: false, arena: false });
      expect(has(4)).toEqual({ movers: true, vanish: false, wet: false, updraft: true, sparks: true, arena: false });
      expect(has(5)).toEqual({ movers: true, vanish: true, wet: true, updraft: true, sparks: true, arena: true });
      expect(LEVELS[2].spec.street).toBe("gondola");
      expect(LEVELS[3].spec.street).toBe("crane");
      for (const id of LEVEL_IDS) {
         expect(courseFor(id).durationMs).toBe(LEVELS[id].durationMs);
         expect(createRun(1, id).course).toBe(createRun(99, id).course);
      }
      // wet tin rolls 1.5x faster
      const c3 = courseFor(3).supports.filter((x) => x.slope);
      const dry = c3.find((x) => !x.slope!.wet)!.slope!.accel;
      expect(c3.find((x) => x.slope!.wet)!.slope!.accel).toBeCloseTo(dry * 1.5, 1);
   });

   it("every climb step rises well under the jump's apex, and every slope is a 15-30 degree tin roof", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (const s of c.supports) {
            if (s.slope && !s.arena) {
               const deg = (Math.atan(s.slope.grade) * 180) / Math.PI;
               expect(deg, `L${id}`).toBeGreaterThanOrEqual(15);
               expect(deg, `L${id}`).toBeLessThanOrEqual(30);
               expect(s.slope.accel).toBeGreaterThanOrEqual(6);
            }
         }
         expect(LEVELS[id].spec.stepRise).toBeLessThan(H_JUMP - 0.6);
      }
   });

   it("the signature: a plain run-and-jump cannot clear a street, a ball that rolled down the slope can (and it is about 12 m at full speed against 6 m)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         c.supports.forEach((s, i) => {
            if (!s.slope || s.keep || s.arena) return;
            const next = c.supports[i + 1];
            if (!next || next.mover || next.arena || next.keep) return;
            const dy = next.top - lipOf(s).y;
            const gap = standGap(s, next);
            expect(gap, `L${id} street ${i}`).toBeGreaterThan(reachMax(V_RUN, dy, 0, EXTRA_NONE));
            expect(gap, `L${id} street ${i}`).toBeLessThan(reachMax(V_ROLL_MAX, dy, 0, EXTRA_NONE));
         });
      }
      expect(reachMax(V_ROLL_MAX, 0, 0)).toBeGreaterThan(12);
      expect(reachMax(V_RUN, 0, 0)).toBeLessThan(6.7);
   });
});

describe("slope momentum", () => {
   it("leaning downhill curls the hero into a ball that banks speed at the slope's accel, never past V_ROLL_MAX", () => {
      const run = createRun(1, 1);
      const i = firstSlope();
      const s = run.course.supports[i];
      const dir = s.slope!.dir;
      standOn(run, i, s.cx - dir * (s.hw - 0.2));
      const input: StepInput = { moveX: dir, moveZ: 0, jumpPressed: false, actionPressed: false };
      let top = 0;
      for (let ms = 0; ms < 400; ms++) {
         step(run, 1, input);
         if (!run.hero.grounded) break;
         expect(run.hero.curled).toBe(true);
         top = Math.max(top, heroSpeed(run.hero));
      }
      // 0.4 s at the slope's accel from rest: about accel x 0.4 (the stick adds nothing on a slope)
      expect(top).toBeGreaterThan(s.slope!.accel * 0.35);
      expect(top).toBeLessThanOrEqual(V_ROLL_MAX + 1e-9);
   });

   it("a jump at the lip keeps the banked speed: back at its take-off height the leap has flown about 1.5x as far as a run-and-jump (over 9 m)", () => {
      // the ground covered from the take-off until the arc is back down at the take-off's height
      const flight = (rolled: boolean) => {
         const run = createRun(1, 1);
         const i = rolled ? firstSlope() : 0;
         const s = run.course.supports[i];
         const dir = rolled ? s.slope!.dir : 1;
         const edge = s.cx + dir * s.hw;
         standOn(run, i, rolled ? s.cx - dir * (s.hw - 0.1) : s.cx - dir * (s.hw - 0.3));
         // onto the slope at running speed, as from its top deck
         if (rolled) run.hero.vx = dir * V_RUN;
         const input: StepInput = { moveX: dir, moveZ: 0, jumpPressed: false, actionPressed: false };
         let x0 = Number.NaN;
         let y0 = 0;
         for (let ms = 0; ms < 4000; ms++) {
            const h = run.hero;
            input.jumpPressed = h.grounded && (edge - h.x) * dir < 0.15;
            const ev = step(run, 1, input);
            if (ev.jumped && Number.isNaN(x0)) {
               x0 = h.x;
               y0 = h.y;
            }
            if (!Number.isNaN(x0) && run.simMs > 50 && (h.y < y0 || ev.landed)) return Math.abs(h.x - x0);
         }
         return 0;
      };
      const plain = flight(false);
      const rolled = flight(true);
      expect(rolled).toBeGreaterThan(plain * 1.45);
      expect(rolled).toBeGreaterThan(9);
   });

   it("curled on a flat roof the ball bleeds ROLL_BLEED; uncurled it brakes to V_RUN in about 0.3 s", () => {
      expect(ROLL_BLEED).toBe(4);
      expect((V_ROLL_MAX - V_RUN) / BRAKE).toBeCloseTo(0.3, 1);
      const run = createRun(1, 1);
      const deck = run.course.supports.findIndex((s, k) => k > 0 && s.role === "deck");
      standOn(run, deck, run.course.supports[deck].cx);
      run.hero.vx = 12;
      run.hero.curled = true;
      // a ball that came on fast is allowed its speed only through the proof's entry cap
      const input: StepInput = { moveX: 0, moveZ: 0, jumpPressed: false, actionPressed: false };
      for (let ms = 0; ms < 300; ms++) step(run, 1, input);
      expect(heroSpeed(run.hero)).toBeLessThanOrEqual(V_RUN + 1e-6);
   });

   it("never moves faster than V_TOP (Riko's burst) + the fastest carry in any one ms", () => {
      const rng = createRng(42);
      for (const level of LEVEL_IDS) {
         const run = createRun(7, level, "riko");
         const vh = (V_TOP + run.course.maxCarry) / 1000;
         const input = createStepInput();
         for (let ms = 0; ms < 30_000 && run.ended === null; ms++) {
            if (ms % 120 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1.3;
            }
            input.jumpPressed = rng() < 0.05;
            input.actionPressed = rng() < 0.01;
            const x0 = run.hero.x;
            const z0 = run.hero.z;
            const ev = step(run, 1, input);
            if (ev.respawned || run.hero.state !== "play") continue;
            expect(Math.hypot(run.hero.x - x0, run.hero.z - z0)).toBeLessThanOrEqual(vh + 1e-9);
         }
      }
   });

   it("the stick is camera-relative: yaw turns it, yaw 0 is world space", () => {
      const a = createRun(1, 1);
      const b = createRun(1, 1);
      const up: StepInput = { moveX: 0, moveZ: -1, yaw: 0, jumpPressed: false, actionPressed: false };
      const turned: StepInput = { moveX: 0, moveZ: -1, yaw: Math.PI / 2, jumpPressed: false, actionPressed: false };
      for (let f = 0; f < 20; f++) {
         step(a, 1000 / 60, up);
         step(b, 1000 / 60, turned);
      }
      expect(a.hero.z).toBeLessThan(createRun(1, 1).hero.z - 0.5);
      expect(Math.abs(b.hero.x - a.hero.x)).toBeGreaterThan(0.5);
      expect(heroSpeed(b.hero)).toBeCloseTo(heroSpeed(a.hero), 6);
   });

   it("movers use the smooth triangle wave within their travel and top speed", () => {
      for (const id of [2, 3] as const) {
         for (const s of courseFor(id).supports) {
            if (!s.mover) continue;
            let maxStep = 0;
            for (let ms = 0; ms < 10_000; ms++) {
               const o = moverOffset(s.mover, ms);
               expect(Math.abs(o)).toBeLessThanOrEqual(s.mover.travel + 1e-9);
               maxStep = Math.max(maxStep, Math.abs(moverOffset(s.mover, ms + 1) - o));
            }
            expect(maxStep * 1000).toBeLessThanOrEqual(moverTopSpeed(s.mover) + 1e-6);
            expect(supportX(s, 0) === s.cx || supportZ(s, 0) === s.cz).toBe(true);
         }
      }
   });
});

describe("jumps, falls, respawns, coins, the finish", () => {
   it("a jump from flat ground peaks at H_JUMP and lands back after about 2 x apex", () => {
      const run = createRun(1, 1);
      const input: StepInput = { moveX: 0, moveZ: 0, jumpPressed: true, actionPressed: false };
      step(run, 1, input);
      input.jumpPressed = false;
      let peak = 0;
      let landedAt = -1;
      for (let ms = 2; ms < 2000 && landedAt < 0; ms++) {
         const ev = step(run, 1, input);
         peak = Math.max(peak, run.hero.y);
         if (ev.landed) landedAt = run.simMs;
      }
      expect(peak).toBeGreaterThan(H_JUMP - 0.01);
      expect(peak).toBeLessThanOrEqual(H_JUMP + 1e-9);
      expect(landedAt).toBeGreaterThan((2000 * V_JUMP) / G);
      expect(landedAt).toBeLessThan((2000 * V_JUMP) / G + 3);
   });

   it("keeps a jump press for BUFFER_MS", () => {
      const run = createRun(1, 1);
      const input: StepInput = { moveX: 0, moveZ: 0, jumpPressed: true, actionPressed: false };
      step(run, 1, input);
      input.jumpPressed = false;
      let jumps = 1;
      for (let ms = 0; ms < 2000; ms++) {
         if (run.simMs === Math.round((2000 * V_JUMP) / G) - (BUFFER_MS - 30)) input.jumpPressed = true;
         const ev = step(run, 1, input);
         input.jumpPressed = false;
         if (ev.jumped) jumps++;
      }
      expect(jumps).toBe(2);
      expect(COYOTE_MS).toBe(100);
   });

   it("a fall FALL_DEPTH under the last top is lost; the hero comes back on the checkpoint after LOST_MS + SPAWN_MS", () => {
      const run = createRun(1, 1);
      expect(run.hero.z).toBeCloseTo(COURSE.supports[0].cz + START_DZ, 9);
      const input: StepInput = { moveX: -1, moveZ: 0, jumpPressed: false, actionPressed: false };
      let lostAt = -1;
      let backAt = -1;
      for (let ms = 0; ms < 6000; ms++) {
         const ev = step(run, 1, input);
         if (ev.lost) {
            lostAt = run.simMs;
            expect(run.hero.y).toBeLessThan(0 - FALL_DEPTH);
            expect(run.hits).toBe(1);
         }
         if (ev.respawned) backAt = run.simMs;
         if (backAt > 0 && run.hero.state === "play") break;
      }
      expect(lostAt).toBeGreaterThan(0);
      expect(backAt - lostAt).toBe(LOST_MS);
      expect(run.hero.y).toBe(COURSE.supports[COURSE.checkpoints[0]].top);
      expect(run.respawns).toBe(1);
      expect(SPAWN_MS + LOST_MS).toBe(1500);
   });

   it("submits the finish ms minus 0.4 s per coin and the flow bonus on a win, the elapsed time otherwise", () => {
      expect(finalScore({ score: 0, endReason: "win", elapsedMs: 30_123, stats: { [STAT.finishMs]: 30_000, [STAT.orbs]: 10, [STAT.comboMs]: 250 } })).toEqual({ score: 0, durationMs: 25_750 });
      expect(finalScore({ score: 0, endReason: "timeup", elapsedMs: 90_000, stats: { [STAT.orbs]: 3 } })).toEqual({ score: 0, durationMs: 90_000 });
      expect(runTimeMs(1000, 5)).toBe(0);
      expect(ORB.bonusMs).toBe(400);
   });
});

describe("the lower bound (README proof)", () => {
   it("flight times follow the closed-form arc, the coyote time included", () => {
      expect(riseLandS(V_JUMP, H_JUMP + 0.01)).toBe(Infinity);
      expect(riseLandS(V_JUMP, 0)).toBeCloseTo((2 * V_JUMP) / G, 9);
      expect(riseLandS(V_JUMP, 2)).toBeCloseTo(V_JUMP / G + Math.sqrt((2 * (H_JUMP - 2)) / G), 9);
      // the coyote walk-off then a jump: never longer than COYOTE + the full arc, never shorter than the arc alone
      for (const dy of [-3, -1, 0, 1, 2, 3, 3.2]) {
         expect(coyoteJumpS(dy)).toBeLessThanOrEqual(COYOTE_MS / 1000 + airTimeS(V_JUMP, dy) + 1e-12);
         expect(coyoteJumpS(dy)).toBeGreaterThanOrEqual(airTimeS(V_JUMP, dy) - 1e-12);
         // brute force over the walk-off ms: the closed form is the max
         let best = -1;
         for (let c = 0; c <= COYOTE_MS; c++) {
            const t = airTimeS(V_JUMP, dy + (G * (c / 1000) ** 2) / 2);
            if (t >= 0) best = Math.max(best, c / 1000 + t);
         }
         expect(coyoteJumpS(dy)).toBeGreaterThanOrEqual(best - 1e-9);
      }
      expect(coyoteJumpS(H_JUMP + 0.01)).toBe(-1);
   });

   it("every support is reachable by some hero (the water-tower ledges by Nami), and a power only ever lowers an arrival", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const arrive = minArrivalMs(c);
         const plain = layeredArrival(c, EXTRA_NONE, 0)[0];
         c.supports.forEach((s: Support, i) => {
            expect(Number.isFinite(arrive[i]), `L${id} support ${i} (${s.role})`).toBe(true);
            expect(arrive[i]).toBeLessThanOrEqual(plain[i]);
            if (s.role !== "ledge") expect(Number.isFinite(plain[i]), `L${id} plain ${i}`).toBe(true);
         });
         expect(minFinishMs(c)).toBeGreaterThan(0);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: the proposed limits sit under the bound, at least 94 % of it, and maxScore follows from them`, () => {
         const c = courseFor(level);
         const lb = minDurationMsOf(c);
         const lim = PROPOSED_LEVEL_LIMITS[level];
         expect(Number.isFinite(lb), `level ${level} reachable`).toBe(true);
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.maxDurationMs).toBe(c.durationMs);
         expect(lim.timeBaseMs).toBe(c.durationMs);
         // meta (and arcade-games.json, registry.sync.test.ts) ship exactly these limits on this level
         expect(rooftopRollClimbMeta.levels![level - 1].scoring).toMatchObject(lim);
         if (level === 1) expect(lim).toEqual(LEVEL1_LIMITS);
      });
   }

   it("pins the shipped per-level limits (meta.ts and arcade-games.json repeat them)", () => {
      const rows = LEVEL_IDS.map((id) => {
         const l = PROPOSED_LEVEL_LIMITS[id];
         return [l.minDurationMs, l.maxDurationMs, l.timeBaseMs, l.maxScore];
      });
      expect(rows).toEqual([
         [11300, 90000, 90000, 7870],
         [16100, 120000, 120000, 10390],
         [17500, 150000, 150000, 13250],
         [16600, 180000, 180000, 16340],
         [38900, 240000, 240000, 20110],
      ]);
   });

   it("every proposed level is worth at least level 1's points, and level 5 is at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot reaches the helipad${level === 5 ? " and beats Ashback" : ""} at 30, 60 and 144 fps, never under the bound, at least 90 % of max`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            if (level === 5) expect(run.boss!.state.hp).toBe(0);
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
            const score = Math.floor((lim.timeBaseMs - d) / 10);
            expect(score, `${fps} fps score ${score} / ${lim.maxScore}`).toBeGreaterThanOrEqual(Math.floor(lim.maxScore * 0.9));
         }
      }, 120_000);
   }

   it("the honest bot's points: each level at least level 1, level 5 at most 3x", () => {
      const points = (id: LevelId) => Math.floor((PROPOSED_LEVEL_LIMITS[id].timeBaseMs - submitted(botRun(id, 60))) / 10);
      const first = points(1);
      for (const id of LEVEL_IDS) expect(points(id)).toBeGreaterThanOrEqual(first);
      expect(points(5)).toBeLessThanOrEqual(first * 3);
   }, 120_000);

   it("the idle bot times out at 90 s: unranked, nothing sent", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: undefined, lives: undefined, resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(3, 1);
      const input = createStepInput();
      for (let f = 0; f < 20_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         const ev = step(run, dt * 1000, input);
         if (ev.timeup) store.getState().end("timeup");
      }
      const s = store.getState();
      expect(s.endReason).toBe("timeup");
      expect(run.simMs).toBe(90_000);
      expect(isRankedRun(rooftopRollClimbMeta.scoring, s.endReason)).toBe(false);
   });

   it("200 spam bots (random stick, jump mashing, random frame times) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      let wins = 0;
      for (let seed = 1; seed <= 200; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1);
         const input = createStepInput();
         for (let f = 0; f < 6000 && run.ended === null; f++) {
            if (f % 10 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = -rng();
            }
            input.jumpPressed = rng() < 0.5;
            step(run, 4 + rng() * 46, input);
         }
         if (run.ended === "win") {
            wins++;
            expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }
      expect(wins).toBeLessThan(200);
   }, 120_000);

   it("the honest bot through the real store: a ranked win inside the server limits, score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5, 1);
      const bot = createBot(run);
      const input = createStepInput();
      const rng = createRng(11);
      for (let f = 0; f < 50_000 && store.getState().phase !== "over"; f++) {
         // ragged frames: mostly 60 fps, some long ones (the core caps a frame at 50 ms)
         advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         bot.frameMs = dt * 1000;
         botInput(bot, run, input);
         const ev = step(run, dt * 1000, input);
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
      const rules = rooftopRollClimbMeta.scoring;
      const sent = normalizeRun({ slug: "rooftop-roll-climb", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-25T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.durationMs).toBeLessThanOrEqual(rules.maxDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   }, 60_000);
});
