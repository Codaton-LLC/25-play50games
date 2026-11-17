// Ultimate Color Trial rules: the sections (pads, rings, switches and doors, beams, the survival
// round, the energy core), the hero routes, the Chroma Sentinel, the server-limit proof (README
// "Score limits"): the per-ms travel cap and the dash budget the proof rests on, the survival waits,
// the pinned limits, and the honest, idle and spam bots.
import { describe, expect, it } from "vitest";
import { isRankedRun } from "@/arcade3d/core/scores";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { ultimateColorTrialMeta } from "./meta";
import { LEVELS } from "./levels";
import { DASH_BOOST, HEROES, type HeroId } from "./heroes";
import { botInput, botRun, createBot } from "./bot";
import { BEAM_CLEAR, CORE_R, FINISH_R, GATE_T, HERO_R, MAGNET_CORE_R, blobAt, laserZ, type Course } from "./course";
import { SENTINEL } from "./progression";
import {
   ARENA_IN,
   BEACON_WAKE_R,
   ORB_BONUS_MS,
   PROPOSED_LEVEL_LIMITS,
   STAT,
   V_RUN,
   boostBudgetMetres,
   bossMinMs,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   currentSection,
   exitShut,
   finalScore,
   minDurationMsOf,
   minFinishMs,
   proposeLimits,
   runTimeMs,
   step,
   surviveTotalMs,
   travelMetres,
   type StepInput,
   type TrialRun,
} from "./rules";

const submitted = (run: TrialRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function hold(run: TrialRun, ms: number, input: StepInput, frame = 16): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(frame, left);
      step(run, d, input);
      input.jumpPressed = false;
      input.actionPressed = false;
      left -= d;
   }
}

function teleport(run: TrialRun, x: number, y: number, z: number): void {
   run.hero.x = x;
   run.hero.y = y;
   run.hero.z = z;
   run.hero.vx = run.hero.vy = run.hero.vz = 0;
   run.hero.grounded = true;
}

const go = (dx: number, dz: number): StepInput => {
   const m = Math.hypot(dx, dz) || 1;
   return { ...createStepInput(), moveX: dx / m, moveZ: dz / m };
};

const secOf = (c: Course, kind: string) => c.sections.find((s) => s.kind === kind)!;

/** Completes every section before `upTo` by hand (the rules' own state), so a test can stand in it. */
function clearUpTo(run: TrialRun, upTo: number): void {
   const c = run.course;
   for (let i = 0; i < upTo; i++) {
      run.secDone[i] = 1;
      run.secEntered[i] = 1;
      if (c.sections[i].kind === "rings") run.ringNext[i] = c.sections[i].ringCount;
      if (c.sections[i].kind === "gates") run.rowNext[i] = c.sections[i].rowCount;
      if (c.sections[i].kind === "core") run.coreState[i] = 2;
   }
   run.checkpoint = upTo - 1;
}

describe("the sections", () => {
   it("a jump section counts as done once its far end is reached on the ground; a gated exit holds the hero until its goal is met", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const jump = secOf(c, "jump");
      teleport(run, 0, 0, jump.z1 + 0.5);
      hold(run, 100, createStepInput());
      expect(run.secDone[jump.index]).toBe(1);
      expect(run.events.sectionDone === jump.index || run.secDone[jump.index] === 1).toBe(true);
      const rings = secOf(c, "rings");
      expect(exitShut(run, rings.index)).toBe(true);
      teleport(run, 0, 0, rings.z1 - 2);
      hold(run, 1200, go(0, 1));
      expect(run.hero.z).toBeLessThanOrEqual(rings.z1 - GATE_T - HERO_R + 1e-6);
      run.secDone[rings.index] = 1;
      hold(run, 600, go(0, 1));
      expect(run.hero.z).toBeGreaterThan(rings.z1 + 0.5);
   });

   it("rings count in order only: a crossing through the lit hoop advances, out of order does nothing; a high ring wants a jump", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const sec = secOf(c, "rings");
      clearUpTo(run, sec.index);
      const r0 = c.rings.find((r) => r.section === sec.index && r.order === 0)!;
      const r1 = c.rings.find((r) => r.section === sec.index && r.order === 1)!;
      // out of order: ring 1 first
      teleport(run, r1.x, 0, r1.z - 2.5);
      hold(run, 900, go(0, 1));
      expect(run.ringNext[sec.index]).toBe(0);
      expect(run.hero.z).toBeGreaterThan(r1.z);
      teleport(run, r0.x, 0, r0.z - 2.5);
      hold(run, 900, go(0, 1));
      expect(run.ringNext[sec.index]).toBe(1);
      // beside the hoop: nothing
      const r2 = c.rings.find((r) => r.section === sec.index && r.order === 1)!;
      teleport(run, r2.x + 2.5, 0, r2.z - 2.5);
      hold(run, 900, go(0, 1));
      expect(run.ringNext[sec.index]).toBe(1);
      // a high ring (level 2): walking under it does nothing, a jump through it counts
      const r2run = createRun(1, 2);
      const hs = secOf(r2run.course, "rings");
      clearUpTo(r2run, hs.index);
      const high = r2run.course.rings.find((r) => r.section === hs.index && r.y > 2)!;
      r2run.ringNext[hs.index] = high.order;
      teleport(r2run, high.x, 0, high.z - 3);
      hold(r2run, 900, go(0, 1));
      expect(r2run.ringNext[hs.index]).toBe(high.order);
      // a run-up, then the jump 3 m short of the hoop (standing starts fall short: the bot runs up too)
      teleport(r2run, high.x, 0, high.z - 10);
      const j = go(0, 1);
      let jumped = false;
      for (let f = 0; f < 120 && r2run.ringNext[hs.index] === high.order; f++) {
         j.jumpPressed = !jumped && high.z - r2run.hero.z <= 3.0;
         if (j.jumpPressed) jumped = true;
         step(r2run, 16, j);
      }
      expect(r2run.ringNext[hs.index]).toBe(high.order + 1);
   });

   it("a switch charges the hero with its colour; only that colour's door lets it through; the last row completes the section", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const sec = secOf(c, "gates");
      clearUpTo(run, sec.index);
      const row = c.rows.find((r) => r.section === sec.index && r.order === 0)!;
      const door = row.doors[1];
      const other = row.doors.find((d) => d.color !== door.color)!;
      const wrongSwitch = c.switches.find((w) => w.section === sec.index && w.color === other.color && w.z < row.z)!;
      teleport(run, wrongSwitch.x, 0, wrongSwitch.z);
      hold(run, 100, createStepInput());
      expect(run.charge).toBe(other.color);
      // the wrong door holds
      teleport(run, (door.x0 + door.x1) / 2, 0, row.z - 2.5);
      hold(run, 1000, go(0, 1));
      expect(run.hero.z).toBeLessThan(row.z);
      expect(run.rowNext[sec.index]).toBe(0);
      // the right switch, the right door
      const rightSwitch = c.switches.find((w) => w.section === sec.index && w.color === door.color && w.z < row.z)!;
      teleport(run, rightSwitch.x, 0, rightSwitch.z);
      hold(run, 100, createStepInput());
      expect(run.charge).toBe(door.color);
      teleport(run, (door.x0 + door.x1) / 2, 0, row.z - 2.5);
      hold(run, 1000, go(0, 1));
      expect(run.hero.z).toBeGreaterThan(row.z);
      expect(run.rowNext[sec.index]).toBe(1);
      expect(run.secDone[sec.index]).toBe(sec.rowCount === 1 ? 1 : 0);
   });

   it("a laser beam knocks a hero on the floor and passes under one in the air", () => {
      const run = createRun(1, 2);
      const c = run.course;
      const sec = secOf(c, "runner");
      clearUpTo(run, sec.index);
      const l = c.lasers.find((q) => q.section === sec.index)!;
      const bz = laserZ(l, run.simMs + 1);
      teleport(run, 0, 0, bz);
      step(run, 1, createStepInput());
      expect(run.strikes).toBe(1);
      expect(run.events.laserHit).toBe(true);
      const air = createRun(1, 2);
      clearUpTo(air, sec.index);
      air.hero.x = 0;
      air.hero.z = laserZ(l, air.simMs + 1);
      air.hero.y = BEAM_CLEAR + 0.3;
      air.hero.grounded = false;
      air.hero.vy = 0;
      step(air, 1, createStepInput());
      expect(air.strikes).toBe(0);
   });

   it("a survival round starts as the hero steps in and its exit opens surviveMs later, not before", () => {
      const run = createRun(1, 3);
      const c = run.course;
      const sec = secOf(c, "survive");
      clearUpTo(run, sec.index);
      teleport(run, 4.6, 0, sec.z0 + ARENA_IN + 0.3);
      hold(run, 50, createStepInput());
      expect(run.surviveStart[sec.index]).toBeGreaterThan(0);
      expect(exitShut(run, sec.index)).toBe(true);
      const start = run.surviveStart[sec.index];
      hold(run, sec.surviveMs - 200, createStepInput());
      expect(run.secDone[sec.index]).toBe(0);
      hold(run, 300, createStepInput());
      expect(run.secDone[sec.index]).toBe(1);
      expect(run.simMs).toBeGreaterThanOrEqual(start + sec.surviveMs);
   });

   it("a rolling orb knocks (never Kiro behind his shield) and makes you drop the core you carry", () => {
      for (const hero of ["vexa", "kiro"] as const) {
         const run = createRun(1, 3, hero);
         const c = run.course;
         const sec = secOf(c, "core");
         clearUpTo(run, sec.index);
         teleport(run, run.coreX[sec.index], 0, run.coreZ[sec.index]);
         const p = createStepInput();
         p.actionPressed = hero === "kiro";
         hold(run, 50, p);
         expect(run.coreState[sec.index]).toBe(1);
         const b = c.blobs.find((q) => q.section === sec.index)!;
         const at = blobAt(b, run.simMs + 1, { x: 0, z: 0 });
         teleport(run, at.x, 0, at.z);
         step(run, 1, createStepInput());
         if (hero === "kiro") {
            expect(run.strikes).toBe(0);
            expect(run.coreState[sec.index]).toBe(1);
         } else {
            expect(run.strikes).toBe(1);
            expect(run.coreState[sec.index]).toBe(0);
            expect(run.events.coreDropped).toBe(sec.index);
         }
      }
   });

   it("the energy core: picked up by touch (Zuno's magnet pulls it from 5 m, once per activation), delivered at the receptor, which completes the section", () => {
      const run = createRun(1, 3);
      const c = run.course;
      const sec = secOf(c, "core");
      clearUpTo(run, sec.index);
      teleport(run, run.coreX[sec.index] + CORE_R + 1, 0, run.coreZ[sec.index]);
      hold(run, 100, createStepInput());
      expect(run.coreState[sec.index]).toBe(0);
      teleport(run, run.coreX[sec.index], 0, run.coreZ[sec.index]);
      hold(run, 50, createStepInput());
      expect(run.coreState[sec.index]).toBe(1);
      teleport(run, sec.receptor!.x, 0, sec.receptor!.z);
      hold(run, 50, createStepInput());
      expect(run.coreState[sec.index]).toBe(2);
      expect(run.secDone[sec.index]).toBe(1);
      const zuno = createRun(1, 3, "zuno");
      clearUpTo(zuno, sec.index);
      teleport(zuno, zuno.coreX[sec.index] + MAGNET_CORE_R - 0.5, 0, zuno.coreZ[sec.index]);
      const p = createStepInput();
      p.actionPressed = true;
      hold(zuno, 100, p);
      expect(zuno.coreState[sec.index]).toBe(1);
      expect(zuno.hero.magnetPull).toBe(false);
   });
});

describe("hero routes", () => {
   /** Walks from the corridor straight at a nook's barrier for 1.5 s: did the hero ever stand on the nook behind it? */
   function tryNook(run: TrialRun, kind: "wall" | "gate", power: boolean): boolean {
      const c = run.course;
      const n = c.nooks.find((q) => q.kind === kind)!;
      teleport(run, n.disc.x - 2.6, 0, n.disc.z);
      const p = go(1, 0);
      p.actionPressed = power;
      let reached = false;
      for (let f = 0; f < 94 && run.hero.lostUntil < 0; f++) {
         step(run, 16, p);
         p.actionPressed = false;
         if (run.hero.grounded && run.hero.x > n.disc.x + n.disc.r) reached = true;
      }
      return reached;
   }

   it("the crystal wall stops everyone but a dashing Riko; the void gate stops everyone but a phasing Vexa", () => {
      const riko = createRun(1, 1, "riko");
      expect(tryNook(riko, "wall", true)).toBe(true);
      expect(riko.wallBroken[riko.course.nooks.findIndex((n) => n.kind === "wall")]).toBe(1);
      expect(tryNook(createRun(1, 1, "zuno"), "wall", true)).toBe(false);
      expect(tryNook(createRun(1, 1, "vexa"), "gate", true)).toBe(true);
      expect(tryNook(createRun(1, 1, "zuno"), "gate", true)).toBe(false);
   });

   it("the sky ledge: Nami's second jump reaches it, a plain jump does not", () => {
      const c = courseFor(1);
      const ledge = c.ledge;
      for (const hero of ["zuno", "nami"] as const) {
         const run = createRun(1, 1, hero);
         teleport(run, 0, 0, c.startZ);
         const p = createStepInput();
         p.jumpPressed = true;
         step(run, 16, p);
         let peak = 0;
         for (let f = 0; f < 60; f++) {
            const inp = createStepInput();
            inp.jumpPressed = hero === "nami" && f === 26;
            step(run, 16, inp);
            peak = Math.max(peak, run.hero.y);
         }
         if (hero === "nami") expect(peak).toBeGreaterThanOrEqual(ledge.y);
         else expect(peak).toBeLessThan(ledge.y - 0.5);
      }
   });

   it("a fall into the void respawns at the section's start line (a jump section: on the floor before it)", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const jump = secOf(c, "jump");
      teleport(run, 0, 0, jump.z0 - 0.5);
      hold(run, 60, createStepInput());
      expect(run.checkpoint).toBe(-1);
      run.hero.x = 0;
      run.hero.z = jump.z0 + 1.5;
      run.hero.grounded = false;
      hold(run, 2500, createStepInput());
      expect(run.falls).toBe(1);
      expect([c.startZ, c.checkpoints[jump.index].z]).toContain(run.hero.z);
      const rings = secOf(c, "rings");
      teleport(run, 0, 0, rings.z0 + 2);
      hold(run, 60, createStepInput());
      expect(run.checkpoint).toBe(rings.index);
      run.hero.y = -7;
      hold(run, 2000, createStepInput());
      expect(run.hero.z).toBeCloseTo(c.checkpoints[rings.index].z, 6);
      expect(run.hero.y).toBe(0);
   });
});

describe("the Chroma Sentinel (level 5)", () => {
   it("the boss config is valid and his least defeat time is his windows back to back", () => {
      expect(bossProblems(SENTINEL)).toEqual([]);
      const p = SENTINEL.phases;
      const least = SENTINEL.introMs + 2 * (p[0].attacks[0].telegraphMs + p[0].attacks[0].attackMs) + SENTINEL.transitionMs + 2 * (p[1].attacks[0].telegraphMs + p[1].attacks[0].attackMs) + SENTINEL.transitionMs + 2 * (p[2].attacks[0].telegraphMs + p[2].attacks[0].attackMs);
      expect(bossMinMs()).toBe(least);
   });

   it("he wakes at his beacon once every section is done; in Gates only the asked colour through its door touches him", () => {
      const run = createRun(1, 5);
      const c = run.course;
      const bs = c.bossSpec!;
      const arena = c.sections[c.sections.length - 1];
      teleport(run, bs.beacon.x, 0, bs.beacon.z);
      hold(run, 100, createStepInput());
      expect(run.bossAwake).toBe(false);
      clearUpTo(run, arena.index);
      teleport(run, bs.beacon.x, 0, bs.beacon.z);
      hold(run, 100, createStepInput());
      expect(run.bossAwake).toBe(true);
      hold(run, SENTINEL.introMs + SENTINEL.phases[0].attacks[0].telegraphMs + SENTINEL.phases[0].attacks[0].attackMs + 50, createStepInput());
      expect(run.boss!.step).toBe("vulnerable");
      expect(run.bossColor).toBeGreaterThanOrEqual(0);
      // the wrong colour: his door holds
      const row = c.rows.find((r) => r.section === arena.index)!;
      const askedDoor = row.doors.find((d) => d.color === run.bossColor)!;
      const otherDoor = row.doors.find((d) => d.color !== run.bossColor)!;
      run.charge = otherDoor.color;
      teleport(run, (askedDoor.x0 + askedDoor.x1) / 2, 0, row.z - 2.5);
      hold(run, 1000, go(0, 1));
      expect(run.hero.z).toBeLessThan(row.z);
      expect(run.boss!.hp).toBe(SENTINEL.maxHp);
      // the asked colour: through its door, to him: a hit
      run.charge = run.bossColor;
      teleport(run, (askedDoor.x0 + askedDoor.x1) / 2, 0, row.z - 2.5);
      hold(run, 1000, go(0, 1));
      expect(run.hero.z).toBeGreaterThan(row.z);
      teleport(run, bs.x, 0, bs.z - 1.5);
      hold(run, 50, createStepInput());
      expect(run.boss!.hp).toBe(SENTINEL.maxHp - 1);
   });

   it("the honest bot beats all three phases at 30, 60 and 144 fps, never under the floor", () => {
      for (const fps of [30, 60, 144]) {
         const run = botRun(5, fps);
         expect(run.ended, `${fps}`).toBe("win");
         expect(run.boss!.hp).toBe(0);
         expect(run.finishMs).toBeGreaterThanOrEqual(bossMinMs());
         expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[5].minDurationMs);
      }
   }, 120_000);
});

describe("the lower bound (README 'Score limits')", () => {
   it("the proof's invariant: per ms, never more than V_RUN / 1000 m plus an active dash, and the dash metres stay in the budget", () => {
      for (const level of LEVEL_IDS) {
         for (let seed = 1; seed <= 3; seed++) {
            const rng = createRng(seed * 7 + level);
            const run = createRun(seed, level, HEROES[(seed + level) % 5].id);
            const inp = createStepInput();
            for (let ms = 0; ms < 25_000 && run.ended === null; ms++) {
               if (ms % 200 === 0) {
                  inp.moveX = rng() * 2 - 1;
                  inp.moveZ = rng() * 2 - 0.6;
                  inp.yaw = rng() * 6.3;
               }
               inp.jumpPressed = rng() < 0.01;
               inp.actionPressed = rng() < 0.005;
               const x = run.hero.x;
               const z = run.hero.z;
               const lost = run.hero.lostUntil >= 0;
               step(run, 1, inp);
               if (lost || run.events.respawned) continue;
               expect(Math.hypot(run.hero.x - x, run.hero.z - z)).toBeLessThanOrEqual((V_RUN + DASH_BOOST) / 1000 + 1e-9);
               expect(run.extraMetres).toBeLessThanOrEqual(boostBudgetMetres(run.course) + 1e-6);
            }
         }
      }
   }, 60_000);

   it("the waits are real: in honest runs a survival exit opens no sooner than surviveMs after the start line, and the Sentinel wakes only at his beacon with every section done", () => {
      for (const level of LEVEL_IDS) {
         const run = createRun(2, level, "riko");
         const bot = createBot(run, 1000 / 60);
         const input = createStepInput();
         const c = run.course;
         for (let f = 0; f < 20_000 && run.ended === null; f++) {
            botInput(bot, run, input);
            const ev = step(run, 1000 / 60, input);
            if (ev.sectionDone >= 0 && c.sections[ev.sectionDone].kind === "survive") {
               const s = c.sections[ev.sectionDone];
               expect(run.surviveStart[s.index]).toBeGreaterThan(0);
               expect(run.simMs).toBeGreaterThanOrEqual(run.surviveStart[s.index] + s.surviveMs);
            }
            if (ev.bossWake) {
               const bs = c.bossSpec!;
               expect(Math.hypot(run.hero.x - bs.beacon.x, run.hero.z - bs.beacon.z)).toBeLessThanOrEqual(BEACON_WAKE_R + (V_RUN + DASH_BOOST) * 0.0167);
               for (let i = 0; i < c.sections.length - 1; i++) expect(run.secDone[i]).toBe(1);
            }
            if (ev.finished && !c.boss) {
               expect(currentSection(run)).toBe(c.sections.length);
               expect(Math.hypot(run.hero.x - c.finish.x, run.hero.z - c.finish.z)).toBeLessThanOrEqual(FINISH_R + 0.2);
            }
         }
         expect(run.ended).toBe("win");
      }
   }, 240_000);

   it("the least duration is the corridor at V_RUN less the dash budget and the arenas' insides, plus every survival wait (level 5 plus the Sentinel), less every gem and the most flow bonus", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const travel = (Math.max(0, travelMetres(c) - boostBudgetMetres(c)) / V_RUN) * 1000;
         expect(minFinishMs(c)).toBeCloseTo(travel + surviveTotalMs(c) + (c.boss ? bossMinMs() : 0), 6);
         expect(minDurationMsOf(c)).toBeCloseTo(minFinishMs(c) - c.gems.length * ORB_BONUS_MS - comboMaxBonus(comboSpecOf(c)), 6);
         let waits = 0;
         for (const s of c.sections) waits += s.surviveMs;
         expect(surviveTotalMs(c)).toBe(waits);
         const goal = c.boss ? c.bossSpec!.beacon.z - BEACON_WAKE_R : c.finish.z - FINISH_R;
         expect(travelMetres(c)).toBeLessThanOrEqual(goal - c.startZ + 1e-9);
      }
   });

   it("every level's minDurationMs is 95 % of its bound (floored to 100 ms); the limits are pinned and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const lb = minDurationMsOf(courseFor(id));
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id, courseFor(id)));
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.95 - 100);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].timerMs);
         expect(ultimateColorTrialMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(ultimateColorTrialMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });

   it("finalScore submits the finish ms less the gem and flow bonus on a win, the elapsed time otherwise", () => {
      const stats = { [STAT.finishMs]: 40_000, [STAT.orbs]: 10, [STAT.comboMs]: 500 };
      expect(finalScore({ score: 0, endReason: "win", stats, elapsedMs: 41_000 })).toEqual({ score: 0, durationMs: 40_000 - 10 * ORB_BONUS_MS - 500 });
      expect(finalScore({ score: 0, endReason: "timeup", stats, elapsedMs: 90_000 })).toEqual({ score: 0, durationMs: 90_000 });
   });
});

/** minDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [6700, 100000, 9330],
   [13000, 120000, 10700],
   [21200, 150000, 12880],
   [31000, 180000, 14900],
   [50800, 240000, 18920],
];

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot wins at 30, 60 and 144 fps, inside the limits`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of [30, 60, 144]) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
         }
      }, 120_000);
   }

   it("idle never wins: the level's timer runs out ('timeup', unranked)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 10_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("timeup");
      }
      expect(isRankedRun(ultimateColorTrialMeta.scoring, "timeup")).toBe(false);
   });

   it("200 spam runs on level 1 (random stick, jump and power, random frame times, any hero) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      for (let seed = 1; seed <= 200; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1, HEROES[seed % 5].id as HeroId);
         const inp = createStepInput();
         for (let f = 0; f < 4000 && run.ended === null; f++) {
            if (f % 10 === 0) {
               inp.moveX = rng() * 2 - 1;
               inp.moveZ = rng() * 2 - 1;
            }
            inp.jumpPressed = rng() < 0.3;
            inp.actionPressed = rng() < 0.2;
            step(run, 4 + rng() * 46, inp);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   }, 120_000);
});

describe("course queries", () => {
   it("a level id is read: every course is its own", () => {
      const ids = new Set(LEVEL_IDS.map((id) => courseFor(id).sections.length + ":" + courseFor(id).name));
      expect(ids.size).toBe(5);
      expect(LEVEL_IDS.map((id) => courseFor(id).id as LevelId)).toEqual([1, 2, 3, 4, 5]);
   });
});
