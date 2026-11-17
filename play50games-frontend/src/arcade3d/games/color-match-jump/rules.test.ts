import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "../../types";
import { DIRS, GREY, buildCourse, cellAt, indexCourse, type Cell } from "./course";
import { LEVELS } from "./levels";
import {
   CLIMB, HEARTS, HOP_MS, LIMITS, TAG_MS, cellAlive, cellFrom, colourAt, createRun, idleInput, minFinishMs, step, stickDir, sunkRows,
   type CmjRun, type StepInput,
} from "./rules";
import { colorMatchJumpMeta } from "./meta";

const DT = 1000 / 60;

/** Puts the hero on a hex (grounded). */
function place(r: CmjRun, c: Cell): void {
   r.cell = c.id;
   r.hop = null;
   r.x = c.x;
   r.z = c.z;
   r.y = c.h;
}

/** The (dir, cells) that reach `to` from `from`. */
function way(r: CmjRun, from: Cell, to: Cell): { dir: number; cells: number } {
   for (let cells = 1; cells <= 4; cells++) for (let dir = 0; dir < 6; dir++) {
      const x = from.x + DIRS[dir].x * 2.3 * cells;
      const z = from.z + DIRS[dir].z * 2.3 * cells;
      if (Math.abs(x - to.x) < 0.05 && Math.abs(z - to.z) < 0.05) return { dir, cells };
   }
   throw new Error("not in line");
}

function stickFor(dir: number, out: StepInput): void {
   out.moveX = dir < 0 ? 0 : DIRS[dir].x;
   out.moveY = dir < 0 ? 0 : DIRS[dir].z;
   out.yaw = 0;
}

interface HopOpts { long?: boolean; dash?: boolean; double?: boolean; power?: boolean; tag?: number }

/** Jumps from the current hex in direction `dir` and steps until the hop resolves; returns the events seen. */
function hop(r: CmjRun, dir: number, o: HopOpts = {}): Record<string, boolean> {
   const seen: Record<string, boolean> = {};
   const input = idleInput();
   stickFor(dir, input);
   if (o.tag !== undefined) input.tag = o.tag;
   if (o.power) input.actionPressed = true;
   step(r, DT, input);
   Object.assign(input, idleInput());
   stickFor(dir, input);
   input.jumpPressed = true;
   input.jumpHeld = !!o.long;
   let ev = step(r, DT, input);
   for (const [k, v] of Object.entries(ev)) if (v) seen[k] = true;
   for (let f = 0; f < 200 && (r.hop || r.fallUntil >= 0); f++) {
      Object.assign(input, idleInput());
      input.jumpHeld = !!o.long;
      if (f === 2 && o.dash) input.actionPressed = true;
      if (f === 2 && o.double) input.jumpPressed = true;
      ev = step(r, DT, input);
      for (const [k, v] of Object.entries(ev)) if (v) seen[k] = true;
      if (seen.fell && r.fallUntil < 0) break;
   }
   return seen;
}

function tag(r: CmjRun, hero: number): void {
   const input = idleInput();
   input.tag = hero;
   step(r, DT, input);
   const wait = idleInput();
   for (let i = 0; i < 40 && r.simMs < r.tagReadyAt; i++) step(r, DT, wait);
}

describe("limits", () => {
   it("pins every level's limits (meta.scoring, arcade-games.json and this table agree)", () => {
      const PINNED = [[5599, 90000, 8440], [13439, 120000, 10656], [20159, 150000, 12984], [35839, 180000, 14416], [30079, 240000, 20992]];
      expect(LEVEL_IDS.map((id) => [LIMITS[id].minDurationMs, LIMITS[id].maxDurationMs, LIMITS[id].maxScore])).toEqual(PINNED);
      expect(LEVEL_IDS.map((id) => LIMITS[id].timeBaseMs)).toEqual(PINNED.map((p) => p[1]));
      expect(colorMatchJumpMeta.levels!.map((l) => l.scoring)).toEqual(LEVEL_IDS.map((id) => LIMITS[id]));
      for (const id of LEVEL_IDS) expect(LIMITS[id].minDurationMs).toBe(minFinishMs(id) - 1);
   });
   it("derives the floor from one hop per code step (and the boss's storm)", () => {
      expect(minFinishMs(1)).toBe(5 * 2 * HOP_MS);
      expect(minFinishMs(4)).toBe(16 * 4 * HOP_MS);
      expect(minFinishMs(5)).toBe(18 * HOP_MS + 20_000);
   });
});

describe("the fields", () => {
   for (const id of [1, 2, 3, 4] as LevelId[]) it(`L${id}: the crown is reachable with plain hops, and every hero route holds an orb`, () => {
      const c = buildCourse(id);
      const idx = indexCourse(c);
      const plain = (x: Cell) => !x.ghost && !x.curtain && !x.tall && !x.island;
      const seen = new Set([c.start]);
      const q = [c.start];
      while (q.length) {
         const a = c.cells[q.shift()!];
         for (let d = 0; d < 6; d++) for (const k of [1, 2]) {
            const b = cellAt(c, idx, a.x + DIRS[d].x * 2.3 * k, a.z + DIRS[d].z * 2.3 * k);
            if (!b || seen.has(b.id) || !plain(b) || b.h - a.h > CLIMB) continue;
            seen.add(b.id);
            q.push(b.id);
         }
      }
      expect(seen.has(c.crown)).toBe(true);
      expect(c.cells.some((x) => x.tall && x.orb)).toBe(true);
      expect(c.cells.some((x) => x.curtain && x.orb)).toBe(true);
      expect(c.cells.some((x) => x.island && x.orb)).toBe(true);
      expect(c.cells.some((x) => x.ghost && x.orb)).toBe(true);
      expect(c.floats.filter((f) => f.secret < 0).length).toBeGreaterThan(0);
      expect(new Set(c.cells.filter((x) => x.colour < GREY).map((x) => x.colour))).toEqual(new Set(LEVELS[id].palette));
   });
   it("L5: a ring round the golem with three core hexes, a stomp hex and every hero route", () => {
      const c = buildCourse(5);
      expect(c.cores).toHaveLength(3);
      expect(c.cells[c.stomp].stomp).toBe(true);
      expect(c.cells.some((x) => x.tall && x.orb) && c.cells.some((x) => x.curtain && x.orb) && c.cells.some((x) => x.island && x.orb) && c.cells.some((x) => x.ghost && x.orb)).toBe(true);
      expect(c.floats.some((f) => f.secret === 0)).toBe(true);
   });
});

describe("landings", () => {
   it("a hex in your colour holds, lights and counts for the code; another colour cracks and drops", () => {
      const r = createRun(1, 1, "riko");
      const start = r.course.cells[r.course.start];
      const dir0 = [1, 2].find((d) => cellFrom(r, start.x, start.z, d, 1))!;
      const red = cellFrom(r, start.x, start.z, dir0, 1)!;
      expect(red.colour).toBe(0);
      r.code = [0, 1];
      const ev = hop(r, dir0);
      expect(ev.matched).toBe(true);
      expect(r.cell).toBe(red.id);
      expect(r.codeStep).toBe(1);
      // now as Nami (blue) onto a red hex: it cracks, and staying on it is a fall
      tag(r, 1);
      const next = cellFrom(r, red.x, red.z, 1, 1) ?? cellFrom(r, red.x, red.z, 2, 1)!;
      expect(colourAt(r, next)).toBe(0);
      const ev2 = hop(r, way(r, red, next).dir);
      expect(ev2.cracked).toBe(true);
      expect(r.codeStep).toBe(0);
      const hearts = r.hearts;
      for (let i = 0; i < 60; i++) step(r, DT, idleInput());
      expect(r.hearts).toBe(hearts - 1);
      expect(cellAlive(r, next)).toBe(false);
   });
   it("grey is neutral; a hop in place lands on the same hex but never advances a code twice", () => {
      const r = createRun(1, 1, "riko");
      const start = r.course.cells[r.course.start];
      expect(start.colour).toBe(GREY);
      const ev = hop(r, -1);
      expect(ev.cracked).toBeFalsy();
      expect(r.cell).toBe(start.id);
   });
   it("tags have a 0.5 s cooldown, and a mid-air tag gives fresh legs", () => {
      const r = createRun(1, 2, "riko");
      const input = idleInput();
      input.tag = 3;
      step(r, DT, input);
      expect(r.active).toBe(3);
      input.tag = 4;
      step(r, DT, input);
      expect(r.active).toBe(3);
      while (r.simMs < TAG_MS + 50) step(r, DT, idleInput());
      step(r, DT, input);
      expect(r.active).toBe(4);
   });
});

describe("hero roles", () => {
   function beside(r: CmjRun, target: Cell, plain = true): { from: Cell; dir: number } {
      for (const c of r.course.cells) {
         if (plain && (c.ghost || c.curtain || c.tall || c.island)) continue;
         for (let d = 0; d < 6; d++) if (cellFrom(r, c.x, c.z, d, 1)?.id === target.id) return { from: c, dir: d };
      }
      throw new Error("no neighbour");
   }
   it("Nami: the 4 m pillar needs her double jump (a plain hop bounces back)", () => {
      const r = createRun(1, 2, "nami");
      const tall = r.course.cells.find((c) => c.tall)!;
      const b = beside(r, tall);
      place(r, b.from);
      expect(hop(r, b.dir).bonk).toBe(true);
      expect(r.cell).toBe(b.from.id);
      const ev = hop(r, b.dir, { double: true });
      expect(r.cell).toBe(tall.id);
      expect(ev.orb).toBe(true);
   });
   it("Kiro: the lightning curtain zaps (a heart) unless his shield is up", () => {
      const r = createRun(1, 2, "kiro");
      const alcove = r.course.cells.find((c) => c.curtain)!;
      const b = beside(r, alcove);
      place(r, b.from);
      expect(hop(r, b.dir).zap).toBe(true);
      expect(r.hearts).toBe(HEARTS - 1);
      r.cooldown[2] = 0;
      place(r, b.from);
      hop(r, b.dir, { power: true });
      expect(r.cell).toBe(alcove.id);
      expect(r.orbs).toBeGreaterThan(0);
   });
   it("Riko: his air dash carries a hop over the void to the island", () => {
      const r = createRun(1, 2, "riko");
      const isle = r.course.cells.filter((c) => c.island).sort((a, b) => a.x - b.x)[0];
      const from = r.course.cells.find((c) => !c.island && c.row === isle.row && Math.abs(c.x + 3 * 2.3 - isle.x) < 0.05)!;
      place(r, from);
      const plain = hop(r, 0);
      expect(plain.fell).toBe(true);
      const r2 = createRun(1, 2, "riko");
      place(r2, from);
      hop(r2, 0, { dash: true });
      expect(r2.cell).toBe(isle.id);
   });
   it("Zuno: the magnet pulls the floating orb trail from 6 m", () => {
      const r = createRun(1, 2, "zuno");
      const f = r.course.floats[0];
      const near = r.course.cells.filter((c) => !c.tall && !c.curtain && !c.ghost).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0];
      place(r, near);
      const input = idleInput();
      input.actionPressed = true;
      step(r, DT, input);
      expect(r.floatTaken[0]).toBe(1);
   });
   it("Vexa: a ghost pillar bounces everyone back, but she phases onto it", () => {
      const r = createRun(1, 2, "vexa");
      const ghost = r.course.cells.find((c) => c.ghost && c.orb)!;
      const b = beside(r, ghost);
      place(r, b.from);
      expect(hop(r, b.dir).bonk).toBe(true);
      r.cooldown[4] = 0;
      place(r, b.from);
      hop(r, b.dir, { power: true });
      expect(r.cell).toBe(ghost.id);
   });
});

describe("pressure and goals", () => {
   it("the sink wave drops the rear rows; standing on one costs a heart and respawns ahead", () => {
      const r = createRun(1, 2, "riko");
      const input = idleInput();
      while (sunkRows(r) < 1) step(r, DT, input);
      for (let i = 0; i < 80; i++) step(r, DT, input);
      expect(r.hearts).toBe(HEARTS - 1);
      expect(r.course.cells[r.cell].row).toBeGreaterThanOrEqual(sunkRows(r));
   });
   it("the crown stays shut until the codes are cracked", () => {
      const r = createRun(1, 1, "riko");
      const crown = r.course.cells[r.course.crown];
      const b = r.course.cells.find((c) => c.row === crown.row - 1 && [1, 2].some((d) => cellFrom(r, c.x, c.z, d, 1)?.id === crown.id))!;
      const dir = [1, 2].find((d) => cellFrom(r, b.x, b.z, d, 1)?.id === crown.id)!;
      place(r, b);
      expect(hop(r, dir).crownLocked).toBe(true);
      expect(r.ended).toBeNull();
      r.codes = r.config.codes;
      place(r, b);
      hop(r, dir);
      expect(r.ended).toBe("win");
   });
   it("L3: hexes step through the palette every 4 s", () => {
      const r = createRun(1, 3, "riko");
      const c = r.course.cells.find((x) => x.colour < GREY)!;
      const a = colourAt(r, c, 100);
      const b = colourAt(r, c, 4100);
      expect(b).not.toBe(a);
      expect(r.config.palette).toContain(b);
   });
   it("stickDir picks the nearest of the six hex directions, camera-relative", () => {
      expect(stickDir(0, -1, 0)).toBeGreaterThanOrEqual(1);
      expect(stickDir(0, -1, 0)).toBeLessThanOrEqual(2);
      expect(stickDir(1, 0, 0)).toBe(0);
      expect(stickDir(0.1, 0.1, 0)).toBe(-1);
   });
});

describe("the Echo Frost Golem", () => {
   it("a stomp needs the double jump and the plate's colour at touchdown", () => {
      const r = createRun(1, 5, "nami");
      const b = r.boss!;
      b.phase = 1;
      b.step = "attack";
      b.hp = 4;
      const stomp = r.course.cells[r.course.stomp];
      place(r, stomp);
      r.plate = 1;
      let dir = 0;
      let best = -Infinity;
      for (let d = 0; d < 6; d++) {
         const v = -(DIRS[d].x * stomp.x + DIRS[d].z * stomp.z);
         if (v > best) { best = v; dir = d; }
      }
      expect(hop(r, dir).bonk).toBe(true);
      expect(r.pendingHits).toBe(0);
      place(r, stomp);
      const ev = hop(r, dir, { double: true });
      expect(ev.stomp).toBe(true);
      expect(r.pendingHits + (ev.bossHit ? 1 : 0)).toBeGreaterThan(0);
      // the wrong colour costs a heart instead
      const r2 = createRun(1, 5, "nami");
      Object.assign(r2.boss!, { phase: 1, step: "attack", hp: 4 });
      place(r2, r2.course.cells[r2.course.stomp]);
      r2.plate = 0;
      expect(hop(r2, dir, { double: true }).hurt).toBe(true);
   });
});
