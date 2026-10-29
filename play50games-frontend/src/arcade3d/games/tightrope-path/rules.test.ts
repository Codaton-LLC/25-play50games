// Tightrope Path rules: walking a link (camera-relative), the needle (drift per element, the still /
// sprint / crouch factors, the correction), the wobble and the fall to the last pillar, gaps and jumps
// (the edge stop, the seeded landing kick, falling into a gap), Nami's double jump and the high orbs,
// gusts, sandbags (crouch), rotating beams, the powers (Riko's dash, Kiro's shield, Zuno's coins,
// Vexa's ghost bridge and its shard), the clean-element chain, the bird secret, Umbra's joust, the
// bound, frame-rate independence and the honest bot's clear on every level.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { buildCourse, courseFor, isBalance, mainRoute, type Course } from "./course";
import {
   BAG,
   BONUS_MS,
   DRIFT,
   FALL_MS,
   LAND_KICK,
   SPRINT_HOLD_MS,
   V_MAX,
   V_SPRINT,
   V_WALK,
   WOBBLE_MS,
   bagCrossing,
   bonusMs,
   bossMinMs,
   createRun,
   createStepInput,
   gustState,
   landKick,
   maxBonusMs,
   minFinishMs,
   minReachMs,
   proposeLimits,
   step,
   submittedMs,
   type StepInput,
   type TightRun,
} from "./rules";
import { POWER_MS } from "./heroes";
import { UMBRA } from "./progression";

/** The input that walks forward along the current link (yaw 0: camera-relative up is -z, so convert). */
function along(run: TightRun, a: number, side = 0): StepInput {
   const l = run.course.links[run.hero.link];
   const input = createStepInput();
   const wx = a * l.dx + side * -l.dz;
   const wz = a * l.dz + side * l.dx;
   input.moveX = wx;
   input.moveZ = wz;
   return input;
}

function runMs(run: TightRun, ms: number, make: (r: TightRun) => StepInput): void {
   for (let i = 0; i < ms && run.ended === null; i++) step(run, 1, make(run));
}

/** Puts the hero at distance s on link `link` with a calm needle. */
function place(run: TightRun, link: number, s: number): void {
   run.hero.link = link;
   run.hero.s = s;
   run.hero.lean = 0;
   run.hero.v = 0;
   run.hero.checkpoint = 0;
}

const first = (c: Course, kind: string): number => c.links.findIndex((l) => l.kind === kind);

describe("walking and the needle", () => {
   it("forward walks at V_WALK on a balance link, sprints after holding forward SPRINT_HOLD_MS, pillars run at V_MAX", () => {
      const run = createRun(1, 1);
      const beam = first(run.course, "beam");
      place(run, beam, 0.5);
      runMs(run, 300, (r) => along(r, 0.5, -Math.sign(r.hero.lean) * Math.min(1, Math.abs(r.hero.lean) * 4)));
      expect(run.hero.v).toBeCloseTo(V_WALK, 3);
      const r2 = createRun(1, 1);
      place(r2, beam, 0.5);
      runMs(r2, SPRINT_HOLD_MS + 400, (r) => along(r, 1, -Math.sign(r.hero.lean) * Math.min(1, Math.abs(r.hero.lean) * 4)));
      expect(r2.hero.sprint).toBe(true);
      expect(r2.hero.v).toBeCloseTo(V_SPRINT, 3);
      const r3 = createRun(1, 1);
      runMs(r3, 300, (r) => along(r, 1));
      expect(r3.hero.v).toBeCloseTo(V_MAX, 3);
   });

   it("the camera turns the stick: the same walk at any yaw", () => {
      for (const yaw of [0.7, -2.1, Math.PI]) {
         const a = createRun(2, 1);
         const b = createRun(2, 1);
         for (let i = 0; i < 400; i++) {
            const w = along(a, 1);
            // a stick that, through yaw, means the same world push
            const t = createStepInput();
            t.yaw = yaw;
            t.moveX = Math.cos(yaw) * w.moveX - Math.sin(yaw) * w.moveZ;
            t.moveZ = Math.sin(yaw) * w.moveX + Math.cos(yaw) * w.moveZ;
            step(a, 1, t);
            step(b, 1, w);
         }
         expect(a.hero.link).toBe(b.hero.link);
         expect(a.hero.s).toBeCloseTo(b.hero.s, 6);
      }
   });

   it("the needle drifts faster on a rope than a plank, 3x sprinting, half crouched; the stick across corrects it", () => {
      expect(DRIFT.rope).toBeGreaterThan(DRIFT.beam);
      expect(DRIFT.beam).toBeGreaterThan(DRIFT.plank);
      const drift = (kind: string, make: (r: TightRun) => StepInput, ms = 400) => {
         const run = createRun(3, 1);
         place(run, first(run.course, kind), 0.3);
         run.hero.lean = 0.3;
         runMs(run, ms, make);
         return Math.abs(run.hero.lean - 0.3);
      };
      const still = (r: TightRun) => along(r, 0);
      expect(drift("rope", still)).toBeGreaterThan(drift("plank", still));
      const crouch = (r: TightRun) => ({ ...along(r, 0), actionHeld: true });
      expect(drift("rope", crouch)).toBeLessThan(drift("rope", still));
      const run = createRun(3, 1);
      place(run, first(run.course, "rope"), 0.3);
      run.hero.lean = 0.6;
      runMs(run, 400, (r) => along(r, 0, -1));
      expect(run.hero.lean).toBeLessThan(0.3);
   });

   it("past 100 % the hero wobbles; still there WOBBLE_MS later he falls, and FALL_MS later stands on the last pillar", () => {
      const run = createRun(1, 1);
      const rope = first(run.course, "rope");
      place(run, rope, 3);
      run.hero.checkpoint = rope - 1;
      run.hero.lean = 1.2;
      let wobble = false;
      let fell = -1;
      for (let i = 0; i < WOBBLE_MS + 50 && fell < 0; i++) {
         const ev = step(run, 1, along(run, 0, 1));
         if (ev.wobble) wobble = true;
         if (ev.fell) fell = i;
      }
      expect(wobble).toBe(true);
      expect(fell).toBeGreaterThanOrEqual(WOBBLE_MS - 2);
      expect(run.falls).toBe(1);
      runMs(run, FALL_MS, (r) => along(r, 0));
      expect(run.hero.fallMs).toBe(-1);
      expect(run.hero.link).toBe(rope - 1);
      expect(run.hero.lean).toBe(0);
   });

   it("a wobble caught in time recovers (the gasp) and breaks the clean chain", () => {
      const run = createRun(1, 1);
      place(run, first(run.course, "beam"), 1);
      run.hero.lean = 1.05;
      let recovered = false;
      for (let i = 0; i < 400; i++) if (step(run, 1, along(run, 0, -1)).recovered) recovered = true;
      expect(recovered).toBe(true);
      expect(run.falls).toBe(0);
      expect(run.wobbles).toBe(1);
      expect(run.clean).toBe(false);
   });
});

describe("gaps and jumps", () => {
   const gapLink = (c: Course) => c.links.findIndex((l) => l.gap > 0);

   it("walking stops at a gap's edge; a jump crosses it and the landing kicks the needle the level's fixed way", () => {
      const run = createRun(1, 1);
      const g = gapLink(run.course);
      const l = run.course.links[g];
      place(run, g, l.len - 0.5);
      runMs(run, 800, (r) => along(r, 0.5, -r.hero.lean * 3));
      expect(run.hero.link).toBe(g);
      expect(run.hero.s).toBeCloseTo(l.len, 6);
      run.hero.lean = 0;
      let kick = 0;
      step(run, 1, { ...along(run, 0), jumpPressed: true });
      for (let i = 0; i < 900 && run.hero.air; i++) kick += step(run, 1, along(run, 0)).kick;
      expect(run.hero.link).toBe(l.next);
      expect(kick).toBeCloseTo(landKick(1, l.next), 6);
      expect(Math.abs(landKick(1, l.next))).toBe(LAND_KICK);
      expect(landKick(1, l.next)).toBe(landKick(1, l.next));
   });

   it("a jump from 1.2 m short of the edge lands in the gap: into the mist", () => {
      const run = createRun(1, 1);
      const g = gapLink(run.course);
      const l = run.course.links[g];
      const short = createRun(1, 1);
      place(short, g, l.len - 1.2);
      step(short, 1, { ...along(short, 0), jumpPressed: true });
      let fell = false;
      for (let i = 0; i < 900; i++) if (step(short, 1, along(short, 0)).fell) fell = true;
      expect(fell).toBe(true);
   });

   it("Nami's second jump reaches a high orb over the gap; a single jump never does", () => {
      for (const hero of ["nami", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         const o = run.course.orbs.find((q) => q.high)!;
         const l = run.course.links[run.course.links[o.link].prev];
         place(run, l.id, l.len);
         step(run, 1, { ...along(run, 0), jumpPressed: true });
         let jumped2 = false;
         for (let i = 0; i < 1500 && (run.hero.air || i < 5); i++) {
            const second = hero === "nami" && !jumped2 && run.hero.vy < 2.5;
            if (second) jumped2 = true;
            step(run, 1, { ...along(run, 0), jumpPressed: second });
         }
         expect(run.highs, hero).toBe(hero === "nami" ? 1 : 0);
      }
   });
});

describe("elements", () => {
   it("a gust telegraphs 1 s, pushes 1.5 s; a gust on a rope pushes the needle its way; Kiro's shield stops all drift", () => {
      const c = courseFor(2);
      const g = c.gusts[0];
      let at = 0;
      while (gustState(g, at) !== 2) at++;
      expect(gustState(g, at - 1)).toBe(1);
      const push = (hero: "kiro" | "riko", shield: boolean) => {
         const run = createRun(1, 2, hero);
         run.simMs = at - 1;
         place(run, g.link, (g.s0 + g.s1) / 2);
         if (shield) step(run, 1, { ...along(run, 0), actionPressed: true });
         runMs(run, 1200, (r) => along(r, 0));
         return run.hero.lean;
      };
      expect(Math.sign(push("riko", false))).toBe(g.sign);
      expect(push("kiro", true)).toBe(0);
   });

   it("a sandbag hits a standing hero on its crossing (a kick and a stagger); a crouched one ducks it", () => {
      const c = courseFor(3);
      const b = c.sandbags[0];
      let at = 1;
      while (Number.isNaN(bagCrossing(b, at + 1))) at++;
      for (const crouch of [false, true]) {
         const run = createRun(1, 3);
         run.simMs = at;
         place(run, b.link, b.s);
         let hit = false;
         for (let i = 0; i < 2 * BAG.window * b.periodMs + 5; i++) if (step(run, 1, { ...along(run, 0), actionHeld: crouch }).bagHit) hit = true;
         expect(hit, `crouch ${crouch}`).toBe(!crouch);
      }
   });

   it("a rotating beam pushes the needle in its spin direction", () => {
      const c = courseFor(4);
      const spin = c.links.find((l) => l.kind === "spin")!;
      const run = createRun(1, 4, "riko");
      place(run, spin.id, 2);
      run.w1 = run.w2 = 0;
      runMs(run, 300, (r) => along(r, 0));
      expect(Math.sign(run.hero.lean)).toBe(spin.spin);
   });
});

describe("hero powers and secrets", () => {
   it("Riko dashes a whole dash rope in 0.4 s, the needle untouched", () => {
      const c = courseFor(2);
      const d = c.links.find((l) => l.kind === "dash")!;
      const run = createRun(1, 2, "riko");
      place(run, d.id, 0.2);
      run.hero.lean = 0.2;
      step(run, 1, { ...along(run, 0), actionPressed: true });
      runMs(run, POWER_MS.dash + 2, (r) => along(r, 0));
      expect(run.hero.link).toBe(d.next);
      expect(run.hero.lean).toBeCloseTo(0.2, 1);
   });

   it("Zuno's magnet pulls up the coins within reach; nobody else gets them", () => {
      for (const hero of ["zuno", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         const k = run.course.coins[0];
         place(run, k.link, k.s);
         step(run, 1, { ...along(run, 0), actionPressed: true });
         runMs(run, 60, (r) => along(r, 0));
         expect(run.coins > 0, hero).toBe(hero === "zuno");
      }
   });

   it("Vexa phasing on a ghost pillar walks the ghost bridge and finds the shard; the others take the main way", () => {
      for (const hero of ["vexa", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         const p = run.course.links.find((l) => l.alt >= 0)!;
         place(run, p.id, p.len - 0.5);
         step(run, 1, { ...along(run, 0), actionPressed: true });
         let ghost = false;
         for (let i = 0; i < 9000 && run.ended === null; i++) {
            step(run, 1, along(run, 1, -run.hero.lean * 3));
            if (run.course.links[run.hero.link].kind === "ghost") ghost = true;
            if (run.course.links[run.hero.link].kind === "pillar" && run.hero.link !== p.id) break;
         }
         expect(ghost, hero).toBe(hero === "vexa");
         expect(!!run.secrets.found[1], hero).toBe(hero === "vexa");
      }
   });

   it("crouching still 5 s on the tower's rope brings the bird (a sticker)", () => {
      const run = createRun(1, 1);
      place(run, run.course.birdLink, 3);
      runMs(run, 5100, (r) => ({ ...along(r, 0, -r.hero.lean * 4), actionHeld: true }));
      expect(!!run.secrets.found[2]).toBe(true);
   });

   it("a clean element (no wobble) links the flow chain and takes its bonus off the time", () => {
      const run = createRun(1, 1);
      const plank = first(run.course, "plank");
      place(run, plank, 0.2);
      runMs(run, 6000, (r) => along(r, 1));
      expect(run.combo.events).toBeGreaterThan(0);
      expect(bonusMs(run)).toBeGreaterThan(0);
   });
});

describe("Umbra", () => {
   it("wakes on the joust rope; hits land only in his open windows, from the right spot", () => {
      const run = createRun(1, 5);
      const a = run.course.arenaStart;
      expect(run.course.links[a].arena).toBe(1);
      place(run, a - 1, run.course.links[a - 1].len - 0.1);
      runMs(run, 200, (r) => along(r, 1));
      expect(run.bossAwake).toBe(true);
      // a jump outside a window does nothing
      step(run, 1, { ...along(run, 0), jumpPressed: true });
      expect(run.boss!.hp).toBe(UMBRA.maxHp);
   });

   it("his least defeat time is the level 5 floor's boss part", () => {
      const c = courseFor(5);
      expect(minFinishMs(c)).toBeCloseTo(minReachMs(c, c.arenaStart) + bossMinMs(), 6);
      expect(bossMinMs()).toBeGreaterThan(UMBRA.introMs);
   });
});

describe("the bound and the honest bot", () => {
   it("the least finish is the shortest route at V_MAX (Riko's dash counted at 0.4 s); a ghost route counts when shorter", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const route = mainRoute(c);
         let walk = 0;
         for (const i of route) {
            if (i === (c.arenaStart >= 0 ? c.arenaStart : c.goal)) break;
            const l = c.links[i];
            walk += ((l.len + l.gap) / V_MAX) * 1000;
         }
         walk -= (0.5 / V_MAX) * 1000;
         const target = c.arenaStart >= 0 ? c.arenaStart : c.goal;
         expect(minReachMs(c, target)).toBeLessThanOrEqual(walk + 1e-6);
      }
   });

   it("the bonus bound covers every orb, high orb, coin and the most flow", () => {
      const c = courseFor(1);
      expect(maxBonusMs(c)).toBeGreaterThan(c.mainOrbs * BONUS_MS.orb + c.highOrbs * BONUS_MS.high + c.coins.length * BONUS_MS.coin);
      expect(c.links.filter(isBalance).length).toBeGreaterThan(5);
   });

   it("each level's row is its own course's proposeLimits", () => {
      for (const id of LEVEL_IDS) expect(proposeLimits(buildCourse(id))).toEqual(proposeLimits(courseFor(id)));
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot clears at 30, 60 and 144 fps, its submitted time inside the bound`, () => {
         for (const fps of [30, 60, 144]) {
            const run = createRun(1, level as LevelId);
            const bot = createBot(run, 1000 / fps);
            const input = createStepInput();
            for (let f = 0; f < 400_000 / (1000 / fps) && run.ended === null; f++) {
               botInput(bot, run, input);
               step(run, 1000 / fps, input);
            }
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(submittedMs(run)).toBeGreaterThanOrEqual(proposeLimits(run.course).minDurationMs);
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
         }
      }, 400_000);
   }
});
