// Menu 2 systems in Rooftop Roll Climb: stars, the flow meter's bound, the secrets and their hero gates,
// and Ashback, the Shadow Armadillo (menu2/boss), raced and rammed on level 5's helipad arena.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { bossProblems, createBoss, phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { createBot, botInput } from "./bot";
import { MAGNET_REACH } from "./heroes";
import { LEDGE_GAP } from "./roofs";
import { ASHBACK, ASHBACK_HIT_SPEED, COMBO_BASE_MS, SECRETS, STAR_TARGET_MS, starSpecFor } from "./progression";
import { NONE, ORB, V_RUN, bossMinMs, comboSpecOf, courseFor, createRun, createStepInput, minArrivalMs, minFinishMs, reachMax, runTimeMs, step, type RoofRun } from "./rules";

const runs = new Map<string, RoofRun>();
function botRun(level: LevelId, fps = 60): RoofRun {
   const key = `${level}:${fps}`;
   const hit = runs.get(key);
   if (hit) return hit;
   const run = createRun(1, level);
   const bot = createBot(run, 1000 / fps);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / fps, input);
   }
   runs.set(key, run);
   return run;
}

/** Put the hero in the air at a spot (its middle there), at rest. */
function hoverAt(run: RoofRun, x: number, y: number, z: number): void {
   const h = run.hero;
   h.x = x;
   h.z = z;
   h.y = y - ORB.centerY;
   h.grounded = false;
   h.support = NONE;
   h.arcStart = run.simMs;
   h.arcY0 = h.y;
   h.arcV = 0;
   h.lastTop = y;
}

describe("stars and the flow meter", () => {
   it("every level has a valid star spec over its coins, and the target time is about 1.5x the honest bot", () => {
      for (const id of LEVEL_IDS) {
         const spec = starSpecFor(id, courseFor(id).orbs.length);
         expect(starSpecProblems(spec)).toEqual([]);
         const run = botRun(id);
         const t = runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
         expect(STAR_TARGET_MS[id], `L${id} bot ${t}`).toBeGreaterThan(t * 1.3);
         expect(STAR_TARGET_MS[id], `L${id} bot ${t}`).toBeLessThan(t * 1.8);
      }
   }, 120_000);

   it("the honest bot's flow bonus never passes the level's bound: coins, first landings and each slope's first banked leap", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const spec = comboSpecOf(c);
         expect(spec.sources).toEqual([
            { count: c.orbs.length, base: COMBO_BASE_MS.orb },
            { count: c.supports.length - 1, base: COMBO_BASE_MS.roof },
            { count: c.slopes, base: COMBO_BASE_MS.bank },
         ]);
         expect(botRun(id).combo.bonusTotal).toBeLessThanOrEqual(comboMaxBonus(spec));
         expect(botRun(id).combo.bonusTotal).toBeGreaterThan(0);
      }
   }, 120_000);
});

describe("secrets: 1 to 3 per level, each behind its hero's gate", () => {
   it("valid lists, one spot each, and every hero has a gate somewhere in the game", () => {
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(courseFor(id).secrets).toHaveLength(SECRETS[id].length);
      }
      const heroes = new Set(LEVEL_IDS.flatMap((id) => SECRETS[id].map((s) => s.hero).filter(Boolean)));
      expect([...heroes].sort()).toEqual(["kiro", "nami", "riko", "vexa", "zuno"]);
      // L3's crane-hook shard is for a perfect rolled leap, not a power
      expect(SECRETS[3].find((s) => s.id === "crane")!.hero).toBeUndefined();
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: a skylight opens only once smashed, a billboard only while phasing, a neon arc only while shielded`, () => {
         const c = courseFor(id);
         c.secrets.forEach((spot, i) => {
            if (spot.gate === "none") return;
            const plain = createRun(1, id);
            hoverAt(plain, spot.x, spot.y, spot.z);
            step(plain, 1, createStepInput());
            expect(plain.secrets.found[i], `${SECRETS[id][i].id} without`).toBe(0);
            const gated = createRun(1, id);
            hoverAt(gated, spot.x, spot.y, spot.z);
            if (spot.gate === "crack") gated.broken[spot.box] = 1;
            if (spot.gate === "ghost") gated.hero.phaseUntil = 10_000;
            if (spot.gate === "arc") gated.hero.shieldUntil = 10_000;
            step(gated, 1, createStepInput());
            expect(gated.secrets.found[i], `${SECRETS[id][i].id} through ${spot.gate}`).toBe(1);
         });
      });
   }

   it("Zuno's gutter secret is out of a normal reach from the slope and inside the magnet's", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         SECRETS[id].forEach((spec, i) => {
            if (spec.id !== "gutter") return;
            const spot = c.secrets[i];
            const slope = c.supports.find((s) => s.slope && Math.abs(s.cz - spot.z) < s.hd + 4 && Math.abs(s.cx - spot.x) < 0.01)!;
            const edgeZ = slope.cz + slope.hd + 0.15;
            const d = Math.abs(spot.z - edgeZ);
            expect(d).toBeGreaterThan(ORB.pickup);
            expect(d).toBeLessThan(MAGNET_REACH);
         });
      }
   });

   it("Nami's water-tower ledges are past a plain leap's reach from their deck, but some hero reaches each", () => {
      expect(LEDGE_GAP).toBeGreaterThan(reachMax(V_RUN, 0, 0));
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const arrive = minArrivalMs(c);
         c.supports.forEach((s, i) => {
            if (s.role === "ledge") expect(Number.isFinite(arrive[i])).toBe(true);
         });
      }
   });
});

describe("Ashback, the Shadow Armadillo (level 5)", () => {
   it("is a valid race boss: three phases (race 2 hits, grey paint 2, helipad duel 3), a slow-mo finish", () => {
      expect(bossProblems(ASHBACK)).toEqual([]);
      expect(ASHBACK.phases.map((p) => p.id)).toEqual(["race", "paint", "duel"]);
      expect(phaseMarks(ASHBACK)).toHaveLength(2);
      expect(createBoss(ASHBACK).hp).toBe(7);
      // P2 needs the card's 10 m/s ram
      expect(ASHBACK_HIT_SPEED[1]).toBe(10);
      expect(ASHBACK.slowMo).toBeTruthy();
   });

   it("his least fight is part of the level's least finish (the first stand on the arena plus bossMinMs); local multiplayer plays the arena as a plain finish", () => {
      const c = courseFor(5);
      const arrive = minArrivalMs(c);
      let first = Infinity;
      c.supports.forEach((s, i) => {
         if (s.arena) first = Math.min(first, arrive[i]);
      });
      expect(bossMinMs()).toBeGreaterThan(15_000);
      expect(minFinishMs(c)).toBeCloseTo(first + bossMinMs(), 6);
      expect(createRun(1, 5).boss).not.toBeNull();
      expect(createRun(1, 5, "riko", { boss: false }).boss).toBeNull();
      expect(createRun(1, 4).boss).toBeNull();
   });

   for (const fps of [30, 60, 144]) {
      it(`the honest bot beats him at ${fps} Hz: seven rams through three phases, the run won on the defeat`, () => {
         const run = botRun(5, fps);
         expect(run.ended).toBe("win");
         expect(run.boss!.state.hp).toBe(0);
         expect(run.finishMs - run.boss!.wokeMs).toBeGreaterThanOrEqual(bossMinMs());
      }, 60_000);
   }

   it("a slow ram does nothing: a hit needs the curled ball at the phase's speed while he is open", () => {
      const run = createRun(1, 5);
      const a = run.course.arena!;
      const pad = run.course.supports[a.pad];
      const b = run.boss!;
      b.wokeMs = 0;
      b.state.step = "vulnerable";
      b.state.stepMs = 0;
      const h = run.hero;
      h.x = a.footA;
      h.z = a.z;
      h.y = pad.top;
      h.grounded = true;
      h.support = a.pad;
      h.vx = 3;
      h.curled = true;
      const ev = step(run, 1, createStepInput());
      expect(ev.bossHit).toBe(false);
      expect(b.state.hp).toBe(7);
   });
});
