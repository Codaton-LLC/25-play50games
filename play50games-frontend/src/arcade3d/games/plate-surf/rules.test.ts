// Plate Surf rules: the rides, carve and pump, the curl, airs and tricks, hazards and the hero routes,
// falls and respawns, the hand-off to the store, and the server-limit proof (README "Server limits
// and why they hold"): the z guard on every ms, the pinned limits, and an honest, an idle and a spam
// bot, driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { plateSurfMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES } from "./heroes";
import { createBot, botInput } from "./bot";
import { BAND, FACE_W, LANE, LEDGE_UP, LIP_W, faceY } from "./waves";
import {
   AIR_H,
   BAIL_LOSS,
   CURL,
   HEARTS,
   KNOCK,
   LEVEL1_LIMITS,
   LOST_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   PUMP_GAIN,
   SPAWN_MS,
   STAT,
   TRICK_MS,
   V_AIR,
   V_MAX,
   V_MIN,
   V_START,
   bossFloorMs,
   bossMinMs,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   curlGap,
   finalScore,
   minDurationMsOf,
   minFinishMs,
   progressFloorMs,
   runTimeMs,
   step,
   waveBoxes,
   type SolidBox,
   type StepInput,
   type SurfRun,
} from "./rules";

const FPS = [30, 60, 144] as const;
const cache = new Map<string, SurfRun>();

export function botRun(level: LevelId, fps: number, seed = 1, hero = HEROES[1].id): SurfRun {
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

const submitted = (run: SurfRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function hold(run: SurfRun, ms: number, input: StepInput): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(16, left);
      step(run, d, input);
      left -= d;
   }
}

/** The hero on the face at x, riding at speed v (the curl kept far behind). */
function ride(run: SurfRun, x: number, v = 16): void {
   Object.assign(run.hero, { x, y: faceY(x, run.course.H), vx: 0, vy: 0, v, grounded: true, state: "play", pumpArmed: x >= BAND.hi, bandAt: -1 });
   run.curlZ = run.hero.z + CURL.maxGap;
}

const input = (o: Partial<StepInput> = {}): StepInput => ({ ...createStepInput(), ...o });

describe("the rides (a wave, along -z)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: ${LEVELS[id].length} m along -z, checkpoints in order, every prop on the ride, all five heroes' routes`, () => {
         const c = courseFor(id);
         expect(c.startZ - c.finishZ).toBe(LEVELS[id].length);
         expect(c.checkpoints[0]).toBe(c.startZ);
         for (let i = 1; i < c.checkpoints.length; i++) expect(c.checkpoints[i]).toBeLessThan(c.checkpoints[i - 1]);
         // a checkpoint at least every 270 m
         const cps = [...c.checkpoints, c.finishZ];
         for (let i = 1; i < cps.length; i++) expect(cps[i - 1] - cps[i]).toBeLessThanOrEqual(270);
         for (const o of c.orbs) {
            expect(o.z).toBeLessThan(c.startZ);
            expect(o.z).toBeGreaterThan(c.finishZ);
         }
         // the five routes: Riko's cracked lane, Vexa's ghost lane, Nami's ledges, Kiro's spray, Zuno's hidden trail
         expect(c.lanes.some((l) => l.kind === "cracked")).toBe(true);
         expect(c.lanes.some((l) => l.kind === "ghost")).toBe(true);
         expect(c.orbs.some((o) => o.y >= c.H + LEDGE_UP - 0.01)).toBe(true);
         expect(c.sprays.length).toBeGreaterThan(0);
         expect(c.orbs.some((o) => o.hidden)).toBe(true);
         // gated orbs are bonus orbs: the all-orbs star counts the main ones only
         for (const o of c.orbs) if (o.hidden || o.x < 0 || o.y >= c.H + LEDGE_UP - 0.01) expect(o.kind).toBe("bonus");
      });
   }

   it("level 1 teaches in three beats: pump orbs first, then a buoy line, then the lip's air orbs", () => {
      const c = courseFor(1);
      const firstBuoy = Math.max(...c.buoys.map((b) => b.z));
      const firstLip = Math.max(...c.orbs.filter((o) => o.y > c.H + 1 && o.kind === "main").map((o) => o.z));
      const pumpOrbs = c.orbs.filter((o) => o.kind === "main" && o.z > firstBuoy);
      expect(pumpOrbs.length).toBeGreaterThanOrEqual(6);
      expect(firstLip).toBeLessThan(Math.min(...c.buoys.map((b) => b.z)));
      expect(c.rocks.length).toBe(0);
      expect(c.jellies.length).toBe(0);
      expect(c.gulls.length).toBe(0);
      // the curl is slow and slower than your top speed
      expect(c.curlMps).toBe(11);
      expect(c.curlMps).toBeLessThan(V_MAX);
   });

   it("each level adds its twist: rocks (2), gates and jellies (3), the canyon, gulls and a 15 m/s curl (4), King Breaker (5)", () => {
      expect(courseFor(2).rocks.length).toBeGreaterThan(8);
      expect(courseFor(3).gates.length).toBeGreaterThan(6);
      expect(courseFor(3).jellies.length).toBeGreaterThan(6);
      expect(courseFor(4).narrows.length).toBeGreaterThan(0);
      expect(courseFor(4).gulls.length).toBeGreaterThan(4);
      expect(courseFor(4).curlMps).toBe(15);
      expect(courseFor(5).boss).toBe(true);
   });
});

describe("carve and pump", () => {
   it("a down-carve from above the band through it inside the window pumps +1.5 m/s; a slow one does not", () => {
      const run = createRun(1);
      ride(run, BAND.hi + 0.3, 14);
      run.hero.pumpArmed = true;
      run.hero.vx = -9;
      hold(run, 450, input({ moveX: -1 }));
      expect(run.pumps).toBe(1);
      // (the drag took a little)
      expect(run.hero.v).toBeGreaterThan(14 + PUMP_GAIN - 0.3);
      const slow = createRun(1);
      ride(slow, BAND.hi + 0.3, 14);
      slow.hero.pumpArmed = true;
      hold(slow, 1500, input({ moveX: -0.2 }));
      expect(slow.pumps).toBe(0);
   });

   it("a pump needs a climb above the band first: drifting down twice pumps once", () => {
      const run = createRun(1);
      ride(run, BAND.hi + 0.3, 14);
      run.hero.pumpArmed = true;
      run.hero.vx = -9;
      hold(run, 500, input({ moveX: -1 }));
      // up into the band but not above it, then down again
      hold(run, 150, input({ moveX: 1 }));
      expect(run.hero.x).toBeLessThan(BAND.hi);
      hold(run, 500, input({ moveX: -1 }));
      expect(run.pumps).toBe(1);
   });

   it("the speed is capped at V_MAX, drags down towards V_MIN without pumping, and pulling back brakes", () => {
      const run = createRun(1);
      ride(run, 6, V_MAX - 0.5);
      for (let k = 0; k < 6; k++) {
         ride(run, BAND.hi + 0.3, run.hero.v);
         run.hero.pumpArmed = true;
         run.hero.vx = -9;
         hold(run, 450, input({ moveX: -1 }));
      }
      expect(run.hero.v).toBeLessThanOrEqual(V_MAX);
      const drag = createRun(1);
      ride(drag, 6, 20);
      for (let s = 0; s < 40; s++) {
         drag.curlZ = drag.hero.z + CURL.maxGap;
         hold(drag, 1000, input());
      }
      expect(drag.hero.v).toBeLessThan(10);
      expect(drag.hero.v).toBeGreaterThanOrEqual(V_MIN);
      const brake = createRun(1);
      ride(brake, 6, 20);
      hold(brake, 500, input({ moveZ: 1 }));
      expect(brake.hero.v).toBeLessThan(18);
   });
});

describe("the curl", () => {
   it("idle, the curl catches you: a swallow costs a heart and respawns you on the checkpoint at the start speed", () => {
      const run = createRun(1);
      hold(run, 60_000, input());
      expect(run.swallows).toBeGreaterThanOrEqual(1);
      expect(run.hearts).toBeLessThan(HEARTS);
   });

   it("a swallow: LOST_MS tumbling, then SPAWN_MS frozen on the last checkpoint, the curl a respawn gap behind", () => {
      const run = createRun(1);
      ride(run, 6, 12);
      run.curlZ = run.hero.z + 0.5;
      hold(run, 5, input());
      expect(run.events.lost || run.hero.state === "lost").toBe(true);
      hold(run, LOST_MS, input());
      expect(run.hero.state).toBe("spawn");
      expect(run.hero.z).toBe(run.course.checkpoints[run.checkpoint]);
      expect(run.hero.v).toBe(V_START);
      expect(curlGap(run)).toBeCloseTo(CURL.respawnGap, 5);
      hold(run, SPAWN_MS, input());
      expect(run.hero.state).toBe("play");
   });

   it("out of hearts ends the run 'lose' (unranked); a checkpoint gives a heart back", () => {
      const run = createRun(1);
      for (let k = 0; k < HEARTS && run.ended === null; k++) {
         ride(run, 6, 12);
         run.curlZ = run.hero.z + 0.5;
         hold(run, LOST_MS + SPAWN_MS + 50, input());
      }
      expect(run.ended).toBe("lose");
      expect(isRankedRun(plateSurfMeta.scoring, "lose")).toBe(false);
      const cp = createRun(1);
      cp.hearts = 1;
      ride(cp, 6, 20);
      cp.hero.z = cp.course.checkpoints[1] + 0.2;
      cp.curlZ = cp.hero.z + CURL.maxGap;
      hold(cp, 50, input());
      expect(cp.checkpoint).toBe(1);
      expect(cp.hearts).toBe(2);
   });

   it("the curl never falls more than CURL.maxGap behind; a landed trick buys 1 s of it", () => {
      const run = createRun(1);
      ride(run, 6, V_MAX);
      hold(run, 3000, input());
      expect(curlGap(run)).toBeLessThanOrEqual(CURL.maxGap + 1e-6);
      const t = createRun(1);
      ride(t, FACE_W - 0.5, 18);
      t.curlZ = t.hero.z + 20;
      step(t, 16, input({ jumpPressed: true }));
      let before = Number.NaN;
      for (let f = 0; f < 200 && !t.events.trick; f++) {
         before = curlGap(t);
         step(t, 16, input({ moveX: -1 }));
      }
      expect(t.events.trick).toBe(1);
      expect(curlGap(t) - before).toBeGreaterThan(t.course.curlMps * CURL.trickS - 1);
   });
});

describe("airs and tricks", () => {
   it("Jump airs only at the lip; the apex is AIR_H over the take-off", () => {
      const mid = createRun(1);
      ride(mid, 6);
      step(mid, 16, input({ jumpPressed: true }));
      expect(mid.hero.grounded).toBe(true);
      const lip = createRun(1);
      ride(lip, FACE_W - LIP_W + 0.1);
      const y0 = lip.hero.y;
      step(lip, 16, input({ jumpPressed: true }));
      expect(lip.hero.grounded).toBe(false);
      let top = y0;
      for (let f = 0; f < 120 && !lip.hero.grounded; f++) {
         step(lip, 8, input());
         top = Math.max(top, lip.hero.y);
      }
      expect(top - y0).toBeGreaterThan(AIR_H - 0.1);
      expect(top - y0).toBeLessThan(AIR_H + 0.15);
      expect(V_AIR).toBeGreaterThan(0);
   });

   it("a trick held TRICK_MS lands (spin, flip, grab by the raw stick); landed short of it is a bail", () => {
      for (const [stick, kind] of [[{ moveX: 1 }, 1], [{ moveZ: 1 }, 2], [{ moveZ: -1 }, 3]] as const) {
         const run = createRun(1);
         ride(run, FACE_W - 0.4, 18);
         step(run, 16, input({ jumpPressed: true }));
         let got = 0;
         for (let f = 0; f < 200 && !run.events.landed; f++) {
            step(run, 8, input(stick));
            if (run.events.trick) got = run.events.trick;
         }
         expect(got).toBe(kind);
      }
      const bail = createRun(1);
      ride(bail, FACE_W - 0.4, 18);
      step(bail, 16, input({ jumpPressed: true }));
      // hold the trick only at the end of the air
      let f = 0;
      for (; f < 200 && !bail.events.landed; f++) step(bail, 8, input(bail.hero.vy < -V_AIR + 2 ? { moveX: 1 } : {}));
      expect(bail.events.bailed).toBe(true);
      expect(bail.hero.v).toBeLessThanOrEqual(18 - BAIL_LOSS + 0.1);
      expect(TRICK_MS).toBeGreaterThan(0);
   });

   it("Nami's double air reaches the ledge orbs a single air cannot", () => {
      const c = courseFor(1);
      const reach = (power: boolean) => {
         const run = createRun(1, 1, "nami");
         ride(run, FACE_W - 0.4, 18);
         step(run, 16, input({ jumpPressed: true }));
         let top = 0;
         for (let f = 0; f < 300 && !run.hero.grounded; f++) {
            const atApex = run.hero.vy <= 0 && run.hero.airJump;
            step(run, 8, input({ actionPressed: power && atApex }));
            top = Math.max(top, run.hero.y - c.H + ORB.centerY);
         }
         return top;
      };
      expect(reach(false)).toBeLessThan(LEDGE_UP - ORB.pickup);
      expect(reach(true)).toBeGreaterThan(LEDGE_UP - ORB.pickup);
   });
});

describe("hazards and the hero routes", () => {
   it("a rock wipes you out; a buoy slows you by KNOCK.buoy; a jelly stings by KNOCK.sting unless Kiro's shield is up", () => {
      const r = createRun(1, 2);
      const rock = r.course.rocks[0];
      ride(r, rock.x, 16);
      r.hero.z = rock.z + 1.6;
      hold(r, 200, input());
      expect(r.events.lost || r.hero.state === "lost" || r.hits > 0).toBe(true);
      const b = createRun(1, 1);
      const buoy = b.course.buoys[0];
      ride(b, buoy.x, 16);
      b.hero.z = buoy.z + 1.2;
      hold(b, 150, input());
      expect(b.hero.v).toBeLessThan(16 - KNOCK.buoy + 0.2);
      for (const hero of ["nami", "kiro"] as const) {
         const j = createRun(1, 3, hero);
         const jelly = j.course.jellies[0];
         ride(j, jelly.x, 16);
         j.hero.z = jelly.z + 2;
         step(j, 16, input({ actionPressed: hero === "kiro" }));
         hold(j, 200, input());
         if (hero === "kiro") expect(j.stings).toBe(0);
         else expect(j.stings).toBe(1);
      }
   });

   it("Riko's dash breaks a cracked reef wall into the lagoon lane; without it the wall bounces you back onto the face", () => {
      for (const hero of ["nami", "riko"] as const) {
         const run = createRun(1, 1, hero);
         const lane = run.course.lanes.find((l) => l.kind === "cracked")!;
         ride(run, -3, 16);
         run.hero.z = lane.z0 + 4;
         run.curlZ = run.hero.z + CURL.maxGap;
         step(run, 16, input({ actionPressed: true, moveX: -1 }));
         hold(run, 400, input({ moveX: -1 }));
         if (hero === "riko") {
            expect(run.laneOpen[run.course.lanes.indexOf(lane)]).toBe(1);
            expect(run.hero.x).toBeLessThan(LANE.x1);
         } else expect(run.hero.x).toBeGreaterThanOrEqual(0);
      }
   });

   it("Vexa's phase slips through a ghost arch into the calm lane; anyone else bounces", () => {
      for (const hero of ["kiro", "vexa"] as const) {
         const run = createRun(1, 1, hero);
         const lane = run.course.lanes.find((l) => l.kind === "ghost")!;
         ride(run, -3, 16);
         run.hero.z = lane.z0 + 4;
         run.curlZ = run.hero.z + CURL.maxGap;
         step(run, 16, input({ actionPressed: true, moveX: -1 }));
         hold(run, 400, input({ moveX: -1 }));
         if (hero === "vexa") expect(run.hero.x).toBeLessThan(LANE.x1);
         else expect(run.hero.x).toBeGreaterThanOrEqual(0);
      }
   });

   it("Zuno's hidden trail only comes with the magnet up", () => {
      for (const hero of ["nami", "zuno"] as const) {
         const run = createRun(1, 1, hero);
         const o = run.course.orbs.find((q) => q.hidden)!;
         ride(run, o.x + 3, 16);
         run.hero.z = o.z + 3;
         step(run, 16, input({ actionPressed: true }));
         hold(run, 300, input());
         const got = run.course.orbs.some((q, i) => q.hidden && run.collected[i]);
         expect(got).toBe(hero === "zuno");
      }
   });
});

describe("the z guard (the proof's one rule)", () => {
   it("on every level, 30 s of random input for every hero never moves the hero more than V_MAX/1000 towards -z in one ms", () => {
      for (const level of LEVEL_IDS) {
         for (const h of HEROES) {
            const run = createRun(7, level, h.id);
            const rng = createRng(level * 31 + h.id.length);
            const inp = createStepInput();
            for (let ms = 0; ms < 30_000 && run.ended === null; ms++) {
               if (ms % 40 === 0) {
                  inp.moveX = rng() * 2 - 1;
                  inp.moveZ = rng() * 2 - 1;
               }
               inp.jumpPressed = rng() < 0.05;
               inp.actionPressed = rng() < 0.02;
               const z0 = run.hero.z;
               step(run, 1, inp);
               expect(z0 - run.hero.z).toBeLessThanOrEqual(V_MAX / 1000 + 1e-9);
            }
         }
      }
   }, 120_000);
});

describe("scoring hand-off", () => {
   it("finalScore: a win submits the finish minus 250 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      expect(finalScore({ score: 0, endReason: "win", elapsedMs: 40_000, stats: { [STAT.finishMs]: 39_000, [STAT.orbs]: 10, [STAT.comboMs]: 300 } }).durationMs).toBe(39_000 - 2500 - 300);
      expect(finalScore({ score: 0, endReason: "timeup", elapsedMs: 120_000, stats: {} }).durationMs).toBe(120_000);
   });
});

describe("the lower bound (README 'Server limits')", () => {
   it("the z floor is the ride's length at V_MAX, less 4 ms; level 5 adds King Breaker's floor after its start line", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(progressFloorMs(c)).toBeCloseTo((LEVELS[id].length * 1000) / V_MAX - 4, 6);
      }
      const c5 = courseFor(5);
      expect(bossFloorMs(c5)).toBeCloseTo(((c5.startZ - c5.bossStartZ) * 1000) / V_MAX - 4 + bossMinMs() - 2, 6);
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
         expect(lim.maxDurationMs).toBe(LEVELS[id].durationMs);
      }
      expect(LEVEL1_LIMITS).toBe(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
      expect(plateSurfMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      for (const id of LEVEL_IDS) expect(plateSurfMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
   });

   it("every level is worth at least level 1's points, and level 5 at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });
});

/** minDurationMs, maxDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [13800, 120000, 120000, 10620],
   [18400, 140000, 140000, 12160],
   [21300, 160000, 160000, 13870],
   [27000, 180000, 180000, 15300],
   [42300, 240000, 240000, 19770],
];

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot finishes at 30, 60 and 144 fps, never under the floor, at least 80 % of maxScore, never swallowed`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
            const score = Math.floor((lim.timeBaseMs - d) / 10);
            expect(score, `${fps} fps ${score} / ${lim.maxScore}`).toBeGreaterThanOrEqual(lim.maxScore * 0.8);
            expect(run.swallows).toBe(0);
            // every main orb at 60 fps on levels 1-4 (90 % at the other rates); level 5's boss fight takes the bot off a few
            const share = run.mainOrbs / run.course.mainOrbs;
            if (level === 5) expect(share).toBeGreaterThanOrEqual(0.65);
            else if (fps === 60) expect(run.mainOrbs).toBe(run.course.mainOrbs);
            else expect(share).toBeGreaterThanOrEqual(0.9);
         }
      }, 60_000);
   }

   it("the honest bot's points: each level at least level 1, level 5 at most 3x", () => {
      const points = (id: LevelId) => Math.floor((PROPOSED_LEVEL_LIMITS[id].timeBaseMs - submitted(botRun(id, 60))) / 10);
      const first = points(1);
      for (const id of LEVEL_IDS) expect(points(id)).toBeGreaterThanOrEqual(first);
      expect(points(5)).toBeLessThanOrEqual(first * 3);
   });

   it("idle never wins: the curl takes every heart ('lose', unranked)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 40_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("lose");
      }
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(3, 1);
      const inp = createStepInput();
      for (let f = 0; f < 20_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         const ev = step(run, dt * 1000, inp);
         if (ev.out) store.getState().end("lose");
      }
      expect(store.getState().endReason).toBe("lose");
      expect(isRankedRun(plateSurfMeta.scoring, store.getState().endReason)).toBe(false);
   });

   it("200 spam bots on level 1 (random stick, jump and power mashing, random frame times) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      for (let seed = 1; seed <= 200; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1, HEROES[seed % 5].id);
         const inp = createStepInput();
         for (let f = 0; f < 6000 && run.ended === null; f++) {
            if (f % 10 === 0) {
               inp.moveX = rng() * 2 - 1;
               inp.moveZ = -rng();
            }
            inp.jumpPressed = rng() < 0.5;
            inp.actionPressed = rng() < 0.1;
            step(run, 4 + rng() * 46, inp);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   });

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
      const rules = plateSurfMeta.scoring;
      const sent = normalizeRun({ slug: "plate-surf", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});

describe("the camera's solid boxes (menu2/camera)", () => {
   it("waveBoxes stay under the face (the camera stays in front of the water) and under the sea", () => {
      const c = courseFor(2);
      const out: SolidBox[] = [];
      const n = waveBoxes(c, -100, 26, out);
      expect(n).toBeGreaterThan(4);
      for (let i = 0; i < n; i++) {
         const b = out[i];
         for (let x = Math.max(0, b.minX); x <= Math.min(FACE_W, b.maxX); x += 0.25) expect(b.maxY).toBeLessThanOrEqual(faceY(x, c.H) + 1e-9);
      }
   });
});
