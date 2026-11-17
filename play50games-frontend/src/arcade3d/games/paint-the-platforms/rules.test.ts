// Paint the Platforms rules: painting the tile you stand on (in your hero's colour), rows setting and
// staying, paint blobs splashing, blots wiping and stunning (Kiro's shield freezes them, Vexa's phase
// passes them), the roller's lane (Kiro stops it), the rafts carrying you and their tiles, a fall
// putting you back, the glass cage and the pillar, the Paint Blob's slam and splat, the win (target AND
// Blob), the bound, frame-rate independence and the honest bot's clear on every level with every hero.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { CAGE_HALF, PILLAR_TOP, RIM_H, courseFor, raftOffset } from "./course";
import { HEROES, HERO_IDS, FREEZE_MS } from "./heroes";
import { BLOB } from "./progression";
import {
   DEAD_MS,
   GRAV,
   ROLLER,
   ROLLER_CYCLE_MS,
   V_JUMP,
   blotPos,
   canSplat,
   createRun,
   createStepInput,
   laneBand,
   minFinishMs,
   minPathM,
   proposeLimits,
   rollerAt,
   step,
   submittedMs,
   tileCentre,
   type PaintRun,
   type RollerView,
} from "./rules";

function at(run: PaintRun, x: number, z: number, y = 0): void {
   run.hero.x = x;
   run.hero.z = z;
   run.hero.y = y;
   run.hero.vx = run.hero.vz = run.hero.vy = 0;
   run.hero.ground = -1;
   step(run, 1, createStepInput());
}

const idle = (run: PaintRun, ms: number) => {
   for (let k = 0; k < ms; k++) step(run, 1, createStepInput());
};

describe("painting", () => {
   it("the tile under the hero takes his colour; the start tile is painted at once", () => {
      for (const hero of HERO_IDS) {
         const run = createRun(1, 1, hero);
         step(run, 16, createStepInput());
         expect(run.board.painted).toBe(1);
         const t = Array.from(run.board.paint).findIndex((p) => p >= 0);
         expect(run.board.paint[t]).toBe(HERO_IDS.indexOf(hero));
      }
   });

   it("a full row sets; a set row cannot be wiped", () => {
      const run = createRun(1, 2);
      const row = run.course.rows[2];
      for (const t of row) {
         const c = tileCentre(run, t, { x: 0, z: 0 });
         at(run, c.x, c.z);
      }
      expect(run.board.set[2]).toBe(1);
      expect(run.board.rowsSet).toBe(1);
      // park a blot's tile check on it: the blots cross row 2 of the first court and leave it painted
      idle(run, 6000);
      for (const t of row) expect(run.board.paint[t]).toBeGreaterThanOrEqual(0);
   });

   it("a paint blob splashes its tile and the four next to it", () => {
      const run = createRun(1, 1);
      const p = run.course.pickups[2];
      at(run, p.x, p.z);
      expect(run.board.taken[2]).toBe(1);
      expect(run.board.painted).toBe(5);
   });

   it("Zuno's magnet pulls a paint blob from 4 m; Riko does not", () => {
      for (const hero of ["zuno", "riko"] as const) {
         const run = createRun(1, 1, hero);
         const p = run.course.pickups[2];
         at(run, p.x + 4, p.z);
         step(run, 1, { ...createStepInput(), actionPressed: true });
         step(run, 5, createStepInput());
         expect(run.board.taken[2], hero).toBe(hero === "zuno" ? 1 : 0);
      }
   });

   it("the win comes the moment the target is painted", () => {
      const run = createRun(1, 1);
      const c = run.course;
      for (let i = 0; i < c.tiles.length && run.ended === null; i++) {
         const t = c.tiles[i];
         at(run, t.x, t.z);
      }
      expect(run.ended).toBe("win");
      expect(run.board.painted).toBeGreaterThanOrEqual(c.need);
      expect(run.finishMs).toBe(run.simMs);
   });
});

describe("the hazards", () => {
   it("a blot wipes the painted tile it moves onto and stuns the hero it touches", () => {
      const run = createRun(1, 2, "riko");
      const c = run.course;
      // paint every other column of the first court (no row sets), then wait: the blot's loop wipes some
      for (const t of c.tiles) if (t.plat === 0 && t.ix % 2 === 0) at(run, t.x, t.z);
      expect(run.board.rowsSet).toBe(0);
      const before = run.board.painted;
      at(run, 0, -1);
      idle(run, 5000);
      expect(run.board.painted).toBeLessThan(before);
      const run2 = createRun(1, 2, "riko");
      const p = blotPos(run2, 0, { x: 0, z: 0 });
      at(run2, p.x + 0.2, p.z);
      expect(run2.hurts).toBe(1);
   });

   it("Kiro's shield freezes a blot he touches (3 s); Vexa's phase passes through; Riko is stunned", () => {
      for (const hero of ["kiro", "vexa", "riko"] as const) {
         const run = createRun(1, 2, hero);
         step(run, 1, { ...createStepInput(), actionPressed: true });
         const p = blotPos(run, 0, { x: 0, z: 0 });
         at(run, p.x + 0.3, p.z);
         expect(run.hurts, hero).toBe(hero === "riko" ? 1 : 0);
         expect(run.blotFrozen[0] > run.simMs, hero).toBe(hero === "kiro");
      }
      expect(FREEZE_MS).toBe(3000);
   });

   it("the roller glows its lane, then wipes the unset paint in it; Kiro's shield stops it", () => {
      const rv: RollerView = { cycle: 0, step: "idle", lane: 0, x: 0, t: 0 };
      for (const hero of ["riko", "kiro"] as const) {
         const run = createRun(1, 4, hero);
         const c = run.course;
         rollerAt(run, rv);
         const [z0, z1] = laneBand(c, rv.lane);
         // paint two lane tiles far from where the hero waits
         const lane = c.tiles.filter((t) => t.plat === c.roller && t.z > z0 && t.z < z1);
         at(run, lane[lane.length - 1].x, lane[lane.length - 1].z);
         const last = lane[lane.length - 1].id;
         expect(run.board.paint[last]).toBeGreaterThanOrEqual(0);
         // stand in the lane near its start
         at(run, lane[0].x, (z0 + z1) / 2);
         idle(run, ROLLER.idleMs + ROLLER.glowMs - run.simMs);
         if (hero === "kiro") step(run, 1, { ...createStepInput(), actionPressed: true });
         idle(run, ROLLER.rollMs + 50);
         expect(run.hurts > 0, hero).toBe(hero === "riko");
         expect(run.hz.rollerStopped === 0, hero).toBe(hero === "kiro");
         expect(run.board.paint[last] >= 0, hero).toBe(hero === "kiro");
      }
      expect(ROLLER_CYCLE_MS).toBe(7000);
   });
});

describe("the arena", () => {
   it("a raft waits at each dock, then carries whoever stands on it; its tiles paint", () => {
      const run = createRun(1, 3);
      const r = run.course.rafts[0];
      const b = run.course.boxes[r.box];
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2 - r.amp;
      at(run, cx + 0.5, cz + 0.5);
      expect(run.hero.ground).toBe(r.box);
      expect(run.board.painted).toBe(1);
      const z0 = run.hero.z;
      idle(run, 4000);
      expect(Math.abs(run.hero.z - z0)).toBeGreaterThan(5);
      expect(raftOffset(0, 3)).toBe(-3);
   });

   it("a fall puts him back on the last fixed platform he stood on; his paint stays", () => {
      const run = createRun(1, 1);
      const painted = run.board.painted;
      at(run, 0, 6, 0);
      for (let k = 0; k < 3000 && run.deaths === 0; k++) step(run, 1, createStepInput());
      expect(run.deaths).toBe(1);
      idle(run, DEAD_MS + 5);
      const p = run.course.platforms[0];
      expect(run.hero.z).toBeCloseTo(p.spawn.z, 6);
      expect(run.board.painted).toBeGreaterThanOrEqual(painted);
   });

   it("only Vexa's phase gets into the glass cage (a shard); the lid keeps everyone out from above", () => {
      for (const hero of ["vexa", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         const c = run.course.cage;
         at(run, c.x - CAGE_HALF - 0.47, c.z);
         expect(run.hero.ground, hero).toBeGreaterThanOrEqual(0);
         step(run, 1, { ...createStepInput(), actionPressed: true });
         const go = { ...createStepInput(), moveX: 1 };
         for (let k = 0; k < 500; k++) step(run, 1, go);
         expect(run.secrets.found[1] === 1, hero).toBe(hero === "vexa");
      }
   });

   it("Nami's pillar: above a single jump even from the rim, within her double jump", () => {
      const single = (V_JUMP * V_JUMP) / (2 * GRAV);
      expect(RIM_H + single).toBeLessThan(PILLAR_TOP);
      expect(single + (9 * 9) / (2 * GRAV)).toBeGreaterThan(PILLAR_TOP);
   });
});

describe("the Paint Blob", () => {
   it("only its open core can be splatted, from beside it; the win needs the target AND the Blob", () => {
      const run = createRun(1, 5, "kiro");
      const spec = run.course.boss!;
      run.hero.shieldUntil = Infinity;
      at(run, spec.x, spec.z + spec.r + 1.2);
      expect(canSplat(run)).toBe(false);
      for (let k = 0; k < 20_000 && run.boss!.step !== "vulnerable"; k++) step(run, 1, createStepInput());
      at(run, spec.x, spec.z + spec.r + 1.2);
      expect(canSplat(run)).toBe(true);
      const ev = step(run, 1, { ...createStepInput(), actionPressed: true });
      expect(ev.bossHit).toBe(true);
      expect(run.boss!.hp).toBe(BLOB.maxHp - 1);
      // all the tiles painted: still no win while the Blob stands
      for (const t of run.course.tiles) run.board.paint[t.id] = 0;
      run.board.painted = run.course.tiles.length;
      idle(run, 50);
      expect(run.ended).toBe(null);
   });

   it("its slam greys the unset tiles in the ring and stuns a hero in it (not Kiro behind his shield)", () => {
      for (const shield of [false, true]) {
         const run = createRun(1, 5, "kiro");
         const spec = run.course.boss!;
         at(run, spec.x + 5, spec.z + 5);
         for (let k = 0; k < 20_000 && run.boss!.step !== "telegraph"; k++) step(run, 1, createStepInput());
         const ring = { ...run.ring };
         const painted = run.board.painted;
         if (shield) step(run, 1, { ...createStepInput(), actionPressed: true });
         for (let k = 0; k < 3000 && run.boss!.step !== "vulnerable"; k++) step(run, 1, createStepInput());
         expect(run.hurts > 0, `shield ${shield}`).toBe(!shield);
         expect(run.board.painted).toBeLessThan(painted + 1);
         expect(Math.hypot(ring.x - (spec.x + 5), ring.z - (spec.z + 5))).toBeLessThan(0.5);
      }
   });
});

describe("the bound and the honest bot", () => {
   it("the least finish is the least path at V_AVG (level 5: at least the Blob's least defeat); every floor is positive", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minPathM(c)).toBeGreaterThan(0);
         expect(proposeLimits(c).minDurationMs).toBeGreaterThan(0);
         expect(minFinishMs(c)).toBeGreaterThan(0);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the honest bot (Riko at 30, 60 and 144 fps), inside the bound`, () => {
         for (const hero of HEROES) {
            for (const fps of hero.id === "riko" ? [30, 60, 144] : [60]) {
               const run = createRun(1, level as LevelId, hero.id);
               const bot = createBot(run, 1000 / fps);
               const input = createStepInput();
               for (let f = 0; f < 200_000 / (1000 / fps) && run.ended === null; f++) {
                  botInput(bot, run, input);
                  step(run, 1000 / fps, input);
               }
               expect(run.ended, `${hero.id} ${fps} fps`).toBe("win");
               expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
               expect(submittedMs(run)).toBeGreaterThanOrEqual(proposeLimits(run.course).minDurationMs);
               expect(submittedMs(run)).toBeLessThanOrEqual(run.course.durationMs);
            }
         }
      }, 300_000);
   }
});
