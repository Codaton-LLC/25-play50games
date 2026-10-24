import { describe, expect, it } from "vitest";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { alienFarmMeta } from "./meta";
import {
   capScore,
   computeHarvestRelaxationBound,
   computeTargetMarkers,
   CYCLE,
   createHumanBot,
   createRun,
   FARM,
   FARMER,
   GOAL,
   getPlotCycleInfo,
   HARVEST,
   HARVEST_RELAXATION_LIMITS,
   OFFSET_TABLES,
   oracleBotStep,
   PLOTS,
   PROPOSED_LIMITS,
   SCORE,
   SHIP,
   SPORES,
   selectHumPlots,
   stepRun,
   withinServerLimits,
} from "./rules";

function driveStoreRun(
   seed: number,
   coarsePointer: boolean,
   bot: (run: ReturnType<typeof createRun>, frame: number) => { dirX: number; dirZ: number; harvestPressed: boolean },
   frameGen = fixedFrames(1000 / 60),
) {
   const store = createArcadeStore();
   const run = createRun(seed, coarsePointer);
   let frame = 0;
   const finalState = simulateRun(store, {
      resultDelayMs: 1600,
      frame: frameGen,
      step: (dt, _time, st) => {
         const input = bot(run, frame++);
         const ev = stepRun(run, input, dt);
         st.getState().setScore(capScore(PROPOSED_LIMITS, run.score));
         if (ev.ended) {
            st.getState().end(ev.ended);
         }
      },
   });
   return { run, finalState };
}

describe("alien-farm rules", () => {
   it("pins all geometry, timing, cycle, ship, and scoring constants", () => {
      expect(FARM.groundWidth).toBe(26);
      expect(FARM.groundDepth).toBe(22);
      expect(FARM.walkBounds).toEqual({ minX: -10.5, maxX: 10.5, minZ: -8.5, maxZ: 8.5 });
      expect(FARM.clampedBounds).toEqual({ minX: -10.1, maxX: 10.1, minZ: -8.1, maxZ: 8.1 });

      expect(FARMER.startX).toBe(0);
      expect(FARMER.startZ).toBe(6);
      expect(FARMER.radius).toBe(0.4);
      expect(FARMER.carrySpeeds).toEqual([4.5, 4.14, 3.78, 3.42, 3.06]);

      expect(PLOTS).toHaveLength(9);
      expect(PLOTS.map((p) => [p.x, p.z, p.activateAt, p.cycleS, p.kind])).toEqual([
         [-5, -4, 0, 6, "glowPod"],
         [0, -4, 20, 6, "glowPod"],
         [5, -4, 0, 6, "glowPod"],
         [-5, 0, 40, 8, "gourd"],
         [0, 0, 0, 6, "glowPod"],
         [5, 0, 40, 8, "gourd"],
         [-5, 4, 0, 6, "glowPod"],
         [0, 4, 20, 6, "glowPod"],
         [5, 4, 0, 6, "glowPod"],
      ]);

      expect(OFFSET_TABLES).toHaveLength(16);
      expect(OFFSET_TABLES[0]).toEqual([0, 5, 10, 2, 7, 12, 4, 9, 14]);
      expect(OFFSET_TABLES[15]).toEqual([15, 4, 9, 1, 6, 11, 3, 8, 13]);

      expect(CYCLE.windowHalfWidthEarly).toBe(0.9);
      expect(CYCLE.windowHalfWidthMid).toBe(0.75);
      expect(CYCLE.windowHalfWidthLate).toBe(0.6);

      expect(HARVEST.reachRadius).toBe(0.9);
      expect(HARVEST.perfectHalfWidthFine).toBe(0.25);
      expect(HARVEST.perfectHalfWidthCoarse).toBe(0.35);
      expect(HARVEST.channelDurationS).toBe(0.3);
      expect(HARVEST.cooldownDurationS).toBe(0.6);
      expect(HARVEST.maxCarry).toBe(4);

      expect(SHIP.pathLength).toBe(64);
      expect(SHIP.beamRadius).toBe(2.0);
      expect([SHIP.speedEarly, SHIP.speedMid, SHIP.speedLate]).toEqual([2.0, 2.5, 3.0]);

      expect(SPORES).toEqual({ radius: 2.0, durationS: 5.0, speedMultiplier: 0.6 });
      expect(GOAL).toEqual({ deadlineS: 100, targetDelivered: 16, targetSources: 6, targetPerfect: 4 });

      expect(alienFarmMeta.scoring.maxScore).toBe(6000);
      expect(PROPOSED_LIMITS.maxScore).toBe(8000);
      expect(HARVEST_RELAXATION_LIMITS.maxScore).toBe(14800);
   });

   it("is deterministic for a given seed and diverges across seeds", () => {
      const a = createRun(42, false);
      const b = createRun(42, false);
      const c = createRun(99, false);

      for (let i = 0; i < 300; i++) {
         stepRun(a, oracleBotStep(a), 1 / 60);
         stepRun(b, oracleBotStep(b), 1 / 60);
         stepRun(c, oracleBotStep(c), 1 / 60);
      }

      expect(a.farmer).toEqual(b.farmer);
      expect(a.ship).toEqual(b.ship);
      expect(a.score).toBe(b.score);
      expect(a.ship.s0).not.toBe(c.ship.s0);
   });

   it("enforces plot activation times, cycle stages, Decision B cooldown rules, and spore bursts", () => {
      const run = createRun(1, false);
      const p0 = run.plots[4]; // center plot (0, 0), activateAt = 0, cycleS = 6
      const p1 = run.plots[1]; // (0, -4), activateAt = 20
      const p3 = run.plots[3]; // (-5, 0), activateAt = 40

      expect(getPlotCycleInfo(p1, 10).stage).toBe("inactive");
      expect(getPlotCycleInfo(p3, 35).stage).toBe("inactive");

      // Move farmer to center plot (0, 0)
      run.farmer.x = 0;
      run.farmer.z = 0;

      // Press during sprout stage (outside ripe window) -> marks cycle 0 missed and sets 0.60 s cooldown
      run.time = p0.b0 + 0.2;
      const sproutInfo = getPlotCycleInfo(p0, run.time);
      expect(sproutInfo.stage).toBe("sprout");
      const evMiss = stepRun(run, { dirX: 0, dirZ: 0, harvestPressed: true }, 0.01);
      expect(evMiss.missed?.reason).toBe("window");
      expect(p0.missedCycle).toBe(0);
      expect(run.cooldownUntil).toBeCloseTo(p0.b0 + 0.8, 5);

      // Advance to cycle 1 peak on plot 4
      const peak1 = p0.b0 + p0.cycleS + p0.cycleS * 0.5;
      run.time = peak1;
      run.cooldownUntil = 0;
      const ripeInfo = getPlotCycleInfo(p0, run.time);
      expect(ripeInfo.stage).toBe("ripe");
      expect(ripeInfo.k).toBe(1);

      // Decision B: pressing inside the ripe window starts the 0.30 s channel and NEVER sets the 0.60 s cooldown
      stepRun(run, { dirX: 0, dirZ: 0, harvestPressed: true }, 0.05);
      expect(run.channel.active).toBe(true);
      expect(run.channel.perfect).toBe(true);
      expect(run.cooldownUntil).toBe(0);

      // Complete the 0.30 s channel
      stepRun(run, { dirX: 1, dirZ: 0, harvestPressed: false }, 0.3);
      expect(run.channel.active).toBe(false);
      expect(run.harvested).toBe(1);
      expect(run.perfectHarvested).toBe(1);
      expect(run.score).toBe(100);
      expect(run.carried).toHaveLength(1);
      expect(run.cooldownUntil).toBe(0);

      // Let an unharvested plot reach burstAt (0.85 * cycleS) -> spawns a 5 s spore zone that slows farmer by 0.6x
      const p6 = run.plots[6];
      const burstTime = p6.b0 + 2 * p6.cycleS + 0.85 * p6.cycleS;
      run.time = burstTime - 0.02;
      run.farmer.x = p6.x;
      run.farmer.z = p6.z;
      const evBurst = stepRun(run, { dirX: 1, dirZ: 0, harvestPressed: false }, 0.05);
      expect(evBurst.sporeBursts.some((b) => b.plotId === p6.id)).toBe(true);
      expect(p6.sporeEnd).toBeCloseTo(burstTime + 5, 5);
      expect(run.farmer.inSpore).toBe(true);
   });

   it("pays 25 * n^2 on saucer beam delivery, unlocks the 16-crop bonus banner, and ends only on 100 s timeup (Decision A)", () => {
      const run = createRun(7, false);
      // Load 4 items and touch the saucer beam
      run.carried.push(
         { plotId: 0, cycleId: 0, perfect: true, kind: "glowPod" },
         { plotId: 1, cycleId: 0, perfect: true, kind: "glowPod" },
         { plotId: 2, cycleId: 0, perfect: false, kind: "glowPod" },
         { plotId: 3, cycleId: 0, perfect: false, kind: "gourd" },
      );
      run.farmer.x = run.ship.x;
      run.farmer.z = run.ship.z;
      const ev = stepRun(run, { dirX: 0, dirZ: 0, harvestPressed: false }, 1 / 60);
      expect(ev.delivered?.count).toBe(4);
      expect(ev.delivered?.points).toBe(400);
      expect(run.delivered).toBe(4);
      expect(run.sourceCount).toBe(4);
      expect(run.carried).toHaveLength(0);
      expect(run.over).toBe(false);

      // Reach 16 delivered crops -> unlocks bonus banner without ending the run early
      run.delivered = 15;
      run.carried.push({ plotId: 5, cycleId: 1, perfect: true, kind: "gourd" });
      run.farmer.x = run.ship.x;
      run.farmer.z = run.ship.z;
      const ev16 = stepRun(run, { dirX: 0, dirZ: 0, harvestPressed: false }, 1 / 60);
      expect(ev16.delivered?.bonusUnlocked).toBe(true);
      expect(run.shipmentBonusShown).toBe(true);
      expect(run.over).toBe(false);

      // Advance to 100 s -> ends with "timeup"
      run.time = 99.95;
      const evEnd = stepRun(run, { dirX: 0, dirZ: 0, harvestPressed: false }, 0.1);
      expect(evEnd.ended).toBe("timeup");
      expect(run.over).toBe(true);
   });

   it("provides target markers and up to 3 distance-sorted spatial hum specs", () => {
      const run = createRun(3, false);
      run.time = 3.0;
      expect(computeTargetMarkers(run)).toHaveLength(1);
      run.carried.push({ plotId: 0, cycleId: 0, perfect: true, kind: "glowPod" });
      expect(computeTargetMarkers(run)).toHaveLength(2);
      const hums = selectHumPlots(run);
      expect(hums.length).toBeLessThanOrEqual(3);
   });

   it("certifies the exhaustive 16-table harvest relaxation upper bound H* = 71 and rate ceiling <= 124", () => {
      const rateMax = Math.floor((GOAL.deadlineS - HARVEST.channelDurationS) / SCORE.minDistinctPlotGapS);
      expect(rateMax).toBe(SCORE.rateCeilingMaxH);

      const perTable: number[] = [];
      for (let t = 0; t < 16; t++) {
         perTable.push(computeHarvestRelaxationBound(t));
      }
      expect(perTable).toEqual([...SCORE.harvestRelaxationByTable]);
      const maxH = Math.max(...perTable);
      expect(maxH).toBe(SCORE.harvestRelaxationMaxH);
      expect(maxH * SCORE.maxPerHarvestDeliveredInFour).toBe(SCORE.harvestRelaxationScore);
   });

   it("verifies Oracle Bot reaches >= 90% of PROPOSED_LIMITS.maxScore and passes server limits", () => {
      let bestScore = 0;
      for (const [seed, coarse] of [
         [18, false],
         [126, true],
         [1, false],
         [2, true],
      ] as const) {
         const { run, finalState } = driveStoreRun(seed, coarse, (r) => oracleBotStep(r));
         expect(finalState.result).toBe("timeup");
         expect(run.goalMet).toBe(true);
         expect(run.delivered).toBeGreaterThanOrEqual(16);
         expect(run.sourceCount).toBeGreaterThanOrEqual(6);
         expect(run.perfectDelivered).toBeGreaterThanOrEqual(4);
         expect(withinServerLimits(PROPOSED_LIMITS, finalState.score, finalState.elapsedMs)).toBe(true);
         if (run.score > bestScore) bestScore = run.score;
      }
      expect(bestScore).toBeGreaterThanOrEqual(0.9 * PROPOSED_LIMITS.maxScore);
   });

   it("verifies Human-Paced Bot achieves the shipment goal on >= 60% of seeds across fine and coarse pointers", () => {
      for (const coarse of [false, true]) {
         let wins = 0;
         for (let seed = 1; seed <= 8; seed++) {
            const humanBot = createHumanBot();
            const { run } = driveStoreRun(
               seed,
               coarse,
               (r) => humanBot(r),
               randomFrames(seed * 101 + (coarse ? 1 : 0)),
            );
            if (run.goalMet) wins++;
            expect(withinServerLimits(PROPOSED_LIMITS, run.score, 100000)).toBe(true);
         }
         expect(wins / 8).toBeGreaterThanOrEqual(0.6);
      }
   });

   it("verifies all 7 degenerate/spam bots fail the shipment goal and score <= 400 pts", () => {
      const degenerateBots: Record<
         string,
         (run: ReturnType<typeof createRun>, frame: number) => { dirX: number; dirZ: number; harvestPressed: boolean }
      > = {
         idle: () => ({ dirX: 0, dirZ: 0, harvestPressed: false }),
         holdHarvest: () => ({ dirX: 0, dirZ: 0, harvestPressed: true }),
         campOnePlot: (run) => {
            const p = PLOTS[4];
            const dx = p.x - run.farmer.x;
            const dz = p.z - run.farmer.z;
            const d = Math.hypot(dx, dz);
            const info = getPlotCycleInfo(run.plots[4], run.time);
            const press = d <= 0.85 && info.stage === "ripe" && Math.abs(run.time - info.p) <= 0.2;
            return { dirX: d > 0.5 ? dx / d : 0, dirZ: d > 0.5 ? dz / d : 0, harvestPressed: press };
         },
         spinInPlace: (run) => {
            const a = run.time * 6;
            return { dirX: Math.cos(a), dirZ: Math.sin(a), harvestPressed: true };
         },
         arriveAndPress: (run) => {
            let best = run.plots[4];
            let bestD = Infinity;
            for (const p of run.plots) {
               if (run.time < p.activateAt) continue;
               const info = getPlotCycleInfo(p, run.time);
               if (p.harvestedCycle === info.k || p.missedCycle === info.k) continue;
               const d = Math.hypot(p.x - run.farmer.x, p.z - run.farmer.z);
               if (d < bestD) {
                  bestD = d;
                  best = p;
               }
            }
            const dx = best.x - run.farmer.x;
            const dz = best.z - run.farmer.z;
            const d = Math.hypot(dx, dz) || 1;
            return { dirX: d > 0.7 ? dx / d : 0, dirZ: d > 0.7 ? dz / d : 0, harvestPressed: d <= 0.88 };
         },
         metronome: (run, frame) => {
            const p = PLOTS[4];
            const dx = p.x - run.farmer.x;
            const dz = p.z - run.farmer.z;
            const d = Math.hypot(dx, dz) || 1;
            return { dirX: d > 0.7 ? dx / d : 0, dirZ: d > 0.7 ? dz / d : 0, harvestPressed: frame % 36 === 0 };
         },
         orbitSpam: (run) => {
            const a = run.time * 0.9;
            const tx = Math.cos(a) * 5;
            const tz = Math.sin(a) * 4;
            const dx = tx - run.farmer.x;
            const dz = tz - run.farmer.z;
            const d = Math.hypot(dx, dz) || 1;
            return { dirX: dx / d, dirZ: dz / d, harvestPressed: true };
         },
      };

      for (const [name, botFn] of Object.entries(degenerateBots)) {
         for (const seed of [1, 2, 3, 4]) {
            const { run } = driveStoreRun(seed, false, botFn);
            expect(run.goalMet, `${name} seed=${seed} should not meet goal`).toBe(false);
            expect(run.delivered, `${name} seed=${seed} should deliver 0`).toBe(0);
            expect(run.score, `${name} seed=${seed} score <= 400`).toBeLessThanOrEqual(400);
         }
      }
   });
});
