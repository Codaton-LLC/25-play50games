// Robot Factory Run rules: the floors are wired as the bot's route says, belts carry cells and the
// hero, turntables turn on their plates (once per press), cells hold on a turning table or an arm
// pad, run off belt ends into scrap, die under a slamming press, charge the charger, open the exit;
// the klaxon flips its belts; arms lift cells and the hero; lasers block and swap; every hero power;
// M-8's windows; determinism; the store hand-off.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { createBossEvents, stepBoss } from "@/arcade3d/menu2/boss/boss";
import { DC, DR, K, at, colOf, inside, rowOf, tileX, tileZ, type Dir } from "./factory";
import { OVERSEER } from "./progression";
import {
   BELT_V,
   KLAXON_MS,
   ORB,
   PLATE_RESET_MS,
   STAT,
   TURN_MS,
   V_WALK,
   createRun,
   createStepInput,
   finalScore,
   floorFor,
   klaxonOn,
   pressPlate,
   pressState,
   runTimeMs,
   step,
   type FactoryRun,
   type StepInput,
} from "./rules";

const idle = createStepInput();

function hold(run: FactoryRun, ms: number, input: StepInput = idle): void {
   for (let t = 0; t < ms && run.ended === null; t++) step(run, 1, input);
}

/** Follow the route's directions from the dispenser: the tiles a cell visits until it stops. */
function followRoute(level: 1 | 2 | 3 | 4 | 5): { end: number; steps: number } {
   const f = floorFor(level);
   let [c, r] = f.dispenser;
   let d: Dir = f.spec.dispenserDir;
   for (let s = 1; s < 60; s++) {
      c += DC[d];
      r += DR[d];
      if (!inside(c, r)) return { end: -1, steps: s };
      const t = f.tiles[at(c, r)];
      if (t.k === K.Charger) return { end: at(c, r), steps: s };
      if (t.k === K.Turn) d = f.spec.route[t.idx];
      else if (t.k === K.Belt || t.k === K.Disp) d = t.dir;
      else if (t.k === K.Pad) {
         const arm = f.spec.arms.find((a) => a.pad[0] === c && a.pad[1] === r)!;
         [c, r] = arm.drop;
         d = f.tiles[at(c, r)].dir;
      } else return { end: -1, steps: s };
   }
   return { end: -1, steps: 60 };
}

describe("the floors", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: the route's wiring carries a cell from the dispenser into the charger; every main orb sits on a walkable tile; the start is floor`, () => {
         const f = floorFor(id);
         const r = followRoute(id);
         expect(r.end, `L${id}`).toBe(at(f.charger[0], f.charger[1]));
         for (const o of f.spec.orbs) {
            if (o.hero !== null || o.y > 2) continue;
            const t = f.tiles[at(colOf(o.x), rowOf(o.z))];
            expect(t.solid, `orb ${o.x},${o.z}`).toBe(false);
            expect(t.k === K.Laser).toBe(false);
         }
         const [sc, sr] = f.spec.start;
         expect(f.tiles[at(sc, sr)].solid).toBe(false);
         // the initial wiring is NOT the route: the first lesson is a plate
         expect(f.spec.turns.some((d, i) => d !== f.spec.route[i])).toBe(true);
      });
   }

   it("the same level is the same shift for every seed", () => {
      const a = createRun(1, 2);
      const b = createRun(99, 2);
      hold(a, 6000);
      hold(b, 6000);
      expect(a.board.cells.map((c) => [c.live, c.c, c.r, c.prog])).toEqual(b.board.cells.map((c) => [c.live, c.c, c.r, c.prog]));
   });
});

describe("the line", () => {
   it("the dispenser lets a cell out on its beat; it rides 2.5 m/s and runs off a belt end into scrap", () => {
      const run = createRun(1, 1);
      const f = run.floor;
      hold(run, f.spec.firstMs);
      expect(run.board.emitted).toBe(1);
      const c = run.board.cells.find((q) => q.live)!;
      const x0 = c.x;
      hold(run, 400);
      expect(c.x - x0).toBeCloseTo((BELT_V * 400) / 1000, 2);
      // L1's T0 points at the floor at first: the first cell is scrap (the lesson)
      hold(run, 4000);
      expect(run.board.scrapped).toBeGreaterThanOrEqual(1);
   });

   it("a plate turns its table a quarter turn clockwise, once per press (the plate resets), and the table holds cells while it turns", () => {
      const run = createRun(1, 1);
      const before = run.board.turns[0];
      pressPlate(run, 0);
      expect(run.board.turns[0]).toBe((before + 1) % 4);
      pressPlate(run, 0);
      expect(run.board.turns[0]).toBe((before + 1) % 4);
      hold(run, PLATE_RESET_MS + 1);
      pressPlate(run, 0);
      expect(run.board.turns[0]).toBe((before + 2) % 4);
      expect(TURN_MS).toBe(350);
   });

   it("walking onto a plate fires it; the route's plates in order wire L1, two cells charge, the exit opens and walking in wins", () => {
      const run = createRun(1, 1);
      for (const p of [0, 1]) {
         pressPlate(run, p);
         hold(run, PLATE_RESET_MS + 5);
      }
      expect(run.board.turns).toEqual(run.floor.spec.route);
      hold(run, 20000);
      expect(run.board.charged).toBe(2);
      const [ec, er] = run.floor.exit;
      Object.assign(run.hero, { x: tileX(ec), z: tileZ(er) + 0.5 });
      hold(run, 30);
      expect(run.ended).toBe("win");
   });

   it("a press slams on its cycle (warns first) and scraps a cell under it", () => {
      expect(pressState(0, 0)).toBe("up");
      expect(pressState(0, 1600 - 300)).toBe("slam");
      expect(pressState(0, 1600 - 600)).toBe("warn");
   });

   it("the klaxon belts run backwards every other 6 s and a cell on them turns round", () => {
      const f = floorFor(2);
      expect(klaxonOn(f, 0)).toBe(false);
      expect(klaxonOn(f, KLAXON_MS + 1)).toBe(true);
      expect(klaxonOn(f, 2 * KLAXON_MS + 1)).toBe(false);
   });

   it("a belt carries the hero: standing on one moves 2.5 m/s its way; walking adds 5.2 m/s", () => {
      const run = createRun(1, 1);
      // L1 row 8 runs east
      Object.assign(run.hero, { x: tileX(3), z: tileZ(8), tile: at(3, 8) });
      const x0 = run.hero.x;
      hold(run, 200);
      expect(run.hero.x - x0).toBeCloseTo(0.5, 1);
      expect(V_WALK).toBe(5.2);
   });

   it("an arm lifts a waiting cell from its pad to its drop (L3), and lifts the hero standing on its pad", () => {
      const run = createRun(1, 3);
      const a = run.floor.spec.arms[0];
      const c = run.board.cells[0];
      Object.assign(c, { live: true, c: a.pad[0], r: a.pad[1], prog: 0, holding: false, x: tileX(a.pad[0]), z: tileZ(a.pad[1]) });
      hold(run, a.periodMs + 50);
      expect([c.c, c.r]).not.toEqual(a.pad);
      const h = createRun(1, 3);
      const b = h.floor.spec.arms[1];
      Object.assign(h.hero, { x: tileX(b.pad[0]), z: tileZ(b.pad[1]), tile: at(b.pad[0], b.pad[1]) });
      hold(h, b.periodMs + 50);
      expect(h.hero.y).toBeGreaterThan(2);
   });

   it("L4's plates swap the exit lasers: two presses of plate 0 leave them as they were", () => {
      const run = createRun(1, 4);
      const l0 = Array.from(run.board.lasers);
      pressPlate(run, 0);
      expect(Array.from(run.board.lasers)).not.toEqual(l0);
      hold(run, PLATE_RESET_MS + 5);
      pressPlate(run, 0);
      expect(Array.from(run.board.lasers)).toEqual(l0);
   });
});

describe("hero powers", () => {
   it("Riko's dash smashes a cracked crate; Vexa's phase walks through a ghost crate; Kiro's shield through a laser", () => {
      const r = createRun(1, 2, "riko");
      // L2's cracked crate at (1,6): dash west into it from (2,6)
      Object.assign(r.hero, { x: tileX(2), z: tileZ(6), tile: at(2, 6) });
      step(r, 16, { ...createStepInput(), moveX: -1, actionPressed: true });
      hold(r, 300, { ...createStepInput(), moveX: -1 });
      expect(r.board.broken[at(1, 6)]).toBe(1);
      const v = createRun(1, 2, "vexa");
      // the ghost crate at (6,1): from (6,2) north
      Object.assign(v.hero, { x: tileX(6), z: tileZ(2), tile: at(6, 2) });
      step(v, 16, { ...createStepInput(), actionPressed: true });
      hold(v, 600, { ...createStepInput(), moveZ: -1 });
      expect(rowOf(v.hero.z)).toBe(1);
      const k = createRun(1, 1, "kiro");
      Object.assign(k.hero, { x: tileX(6), z: tileZ(4), tile: at(6, 4) });
      step(k, 16, { ...createStepInput(), actionPressed: true });
      hold(k, 500, { ...createStepInput(), moveX: 1 });
      expect(colOf(k.hero.x)).toBeGreaterThanOrEqual(7);
      const n = createRun(1, 1, "nami");
      Object.assign(n.hero, { x: tileX(6), z: tileZ(4), tile: at(6, 4) });
      hold(n, 500, { ...createStepInput(), moveX: 1 });
      expect(colOf(n.hero.x)).toBe(6);
   });

   it("Nami's double jump reaches the catwalk (2.2 m); a plain jump does not", () => {
      for (const [hero, up] of [["nami", true], ["kiro", false]] as const) {
         const run = createRun(1, 1, hero);
         // L1's catwalk (5,1)-(6,1): from (5,2) north
         Object.assign(run.hero, { x: tileX(5), z: tileZ(2) + 0.3, tile: at(5, 2) });
         step(run, 16, { ...createStepInput(), jumpPressed: true, jumpHeld: true });
         hold(run, 150, { ...createStepInput(), moveZ: -1 });
         step(run, 16, { ...createStepInput(), moveZ: -1, actionPressed: true });
         hold(run, 700, { ...createStepInput(), moveZ: -1 });
         expect(run.hero.y > 2, hero).toBe(up);
      }
   });

   it("Zuno's magnet hops a cell one belt towards him and pulls orbs from 4 m", () => {
      const run = createRun(1, 1, "zuno");
      const o = run.floor.spec.orbs.findIndex((q) => q.hero === "zuno");
      const orb = run.floor.spec.orbs[o];
      Object.assign(run.hero, { x: orb.x - 2.5, z: orb.z, tile: at(colOf(orb.x - 2.5), rowOf(orb.z)) });
      step(run, 16, { ...createStepInput(), actionPressed: true });
      expect(run.collected[o]).toBe(1);
   });
});

describe("Overseer M-8", () => {
   it("its windows are time-driven from the start, and a cell into its chest hits only while it glows (P1)", () => {
      const run = createRun(1, 5);
      const ev = createBossEvents();
      const twin = { ...run.boss! };
      hold(run, 2000);
      for (let i = 0; i < 2000; i++) stepBoss(twin, OVERSEER, 1, ev);
      expect(run.boss!.step).toBe(twin.step);
      expect(run.boss!.hp).toBe(OVERSEER.maxHp);
   });
});

describe("the store hand-off and determinism", () => {
   it("finalScore: a win submits the finish minus 200 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      expect(ORB.bonusMs).toBe(200);
      expect(runTimeMs(20000, 5, 300)).toBe(18700);
      const stats = { [STAT.finishMs]: 20000, [STAT.orbs]: 5, [STAT.comboMs]: 300 };
      expect(finalScore({ score: 0, endReason: "win", stats, elapsedMs: 21000 }).durationMs).toBe(18700);
      expect(finalScore({ score: 0, endReason: "timeup", stats, elapsedMs: 90000 }).durationMs).toBe(90000);
   });

   it("the same inputs give the same run at any frame size (whole-ms clock)", () => {
      const runs = [1000 / 30, 1000 / 60, 1000 / 144].map((dt) => {
         const r = createRun(1, 3);
         let t = 0;
         while (t < 8000) {
            step(r, dt, { ...createStepInput(), moveX: 0.7, moveZ: -0.3 });
            t += dt;
         }
         return r;
      });
      for (const r of runs) {
         expect(r.simMs).toBeGreaterThanOrEqual(8000);
         expect(r.board.emitted).toBe(runs[0].board.emitted);
      }
   });
});
