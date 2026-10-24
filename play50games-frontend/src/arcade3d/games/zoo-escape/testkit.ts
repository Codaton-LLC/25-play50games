// Test-only helpers (imported by fairness.test.ts and rules.test.ts, never by the game): the
// fairness grid of each stage and the blocked masks of every keeper's undisturbed patrol, in the
// layout of core/testing/periodic (phase-major, 1 = unsafe). Pure, no three.js.
import { distanceToBoxXZ, sphereAabbOverlap } from "@/arcade3d/core/collision";
import { inViewCone, type Agent, type PatrolState } from "@/arcade3d/core/ai";
import { BUSHES, CYCLES, KEEPERS, SNACK_CANDIDATES as SNACK_CANDIDATES_REF, SOLIDS, STAGES, STAGE_KEEPERS, type StageIndex } from "./level";
import { HEARING, KEEPER, PANDA, SEARCHLIGHT, VISION, clearSight, placeOnSchedule, searchlightYaw } from "./rules";

/** Solver grid: 0.4 m cells, 0.25 s steps: a sneak (1.6 m/s) moves one cell per step. */
export const FAIR = { cell: 0.4, step: 0.25, sub: 8, hearing: HEARING.sneak + 0.75, walkHearing: HEARING.walk + 0.75, oracleSneak: HEARING.sneak + 0.35, oracleWalk: HEARING.walk + 0.35, coneDeg: 3, rangeMargin: 0.5, corner: 0.25, bushInset: 0.2, searchMargin: 0.4, goalDepth: 1.6 } as const;

export interface StageGrid {
   stage: StageIndex;
   width: number;
   height: number;
   cells: number;
   x0: number;
   z0: number;
   /** 1 = the panda's disc overlaps a solid or the cell is outside the stage */
   wall: Uint8Array;
   /** cells past the gate line (the goal) */
   goal: Uint8Array;
   /** the bush whose (inset) box holds the cell centre, -1 none */
   hidden: Int16Array;
   cx(c: number): number;
   cz(c: number): number;
   cellOf(x: number, z: number): number;
}

const grids = new Map<number, StageGrid>();

export function stageGrid(stage: StageIndex): StageGrid {
   const cached = grids.get(stage);
   if (cached) return cached;
   const s = STAGES[stage];
   const x0 = s.bounds.x0;
   const z0 = s.gate.z - FAIR.goalDepth;
   const width = Math.round((s.bounds.x1 - s.bounds.x0) / FAIR.cell);
   const height = Math.round((s.bounds.z1 - z0) / FAIR.cell);
   const cells = width * height;
   const cx = (c: number) => x0 + ((c % width) + 0.5) * FAIR.cell;
   const cz = (c: number) => z0 + (Math.floor(c / width) + 0.5) * FAIR.cell;
   const wall = new Uint8Array(cells);
   const goal = new Uint8Array(cells);
   const hidden = new Int16Array(cells).fill(-1);
   const p = { x: 0, y: 0.5, z: 0 };
   for (let c = 0; c < cells; c++) {
      p.x = cx(c); p.z = cz(c);
      if (SOLIDS.some((b) => sphereAabbOverlap(p, PANDA.radius, b))) wall[c] = 1;
      if (p.z < s.gate.z) goal[c] = wall[c] ? 0 : 1;
      const i = BUSHES.findIndex(
         (b) => p.x >= b.box.min.x + FAIR.bushInset && p.x <= b.box.max.x - FAIR.bushInset && p.z >= b.box.min.z + FAIR.bushInset && p.z <= b.box.max.z - FAIR.bushInset
      );
      hidden[c] = i;
   }
   const cellOf = (x: number, z: number) => {
      const i = Math.min(width - 1, Math.max(0, Math.floor((x - x0) / FAIR.cell)));
      const j = Math.min(height - 1, Math.max(0, Math.floor((z - z0) / FAIR.cell)));
      return j * width + i;
   };
   const g: StageGrid = { stage, width, height, cells, x0, z0, wall, goal, hidden, cx, cz, cellOf };
   grids.set(stage, g);
   return g;
}

export const phasesOf = (stage: StageIndex) => Math.round(CYCLES[stage] / FAIR.step);
/** Phase steps of one seeded offset step (C / 6). */
export const offsetSteps = (stage: StageIndex) => phasesOf(stage) / KEEPER.offsets;

const masks = new Map<string, Uint8Array>();

/** Is the panda at cell c unsafe from a watcher at `feet` facing `yaw` (cone half-angle, range)? */
function unsafe(g: StageGrid, c: number, feet: { x: number; y: number; z: number }, yaw: number, half: number, range: number, near: number, pt: { x: number; y: number; z: number }): boolean {
   const x = g.cx(c), z = g.cz(c);
   const d = Math.hypot(x - feet.x, z - feet.z);
   if (d <= near) return true;
   const h = g.hidden[c];
   if (h >= 0) return distanceToBoxXZ(feet.x, feet.z, BUSHES[h].box) <= KEEPER.radius + FAIR.searchMargin;
   if (d > range + FAIR.rangeMargin + FAIR.corner * 1.5) return false;
   const wide = half + (FAIR.coneDeg * Math.PI) / 180;
   for (let k = 0; k < 5; k++) {
      pt.x = x + (k === 0 ? 0 : k < 3 ? -FAIR.corner : FAIR.corner);
      pt.z = z + (k === 0 ? 0 : k % 2 ? -FAIR.corner : FAIR.corner);
      if (inViewCone(feet, yaw, wide, range + FAIR.rangeMargin, pt) && clearSight(feet, pt)) return true;
   }
   return false;
}

/** The blocked mask of keeper `i` on its stage grid (schedule offset 0). */
export function keeperMask(i: number, near: number = FAIR.hearing): Uint8Array {
   const key = `k${i}:${near}`;
   const cached = masks.get(key);
   if (cached) return cached;
   const stage = KEEPERS[i].stage;
   const g = stageGrid(stage);
   const phases = phasesOf(stage);
   const mask = new Uint8Array(g.cells * phases);
   const agent: Agent = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 };
   const patrol: PatrolState = { index: 1, wait: 0, mode: "patrol", target: { x: 0, y: 0, z: 0 } };
   const pt = { x: 0, y: 0, z: 0 };
   for (let p = 0; p < phases; p++) {
      for (let j = 0; j <= FAIR.sub; j++) {
         placeOnSchedule(agent, patrol, i, (p + j / FAIR.sub) * FAIR.step);
         for (let c = 0; c < g.cells; c++) {
            const o = p * g.cells + c;
            if (mask[o] || g.wall[c]) continue;
            if (unsafe(g, c, agent, agent.yaw, VISION.halfAngle, VISION.range[stage], near, pt)) mask[o] = 1;
         }
      }
   }
   masks.set(key, mask);
   return mask;
}

/** The searchlight's mask on stage 3's grid (phase 0; it shifts with the first stage-3 keeper). */
export function lightMask(): Uint8Array {
   const cached = masks.get("light");
   if (cached) return cached;
   const g = stageGrid(2);
   const phases = phasesOf(2);
   const mask = new Uint8Array(g.cells * phases);
   const eye = { x: SEARCHLIGHT.x, y: 0, z: SEARCHLIGHT.z };
   const pt = { x: 0, y: 0, z: 0 };
   for (let p = 0; p < phases; p++) {
      for (let j = 0; j <= FAIR.sub; j++) {
         const yaw = searchlightYaw((p + j / FAIR.sub) * FAIR.step, 0);
         for (let c = 0; c < g.cells; c++) {
            const o = p * g.cells + c;
            if (mask[o] || g.wall[c]) continue;
            if (unsafe(g, c, eye, yaw, SEARCHLIGHT.halfAngle, SEARCHLIGHT.range, 0, pt)) mask[o] = 1;
         }
      }
   }
   masks.set("light", mask);
   return mask;
}

/** Walls as a mask (blocked at every phase). */
export function wallMask(stage: StageIndex): Uint8Array {
   const key = `w${stage}`;
   const cached = masks.get(key);
   if (cached) return cached;
   const g = stageGrid(stage);
   const phases = phasesOf(stage);
   const mask = new Uint8Array(g.cells * phases);
   for (let p = 0; p < phases; p++) for (let c = 0; c < g.cells; c++) mask[p * g.cells + c] = g.wall[c];
   masks.set(key, mask);
   return mask;
}

/** The stage's keepers' masks paired with how far each is shifted by its offset step k (and the light with stage 3's first keeper). */
export function stageWatchers(stage: StageIndex): { mask: Uint8Array; keeperSlot: number }[] {
   const out = STAGE_KEEPERS[stage].map((i, slot) => ({ mask: keeperMask(i), keeperSlot: slot }));
   if (stage === 2) out.push({ mask: lightMask(), keeperSlot: 0 });
   return out;
}

/** Every offset combination of a stage (k per keeper of the stage, 0..5). */
export function combinations(stage: StageIndex): number[][] {
   const n = STAGE_KEEPERS[stage].length;
   const out: number[][] = [];
   const total = KEEPER.offsets ** n;
   for (let m = 0; m < total; m++) {
      const ks: number[] = [];
      let v = m;
      for (let i = 0; i < n; i++) { ks.push(v % KEEPER.offsets); v = Math.floor(v / KEEPER.offsets); }
      out.push(ks);
   }
   return out;
}

/** The cells of a disc / box region (non-wall). */
export function cellsIn(g: StageGrid, x0: number, z0: number, x1: number, z1: number): number[] {
   const out: number[] = [];
   for (let c = 0; c < g.cells; c++) {
      const x = g.cx(c), z = g.cz(c);
      if (!g.wall[c] && x >= x0 && x <= x1 && z >= z0 && z <= z1) out.push(c);
   }
   return out;
}

/** The stage's start cells (the start point's cell and its free 4-neighbours) and its entry band (stages 2-3). */
export function startCells(stage: StageIndex): number[] {
   const g = stageGrid(stage);
   const s = STAGES[stage].start;
   return cellsIn(g, s.x - 0.45, s.z - 0.45, s.x + 0.45, s.z + 0.45);
}
export function entryBand(stage: StageIndex): number[] {
   if (stage === 0) return [];
   const g = stageGrid(stage);
   const prev = STAGES[stage - 1].gate;
   const mid = (prev.x0 + prev.x1) / 2;
   return cellsIn(g, mid - 0.5, prev.z - 1.5, mid + 0.5, prev.z);
}

// ---------- combined masks and the oracle's forward search ----------

/** Walls + every watcher of the stage shifted by its keeper's offset step (ks[slot] in 0..5). */
export function stageBlocked(stage: StageIndex, ks: readonly number[], near: number = FAIR.hearing): Uint8Array {
   const g = stageGrid(stage);
   const P = phasesOf(stage);
   const out = wallMask(stage).slice();
   const tmp = new Uint8Array(g.cells * P);
   const ids = STAGE_KEEPERS[stage];
   const shiftOr = (mask: Uint8Array, k: number) => {
      const s = k * offsetSteps(stage);
      for (let p = 0; p < P; p++) {
         const from = ((p + s) % P) * g.cells;
         tmp.set(mask.subarray(from, from + g.cells), p * g.cells);
      }
      for (let i = 0; i < out.length; i++) out[i] |= tmp[i];
   };
   ids.forEach((id, slot) => shiftOr(keeperMask(id, near), ks[slot]));
   if (stage === 2) shiftOr(lightMask(), ks[0]);
   return out;
}

/** Oracle moves: waits and 4-neighbour steps are sneak moves (1.6 m/s); diagonals and 2-cell hops are walk moves (<= 3.2 m/s). */
export const ORACLE_MOVES: readonly (readonly [dx: number, dy: number, walk: boolean])[] = [
   [0, 0, false], [1, 0, false], [-1, 0, false], [0, 1, false], [0, -1, false],
   [1, 1, true], [1, -1, true], [-1, 1, true], [-1, -1, true], [2, 0, true], [-2, 0, true], [0, 2, true], [0, -2, true],
];
export const SNEAK_MOVES = ORACLE_MOVES.slice(0, 5);

export interface GridPlan {
   /** the cell at every step (cells[0] = the start) */
   cells: number[];
   /** walk[i]: the move cells[i] -> cells[i + 1] is a walk move */
   walk: boolean[];
}

/**
 * Earliest arrival (fewest 0.25 s steps) from (start, phase) to any cell with target(c), on a sneak
 * mask (sneak moves) and a walk mask (walk moves: source, middle and destination must be clear).
 */
export function earliest(stage: StageIndex, sneak: Uint8Array, walk: Uint8Array | null, start: number, phase: number, target: (c: number) => boolean, moves = walk ? ORACLE_MOVES : SNEAK_MOVES): GridPlan | null {
   const g = stageGrid(stage);
   const P = phasesOf(stage);
   const cells = g.cells;
   const p0 = ((phase % P) + P) % P;
   if (target(start)) return { cells: [start], walk: [] };
   const seen = new Int32Array(cells * P).fill(-1);
   const how = new Int8Array(cells * P);
   const queue = new Int32Array(cells * P);
   let head = 0, tail = 0;
   const first = p0 * cells + start;
   seen[first] = first;
   queue[tail++] = first;
   while (head < tail) {
      const s = queue[head++];
      const p = (s / cells) | 0;
      const c = s - p * cells;
      const x = c % g.width, y = (c - x) / g.width;
      const q = (p + 1) % P;
      for (let m = 0; m < moves.length; m++) {
         const [dx, dy, w] = moves[m];
         const nx = x + dx, ny = y + dy;
         if (nx < 0 || ny < 0 || nx >= g.width || ny >= g.height) continue;
         const nc = ny * g.width + nx;
         const mask = w ? walk! : sneak;
         if (mask[p * cells + c] || mask[q * cells + nc]) continue;
         if (w) {
            if (Math.abs(dx) === 2 || Math.abs(dy) === 2) {
               const mc = (y + dy / 2) * g.width + (x + dx / 2);
               if (mask[p * cells + mc] || g.wall[mc]) continue;
            } else if (g.wall[y * g.width + nx] || g.wall[ny * g.width + x]) continue;
         }
         const ns = q * cells + nc;
         if (seen[ns] !== -1) continue;
         seen[ns] = s;
         how[ns] = m;
         if (target(nc)) {
            const out: number[] = [];
            const wk: boolean[] = [];
            for (let t = ns; t !== first; t = seen[t]) { out.push(t % cells); wk.push(moves[how[t]][2]); }
            out.push(start);
            return { cells: out.reverse(), walk: wk.reverse() };
         }
         queue[tail++] = ns;
      }
   }
   return null;
}

/** Cells whose centre is within `r` of a point (non-wall). */
export function cellsNear(g: StageGrid, x: number, z: number, r: number): Set<number> {
   const out = new Set<number>();
   for (let c = 0; c < g.cells; c++) if (!g.wall[c] && Math.hypot(g.cx(c) - x, g.cz(c) - z) <= r) out.add(c);
   return out;
}

/**
 * The oracle's plan through one stage: from (start, phase) every snack in `snacks` (best order of
 * all permutations, earliest arrival per leg) and then the gate. null when some leg is impossible.
 */
export function oracleStage(stage: StageIndex, ks: readonly number[], start: number, phase: number, snacks: readonly { x: number; z: number }[], walkMoves = true): GridPlan | null {
   const g = stageGrid(stage);
   const sneak = stageBlocked(stage, ks, walkMoves ? FAIR.oracleSneak : FAIR.hearing);
   const walk = walkMoves ? stageBlocked(stage, ks, FAIR.oracleWalk) : null;
   const targets = snacks.map((s) => cellsNear(g, s.x, s.z, 0.5));
   const gate = (c: number) => g.goal[c] === 1;
   let best: GridPlan | null = null;
   const join = (a: GridPlan, b: GridPlan): GridPlan => ({ cells: [...a.cells, ...b.cells.slice(1)], walk: [...a.walk, ...b.walk] });
   const go = (plan: GridPlan, left: number[]) => {
      if (best && plan.cells.length >= best.cells.length) return;
      const at = plan.cells[plan.cells.length - 1];
      const ph = phase + plan.cells.length - 1;
      if (left.length === 0) {
         const leg = earliest(stage, sneak, walk, at, ph, gate);
         if (leg && (!best || plan.cells.length + leg.cells.length - 1 < best.cells.length)) best = join(plan, leg);
         return;
      }
      for (const i of left) {
         const leg = earliest(stage, sneak, walk, at, ph, (c) => targets[i].has(c));
         if (leg) go(join(plan, leg), left.filter((j) => j !== i));
      }
   };
   go({ cells: [start], walk: [] }, snacks.map((_, i) => i));
   return best;
}

// ---------- the score bound: the shortest conceivable route (straight lines, no obstacles) ----------

/** Samples per snack circle and per gate window; SLACK covers the sampling (rigorous lower bound). */
export const BOUND = { circle: 64, window: 21 } as const;

/**
 * A lower bound (m) on the distance the panda's centre travels through `stage` while eating m of its
 * candidates: from any point of the previous gate's centre window (stage 1: the start) to any point
 * of this gate's window, touching the eating disc (radius SNACK reach) of each snack of some valid
 * pick (>= minGap apart) in some order. Straight lines only (obstacles only lengthen a route), the
 * touch points and window points sampled, minus the sampling slack.
 */
export function stageRouteBound(stage: StageIndex, m: number, reach: number, minGap: number, radius: number): number {
   const cands = SNACK_CANDIDATES_REF[stage];
   const windowPts = (g: { x0: number; x1: number; z: number }) =>
      Array.from({ length: BOUND.window }, (_, i) => ({ x: g.x0 + radius + ((g.x1 - g.x0 - 2 * radius) * i) / (BOUND.window - 1), z: g.z }));
   const from = stage === 0 ? [STAGES[0].start] : windowPts(STAGES[stage - 1].gate);
   const to = windowPts(STAGES[stage].gate);
   const winSlack = (g: { x0: number; x1: number }) => (g.x1 - g.x0 - 2 * radius) / (BOUND.window - 1) / 2;
   const slack = (stage === 0 ? 0 : winSlack(STAGES[stage - 1].gate)) + winSlack(STAGES[stage].gate) + m * 2 * reach * Math.sin(Math.PI / BOUND.circle);
   const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
   if (m === 0) {
      let best = Infinity;
      for (const a of from) for (const b of to) best = Math.min(best, d(a, b));
      return Math.max(0, best - slack);
   }
   const ring = (c: { x: number; z: number }) => Array.from({ length: BOUND.circle }, (_, i) => ({ x: c.x + reach * Math.cos((2 * Math.PI * i) / BOUND.circle), z: c.z + reach * Math.sin((2 * Math.PI * i) / BOUND.circle) }));
   const rings = cands.map(ring);
   const sets: number[][] = [];
   const rec = (start: number, cur: number[]) => {
      if (cur.length === m) { sets.push(cur.slice()); return; }
      for (let i = start; i < cands.length; i++) if (cur.every((j) => d(cands[i], cands[j]) >= minGap)) { cur.push(i); rec(i + 1, cur); cur.pop(); }
   };
   rec(0, []);
   const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
   let best = Infinity;
   const cur = new Float64Array(BOUND.circle), next = new Float64Array(BOUND.circle);
   for (const set of sets) for (const p of perms(set)) {
      const r0 = rings[p[0]];
      for (let s = 0; s < BOUND.circle; s++) { let v = Infinity; for (const a of from) v = Math.min(v, d(a, r0[s])); cur[s] = v; }
      for (let k = 1; k < p.length; k++) {
         const ra = rings[p[k - 1]], rb = rings[p[k]];
         for (let t = 0; t < BOUND.circle; t++) { let v = Infinity; for (let s = 0; s < BOUND.circle; s++) v = Math.min(v, cur[s] + d(ra[s], rb[t])); next[t] = v; }
         cur.set(next);
      }
      const rl = rings[p[p.length - 1]];
      for (let s = 0; s < BOUND.circle; s++) { let v = Infinity; for (const b of to) v = Math.min(v, d(rl[s], b)); best = Math.min(best, cur[s] + v); }
   }
   return Math.max(0, best - slack);
}

// ---------- bots: following a grid plan through the real rules ----------

/** A plan in world points, one per 0.25 s step from run time `t0`, walk[i] for the move i -> i + 1. */
export interface WorldPlan {
   x: number[];
   z: number[];
   walk: boolean[];
   t0: number;
}

export function emptyPlan(t0: number): WorldPlan {
   return { x: [], z: [], walk: [], t0 };
}

/** Appends a stage's grid plan (its first cell repeats the previous plan's last point, so it is dropped). */
export function appendPlan(out: WorldPlan, stage: StageIndex, plan: GridPlan): void {
   const g = stageGrid(stage);
   const skip = out.x.length ? 1 : 0;
   for (let i = skip; i < plan.cells.length; i++) { out.x.push(g.cx(plan.cells[i])); out.z.push(g.cz(plan.cells[i])); }
   if (skip === 0) out.walk.push(...plan.walk);
   else out.walk.push(...plan.walk);
}

/** The oracle's plan from (x, z) at run time t (on a step boundary) through the stages from `stage`, eating the given snacks per stage. */
export function oraclePlan(offsets: readonly number[], stage: StageIndex, x: number, z: number, t: number, snacksPer: readonly (readonly { x: number; z: number }[])[], walkMoves = true): WorldPlan | null {
   const plan = emptyPlan(t);
   let at = { x, z };
   let time = t;
   for (let s = stage; s < STAGES.length; s++) {
      const st = s as StageIndex;
      const g = stageGrid(st);
      const ks = STAGE_KEEPERS[st].map((i) => offsets[i]);
      const phase = Math.round((time % CYCLES[st]) / FAIR.step);
      const p = oracleStage(st, ks, g.cellOf(at.x, at.z), phase, snacksPer[s], walkMoves);
      if (!p) return null;
      appendPlan(plan, st, p);
      time += (p.cells.length - 1) * FAIR.step;
      const last = p.cells[p.cells.length - 1];
      at = { x: g.cx(last), z: g.cz(last) };
   }
   // two more steps north through the last gate, so the follower crosses it
   plan.x.push(at.x, at.x); plan.z.push(at.z - 0.8, at.z - 1.6); plan.walk.push(false, false);
   return plan;
}

const LEAD = 0.1;

/**
 * Steers the panda along the plan: at run time `time` it aims at where the plan is LEAD s later and
 * asks for the speed that closes the gap in LEAD s, sneaking on sneak moves. Returns false once the
 * plan is used up.
 */
export function followPlan(plan: WorldPlan, px: number, pz: number, time: number, out: { dirX: number; dirZ: number; sneak: boolean; toss: boolean }): boolean {
   const n = plan.x.length;
   const f = (time + LEAD - plan.t0) / FAIR.step;
   const i = Math.max(0, Math.min(n - 1, Math.floor(f)));
   const j = Math.min(n - 1, i + 1);
   const k = Math.max(0, Math.min(1, f - Math.floor(f)));
   const tx = plan.x[i] + (plan.x[j] - plan.x[i]) * k;
   const tz = plan.z[i] + (plan.z[j] - plan.z[i]) * k;
   const walk = i < plan.walk.length ? plan.walk[i] : false;
   const dx = tx - px, dz = tz - pz;
   const d = Math.hypot(dx, dz);
   const top = walk ? PANDA.walk : PANDA.sneak;
   const amount = Math.min(1, d / (top * LEAD));
   out.dirX = d > 1e-4 ? (dx / d) * amount : 0;
   out.dirZ = d > 1e-4 ? (dz / d) * amount : 0;
   out.sneak = !walk;
   out.toss = false;
   return f < n;
}
