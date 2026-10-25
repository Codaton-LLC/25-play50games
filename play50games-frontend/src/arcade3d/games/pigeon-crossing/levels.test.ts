import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { definitionLevelProblems, levelEnvironment, levelHudStats } from "@/arcade3d/core/levels";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { CLEAR_SCORES, LEVELS } from "./levels";
import { pigeonCrossingMeta as meta } from "./meta";
import definition from "./index";
import { createRun, createStepInput, fillHorizon, firstHit, isLevelGrass, laneFor, NONE, PROPOSED_LEVEL_LIMITS, scoreFor, step, validateLane, type PigeonRun, type StepInput } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

it("declares five levels", () => { expect(meta.levels).toHaveLength(5); });

describe("pigeon-crossing five level declarations", () => {
   it("matches the core template, proposed limits and protected live limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta.levels!.map((l) => l.title)).toEqual(["Quiet Street", "Main Road", "City Crossing", "Night Traffic", "Rush Hour"]);
      expect(meta.scoring).toMatchObject({ maxScore: 50000, minDurationMs: 3000, maxDurationMs: 1800000, base: 0, maxPointsPerSec: 28 });
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(meta.levels![id - 1].clearScore).toBe(CLEAR_SCORES[id]);
         const rows = LEVELS[id].sections * LEVELS[id].grassEvery;
         expect(CLEAR_SCORES[id]).toBe(scoreFor(Math.floor(rows / 20), rows % 20) * LEVELS[id].pointsFactor);
         expect(levelHudStats(definition, id)).toEqual([{ key: "level", label: id === 1 ? "Level" : "Street" }]);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * meta.scoring.maxScore);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(levelEnvironment(definition, 4)!.lighting).toBe("night");
      expect(levelEnvironment(definition, 5)!.lighting).toBe("sunset");
   });

   it("keeps default and explicit level 1 equivalent, including legacy horizon arguments", () => {
      for (const seed of [0, 1, 91, 0xffffffff]) {
         expect(createRun(seed, LEVELS[1])).toEqual(createRun(seed));
         expect(createRun(seed, 28)).toEqual(createRun(seed));
      }
   });

   it("increases pressure and scoring opportunity monotonically", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as 1 | 2 | 3 | 4], b = LEVELS[id];
         expect(b.speedFactor).toBeGreaterThan(a.speedFactor);
         expect(b.tierOffset).toBeGreaterThan(a.tierOffset);
         expect(b.packExtra).toBeGreaterThanOrEqual(a.packExtra);
         expect(b.grassEvery).toBeGreaterThanOrEqual(a.grassEvery);
         expect(b.parkedEdges).toBeGreaterThanOrEqual(a.parkedEdges);
         expect(b.pointsFactor).toBeGreaterThan(a.pointsFactor);
         expect(b.sections).toBeGreaterThan(a.sections);
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
      }
   });

   it("bounds every unclamped theoretical progress prefix for each level", () => {
      for (const id of LEVEL_IDS) {
         const config = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id];
         for (let n = 0; n <= 3267; n++) {
            const raw = scoreFor(Math.floor(n / 20), n % 20) * config.pointsFactor;
            const ms = 3050 + 550 * n;
            if (!withinServerLimits(raw, ms, limits) || capScore(raw, ms, limits) !== raw) throw new Error(`L${id} invalid raw prefix ${n}`);
         }
         expect(scoreFor(163, 7) * config.pointsFactor).toBeLessThan(limits.maxScore);
      }
   });

   it("keeps a shared human reaction window, valid traffic and fixed pools at every tier on 200 seeds", () => {
      for (const id of LEVEL_IDS) for (let seed = 0; seed < 200; seed++) {
         const run = createRun(seed, LEVELS[id]), lanes = [...run.lanes], vehicles = [...run.vehicles];
         for (let stage = 0; stage < 11; stage++) {
            const base = stage * 20;
            // Generator-only placement; solvability below uses real steps without placement.
            run.player.row = base;
            if (!fillHorizon(run, base, base + 27)) throw new Error("Horizon failed");
            for (let row = 0; row < 20; row++) {
               const lane = laneFor(run, base + row)!;
               if (!validateLane(lane)) throw new Error(`Invalid L${id} seed ${seed} stage ${stage} row ${row}`);
               if (!isLevelGrass(row, run.config)) continue;
               let end = row + 1;
               while (end < 20 && !isLevelGrass(end, run.config)) end++;
               const road = laneFor(run, base + row + 1)!;
               const clear = road.clearFromMs ?? 9000;
               const depart = 24000 - road.phaseMs + clear + 350;
               // 350 ms reaction, 50 ms input slack per hop, same on every device.
               for (let r = row; r < end; r++) {
                  const at = depart + (r - row) * 600;
                  if (Number.isFinite(firstHit(run, at, 550, 0, -(base + r) * 1.8, 0, -(base + r + 1) * 1.8, base + r, base + r + 1))) throw new Error(`Blocked L${id} seed ${seed}`);
               }
            }
         }
         for (let i = 0; i < lanes.length; i++) if (run.lanes[i] !== lanes[i]) throw new Error("Lane allocated");
         for (let i = 0; i < vehicles.length; i++) if (run.vehicles[i] !== vehicles[i]) throw new Error("Vehicle allocated");
      }
   }, 15000);

   it("draws parked vans from the existing pool and collides with their full footprint", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(7, LEVELS[id]), row = run.config.grassEvery;
         const parked = run.vehicles.filter((v) => v.active && v.row === row);
         expect(parked).toHaveLength(run.config.parkedEdges);
         if (id !== 1) {
            expect(parked.every((v) => v.kind === 2)).toBe(true);
            expect(firstHit(run, 3050, 550, -3.2, -row * 1.8, -4.8, -row * 1.8, row, row)).toBe(3050);
            expect(firstHit(run, 3050, 550, 0, -row * 1.8, 0, -row * 1.8, row, row)).toBe(Infinity);
         }
      }
   });

   it("uses identical touch and keyboard hop windows on every level", () => {
      for (const id of LEVEL_IDS) {
         const key = createRun(91, LEVELS[id]), tap = createRun(91, LEVELS[id]);
         const a = createStepInput(), b = createStepInput();
         for (let frame = 0; frame < 2400; frame++) {
            a.pressed.up = frame % 11 === 0;
            b.tap = a.pressed.up ? { x: 0.5, y: 0.5 } : null;
            step(key, 50, a); step(tap, 50, b);
         }
         expect(tap).toEqual(key);
      }
   });
});

/** A human-paced predictive bot: 350 ms to read a fresh grass landing, one press per
 * hop, queued only after 350 ms in the air. It inspects the whole route to safe grass. */
function honest(run: PigeonRun, input: StepInput, readAt: number): void {
   input.pressed.up = false;
   if (run.timeMs < 3050 || run.queued !== NONE || (!run.hop.active && run.timeMs < readAt) || (run.hop.active && run.hop.elapsedMs < 350)) return;
   const row = run.hop.active ? run.hop.toRow : run.player.row;
   if (row === (run.completed + 1) * 20 || (run.hop.active && isLevelGrass(row % 20, run.config))) return;
   let end = row + 1;
   if (isLevelGrass(row % 20, run.config)) while (end % 20 !== 0 && !isLevelGrass(end % 20, run.config)) end++;
   const at = run.timeMs + (run.hop.active ? 550 - run.hop.elapsedMs : 0);
   for (let r = row; r < end; r++) if (Number.isFinite(firstHit(run, at + (r - row) * 550, 550, 0, -r * 1.8, 0, -(r + 1) * 1.8, r, r + 1))) return;
   input.pressed.up = true;
}

type Bot = "honest" | "greedy" | "idle" | "spam";
function measure(id: LevelId, seed: number, hz: number, bot: Bot, duration = 240000, stopAtClear = true): PigeonRun {
   const run = createRun(seed, LEVELS[id]), input = createStepInput(), limits = PROPOSED_LEVEL_LIMITS[id];
   const store = createArcadeStore();
   store.getState().configure({ durationMs: run.config.durationMs }); store.getState().markReady(); store.getState().start();
   let readAt = 3400, random = (seed + 1) >>> 0;
   for (let frame = 0; !run.ended && run.timeMs < duration; frame++) {
      advanceRunClock(store, 1 / hz);
      const dt = playedFrameDt(store.getState());
      if (!dt) {
         if (store.getState().phase === "over") { step(run, 50, createStepInput()); break; }
         continue;
      }
      const row = Math.floor(-run.player.z / 1.8 + 1e-9);
      if (!fillHorizon(run, Math.max(0, row - 9), row + 18)) throw new Error("Bot horizon");
      if (bot === "honest") honest(run, input, readAt);
      if (bot === "greedy") input.pressed.up = frame % Math.ceil(hz * 0.1) === 0;
      if (bot === "spam") {
         random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
         const pick = (random >>> 0) % 6;
         input.pressed.up = pick < 3; input.pressed.down = pick === 3;
         input.pressed.left = pick === 4; input.pressed.right = pick === 5;
      }
      const events = step(run, dt * 1000, input);
      if (events.landedRow !== NONE && isLevelGrass(run.player.row % 20, run.config)) readAt = run.timeMs + 350;
      if (events.delta) store.getState().addScore(events.delta);
      const raw = scoreFor(run.completed, run.furthest) * run.config.pointsFactor;
      // Check raw prefixes; a safety clamp must never hide a rate/progress regression.
      if (raw !== run.score || capScore(raw, run.timeMs, limits) !== raw || raw * 1000 > limits.base * 1000 + limits.maxPointsPerSec * run.timeMs || raw > limits.maxScore) throw new Error(`L${id} ${bot} seed${seed} raw prefix bound`);
      if (run.timeMs > store.getState().elapsedMs + 1e-5 || run.score !== store.getState().score) throw new Error(`Store diverged L${id}: rulesMs=${run.timeMs} storeMs=${store.getState().elapsedMs} rulesScore=${run.score} storeScore=${store.getState().score}`);
      if (events.ended) store.getState().end(events.ended);
      if (stopAtClear && run.score >= CLEAR_SCORES[id]) break;
   }
   if (!withinServerLimits(run.score, run.timeMs, limits)) throw new Error(`L${id} ${bot} seed${seed} final limit`);
   return run;
}

describe("pigeon-crossing per-level endless score proofs", () => {
   it.each(LEVEL_IDS)("L%i: 200-seed honest clears and adversarial raw prefixes", (id) => {
         let clears = 0, best = 0, latest = 0;
         for (let seed = 0; seed < 200; seed++) {
            const hz = 20;
            const run = measure(id, seed, hz, "honest");
            if (run.score >= CLEAR_SCORES[id]) clears++;
            best = Math.max(best, run.score); latest = Math.max(latest, run.timeMs);
            for (const bot of ["greedy", "spam", "idle"] as const) {
               const other = measure(id, seed, hz, bot, bot === "idle" ? 4000 : 20000, false);
               if (bot === "idle" && other.score !== 0) throw new Error("Idle cleared");
            }
         }
         console.log(`L${id}: honest clear ${clears}/200; best ${best}; latest clear ${latest} ms`);
         expect(clears).toBeGreaterThanOrEqual(180);
         for (const hz of [30, 60, 144]) {
            const run = measure(id, 7, hz, "honest");
            expect(run.score).toBeGreaterThanOrEqual(CLEAR_SCORES[id]);
            for (const bot of ["greedy", "spam", "idle"] as const) measure(id, 7, hz, bot, bot === "idle" ? 4000 : 20000, false);
         }
   }, 15000);

   it("every higher level offers at least level 1's measured full-duration score", () => {
      const scores = LEVEL_IDS.map((id) => measure(id, 7, 30, "honest", 1800000, false).score);
      console.log(`30-minute honest scores L1-L5: ${scores.join(", ")}`);
      for (const score of scores) expect(score).toBeGreaterThanOrEqual(scores[0]);
   }, 15000);
});
