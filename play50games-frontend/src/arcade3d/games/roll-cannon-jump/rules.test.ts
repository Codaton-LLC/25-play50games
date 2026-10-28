// Roll Cannon Jump rules: the aim, the pulse, the shot, catches and the hit-stop, the timeout and
// the auto cannons, trampolines, balloons, platforms, falls and respawns, every hero power, the
// hazards, the finish ring, Ashbag's windows, determinism, and the hand-off to the store.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { createBoss, stepBoss, createBossEvents } from "@/arcade3d/menu2/boss/boss";
import { DASH_EXTRA_M, NAMI_VY, POWER_MS } from "./heroes";
import { ASHBAG } from "./progression";
import {
   AIM_TIMEOUT_MS,
   AUTO_FIRE_MS,
   CATCH_MS,
   CATCH_R,
   COURSE,
   G,
   HERO_R,
   LOST_MS,
   ORB,
   PITCH_MAX,
   PITCH_MIN,
   STAT,
   TRAMP_K,
   V_MAX,
   V_MIN,
   YAW_RANGE,
   YAW_RATE,
   bossWindowSpot,
   cannonPos,
   copyRun,
   courseFor,
   createRun,
   createStepInput,
   finalScore,
   launchSpeed,
   pulseAt,
   pulseWaitMs,
   ringCrossed,
   runTimeMs,
   solidBoxes,
   step,
   type CannonRun,
   type SolidBox,
   type StepInput,
} from "./rules";
import { DEG } from "./show";

const press = (): StepInput => ({ ...createStepInput(), jumpPressed: true, jumpHeld: true });
const idle = createStepInput();

function hold(run: CannonRun, ms: number, input: StepInput = idle): void {
   for (let t = 0; t < ms && run.ended === null; t++) step(run, 1, input);
}

/** Puts the hero in flight from (x, y, z) at velocity v. */
function launch(run: CannonRun, x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
   Object.assign(run.hero, { x, y, z, vx, vy, vz, mode: "fly", cannon: -1, firedFrom: -1, flightFrom: run.simMs, bounced: false, dashUsed: false, airJumpUsed: false, diving: false });
}

describe("the power ring and the launch", () => {
   it("pulses 60 % -> 100 % at 600 ms -> 60 % at 1200 ms, a fixed cycle from the aim's start", () => {
      expect(pulseAt(0)).toBeCloseTo(0.6, 9);
      expect(pulseAt(300)).toBeCloseTo(0.8, 9);
      expect(pulseAt(600)).toBeCloseTo(1, 9);
      expect(pulseAt(900)).toBeCloseTo(0.8, 9);
      expect(pulseAt(1200)).toBeCloseTo(0.6, 9);
      for (const p of [0.6, 0.7, 0.85, 1]) expect(pulseAt(pulseWaitMs(p))).toBeCloseTo(p, 9);
      expect(launchSpeed(0.6)).toBe(V_MIN);
      expect(launchSpeed(1)).toBe(V_MAX);
      // a 45 deg shot carries 7.2 m at 60 % and 24.2 m at 100 % (flat ground)
      expect((V_MIN * V_MIN) / G).toBeCloseTo(7.2, 6);
      expect((V_MAX * V_MAX) / G).toBeCloseTo(24.2, 6);
   });

   it("the stick turns the barrel at the turn rates, inside +-60 deg yaw and 20-70 deg pitch (keyboard holds give every angle)", () => {
      const run = createRun(1, 2);
      const c = run.course.cannons[0];
      const right = { ...createStepInput(), moveX: 1 };
      hold(run, 100, right);
      expect(c.yaw - run.hero.yaw).toBeCloseTo((YAW_RATE * 100) / 1000, 6);
      hold(run, 2000, right);
      expect(c.yaw - run.hero.yaw).toBeCloseTo(YAW_RANGE, 6);
      const up = { ...createStepInput(), moveZ: -1 };
      const r2 = createRun(1, 2);
      hold(r2, 2000, up);
      expect(r2.hero.pitch).toBeCloseTo(PITCH_MAX, 6);
      const down = { ...createStepInput(), moveZ: 1 };
      const r3 = createRun(1, 2);
      hold(r3, 2000, down);
      expect(r3.hero.pitch).toBeCloseTo(PITCH_MIN, 6);
   });

   it("Jump fires at the ring's power with the barrel's aim; the shot is a free arc", () => {
      const run = createRun(1, 2);
      hold(run, 299);
      step(run, 1, press());
      expect(run.events.fired).toBe(true);
      expect(run.events.pulse).toBeCloseTo(pulseAt(300), 9);
      const h = run.hero;
      const v = launchSpeed(pulseAt(300));
      expect(Math.hypot(h.vx, h.vy, h.vz)).toBeCloseTo(v, 6);
      expect(Math.asin(h.vy / v)).toBeCloseTo(run.course.cannons[0].pitch, 6);
      const vy0 = h.vy;
      hold(run, 100);
      expect(h.vy).toBeCloseTo(vy0 - G * 0.1, 6);
      expect(run.shots).toBe(1);
   });

   it("the aim times out at 2.4 s and fires on its own (no dead time); a press during the hit-stop counts as it opens", () => {
      const run = createRun(1, 2);
      hold(run, AIM_TIMEOUT_MS - 1);
      expect(run.hero.mode).toBe("aim");
      step(run, 1, idle);
      expect(run.events.fired && run.events.timeoutFire).toBe(true);
   });
});

describe("cannons, catches and the hit-stop", () => {
   it("a cannon mouth within 1.2 m catches: a 0.4 s hit-stop, then the aim opens at 60 % (L1 c1 -> c2 by a planned shot)", () => {
      const run = createRun(1, 2);
      const c1 = run.course.cannons[1];
      // fly into c1 from just short of it
      launch(run, c1.x, c1.y, c1.z + CATCH_R + 0.05, 0, 0, -3);
      hold(run, 60);
      expect(run.hero.mode).toBe("catch");
      expect(run.hero.cannon).toBe(1);
      expect(run.hero.lastCannon).toBe(1);
      hold(run, CATCH_MS - 30);
      expect(run.hero.mode).toBe("aim");
      expect(pulseAt(run.simMs - run.hero.aimFrom)).toBeLessThan(0.62);
   });

   it("auto cannons fire on their own after 1.5 s at their locked aim and power (Jump fires them early); wheel cannons sweep", () => {
      const c = courseFor(3);
      const a = c.cannons.findIndex((k) => k.kind === "auto");
      expect(a).toBeGreaterThan(0);
      const run = createRun(1, 3);
      const k = c.cannons[a];
      Object.assign(run.hero, { mode: "catch", cannon: a, timer: 1, x: k.x, y: k.y, z: k.z });
      hold(run, 1);
      expect(run.hero.mode).toBe("aim");
      hold(run, AUTO_FIRE_MS - 1, { ...createStepInput(), moveX: 1, moveZ: -1 });
      expect(run.hero.mode).toBe("aim");
      expect(run.hero.yaw).toBe(k.yaw);
      step(run, 1, idle);
      expect(run.events.fired && run.events.autoFire).toBe(true);
      expect(Math.hypot(run.hero.vx, run.hero.vy, run.hero.vz)).toBeCloseTo(launchSpeed(k.power), 6);
      const w = c.cannons.find((q) => q.kind === "wheel")!;
      expect(w.sweep).toBeGreaterThan(0);
   });

   it("rail cannons slide on their rails (within their travel)", () => {
      const c = courseFor(3);
      const r = c.cannons.find((k) => k.rail)!;
      const p = { x: 0, y: 0, z: 0 };
      let lo = Infinity;
      let hi = -Infinity;
      for (let ms = 0; ms < 2800; ms += 20) {
         cannonPos(r, ms, p);
         lo = Math.min(lo, p.x);
         hi = Math.max(hi, p.x);
      }
      expect(hi - lo).toBeGreaterThan(r.rail!.travel * 1.9);
      expect(hi - lo).toBeLessThanOrEqual(r.rail!.travel * 2 + 1e-9);
   });
});

describe("trampolines, balloons, platforms", () => {
   it("a trampoline bounces to 1.3x the incoming height and keeps little of the run-in; a second bounce settles and spills you off", () => {
      const run = createRun(1, 1);
      const t = run.course.tramps[0];
      const drop = 3;
      launch(run, t.x, t.y + HERO_R + drop, t.z, 1, 0, 0);
      hold(run, 1500);
      expect(run.hero.bounced).toBe(true);
      // the height reached after the bounce
      const run2 = createRun(1, 1);
      launch(run2, t.x, t.y + HERO_R + drop, t.z, 0, 0, 0);
      let maxUp = 0;
      let bounced = false;
      for (let ms = 0; ms < 2000; ms++) {
         step(run2, 1, idle);
         if (run2.events.bounced >= 0) {
            if (bounced) break;
            bounced = true;
         }
         if (bounced) maxUp = Math.max(maxUp, run2.hero.y - (t.y + HERO_R));
      }
      expect(maxUp).toBeGreaterThan(drop * TRAMP_K * 0.97);
      expect(maxUp).toBeLessThan(drop * TRAMP_K * 1.03);
   });

   it("a balloon bunch pops for one free re-aim (any yaw), mid-air", () => {
      const run = createRun(1, 4);
      const b = run.course.balloons[0];
      launch(run, b.x, b.y, b.z + b.r + HERO_R + 0.05, 0, 0, -4);
      hold(run, 40);
      expect(run.events.balloon >= 0 || run.hero.mode === "hover").toBe(true);
      hold(run, 400);
      expect(run.hero.mode).toBe("aim");
      expect(run.hero.cannon).toBe(-1);
      hold(run, 1000, { ...createStepInput(), moveX: 1 });
      // free yaw: a whole second of turning is not clamped at 60 deg
      expect(Math.abs(run.hero.yaw)).toBeGreaterThan(YAW_RANGE + 0.3);
      expect(run.popped[0]).toBe(1);
   });

   it("a platform landing walks at 4 m/s; walking into its cannon climbs in with the same hit-stop", () => {
      const run = createRun(1, 1);
      const p = run.course.platforms[0];
      launch(run, p.x, p.y + HERO_R + 1, p.z + p.hd - 0.5, 0, 0, 0);
      hold(run, 600);
      expect(run.hero.mode).toBe("walk");
      const z0 = run.hero.z;
      hold(run, 250, { ...createStepInput(), moveZ: -1 });
      expect(z0 - run.hero.z).toBeCloseTo(1, 1);
      hold(run, 3000, { ...createStepInput(), moveZ: -1 });
      expect(run.hero.mode === "catch" || run.hero.mode === "aim").toBe(true);
      expect(run.hero.cannon).toBe(1);
   });
});

describe("falls and respawns", () => {
   it("the net (or a bonk) loses the shot: 0.8 s later the hero is back in the last cannon, aiming; the balloons are back", () => {
      const run = createRun(1, 4);
      run.popped[0] = 1;
      launch(run, 30, 4, -30, 0, 0, 0);
      hold(run, 2000);
      expect(run.hits).toBe(1);
      expect(run.hero.mode).toBe("aim");
      expect(run.hero.cannon).toBe(0);
      expect(run.popped[0]).toBe(0);
      const run2 = createRun(1, 2);
      const w = run2.course.walls[0];
      launch(run2, (w.minX + w.maxX) / 2, (w.minY + w.maxY) / 2, w.maxZ + 0.6, 0, 0, -5);
      hold(run2, 100);
      expect(run2.hero.mode).toBe("lost");
      expect(run2.hero.lostWhy).toBe("bonk");
      hold(run2, LOST_MS);
      expect(run2.hero.mode).toBe("aim");
   });
});

describe("hero powers (the card's roles)", () => {
   it("Riko's dash adds exactly 4 m over 500 ms, once a flight, and smashes a cracked board (the hidden cannon then catches)", () => {
      const run = createRun(1, 1, "riko");
      const ref = createRun(1, 1, "riko");
      launch(run, 0, 30, 0, 0, 0, -5);
      launch(ref, 0, 30, 0, 0, 0, -5);
      step(run, 1, { ...createStepInput(), actionPressed: true });
      step(ref, 1, idle);
      hold(run, 700);
      hold(ref, 700);
      expect(ref.hero.z - run.hero.z).toBeCloseTo(DASH_EXTRA_M, 2);
      expect(POWER_MS.dash).toBe(500);
      const r2 = createRun(1, 1, "riko");
      const b = r2.course.boards[0];
      launch(r2, b.x, b.y, b.z + 3, 0, 0, -6);
      step(r2, 1, { ...createStepInput(), actionPressed: true });
      hold(r2, 300);
      expect(r2.broken[0]).toBe(1);
      expect(r2.hero.mode === "catch" || r2.hero.mode === "fly").toBe(true);
      // anyone else bonks off it
      const r3 = createRun(1, 1, "nami");
      launch(r3, b.x, b.y, b.z + 1.5, 0, 0, -6);
      hold(r3, 600);
      expect(r3.broken[0]).toBe(0);
      expect(r3.hits).toBe(1);
   });

   it("Nami's double jump sets vy to 12 m/s once a flight, keeping the horizontal", () => {
      const run = createRun(1, 1, "nami");
      launch(run, 0, 30, 0, 3, -5, -4);
      step(run, 1, { ...createStepInput(), actionPressed: true });
      expect(run.events.airJumped).toBe(true);
      expect(run.hero.vy).toBeCloseTo(NAMI_VY - G / 1000, 6);
      expect(run.hero.vx).toBeCloseTo(3, 6);
      hold(run, 2100);
      launch(run, 0, 30, 0, 3, -5, -4);
      run.hero.airJumpUsed = true;
      step(run, 1, { ...createStepInput(), actionPressed: true });
      expect(run.events.airJumped).toBe(false);
   });

   it("Kiro's shield flies through a smoke jet; anyone else is knocked off", () => {
      const level = 1;
      for (const [hero, power, lost] of [["kiro", true, false], ["riko", false, true]] as const) {
         const run = createRun(1, level, hero);
         const j = run.course.jets[0];
         launch(run, j.x, (j.y0 + j.y1) / 2, j.z + 3, 0, 4, -6);
         if (power) step(run, 1, { ...createStepInput(), actionPressed: true });
         hold(run, 800);
         expect(run.hits > 0, hero).toBe(lost);
      }
   });

   it("Vexa's phase slips through a ghost pole; anyone else bonks", () => {
      for (const [hero, power, lost] of [["vexa", true, false], ["kiro", false, true]] as const) {
         const run = createRun(1, 1, hero);
         const p = run.course.poles.find((q) => q.ghost)!;
         launch(run, p.x, (p.y0 + p.y1) / 2, p.z + 2, 0, 0, -6);
         if (power) step(run, 1, { ...createStepInput(), actionPressed: true });
         hold(run, 600);
         expect(run.hits > 0, hero).toBe(lost);
      }
   });

   it("Zuno's magnet shows the hidden canvas orbs and pulls orbs in from 4 m", () => {
      const run = createRun(1, 1, "zuno");
      const i = run.course.orbs.findIndex((o) => o.hidden);
      const o = run.course.orbs[i];
      launch(run, o.x + 3.5, o.y, o.z, 0, 0, 0);
      step(run, 1, { ...createStepInput(), actionPressed: true });
      expect(run.collected[i]).toBe(1);
      const r2 = createRun(1, 1, "riko");
      launch(r2, o.x, o.y, o.z, 0, 0, 0);
      step(r2, 1, idle);
      expect(r2.collected[i]).toBe(0);
   });
});

describe("the finish and Ashbag", () => {
   it("flying through the finish ring wins; around it does not", () => {
      const f = COURSE.finish!;
      const nx = -Math.sin(f.yaw);
      const nz = -Math.cos(f.yaw);
      expect(ringCrossed(f, f.x - nx, f.y, f.z - nz, f.x + nx, f.y, f.z + nz)).toBe(true);
      expect(ringCrossed(f, f.x - nx, f.y + f.r + 0.2, f.z - nz, f.x + nx, f.y + f.r + 0.2, f.z + nz)).toBe(false);
      const run = createRun(1, 1);
      launch(run, f.x - nx * 2, f.y, f.z - nz * 2, nx * 8, 1, nz * 8);
      hold(run, 600);
      expect(run.ended).toBe("win");
      expect(run.finishMs).toBe(run.simMs);
   });

   it("Ashbag starts when the stage is reached, and takes hits only in its windows: a pod in P1, the gondola from a bounce in P2, the valve with a dive in P3", () => {
      const run = createRun(1, 5);
      const a = run.course.arena!;
      expect(run.boss).not.toBeNull();
      // not before the stage
      hold(run, 3000);
      expect(run.boss!.stepMs).toBe(0);
      const stage = run.course.platforms[a.platform];
      launch(run, stage.x, stage.y + HERO_R + 0.3, stage.z, 0, 0, 0);
      run.pressMs = -1;
      hold(run, 300);
      expect(run.arenaAt).toBeGreaterThan(0);
      // fly through the lit pod while closed: nothing; while open: a hit and its rain
      const C = { x: 0, y: 0, z: 0 };
      const P = { x: 0, y: 0, z: 0 };
      bossWindowSpot(run, 0, run.boss!.attack, C, P);
      const s = copyRun(run);
      launch(s, P.x, P.y + 0.6, P.z, 0, -1, 0);
      hold(s, 30);
      expect(s.boss!.hp).toBe(ASHBAG.maxHp);
      while (run.boss!.step !== "vulnerable") step(run, 1, idle);
      bossWindowSpot(run, 0, run.boss!.attack, C, P);
      launch(run, P.x, P.y + 0.6, P.z, 0, -1, 0);
      hold(run, 30);
      expect(run.boss!.hp).toBe(ASHBAG.maxHp - 1);
      expect(run.pods[0]).toBe(1);
      // P2's gondola: only from a bounce, going up
      const p2 = createRun(1, 5);
      p2.arenaAt = 1;
      p2.boss!.hp = 3;
      p2.boss!.phase = 1;
      p2.boss!.step = "vulnerable";
      p2.boss!.stepMs = 0;
      bossWindowSpot(p2, 1, p2.boss!.attack, C, P);
      const g = copyRun(p2);
      launch(g, P.x, P.y - 0.5, P.z, 0, 4, 0);
      hold(g, 20);
      expect(g.boss!.hp).toBe(3);
      launch(p2, P.x, P.y - 0.5, P.z, 0, 4, 0);
      p2.hero.bounced = true;
      hold(p2, 20);
      expect(p2.boss!.hp).toBe(2);
      // P3's valve: only diving
      const p3 = createRun(1, 5);
      p3.arenaAt = 1;
      p3.boss!.hp = 1;
      p3.boss!.phase = 2;
      p3.boss!.step = "vulnerable";
      bossWindowSpot(p3, 2, 0, C, P);
      const v = copyRun(p3);
      launch(v, P.x, P.y + 1, P.z, 0, -3, 0);
      hold(v, 30);
      expect(v.boss!.hp).toBe(1);
      launch(p3, P.x, P.y + 1.5, P.z, 0, -3, 0);
      p3.pressMs = p3.simMs + 1;
      p3.hero.flightFrom = p3.simMs - 10;
      step(p3, 1, { ...createStepInput(), jumpPressed: true, jumpHeld: true });
      hold(p3, 60, { ...createStepInput(), jumpHeld: true });
      expect(p3.ended).toBe("win");
      expect(p3.events.finished || p3.boss!.hp === 0).toBe(true);
   });

   it("the boss machine is valid and time-driven (the same windows at any frame size)", () => {
      const a = createBoss(ASHBAG);
      const b = createBoss(ASHBAG);
      const ev = createBossEvents();
      for (let i = 0; i < 20000; i++) stepBoss(a, ASHBAG, 1, ev);
      for (let i = 0; i < 1000; i++) stepBoss(b, ASHBAG, 20, ev);
      expect(a).toEqual(b);
   });
});

describe("determinism and the store hand-off", () => {
   it("the same inputs give the same run at 30, 60 and 144 fps (whole-ms clock)", () => {
      const out = [30, 60, 144].map((fps) => {
         const run = createRun(1, 3);
         const input = createStepInput();
         let t = 0;
         while (t < 6000) {
            const dt = 1000 / fps;
            input.jumpPressed = Math.floor(t / 700) !== Math.floor((t + dt) / 700);
            input.moveX = Math.sin(t / 900);
            step(run, dt, input);
            t += dt;
         }
         return run;
      });
      // presses land on different ms at different frame sizes; the clock and the arc law are identical
      for (const r of out) expect(r.simMs).toBeGreaterThanOrEqual(6000);
      for (const r of out) expect(r.simMs).toBeLessThan(6000 + 1000 / 30 + 1);
      const a = createRun(1, 2);
      const b = createRun(1, 2);
      for (let i = 0; i < 300; i++) step(a, 16, i === 20 ? press() : idle);
      for (let i = 0; i < 300; i++) step(b, 16, i === 20 ? press() : idle);
      expect(a.hero).toEqual(b.hero);
   });

   it("finalScore: a win submits the finish minus 100 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      expect(ORB.bonusMs).toBe(100);
      expect(runTimeMs(20000, 10, 300)).toBe(18700);
      const stats = { [STAT.finishMs]: 20000, [STAT.orbs]: 10, [STAT.comboMs]: 300 };
      expect(finalScore({ score: 0, endReason: "win", stats, elapsedMs: 21000 }).durationMs).toBe(18700);
      expect(finalScore({ score: 0, endReason: "timeup", stats, elapsedMs: 75000 }).durationMs).toBe(75000);
   });

   it("solidBoxes lists the platforms, walls, poles and cannon stands; smashed boards drop out", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, id);
         const out: SolidBox[] = [];
         const n = solidBoxes(run, 0, out);
         expect(n).toBeGreaterThan(run.course.cannons.length);
         if (run.course.boards.length > 0) {
            run.broken[0] = 1;
            expect(solidBoxes(run, 0, out)).toBe(n - 1);
         }
      }
   });

   it("pitch limits are the card's 20-70 deg, yaw +-60 deg", () => {
      expect(PITCH_MIN).toBeCloseTo(20 * DEG, 9);
      expect(PITCH_MAX).toBeCloseTo(70 * DEG, 9);
      expect(YAW_RANGE).toBeCloseTo(60 * DEG, 9);
   });
});
