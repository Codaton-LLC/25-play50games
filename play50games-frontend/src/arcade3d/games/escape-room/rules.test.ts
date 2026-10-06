import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { escapeRoomMeta } from "./meta";
import {
   ALL_ITEMS, DOOR_ID, DOOR_POSITION, DURATION_MS, INSPECT_REACH, ITEM_NAMES, NONE,
   STATION_ANCHORS, STATION_KINDS, createRun, createStepInput, fallbackLayout,
   generateLayout, inReach, isValidLayout, isWalkable, step, targetInReach,
   type EscapeRun, type Layout, type StepInput,
} from "./rules";
import * as rules from "./rules";

describe("escape-room golden constants", () => {
   it("pins the approved room, movement, actions and minimum finish", () => {
      expect(rules).toMatchObject({
         DURATION_MS: 600000,
         MAX_STEP_MS: 50,
         ARENA: { halfX: 6, halfZ: 5 },
         RUNNER: { radius: 0.35, speed: 1.8, accel: 6, brake: 8 },
         START: { x: 0, z: 4 },
         INSPECT_REACH: 1,
         OPEN_MS: 1100,
         RETRIEVE_MS: 900,
         UNLOCK_MS: 600,
         DOOR_OPEN_MS: 1200,
         MIN_ROUTE: 13.5,
         MIN_FINISH_MS: 15300,
      });
   });
});

const IDLE: StepInput = { moveX: 0, moveY: 0, actionPressed: false };
const tap = (id: number, moveX = 0, moveY = 0): StepInput => ({ moveX, moveY, actionPressed: false, tappedTarget: id });
const KEY: StepInput = { moveX: 0, moveY: 0, actionPressed: true };
const PERMUTATIONS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

function place(run: EscapeRun, x: number, z: number): void {
   run.player.x = x;
   run.player.z = z;
   run.player.vx = 0;
   run.player.vz = 0;
}

function advance(run: EscapeRun, ms: number, input: StepInput = IDLE): void {
   for (let left = ms; left > 0; left -= Math.min(50, left)) step(run, Math.min(50, left), input);
}

function openAndTake(run: EscapeRun, id: number): void {
   const s = run.layout.stations[id];
   place(run, s.x, s.z);
   step(run, 1, tap(id));
   advance(run, 1099);
   step(run, 1, tap(id));
   advance(run, 899);
}

/** Independent circle/rectangle oracle, including the two chairs, not the game's walkability helper. */
function clear(layout: Layout, x: number, z: number): boolean {
   if (Math.abs(x) > 5.65 || Math.abs(z) > 4.65) return false;
   for (const s of layout.stations) {
      const cx = s.x + Math.sign(s.x);
      const dx = Math.max(Math.abs(x - cx) - 0.6, 0);
      const dz = Math.max(Math.abs(z - s.z) - 0.7, 0);
      if (dx * dx + dz * dz < 0.35 ** 2 - 1e-10) return false;
   }
   for (const cx of [-5, 5]) {
      const dx = Math.max(Math.abs(x - cx) - 0.4, 0);
      const dz = Math.max(Math.abs(z) - 0.4, 0);
      if (dx * dx + dz * dz < 0.35 ** 2 - 1e-10) return false;
   }
   return true;
}

/** Optimistic reach-circle route, obstacles ignored. All six orders are checked, not one happy path. */
function bestOrder(layout: Layout): { ids: number[]; distance: number } {
   const ids = layout.stations.filter((s) => s.item !== NONE).map((s) => s.id);
   let best = Infinity;
   let order = ids;
   for (const permutation of PERMUTATIONS) {
      const a = layout.stations[ids[permutation[0]]];
      const b = layout.stations[ids[permutation[1]]];
      const c = layout.stations[ids[permutation[2]]];
      const distance = Math.hypot(a.x, a.z - 4) - 1
         + Math.hypot(b.x - a.x, b.z - a.z) - 2
         + Math.hypot(c.x - b.x, c.z - b.z) - 2
         + Math.hypot(c.x, c.z + 4.2) - 2;
      if (distance < best) {
         best = distance;
         order = permutation.map((i) => ids[i]);
      }
   }
   return { ids: order, distance: best };
}

type Strategy = "perfect" | "spam" | "early" | "through";

/** Knows every item, chooses the best order and has no reaction delay; never teleports the player. */
function makeBot(run: EscapeRun, strategy: Strategy = "perfect"): () => StepInput {
   const order = bestOrder(run.layout).ids;
   const visits = strategy === "early" ? [DOOR_ID, ...order, ...order, DOOR_ID] : [...order, DOOR_ID];
   const input = createStepInput();
   let cursor = 0;
   return () => {
      while (cursor < visits.length - 1) {
         const id = visits[cursor];
         const done = id === DOOR_ID ? run.message === "locked"
            : strategy === "early" && cursor <= 3 ? run.stations[id].phase === "open"
               : run.stations[id].phase === "collected";
         if (!done) break;
         cursor++;
      }
      const id = visits[cursor];
      const s = id === DOOR_ID ? DOOR_POSITION : run.layout.stations[id];
      // Inner-side approach stays in the clear corridor; the through bot aims straight at the anchor.
      const gx = id === DOOR_ID || strategy === "through" ? s.x : s.x - Math.sign(s.x) * 0.85;
      const dx = gx - run.player.x;
      const dz = s.z - run.player.z;
      const len = Math.hypot(dx, dz);
      input.moveX = len > 1e-12 ? dx / len : 0;
      input.moveY = len > 1e-12 ? dz / len : 0;
      const reachable = Math.hypot(s.x - run.player.x, s.z - run.player.z) <= 1;
      input.actionPressed = strategy !== "perfect" || reachable;
      input.tappedTarget = strategy !== "perfect" || reachable ? id : null;
      return input;
   };
}

function play(run: EscapeRun, nextDt: () => number, strategy: Strategy = "perfect", limit = 120000): EscapeRun {
   const bot = makeBot(run, strategy);
   let elapsed = 0;
   for (let guard = 0; !run.ended && elapsed < limit && guard < 150000; guard++) {
      const dt = nextDt();
      const x = run.player.x, z = run.player.z;
      const ms = run.simMs;
      elapsed += Math.min(dt, 50);
      step(run, dt, bot());
      if (run.simMs > elapsed + 1e-6) throw new Error("Untimed simulation");
      if (Math.hypot(run.player.x - x, run.player.z - z) > 1.8 * (run.simMs - ms) / 1000 + 1e-9) {
         throw new Error("Movement exceeded the proof speed");
      }
      if (!clear(run.layout, run.player.x, run.player.z)) throw new Error("Bot walked through furniture");
      if (run.ended === "win" && run.simMs < 15300) throw new Error(`Early win at ${run.simMs}`);
   }
   return run;
}

describe("escape-room seeded layouts", () => {
   it("pins IDs, furniture, the fallback and initial fixed pools", () => {
      expect(STATION_ANCHORS).toEqual([{ x: -4, z: -3 }, { x: 4, z: -3 }, { x: -4, z: 3 }, { x: 4, z: 3 }]);
      expect(STATION_KINDS).toEqual(["drawer", "cupboard", "under-desk", "cupboard"]);
      expect(ITEM_NAMES).toEqual(["Key", "Book", "Battery"]);
      expect(DOOR_POSITION).toEqual({ x: 0, z: -4.2 });
      expect(DOOR_ID).toBe(4);
      expect(NONE).toBe(-1);
      expect(ALL_ITEMS).toBe(7);
      const run = createRun(5050, { layout: fallbackLayout(5050) });
      expect(run.layout.fallback).toBe(true);
      expect(run.layout.stations.map((s) => [s.x, s.z, s.item])).toEqual([[-4, -3, 0], [4, -3, 1], [-4, 3, 2], [4, 3, -1]]);
      expect(run.stations.map((s) => s.phase)).toEqual(["closed", "closed", "closed", "closed"]);
      expect(run.items).toHaveLength(3);
      expect(run.items.map((s) => s.visible)).toEqual([false, false, false]);
      expect(run.layout.obstacles).toHaveLength(6);
      expect(run.found).toBe(0);
      expect(run.foundMask).toBe(0);
      expect(run.door.phase).toBe("locked");
      expect(run.action.kind).toBe("none");
      expect(run.player).toMatchObject({ x: 0, y: 0, z: 4, vx: 0, vz: 0 });
   });

   it("uses the shared mulberry32 draws, quarter-metre jitter and Fisher-Yates item assignment", () => {
      const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Unseeded random"); });
      try {
         for (const seed of [0, 1, 5050, 0xffffffff, -1]) {
            const a = generateLayout(seed), b = generateLayout(seed);
            expect(a).toEqual(b);
            const rng = createRng(seed);
            const positions = STATION_ANCHORS.map((s) => [s.x + (Math.floor(rng() * 3) - 1) * 0.25, s.z + (Math.floor(rng() * 3) - 1) * 0.25]);
            const items = [0, 1, 2, -1];
            for (let i = 3; i > 0; i--) {
               const j = Math.floor(rng() * (i + 1));
               [items[i], items[j]] = [items[j], items[i]];
            }
            expect(a.stations.map((s) => [s.x, s.z])).toEqual(positions);
            expect(a.stations.map((s) => s.item)).toEqual(items);
            expect(a.seed).toBe(seed >>> 0);
            expect(a.fallback).toBe(false);
         }
      } finally { random.mockRestore(); }
   });

   it("rejects broken layouts and fills a valid zero-jitter fallback without retaining caller data", () => {
      const cases = [
         (l: Layout) => { l.stations[0].x = NaN; },
         (l: Layout) => { l.stations[0].x = -2; },
         (l: Layout) => { l.stations[0].item = l.stations[1].item; },
         (l: Layout) => { l.stations[1].id = 0; },
         (l: Layout) => { l.stations[0].bounds.max.x += 1; },
         (l: Layout) => { l.obstacles[4].min.x = 0; },
         (l: Layout) => { l.stations.pop(); },
      ];
      for (const breakLayout of cases) {
         const candidate = generateLayout(7);
         breakLayout(candidate);
         expect(isValidLayout(candidate)).toBe(false);
         const run = createRun(7, { layout: candidate });
         expect(run.layout).toEqual(fallbackLayout(7));
         expect(isValidLayout(run.layout)).toBe(true);
      }
      const candidate = generateLayout(12);
      const run = createRun(12, { layout: candidate });
      candidate.stations[0].x = 0;
      expect(isValidLayout(run.layout)).toBe(true);
   });

   it("all 1000 seeds and the fallback are solvable by an independent flood-fill, with disjoint reach circles", () => {
      const nx = 45, nz = 37;
      const queue = new Int32Array(nx * nz);
      const seen = new Uint8Array(nx * nz);
      for (let seed = -1; seed < 1000; seed++) {
         const l = seed === -1 ? fallbackLayout(0) : generateLayout(seed);
         expect(isValidLayout(l), `seed ${seed}`).toBe(true);
         expect(l.stations.map((s) => s.item).sort()).toEqual([-1, 0, 1, 2]);
         for (let i = 0; i < 4; i++) {
            const s = l.stations[i];
            expect(s.bounds.min.x).toBeCloseTo(s.x + Math.sign(s.x) - 0.6, 12);
            expect(s.bounds.max.z).toBeCloseTo(s.z + 0.7, 12);
            expect(clear(l, s.x, s.z)).toBe(true);
            for (let j = i + 1; j < 4; j++) expect(Math.hypot(s.x - l.stations[j].x, s.z - l.stations[j].z)).toBeGreaterThan(2);
            expect(Math.hypot(s.x, s.z + 4.2)).toBeGreaterThan(2);
         }
         expect(bestOrder(l).distance).toBeGreaterThanOrEqual(13.5);
         seen.fill(0);
         let head = 0, tail = 1;
         queue[0] = 34 * nx + 22; // (0,4)
         seen[queue[0]] = 1;
         while (head < tail) {
            const node = queue[head++], ix = node % nx, iz = Math.floor(node / nx);
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
               const x = ix + dx, z = iz + dz, n = z * nx + x;
               if (x < 0 || x >= nx || z < 0 || z >= nz || seen[n]) continue;
               if (clear(l, -5.5 + x * 0.25, -4.5 + z * 0.25)) { seen[n] = 1; queue[tail++] = n; }
            }
         }
         for (const s of l.stations) expect(seen[((s.z + 4.5) * 4) * nx + (s.x + 5.5) * 4]).toBe(1);
         expect(seen[1 * nx + 22]).toBe(1); // (0,-4.25), within door reach
      }
   }, 120000);
});

describe("escape-room movement and inspection", () => {
   it("pins speed, acceleration, braking, diagonals and world-mapped axes", () => {
      const run = createRun(1);
      step(run, 1, { ...IDLE, moveX: 1 });
      expect(run.player.x).toBeCloseTo(0.000006, 12);
      expect(run.player.vx).toBeCloseTo(0.006, 12);
      advance(run, 299, { ...IDLE, moveX: 1 });
      expect(run.player.vx).toBeCloseTo(1.8, 10);
      expect(run.player.x).toBeCloseTo(0.2709, 10);
      step(run, 1, IDLE);
      expect(run.player.vx).toBeCloseTo(1.792, 10);
      const diag = createRun(1);
      advance(diag, 500, { ...IDLE, moveX: 100, moveY: -100 });
      expect(Math.hypot(diag.player.vx, diag.player.vz)).toBeCloseTo(1.8, 10);
      expect(diag.player.x).toBeGreaterThan(0);
      expect(diag.player.z).toBeLessThan(4);
   });

   it("never walks through station boxes/chairs/walls or gains speed from collision correction", () => {
      const run = createRun(5050, { layout: fallbackLayout(5050) });
      place(run, -4, -3);
      advance(run, 1000, { ...IDLE, moveX: -1 });
      expect(run.player.x).toBeGreaterThanOrEqual(-4.05 - 1e-9);
      expect(clear(run.layout, run.player.x, run.player.z)).toBe(true);
      place(run, 0, 0);
      advance(run, 5000, { ...IDLE, moveX: 1 });
      expect(run.player.x).toBeLessThanOrEqual(4.25 + 1e-9);
      const rng = createRng(9245);
      for (let i = 0; i < 20000; i++) {
         if (i % 500 === 0) place(run, 0, 0);
         const x = run.player.x, z = run.player.z, ms = run.simMs;
         step(run, 1 + rng() * 49, { moveX: 20 * rng() - 10, moveY: 20 * rng() - 10, actionPressed: false });
         expect(Math.hypot(run.player.x - x, run.player.z - z)).toBeLessThanOrEqual(1.8 * (run.simMs - ms) / 1000 + 1e-9);
         expect(clear(run.layout, run.player.x, run.player.z)).toBe(true);
         expect(run.player.y).toBe(0);
      }
   }, 120000);

   it("selects exactly one eligible object and enforces anchor radius, IDs and tap priority", () => {
      const run = createRun(0, { layout: fallbackLayout(0) });
      for (let id = 0; id <= 4; id++) {
         const p = id === 4 ? DOOR_POSITION : run.layout.stations[id];
         place(run, p.x + (id === 4 ? 1 : -Math.sign(p.x)) * 0.999, p.z);
         expect(targetInReach(run)).toBe(id);
         expect(inReach(run.layout, id, run.player.x, run.player.z)).toBe(true);
         place(run, p.x + (id === 4 ? 1 : -Math.sign(p.x)), p.z);
         expect(inReach(run.layout, id, run.player.x, run.player.z)).toBe(true);
         place(run, p.x + (id === 4 ? 1 : -Math.sign(p.x)) * 1.001, p.z);
         expect(targetInReach(run)).toBe(NONE);
         expect(inReach(run.layout, id, run.player.x, run.player.z)).toBe(false);
      }
      place(run, -4, -3);
      for (const id of [1, 4, -1, 5, 0.5, NaN, Infinity]) {
         expect(step(run, 1, { ...KEY, tappedTarget: id }).inspected).toBe(NONE);
         expect(run.action.kind).toBe("none");
      }
      expect(step(run, 1, KEY).inspected).toBe(0);
      expect(targetInReach(run)).toBe(NONE);
   });

   it("a remote inspect does not stop movement; an accepted inspect locks before that frame's move", () => {
      const run = createRun(0);
      step(run, 50, tap(0, 1, 0));
      expect(run.player.x).toBeGreaterThan(0);
      const s = run.layout.stations[0];
      place(run, s.x, s.z);
      const x = run.player.x, z = run.player.z;
      step(run, 50, tap(0, 1, 1));
      expect(run.player.x).toBe(x);
      expect(run.player.z).toBe(z);
      expect(run.player.vx).toBe(0);
      expect(run.action.remainingMs).toBe(1050);
   });

   it("opening takes 1100 ms, retrieval takes a fresh press and 900 ms, and busy edges are dropped", () => {
      const run = createRun(0, { layout: fallbackLayout(0) });
      place(run, -4, -3);
      const events = step(run, 1, tap(0));
      expect(events.inspected).toBe(0);
      expect(events.opened).toBe(NONE);
      expect(run.stations[0].phase).toBe("opening");
      advance(run, 1098, tap(0, 1, 1));
      expect(run.action.remainingMs).toBe(1);
      expect(run.found).toBe(0);
      const last = step(run, 50, tap(0, 1, 1));
      expect(last).toBe(events);
      expect(last.opened).toBe(0);
      expect(last.inspected).toBe(NONE);
      expect(run.stations[0].phase).toBe("open");
      expect(run.items[0].visible).toBe(true);
      expect(run.player.x).toBe(-4);
      expect(run.player.z).toBe(-3);
      expect(run.found).toBe(0);
      advance(run, 2000);
      expect(run.found).toBe(0); // neither completion nor a held Action value can auto-pick
      step(run, 1, KEY);
      advance(run, 898, tap(0, -1, -1));
      expect(run.found).toBe(0);
      expect(run.action.remainingMs).toBe(1);
      expect(step(run, 1, KEY).found).toBe(0);
      expect(run.found).toBe(1);
      expect(run.foundMask).toBe(1);
      expect(run.stations[0].phase).toBe("collected");
      expect(run.items[0]).toMatchObject({ found: true, visible: false });
      expect(targetInReach(run)).toBe(NONE);
      expect(step(run, 1, tap(0)).inspected).toBe(NONE);
      expect(run.found).toBe(1);
   });

   it("empty containers open once, never retrieve, and do not change the checklist", () => {
      const run = createRun(0, { layout: fallbackLayout(0) });
      place(run, 4, 3);
      step(run, 1, tap(3));
      advance(run, 1099);
      expect(run.stations[3].phase).toBe("open");
      expect(run.message).toBe("empty");
      expect(step(run, 50, tap(3)).inspected).toBe(NONE);
      expect(run.foundMask).toBe(0);
      expect(run.found).toBe(0);
   });

   it("door is locked until all items, then spends 600 + 1200 ms and emits win once", () => {
      const run = createRun(0, { layout: fallbackLayout(0) });
      place(run, 0, -4.2);
      advance(run, 5000, KEY);
      expect(run.action.kind).toBe("none");
      expect(run.door.phase).toBe("locked");
      expect(run.door.progressMs).toBe(0);
      expect(run.message).toBe("locked");
      for (const id of [0, 1]) openAndTake(run, id);
      place(run, 0, -4.2);
      step(run, 1, KEY);
      expect(run.door.phase).toBe("locked");
      openAndTake(run, 2);
      place(run, 0, -4.2);
      step(run, 1, KEY);
      expect(run.foundMask).toBe(7);
      expect(run.door.phase).toBe("unlocking");
      advance(run, 598, tap(4, 1, 1));
      expect(run.door.progressMs).toBe(599);
      step(run, 1, KEY);
      expect(run.door.phase).toBe("opening");
      advance(run, 1199, tap(4, 1, 1));
      expect(run.ended).toBe(null);
      const ev = step(run, 1, KEY);
      expect(ev.doorOpened).toBe(true);
      expect(ev.ended).toBe("win");
      expect(run.door.phase).toBe("open");
      const finish = run.finishMs;
      expect(run.finishMs).toBe(run.simMs);
      expect(step(run, 50, tap(4, 1, 1))).toMatchObject({ inspected: -1, opened: -1, found: -1, doorOpened: false, ended: null });
      expect(run.finishMs).toBe(finish);
      expect(run.simMs).toBe(finish);
   });
});

describe("escape-room clock, buffers and pure step", () => {
   it("ignores invalid dt, clamps long frames, carries fractions and never forces a one-ms step", () => {
      const run = createRun(0);
      const snapshot = structuredClone(run);
      for (const dt of [0, -1, NaN, Infinity, -Infinity]) step(run, dt, tap(0, 1, 1));
      expect(run).toEqual(snapshot);
      for (let i = 0; i < 3; i++) step(run, 0.25, IDLE);
      expect(run.simMs).toBe(0);
      expect(run.remainder).toBe(0.75);
      step(run, 0.25, IDLE);
      expect(run.simMs).toBe(1);
      expect(run.remainder).toBe(0);
      step(run, 300, IDLE);
      expect(run.simMs).toBe(51);
      expect(run.stepMs).toBe(50);
      const fractional = createRun(0);
      let elapsed = 0;
      for (let i = 0; i < 10000; i++) {
         const dt = [1000 / 60, 1000 / 144, 0.125, 7.8][i % 4];
         elapsed += dt;
         step(fractional, dt, IDLE);
         expect(fractional.simMs).toBeLessThanOrEqual(elapsed + 1e-6);
         expect(elapsed - fractional.simMs).toBeLessThan(1 + 1e-6);
         expect(fractional.remainder).toBeGreaterThanOrEqual(0);
         expect(fractional.remainder).toBeLessThan(1);
      }
   });

   it("preserves sub-ms inspect presses as an action, with no queued input or allocation of pools/events", () => {
      const run = createRun(0, { layout: fallbackLayout(0) });
      const identities = [run.events, run.action, run.player, run.door, run.stations, run.items, run.layout, ...run.layout.obstacles, ...run.stations, ...run.items];
      place(run, -4, -3);
      step(run, 0.25, tap(0));
      expect(run.action.kind).toBe("open");
      expect(run.action.remainingMs).toBe(1100);
      step(run, 0.75, IDLE);
      expect(run.action.remainingMs).toBe(1099);
      advance(run, 1099);
      advance(run, 1000);
      expect(run.found).toBe(0);
      for (let i = 0; i < identities.length; i++) {
         expect([run.events, run.action, run.player, run.door, run.stations, run.items, run.layout, ...run.layout.obstacles, ...run.stations, ...run.items][i]).toBe(identities[i]);
      }
      const another = createRun(0);
      expect(another.events).not.toBe(run.events);
      expect(another.layout.stations[0]).not.toBe(run.layout.stations[0]);
      expect(another.simMs).toBe(0);
   });

   it("the reachable local step call graph allocates no arrays/objects/closures, and contains no wall clock/random/renderer", () => {
      const source = readFileSync(new URL("./rules.ts", import.meta.url), "utf8");
      const file = ts.createSourceFile("rules.ts", source, ts.ScriptTarget.Latest, true);
      const functions = new Map<string, ts.FunctionDeclaration>();
      for (const statement of file.statements) if (ts.isFunctionDeclaration(statement) && statement.name) functions.set(statement.name.text, statement);
      const seen = new Set<string>();
      const check = (name: string): void => {
         if (seen.has(name)) return;
         seen.add(name);
         const body = functions.get(name)?.body;
         expect(body, name).toBeDefined();
         const visit = (node: ts.Node): void => {
            if (ts.isNewExpression(node) || ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node)
               || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) throw new Error(`Allocation in ${name}: ${node.getText(file)}`);
            if (ts.isCallExpression(node)) {
               if (ts.isIdentifier(node.expression) && functions.has(node.expression.text)) check(node.expression.text);
               if (ts.isPropertyAccessExpression(node.expression)) expect(["map", "filter", "slice", "concat", "flatMap", "bind"]).not.toContain(node.expression.name.text);
            }
            ts.forEachChild(node, visit);
         };
         if (body) visit(body);
      };
      check("step");
      expect(seen.size).toBeGreaterThan(3);
      expect(source).not.toMatch(/Math\.random\s*\(|Date\.now\s*\(|performance\.now\s*\(|setTimeout\s*\(|from ["'](?:react|three)["']/);
   });
});

describe("escape-room minimum completion and TIME scoring", () => {
   it("all 1000 seed-aware speedruns and the fallback finish, never before 15300 ms", () => {
      let minimum = Infinity;
      for (let seed = -1; seed < 1000; seed++) {
         const rng = createRng(seed ^ 0x85ebca6b);
         const run = createRun(seed, seed === -1 ? { layout: fallbackLayout(seed) } : undefined);
         play(run, () => seed % 2 ? 1 + rng() * 49 : 1000 / 60);
         expect(run.ended, `seed ${seed}`).toBe("win");
         expect(run.finishMs).toBeGreaterThanOrEqual(15300);
         expect(run.finishMs).toBeLessThan(600000);
         expect(run.lockedMs).toBeGreaterThanOrEqual(7800);
         expect(run.found).toBe(3);
         minimum = Math.min(minimum, run.finishMs);
      }
      expect(minimum).toBeGreaterThanOrEqual(15300);
   }, 120000);

   it("fixed/random frames and adversarial spamming, early openings and station shortcuts cannot beat the bound", () => {
      let adversarialWins = 0;
      for (const seed of [0, 1, 42, 5050, 0xffffffff]) {
         for (const dt of [1, 7, 1000 / 144, 1000 / 60, 33, 50, -1]) {
            for (const strategy of ["perfect", "spam", "early", "through"] as const) {
               const rng = createRng(seed ^ 91);
               const run = play(createRun(seed), dt === -1 ? () => 0.25 + rng() * 49.75 : () => dt, strategy, 90000);
               if (strategy === "perfect") expect(run.ended).toBe("win");
               if (run.ended === "win") {
                  expect(run.finishMs).toBeGreaterThanOrEqual(15300);
                  if (strategy !== "perfect") adversarialWins++;
               }
            }
         }
      }
      expect(adversarialWins).toBeGreaterThan(20); // attacks include successful runs, not just stuck bots
   }, 120000);

   it("uses core time scoring/normalization and win-only ranking, never the points-game zero rate", () => {
      const scoring = escapeRoomMeta.scoring;
      expect(scoring).toMatchObject({ kind: "time", timeBaseMs: 600000, maxScore: 60000, minDurationMs: 15000, maxDurationMs: 600000, maxPointsPerSec: 0 });
      for (const [ms, score] of [[15300, 58470], [30000, 57000], [45678, 55432], [60000, 54000], [599990, 1], [600000, 0], [700000, 0]]) {
         expect(computeTimeScore(scoring, ms)).toBe(score);
         expect(normalizeRun({ slug: "escape-room", score: 123, durationMs: ms, finishedAt: "2026-10-06T00:00:00Z" }, scoring).score).toBe(score);
      }
      expect(normalizeRun({ slug: "escape-room", score: 999999, durationMs: 15309.5, finishedAt: "2026-10-06T00:00:00Z" }, scoring)).toMatchObject({ durationMs: 15310, score: 58469 });
      expect(isRankedRun(scoring, "win")).toBe(true);
      for (const reason of ["lose", "timeup", "quit", null] as const) expect(isRankedRun(scoring, reason)).toBe(false);
   });

   it("idle time-up is unranked, and time-up wins a tie with the last door millisecond", () => {
      const idle = createRun(0);
      advance(idle, 600000);
      expect(idle.ended).toBe("timeup");
      expect(idle.simMs).toBe(600000);
      expect(idle.found).toBe(0);
      expect(idle.finishMs).toBe(NONE);
      expect(isRankedRun(escapeRoomMeta.scoring, idle.ended)).toBe(false);
      const run = createRun(0, { layout: fallbackLayout(0) });
      for (const id of [0, 1, 2]) openAndTake(run, id);
      place(run, 0, -4.2);
      run.simMs = DURATION_MS - 1800;
      step(run, 1, KEY);
      advance(run, 1798);
      expect(run.action.remainingMs).toBe(1);
      expect(step(run, 1, KEY)).toMatchObject({ doorOpened: false, ended: "timeup" });
      expect(run.ended).toBe("timeup");
      expect(run.finishMs).toBe(NONE);
   });
});

describe("escape-room real-store parity", () => {
   it("countdown residuals, fractional frames, pause and restart never produce untimed motion or animation", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: 600000 });
      store.getState().markReady();
      store.getState().start();
      for (let i = 0; i < 59; i++) advanceRunClock(store, 0.05);
      advanceRunClock(store, 0.047);
      const run = createRun(1);
      advanceRunClock(store, 0.01);
      expect(store.getState().elapsedMs).toBeCloseTo(7, 9);
      expect(playedFrameDt(store.getState())).toBeCloseTo(0.007, 9);
      step(run, playedFrameDt(store.getState()) * 1000, IDLE);
      const rng = createRng(78);
      for (let i = 0; i < 2000; i++) {
         if (i % 101 === 0) store.getState().pause();
         if (i % 101 === 3) store.getState().resume();
         const before = run.simMs;
         advanceRunClock(store, [0.3, 1 / 144, 1 / 60, 0.00025][i % 4]);
         const dt = playedFrameDt(store.getState());
         if (dt) step(run, dt * 1000, { ...IDLE, moveX: 2 * rng() - 1, moveY: 2 * rng() - 1 });
         else expect(run.simMs).toBe(before);
         const elapsed = store.getState().elapsedMs;
         expect(run.simMs).toBeLessThanOrEqual(elapsed + 1e-6);
         expect(elapsed - run.simMs).toBeLessThan(1 + 1e-6);
      }
      store.getState().restart();
      const reset = createRun(2);
      expect(reset.simMs).toBe(0);
      expect(reset.found).toBe(0);
      expect(reset.action.kind).toBe("none");
      expect(store.getState().elapsedMs).toBe(0);
   });

   it("the store's winning duration/score and paused opening match pure rules, without a finalScore override", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: 600000 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5050), bot = makeBot(run);
      const rng = createRng(99);
      let paused = false, foundEvents = 0, winEvents = 0;
      for (let i = 0; store.getState().phase !== "over" && i < 20000; i++) {
         if (!paused && run.action.kind === "open") {
            const snapshot = structuredClone(run);
            store.getState().pause();
            for (let j = 0; j < 100; j++) {
               advanceRunClock(store, 0.05);
               expect(playedFrameDt(store.getState())).toBe(0);
            }
            expect(run).toEqual(snapshot);
            store.getState().resume();
            paused = true;
         }
         advanceRunClock(store, 0.004 + rng() * 0.046);
         const dt = playedFrameDt(store.getState());
         if (!dt) continue;
         const ev = step(run, dt * 1000, bot());
         if (ev.found !== NONE) { foundEvents++; store.getState().setStat("found", run.found); }
         if (ev.ended) { winEvents++; store.getState().end(ev.ended); }
         expect(run.simMs).toBeLessThanOrEqual(store.getState().elapsedMs + 1e-6);
      }
      expect(paused).toBe(true);
      expect(foundEvents).toBe(3);
      expect(winEvents).toBe(1);
      expect(store.getState().endReason).toBe("win");
      expect(store.getState().stats.found).toBe(3);
      expect(store.getState().elapsedMs).toBeGreaterThanOrEqual(15300);
      expect(store.getState().elapsedMs - run.finishMs).toBeLessThan(51);
      const submitted = normalizeRun({ slug: "escape-room", score: store.getState().score, durationMs: store.getState().elapsedMs, finishedAt: "2026-10-06T00:00:00Z" }, escapeRoomMeta.scoring);
      expect(submitted.score).toBe(Math.max(0, Math.floor((600000 - submitted.durationMs) / 10)));
      expect(isRankedRun(escapeRoomMeta.scoring, store.getState().endReason)).toBe(true);
   });

   it("shell time-up suppresses a last game callback and leaves an idle time game unranked", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: 600000 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(0);
      for (let i = 0; store.getState().phase !== "over" && i < 12100; i++) {
         advanceRunClock(store, 0.05);
         const dt = playedFrameDt(store.getState());
         if (dt) step(run, dt * 1000, IDLE);
      }
      expect(store.getState().elapsedMs).toBe(600000);
      expect(store.getState().endReason).toBe("timeup");
      expect(playedFrameDt(store.getState())).toBe(0);
      expect(run.ended).toBe(null); // shell owns the cap and stops useRunFrame before its final callback
      expect(run.simMs).toBe(599950);
      expect(run.found).toBe(0);
      expect(store.getState().score).toBe(0);
      expect(isRankedRun(escapeRoomMeta.scoring, store.getState().endReason)).toBe(false);
   });
});
