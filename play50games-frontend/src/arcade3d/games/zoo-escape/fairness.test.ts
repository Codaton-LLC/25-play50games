// Zoo Escape fairness (core/testing/periodic, C5): on a 0.4 m x 0.25 s grid with conservative
// margins, every stage start and every gate-entry band cell has a safe sneaking route to the gate
// at every patrol phase of every seeded offset combination; the starts and entry bands are outside
// every cone and out of earshot at every moment; every snack candidate is risky but reachable; the
// level data is sane; a solver bot replays the safe routes through the real rules and store (0
// catches) and a novice proxy wins most runs.
import { describe, expect, it } from "vitest";
import { orMasks, periodicMask, planPeriodic, shiftMask, solvePeriodic, solvePeriodicSteps } from "@/arcade3d/core/testing/periodic";
import { createGrid, findPath, freeGrid, nearestFree, simulateRun, fixedFrames, randomFrames, steer } from "@/arcade3d/core/testing/botHarness";
import { distanceToBoxXZ } from "@/arcade3d/core/collision";
import { inViewCone, type Agent, type PatrolState } from "@/arcade3d/core/ai";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { BUSHES, CYCLES, KEEPERS, SNACK_CANDIDATES, SOLIDS, STAGES, STAGE_KEEPERS, type StageIndex } from "./level";
import { KEEPER, PANDA, SEARCHLIGHT, VISION, applyToStore, bushAt, clearSight, createRun, keeperSees, placeOnSchedule, searchlightSees, searchlightYaw, seedLayout, stepRun, type RunState, type StepInput } from "./rules";
import { appendPlan, combinations, emptyPlan, entryBand, followPlan, keeperMask, lightMask, offsetSteps, phasesOf, stageGrid, stageWatchers, startCells, wallMask, type WorldPlan } from "./testkit";

const STAGE_LIST: StageIndex[] = [0, 1, 2];

function blockedFor(stage: StageIndex, ks: readonly number[]): Uint8Array {
   const g = stageGrid(stage), P = phasesOf(stage);
   const out = orMasks(periodicMask(g.cells, P), wallMask(stage));
   const tmp = new Uint8Array(g.cells * P);
   for (const w of stageWatchers(stage)) orMasks(out, shiftMask(w.mask, g.cells, P, ks[w.keeperSlot] * offsetSteps(stage), tmp));
   return out;
}
const goalsOf = (stage: StageIndex) => { const g = stageGrid(stage); const out: number[] = []; for (let c = 0; c < g.cells; c++) if (g.goal[c]) out.push(c); return out; };

describe("level data", () => {
   it("keeps every route inside its stage and its zone, every zone free of solids, at most one bush on a route per stage", () => {
      KEEPERS.forEach((k, i) => {
         const b = STAGES[k.stage].bounds;
         for (const q of k.route) {
            expect(q.x > b.x0 && q.x < b.x1 && q.z > b.z0 && q.z < b.z1, `keeper ${i}`).toBe(true);
            expect(q.x >= k.zone.min.x && q.x <= k.zone.max.x && q.z >= k.zone.min.z && q.z <= k.zone.max.z).toBe(true);
         }
         for (const s of SOLIDS) {
            const apart = s.max.x < k.zone.min.x || s.min.x > k.zone.max.x || s.max.z < k.zone.min.z || s.min.z > k.zone.max.z;
            expect(apart, `keeper ${i} zone vs solid ${JSON.stringify(s.min)}`).toBe(true);
         }
      });
      for (const s of STAGE_LIST) {
         const onRoute = BUSHES.filter((b) => b.stage === s && STAGE_KEEPERS[s].some((i) => {
            const pts = KEEPERS[i].route;
            for (let j = 0; j < pts.length; j++) {
               const a = pts[j], c = pts[(j + 1) % pts.length];
               for (let t = 0; t <= 1; t += 0.01) if (distanceToBoxXZ(a.x + (c.x - a.x) * t, a.z + (c.z - a.z) * t, b.box) <= KEEPER.radius) return true;
            }
            return false;
         }));
         expect(onRoute.length).toBeLessThanOrEqual(1);
      }
   });

   it("puts the respawn points and the entry bands outside every cone and out of earshot, at every moment", () => {
      const agent: Agent = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 };
      const patrol: PatrolState = { index: 1, wait: 0, mode: "patrol", target: { x: 0, y: 0, z: 0 } };
      for (const s of STAGE_LIST) {
         const start = { x: STAGES[s].start.x, y: 0, z: STAGES[s].start.z };
         const band: { x: number; y: number; z: number }[] = [];
         if (s > 0) {
            const g = STAGES[s - 1].gate, mid = (g.x0 + g.x1) / 2;
            for (let x = mid - 0.5; x <= mid + 0.5 + 1e-9; x += 0.25) for (let z = g.z - 1.5; z <= g.z + 1e-9; z += 0.25) band.push({ x, y: 0, z });
         }
         for (const i of STAGE_KEEPERS[s]) {
            for (let t = 0; t < CYCLES[s]; t += 0.05) {
               placeOnSchedule(agent, patrol, i, t);
               expect(keeperSees(agent, agent.yaw, s, start), `stage ${s + 1} start, keeper ${i}, t ${t}`).toBe(false);
               expect(Math.hypot(agent.x - start.x, agent.z - start.z)).toBeGreaterThanOrEqual(4);
               for (const q of band) {
                  expect(keeperSees(agent, agent.yaw, s, q), `band ${q.x},${q.z} keeper ${i} t ${t}`).toBe(false);
                  expect(Math.hypot(agent.x - q.x, agent.z - q.z)).toBeGreaterThanOrEqual(3.75);
               }
            }
         }
         if (s === 2) for (let t = 0; t < SEARCHLIGHT.period; t += 0.02) {
            for (const q of [start, ...band]) expect(searchlightSees(searchlightYaw(t, 0), q)).toBe(false);
         }
      }
   });
});

describe("safe routes at every phase (periodic solver)", () => {
   it("every stage start and entry-band cell is winning at every phase of every offset combination; every snack is reachable", () => {
      for (const s of STAGE_LIST) {
         const g = stageGrid(s), P = phasesOf(s);
         const must = [...startCells(s), ...entryBand(s)];
         expect(must.length).toBeGreaterThan(0);
         const snackCells = SNACK_CANDIDATES[s].map((c) => g.cellOf(c.x, c.z));
         const goal = goalsOf(s);
         let checked = 0;
         for (const ks of combinations(s)) {
            const win = solvePeriodic({ grid: { width: g.width, height: g.height }, period: P, blocked: blockedFor(s, ks), goal });
            for (const c of must) for (let p = 0; p < P; p++) expect(win[p * g.cells + c], `stage ${s + 1} cell ${c} phase ${p} ks ${ks}`).toBe(1);
            for (const c of snackCells) {
               let any = false;
               for (let p = 0; p < P && !any; p++) any = win[p * g.cells + c] === 1;
               expect(any, `stage ${s + 1} snack cell ${c} ks ${ks}`).toBe(true);
            }
            checked++;
         }
         expect(checked).toBe(KEEPER.offsets ** STAGE_KEEPERS[s].length);
      }
   });

   it("makes every snack candidate risky: some watcher sees it 15-60 % of the cycle", () => {
      for (const s of STAGE_LIST) {
         const g = stageGrid(s), P = phasesOf(s);
         const masks = STAGE_KEEPERS[s].map((i) => keeperMask(i, 0));
         if (s === 2) masks.push(lightMask());
         for (const c of SNACK_CANDIDATES[s]) {
            const cell = g.cellOf(c.x, c.z);
            const share = Math.max(...masks.map((m) => { let f = 0; for (let p = 0; p < P; p++) f += m[p * g.cells + cell]; return f / P; }));
            expect(share, `stage ${s + 1} snack ${c.x},${c.z}`).toBeGreaterThanOrEqual(0.15);
            expect(share).toBeLessThanOrEqual(0.6);
         }
      }
   });
});

// ---------- bots through the real rules and store ----------

function play(seed: number, frame: () => number, brain: (run: RunState, input: StepInput, dt: number) => void) {
   const run = createRun(seed);
   const input: StepInput = { dirX: 0, dirZ: 0, sneak: false, toss: false };
   const shown = { time: -1, bamboo: -1 };
   const end = simulateRun(createArcadeStore(), { frame, step: (dt, _t, store) => { brain(run, input, dt); stepRun(run, input, dt); applyToStore(run, store.getState(), shown); } });
   return { end, run };
}

/** The solver bot's plan: the safe sneaking route (planPeriodic on the conservative masks) of each stage, chained in run time. */
function solverPlan(seed: number): WorldPlan {
   const L = seedLayout(seed);
   const plan = emptyPlan(0);
   let x = STAGES[0].start.x, z = STAGES[0].start.z, t = 0;
   for (const s of STAGE_LIST) {
      const g = stageGrid(s), P = phasesOf(s);
      const problem = { grid: { width: g.width, height: g.height }, period: P, blocked: blockedFor(s, STAGE_KEEPERS[s].map((i) => L.offsets[i])), goal: goalsOf(s) };
      const start = g.cellOf(x, z);
      const moves = planPeriodic(problem, start, Math.round((t % CYCLES[s]) / 0.25), solvePeriodicSteps(problem));
      expect(moves, `seed ${seed} stage ${s + 1}`).not.toBeNull();
      const cells = [start];
      for (const [dx, dy] of moves!) cells.push(cells[cells.length - 1] + dy * g.width + dx);
      appendPlan(plan, s, { cells, walk: cells.slice(1).map(() => false) });
      t += moves!.length * 0.25;
      const last = cells[cells.length - 1];
      x = g.cx(last); z = g.cz(last);
   }
   plan.x.push(x, x); plan.z.push(z - 0.8, z - 1.6); plan.walk.push(false, false);
   return plan;
}

describe("bots", () => {
   it("the solver bot replays the safe routes through the real rules: it wins every seed with 0 catches", () => {
      for (let seed = 1; seed <= 24; seed++) {
         const plan = solverPlan(seed);
         const frame = seed % 3 === 0 ? fixedFrames(1000 / 30) : seed % 3 === 1 ? fixedFrames(1000 / 60) : randomFrames(seed, 0.008, 0.03);
         const { end, run } = play(seed, frame, (r, input, dt) => { followPlan(plan, r.panda.x, r.panda.z, r.time + dt, input); });
         expect(end.endReason, `seed ${seed}`).toBe("win");
         expect(run.catches, `seed ${seed}`).toBe(0);
      }
   });

   it("a novice proxy (cautious, no plan: waits when the way ahead is watched, hides in bushes, reacts 0.3 s late) wins most runs", () => {
      const grid = createGrid({ cell: 0.4, halfX: 10, halfZ: 44 });
      const free = freeGrid(grid, (x, z) => z <= 18 && SOLIDS.every((b) => Math.max(b.min.x - x, 0, x - b.max.x) ** 2 + Math.max(b.min.z - z, 0, z - b.max.z) ** 2 > (PANDA.radius + 0.15) ** 2));
      const goals = STAGES.map((s) => ({ x: (s.gate.x0 + s.gate.x1) / 2, z: s.gate.z - 1.6 }));
      const follower = (x: number, z: number, s: StageIndex) => ({ goalX: goals[s].x, goalZ: goals[s].z, path: findPath(grid, free, nearestFree(grid, free, x, z), nearestFree(grid, free, goals[s].x, goals[s].z)), k: 0 });
      const out = { dirX: 0, dirZ: 0 };
      const pt = { x: 0, y: 0, z: 0 };
      const tower = { x: SEARCHLIGHT.x, y: 0, z: SEARCHLIGHT.z };
      /** Would a keeper (or the searchlight) of the stage notice the point now? (a human's rough read of the drawn cones) */
      const watched = (r: RunState, x: number, z: number) => {
         pt.x = x; pt.z = z;
         if (bushAt(x, z) >= 0) return false;
         for (const i of STAGE_KEEPERS[r.stage]) {
            const a = r.keepers[i].agent;
            if (Math.hypot(a.x - x, a.z - z) < 2.4) return true;
            if (inViewCone(a, a.yaw, VISION.halfAngle + 0.2, VISION.range[r.stage] + 1.5, pt) && clearSight(a, pt)) return true;
         }
         return r.stage === 2 && inViewCone(tower, r.light.yaw, SEARCHLIGHT.halfAngle + 0.25, SEARCHLIGHT.range + 1, pt) && clearSight(tower, pt);
      };
      let wins = 0;
      const N = 40;
      for (let seed = 101; seed < 101 + N; seed++) {
         const m = { f: follower(STAGES[0].start.x, STAGES[0].start.z, 0), stage: 0, think: 0, mode: "go" as "go" | "wait" | "hide", hide: -1, waited: 0, near: false, carded: false };
         const { end } = play(seed, seed % 2 ? fixedFrames(1000 / 60) : randomFrames(seed), (r, input, dt) => {
            const respawned = m.carded && r.card === 0;
            m.carded = r.card > 0;
            if (respawned || r.stage !== m.stage) { m.f = follower(r.panda.x, r.panda.z, r.stage); m.stage = r.stage; m.mode = "go"; m.hide = -1; m.waited = 0; }
            m.think -= dt;
            if (m.mode !== "go") m.waited += dt;
            if (m.think <= 0) {
               // sample-and-hold: what it noticed now drives the next 0.3 s
               m.think = 0.3;
               const path = m.f.path, k = Math.min(path.length - 1, m.f.k + 4);
               const aheadX = path.length ? grid.x(path[k]) : r.panda.x, aheadZ = path.length ? grid.z(path[k]) : r.panda.z;
               const here = watched(r, r.panda.x, r.panda.z), ahead = watched(r, aheadX, aheadZ);
               m.near = STAGE_KEEPERS[r.stage].some((i) => Math.hypot(r.keepers[i].agent.x - r.panda.x, r.keepers[i].agent.z - r.panda.z) < 5);
               if (m.waited > 10) { m.mode = "go"; m.waited = -3; }
               else if (here && m.mode !== "hide") {
                  let best = -1, bd = 4.5;
                  BUSHES.forEach((b, i) => { if (b.stage !== r.stage) return; const d = distanceToBoxXZ(r.panda.x, r.panda.z, b.box); if (d < bd) { bd = d; best = i; } });
                  if (best >= 0) { m.mode = "hide"; m.hide = best; m.waited = 0; }
               } else if (!here && ahead && m.mode === "go" && m.waited >= 0) { m.mode = "wait"; m.waited = 0; }
               else if (!ahead && m.mode !== "go") { m.mode = "go"; m.f = follower(r.panda.x, r.panda.z, r.stage); }
            }
            input.sneak = m.near;
            if (m.mode === "hide") {
               const b = BUSHES[m.hide].box, dx = (b.min.x + b.max.x) / 2 - r.panda.x, dz = (b.min.z + b.max.z) / 2 - r.panda.z, d = Math.hypot(dx, dz);
               input.dirX = d > 0.15 ? dx / d : 0; input.dirZ = d > 0.15 ? dz / d : 0;
            } else if (m.mode === "wait") { input.dirX = 0; input.dirZ = 0; }
            else {
               steer(grid, m.f, r.panda.x, r.panda.z, out);
               input.dirX = out.dirX; input.dirZ = out.dirZ;
            }
         });
         if (end.endReason === "win") wins++;
      }
      console.log(`novice proxy: ${wins}/${N} wins`);
      expect(wins / N).toBeGreaterThanOrEqual(0.5);
   });
});
