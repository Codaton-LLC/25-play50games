// Gem Collector 3D rules: the gem train (pickups at the head, links on the exact path, the cap),
// banks (n x n, gold counts 2, banked gems never return), the self-cut and the scatter, the lasso,
// the hazards on the tail (frost sweepers, sinking tiles, slimes), chests, the moving beacon, waves,
// every hero's role, the Gumdrop Glutton, and the pinned limits.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { BANK_CAP, CUT_SKIP, LINK_SPACING, MAX_LINKS, SCATTER_MS, arenaFor, beaconActive, sunkGroup } from "./arena";
import { botRun } from "./bot";
import { GLUTTON } from "./progression";
import type { HeroId } from "./heroes";
import { gemCollector3dMeta } from "./meta";
import {
   CHEW_MS,
   GEM,
   MOUTH_OFFSET,
   PROPOSED_LEVEL_LIMITS,
   RESPAWN_MS,
   YAWN_MIN,
   bossMinMs,
   createRun,
   createStepInput,
   giveTrain,
   levelCleared,
   proposeLimits,
   step,
   teleport,
   trainWeight,
   type GemRun,
   type StepEvents,
   type StepInput,
} from "./rules";

function hold(run: GemRun, ms: number, input: StepInput, onEvent?: (ev: StepEvents) => void, frame = 16): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(frame, left);
      const ev = step(run, d, input);
      onEvent?.(ev);
      input.jumpPressed = false;
      input.actionPressed = false;
      left -= d;
   }
}

const go = (dx: number, dz: number): StepInput => ({ ...createStepInput(), moveX: dx, moveZ: dz });

/** An empty floor: every gem absent (a test then places what it needs). */
function bare(level: LevelId, hero: HeroId = "zuno"): GemRun {
   const run = createRun(1, level, hero);
   run.gemState.fill(GEM.absent);
   return run;
}

function gemsOf(run: GemRun, kind: "clear" | "frost" | "gold", n: number): number[] {
   const out: number[] = [];
   run.arena.gems.forEach((g, i) => {
      if (g.kind === kind && !g.hidden && out.length < n) out.push(i);
   });
   return out;
}

/** Rolls a circle round (cx, cz): the tangent plus a pull to radius r (the stick, camera yaw 0). */
function circle(run: GemRun, cx: number, cz: number, r: number, ms: number, onEvent?: (ev: StepEvents) => void): void {
   const inp = createStepInput();
   for (let t = 0; t < ms && run.ended === null; t += 16) {
      const dx = run.hero.x - cx;
      const dz = run.hero.z - cz;
      const d = Math.hypot(dx, dz) || 1;
      const pull = Math.max(-1.5, Math.min(1.5, (r - d) * 2.5));
      const mx = dz / d + (dx / d) * pull;
      const mz = -dx / d + (dz / d) * pull;
      const m = Math.hypot(mx, mz) || 1;
      inp.moveX = mx / m;
      inp.moveZ = mz / m;
      onEvent?.(step(run, 16, inp));
   }
}

describe("the gem train", () => {
   it("a gem rolled over joins the head of the train; the links trail the path LINK_SPACING apart", () => {
      const run = bare(1);
      const ids = gemsOf(run, "clear", 5);
      ids.forEach((gi, k) => {
         run.gemState[gi] = GEM.floor;
         run.gx[gi] = 0;
         run.gz[gi] = -8 + k * 1.2;
      });
      hold(run, 1600, go(0, 1));
      expect(run.n).toBe(5);
      expect(run.links[0]).toBe(ids[4]);
      expect(run.links[4]).toBe(ids[0]);
      for (let k = 0; k + 1 < run.n; k++) {
         const d = Math.hypot(run.linkPos[k * 2] - run.linkPos[k * 2 + 2], run.linkPos[k * 2 + 1] - run.linkPos[k * 2 + 3]);
         expect(d).toBeCloseTo(LINK_SPACING, 1);
      }
   });

   it("at most MAX_LINKS: a full train leaves the next gem on the floor", () => {
      const run = bare(1);
      const ids = run.arena.gems.map((_, i) => i).slice(0, MAX_LINKS + 1);
      giveTrain(run, ids.slice(0, MAX_LINKS));
      const extra = ids[MAX_LINKS];
      run.gemState[extra] = GEM.floor;
      run.gx[extra] = run.hero.x;
      run.gz[extra] = run.hero.z + 0.3;
      run.gy[extra] = 0;
      hold(run, 200, createStepInput());
      expect(run.n).toBe(MAX_LINKS);
      expect(run.gemState[extra]).toBe(GEM.floor);
   });

   it("a bank scores min(400, w x w) with gold counted twice; banked gems never come back", () => {
      for (const [clear, gold, want] of [
         [3, 0, 9],
         [1, 2, 25],
         [0, 12, 400],
         [20, 0, 400],
      ] as const) {
         const run = bare(1);
         const ids = [...gemsOf(run, "clear", clear), ...gemsOf(run, "gold", gold)];
         if (ids.length < clear + gold) {
            // level 1 has fewer gold gems: borrow level gems and paint them gold through a gold-rich level
            continue;
         }
         const b = run.arena.beacons[0];
         teleport(run, b.x, b.z - 3);
         giveTrain(run, ids);
         expect(trainWeight(run)).toBe(clear + gold * 2);
         let pts = -1;
         hold(run, 800, go(0, 1), (ev) => {
            if (ev.bankPoints > 0) pts = ev.bankPoints;
         });
         expect(pts).toBe(want);
         expect(run.n).toBe(0);
         for (const gi of ids) expect(run.gemState[gi]).toBe(GEM.banked);
         expect(Math.min(BANK_CAP, (clear + 2 * gold) ** 2)).toBe(want);
      }
   });

   it("crossing your own tail cuts it there: the cut links lie loose for SCATTER_MS, then are gone", () => {
      const run = bare(1);
      teleport(run, 0, -2);
      giveTrain(run, gemsOf(run, "clear", 14));
      let cut: StepEvents | null = null;
      circle(run, 0, 0, 1.1, 3000, (ev) => {
         if (ev.cut >= 0 && !cut) cut = { ...ev };
      });
      expect(cut).not.toBeNull();
      expect(cut!.cut).toBeGreaterThanOrEqual(CUT_SKIP);
      const loose = Array.from(run.gemState).map((s, i) => (s === GEM.loose ? i : -1)).filter((i) => i >= 0);
      expect(loose.length).toBeGreaterThan(0);
      hold(run, SCATTER_MS + 100, createStepInput());
      for (const gi of loose) expect([GEM.eaten, GEM.train]).toContain(run.gemState[gi]);
   });

   it("Vexa's phase lets the train cross itself (no cut while it lasts)", () => {
      const run = bare(1, "vexa");
      teleport(run, 0, -2);
      giveTrain(run, gemsOf(run, "clear", 14));
      const p = createStepInput();
      p.actionPressed = true;
      step(run, 1, p);
      let cuts = 0;
      circle(run, 0, 0, 1.1, 1900, (ev) => {
         if (ev.cut >= 0) cuts++;
      });
      expect(cuts).toBe(0);
   });

   it("a closed loop round a chewing slime freezes it into a gold gem on its spot (level 3)", () => {
      const run = bare(3);
      const s = 0;
      run.slimeBite[s] = 0;
      run.slimeBite.fill(1e9, 1);
      run.slimeAlive.fill(0);
      run.slimeAlive[s] = 1;
      const sx = run.slimeX[s];
      const sz = run.slimeZ[s];
      teleport(run, sx + 1.5, sz);
      giveTrain(run, gemsOf(run, "clear", 14));
      // keep it chewing (still) for the whole loop
      let lassoed = -1;
      circle(run, sx, sz, 1.4, CHEW_MS - 200, (ev) => {
         if (ev.lassoed >= 0) lassoed = ev.lassoed;
      });
      expect(lassoed).toBe(s);
      expect(run.slimeAlive[s]).toBe(0);
      const gi = run.arena.slimeGem0 + s;
      expect(run.gemState[gi]).not.toBe(GEM.absent);
      expect(run.arena.gems[gi].kind).toBe("gold");
   });
});

describe("hazards on the tail", () => {
   it("the frost sweeper cuts the links in its band; Kiro's shield keeps the tail", () => {
      for (const hero of ["zuno", "kiro"] as const) {
         const run = bare(1, hero);
         const sw = run.arena.sweepers[0];
         teleport(run, (sw.x0 + sw.x1) / 2, sw.z1 - 0.3, 1, 0);
         giveTrain(run, gemsOf(run, "clear", 6));
         const p = createStepInput();
         p.actionPressed = hero === "kiro";
         let cuts = 0;
         // wait for the band to sweep across (its period from wherever the clock is)
         hold(run, sw.periodMs, p, (ev) => {
            if (ev.cut >= 0) cuts++;
         });
         if (hero === "kiro") {
            expect(cuts, "kiro").toBe(0);
            expect(run.n).toBe(6);
         } else expect(cuts).toBeGreaterThan(0);
      }
   });

   it("level 2: rolling into a sunk tile loses the train (it scatters) and respawns at the start", () => {
      const run = bare(2);
      const tiles = run.arena.tiles!;
      const g = sunkGroup(tiles, 1);
      const cell = tiles.cells.find((c) => c.group === g)!;
      teleport(run, (cell.x0 + cell.x1) / 2, cell.z0 - 1.2);
      giveTrain(run, gemsOf(run, "clear", 5));
      let fell = false;
      hold(run, 900, go(0, 1), (ev) => {
         if (ev.fell) fell = true;
      });
      expect(fell).toBe(true);
      expect(run.n).toBe(0);
      hold(run, RESPAWN_MS + 100, createStepInput());
      expect(run.hero.lostUntil).toBe(-1);
      expect(run.hero.z).toBeCloseTo(run.arena.startZ, 1);
   });
});

describe("the vault's twists", () => {
   it("level 4: a chest bursts into its six gems; the one open beacon moves every 15 s", () => {
      const run = bare(4);
      const c = run.arena.spec.chests[1];
      teleport(run, c.x, c.z - 3);
      hold(run, 700, go(0, 1));
      expect(run.chestOpen[1]).toBe(1);
      for (let j = 0; j < 6; j++) expect(run.gemState[run.arena.chestGem0 + 6 + j]).not.toBe(GEM.absent);
      const a = run.arena;
      expect([0, 1, 2].map((b) => beaconActive(a, b, 100))).toEqual([true, false, false]);
      expect([0, 1, 2].map((b) => beaconActive(a, b, 15_100))).toEqual([false, true, false]);
      expect([0, 1, 2].map((b) => beaconActive(a, b, 30_100))).toEqual([false, false, true]);
   });

   it("the vault refills on its schedule: wave k appears at (k + 1) x waveEveryMs", () => {
      const run = createRun(1, 1);
      const a = run.arena;
      const wave0 = a.gems.map((g, i) => (g.from === "wave" && g.source === 0 ? i : -1)).filter((i) => i >= 0);
      expect(wave0.length).toBeGreaterThan(0);
      hold(run, a.waveEveryMs - 50, createStepInput());
      for (const gi of wave0) expect(run.gemState[gi]).toBe(GEM.absent);
      hold(run, 100, createStepInput());
      for (const gi of wave0) expect(run.gemState[gi]).toBe(GEM.floor);
   });
});

describe("hero roles (every level has all five)", () => {
   it("Zuno's magnet pulls the rim's hidden gems out (others never see them) and reaches 1.5 m further", () => {
      for (const hero of ["riko", "zuno"] as const) {
         const run = createRun(1, 1, hero);
         const hidden = run.arena.gems.map((g, i) => (g.hidden ? i : -1)).filter((i) => i >= 0);
         const gi = hidden[0];
         teleport(run, run.gx[gi] * 0.8, run.gz[gi] * 0.8);
         const p = createStepInput();
         p.actionPressed = true;
         hold(run, 600, p);
         if (hero === "zuno") expect(run.revealed[gi]).toBe(1);
         else expect(run.revealed[gi]).toBe(0);
      }
   });

   it("Nami's second jump lands on the high pedestal and takes its gold; a plain jump never gets up", () => {
      for (const hero of ["nami", "zuno"] as const) {
         for (const id of LEVEL_IDS) {
            const run = createRun(1, id, hero);
            const p = run.arena.pedestals[0];
            const gi = run.arena.gems.findIndex((g) => g.y > 1);
            expect(gi, `L${id}`).toBeGreaterThanOrEqual(0);
            teleport(run, p.x, p.z - 1.9);
            const inp = go(0, 0.45);
            inp.jumpPressed = true;
            hold(run, 200, inp);
            inp.jumpPressed = true;
            hold(run, 1200, inp);
            if (hero === "nami") expect(run.gemState[gi], `L${id}`).toBe(GEM.train);
            else expect(run.gemState[gi], `L${id}`).toBe(GEM.floor);
         }
      }
   });

   it("Riko's dash breaks the cracked crystal wall to the pocket; rolling into it never does", () => {
      for (const hero of ["riko", "zuno"] as const) {
         const run = createRun(1, 1, hero);
         const w = run.arena.spec.crackedWalls[0];
         teleport(run, w.x0 - 2, (w.z0 + w.z1) / 2, 1, 0);
         hold(run, 300, go(1, 0));
         const p = go(1, 0);
         p.actionPressed = true;
         hold(run, 900, p);
         expect(run.wallBroken[0], hero).toBe(hero === "riko" ? 1 : 0);
         if (hero === "zuno") expect(run.hero.x).toBeLessThan(w.x0);
      }
   });

   it("Vexa's phase takes her through the ghost wall into the back vault (others are stopped)", () => {
      for (const hero of ["vexa", "riko"] as const) {
         const run = createRun(1, 1, hero);
         const gw = run.arena.spec.ghostWall;
         teleport(run, (gw.x0 + gw.x1) / 2, gw.z0 - 1.2);
         const p = go(0, 1);
         p.actionPressed = true;
         hold(run, 900, p);
         if (hero === "vexa") expect(run.hero.z).toBeGreaterThan(gw.z1);
         else expect(run.hero.z).toBeLessThan(gw.z0);
      }
   });

   it("Riko's dash snaps the train straight behind him (no cut while it lasts)", () => {
      const run = bare(1, "riko");
      teleport(run, 0, -2);
      giveTrain(run, gemsOf(run, "clear", 10));
      circle(run, 0, 0, 1.6, 500);
      const p = go(1, 0);
      p.actionPressed = true;
      hold(run, 16, p);
      // straight: the last link is (n) x spacing behind the head
      const k = run.n - 1;
      const d = Math.hypot(run.linkPos[k * 2] - run.hero.x, run.linkPos[k * 2 + 1] - run.hero.z);
      expect(d).toBeGreaterThan((k + 1) * LINK_SPACING - 0.6);
   });
});

describe("the Gumdrop Glutton (level 5)", () => {
   it("the boss config is valid; his least defeat time is his windows back to back", () => {
      expect(bossProblems(GLUTTON)).toEqual([]);
      const p = GLUTTON.phases;
      const a = (i: number) => p[i].attacks[0].telegraphMs + p[i].attacks[0].attackMs;
      expect(bossMinMs()).toBe(GLUTTON.introMs + 3 * a(0) + GLUTTON.transitionMs + 3 * a(1) + GLUTTON.transitionMs + a(2));
   });

   it("in the yawn no beacon takes a bank, and only a train of 10+ into his mouth hits him", () => {
      for (const links of [YAWN_MIN - 1, YAWN_MIN]) {
         const run = bare(5);
         const b = run.boss!;
         b.phase = 2;
         b.hp = 1;
         b.step = "vulnerable";
         b.stepMs = 0;
         const g = run.glutton;
         teleport(run, g.x, g.z - MOUTH_OFFSET - 3);
         giveTrain(run, gemsOf(run, "clear", links));
         let hit = false;
         hold(run, 600, go(0, 1), (ev) => {
            if (ev.bossHit) hit = true;
         });
         expect(hit, `${links}`).toBe(links >= YAWN_MIN);
      }
   });

   it("the honest bot beats all three phases at 30, 60 and 144 fps, never under the least duration", () => {
      for (const fps of [30, 60, 144]) {
         const run = botRun(5, fps);
         expect(run.ended, `${fps}`).toBe("win");
         expect(run.boss!.hp).toBe(0);
         expect(run.simMs).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[5].minDurationMs);
         expect(run.score).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[5].maxScore);
      }
   }, 120_000);
});

describe("the levels clear (README 'What the bots reached')", () => {
   for (const id of [1, 2, 3, 4] as const) {
      it(`level ${id}: the honest bot reaches the target at 30, 60 and 144 fps, inside the limits`, () => {
         for (const fps of [30, 60, 144]) {
            const run = botRun(id, fps);
            expect(run.ended).toBe("time");
            expect(levelCleared(run), `${fps}`).toBe(true);
            expect(run.score).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
         }
      }, 120_000);
   }

   it("idle: the round runs out with nothing scored (not cleared)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 10_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("time");
         expect(run.score).toBe(0);
         expect(levelCleared(run)).toBe(false);
      }
   });
});

describe("the pinned limits", () => {
   it("each level's row is its own proposeLimits, shipped by meta (with the clear score)", () => {
      for (const id of LEVEL_IDS) {
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id, arenaFor(id)));
         expect(gemCollector3dMeta.levels![id - 1].scoring).toMatchObject({ kind: "points", maxScore: lim.maxScore, minDurationMs: lim.minDurationMs, maxDurationMs: lim.maxDurationMs, base: 0, maxPointsPerSec: lim.maxPointsPerSec });
         const target = arenaFor(id).spec.targetScore;
         if (target > 0) {
            expect(gemCollector3dMeta.levels![id - 1].clearScore).toBe(target);
            expect(target).toBeLessThanOrEqual(lim.maxScore);
         }
      }
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].maxScore, PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].maxPointsPerSec])).toEqual(PINNED);
   });
});

/** maxScore, minDurationMs, maxDurationMs, maxPointsPerSec per level (README table). */
const PINNED = [
   [4235, 85500, 91000, 50],
   [5449, 95000, 101000, 58],
   [6300, 104500, 111000, 61],
   [7132, 114000, 121000, 63],
   [14157, 29100, 241000, 487],
];
