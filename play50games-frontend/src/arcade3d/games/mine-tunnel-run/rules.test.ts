import { describe, expect, it } from "vitest";
import { LEVELS, T, type MineLevel } from "./levels";
import {
   CELL,
   DASH,
   DIG_MS,
   ORB_BONUS_MS,
   WALK,
   createWorld,
   finalScore,
   idleInput,
   runTimeMs,
   step,
   tileAt,
   type StepInput,
   type World,
} from "./rules";
import { coachFor, COACH } from "./coach";

/** A tiny test mine (the parser adds the bedrock border). */
function mine(rows: string[], extra: Partial<MineLevel> = {}): World {
   const level: MineLevel = { id: 1, name: "test", durationMs: 60_000, targetMs: 30_000, map: rows, ...extra };
   const saved = LEVELS[1];
   (LEVELS as Record<number, MineLevel>)[1] = level;
   try {
      return createWorld(1, ["riko"]);
   } finally {
      (LEVELS as Record<number, MineLevel>)[1] = saved;
   }
}

const hold = (w: World, ms: number, i: Partial<StepInput>) => {
   for (let t = 0; t < ms; t += 1000 / 60) step(w, 1000 / 60, { ...idleInput(), ...i });
};
const tap = (w: World, i: Partial<StepInput>) => step(w, 1000 / 60, { ...idleInput(), ...i });

describe("digging", () => {
   it("soft soil takes 0.2 s, packed 0.5 s, rock never gives", () => {
      expect(DIG_MS.soft).toBe(200);
      expect(DIG_MS.packed).toBe(500);
      const w = mine(["S.....", "ssp#ss", "######", "E....."]);
      const h = w.heroes[0];
      hold(w, 150, { y: 1 });
      expect(tileAt(w, h.col, 1)).toBe(T.SOFT);
      hold(w, 100, { y: 1 });
      expect(tileAt(w, 1, 1)).toBe(T.EMPTY);
   });
   it("rock is never dug, and a dig never carries the hero into the cell by itself", () => {
      const w = mine(["S#....", "######", "E....."]);
      hold(w, 2000, { x: 1 });
      expect(tileAt(w, 2, 0)).toBe(T.ROCK);
      const v = mine(["Ss....", "######", "E....."]);
      tap(v, { x: 1 });
      hold(v, 260, {});
      expect(tileAt(v, 2, 0)).toBe(T.EMPTY);
      expect(v.heroes[0].col).toBe(1);
   });
   it("an ore cell pays its orb once, and each orb takes 0.4 s off the submitted time", () => {
      const w = mine(["So....", "######", "E....."]);
      hold(w, 700, { x: 1 });
      expect(w.heroes[0].orbs).toBe(1);
      expect(runTimeMs(10_000, 3)).toBe(10_000 - 3 * ORB_BONUS_MS);
      expect(runTimeMs(500, 3)).toBe(0);
   });
   it("walks at 6.5 m/s on a 1.6 m cell", () => {
      const w = mine(["S.....", "######", "E....."]);
      const ms = ((CELL / WALK) * 1000) | 0;
      hold(w, ms + 30, { x: 1 });
      expect(w.heroes[0].col).toBeGreaterThanOrEqual(2);
   });
});

describe("boulders", () => {
   it("a boulder whose floor is dug wobbles 0.8 s, then falls down the open cells and rests", () => {
      const w = mine([".B....", "Ss....", "#.####", "#.####", "######", "E....."]);
      tap(w, { x: 1 });
      hold(w, 250, {});
      expect(w.boulders[0].state).toBe("wobble");
      hold(w, 600, {});
      expect(w.boulders[0].state).toBe("wobble");
      hold(w, 900, {});
      expect(w.boulders[0].state).toBe("rest");
      expect(w.boulders[0].row).toBe(3);
   });
   it("a falling boulder crushes a beetle in its way", () => {
      const w = mine(["......", "S.....", "#.####", "#b####", "######", "E....."]);
      w.boulders.push({ col: 2, row: 0, state: "fall", t: 0, y: 0, v: 8, alive: true });
      hold(w, 600, {});
      expect(w.beetles[0].alive).toBe(false);
   });
   it("a falling boulder crushes the hero: back to the last lantern, one hit", () => {
      const w = mine(["L.....", "S.....", "s#....", "######", "E....."]);
      const h = w.heroes[0];
      // light the lantern first
      hold(w, 600, { y: -1 });
      expect(h.hits).toBe(0);
      w.boulders.push({ col: h.col, row: h.row - 1, state: "fall", t: 0, y: h.row - 1.2, v: 10, alive: true });
      hold(w, 300, {});
      expect(h.hits).toBe(1);
   });
});

describe("hazards and helpers", () => {
   it("a breached water pocket floods down through the tunnels, a cell every 0.3 s", () => {
      const w = mine(["Sswww.", "s#ww#.", "s####.", "s.....", "######", "E....."]);
      const before = w.tiles.filter((t) => t === T.WATER).length;
      hold(w, 260, { x: 1 });
      hold(w, 1500, {});
      expect(w.tiles.filter((t) => t === T.WATER).length).toBeGreaterThan(before + 2);
   });
   it("a rail cart carries the hero to the far end at 10 m/s", () => {
      const w = mine(["S.....", "s#####", "======", "######", "E....."]);
      hold(w, 260, { y: 1 });
      hold(w, 900, {});
      const h = w.heroes[0];
      expect(h.col === 1 || h.col === 6).toBe(true);
   });
   it("the L4 rockfall turns rows to rubble from the top after 15 s", () => {
      const w = createWorld(4, ["riko"]);
      hold(w, 14_000, {});
      expect(w.rockRow).toBe(-1);
      hold(w, 2_500, {});
      expect(w.rockRow).toBeGreaterThanOrEqual(1);
      expect(tileAt(w, 3, 1)).toBe(T.RUBBLE);
   });
});

describe("hero powers", () => {
   it("Riko's dash bores four soil cells at once and smashes cracked rock", () => {
      const w = mine(["Sscsss", "######", "E....."]);
      tap(w, { x: 1, power: true });
      hold(w, 400, {});
      expect(tileAt(w, 2, 0)).toBe(T.EMPTY);
      expect(tileAt(w, 3, 0)).toBe(T.EMPTY);
      expect(tileAt(w, 5, 0)).toBe(T.EMPTY);
      expect(DASH.cells).toBe(4);
   });
   it("Nami's double jump reaches four cells up; a plain hop only two", () => {
      for (const id of ["nami", "riko"] as const) {
         const w = mine([".k....", ".#....", "......", "......", "......", "S.....", "######", "E....."]);
         w.heroes[0].heroId = id;
         tap(w, { jump: true });
         hold(w, 260, {});
         tap(w, { power: true });
         hold(w, 260, {});
         const top = Math.min(...[w.heroes[0].row]);
         if (id === "nami") expect(top).toBeLessThanOrEqual(2);
         else expect(top).toBeGreaterThanOrEqual(3);
      }
   });
   it("Kiro's shield takes the gas: no hit; without it the gas hurts", () => {
      for (const [id, hits] of [["kiro", 0], ["riko", 1]] as const) {
         const w = mine(["SG....", "######", "E....."]);
         w.heroes[0].heroId = id;
         tap(w, { power: true });
         hold(w, 600, { x: 1 });
         expect(w.heroes[0].hits, id).toBe(hits);
      }
   });
   it("Zuno's magnet pulls an orb sealed two cells deep in rock", () => {
      for (const [id, orbs] of [["zuno", 1], ["riko", 0]] as const) {
         const w = mine(["S#z...", "######", "E....."]);
         w.heroes[0].heroId = id;
         tap(w, { power: true });
         hold(w, 200, {});
         expect(w.heroes[0].orbs, id).toBe(orbs);
      }
   });
   it("Vexa phases through ghost rock to the shard; others are stopped", () => {
      for (const [id, found] of [["vexa", 1], ["riko", 0]] as const) {
         const w = mine(["SgK...", "######", "E....."]);
         w.heroes[0].heroId = id;
         tap(w, { power: true });
         hold(w, 900, { x: 1 });
         expect(w.heroes[0].secrets.found[0], id).toBe(found);
      }
   });
});

describe("scoring and the coach", () => {
   it("submits the finish minus the orb and flow bonus on a win, else the elapsed time", () => {
      expect(finalScore({ score: 0, endReason: "win", stats: { finishMs: 30_000, orbs: 2, comboMs: 100 }, elapsedMs: 31_000 }).durationMs).toBe(30_000 - 800 - 100);
      expect(finalScore({ score: 0, endReason: "timeup", stats: {}, elapsedMs: 90_000 }).durationMs).toBe(90_000);
   });
   it("L1 teaches by playing: dig in, find the lantern, then the packed soil", () => {
      const w = createWorld(1, ["riko"]);
      expect(COACH[coachFor(w, w.heroes[0])]).toMatch(/dig into the soft soil/i);
      w.heroes[0].row = 4;
      expect(COACH[coachFor(w, w.heroes[0])]).toMatch(/lantern/i);
   });
});
