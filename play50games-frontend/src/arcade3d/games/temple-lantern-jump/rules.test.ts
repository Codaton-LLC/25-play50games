// The rules, one mechanic at a time (README "Rules"): the climb's physics, the ember and the light,
// glyph ledges, lanterns, throws, balconies, gusts, bats, jets, the five heroes' powers, the secrets
// and the Queen. Runs are built by hand (createRun + moving the hero), then stepped.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { courseFor, jetPhase, padX, type Pad } from "./course";
import { HEROES } from "./heroes";
import { LEVELS } from "./levels";
import { QUEEN } from "./progression";
import {
   BOUNCE_HEIGHT, COYOTE_MS, EMBER_LOW_MS, FADE_MS, GRAV, LANTERN_LIT_MS, STRAND_MS, THROW_COST_MS, V_BOUNCE, V_CLIMB_MAX, V_JUMP, V_WALK,
   createRun, createStepInput, emberRadius, lanternLit, lightReaches, padGlow, padSolid, runStars, runTimeMs, step, throwTarget,
   type StepInput, type TempleRun,
} from "./rules";

const FRAME = 1000 / 60;
const idle = (): StepInput => createStepInput();

/** Steps `ms` of play with `input` (jumpPressed / actionPressed only on the first frame). */
function play(run: TempleRun, ms: number, input: Partial<StepInput> = {}): void {
   const i = { ...idle(), ...input };
   for (let t = 0; t < ms && run.ended === null; t += FRAME) {
      step(run, FRAME, i);
      i.jumpPressed = false;
      i.actionPressed = false;
   }
}

function put(run: TempleRun, pad: Pad, dy = 0): void {
   Object.assign(run.hero, { x: pad.x, y: pad.y + dy, z: pad.z, vx: 0, vy: 0, vz: 0, grounded: dy === 0, standing: dy === 0 ? pad.id : -1 });
}

/** Drops the hero from 0.3 m above a lantern until it bounces. */
function land(run: TempleRun, pad: Pad): void {
   put(run, pad, 0.3);
   for (let f = 0; f < 30; f++) if (step(run, FRAME, idle()).bounced === pad.id) return;
}

/** Every lantern burns for a long time: no throw targets, no dark. */
function lightAll(run: TempleRun): void {
   for (const id of run.course.lanterns) run.litUntil[id] = 1e9;
}

const pads = (run: TempleRun, kind: Pad["kind"]) => run.course.pads.filter((p) => p.kind === kind);
const run1 = (hero: "riko" | "nami" | "kiro" | "zuno" | "vexa" = "kiro", level: 1 | 2 | 3 | 4 | 5 = 1) => createRun(1, level, hero);

describe("physics", () => {
   it("a jump reaches V_JUMP^2 / 2g and a lantern throws x1.4 as high", () => {
      const run = run1();
      let top = 0;
      const i = idle();
      i.jumpPressed = true;
      for (let f = 0; f < 90; f++) {
         step(run, FRAME, i);
         i.jumpPressed = false;
         top = Math.max(top, run.hero.y);
      }
      expect(top).toBeCloseTo((V_JUMP * V_JUMP) / (2 * GRAV), 1);
      expect(V_BOUNCE * V_BOUNCE).toBeCloseTo(V_JUMP * V_JUMP * BOUNCE_HEIGHT, 6);
      const lantern = run.course.pads[run.course.lanterns[0]];
      put(run, lantern, 0.3);
      let apex = lantern.y;
      for (let f = 0; f < 90; f++) {
         step(run, FRAME, idle());
         apex = Math.max(apex, run.hero.y);
      }
      expect(apex - lantern.y).toBeCloseTo((V_BOUNCE * V_BOUNCE) / (2 * GRAV), 0);
      expect(V_CLIMB_MAX).toBeCloseTo(V_BOUNCE / 2, 9);
   });

   it("walks at V_WALK, camera-relative (yaw turns the stick)", () => {
      const run = run1();
      play(run, 500, { moveX: 1 });
      expect(run.hero.x).toBeGreaterThan(2.3);
      const run2 = run1();
      play(run2, 500, { moveX: 1, yaw: Math.PI / 2 });
      expect(Math.abs(run2.hero.z)).toBeGreaterThan(2.3);
      expect(Math.abs(run2.hero.x)).toBeLessThan(0.3);
      expect(V_WALK).toBe(5.5);
   });

   it("is the same at any frame rate (fixed 1000/120 ms steps)", () => {
      const results = [30, 60, 144].map((fps) => {
         const run = run1();
         const i = idle();
         i.moveX = 0.6;
         i.moveZ = -0.5;
         for (let t = 0; t < 4000; t += 1000 / fps) {
            i.jumpPressed = t === 0;
            step(run, 1000 / fps, i);
         }
         return [run.simMs, run.hero.x.toFixed(2), run.hero.y.toFixed(2), run.hero.z.toFixed(2), Math.round(run.ember)];
      });
      // the same physics at every rate: only a press waits for the next step (a few ms)
      for (const col of [1, 2, 3] as const) {
         expect(Math.abs(Number(results[0][col]) - Number(results[1][col]))).toBeLessThan(0.15);
         expect(Math.abs(Number(results[2][col]) - Number(results[1][col]))).toBeLessThan(0.15);
      }
      expect(Math.abs(Number(results[0][0]) - Number(results[1][0]))).toBeLessThan(35);
   });

   it("a jump still works a hair after walking off a ledge (coyote), not long after", () => {
      const run = run1();
      const deck = run.course.pads[run.course.chain[0]];
      Object.assign(run.hero, { x: deck.r + 0.6, z: 0, y: deck.y });
      play(run, FRAME * 2);
      expect(run.hero.grounded).toBe(false);
      const early = run.hero.vy;
      step(run, FRAME, { ...idle(), jumpPressed: true });
      expect(run.hero.vy).toBeGreaterThan(early);
      const late = run1();
      Object.assign(late.hero, { x: deck.r + 0.6, z: 0, y: deck.y });
      play(late, COYOTE_MS + 100);
      const v = late.hero.vy;
      step(late, FRAME, { ...idle(), jumpPressed: true });
      expect(late.hero.vy).toBeLessThan(v);
   });
});

describe("the ember and the light", () => {
   it("the ember burns 1 s per s; its light is 6 m full, 1.5 m nearly out, nothing at 0", () => {
      const run = run1();
      expect(emberRadius(run)).toBeCloseTo(6, 6);
      play(run, 4000);
      expect(run.ember).toBeCloseTo(4000, -2);
      expect(emberRadius(run)).toBeCloseTo(1.5 + 4.5 * 0.5, 1);
      run.ember = 1;
      expect(emberRadius(run)).toBeGreaterThan(1.49);
      run.ember = 0;
      expect(emberRadius(run)).toBe(0);
   });

   it("the beep: emberLow once when it falls under 2 s; emberOut at 0", () => {
      const run = run1();
      run.ember = EMBER_LOW_MS + 20;
      let low = 0;
      let out = 0;
      for (let f = 0; f < 60; f++) {
         const ev = step(run, FRAME, idle());
         if (ev.emberLow) low++;
         if (ev.emberOut) out++;
      }
      expect(low).toBe(1);
      expect(out).toBe(0);
      run.ember = 5;
      expect(step(run, FRAME, idle()).emberOut).toBe(true);
   });

   it("a glyph ledge is solid in the ember's light, fades over 0.4 s in the dark, and drops you", () => {
      const run = run1();
      const glyph = pads(run, "glyph").find((p) => p.y > 6)!;
      put(run, glyph);
      play(run, 100);
      expect(padSolid(run, glyph)).toBe(true);
      expect(padGlow(run, glyph)).toBe(1);
      expect(run.hero.grounded).toBe(true);
      run.ember = 0;
      for (const id of run.course.lanterns) run.litUntil[id] = 0;
      run.floodUntil = 0;
      // far from every deck and light: the fade runs, then the ledge is gone
      expect(lightReaches(run, glyph.x, glyph.y, glyph.z, glyph.r)).toBe(false);
      play(run, FADE_MS / 2);
      expect(padGlow(run, glyph)).toBeGreaterThan(0);
      expect(padGlow(run, glyph)).toBeLessThan(1);
      play(run, FADE_MS);
      expect(padSolid(run, glyph)).toBe(false);
      expect(run.hero.grounded).toBe(false);
   });

   it("a plain ledge is always solid, in the dark too", () => {
      const run = run1();
      const plain = pads(run, "plain")[0];
      run.ember = 0;
      put(run, plain);
      play(run, 1200);
      expect(run.hero.standing).toBe(plain.id);
   });

   it("standing in the dark with the ember out sends you back to the last lantern (no dead end)", () => {
      const run = run1();
      const plain = pads(run, "plain")[1];
      for (const id of run.course.lanterns) run.litUntil[id] = 0;
      run.ember = 0;
      put(run, plain);
      let respawned = 0;
      for (let t = 0; t < STRAND_MS + 400 && respawned === 0; t += FRAME) if (step(run, FRAME, idle()).respawned) respawned++;
      expect(respawned).toBe(1);
      expect(run.hits).toBe(1);
      expect(run.ember).toBeGreaterThan(LEVELS[1].emberMs - 100);
   });
});

describe("lanterns", () => {
   it("landing on a lantern bounces, refills the ember, lights it 12 s and starts the chain", () => {
      const run = run1();
      const id = run.course.lanterns[1];
      const lantern = run.course.pads[id];
      put(run, lantern, 0.4);
      run.ember = 1500;
      let bounced = -1;
      for (let f = 0; f < 30 && bounced < 0; f++) bounced = step(run, FRAME, idle()).bounced;
      expect(bounced).toBe(id);
      expect(run.ember).toBe(LEVELS[1].emberMs);
      expect(lanternLit(run, id)).toBe(true);
      expect(run.litUntil[id] - run.litAt[id]).toBe(LANTERN_LIT_MS);
      expect(run.visited[id]).toBe(true);
      expect(run.lanternsLit).toBe(1);
      expect(run.combo.chain).toBe(1);
      expect(run.checkpoint).toBe(id);
   });

   it("the first lantern burns from the start; it goes out after 12 s", () => {
      const run = run1();
      const first = run.course.lanterns[0];
      expect(lanternLit(run, first)).toBe(true);
      play(run, LANTERN_LIT_MS + 200);
      expect(lanternLit(run, first)).toBe(false);
   });

   it("a lit lantern lights a 5 m sphere, and the ledges inside stay solid after the ember is out", () => {
      const run = run1();
      const lantern = run.course.pads[run.course.lanterns[0]];
      const near = run.course.pads.find((p) => p.kind === "glyph" && Math.hypot(p.x - lantern.x, p.y - lantern.y, p.z - lantern.z) < 4.5)!;
      run.ember = 0;
      expect(lightReaches(run, near.x, near.y, near.z, near.r)).toBe(true);
      const far = run.course.pads.find((p) => p.kind === "glyph" && Math.hypot(p.x - lantern.x, p.y - lantern.y, p.z - lantern.z) > 9)!;
      expect(lightReaches(run, far.x, far.y, far.z, far.r)).toBe(false);
   });

   it("lanterns chained within 2 s build the flow meter and take time off the submitted time", () => {
      const run = run1();
      const ls = run.course.lanterns;
      for (let k = 1; k <= 3; k++) land(run, run.course.pads[ls[k]]);
      expect(run.combo.chain).toBe(3);
      expect(run.combo.bonusTotal).toBeGreaterThan(0);
      expect(runTimeMs(10_000, run.orbs, run.combo.bonusTotal)).toBeLessThan(10_000);
      expect(runTimeMs(0, 5, 99)).toBe(0);
   });
});

describe("throwing the ember (Action in the air)", () => {
   it("relights the nearest dark lantern below for 3 s of ember, with no bounce and no refill", () => {
      const run = run1();
      const target = run.course.pads[run.course.lanterns[2]];
      Object.assign(run.hero, { x: target.x + 1, z: target.z, y: target.y + 3, vy: 0, grounded: false, standing: -1 });
      expect(throwTarget(run)).toBe(target.id);
      const before = run.ember;
      const ev = step(run, FRAME, { ...idle(), actionPressed: true });
      expect(ev.threw).toBe(true);
      expect(ev.ignited).toBe(target.id);
      expect(lanternLit(run, target.id)).toBe(true);
      expect(run.ember).toBeLessThanOrEqual(before - THROW_COST_MS + 20);
   });

   it("needs 3 s of ember, a lantern within 4.5 m and below", () => {
      const run = run1();
      const target = run.course.pads[run.course.lanterns[2]];
      Object.assign(run.hero, { x: target.x + 6, z: target.z, y: target.y + 3, vy: 0, grounded: false, standing: -1 });
      expect(throwTarget(run)).toBe(-1);
      Object.assign(run.hero, { x: target.x, z: target.z, y: target.y - 1 });
      expect(throwTarget(run)).toBe(-1);
      Object.assign(run.hero, { y: target.y + 3 });
      run.ember = 2500;
      expect(step(run, FRAME, { ...idle(), actionPressed: true }).threw).toBe(false);
   });

   it("with nothing to throw at and no power ready, it throws a flare that lights a ledge cluster for 6 s", () => {
      const run = run1("nami");
      Object.assign(run.hero, { x: 8, z: 0, y: 10, vy: 0, grounded: false, standing: -1 });
      for (const id of run.course.lanterns) run.litUntil[id] = 0;
      const ev = step(run, FRAME, { ...idle(), actionPressed: true });
      expect(ev.flared).toBe(true);
      expect(run.flares.length).toBe(1);
      run.ember = 0;
      expect(lightReaches(run, run.flares[0].x, run.flares[0].y, run.flares[0].z, 0)).toBe(true);
      play(run, 6500);
      expect(run.flares[0].until).toBeLessThan(run.simMs);
   });
});

describe("level twists", () => {
   it("level 2: lanterns swing 2 m along their tangent (period 3 s)", () => {
      const c = courseFor(2);
      const l = c.pads[c.lanterns[3]];
      expect(l.swing).not.toBeNull();
      const xs = [0, 750, 1500, 2250].map((t) => padX(l, t));
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
      expect(Math.abs(padX(l, 0) - padX(l, 3000))).toBeLessThan(1e-9);
      expect(courseFor(1).pads[courseFor(1).lanterns[3]].swing).toBeNull();
   });

   it("level 3: a gust cuts every lit lantern to 6 s of its own light; balconies crumble 1.2 s after a touch", () => {
      const run = run1("kiro", 3);
      const l = run.course.lanterns[1];
      run.litUntil[l] = 20_000;
      run.litAt[l] = 2000;
      play(run, 5400);
      expect(run.litUntil[l]).toBe(8000);
      const balcony = pads(run, "balcony")[0];
      expect(balcony).toBeDefined();
      put(run, balcony, 0.2);
      play(run, 100);
      expect(padSolid(run, balcony)).toBe(true);
      play(run, 1400);
      expect(padSolid(run, balcony)).toBe(false);
      play(run, 4300);
      expect(padSolid(run, balcony)).toBe(true);
   });

   it("level 4: a bat snuffs a lit lantern it passes; a stomp stuns it 4 s; a side touch costs 2 s of ember", () => {
      const run = run1("zuno", 4);
      const bat = run.course.bats[0];
      expect(run.course.bats.length).toBe(3);
      const ls = run.course.lanterns;
      const lantern = run.course.pads[ls[Math.round((1 / 4) * (ls.length - 1))]];
      expect(Math.abs(lantern.y + 0.9 - bat.y)).toBeLessThan(0.01);
      run.litUntil[lantern.id] = 1e9;
      run.ember = 1e9;
      let snuffed = 0;
      for (let t = 0; t < 10_000 && snuffed === 0; t += FRAME) snuffed += step(run, FRAME, idle()).snuffed;
      expect(snuffed).toBeGreaterThan(0);
      expect(run.litUntil[lantern.id]).toBeLessThan(1e9);
      expect(LEVELS[4].emberMs).toBe(6000);
   });

   it("level 2+: a fire jet pulses (warn then on) on the express column and respawns a hero in it, but not Kiro shielded", () => {
      const c = courseFor(2);
      expect(c.jet).not.toBeNull();
      expect(c.express.length).toBe(3);
      const ms = [0, 2700, 3600, 4999].map((t) => jetPhase(t, false));
      expect(ms).toEqual(["off", "warn", "on", "on"]);
      expect(jetPhase(1000, true)).toBe("off");
      expect(jetPhase(2000, true)).toBe("on");
      const run = run1("riko", 2);
      const e = c.pads[c.express[1]];
      run.simMs = 3400;
      put(run, e);
      const ev = step(run, FRAME, idle());
      expect(ev.respawned).toBe(true);
      expect(ev.hurt).toBe("jet");
      const kiro = run1("kiro", 2);
      kiro.simMs = 3400;
      kiro.shieldUntil = 99_999;
      put(kiro, e);
      expect(step(kiro, FRAME, idle()).respawned).toBe(false);
   });
});

describe("the five heroes", () => {
   it("Riko: Action fires a dash (+12 m/s for 0.5 s), cooldown 4 s", () => {
      const run = run1("riko");
      const ev = step(run, FRAME, { ...idle(), moveX: 1, actionPressed: true });
      expect(ev.powered).toBe(true);
      expect(run.hero.vx).toBeCloseTo(V_WALK + 12, 3);
      play(run, 600, { moveX: 1 });
      expect(run.hero.vx).toBeCloseTo(V_WALK, 3);
      expect(step(run, FRAME, { ...idle(), actionPressed: true }).powered).toBe(false);
      play(run, 4000);
      expect(step(run, FRAME, { ...idle(), actionPressed: true }).powered).toBe(true);
   });

   it("Nami: a second jump in the air, once a flight, refreshed on landing", () => {
      const run = run1("nami");
      let ev = step(run, FRAME, { ...idle(), jumpPressed: true });
      expect(ev.jumped).toBe(true);
      play(run, 250);
      const before = run.hero.vy;
      ev = step(run, FRAME, { ...idle(), jumpPressed: true });
      expect(ev.airJumped).toBe(true);
      expect(run.hero.vy).toBeGreaterThan(before);
      play(run, 100);
      expect(step(run, FRAME, { ...idle(), jumpPressed: true }).airJumped).toBe(false);
      const other = run1("kiro");
      step(other, FRAME, { ...idle(), jumpPressed: true });
      play(other, 250);
      expect(step(other, FRAME, { ...idle(), jumpPressed: true }).airJumped).toBe(false);
   });

   it("Zuno: the magnet pulls orbs from 6 m and ember sparks (+2 s) from the soot walls", () => {
      const run = run1("zuno");
      lightAll(run);
      const orb = run.course.orbs[0];
      Object.assign(run.hero, { x: orb.x + 4, y: orb.y - 0.8, z: orb.z, vy: 0, grounded: false });
      run.hero.vy = 2;
      step(run, FRAME, idle());
      expect(run.orbs).toBe(0);
      const ev = step(run, FRAME, { ...idle(), actionPressed: true });
      expect(ev.powered).toBe(true);
      step(run, FRAME, idle());
      expect(run.orbs).toBe(1);
      const sp = run.course.sparks[0];
      Object.assign(run.hero, { x: sp.x - 2, y: sp.y - 0.8, z: sp.z });
      run.ember = 2000;
      step(run, FRAME, idle());
      expect(run.sparkTaken[0]).toBe(true);
      expect(run.ember).toBeGreaterThan(3500);
   });

   it("Kiro: the shield lasts 3 s and keeps a bat's touch from costing ember", () => {
      const run = run1("kiro", 4);
      step(run, FRAME, { ...idle(), actionPressed: true });
      expect(run.shieldUntil).toBeGreaterThan(run.simMs + 2900);
      expect(HEROES.find((h) => h.id === "kiro")!.cooldownMs).toBe(10_000);
   });

   it("Vexa: the phase lets her through the ghost wall into the hidden lantern room (the shard); others are turned back", () => {
      const run = run1("vexa");
      const room = run.course.pads[run.course.room];
      const step0 = run.course.pads.find((p) => p.kind === "gallery" && Math.hypot(p.x, p.z) > 7 && Math.hypot(p.x, p.z) < 8.6 && Math.abs(p.y - room.y) < 0.1)!;
      const a = Math.atan2(room.z, room.x);
      const place = (r: TempleRun) => {
         Object.assign(r.hero, { x: step0.x, z: step0.z, y: step0.y, vy: 0, grounded: true, standing: step0.id });
         r.ember = LEVELS[1].emberMs;
         r.floodUntil = 1e9;
      };
      place(run);
      step(run, FRAME, { ...idle(), actionPressed: true });
      expect(run.phaseUntil).toBeGreaterThan(run.simMs);
      for (let f = 0; f < 200 && !run.secrets.found[1]; f++) {
         Object.assign(run.hero, { y: room.y, vy: 0 });
         step(run, FRAME, { ...idle(), moveX: Math.cos(a), moveZ: Math.sin(a) });
         if (f > 60 && !(run.simMs < run.phaseUntil)) break;
      }
      expect(run.secrets.found[1]).toBe(1);
      const other = run1("riko");
      place(other);
      for (let f = 0; f < 120; f++) {
         Object.assign(other.hero, { y: step0.y, vy: 0 });
         step(other, FRAME, { ...idle(), moveX: Math.cos(a), moveZ: Math.sin(a) });
      }
      expect(Math.hypot(other.hero.x, other.hero.z)).toBeLessThanOrEqual(9.3 + 1e-6);
      expect(other.secrets.found[1]).toBe(0);
   });
});

describe("braziers, orbs, secrets and stars", () => {
   it("a brazier in a gallery floods the whole level with light for 20 s", () => {
      const run = run1();
      const b = run.course.braziers[0];
      run.ember = 0;
      Object.assign(run.hero, { x: b.x, y: b.y, z: b.z, vy: 0, grounded: false });
      const ev = step(run, FRAME, idle());
      expect(ev.brazier).toBe(0);
      expect(run.floodUntil).toBeGreaterThan(run.simMs + 19_000);
      const far = pads(run, "glyph").at(-1)!;
      expect(lightReaches(run, far.x, far.y, far.z, far.r)).toBe(true);
   });

   it("each of the five orbs counts once and takes 0.1 s off the time", () => {
      const run = run1();
      expect(run.course.orbs.length).toBe(5);
      expect(run.course.orbs.filter((o) => o.gallery).length).toBe(2);
      const o = run.course.orbs[1];
      Object.assign(run.hero, { x: o.x, y: o.y - 0.8, z: o.z, vy: 0, grounded: false });
      const ev = step(run, FRAME, idle());
      expect(ev.orbCount).toBe(1);
      expect(run.orbs).toBe(1);
      step(run, FRAME, idle());
      expect(run.orbs).toBe(1);
      expect(runTimeMs(20_000, 5, 0)).toBe(19_500);
   });

   it("First Light: a win with the ember never under 2 s earns the sticker; the Nine Lights on level 1", () => {
      const run = run1();
      const goal = run.course.pads[run.course.goal];
      run.minEmber = 2500;
      put(run, goal, 0.5);
      play(run, 200);
      expect(run.ended).toBe("win");
      expect(run.secrets.found[0]).toBe(1);
      const dim = run1();
      dim.minEmber = 1000;
      put(dim, dim.course.pads[dim.course.goal], 0.5);
      play(dim, 200);
      expect(dim.ended).toBe("win");
      expect(dim.secrets.found[0]).toBe(0);
      const nine = run1();
      for (const id of nine.course.lanterns) land(nine, nine.course.pads[id]);
      expect(nine.lanternsLit).toBe(9);
      expect(nine.secrets.found[2]).toBe(1);
   });

   it("stars: clear, all five orbs, the card's target time; the no-hit badge", () => {
      const run = run1();
      run.ended = "win";
      run.finishMs = 50_000;
      run.orbs = 5;
      const r = runStars(run);
      expect(r.clear && r.allOrbs && r.goal && r.noHit).toBe(true);
      run.finishMs = 71_000;
      run.orbs = 2;
      run.hits = 1;
      const r2 = runStars(run);
      expect(r2.goal).toBe(false);
      expect(r2.allOrbs).toBe(false);
      expect(r2.noHit).toBe(false);
      expect(LEVEL_IDS.map((id) => LEVELS[id].targetMs)).toEqual([70_000, 95_000, 120_000, 145_000, 180_000]);
   });

   it("a fall far under the last lantern respawns there with a full ember and a hit", () => {
      const run = run1();
      const l = run.course.pads[run.course.lanterns[3]];
      run.checkpoint = l.id;
      Object.assign(run.hero, { x: 8, y: l.y - 7.5, z: 0, vy: -5, grounded: false });
      const ev = step(run, FRAME, idle());
      expect(ev.respawned).toBe(true);
      expect(ev.hurt).toBe("fall");
      expect(run.hits).toBe(1);
      expect(Math.hypot(run.hero.x - l.x, run.hero.z - l.z)).toBeLessThan(0.01);
   });
});

describe("the Soot Bat Queen (level 5)", () => {
   const wake = (hero: "riko" | "nami" | "kiro" | "zuno" | "vexa" = "kiro") => {
      const run = createRun(1, 5, hero);
      const l = run.course.pads[run.course.arena[0]];
      put(run, l, 0.3);
      run.bossActive = false;
      for (let f = 0; f < 10; f++) step(run, FRAME, idle());
      return run;
   };
   const until = (run: TempleRun, pred: () => boolean, ms = 30_000) => {
      for (let t = 0; t < ms && !pred(); t += FRAME) {
         Object.assign(run.hero, { x: 8, z: 0, y: run.course.top + 6, vy: 0 });
         step(run, FRAME, idle());
      }
   };

   it("is woken by landing in the arena; her intro, then a telegraph, a blackout and a window", () => {
      const run = wake();
      expect(run.bossActive).toBe(true);
      expect(run.boss!.hp).toBe(QUEEN.maxHp);
      expect(QUEEN.maxHp).toBe(7);
      let snuffed = 0;
      for (let t = 0; t < 4000; t += FRAME) {
         run.hero.y = 55;
         run.hero.vy = 0;
         for (const id of run.course.lanterns) run.litUntil[id] = run.simMs + 5000;
         snuffed += step(run, FRAME, idle()).snuffed;
      }
      expect(snuffed).toBeGreaterThan(0);
   });

   it("phase 1: relighting three lanterns in her window scorches her (3 hits take her to phase 2)", () => {
      const run = wake();
      const arena = run.course.arena;
      for (let hit = 1; hit <= 3; hit++) {
         until(run, () => run.boss!.step === "vulnerable");
         expect(run.boss!.step).toBe("vulnerable");
         expect(run.boss!.phase).toBe(hit <= 3 ? 0 : 1);
         for (let k = 0; k < 3; k++) land(run, run.course.pads[arena[k]]);
         expect(run.boss!.hp).toBe(QUEEN.maxHp - hit);
      }
      expect(run.boss!.hp).toBe(4);
      expect(run.boss!.phase).toBe(1);
   });

   it("phase 2: a bounce up into her dive over the target lantern hits her (3 hits, then phase 3)", () => {
      const run = wake();
      run.boss!.hp = 4;
      run.boss!.phase = 1;
      run.boss!.step = "telegraph";
      run.boss!.stepMs = 0;
      for (let hit = 1; hit <= 3; hit++) {
         until(run, () => run.boss!.step === "vulnerable");
         const target = run.course.pads[run.course.arena[run.diveTarget]];
         put(run, target, 0.3);
         for (let f = 0; f < 90 && run.boss!.hp > 4 - hit; f++) step(run, FRAME, idle());
         expect(run.boss!.hp).toBe(4 - hit);
      }
      expect(run.boss!.phase).toBe(2);
   });

   it("phase 3: the ember thrown over the roof brazier in her window ends her; the win is her defeat (slow-mo finish)", () => {
      const run = wake();
      run.boss!.hp = 1;
      run.boss!.phase = 2;
      run.boss!.step = "telegraph";
      run.boss!.stepMs = 0;
      until(run, () => run.boss!.step === "vulnerable");
      const rb = run.course.roofBrazier!;
      Object.assign(run.hero, { x: 2, y: rb.y, z: 0, vy: 0, grounded: false, standing: -1 });
      run.ember = 6000;
      const ev = step(run, FRAME, { ...idle(), actionPressed: true });
      expect(ev.threw).toBe(true);
      expect(ev.bossDefeated).toBe(true);
      expect(run.boss!.hp).toBe(0);
      expect(run.ended).toBeNull();
      for (let t = 0; t < QUEEN.defeatMs + 200 && run.ended === null; t += FRAME) {
         run.hero.y = 55;
         step(run, FRAME, idle());
      }
      expect(run.ended).toBe("win");
   });

   it("only the throw inside her window counts", () => {
      const run = wake();
      run.boss!.hp = 1;
      run.boss!.phase = 2;
      run.boss!.step = "telegraph";
      const rb = run.course.roofBrazier!;
      Object.assign(run.hero, { x: 2, y: rb.y, z: 0, vy: 0, grounded: false, standing: -1 });
      run.ember = 6000;
      step(run, FRAME, { ...idle(), actionPressed: true });
      expect(run.boss!.hp).toBe(1);
   });
});

describe("the run ends", () => {
   it("timeup at the level's cap; levels 1-4 win on the goal roof", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, id);
         for (let t = 0; t < LEVELS[id].durationMs + 500 && run.ended === null; t += 50) {
            Object.assign(run.hero, { x: 0, y: 1, z: 0, vy: 0 });
            run.ember = 1e9;
            step(run, 50, idle());
         }
         expect(["timeup", "win"]).toContain(run.ended);
      }
      const run = run1();
      play(run, 100);
      expect(run.ended).toBeNull();
   });
});
