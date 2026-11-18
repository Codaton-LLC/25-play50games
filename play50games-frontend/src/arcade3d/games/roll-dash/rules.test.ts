// The rules: each Prism Lock opens only to its hero's power (and a wrong answer on a full lock bounces
// you back), single locks can be dodged, the tag (cooldown, Prism Lock zones, the Hand-off, fresh legs),
// a benched hero recharges twice as fast, crates / signs / carts, hearts, the boost, Full Prism, the
// repaint, the Hawk's three phases, and the fixed step.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { courseFor, laneX } from "./course";
import { HERO_IDS, heroById, type HeroId } from "./heroes";
import {
   BARRIER_H, BENCH_RECHARGE, BOOST, BOUNCE_M, CRATE_H, HEARTS, STEP_MS, TAG_COOLDOWN_MS, canTag, createRun, createStepInput, speedOf, step, type DashRun, type LiveItem, type StepInput,
} from "./rules";
import { HAWK } from "./progression";
import { createBot, botInput } from "./bot";

function steps(r: DashRun, ms: number, input: StepInput = createStepInput()): void {
   const end = r.simMs + ms;
   while (r.simMs < end - 1e-6 && r.ended === null) step(r, STEP_MS, input);
}

/** A lab street: one lock of `colour` across all lanes, 3 m ahead of a hero who is `hero`. */
function labLock(colour: HeroId, hero: HeroId, full = true): { r: DashRun; it: LiveItem } {
   const r = createRun(1, 2, hero);
   r.items = [];
   r.scan = 0;
   const it: LiveItem = { id: 1, kind: "lock", d: 3, depth: colour === "nami" ? 0.6 : 1, lane: full ? -1 : 1, colour, repaint: "", cart: null, now: colour, opened: false, done: false, boss: "" };
   r.items.push(it);
   return { r, it };
}

const tagTo = (hero: HeroId): StepInput => ({ ...createStepInput(), tag: HERO_IDS.indexOf(hero) + 1 });

describe("Prism Locks", () => {
   it("each opens to its own hero's power, and to nothing else", () => {
      for (const colour of HERO_IDS) {
         for (const hero of HERO_IDS) {
            const { r, it } = labLock(colour, hero);
            const fire = createStepInput();
            if (heroById(hero).power === "doubleJump") {
               // jump about 0.6 s out, the second jump at the top of the first
               r.hero.d = it.d - speedOf(r) * 0.6;
               fire.jumpPressed = true;
               step(r, STEP_MS, fire);
               for (let k = 0; k < 120 && r.hero.vy > 0.6; k++) step(r, STEP_MS, createStepInput());
               step(r, STEP_MS, { ...createStepInput(), jumpPressed: true });
            } else {
               r.hero.d = it.d - 1.6;
               fire.actionPressed = true;
               step(r, STEP_MS, fire);
            }
            steps(r, 900);
            expect(it.opened, `${colour} lock, ${hero}`).toBe(colour === hero);
         }
      }
   });

   it("a full lock answered wrong bounces you back BOUNCE_M and costs a heart; it stays to be answered", () => {
      const { r, it } = labLock("vexa", "riko");
      for (let k = 0; k < 200 && !r.ev.bounced; k++) step(r, STEP_MS, createStepInput());
      expect(r.ev.bounced).toBe(true);
      expect(r.hearts).toBe(HEARTS - 1);
      expect(it.opened).toBe(false);
      expect(it.done).toBe(false);
      expect(r.hero.d).toBeLessThan(it.d - BOUNCE_M + 0.6);
   });

   it("a single lock is dodged in another lane", () => {
      const { r, it } = labLock("kiro", "riko", false);
      step(r, STEP_MS, { ...createStepInput(), lane: -1 });
      steps(r, 900);
      expect(r.hearts).toBe(HEARTS);
      expect(it.opened).toBe(false);
   });

   it("a correct unlock boosts the speed by BOOST and lights the spectrum", () => {
      const { r } = labLock("riko", "riko");
      const base = speedOf(r);
      r.hero.d = 1.4;
      step(r, STEP_MS, { ...createStepInput(), actionPressed: true });
      steps(r, 400);
      expect(r.locksOpened).toBe(1);
      expect(r.chainHeroes.has("riko")).toBe(true);
      steps(r, 400);
      expect(speedOf(r)).toBeCloseTo(base + BOOST, 6);
   });

   it("Nyla's barrier needs her second jump (one jump never reaches BARRIER_H)", () => {
      const r = createRun(1, 1, "riko");
      step(r, STEP_MS, { ...createStepInput(), jumpPressed: true });
      let top = 0;
      for (let k = 0; k < 80; k++) {
         step(r, STEP_MS, createStepInput());
         top = Math.max(top, r.hero.y);
      }
      expect(top).toBeLessThan(BARRIER_H);
      expect(top).toBeGreaterThan(CRATE_H);
   });
});

describe("the tag", () => {
   it("swaps the active hero, then waits TAG_COOLDOWN_MS", () => {
      const r = createRun(1, 1, "riko");
      step(r, STEP_MS, tagTo("nami"));
      expect(r.active).toBe("nami");
      expect(canTag(r)).toBe(false);
      step(r, STEP_MS, tagTo("kiro"));
      expect(r.active).toBe("nami");
      steps(r, TAG_COOLDOWN_MS);
      step(r, STEP_MS, tagTo("kiro"));
      expect(r.active).toBe("kiro");
   });

   it("a tag while the power runs is a Hand-off (+1 combo step); a tag on its own scores nothing", () => {
      const r = createRun(1, 1, "kiro");
      step(r, STEP_MS, { ...createStepInput(), actionPressed: true });
      steps(r, 100);
      const before = r.combo.bonusTotal;
      step(r, STEP_MS, tagTo("vexa"));
      expect(r.ev.handOff).toBe(true);
      expect(r.combo.chain).toBe(1);
      expect(r.combo.bonusTotal).toBe(before);
   });

   it("a benched hero recharges BENCH_RECHARGE times faster", () => {
      const r = createRun(1, 1, "kiro");
      step(r, STEP_MS, { ...createStepInput(), actionPressed: true });
      const cd = heroById("kiro").cooldownMs;
      step(r, STEP_MS, tagTo("nami"));
      steps(r, cd / BENCH_RECHARGE + 50);
      expect(r.cool.kiro).toBe(0);
   });

   it("a mid-air tag gives a fresh air action once per airtime", () => {
      const r = createRun(1, 1, "riko");
      step(r, STEP_MS, { ...createStepInput(), jumpPressed: true });
      steps(r, 100);
      step(r, STEP_MS, tagTo("nami"));
      expect(r.hero.freshUsed).toBe(true);
      step(r, STEP_MS, { ...createStepInput(), jumpPressed: true });
      expect(r.hero.airJumped).toBe(true);
   });

   it("level 4's Prism Lock zones refuse a tag", () => {
      const c = courseFor(4);
      expect(c.noTag.length).toBeGreaterThan(0);
      const r = createRun(1, 4, "riko");
      r.hero.d = (c.noTag[0].from + c.noTag[0].to) / 2;
      expect(canTag(r)).toBe(false);
   });
});

describe("the street", () => {
   it("a crate hurts a grounded roller, not one jumping it; a sign hurts unless you tuck", () => {
      for (const jump of [false, true]) {
         const r = createRun(1, 2, "riko");
         r.items = [{ id: 1, kind: "crate", d: 2.5, depth: 1, lane: 1, colour: "", repaint: "", cart: null, now: "", opened: false, done: false, boss: "" }];
         r.scan = 0;
         if (jump) step(r, STEP_MS, { ...createStepInput(), jumpPressed: true });
         steps(r, 500);
         expect(r.hits, `crate jump ${jump}`).toBe(jump ? 0 : 1);
      }
      for (const tuck of [false, true]) {
         const r = createRun(1, 2, "riko");
         r.items = [{ id: 1, kind: "sign", d: 2.5, depth: 0.5, lane: 1, colour: "", repaint: "", cart: null, now: "", opened: false, done: false, boss: "" }];
         r.scan = 0;
         if (tuck) step(r, STEP_MS, { ...createStepInput(), downPressed: true });
         steps(r, 400);
         expect(r.hits, `sign tuck ${tuck}`).toBe(tuck ? 0 : 1);
      }
   });

   it("three hits lose the run", () => {
      const r = createRun(1, 2, "riko");
      r.items = [0, 1, 2].map((k) => ({ id: k, kind: "crate" as const, d: 3 + k * 25, depth: 1, lane: 1, colour: "" as const, repaint: "" as const, cart: null, now: "" as const, opened: false, done: false, boss: "" as const }));
      r.scan = 0;
      steps(r, 10_000);
      expect(r.ended).toBe("lose");
   });

   it("every level is answerable: full locks of one colour come no sooner than that hero recharges", () => {
      for (const id of [2, 3, 4] as const) {
         const c = courseFor(id);
         const v = c.cfg.speed + BOOST;
         const last: Partial<Record<HeroId, number>> = {};
         for (const it of c.items) {
            if (it.kind !== "lock" || it.lane >= 0) continue;
            const col = it.colour as HeroId;
            const prev = last[col];
            if (prev !== undefined && col !== "nami") expect((it.d - prev) / v, `L${id} ${col} at ${it.d}`).toBeGreaterThan(heroById(col).cooldownMs / 1000 / BENCH_RECHARGE);
            last[col] = it.d;
         }
         // a lane always stays free beside a plain obstacle beat
         expect(c.items.every((it) => it.lane < 3)).toBe(true);
      }
   });

   it("level 3's rollers repaint a lock a second before you reach it", () => {
      const c = courseFor(3);
      const it = c.items.find((x) => x.repaint)!;
      expect(it).toBeDefined();
      const r = createRun(1, 3, "riko");
      r.hero.d = it.d - c.cfg.speed * 0.9;
      step(r, STEP_MS, createStepInput());
      const lit = r.items.find((x) => x.id === it.id)!;
      expect(lit.now).toBe(it.repaint);
   });
});

describe("the Echo Storm Hawk (level 5)", () => {
   it("P1: a feather-lock opened with its hero in the window is a hit", () => {
      const r = createRun(1, 5, "riko");
      const bot = createBot(r);
      const input = createStepInput();
      for (let f = 0; f < 120 * 30 && (r.boss!.hp === HAWK.maxHp); f++) {
         botInput(bot, r, input);
         step(r, 1000 / 120, input);
      }
      expect(r.boss!.hp).toBe(HAWK.maxHp - 1);
      expect(r.items.some((x) => x.boss === "feather" && x.opened)).toBe(true);
   });

   it("P2: be the plate's hero and jump into it in its lane; P3: five plates passed as their heroes win", () => {
      const r = createRun(1, 5, "riko");
      const b = r.boss!;
      b.phase = 1;
      b.hp = 4;
      b.step = "vulnerable";
      b.stepMs = 0;
      r.swoopLane = 1;
      r.plateColour = "riko";
      r.hero.y = 1;
      r.hero.vy = 2;
      r.hero.grounded = false;
      step(r, STEP_MS, createStepInput());
      expect(b.hp).toBe(3);
      b.phase = 2;
      b.hp = 1;
      b.step = "vulnerable";
      b.stepMs = 0;
      r.platesRight = 5;
      r.platesSeen = 5;
      step(r, STEP_MS, createStepInput());
      expect(r.ended).toBe("win");
   });

   it("P3's gust pushes you a lane", () => {
      const r = createRun(1, 5, "riko");
      const b = r.boss!;
      b.phase = 2;
      b.hp = 1;
      b.step = "telegraph";
      b.stepMs = HAWK.phases[2].attacks[0].telegraphMs - 1;
      const lane = r.hero.lane;
      steps(r, 50);
      expect(r.hero.lane).not.toBe(lane);
      steps(r, 300);
      expect(r.hero.x).toBeCloseTo(laneX(r.hero.lane), 3);
   });
});

describe("the fixed step", () => {
   it("the same inputs give the same run at 30 and 144 fps", () => {
      const go = (fps: number) => {
         const r = createRun(1, 1, "riko");
         const bot = createBot(r, 1000 / fps);
         const input = createStepInput();
         for (let f = 0; f < 200_000 && r.ended === null; f++) {
            botInput(bot, r, input);
            step(r, 1000 / fps, input);
         }
         return r;
      };
      const a = go(30);
      const b = go(144);
      expect(a.ended).toBe("win");
      expect(b.ended).toBe("win");
      expect(Math.abs(a.finishMs - b.finishMs)).toBeLessThan(1500);
   }, 120_000);

   it("every level has its street", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         if (!c.cfg.boss) expect(c.items.filter((i) => i.kind === "lock").length).toBeGreaterThan(5);
      }
   });
});
