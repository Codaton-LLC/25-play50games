// The fairness proof of one level's map (test-only, vitest; fairness.level-N.test.ts call it; level 1
// keeps its own fairness.test.ts). The same periodic solver (core/testing/periodic, C5) and margins
// as level 1, on the level's map with its searchlights, jeeps and birds: every stage start and
// gate-entry band cell has a safe sneaking route to the gate at every phase of every seeded offset
// combination; starts and entry bands are out of every cone, light, jeep and bird; every snack
// candidate is risky but reachable; the map data is sane; the solver bot wins every seed through the
// real rules and store with 0 catches, and a novice proxy wins at least `noviceMin` of its runs.
import { describe, expect, it } from "vitest";
import { orMasks, periodicMask, planPeriodic, shiftMask, solvePeriodic, solvePeriodicSteps } from "@/arcade3d/core/testing/periodic";
import { createGrid, findPath, freeGrid, nearestFree, simulateRun, fixedFrames, randomFrames, steer } from "@/arcade3d/core/testing/botHarness";
import { aabbOverlap, distanceToBoxXZ, type AABB } from "@/arcade3d/core/collision";
import { inViewCone, type Agent, type PatrolState } from "@/arcade3d/core/ai";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import type { StageIndex } from "./level";
import { LEVELS } from "./levels";
import {
   BIRDS, KEEPER, PANDA, SNACK, VISION, applyToStore, bushAt, clearSight, createRun, jeepBox, jeepPose, keeperSees, placeOnSchedule, searchlightSees, searchlightYaw, seedLayout, stepRun,
   type JeepState, type RunState, type StepInput,
} from "./rules";
import { appendPlan, combinations, emptyPlan, entryBand, followPlan, jeepMask, keeperMask, lightMask, offsetSteps, phasesOf, stageGrid, stageWatchers, startCells, wallMask, type WorldPlan } from "./testkit";

const STAGE_LIST: StageIndex[] = [0, 1, 2];

export function describeFairness(id: LevelId, opts: { noviceMin: number }): void {
   const level = LEVELS[id];
   const map = level.map;

   const blockedFor = (stage: StageIndex, ks: readonly number[]): Uint8Array => {
      const g = stageGrid(stage, map), P = phasesOf(stage, map);
      const out = orMasks(periodicMask(g.cells, P), wallMask(stage, map));
      const tmp = new Uint8Array(g.cells * P);
      for (const w of stageWatchers(stage, map)) orMasks(out, shiftMask(w.mask, g.cells, P, ks[w.keeperSlot] * offsetSteps(stage, map), tmp));
      // stricter than level 1's proof: a cell entered at phase p must also be clear through phase p - 1,
      // because a moving panda is already partly in it during the step that brings it there
      const dilated = out.slice();
      for (let p = 0; p < P; p++) {
         const prev = ((p - 1 + P) % P) * g.cells;
         for (let c = 0; c < g.cells; c++) dilated[p * g.cells + c] |= out[prev + c];
      }
      return dilated;
   };
   const goalsOf = (stage: StageIndex) => { const g = stageGrid(stage, map); const out: number[] = []; for (let c = 0; c < g.cells; c++) if (g.goal[c]) out.push(c); return out; };
   const jeepAt = (j: number, t: number, pose: JeepState, b: AABB) => jeepBox(map.jeeps[j], jeepPose(map.jeeps[j], map.cycles[map.jeeps[j].stage], t, pose), b);
   const startAndBand = (s: StageIndex) => {
      const out = [{ x: map.stages[s].start.x, y: 0, z: map.stages[s].start.z }];
      if (s > 0) {
         const g = map.stages[s - 1].gate, mid = (g.x0 + g.x1) / 2;
         for (let x = mid - 0.5; x <= mid + 0.5 + 1e-9; x += 0.25) for (let z = g.z - 1.5; z <= g.z + 1e-9; z += 0.25) out.push({ x, y: 0, z });
      }
      return out;
   };

   describe(`level ${id} map data`, () => {
      it("keeps every route inside its stage and its zone, every zone free of solids, at most one bush on a route per stage", () => {
         map.keepers.forEach((k, i) => {
            const b = map.stages[k.stage].bounds;
            for (const q of k.route) {
               expect(q.x > b.x0 && q.x < b.x1 && q.z > b.z0 && q.z < b.z1, `keeper ${i}`).toBe(true);
               expect(q.x >= k.zone.min.x && q.x <= k.zone.max.x && q.z >= k.zone.min.z && q.z <= k.zone.max.z).toBe(true);
            }
            for (const s of map.solids) {
               const apart = s.max.x < k.zone.min.x || s.min.x > k.zone.max.x || s.max.z < k.zone.min.z || s.min.z > k.zone.max.z;
               expect(apart, `keeper ${i} zone vs solid ${JSON.stringify(s.min)}`).toBe(true);
            }
         });
         for (const s of STAGE_LIST) {
            expect(map.stageKeepers[s].length).toBeGreaterThanOrEqual(1);
            expect(map.stageKeepers[s].length).toBeLessThanOrEqual(3);
            const onRoute = map.bushes.filter((b) => b.stage === s && map.stageKeepers[s].some((i) => {
               const pts = map.keepers[i].route;
               for (let j = 0; j < pts.length; j++) {
                  const a = pts[j], c = pts[(j + 1) % pts.length];
                  for (let t = 0; t <= 1; t += 0.01) if (distanceToBoxXZ(a.x + (c.x - a.x) * t, a.z + (c.z - a.z) * t, b.box) <= KEEPER.radius) return true;
               }
               return false;
            }));
            expect(onRoute.length).toBeLessThanOrEqual(1);
            // every keeper's cycle is the stage's, in whole 1.5 s (offset steps are whole 0.25 s phases)
            expect((map.cycles[s] / 1.5) % 1).toBe(0);
         }
         // a searchlight sweeps a whole number of times per stage cycle (its mask repeats with the cycle)
         map.lights.forEach((l, s) => { if (l) expect((map.cycles[s] / l.period) % 1, `stage ${s + 1} light period`).toBe(0); });
         // the keeper slots draw two cone lengths at most
         expect(new Set(map.vision).size).toBeLessThanOrEqual(2);
         // the clamp box and the three stage boxes are level 1's (camera windows, surroundings)
         expect(map.stages.map((s) => s.bounds)).toEqual(LEVELS[1].map.stages.map((s) => s.bounds));
      });

      it("drives every jeep on an axis-aligned loop inside its stage, clear of every solid and bush and of its stage's start", () => {
         const pose: JeepState = { x: 0, z: 0, yaw: 0 };
         const b: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
         map.jeeps.forEach((j, i) => {
            for (let k = 0; k < j.route.length; k++) {
               const a = j.route[k], c = j.route[(k + 1) % j.route.length];
               expect(a.x === c.x || a.z === c.z, `jeep ${i} leg ${k}`).toBe(true);
            }
            const st = map.stages[j.stage].bounds;
            for (let t = 0; t < map.cycles[j.stage]; t += 0.05) {
               jeepAt(i, t, pose, b);
               expect(b.min.x >= st.x0 && b.max.x <= st.x1 && b.min.z >= st.z0 && b.max.z <= st.z1, `jeep ${i} at ${t}`).toBe(true);
               for (const s of map.solids) expect(aabbOverlap(b, { min: { ...s.min, y: 0 }, max: { ...s.max, y: 1.8 } }), `jeep ${i} at ${t} vs solid ${JSON.stringify(s.min)}`).toBe(false);
               for (const bu of map.bushes) expect(aabbOverlap(b, { min: { ...bu.box.min, y: 0 }, max: { ...bu.box.max, y: 1.8 } }), `jeep ${i} vs bush`).toBe(false);
               for (const q of startAndBand(j.stage)) expect(distanceToBoxXZ(q.x, q.z, b) - PANDA.radius, `jeep ${i} near the start`).toBeGreaterThan(0.75);
            }
         });
      });

      it("puts the respawn points and the entry bands outside every cone, light, jeep and bird, out of earshot, at every moment", () => {
         const agent: Agent = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 };
         const patrol: PatrolState = { index: 1, wait: 0, mode: "patrol", target: { x: 0, y: 0, z: 0 } };
         for (const s of STAGE_LIST) {
            const [start, ...band] = startAndBand(s);
            for (const i of map.stageKeepers[s]) {
               for (let t = 0; t < map.cycles[s]; t += 0.05) {
                  placeOnSchedule(agent, patrol, i, t, map);
                  expect(keeperSees(agent, agent.yaw, s, start, map), `stage ${s + 1} start, keeper ${i}, t ${t}`).toBe(false);
                  expect(Math.hypot(agent.x - start.x, agent.z - start.z)).toBeGreaterThanOrEqual(4);
                  for (const q of band) {
                     expect(keeperSees(agent, agent.yaw, s, q, map), `band ${q.x},${q.z} keeper ${i} t ${t}`).toBe(false);
                     expect(Math.hypot(agent.x - q.x, agent.z - q.z)).toBeGreaterThanOrEqual(3.75);
                  }
               }
            }
            const light = map.lights[s];
            if (light) for (let t = 0; t < light.period; t += 0.02) for (const q of [start, ...band]) expect(searchlightSees(searchlightYaw(t, 0, light), q, light, map)).toBe(false);
            for (const bird of map.birds) if (bird.stage === s) for (const q of [start, ...band]) expect(Math.hypot(bird.x - q.x, bird.z - q.z)).toBeGreaterThan(BIRDS.range + 0.5);
         }
      });
   });

   describe(`level ${id}: safe routes at every phase (periodic solver)`, () => {
      it("every stage start and entry-band cell is winning at every phase of every offset combination; every snack is reachable", () => {
         for (const s of STAGE_LIST) {
            const g = stageGrid(s, map), P = phasesOf(s, map);
            const must = [...startCells(s, map), ...entryBand(s, map)];
            expect(must.length).toBeGreaterThan(0);
            const snackCells = map.snacks[s].map((c) => g.cellOf(c.x, c.z));
            const goal = goalsOf(s);
            let checked = 0;
            for (const ks of combinations(s, map)) {
               const win = solvePeriodic({ grid: { width: g.width, height: g.height }, period: P, blocked: blockedFor(s, ks), goal });
               for (const c of must) for (let p = 0; p < P; p++) expect(win[p * g.cells + c], `stage ${s + 1} cell ${c} phase ${p} ks ${ks}`).toBe(1);
               for (const c of snackCells) {
                  let any = false;
                  for (let p = 0; p < P && !any; p++) any = win[p * g.cells + c] === 1;
                  expect(any, `stage ${s + 1} snack cell ${c} ks ${ks}`).toBe(true);
               }
               checked++;
            }
            expect(checked).toBe(KEEPER.offsets ** map.stageKeepers[s].length);
         }
      });

      it("makes every snack candidate risky: some watcher (keeper, searchlight or jeep) covers it 15-60 % of the cycle", () => {
         for (const s of STAGE_LIST) {
            const g = stageGrid(s, map), P = phasesOf(s, map);
            const masks = map.stageKeepers[s].map((i) => keeperMask(i, 0, map));
            if (map.lights[s]) masks.push(lightMask(s, map));
            map.jeeps.forEach((j, i) => { if (j.stage === s) masks.push(jeepMask(i, map)); });
            for (const c of map.snacks[s]) {
               const cell = g.cellOf(c.x, c.z);
               expect(g.wall[cell], `stage ${s + 1} snack ${c.x},${c.z} in a solid`).toBe(0);
               expect(g.hidden[cell], `stage ${s + 1} snack ${c.x},${c.z} in a bush`).toBe(-1);
               const share = Math.max(...masks.map((m) => { let f = 0; for (let p = 0; p < P; p++) f += m[p * g.cells + cell]; return f / P; }));
               expect(share, `stage ${s + 1} snack ${c.x},${c.z}`).toBeGreaterThanOrEqual(0.15);
               expect(share).toBeLessThanOrEqual(0.6);
            }
         }
      });

      it("seeds 300 layouts: whole offset steps, 4 snacks per stage >= 3 m apart", () => {
         for (let seed = 1; seed <= 300; seed++) {
            const L = seedLayout(seed, map);
            expect(L.offsets.length).toBe(map.keepers.length);
            for (const k of L.offsets) expect(Number.isInteger(k) && k >= 0 && k < KEEPER.offsets).toBe(true);
            L.snacks.forEach((picks, s) => {
               expect(picks.length, `seed ${seed} stage ${s + 1}`).toBe(SNACK.perStage);
               for (const a of picks) for (const b of picks) if (a < b) expect(Math.hypot(map.snacks[s][a].x - map.snacks[s][b].x, map.snacks[s][a].z - map.snacks[s][b].z)).toBeGreaterThanOrEqual(SNACK.minGap);
            });
         }
      });
   });

   // ---------- bots through the real rules and store ----------

   function play(seed: number, frame: () => number, brain: (run: RunState, input: StepInput, dt: number) => void) {
      const run = createRun(seed, undefined, level);
      const input: StepInput = { dirX: 0, dirZ: 0, sneak: false, toss: false };
      const shown = { time: -1, bamboo: -1 };
      const end = simulateRun(createArcadeStore(), { frame, step: (dt, _t, store) => { brain(run, input, dt); stepRun(run, input, dt); applyToStore(run, store.getState(), shown); } });
      return { end, run };
   }

   function solverPlan(seed: number): WorldPlan {
      const L = seedLayout(seed, map);
      const plan = emptyPlan(0);
      let x = map.stages[0].start.x, z = map.stages[0].start.z, t = 0;
      for (const s of STAGE_LIST) {
         const g = stageGrid(s, map), P = phasesOf(s, map);
         // the last two stages' goals: the next stage's entry band past the gate (proven winning there)
         const next = s < 2 ? ((s + 1) as StageIndex) : s;
         const band = new Set(entryBand(next, map));
         const ng = stageGrid(next, map);
         const goal = s < 2 ? goalsOf(s).filter((c) => band.has(ng.cellOf(g.cx(c), g.cz(c)))) : goalsOf(s);
         const problem = { grid: { width: g.width, height: g.height }, period: P, blocked: blockedFor(s, map.stageKeepers[s].map((i) => L.offsets[i])), goal };
         const start = g.cellOf(x, z);
         const moves = planPeriodic(problem, start, Math.round((t % map.cycles[s]) / 0.25), solvePeriodicSteps(problem));
         if (!moves) {
            const must = new Set([...startCells(s, map), ...entryBand(s, map)]);
            const win = solvePeriodic(problem);
            const ph = Math.round((t % map.cycles[s]) / 0.25);
            console.log(`no plan: seed ${seed} stage ${s + 1} at ${x.toFixed(2)},${z.toFixed(2)} cell ${start} (${g.cx(start).toFixed(2)},${g.cz(start).toFixed(2)}) must ${must.has(start)} wall ${g.wall[start]} phase ${ph} win ${win[ph * g.cells + start]} t ${t}`);
         }
         expect(moves, `seed ${seed} stage ${s + 1}`).not.toBeNull();
         const cells = [start];
         for (const [dx, dy] of moves!) cells.push(cells[cells.length - 1] + dy * g.width + dx);
         appendPlan(plan, s, { cells, walk: cells.slice(1).map(() => false) }, map);
         t += moves!.length * 0.25;
         const last = cells[cells.length - 1];
         x = g.cx(last); z = g.cz(last);
      }
      plan.x.push(x, x); plan.z.push(z - 0.8, z - 1.6); plan.walk.push(false, false);
      return plan;
   }

   describe(`level ${id}: bots`, () => {
      it("the solver bot replays the safe routes through the real rules: it wins every seed with 0 catches", () => {
         for (let seed = 1; seed <= 16; seed++) {
            const plan = solverPlan(seed);
            const frame = seed % 3 === 0 ? fixedFrames(1000 / 30) : seed % 3 === 1 ? fixedFrames(1000 / 60) : randomFrames(seed, 0.008, 0.03);
            const caught: string[] = [];
            const prev = { x: 0, z: 0, kx: 0, kz: 0 };
            const { end, run } = play(seed, frame, (r, input, dt) => {
               if (r.events.caught) caught.push(`${r.events.caught} by ${r.events.catcher} @${r.stage + 1} t ${r.time.toFixed(2)} at ${prev.x.toFixed(2)},${prev.z.toFixed(2)} keeper at ${prev.kx.toFixed(2)},${prev.kz.toFixed(2)}`);
               const kc = r.events.catcher >= 0 ? r.keepers[r.events.catcher].agent : r.keepers[1].agent;
               prev.x = r.panda.x; prev.z = r.panda.z; prev.kx = kc.x; prev.kz = kc.z;
               r.keepers.forEach((k, i) => { if (k.kind && !(prev as Record<string, unknown>)['k' + i]) caught.push(`k${i} ${k.kind} t ${r.time.toFixed(2)} panda ${r.panda.x.toFixed(2)},${r.panda.z.toFixed(2)} sneak ${r.panda.sneaking} speed ${r.panda.speed.toFixed(2)} light ${r.light.meter.toFixed(2)}`); (prev as Record<string, unknown>)['k' + i] = k.kind; });
               followPlan(plan, r.panda.x, r.panda.z, r.time + dt, input);
            });
            if (caught.length) console.log(`level ${id} solver seed ${seed} caught: ${caught.join("; ")}`);
            expect(end.endReason, `seed ${seed}`).toBe("win");
            expect(run.catches, `seed ${seed}`).toBe(0);
         }
      }, 240_000);

      it(`a novice proxy (cautious, no plan) wins at least ${Math.round(opts.noviceMin * 100)} % of its runs`, () => {
         const grid = createGrid({ cell: 0.4, halfX: 10, halfZ: 44 });
         const free = freeGrid(grid, (x, z) => z <= 18 && map.solids.every((b) => Math.max(b.min.x - x, 0, x - b.max.x) ** 2 + Math.max(b.min.z - z, 0, z - b.max.z) ** 2 > (PANDA.radius + 0.15) ** 2));
         const goals = map.stages.map((s) => ({ x: (s.gate.x0 + s.gate.x1) / 2, z: s.gate.z - 1.6 }));
         const follower = (x: number, z: number, s: StageIndex) => ({ goalX: goals[s].x, goalZ: goals[s].z, path: findPath(grid, free, nearestFree(grid, free, x, z), nearestFree(grid, free, goals[s].x, goals[s].z)), k: 0 });
         const out = { dirX: 0, dirZ: 0 };
         const pt = { x: 0, y: 0, z: 0 };
         const eye = { x: 0, y: 0, z: 0 };
         const jb: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
         /** Would a keeper, the searchlight or a jeep of the stage get the point now? (a human's rough read of the drawn cones and the jeep) */
         const watched = (r: RunState, x: number, z: number) => {
            pt.x = x; pt.z = z;
            for (let j = 0; j < map.jeeps.length; j++) if (map.jeeps[j].stage === r.stage && distanceToBoxXZ(x, z, jeepBox(map.jeeps[j], r.jeeps[j], jb)) < 2.5) return true;
            if (bushAt(x, z, map) >= 0) return false;
            for (const i of map.stageKeepers[r.stage]) {
               const a = r.keepers[i].agent;
               if (Math.hypot(a.x - x, a.z - z) < 2.4) return true;
               if (inViewCone(a, a.yaw, VISION.halfAngle + 0.2, map.vision[r.stage] + 1.5, pt) && clearSight(a, pt, map.blockers)) return true;
            }
            const light = map.lights[r.stage];
            if (!light) return false;
            eye.x = light.x; eye.z = light.z;
            return inViewCone(eye, r.light.yaw, light.halfAngle + 0.25, light.range + 1, pt) && clearSight(eye, pt, map.blockers);
         };
         let wins = 0;
         const N = 30;
         const reasons: string[] = [];
         const ends: string[] = [];
         for (let seed = 101; seed < 101 + N; seed++) {
            const m = { f: follower(map.stages[0].start.x, map.stages[0].start.z, 0), stage: 0, think: 0, mode: "go" as "go" | "wait" | "hide", hide: -1, waited: 0, near: false, carded: false };
            const { end, run: last } = play(seed, seed % 2 ? fixedFrames(1000 / 60) : randomFrames(seed), (r, input, dt) => {
               if (r.events.caught) reasons.push(`${r.events.caught}@${r.stage + 1}`);
               const respawned = m.carded && r.card === 0;
               m.carded = r.card > 0;
               if (respawned || r.stage !== m.stage) { m.f = follower(r.panda.x, r.panda.z, r.stage); m.stage = r.stage; m.mode = "go"; m.hide = -1; m.waited = 0; }
               m.think -= dt;
               if (m.mode !== "go") m.waited += dt;
               if (m.think <= 0) {
                  m.think = 0.3;
                  const path = m.f.path, k = Math.min(path.length - 1, m.f.k + 4);
                  const aheadX = path.length ? grid.x(path[k]) : r.panda.x, aheadZ = path.length ? grid.z(path[k]) : r.panda.z;
                  const here = watched(r, r.panda.x, r.panda.z), ahead = watched(r, aheadX, aheadZ);
                  // a cautious player sneaks near keepers and birds
                  m.near = map.stageKeepers[r.stage].some((i) => Math.hypot(r.keepers[i].agent.x - r.panda.x, r.keepers[i].agent.z - r.panda.z) < 5)
                     || map.birds.some((b) => b.stage === r.stage && Math.hypot(b.x - r.panda.x, b.z - r.panda.z) < BIRDS.range + 1.2);
                  if (m.waited > 10) { m.mode = "go"; m.waited = -3; }
                  else if (here && m.mode !== "hide") {
                     let best = -1, bd = 4.5;
                     map.bushes.forEach((b, i) => { if (b.stage !== r.stage) return; const d = distanceToBoxXZ(r.panda.x, r.panda.z, b.box); if (d < bd) { bd = d; best = i; } });
                     if (best >= 0) { m.mode = "hide"; m.hide = best; m.waited = 0; }
                  } else if (!here && ahead && m.mode === "go" && m.waited >= 0) { m.mode = "wait"; m.waited = 0; }
                  else if (!ahead && m.mode !== "go") { m.mode = "go"; m.f = follower(r.panda.x, r.panda.z, r.stage); }
               }
               input.sneak = m.near;
               if (m.mode === "hide") {
                  const b = map.bushes[m.hide].box, dx = (b.min.x + b.max.x) / 2 - r.panda.x, dz = (b.min.z + b.max.z) / 2 - r.panda.z, d = Math.hypot(dx, dz);
                  input.dirX = d > 0.15 ? dx / d : 0; input.dirZ = d > 0.15 ? dz / d : 0;
               } else if (m.mode === "wait") { input.dirX = 0; input.dirZ = 0; }
               else {
                  steer(grid, m.f, r.panda.x, r.panda.z, out);
                  input.dirX = out.dirX; input.dirZ = out.dirZ;
               }
            });
            if (end.endReason === "win") wins++;
            else ends.push(`${end.endReason}@${last.stage + 1}`);
         }
         const hist = (a: string[]) => Object.entries(a.reduce<Record<string, number>>((h, k) => ((h[k] = (h[k] ?? 0) + 1), h), {})).map(([k, v]) => `${k}:${v}`).join(" ");
         console.log(`level ${id} novice proxy: ${wins}/${N} wins; ends ${hist(ends)}; catches ${hist(reasons)}`);
         expect(wins / N).toBeGreaterThanOrEqual(opts.noviceMin);
      }, 240_000);
   });
}
