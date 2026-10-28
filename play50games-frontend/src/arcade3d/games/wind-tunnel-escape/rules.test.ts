// Wind Tunnel Escape rules: the tunnel's rooms, redirecting the wind (turn, switch, ride, crosswinds,
// walls, the hold inside a current, up-currents), lifts, the storm front, falls and respawns, the hand-off
// to the store, and the server-limit proof (README "Server limits and why they hold"): the z guard on
// every substep, the pinned limits, the boss and dash floors, and an honest, an idle and a spam bot,
// driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { windTunnelEscapeMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES, POWER_MS, V_DASH, heroById } from "./heroes";
import { SECRETS } from "./progression";
import { createBot, botInput } from "./bot";
import { DIRS, dirIndex, HUB } from "./tunnel";
import {
   HEARTS,
   HINT_MS,
   HOLD_MS,
   LOST_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   SPAWN_MS,
   STAT,
   STEP_MS,
   TURN_MS,
   V_JET,
   V_ZMAX,
   bossMinMs,
   boundSegments,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   currentAt,
   dashFloorMs,
   fanDir,
   fanLive,
   finalScore,
   minDurationMsOf,
   minFinishMs,
   roomAt,
   runTimeMs,
   solidBoxes,
   step,
   zFloorMs,
   type StepInput,
   type WindRun,
} from "./rules";

const FPS = [30, 60, 144];

function botRun(level: LevelId, fps = 60, hero: (typeof HEROES)[number]["id"] = "nami"): WindRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

const submitted = (run: WindRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

/** Puts the hero at a spot, standing (tests only). */
function place(run: WindRun, x: number, y: number, z: number): void {
   Object.assign(run.hero, { x, y, z, vx: 0, vy: 0, vz: 0, grounded: true });
}

function frames(run: WindRun, n: number, input: StepInput = createStepInput(), ms = 1000 / 60): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, ms, input);
}

/** A tap of Action (press, then a release frame). */
function tap(run: WindRun): void {
   const i = createStepInput();
   i.actionPressed = true;
   i.actionHeld = true;
   step(run, 1000 / 60, i);
   step(run, 1000 / 60, createStepInput());
}

describe("the storm tunnel (rooms along -z)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: rooms chain forwards, every solution names a real fan, the exit is past the last room, all five heroes have a side route`, () => {
         const c = courseFor(id);
         expect(c.rooms.length).toBeGreaterThanOrEqual(id === 1 ? 4 : 5);
         for (let i = 1; i < c.rooms.length; i++) expect(c.rooms[i].z0).toBeCloseTo(c.rooms[i - 1].z1, 6);
         for (const r of c.rooms) for (const p of r.solution) expect(p.fan).toBeLessThan(c.fans.length);
         expect(c.goalNearZ).toBeLessThan(c.rooms[c.rooms.length - 2].z1);
         const gates = new Set(c.orbs.map((o) => o.bonus).filter((b) => b !== null));
         for (const h of ["riko", "nami", "kiro", "zuno", "vexa"]) expect(gates.has(h as never), h).toBe(true);
         expect(c.mainOrbs).toBeGreaterThanOrEqual(10);
         expect(c.secrets.length).toBe(SECRETS[id].length);
         expect(c.secrets.length).toBeLessThanOrEqual(3);
         expect(!!c.arena).toBe(LEVELS[id].boss);
      });
   }

   it("level 1 teaches in three beats: a vent already blowing, one fan to turn across a gap, then up and across", () => {
      const c = courseFor(1);
      const [r0, r1, r2] = c.rooms;
      expect(r0.setup).toBe(false);
      expect(c.fans.filter((f) => f.room === 0 && f.kind === "vent" && f.on && f.cover === undefined).length).toBe(1);
      expect(r1.solution.map((p) => c.fans[p.fan].kind)).toEqual(["fan"]);
      expect(r2.solution.map((p) => c.fans[p.fan].kind)).toEqual(["vent", "fan"]);
      // the storm wakes only in the last puzzle room (the card: a slow chase at the end)
      expect(LEVELS[1].storm.fromRoom).toBe(2);
   });

   it("every level twists the verb: crosswinds (2), fan lifts (3), rails, auto fans and drones (4), the Gale Engine (5)", () => {
      expect(courseFor(2).fans.some((f, i) => courseFor(2).rooms.some((r) => r.solution.some((p) => p.fan === i && p.notDir !== undefined)))).toBe(true);
      expect(courseFor(3).lifts.length).toBeGreaterThanOrEqual(2);
      const c4 = courseFor(4);
      expect(c4.fans.some((f) => f.rail)).toBe(true);
      expect(c4.fans.some((f) => f.autoMs === 3000)).toBe(true);
      expect(c4.drones.length).toBeGreaterThanOrEqual(2);
      const a = courseFor(5).arena!;
      expect(a.sideFans.length).toBe(3);
      expect(a.crateVents.length).toBe(3);
      expect(courseFor(5).crates.length).toBe(3);
   });

   it("the same level is the same course for every run", () => {
      const a = createRun(1, 2);
      const b = createRun(999, 2);
      expect(a.course).toBe(b.course);
   });
});

describe("redirect the wind", () => {
   it("a tap turns a fan 90° clockwise (n, e, s, w); its current is off while it turns; a hold switches it off and on", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const f = c.rooms[1].solution[0].fan;
      const fan = c.fans[f];
      expect(DIRS[fanDir(run, f)]).toBe("w");
      place(run, fan.x - 1.6, fan.y, fan.z + 1.6);
      tap(run);
      expect(DIRS[fanDir(run, f)]).toBe("n");
      expect(fanLive(run, f)).toBe(false);
      frames(run, Math.ceil(TURN_MS / 16));
      expect(fanLive(run, f)).toBe(true);
      tap(run);
      frames(run, 20);
      expect(DIRS[fanDir(run, f)]).toBe("e");
      // a hold switches it off (it does not turn)
      const hold = createStepInput();
      hold.actionPressed = true;
      hold.actionHeld = true;
      step(run, 1000 / 60, hold);
      hold.actionPressed = false;
      frames(run, Math.ceil(HOLD_MS / 16) + 2, hold);
      expect(run.world.on[f]).toBe(0);
      expect(DIRS[fanDir(run, f)]).toBe("e");
      frames(run, 2);
      expect(fanLive(run, f)).toBe(false);
   });

   it("a vent switches with a tap; a fixed vent cannot be switched (Action there is the power)", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const v = c.rooms[2].solution[0].fan;
      const vent = c.fans[v];
      place(run, vent.x + 2.1, vent.y, vent.z + 1);
      expect(run.world.on[v]).toBe(0);
      tap(run);
      expect(run.world.on[v]).toBe(1);
      const fixed = c.fans.findIndex((f) => f.room === 0 && f.kind === "vent");
      place(run, c.fans[fixed].x + 2, 0, c.fans[fixed].z);
      tap(run);
      expect(run.world.on[fixed]).toBe(1);
   });

   it("a current carries at V_JET along its direction, holds you at its axis and lets you steer only inside it", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const f = c.rooms[1].solution[0].fan;
      run.world.dir[f] = dirIndex("n");
      const fan = c.fans[f];
      place(run, fan.x, fan.y, fan.z - 1.1);
      const i = createStepInput();
      frames(run, 30, i);
      expect(run.hero.riding).toBeGreaterThan(0);
      expect(run.hero.vz).toBeCloseTo(-V_JET, 0);
      expect(run.hero.y + 0.65).toBeCloseTo(fan.y + HUB, 0);
      // steering hard to the side never takes you out sideways
      i.moveX = 1;
      frames(run, 40, i);
      expect(Math.abs(run.hero.x - fan.x)).toBeLessThanOrEqual(1.5);
   });

   it("a vent's up-current lifts you without a jump and holds you under its top", () => {
      const run = createRun(1, 1);
      const v = run.course.fans.findIndex((f) => f.room === 0 && f.kind === "vent");
      const vent = run.course.fans[v];
      place(run, vent.x, vent.y, vent.z);
      frames(run, 240);
      const top = vent.y + 0.5 + vent.length;
      expect(run.hero.y).toBeGreaterThan(top - 1.4);
      expect(run.hero.y).toBeLessThan(top);
      expect(run.hero.vy).toBeCloseTo(0, 0);
   });

   it("walls cut a current short of the wall; crossing currents add as vectors (level 2's corner curves you onto the island)", () => {
      const run = createRun(1, 2);
      const c = run.course;
      const corner = c.rooms.findIndex((r) => r.name === "Crossing currents");
      const [a, s] = c.rooms[corner].solution.map((p) => p.fan);
      run.world.dir[a] = dirIndex("n");
      run.world.dir[s] = dirIndex("w");
      run.world.on[s] = 1;
      const A = c.fans[a];
      const S = c.fans[s];
      // where the two cross: both carry
      const v = currentAt(run, A.x, A.y + HUB, S.z);
      expect(v.x).toBeCloseTo(-V_JET, 5);
      expect(v.z).toBeCloseTo(-V_JET, 5);
      // the side current ends 0.6 m before the left wall
      expect(currentAt(run, -6.5, S.y + HUB, S.z).x).toBe(0);
      expect(currentAt(run, -6.2, S.y + HUB, S.z).x).toBeLessThan(0);
   });

   it("lifts ride their vent: switch it on and the platform carries you up, switch it off and it comes down", () => {
      const run = createRun(1, 3);
      const c = run.course;
      const l = c.lifts[0];
      place(run, l.x, l.y0, l.z + 0.4);
      tap(run);
      expect(run.world.on[l.vent]).toBe(1);
      frames(run, Math.ceil(((l.y1 - l.y0) / 3) * 60) + 30);
      expect(run.world.liftY[0]).toBeCloseTo(l.y1, 5);
      expect(run.hero.y).toBeCloseTo(l.y1, 1);
   });
});

describe("the storm front", () => {
   it("waits while you are in an unsolved setup room, then follows; a hint shows the setup after 20 s", () => {
      const run = createRun(1, 2);
      frames(run, 5);
      expect(run.world.storm.active).toBe(true);
      const z0 = run.world.storm.z;
      frames(run, 60 * 5);
      expect(run.world.storm.z).toBe(z0);
      expect(run.hint).toBe(-1);
      frames(run, Math.ceil((HINT_MS / 1000) * 60));
      expect(run.hint).toBe(0);
   });

   it("inside it you lose a heart a second; out of hearts you go down and come back at the checkpoint with the storm pushed back", () => {
      const run = createRun(1, 1);
      run.world.storm.active = true;
      run.world.storm.z = -1;
      frames(run, 60 * 2.2);
      expect(run.stormTouched).toBe(true);
      expect(run.hero.hearts).toBeLessThan(HEARTS);
      frames(run, 60 * 2);
      frames(run, Math.ceil(((LOST_MS + SPAWN_MS) / 1000) * 60) + 4);
      expect(run.respawns).toBe(1);
      expect(run.hero.hearts).toBe(HEARTS);
      expect(run.world.storm.z).toBeGreaterThan(run.hero.z + 6);
   });
});

describe("falls and respawns", () => {
   it("a fall into a gap is lost, then you are back at the room's checkpoint; a respawn never moves you forwards", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const r = c.rooms[1];
      place(run, 0, r.floor, r.z0 - 3);
      frames(run, 10);
      expect(run.checkpoint).toBe(1);
      place(run, 0, r.floor + 0.2, r.z0 - 12);
      run.hero.grounded = false;
      frames(run, 120);
      expect(run.events.lost || run.hero.state !== "play" || run.respawns > 0).toBe(true);
      frames(run, 120);
      expect(run.respawns).toBe(1);
      expect(run.hero.z).toBeCloseTo(r.checkpoint.z, 5);
      expect(run.hero.z).toBeGreaterThanOrEqual(r.z0 - 12);
   });
});

describe("scoring hand-off", () => {
   it("finalScore: a win submits the finish minus 200 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      const stats = { [STAT.finishMs]: 30_000, [STAT.orbs]: 10, [STAT.comboMs]: 300 };
      expect(finalScore({ score: 0, endReason: "win", stats, elapsedMs: 31_000 }).durationMs).toBe(30_000 - 10 * ORB.bonusMs - 300);
      expect(finalScore({ score: 0, endReason: "timeup", stats, elapsedMs: 120_000 }).durationMs).toBe(120_000);
   });
});

describe("the lower bound (README 'Server limits')", () => {
   it("the z floor is the distance to the exit over V_ZMAX, less one substep", () => {
      const c = courseFor(1);
      expect(minFinishMs(c)).toBeCloseTo(((c.startZ - c.goalNearZ) * 1000) / V_ZMAX - STEP_MS, 6);
   });

   it("level 5 adds the Gale Engine's least done time (every window hit at once) between the arena entry and its gate", () => {
      const c = courseFor(5);
      const s = boundSegments(c);
      expect(s.boss).toBe(bossMinMs());
      expect(s.boss).toBeGreaterThan(20_000);
      expect(minFinishMs(c)).toBeCloseTo(zFloorMs(s.before) + s.boss + zFloorMs(s.after), 6);
      expect(s.before + s.after).toBeLessThan(c.startZ - c.goalNearZ);
   });

   it("the least duration takes off every orb and the most flow bonus", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBeCloseTo(minFinishMs(c) - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c)), 6);
      }
   });

   it("the dash floor: POWER_MS.dash + a substep at V_DASH where the floor counted V_ZMAX, one dash per cooldown and the first", () => {
      const c = courseFor(1);
      const per = ((POWER_MS.dash + STEP_MS) * (V_DASH - V_ZMAX)) / V_ZMAX;
      const F = zFloorMs(c.startZ - c.goalNearZ);
      const T = dashFloorMs(c) + c.orbs.length * ORB.bonusMs + comboMaxBonus(comboSpecOf(c));
      expect(T + per * (1 + Math.floor(T / heroById("riko").cooldownMs))).toBeGreaterThanOrEqual(F);
      expect(T).toBeLessThan(F);
   });

   it("every level's minDurationMs sits in 88-100 % of its bound and under the dash floor; the limits are pinned", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const lb = minDurationMsOf(c);
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeLessThanOrEqual(dashFloorMs(c));
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.88);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(lim.maxDurationMs).toBe(LEVELS[id].durationMs);
      }
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
      expect(windTunnelEscapeMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      for (const id of LEVEL_IDS) expect(windTunnelEscapeMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
   });

   it("every level is worth at least level 1's points, and level 5 at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });
});

/** minDurationMs, maxDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [8100, 120000, 120000, 11190],
   [13000, 150000, 150000, 13700],
   [12700, 180000, 180000, 16730],
   [16200, 210000, 210000, 19380],
   [40500, 300000, 300000, 25950],
];

describe("the z guard (the proof's one rule)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: 24 s of random input (every hero) never moves the hero further towards -z in a substep than V_ZMAX (V_DASH in a dash)`, () => {
         for (let k = 0; k < 5; k++) {
            const rng = createRng(id * 31 + k);
            const run = createRun(k, id, HEROES[k].id);
            const input = createStepInput();
            let prev = run.hero.z;
            for (let s = 0; s < 12_000 && run.ended === null; s++) {
               if (s % 40 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1.4;
               }
               input.jumpPressed = rng() < 0.02;
               input.jumpHeld = rng() < 0.5;
               input.actionPressed = rng() < 0.01;
               input.actionHeld = input.actionPressed || (input.actionHeld && rng() < 0.97);
               step(run, STEP_MS, input);
               const dash = run.ms <= run.hero.dashUntil + STEP_MS;
               const cap = ((dash ? V_DASH : V_ZMAX) * STEP_MS) / 1000 + 1e-9;
               if (run.hero.state === "play") expect(prev - run.hero.z).toBeLessThanOrEqual(cap);
               prev = run.hero.z;
            }
         }
      }, 60_000);
   }
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot (Nami) reaches the exit at 30, 60 and 144 fps with every main orb, never under the floor, at least 80 % of maxScore`, () => {
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
            expect(run.mainOrbs, `${fps} fps every main orb`).toBe(run.course.mainOrbs);
         }
      }, 60_000);
   }

   it("idle never wins: the clock ends it unranked", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1800 });
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
      expect(store.getState().endReason).toBe("timeup");
      expect(isRankedRun(windTunnelEscapeMeta.scoring, store.getState().endReason)).toBe(false);
   });

   it("60 spam runs on level 1 (random stick, Jump and Action mashed and held, random frame times, any hero) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      for (let seed = 1; seed <= 60; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1, HEROES[seed % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 2500 && run.ended === null; f++) {
            if (f % 10 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = -rng();
               input.jumpHeld = rng() < 0.6;
            }
            input.jumpPressed = rng() < 0.4;
            input.actionPressed = rng() < 0.2;
            input.actionHeld = input.actionPressed || rng() < 0.3;
            step(run, 4 + rng() * 46, input);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   }, 60_000);

   it("the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1800 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5, 1);
      const bot = createBot(run);
      const input = createStepInput();
      const rng = createRng(11);
      for (let f = 0; f < 50_000 && store.getState().phase !== "over"; f++) {
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
      const rules = windTunnelEscapeMeta.scoring;
      const sent = normalizeRun({ slug: "wind-tunnel-escape", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});

describe("camera-relative stick and solid boxes (for menu2/camera)", () => {
   it("yaw 0 is the world direction itself; a turned camera turns the stick", () => {
      const a = createRun(1, 1);
      const b = createRun(1, 1);
      const i = createStepInput();
      i.moveZ = -1;
      frames(a, 30, i);
      expect(a.hero.z).toBeLessThan(a.course.start.z - 1);
      i.yaw = Math.PI / 2;
      frames(b, 30, i);
      expect(Math.abs(b.hero.x - b.course.start.x)).toBeGreaterThan(1);
      expect(Math.abs(b.hero.z - b.course.start.z)).toBeLessThan(0.2);
   });

   it("solidBoxes lists the blocks and lifts (a broken cover and an open gate left out)", () => {
      const run = createRun(1, 1);
      const out: ReturnType<typeof Array.prototype.slice> = [];
      const n = solidBoxes(run, out as never);
      expect(n).toBeGreaterThan(20);
      const cover = run.course.blocks.findIndex((b) => b.kind === "cover");
      run.world.broken[cover] = 1;
      expect(solidBoxes(run, out as never)).toBe(n - 1);
      expect(roomAt(run.course, run.course.start.z)).toBe(0);
   });
});
