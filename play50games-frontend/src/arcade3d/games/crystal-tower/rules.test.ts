// Crystal Tower rules: the memory climb (the beacon's show, the ring, the crystals in order, the
// wrong-crystal shove, the next beacon), the hero routes, the hazards, Prism Shade, the server-limit
// proof (README "Score limits"): the per-ms travel cap and the dash budget the proof rests on, the
// serial shows, the pinned limits, and the honest, idle and spam bots.
import { describe, expect, it } from "vitest";
import { isRankedRun } from "@/arcade3d/core/scores";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { crystalTowerMeta } from "./meta";
import { LEVELS, LEDGE_LIFT } from "./levels";
import { DASH_BOOST, HEROES, type HeroId } from "./heroes";
import { botInput, botRun, createBot } from "./bot";
import { BEACON_R, CRUMBLE_MS, CRYSTAL_LIFT, FALL_DROP, GONE_MS, MAGNET_CRYSTAL_R, RING, SHOW_STEP_MS, STORM_PERIOD, crystalAt, droneAt, padCenterAt, showMs, stormIn, type Crystal } from "./tower";
import { PRISM } from "./progression";
import {
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
   expectedColor,
   finalScore,
   minDurationMsOf,
   minFinishMs,
   padAvailable,
   proposeLimits,
   runTimeMs,
   showTotalMs,
   step,
   tierLive,
   travelMetres,
   type StepInput,
   type TowerRun,
} from "./rules";

const submitted = (run: TowerRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function hold(run: TowerRun, ms: number, input: StepInput, frame = 16): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(frame, left);
      step(run, d, input);
      input.jumpPressed = false;
      input.actionPressed = false;
      left -= d;
   }
}

function teleport(run: TowerRun, x: number, y: number, z: number): void {
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

/** Stands in tier t's ring and waits the show out. */
function showTier(run: TowerRun, t: number): void {
   const b = run.course.tiers[t].beacon;
   teleport(run, b.x, b.y, b.z);
   hold(run, showMs(run.course.tiers[t].seqLen) + 40, createStepInput());
}

/** The tier's crystal of this colour. */
function crystalOf(run: TowerRun, t: number, color: number): Crystal {
   const tier = run.course.tiers[t];
   for (let k = 0; k < tier.count; k++) if (run.course.crystals[tier.first + k].color === color) return run.course.crystals[tier.first + k];
   throw new Error("no crystal");
}

const pos = { x: 0, y: 0, z: 0 };

/** Walks from the crystal's pad centre to the crystal and stands under it until it counts (a visit), at most maxMs. */
function touch(run: TowerRun, cr: Crystal, maxMs = 5000): void {
   const pad = run.course.pads.find((p) => Math.abs(p.y - cr.y) < 0.1 && Math.hypot(p.x - cr.x, p.z - cr.z) <= p.r + 0.4 && p.route)!;
   padCenterAt(pad, run.simMs, pos);
   teleport(run, pos.x, pad.y, pos.z);
   const ts = run.tiers[cr.tier];
   const p0 = ts.progress;
   const w0 = run.wrongs;
   const inp = createStepInput();
   let left = maxMs;
   while (left > 0 && ts.progress === p0 && run.wrongs === w0 && !ts.done && run.ended === null) {
      const dx = cr.x - run.hero.x;
      const dz = cr.z - run.hero.z;
      const d = Math.hypot(dx, dz) || 1;
      const k = Math.min(1, d / 0.5);
      inp.moveX = (dx / d) * k;
      inp.moveZ = (dz / d) * k;
      step(run, 16, inp);
      left -= 16;
   }
}

describe("the beacon's show", () => {
   it("starts as the hero enters the armed ring, flashes a colour every SHOW_STEP_MS and ends after showMs with the crystals live", () => {
      const run = createRun(1, 1);
      const b = run.course.tiers[0].beacon;
      teleport(run, b.x + BEACON_R + 0.5, b.y, b.z);
      const ts = run.tiers[0];
      expect(ts.showStart).toBe(-1);
      hold(run, 200, go(-1, 0));
      expect(ts.showStart).toBeGreaterThan(0);
      expect(run.checkpoint).toBe(0);
      // a fresh run, standing on the beacon: the colours, in order, one per step
      const r2 = createRun(1, 1);
      teleport(r2, b.x, b.y, b.z);
      const seen: number[] = [];
      const steps: number[] = [];
      const none = createStepInput();
      let done = -1;
      for (let f = 0; f < showMs(3) + 20 && !r2.tiers[0].shown; f++) {
         step(r2, 1, none);
         if (r2.events.showStep >= 0) {
            seen.push(r2.events.showColor);
            steps.push(r2.simMs);
         }
         if (r2.events.showDone === 0) done = r2.simMs;
      }
      expect(seen).toEqual(Array.from(r2.tiers[0].seq.slice(0, 3)));
      expect(steps[1] - steps[0]).toBe(SHOW_STEP_MS);
      expect(steps[2] - steps[1]).toBe(SHOW_STEP_MS);
      expect(done - steps[0]).toBe(showMs(3));
      expect(r2.tiers[0].shown).toBe(true);
      expect(tierLive(r2, 0)).toBe(true);
      expect(expectedColor(r2)).toBe(r2.tiers[0].seq[0]);
   });

   it("is cancelled when the hero leaves the ring, and a repeat needs a fresh entry", () => {
      const run = createRun(1, 1);
      const b = run.course.tiers[0].beacon;
      teleport(run, b.x, b.y, b.z);
      hold(run, 300, createStepInput());
      expect(run.tiers[0].showStart).toBeGreaterThanOrEqual(0);
      // walk out (over 2 m): cancelled, not shown
      hold(run, 700, go(b.x, b.z));
      expect(run.tiers[0].showStart).toBe(-1);
      expect(run.tiers[0].shown).toBe(false);
      // back in: it starts again and runs to the end while we stand still
      showTier(run, 0);
      expect(run.tiers[0].shown).toBe(true);
      // standing in the ring with the sequence untouched does not restart it
      hold(run, 2000, createStepInput());
      expect(run.tiers[0].showStart).toBe(-1);
      // step out and back in: a repeat
      hold(run, 700, go(b.x, b.z));
      teleport(run, b.x, b.y, b.z);
      hold(run, 50, createStepInput());
      expect(run.tiers[0].showStart).toBeGreaterThanOrEqual(0);
   });

   it("crystals are inert before the show and on tiers not yet armed", () => {
      const run = createRun(1, 1);
      const cr = crystalOf(run, 0, run.tiers[0].seq[1]);
      touch(run, cr);
      expect(run.tiers[0].progress).toBe(0);
      expect(run.wrongs).toBe(0);
      const up = crystalOf(run, 1, run.tiers[1].seq[0]);
      touch(run, up);
      expect(run.tiers[1].progress).toBe(0);
      expect(run.wrongs).toBe(0);
   });
});

describe("the crystals", () => {
   it("right crystals in order complete the round, arm the next beacon and move the checkpoint; the summit waits for the last", () => {
      const run = createRun(1, 1);
      const c = run.course;
      // the summit does nothing yet
      teleport(run, c.summit.x, c.summit.y, c.summit.z);
      hold(run, 300, createStepInput());
      expect(run.ended).toBeNull();
      for (let t = 0; t < c.tiers.length; t++) {
         showTier(run, t);
         const ts = run.tiers[t];
         for (let i = 0; i < c.tiers[t].seqLen; i++) {
            touch(run, crystalOf(run, t, ts.seq[i]));
            expect(ts.progress).toBe(i + 1 < c.tiers[t].seqLen ? i + 1 : ts.progress);
         }
         expect(ts.done).toBe(true);
         expect(run.tier).toBe(t + 1);
         if (t + 1 < c.tiers.length) expect(run.events.beaconArmed === t + 1 || run.tier === t + 1).toBe(true);
      }
      expect(run.wrongs).toBe(0);
      teleport(run, c.summit.x, c.summit.y, c.summit.z);
      hold(run, 300, createStepInput());
      expect(run.ended).toBe("win");
      expect(run.finishMs).toBeGreaterThan(0);
   });

   it("a wrong crystal shoves the hero back onto its pad, resets the sequence and counts a strike; Kiro's shield skips the shove, not the reset", () => {
      for (const hero of ["zuno", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         showTier(run, 0);
         const ts = run.tiers[0];
         touch(run, crystalOf(run, 0, ts.seq[0]));
         expect(ts.progress).toBe(1);
         // neither the next colour nor the one just touched (that one stays safe for SAFE_MS)
         const wrongColor = [0, 1, 2].find((col) => col !== ts.seq[1] && col !== ts.seq[0])!;
         const cr = crystalOf(run, 0, wrongColor);
         if (hero === "kiro") {
            const p = createStepInput();
            p.actionPressed = true;
            step(run, 16, p);
         }
         const before = run.strikes;
         touch(run, cr, 700);
         expect(run.wrongs).toBe(1);
         expect(ts.progress).toBe(0);
         expect(run.strikes).toBe(before + 1);
         expect(run.events.knocked || run.hero.stunUntil > run.simMs - 500 || hero === "kiro").toBe(true);
         if (hero === "kiro") expect(run.hero.stunUntil).toBeLessThan(run.simMs);
         // still on a pad (never shoved into the void)
         expect(run.hero.lostUntil).toBe(-1);
         expect(run.falls).toBe(0);
      }
   });

   it("a bobbing crystal counts once per visit, as it sinks into reach; its bobbing never re-touches a standing hero", () => {
      const run = createRun(1, 4);
      showTier(run, 0);
      const ts = run.tiers[0];
      const cr = crystalOf(run, 0, ts.seq[0]);
      expect(cr.bob).toBeDefined();
      touch(run, cr, 300);
      // stand under it for a few bob cycles
      hold(run, 9000, createStepInput());
      expect(ts.progress).toBe(1);
      expect(run.wrongs).toBe(0);
   });

   it("Zuno's magnet picks the next crystal from 3 m, never a wrong one", () => {
      const run = createRun(1, 1, "zuno");
      showTier(run, 0);
      const ts = run.tiers[0];
      const right = crystalOf(run, 0, ts.seq[0]);
      const wrong = crystalOf(run, 0, [0, 1, 2].find((col) => col !== ts.seq[0])!);
      // stand beside the pad's middle, off to the side: out of touch of both of its crystals, inside the magnet's reach of the right one
      const pad = run.course.pads.find((p) => Math.abs(p.y - right.y) < 0.1 && Math.hypot(p.x - right.x, p.z - right.z) <= p.r + 0.4)!;
      const pr = Math.hypot(pad.x, pad.z);
      const sx = pad.x + (pad.z / pr) * 0.8;
      const sz = pad.z - (pad.x / pr) * 0.8;
      teleport(run, sx, pad.y, sz);
      expect(Math.hypot(sx - right.x, sz - right.z)).toBeGreaterThan(1.5);
      expect(Math.hypot(sx - right.x, sz - right.z)).toBeLessThan(MAGNET_CRYSTAL_R);
      for (let k = 0; k < run.course.tiers[0].count; k++) {
         const o = run.course.crystals[run.course.tiers[0].first + k];
         if (Math.abs(o.y - pad.y) < 0.1) expect(Math.hypot(sx - o.x, sz - o.z)).toBeGreaterThan(1.5);
      }
      const p = createStepInput();
      p.actionPressed = true;
      hold(run, 200, p);
      expect(ts.progress).toBe(1);
      expect(run.wrongs).toBe(0);
      void wrong;
   });
});

describe("hero routes and hazards", () => {
   it("a shard storm knocks whoever stands in its column while it rains, never Kiro behind his shield", () => {
      const c = courseFor(1);
      const pad = c.pads.find((p) => p.storm !== undefined)!;
      for (const hero of ["vexa", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         teleport(run, pad.x, pad.y, pad.z);
         const p = createStepInput();
         p.actionPressed = hero === "kiro";
         // the first rain (the shield lasts 3 s, the next rain comes at 3.2 s)
         hold(run, STORM_PERIOD - 100, p);
         if (hero === "kiro") expect(run.strikes).toBe(0);
         else expect(run.strikes).toBeGreaterThan(0);
      }
      expect(stormIn(pad, 0)).toBeLessThanOrEqual(STORM_PERIOD);
   });

   it("a spark drone patrols at head height between its pads and knocks a hero in its way", () => {
      const run = createRun(1, 4);
      const c = run.course;
      const d = c.drones[0];
      const from = c.pads[d.from];
      const to = c.pads[d.to];
      droneAt(c, d, 0, pos);
      expect(pos.y).toBeGreaterThan(Math.min(from.y, to.y) + 2);
      // put the hero where the drone will be in 400 ms, floating at its height
      droneAt(c, d, 400, pos);
      run.hero.x = pos.x;
      run.hero.z = pos.z;
      run.hero.y = pos.y - 0.6;
      run.hero.grounded = false;
      run.hero.vy = 0;
      run.checkpoint = 0;
      let knocked = false;
      const none = createStepInput();
      for (let f = 0; f < 30 && !knocked; f++) {
         run.hero.y = pos.y - 0.6;
         run.hero.vy = 0;
         step(run, 16, none);
         knocked = run.events.knocked;
      }
      expect(knocked).toBe(true);
   });

   it("a crumbling pad gives way CRUMBLE_MS after you land on it and comes back GONE_MS later", () => {
      const run = createRun(1, 3);
      const i = run.course.pads.findIndex((p) => p.crumble);
      const pad = run.course.pads[i];
      teleport(run, pad.x, pad.y, pad.z);
      hold(run, 100, createStepInput());
      expect(run.crumbleAt[i]).toBeGreaterThanOrEqual(0);
      expect(padAvailable(run, i)).toBe(true);
      hold(run, CRUMBLE_MS, createStepInput());
      expect(padAvailable(run, i)).toBe(false);
      expect(run.hero.grounded).toBe(false);
      hold(run, GONE_MS + 50, createStepInput());
      expect(padAvailable(run, i)).toBe(true);
   });

   it("a sliding pad carries its rider; glass gives a third of the grip", () => {
      const run = createRun(1, 2);
      const i = run.course.pads.findIndex((p) => p.move);
      const pad = run.course.pads[i];
      padCenterAt(pad, 0, pos);
      teleport(run, pos.x, pad.y, pos.z);
      hold(run, 800, createStepInput());
      padCenterAt(pad, run.simMs, pos);
      expect(Math.hypot(run.hero.x - pos.x, run.hero.z - pos.z)).toBeLessThan(0.3);
      expect(run.hero.onPad).toBe(i);
      const slickRun = createRun(1, 3);
      const si = slickRun.course.pads.findIndex((p) => p.slick);
      const sp = slickRun.course.pads[si];
      teleport(slickRun, sp.x, sp.y, sp.z);
      const plain = createRun(1, 3);
      const pp = plain.course.pads[0];
      teleport(plain, pp.x, pp.y, pp.z);
      step(slickRun, 30, go(1, 0));
      step(plain, 30, go(1, 0));
      expect(Math.hypot(slickRun.hero.vx, slickRun.hero.vz)).toBeLessThan(Math.hypot(plain.hero.vx, plain.hero.vz));
   });

   /** Walks from the route pad straight at the barrier for 1.5 s: did the hero ever stand on the nook behind it? */
   function tryNook(run: TowerRun, disc: { x: number; z: number; y0: number }, power: boolean): boolean {
      const c = run.course;
      const nook = c.pads.find((p) => p.kind === "nook" && Math.hypot(p.x - disc.x, p.z - disc.z) < 3)!;
      const d = Math.hypot(disc.x, disc.z);
      teleport(run, (disc.x / d) * (d - 2.4), disc.y0 + 0.2, (disc.z / d) * (d - 2.4));
      const p = go(disc.x, disc.z);
      p.actionPressed = power;
      let reached = false;
      for (let f = 0; f < 94 && run.hero.lostUntil < 0; f++) {
         step(run, 16, p);
         p.actionPressed = false;
         if (run.hero.onPad === nook.index) reached = true;
      }
      return reached;
   }

   it("the dark crystal wall stops everyone but a dashing Riko; the void gate stops everyone but a phasing Vexa", () => {
      const c = courseFor(1);
      const w = c.walls[0];
      const riko = createRun(1, 1, "riko");
      expect(tryNook(riko, w, true)).toBe(true);
      expect(riko.wallBroken[0]).toBe(1);
      const zuno = createRun(1, 1, "zuno");
      expect(tryNook(zuno, w, true)).toBe(false);
      expect(zuno.wallBroken[0]).toBe(0);
      const g = c.gates[0];
      expect(tryNook(createRun(1, 1, "vexa"), g, true)).toBe(true);
      expect(tryNook(createRun(1, 1, "zuno"), g, true)).toBe(false);
      // and the barrier is too tall to jump: its band covers the apex of a jump
      expect(w.y1 - w.y0).toBeGreaterThan((14 * 14) / (2 * 30) + 0.2);
   });

   it("the sky ledge is LEDGE_LIFT up: Nami's second jump reaches it, a plain jump does not", () => {
      const c = courseFor(1);
      const ledge = c.pads.find((p) => p.kind === "ledge")!;
      const under = c.spec.pads.find((p) => Math.abs(p.y + LEDGE_LIFT - ledge.y) < 0.01)!;
      for (const hero of ["zuno", "nami"] as const) {
         const run = createRun(1, 1, hero);
         // stand at the pad's outer rim under the ledge, jump out and (Nami) again at the apex
         const d = Math.hypot(under.x, under.z);
         teleport(run, (under.x / d) * (d + under.r - 0.3), under.y, (under.z / d) * (d + under.r - 0.3));
         const p = go(under.x, under.z);
         p.jumpPressed = true;
         step(run, 16, p);
         let peak = 0;
         for (let f = 0; f < 60; f++) {
            const inp = go(under.x, under.z);
            inp.jumpPressed = hero === "nami" && f === 26;
            step(run, 16, inp);
            peak = Math.max(peak, run.hero.y);
         }
         if (hero === "nami") expect(peak).toBeGreaterThan(ledge.y);
         else expect(peak).toBeLessThan(ledge.y - 0.5);
      }
   });

   it("a fall under the beacon's level respawns at the last beacon reached (or the start)", () => {
      const run = createRun(1, 1);
      const c = run.course;
      run.hero.x = 30;
      run.hero.z = 30;
      run.hero.grounded = false;
      hold(run, 3000, createStepInput());
      expect(run.falls).toBe(1);
      expect(run.hero.x).toBeCloseTo(c.startX, 6);
      expect(run.hero.z).toBeCloseTo(c.startZ, 6);
      showTier(run, 0);
      const b = c.tiers[0].beacon;
      run.hero.x = 30;
      run.hero.z = 30;
      run.hero.grounded = false;
      run.hero.y = b.y - FALL_DROP + 0.5;
      hold(run, 3000, createStepInput());
      expect(run.falls).toBe(2);
      expect(run.hero.x).toBeCloseTo(b.x, 6);
      expect(run.hero.z).toBeCloseTo(b.z, 6);
      expect(run.tiers[0].shown).toBe(true);
   });
});

describe("Prism Shade (level 5)", () => {
   it("the boss config is valid, his telegraphs are his shows, and his least defeat time is his windows back to back", () => {
      expect(bossProblems(PRISM)).toEqual([]);
      const p = PRISM.phases;
      const len = LEVELS[5].bossSeqLen!;
      for (let i = 0; i < 3; i++) expect(p[i].attacks[0].telegraphMs).toBe(showMs(len[i]));
      const least = PRISM.introMs + 2 * (p[0].attacks[0].telegraphMs + p[0].attacks[0].attackMs) + PRISM.transitionMs + (p[1].attacks[0].telegraphMs + p[1].attacks[0].attackMs) + PRISM.transitionMs + (p[2].attacks[0].telegraphMs + p[2].attacks[0].attackMs);
      expect(bossMinMs()).toBe(least);
   });

   it("he wakes when the summit beacon is reached after the fourth round; a shuffle moves the crystals, Blackout and Mirror flag their tricks", () => {
      const run = createRun(1, 5);
      const c = run.course;
      const last = c.tiers.length - 1;
      // the arena beacon is inert before the rounds
      const b = c.tiers[last].beacon;
      teleport(run, b.x, b.y, b.z);
      hold(run, 300, createStepInput());
      expect(run.bossAwake).toBe(false);
      for (let t = 0; t < last; t++) {
         showTier(run, t);
         for (let i = 0; i < c.tiers[t].seqLen; i++) touch(run, crystalOf(run, t, run.tiers[t].seq[i]));
         expect(run.tiers[t].done).toBe(true);
      }
      teleport(run, b.x, b.y, b.z);
      hold(run, 100, createStepInput());
      expect(run.bossAwake).toBe(true);
      // through the intro and the first show to the first shockwave: the slots change
      teleport(run, c.arena!.x, c.arena!.y, c.arena!.z + 4);
      const before = Array.from(run.bossSlot);
      hold(run, PRISM.introMs + PRISM.phases[0].attacks[0].telegraphMs + 400, createStepInput());
      expect(run.boss!.step).toBe("attack");
      expect(run.bossLen).toBe(LEVELS[5].bossSeqLen![0]);
      hold(run, 400, createStepInput());
      expect(run.boss!.step).toBe("vulnerable");
      expect(Array.from(run.bossSlot)).not.toEqual(before);
      expect(run.bossDark).toBe(false);
      expect(run.bossMirror).toBe(false);
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

   it("the shows are serial: a show starts with the hero inside the ring and ends with it inside RING; a round ends only after its show; the boss wakes inside the summit ring", () => {
      for (const level of LEVEL_IDS) {
         const run = botRun(level, 60);
         expect(run.ended).toBe("win");
      }
      for (const level of LEVEL_IDS) {
         const run = createRun(2, level, "vexa");
         const bot = createBot(run, 1000 / 60);
         const input = createStepInput();
         const shownAt = new Array<number>(run.course.tiers.length).fill(-1);
         for (let f = 0; f < 20_000 && run.ended === null; f++) {
            botInput(bot, run, input);
            const ev = step(run, 1000 / 60, input);
            const h = run.hero;
            if (ev.showStart >= 0) {
               const b = run.course.tiers[ev.showStart].beacon;
               expect(Math.hypot(h.x - b.x, h.z - b.z)).toBeLessThanOrEqual(BEACON_R + (V_RUN + DASH_BOOST) * 0.0167);
            }
            if (ev.showDone >= 0) {
               const b = run.course.tiers[ev.showDone].beacon;
               expect(Math.hypot(h.x - b.x, h.z - b.z)).toBeLessThanOrEqual(RING + (V_RUN + DASH_BOOST) * 0.0167);
               shownAt[ev.showDone] = run.simMs;
            }
            if (ev.roundDone >= 0) expect(shownAt[ev.roundDone]).toBeGreaterThan(0);
            if (ev.bossWake) {
               const b = run.course.tiers[run.course.tiers.length - 1].beacon;
               expect(Math.hypot(h.x - b.x, h.z - b.z)).toBeLessThanOrEqual(BEACON_R + (V_RUN + DASH_BOOST) * 0.0167);
               for (let t = 0; t < run.course.tiers.length - 1; t++) expect(run.tiers[t].done).toBe(true);
            }
         }
         expect(run.ended).toBe("win");
      }
   }, 120_000);

   it("the least duration is every show plus the beacon-to-beacon travel at V_RUN less the dash budget (level 5 plus Prism Shade), less every gem and the most flow bonus", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const travel = (Math.max(0, travelMetres(c) - boostBudgetMetres(c)) / V_RUN) * 1000;
         expect(minFinishMs(c)).toBeCloseTo(showTotalMs(c) + travel + (c.boss ? bossMinMs() : 0), 6);
         expect(minDurationMsOf(c)).toBeCloseTo(minFinishMs(c) - c.orbs.length * ORB_BONUS_MS - comboMaxBonus(comboSpecOf(c)), 6);
         let shows = 0;
         for (const t of c.tiers) if (t.seqLen > 0) shows += t.seqLen * SHOW_STEP_MS + 300;
         expect(showTotalMs(c)).toBe(shows);
      }
   });

   it("every level's minDurationMs is 94-100 % of its bound; the limits are pinned and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const lb = minDurationMsOf(courseFor(id));
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id, courseFor(id)));
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         // 95 % of the bound, floored to 100 ms
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.95 - 100);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].timerMs);
         expect(crystalTowerMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(crystalTowerMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
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
   [6900, 90000, 8310],
   [7000, 120000, 11300],
   [16200, 150000, 13380],
   [21800, 180000, 15820],
   [34500, 240000, 20550],
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
      expect(isRankedRun(crystalTowerMeta.scoring, "timeup")).toBe(false);
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

describe("tower queries", () => {
   it("a crystal's centre is CRYSTAL_LIFT over its pad, a bobbing one up to its amp higher", () => {
      const c = courseFor(4);
      const cr = c.crystals[0];
      let lo = Infinity;
      let hi = -Infinity;
      for (let ms = 0; ms < 8000; ms += 50) {
         crystalAt(cr, ms, pos);
         lo = Math.min(lo, pos.y);
         hi = Math.max(hi, pos.y);
      }
      expect(lo).toBeCloseTo(cr.y + CRYSTAL_LIFT, 1);
      expect(hi).toBeCloseTo(cr.y + CRYSTAL_LIFT + cr.bob!.amp, 1);
   });

   it("a level id is read: every course is its own", () => {
      const ids = new Set(LEVEL_IDS.map((id) => courseFor(id).pads.length + ":" + courseFor(id).name));
      expect(ids.size).toBe(5);
      expect(LEVEL_IDS.map((id) => courseFor(id).id as LevelId)).toEqual([1, 2, 3, 4, 5]);
   });
});
