import { circlesOverlapXZ, clampToBounds } from "@/arcade3d/core/collision";
import { substep } from "@/arcade3d/core/kinematics";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng, rngNext, turnTowards } from "@/arcade3d/core/math";
import { advance, createPath, pointAt, tangentAt } from "@/arcade3d/core/path";
import type { ArcadeScoring } from "@/arcade3d/types";

export { capScore, rngNext, withinServerLimits };

export type CropKind = "glowPod" | "gourd";

export type PlotStage =
   | "inactive"
   | "waiting"
   | "sprout"
   | "growing"
   | "ripe"
   | "overripe"
   | "spent";

export const FARM = {
   groundWidth: 26,
   groundDepth: 22,
   walkBounds: { minX: -10.5, maxX: 10.5, minZ: -8.5, maxZ: 8.5 },
   clampedBounds: { minX: -10.1, maxX: 10.1, minZ: -8.1, maxZ: 8.1 },
   bedRadius: 1.0,
   bedHeight: 0.16,
   bedTopY: 0.08,
   horizonRadius: 48,
} as const;

export const FARMER = {
   startX: 0,
   startZ: 6,
   startYaw: Math.PI,
   radius: 0.4,
   height: 1.3,
   baseSpeed: 4.5,
   carrySpeedDropPerItem: 0.08,
   carrySpeeds: [4.5, 4.14, 3.78, 3.42, 3.06] as const,
   accel: 24,
   decel: 30,
   turnRate: 12,
   maxSubstepDt: 1 / 120,
} as const;

export interface PlotConfig {
   readonly id: number;
   readonly row: number;
   readonly col: number;
   readonly x: number;
   readonly z: number;
   readonly activateAt: number;
   readonly cycleS: number;
   readonly kind: CropKind;
}

export const PLOTS: readonly PlotConfig[] = [
   { id: 0, row: 0, col: 0, x: -5, z: -4, activateAt: 0, cycleS: 6, kind: "glowPod" },
   { id: 1, row: 0, col: 1, x: 0, z: -4, activateAt: 20, cycleS: 6, kind: "glowPod" },
   { id: 2, row: 0, col: 2, x: 5, z: -4, activateAt: 0, cycleS: 6, kind: "glowPod" },
   { id: 3, row: 1, col: 0, x: -5, z: 0, activateAt: 40, cycleS: 8, kind: "gourd" },
   { id: 4, row: 1, col: 1, x: 0, z: 0, activateAt: 0, cycleS: 6, kind: "glowPod" },
   { id: 5, row: 1, col: 2, x: 5, z: 0, activateAt: 40, cycleS: 8, kind: "gourd" },
   { id: 6, row: 2, col: 0, x: -5, z: 4, activateAt: 0, cycleS: 6, kind: "glowPod" },
   { id: 7, row: 2, col: 1, x: 0, z: 4, activateAt: 20, cycleS: 6, kind: "glowPod" },
   { id: 8, row: 2, col: 2, x: 5, z: 4, activateAt: 0, cycleS: 6, kind: "glowPod" },
] as const;

export const OFFSET_TABLES: readonly (readonly number[])[] = Array.from(
   { length: 16 },
   (_, t) =>
      Array.from(
         { length: 9 },
         (__, i) => (t + 5 * i + 3 * Math.floor(i / 3)) % 16,
      ),
);

export const CYCLE = {
   offsetTickS: 0.125,
   sproutStartFrac: 0,
   growingStartFrac: 0.2,
   peakFrac: 0.5,
   burstFrac: 0.85,
   windowHalfWidthEarly: 0.9,
   windowHalfWidthMid: 0.75,
   windowHalfWidthLate: 0.6,
   phaseMidAtS: 40,
   phaseLateAtS: 70,
} as const;

export const HARVEST = {
   reachRadius: 0.9,
   perfectHalfWidthFine: 0.25,
   perfectHalfWidthCoarse: 0.35,
   channelDurationS: 0.3,
   cooldownDurationS: 0.6,
   maxCarry: 4,
} as const;

export const SHIP = {
   waypoints: [
      { x: -9, y: 0, z: -7 },
      { x: 9, y: 0, z: -7 },
      { x: 9, y: 0, z: 7 },
      { x: -9, y: 0, z: 7 },
   ] as const,
   pathLength: 64,
   hoverY: 3.2,
   beamRadius: 2.0,
   speedEarly: 2.0,
   speedMid: 2.5,
   speedLate: 3.0,
} as const;

export const SHIP_PATH = createPath(SHIP.waypoints, true);

export const SPORES = {
   radius: 2.0,
   durationS: 5.0,
   speedMultiplier: 0.6,
} as const;

export const GOAL = {
   deadlineS: 100,
   targetDelivered: 16,
   targetSources: 6,
   targetPerfect: 4,
} as const;

export const SCORE = {
   normalHarvestPts: 50,
   perfectHarvestPts: 100,
   deliveryBasePts: 25,
   maxPerHarvestDeliveredInFour: 200,
   minDistinctPlotTravelM: 2.2,
   minDistinctPlotGapS: 71 / 90,
   rateCeilingMaxH: 124,
   harvestRelaxationByTable: [
      67, 66, 68, 68, 69, 69, 70, 68, 68, 71, 71, 62, 64, 64, 66, 66,
   ] as const,
   harvestRelaxationMaxH: 71,
   harvestRelaxationScore: 14200,
   harvestRelaxationRoundedScore: 14800,
} as const;

/**
 * Proposed server limits for alien-farm (`arcade-score-limits` + Decision D):
 * - Exhaustive 16-table harvest relaxation certificate: H* = 71 (200 * H* = 14200, 4% rounded 14800).
 * - Delivery-constrained legal play (4-crop inventory cap, carry speeds [4.5..3.06] m/s, saucer beam loop):
 *   best legal Oracle Bot reaches 7300 pts (91.25% of 8000).
 */
export const PROPOSED_LIMITS: ArcadeScoring = {
   kind: "points",
   maxScore: 8000,
   minDurationMs: 25000,
   maxDurationMs: 102000,
   base: 8000,
   maxPointsPerSec: 320,
   unitLabel: "pts",
   display: "int",
};

export const HARVEST_RELAXATION_LIMITS: ArcadeScoring = {
   kind: "points",
   maxScore: 14800,
   minDurationMs: 25000,
   maxDurationMs: 102000,
   base: 14800,
   maxPointsPerSec: 592,
   unitLabel: "pts",
   display: "int",
};

export interface PlotState extends PlotConfig {
   delta: number;
   b0: number;
   harvestedCycle: number;
   missedCycle: number;
   burstCycle: number;
   sporeStart: number;
   sporeEnd: number;
}

export interface CarriedCrop {
   plotId: number;
   cycleId: number;
   perfect: boolean;
   kind: CropKind;
}

export interface HarvestChannelState {
   active: boolean;
   plotId: number;
   cycleIndex: number;
   perfect: boolean;
   startedAt: number;
   endsAt: number;
   distToPlot: number;
}

export interface FarmerState {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   yaw: number;
   speed: number;
   inSpore: boolean;
}

export interface ShipState {
   s0: number;
   s: number;
   direction: 1 | -1;
   x: number;
   z: number;
   yaw: number;
   speed: number;
}

export interface AlienFarmRun {
   seed: number;
   coarsePointer: boolean;
   tableIndex: number;
   time: number;
   over: boolean;
   farmer: FarmerState;
   ship: ShipState;
   plots: PlotState[];
   carried: CarriedCrop[];
   channel: HarvestChannelState;
   cooldownUntil: number;
   harvested: number;
   perfectHarvested: number;
   delivered: number;
   perfectDelivered: number;
   sourceMask: number;
   sourceCount: number;
   loadsSumSq: number;
   score: number;
   streak: number;
   maxStreak: number;
   goalMet: boolean;
   goalTime: number | null;
   shipmentBonusShown: boolean;
   lastDeliveryAt: number;
}

export interface AlienFarmInput {
   dirX: number;
   dirZ: number;
   harvestPressed: boolean;
}

export interface PlotCycleInfo {
   stage: PlotStage;
   k: number;
   b: number;
   p: number;
   w: number;
   growAt: number;
   ripeOpen: number;
   ripeClose: number;
   burstAt: number;
   nextB: number;
   growthScale: number;
   pulse: number;
   countdownS: number;
}

export interface AlienFarmStepEvents {
   harvested: null | {
      plotId: number;
      x: number;
      z: number;
      perfect: boolean;
      points: number;
      streak: number;
   };
   missed: null | {
      plotId: number;
      x: number;
      z: number;
      reason: "cooldown" | "window" | "empty";
   };
   delivered: null | {
      count: number;
      points: number;
      x: number;
      z: number;
      bonusUnlocked: boolean;
   };
   sporeBursts: Array<{ plotId: number; x: number; z: number }>;
   enteredSpore: boolean;
   ended: null | "timeup";
}

export interface TargetMarkerSpec {
   id: string;
   x: number;
   z: number;
   color: string;
   label: string;
}

export interface PlotHumSpec {
   plotId: number;
   gain: number;
   pitchHz: number;
}

const EPS = 1e-12;

export function windowHalfWidthForPeak(peakTime: number): number {
   if (peakTime < CYCLE.phaseMidAtS) return CYCLE.windowHalfWidthEarly;
   if (peakTime < CYCLE.phaseLateAtS) return CYCLE.windowHalfWidthMid;
   return CYCLE.windowHalfWidthLate;
}

export function shipSpeedAtTime(t: number): number {
   if (t < CYCLE.phaseMidAtS) return SHIP.speedEarly;
   if (t < CYCLE.phaseLateAtS) return SHIP.speedMid;
   return SHIP.speedLate;
}

export function shipPointAtS(s: number): { x: number; z: number } {
   const pt = pointAt(SHIP_PATH, s);
   return { x: pt.x, z: pt.z };
}

export function getPlotCycleInfo(plot: PlotState, t: number): PlotCycleInfo {
   const firstP = plot.b0 + plot.cycleS * CYCLE.peakFrac;
   const firstW = windowHalfWidthForPeak(firstP);
   const firstGrow = plot.b0 + plot.cycleS * CYCLE.growingStartFrac;
   const firstBurst = plot.b0 + plot.cycleS * CYCLE.burstFrac;

   if (t < plot.activateAt - EPS) {
      return {
         stage: "inactive",
         k: -1,
         b: plot.b0,
         p: firstP,
         w: firstW,
         growAt: firstGrow,
         ripeOpen: firstP - firstW,
         ripeClose: firstP + firstW,
         burstAt: firstBurst,
         nextB: plot.b0,
         growthScale: 0.25,
         pulse: 0,
         countdownS: Math.max(0, plot.activateAt - t),
      };
   }
   if (t < plot.b0 - EPS) {
      return {
         stage: "waiting",
         k: -1,
         b: plot.b0,
         p: firstP,
         w: firstW,
         growAt: firstGrow,
         ripeOpen: firstP - firstW,
         ripeClose: firstP + firstW,
         burstAt: firstBurst,
         nextB: plot.b0,
         growthScale: 0.35,
         pulse: 0.08,
         countdownS: Math.max(0, plot.b0 - t),
      };
   }

   const k = Math.floor((t - plot.b0 + EPS) / plot.cycleS);
   const b = plot.b0 + k * plot.cycleS;
   const p = b + plot.cycleS * CYCLE.peakFrac;
   const w = windowHalfWidthForPeak(p);
   const growAt = b + plot.cycleS * CYCLE.growingStartFrac;
   const ripeOpen = p - w;
   const ripeClose = p + w;
   const burstAt = b + plot.cycleS * CYCLE.burstFrac;
   const nextB = b + plot.cycleS;

   let stage: PlotStage = "spent";
   if (plot.harvestedCycle === k) {
      stage = "spent";
   } else if (t < growAt - EPS) {
      stage = "sprout";
   } else if (t < ripeOpen - EPS) {
      stage = "growing";
   } else if (t <= ripeClose + EPS) {
      stage = "ripe";
   } else if (t < burstAt - EPS) {
      stage = "overripe";
   } else {
      stage = "spent";
   }

   let growthScale = 0.35;
   let pulse = 0;
   if (stage === "sprout") {
      const u = Math.max(0, Math.min(1, (t - b) / Math.max(1e-6, growAt - b)));
      growthScale = 0.45 + 0.15 * u;
      pulse = 0.15 * u;
   } else if (stage === "growing") {
      const u = Math.max(0, Math.min(1, (t - growAt) / Math.max(1e-6, ripeOpen - growAt)));
      growthScale = 0.6 + 0.25 * u;
      pulse = 0.15 + 0.45 * u;
   } else if (stage === "ripe") {
      const distFromPeak = Math.abs(t - p);
      const closeness = Math.max(0, 1 - distFromPeak / Math.max(1e-6, w));
      growthScale = 0.88 + 0.12 * closeness;
      pulse = 0.6 + 0.4 * closeness;
   } else if (stage === "overripe") {
      const u = Math.max(0, Math.min(1, (t - ripeClose) / Math.max(1e-6, burstAt - ripeClose)));
      growthScale = 0.92 - 0.18 * u;
      pulse = 0.35 * (1 - u);
   }

   return {
      stage,
      k,
      b,
      p,
      w,
      growAt,
      ripeOpen,
      ripeClose,
      burstAt,
      nextB,
      growthScale,
      pulse,
      countdownS: 0,
   };
}

export function createRun(seed: number, coarsePointer = false): AlienFarmRun {
   const rng = createRng(seed);
   const tableIndex = Math.floor(16 * rng());
   const direction: 1 | -1 = rng() < 0.5 ? 1 : -1;
   const s0 = SHIP.pathLength * rng();
   const pt = pointAt(SHIP_PATH, s0);
   const tan = tangentAt(SHIP_PATH, s0);
   const yaw = Math.atan2(tan.x * direction, tan.z * direction);

   const plots: PlotState[] = PLOTS.map((p, i) => {
      const delta = OFFSET_TABLES[tableIndex][i] * CYCLE.offsetTickS;
      return {
         ...p,
         delta,
         b0: p.activateAt + delta,
         harvestedCycle: -1,
         missedCycle: -1,
         burstCycle: -1,
         sporeStart: -1,
         sporeEnd: -1,
      };
   });

   return {
      seed,
      coarsePointer,
      tableIndex,
      time: 0,
      over: false,
      farmer: {
         x: FARMER.startX,
         y: 0,
         z: FARMER.startZ,
         vx: 0,
         vz: 0,
         yaw: FARMER.startYaw,
         speed: 0,
         inSpore: false,
      },
      ship: {
         s0,
         s: s0,
         direction,
         x: pt.x,
         z: pt.z,
         yaw,
         speed: SHIP.speedEarly,
      },
      plots,
      carried: [],
      channel: {
         active: false,
         plotId: -1,
         cycleIndex: -1,
         perfect: false,
         startedAt: 0,
         endsAt: 0,
         distToPlot: 0.65,
      },
      cooldownUntil: 0,
      harvested: 0,
      perfectHarvested: 0,
      delivered: 0,
      perfectDelivered: 0,
      sourceMask: 0,
      sourceCount: 0,
      loadsSumSq: 0,
      score: 0,
      streak: 0,
      maxStreak: 0,
      goalMet: false,
      goalTime: null,
      shipmentBonusShown: false,
      lastDeliveryAt: -10,
   };
}

function updateTransitions(run: AlienFarmRun, events: AlienFarmStepEvents): void {
   const t = run.time;
   for (let i = 0; i < 9; i++) {
      const plot = run.plots[i];
      if (plot.sporeEnd > 0 && t >= plot.sporeEnd - EPS) {
         plot.sporeStart = -1;
         plot.sporeEnd = -1;
      }
      if (t < plot.b0 - EPS) continue;
      const k = Math.floor((t - plot.b0 + EPS) / plot.cycleS);
      const b = plot.b0 + k * plot.cycleS;
      const burstAt = b + plot.cycleS * CYCLE.burstFrac;
      const isReserved =
         run.channel.active &&
         run.channel.plotId === i &&
         run.channel.cycleIndex === k;
      if (
         t >= burstAt - EPS &&
         plot.harvestedCycle !== k &&
         !isReserved &&
         plot.burstCycle !== k
      ) {
         plot.burstCycle = k;
         plot.sporeStart = burstAt;
         plot.sporeEnd = burstAt + SPORES.durationS;
         events.sporeBursts.push({ plotId: plot.id, x: plot.x, z: plot.z });
      }
   }
}

function completeChannelIfDue(run: AlienFarmRun, events: AlienFarmStepEvents): void {
   if (!run.channel.active) return;
   if (run.time >= run.channel.endsAt - EPS) {
      run.channel.active = false;
      const plot = run.plots[run.channel.plotId];
      plot.harvestedCycle = run.channel.cycleIndex;
      const perf = run.channel.perfect;
      run.carried.push({
         plotId: plot.id,
         cycleId: run.channel.cycleIndex,
         perfect: perf,
         kind: plot.kind,
      });
      run.harvested++;
      if (perf) {
         run.perfectHarvested++;
         run.streak++;
         if (run.streak > run.maxStreak) run.maxStreak = run.streak;
      } else {
         run.streak = 0;
      }
      const pts = perf ? SCORE.perfectHarvestPts : SCORE.normalHarvestPts;
      run.score += pts;
      events.harvested = {
         plotId: plot.id,
         x: plot.x,
         z: plot.z,
         perfect: perf,
         points: pts,
         streak: run.streak,
      };
   }
}

function tryHarvestAttempt(run: AlienFarmRun, events: AlienFarmStepEvents): void {
   const t = run.time;
   if (
      t < run.cooldownUntil - EPS ||
      run.channel.active ||
      run.carried.length >= HARVEST.maxCarry
   ) {
      run.cooldownUntil = t + HARVEST.cooldownDurationS;
      events.missed = {
         plotId: -1,
         x: run.farmer.x,
         z: run.farmer.z,
         reason: "cooldown",
      };
      return;
   }

   let bestPlot: PlotState | null = null;
   let bestDist = Infinity;
   let bestInfo: PlotCycleInfo | null = null;

   for (let i = 0; i < 9; i++) {
      const plot = run.plots[i];
      if (t < plot.activateAt - EPS) continue;
      if (!circlesOverlapXZ(run.farmer, 0, plot, HARVEST.reachRadius + EPS)) continue;
      const d = Math.hypot(run.farmer.x - plot.x, run.farmer.z - plot.z);
      const info = getPlotCycleInfo(plot, t);
      if (info.k < 0) continue;
      if (plot.harvestedCycle === info.k || plot.missedCycle === info.k) continue;
      if (info.stage === "spent") continue;
      if (d < bestDist - EPS) {
         bestDist = d;
         bestPlot = plot;
         bestInfo = info;
      }
   }

   if (!bestPlot || !bestInfo) {
      run.cooldownUntil = t + HARVEST.cooldownDurationS;
      events.missed = {
         plotId: -1,
         x: run.farmer.x,
         z: run.farmer.z,
         reason: "empty",
      };
      return;
   }

   if (bestInfo.stage !== "ripe") {
      bestPlot.missedCycle = bestInfo.k;
      run.streak = 0;
      run.cooldownUntil = t + HARVEST.cooldownDurationS;
      events.missed = {
         plotId: bestPlot.id,
         x: bestPlot.x,
         z: bestPlot.z,
         reason: "window",
      };
      return;
   }

   // Decision B: a correct press inside a ripe window NEVER sets the 0.60 s cooldown.
   const perfW = run.coarsePointer
      ? HARVEST.perfectHalfWidthCoarse
      : HARVEST.perfectHalfWidthFine;
   const perfect = Math.abs(t - bestInfo.p) <= perfW + EPS;
   run.channel.active = true;
   run.channel.plotId = bestPlot.id;
   run.channel.cycleIndex = bestInfo.k;
   run.channel.perfect = perfect;
   run.channel.startedAt = t;
   run.channel.endsAt = t + HARVEST.channelDurationS;
   run.channel.distToPlot = Math.max(0.35, Math.min(0.9, bestDist));
   run.farmer.vx = 0;
   run.farmer.vz = 0;
   run.farmer.speed = 0;
   const dx = bestPlot.x - run.farmer.x;
   const dz = bestPlot.z - run.farmer.z;
   if (Math.hypot(dx, dz) > 1e-4) {
      run.farmer.yaw = Math.atan2(dx, dz);
   }
}

function tryBeamLoad(run: AlienFarmRun, events: AlienFarmStepEvents): void {
   if (run.carried.length === 0) return;
   if (!circlesOverlapXZ(run.farmer, 0, run.ship, SHIP.beamRadius + EPS)) return;

   const n = run.carried.length;
   const pts = SCORE.deliveryBasePts * n * n;
   run.loadsSumSq += n * n;
   run.score += pts;
   for (const item of run.carried) {
      run.delivered++;
      if (item.perfect) run.perfectDelivered++;
      run.sourceMask |= 1 << item.plotId;
   }
   let mask = run.sourceMask;
   let count = 0;
   while (mask) {
      count += mask & 1;
      mask >>= 1;
   }
   run.sourceCount = count;
   run.carried.length = 0;
   run.lastDeliveryAt = run.time;

   let bonusUnlocked = false;
   if (!run.shipmentBonusShown && run.delivered >= GOAL.targetDelivered) {
      run.shipmentBonusShown = true;
      bonusUnlocked = true;
   }
   if (
      !run.goalMet &&
      run.delivered >= GOAL.targetDelivered &&
      run.sourceCount >= GOAL.targetSources &&
      run.perfectDelivered >= GOAL.targetPerfect
   ) {
      run.goalMet = true;
      run.goalTime = run.time;
   }
   events.delivered = {
      count: n,
      points: pts,
      x: run.ship.x,
      z: run.ship.z,
      bonusUnlocked,
   };
}

function stepFarmerSub(
   run: AlienFarmRun,
   dirX: number,
   dirZ: number,
   subDt: number,
   events: AlienFarmStepEvents,
): void {
   const f = run.farmer;
   if (run.channel.active) {
      f.vx = 0;
      f.vz = 0;
      f.speed = 0;
      const plot = run.plots[run.channel.plotId];
      if (plot) {
         const dx = plot.x - f.x;
         const dz = plot.z - f.z;
         if (Math.hypot(dx, dz) > 1e-4) {
            f.yaw = turnTowards(f.yaw, Math.atan2(dx, dz), FARMER.turnRate * 2, subDt);
         }
      }
      return;
   }

   let inSpore = false;
   for (let i = 0; i < 9; i++) {
      const p = run.plots[i];
      if (p.sporeEnd > run.time + EPS && run.time >= p.sporeStart - EPS) {
         if (circlesOverlapXZ(f, 0, p, SPORES.radius + EPS)) {
            inSpore = true;
            break;
         }
      }
   }
   if (inSpore && !f.inSpore) {
      events.enteredSpore = true;
   }
   f.inSpore = inSpore;

   const top =
      FARMER.carrySpeeds[run.carried.length] *
      (inSpore ? SPORES.speedMultiplier : 1);
   const curSpeed = Math.hypot(f.vx, f.vz);
   if (curSpeed > top) {
      f.vx = (f.vx / curSpeed) * top;
      f.vz = (f.vz / curSpeed) * top;
   }

   let ix = dirX;
   let iz = dirZ;
   let len = Math.hypot(ix, iz);
   if (len > 1) {
      ix /= len;
      iz /= len;
      len = 1;
   }

   let dvx = ix * top - f.vx;
   let dvz = iz * top - f.vz;
   const dv = Math.hypot(dvx, dvz);
   const maxDv = (len > 0.01 ? FARMER.accel : FARMER.decel) * subDt;
   if (dv > maxDv) {
      dvx *= maxDv / dv;
      dvz *= maxDv / dv;
   }
   f.vx += dvx;
   f.vz += dvz;

   const fromX = f.x;
   const fromZ = f.z;
   f.x += f.vx * subDt;
   f.z += f.vz * subDt;
   clampToBounds(f, FARM.walkBounds, FARMER.radius);

   const mx = f.x - fromX;
   const mz = f.z - fromZ;
   const moved = Math.hypot(mx, mz);
   const maxMove = top * subDt;
   if (moved > maxMove) {
      f.x = fromX + (mx * maxMove) / moved;
      f.z = fromZ + (mz * maxMove) / moved;
      clampToBounds(f, FARM.walkBounds, FARMER.radius);
   }
   f.vx = (f.x - fromX) / subDt;
   f.vz = (f.z - fromZ) / subDt;
   f.speed = Math.hypot(f.vx, f.vz);

   if (len > 0.01) {
      f.yaw = turnTowards(f.yaw, Math.atan2(ix, iz), FARMER.turnRate, subDt);
   }
}

export function stepRun(
   run: AlienFarmRun,
   input: AlienFarmInput,
   dt: number,
): AlienFarmStepEvents {
   const events: AlienFarmStepEvents = {
      harvested: null,
      missed: null,
      delivered: null,
      sporeBursts: [],
      enteredSpore: false,
      ended: null,
   };
   if (run.over || !(dt > 0)) return events;
   if (run.time >= GOAL.deadlineS - EPS) {
      run.over = true;
      events.ended = "timeup";
      return events;
   }

   updateTransitions(run, events);
   completeChannelIfDue(run, events);
   if (input.harvestPressed) {
      tryHarvestAttempt(run, events);
   }
   tryBeamLoad(run, events);

   const targetTime = Math.min(GOAL.deadlineS, run.time + dt);
   while (run.time < targetTime - EPS && !run.over) {
      let nextB = targetTime;
      for (const b of [20, 40, 70, 100]) {
         if (b > run.time + EPS && b < nextB) nextB = b;
      }
      if (
         run.channel.active &&
         run.channel.endsAt > run.time + EPS &&
         run.channel.endsAt < nextB
      ) {
         nextB = run.channel.endsAt;
      }
      if (
         run.cooldownUntil > run.time + EPS &&
         run.cooldownUntil < nextB
      ) {
         nextB = run.cooldownUntil;
      }
      for (let i = 0; i < 9; i++) {
         const p = run.plots[i];
         if (p.sporeEnd > run.time + EPS && p.sporeEnd < nextB) {
            nextB = p.sporeEnd;
         }
         if (run.time < p.b0 - EPS) {
            if (p.b0 < nextB) nextB = p.b0;
         } else {
            const info = getPlotCycleInfo(p, run.time);
            for (const cand of [
               info.growAt,
               info.ripeOpen,
               info.p,
               info.ripeClose,
               info.burstAt,
               info.nextB,
            ]) {
               if (cand > run.time + EPS && cand < nextB) nextB = cand;
            }
         }
      }

      const segDt = nextB - run.time;
      const { steps, stepDt } = substep(segDt, FARMER.maxSubstepDt);
      for (let s = 0; s < steps; s++) {
         const t0 = run.time;
         const t1 = s === steps - 1 ? nextB : t0 + stepDt;
         const actualDt = t1 - t0;
         const shipSpeed = shipSpeedAtTime(t0);
         run.ship.speed = shipSpeed;
         run.ship.s = advance(
            SHIP_PATH,
            run.ship.s,
            run.ship.direction * shipSpeed * actualDt,
         );
         const pt = pointAt(SHIP_PATH, run.ship.s);
         const tan = tangentAt(SHIP_PATH, run.ship.s);
         run.ship.x = pt.x;
         run.ship.z = pt.z;
         run.ship.yaw = Math.atan2(
            tan.x * run.ship.direction,
            tan.z * run.ship.direction,
         );

         stepFarmerSub(run, input.dirX, input.dirZ, actualDt, events);
         run.time = t1;

         if (run.time >= GOAL.deadlineS - EPS) {
            run.time = GOAL.deadlineS;
            run.channel.active = false;
            run.farmer.vx = 0;
            run.farmer.vz = 0;
            run.farmer.speed = 0;
            run.over = true;
            events.ended = "timeup";
            break;
         }
         updateTransitions(run, events);
         completeChannelIfDue(run, events);
         tryBeamLoad(run, events);
      }
   }
   return events;
}

/** Computes up to 2 off-screen TargetMarkers: saucer beam when carrying >= 1, and best plot when carrying < 4. */
export function computeTargetMarkers(run: AlienFarmRun): TargetMarkerSpec[] {
   if (run.over) return [];
   const markers: TargetMarkerSpec[] = [];
   const carry = run.carried.length;
   const perfW = run.coarsePointer
      ? HARVEST.perfectHalfWidthCoarse
      : HARVEST.perfectHalfWidthFine;

   if (carry >= 1) {
      markers.push({
         id: "beam",
         x: run.ship.x,
         z: run.ship.z,
         color: "#38bdf8",
         label: carry === 4 ? "BEAM FULL" : "BEAM",
      });
   }

   if (carry < HARVEST.maxCarry) {
      let bestPlot: PlotState | null = null;
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
         const p = run.plots[i];
         if (run.time < p.activateAt) continue;
         const info = getPlotCycleInfo(p, run.time);
         if (
            info.k >= 0 &&
            (p.harvestedCycle === info.k || p.missedCycle === info.k)
         ) {
            continue;
         }
         const eta =
            info.stage === "ripe"
               ? 0
               : Math.max(0, info.p - perfW - run.time);
         const dist = Math.hypot(run.farmer.x - p.x, run.farmer.z - p.z);
         const newBonus = (run.sourceMask & (1 << i)) === 0 ? -1.2 : 0;
         const score = eta + dist * 0.22 + newBonus;
         if (score < bestScore) {
            bestScore = score;
            bestPlot = p;
         }
      }
      if (bestPlot) {
         markers.push({
            id: `plot-${bestPlot.id}`,
            x: bestPlot.x,
            z: bestPlot.z,
            color: bestPlot.kind === "gourd" ? "#22d3ee" : "#4ade80",
            label: "RIPE",
         });
      }
   }
   return markers;
}

/** Selects up to 3 nearest active growing/ripe plots for spatial hum routing. */
export function selectHumPlots(run: AlienFarmRun): PlotHumSpec[] {
   if (run.over) return [];
   const candidates: Array<{ plotId: number; dist: number; gain: number; pitchHz: number }> = [];
   for (let i = 0; i < 9; i++) {
      const p = run.plots[i];
      if (run.time < p.activateAt) continue;
      const info = getPlotCycleInfo(p, run.time);
      if (info.stage !== "growing" && info.stage !== "ripe") continue;
      if (p.harvestedCycle === info.k || p.missedCycle === info.k) continue;
      const dist = Math.hypot(run.farmer.x - p.x, run.farmer.z - p.z);
      const gain = 0.04 * Math.max(0, 1 - dist / 6) * info.pulse;
      if (gain <= 0.001) continue;
      candidates.push({
         plotId: p.id,
         dist,
         gain,
         pitchHz: 330 + 220 * info.pulse,
      });
   }
   candidates.sort((a, b) => a.dist - b.dist);
   return candidates.slice(0, 3).map(({ plotId, gain, pitchHz }) => ({
      plotId,
      gain,
      pitchHz,
   }));
}

// ---------- Score Limit Certificate & Bots ----------

const PLOT_DIST: readonly (readonly number[])[] = Array.from({ length: 9 }, (_, i) =>
   Array.from({ length: 9 }, (__, j) =>
      Math.hypot(PLOTS[i].x - PLOTS[j].x, PLOTS[i].z - PLOTS[j].z),
   ),
);
const START_TO_PLOT_DIST: readonly number[] = PLOTS.map((p) =>
   Math.hypot(FARMER.startX - p.x, FARMER.startZ - p.z),
);

/**
 * Exhaustive branch-and-bound certificate returning the exact maximum harvest count `H*_t`
 * for offset table `tableIndex` (0..15) under the kinematics relaxation (max speed 4.5 m/s,
 * 0.90 m reach circles, 0.30 s planted channel).
 */
export function computeHarvestRelaxationBound(
   tableIndex: number,
   perfW: number = HARVEST.perfectHalfWidthCoarse,
): number {
   interface WindowNode {
      uid: number;
      plotId: number;
      cycleId: number;
      open: number;
      close: number;
      perfOpen: number;
      perfClose: number;
   }
   const nodes: WindowNode[] = [];
   for (let i = 0; i < 9; i++) {
      const delta = OFFSET_TABLES[tableIndex][i] * CYCLE.offsetTickS;
      const p = PLOTS[i];
      for (let k = 0; ; k++) {
         const b = p.activateAt + delta + k * p.cycleS;
         const peak = b + p.cycleS * CYCLE.peakFrac;
         const w = windowHalfWidthForPeak(peak);
         const open = peak - w;
         const close = peak + w;
         if (open >= GOAL.deadlineS - HARVEST.channelDurationS) break;
         if (close >= 0) {
            nodes.push({
               uid: nodes.length,
               plotId: i,
               cycleId: k,
               open: Math.max(0, open),
               close: Math.min(GOAL.deadlineS - HARVEST.channelDurationS - EPS, close),
               perfOpen: Math.max(0, peak - perfW),
               perfClose: Math.min(GOAL.deadlineS - HARVEST.channelDurationS - EPS, peak + perfW),
            });
         }
      }
   }
   nodes.sort((a, b) => a.open - b.open || a.plotId - b.plotId);
   nodes.forEach((nd, idx) => {
      nd.uid = idx;
   });

   const N = nodes.length;
   const minStepGap = SCORE.minDistinctPlotGapS;

   // Backward DP over 0.05 s time buckets to bound remaining harvests from (node, finishTime)
   const BUCKETS = 2000;
   const dp = Array.from({ length: N }, () => new Int16Array(BUCKETS + 1));
   for (let u = N - 1; u >= 0; u--) {
      const nu = nodes[u];
      const maxFinish = Math.min(BUCKETS, Math.floor((nu.close + 0.3) * 20));
      const minFinish = Math.max(0, Math.floor((nu.open + 0.3) * 20));
      for (let b = maxFinish; b >= minFinish; b--) {
         const finT = b / 20;
         let best = 1;
         for (let v = 0; v < N; v++) {
            const nv = nodes[v];
            if (nv.plotId === nu.plotId && nv.cycleId <= nu.cycleId) continue;
            const travel =
               nu.plotId === nv.plotId
                  ? 0
                  : Math.max(0, PLOT_DIST[nu.plotId][nv.plotId] - 1.8) / FARMER.baseSpeed;
            const earliestPress = Math.max(nv.open, finT + travel);
            if (earliestPress <= nv.close + 1e-9) {
               const nextFinB = Math.min(BUCKETS, Math.floor((earliestPress + 0.3) * 20));
               const cand = 1 + dp[v][nextFinB];
               if (cand > best) best = cand;
            }
         }
         dp[u][b] = best;
      }
      for (let b = minFinish - 1; b >= 0; b--) {
         dp[u][b] = dp[u][minFinish];
      }
   }

   let bestH = 0;
   const visited = new Map<string, number>();

   function dfs(
      lastPlot: number,
      finT: number,
      count: number,
      lastCycleByPlot: Int8Array,
   ): void {
      if (count > bestH) bestH = count;
      const remTime = GOAL.deadlineS - 0.3 - finT;
      if (remTime < 0) return;
      const maxMoreByRate = Math.floor(remTime / minStepGap) + 1;
      if (count + maxMoreByRate <= bestH) return;

      const key = `${lastPlot}:${count}:${lastCycleByPlot.join(",")}`;
      const prev = visited.get(key);
      if (prev !== undefined && prev <= finT + 1e-4) return;
      visited.set(key, finT);

      const candidates: Array<{ v: number; pressT: number; bound: number }> = [];
      for (let v = 0; v < N; v++) {
         const nv = nodes[v];
         if (nv.cycleId <= lastCycleByPlot[nv.plotId]) continue;
         const travel =
            lastPlot < 0
               ? Math.max(0, START_TO_PLOT_DIST[nv.plotId] - 0.9) / FARMER.baseSpeed
               : lastPlot === nv.plotId
                 ? 0
                 : Math.max(0, PLOT_DIST[lastPlot][nv.plotId] - 1.8) / FARMER.baseSpeed;
         const earliestPress = Math.max(nv.open, finT + travel);
         if (earliestPress > nv.close + 1e-9) continue;
         const finB = Math.min(BUCKETS, Math.floor((earliestPress + 0.3) * 20));
         const bound = count + dp[v][finB];
         if (bound <= bestH) continue;
         candidates.push({ v, pressT: earliestPress, bound });
      }
      candidates.sort((a, b) => a.pressT - b.pressT || b.bound - a.bound);

      for (const cand of candidates) {
         if (cand.bound <= bestH) continue;
         const nv = nodes[cand.v];
         const prevCycle = lastCycleByPlot[nv.plotId];
         lastCycleByPlot[nv.plotId] = nv.cycleId;
         dfs(nv.plotId, cand.pressT + 0.3, count + 1, lastCycleByPlot);
         lastCycleByPlot[nv.plotId] = prevCycle;
      }
   }

   dfs(-1, 0, 0, new Int8Array(9).fill(-1));
   return bestH;
}

function shipAtFutureTime(run: AlienFarmRun, futureT: number): { x: number; z: number } {
   let t = run.time;
   let s = run.ship.s;
   const dir = run.ship.direction;
   if (t < 40 && futureT > 40) {
      const t1 = Math.min(40, futureT);
      s += dir * SHIP.speedEarly * (t1 - t);
      t = t1;
   }
   if (t < 70 && futureT > t) {
      const t1 = Math.min(70, futureT);
      s += dir * SHIP.speedMid * (t1 - t);
      t = t1;
   }
   if (futureT > t) {
      s += dir * SHIP.speedLate * (futureT - t);
   }
   return shipPointAtS(s);
}

function earliestBeamTouch(
   run: AlienFarmRun,
   fx: number,
   fz: number,
   tStart: number,
   speed: number,
   nextTargetX = 0,
   nextTargetZ = 0,
): { t: number; x: number; z: number } {
   for (let dt = 0; dt <= 15; dt += 0.05) {
      const t = tStart + dt;
      if (t >= 99.95) break;
      const sp = shipAtFutureTime(run, t);
      const distToShip = Math.hypot(fx - sp.x, fz - sp.z);
      const needMove = Math.max(0, distToShip - 1.94);
      if (needMove / speed <= dt + 0.04) {
         const tx = 0.5 * fx + 0.5 * nextTargetX - sp.x;
         const tz = 0.5 * fz + 0.5 * nextTargetZ - sp.z;
         const tlen = Math.hypot(tx, tz) || 1;
         return {
            t,
            x: Math.max(-10.1, Math.min(10.1, sp.x + (tx / tlen) * 1.92)),
            z: Math.max(-8.1, Math.min(8.1, sp.z + (tz / tlen) * 1.92)),
         };
      }
   }
   const sp = shipAtFutureTime(run, Math.min(99.9, tStart + 10));
   return { t: tStart + 10, x: sp.x, z: sp.z };
}

function standPointForPlot(plotId: number, aimX: number, aimZ: number): { x: number; z: number } {
   const p = PLOTS[plotId];
   const dx = aimX - p.x;
   const dz = aimZ - p.z;
   const len = Math.hypot(dx, dz) || 1;
   return {
      x: p.x + (dx / len) * 0.86,
      z: p.z + (dz / len) * 0.86,
   };
}

/** Legal lookahead Oracle Bot that plans 2-step harvest chains + 4-crop saucer beam intercepts. */
export function oracleBotStep(run: AlienFarmRun): AlienFarmInput {
   if (run.channel.active) return { dirX: 0, dirZ: 0, harvestPressed: false };
   const t = run.time;
   const f = run.farmer;
   const perfW = run.coarsePointer
      ? HARVEST.perfectHalfWidthCoarse
      : HARVEST.perfectHalfWidthFine;
   const carry = run.carried.length;
   const speed = FARMER.carrySpeeds[carry];

   if (carry < HARVEST.maxCarry && t >= run.cooldownUntil + 1e-6) {
      for (let i = 0; i < 9; i++) {
         const p = run.plots[i];
         if (t < p.activateAt - 1e-9) continue;
         const d = Math.hypot(f.x - p.x, f.z - p.z);
         if (d <= HARVEST.reachRadius - 1e-6) {
            const info = getPlotCycleInfo(p, t);
            if (
               info.k >= 0 &&
               p.harvestedCycle !== info.k &&
               p.missedCycle !== info.k &&
               info.stage === "ripe"
            ) {
               const inPerfect = Math.abs(t - info.p) <= perfW - 0.002;
               const lateRipe = t >= info.p + perfW && t <= info.ripeClose - 0.005;
               if (inPerfect || lateRipe) {
                  return { dirX: 0, dirZ: 0, harvestPressed: true };
               }
            }
         }
      }
   }

   if (carry > 0) {
      const touch = earliestBeamTouch(run, f.x, f.z, t, speed, 0, 0);
      const dtBeam = touch.t - t;
      if (carry === HARVEST.maxCarry || (t + dtBeam + 0.55 >= 99.7 && carry > 0)) {
         const dx = touch.x - f.x;
         const dz = touch.z - f.z;
         const dist = Math.hypot(dx, dz);
         if (dist < 0.02) return { dirX: 0, dirZ: 0, harvestPressed: false };
         return { dirX: dx / dist, dirZ: dz / dist, harvestPressed: false };
      }
   }

   let bestMove: { stand: { x: number; z: number }; pressAt: number } | null = null;
   let bestVal = -Infinity;

   for (let i = 0; i < 9; i++) {
      const p = run.plots[i];
      const estShip = shipAtFutureTime(run, Math.min(99.5, t + 1.5));
      const aimX = carry === 3 ? estShip.x : 0;
      const aimZ = carry === 3 ? estShip.z : 0;
      const stand = standPointForPlot(i, aimX, aimZ);
      const dist1 = Math.hypot(f.x - stand.x, f.z - stand.z);
      const effSpeed1 =
         p.sporeEnd > t + 0.1 && t >= p.sporeStart ? speed * 0.72 : speed;
      const arrive1 = t + dist1 / effSpeed1 + (dist1 > 0.15 ? 0.06 : 0);

      const baseK =
         arrive1 < p.b0 ? 0 : Math.floor((arrive1 - p.b0) / p.cycleS);
      for (let dk = 0; dk <= 1; dk++) {
         const k = baseK + dk;
         if (p.harvestedCycle === k || p.missedCycle === k) continue;
         const b = p.b0 + k * p.cycleS;
         const peak = b + p.cycleS * CYCLE.peakFrac;
         const w = windowHalfWidthForPeak(peak);
         const ripeOpen = peak - w;
         const ripeClose = peak + w;
         const perfOpen = peak - perfW;
         const perfClose = peak + perfW;
         if (arrive1 > ripeClose - 0.04) continue;

         const hitPerf = arrive1 <= perfClose - 0.02;
         const press1 = hitPerf
            ? Math.max(arrive1, perfOpen)
            : Math.max(arrive1, ripeOpen);
         const finish1 = press1 + HARVEST.channelDurationS;
         if (finish1 >= 99.85) continue;

         const pts1 =
            (hitPerf ? SCORE.perfectHarvestPts : SCORE.normalHarvestPts) +
            ((run.sourceMask & (1 << i)) === 0 && run.sourceCount < 6 ? 25 : 0);

         if (carry === 3) {
            const touch = earliestBeamTouch(
               run,
               stand.x,
               stand.z,
               finish1,
               FARMER.carrySpeeds[4],
               0,
               0,
            );
            if (touch.t >= 99.9) continue;
            const totalPts = pts1 + 400;
            const totalDt = Math.max(0.25, touch.t - t);
            let postUnloadBonus = 0;
            for (let j = 0; j < 9; j++) {
               const pj = run.plots[j];
               const dAfter = Math.max(
                  0,
                  Math.hypot(touch.x - pj.x, touch.z - pj.z) - 0.86,
               );
               const arrAfter = touch.t + dAfter / FARMER.baseSpeed + 0.06;
               const kAfter =
                  arrAfter < pj.b0
                     ? 0
                     : Math.floor((arrAfter - pj.b0) / pj.cycleS);
               if (pj.harvestedCycle === kAfter || pj.missedCycle === kAfter) {
                  continue;
               }
               const peakAfter =
                  pj.b0 + kAfter * pj.cycleS + pj.cycleS * CYCLE.peakFrac;
               if (arrAfter <= peakAfter + perfW) {
                  const waitAfter = Math.max(0, peakAfter - perfW - arrAfter);
                  postUnloadBonus = Math.max(
                     postUnloadBonus,
                     80 / (dAfter / FARMER.baseSpeed + waitAfter + 0.6),
                  );
               }
            }
            const rate = totalPts / totalDt + postUnloadBonus * 0.25;
            if (rate > bestVal) {
               bestVal = rate;
               bestMove = { stand, pressAt: press1 };
            }
         } else {
            const speed2 = FARMER.carrySpeeds[carry + 1];
            let bestRate2 = (pts1 + 80) / Math.max(0.25, finish1 - t + 1.5);
            for (let j = 0; j < 9; j++) {
               if (j === i) continue;
               const pj = run.plots[j];
               const stand2 = standPointForPlot(j, stand.x, stand.z);
               const dist2 = Math.hypot(stand.x - stand2.x, stand.z - stand2.z);
               const effSpeed2 =
                  pj.sporeEnd > finish1 && finish1 >= pj.sporeStart
                     ? speed2 * 0.72
                     : speed2;
               const arrive2 = finish1 + dist2 / effSpeed2 + 0.06;
               const baseK2 =
                  arrive2 < pj.b0
                     ? 0
                     : Math.floor((arrive2 - pj.b0) / pj.cycleS);
               for (let dk2 = 0; dk2 <= 1; dk2++) {
                  const k2 = baseK2 + dk2;
                  if (pj.harvestedCycle === k2 || pj.missedCycle === k2) continue;
                  const b2 = pj.b0 + k2 * pj.cycleS;
                  const peak2 = b2 + pj.cycleS * CYCLE.peakFrac;
                  const w2 = windowHalfWidthForPeak(peak2);
                  if (arrive2 > peak2 + w2 - 0.04) continue;
                  const hitPerf2 = arrive2 <= peak2 + perfW - 0.02;
                  const press2 = hitPerf2
                     ? Math.max(arrive2, peak2 - perfW)
                     : Math.max(arrive2, peak2 - w2);
                  const finish2 = press2 + HARVEST.channelDurationS;
                  if (finish2 >= 99.85) continue;
                  const pts2 =
                     (hitPerf2 ? SCORE.perfectHarvestPts : SCORE.normalHarvestPts) +
                     100;
                  let shipProxBonus = 0;
                  if (carry + 2 === 4) {
                     const sp2 = shipAtFutureTime(run, finish2 + 0.8);
                     const dShip = Math.max(
                        0,
                        Math.hypot(stand2.x - sp2.x, stand2.z - sp2.z) - 1.9,
                     );
                     shipProxBonus = -dShip * 8;
                  }
                  const rate2 =
                     (pts1 + 100 + pts2 + shipProxBonus) /
                     Math.max(0.4, finish2 - t);
                  if (rate2 > bestRate2) bestRate2 = rate2;
               }
            }
            if (bestRate2 > bestVal) {
               bestVal = bestRate2;
               bestMove = { stand, pressAt: press1 };
            }
         }
      }
   }

   if (!bestMove) return { dirX: 0, dirZ: 0, harvestPressed: false };
   const dx = bestMove.stand.x - f.x;
   const dz = bestMove.stand.z - f.z;
   const dist = Math.hypot(dx, dz);
   if (dist < 0.03) return { dirX: 0, dirZ: 0, harvestPressed: false };
   const scale = Math.min(1, dist / 0.16);
   return {
      dirX: (dx / dist) * scale,
      dirZ: (dz / dist) * scale,
      harvestPressed: false,
   };
}

/**
 * Human-Paced Bot:
 * - Observes ONLY plots inside the 6x6 m portrait camera window around the farmer,
 *   plus the off-screen TargetMarker arrow and audible hum loops within 6 m.
 * - Includes human reaction delay (0.15 s fine / 0.20 s coarse after entering peak glow)
 *   and a 0.35 s decision pause after each completed harvest.
 */
export function createHumanBot(): (run: AlienFarmRun) => AlienFarmInput {
   let lastHarvestCount = 0;
   let pauseUntil = 0;
   let lockedTargetPlot = -1;

   return function humanBotStep(run: AlienFarmRun): AlienFarmInput {
      if (run.channel.active) return { dirX: 0, dirZ: 0, harvestPressed: false };
      const t = run.time;
      const f = run.farmer;
      const carry = run.carried.length;
      const perfW = run.coarsePointer
         ? HARVEST.perfectHalfWidthCoarse
         : HARVEST.perfectHalfWidthFine;
      const reactionDelay = run.coarsePointer ? 0.2 : 0.15;

      if (run.harvested > lastHarvestCount) {
         lastHarvestCount = run.harvested;
         pauseUntil = t + 0.35;
         lockedTargetPlot = -1;
      }

      if (carry < HARVEST.maxCarry && t >= run.cooldownUntil + 1e-6) {
         for (let i = 0; i < 9; i++) {
            const p = run.plots[i];
            if (t < p.activateAt - 1e-9) continue;
            if (Math.hypot(f.x - p.x, f.z - p.z) <= 0.88) {
               const info = getPlotCycleInfo(p, t);
               if (
                  info.k >= 0 &&
                  p.harvestedCycle !== info.k &&
                  p.missedCycle !== info.k &&
                  info.stage === "ripe"
               ) {
                  const perfOpen = info.p - perfW;
                  if (
                     t >= perfOpen + reactionDelay &&
                     t <= info.ripeClose - 0.02
                  ) {
                     return { dirX: 0, dirZ: 0, harvestPressed: true };
                  }
               }
            }
         }
      }

      if (t < pauseUntil) {
         return { dirX: 0, dirZ: 0, harvestPressed: false };
      }

      if (carry === HARVEST.maxCarry || (carry > 0 && t > 93)) {
         const dx = run.ship.x - f.x;
         const dz = run.ship.z - f.z;
         const len = Math.hypot(dx, dz) || 1;
         return { dirX: dx / len, dirZ: dz / len, harvestPressed: false };
      }

      const markers = computeTargetMarkers(run);
      const plotMarker = markers.find((m) => m.id.startsWith("plot-"));
      const arrowPlotId = plotMarker
         ? Number.parseInt(plotMarker.id.slice(5), 10)
         : -1;
      const humPlotIds = new Set(selectHumPlots(run).map((h) => h.plotId));

      let bestPlot = -1;
      let bestCost = Infinity;
      for (let i = 0; i < 9; i++) {
         const p = run.plots[i];
         if (t < p.activateAt) continue;
         const inWindow =
            Math.abs(p.x - f.x) <= 3.0 && Math.abs(p.z - f.z) <= 3.0;
         const audibleHum = humPlotIds.has(i);
         const isArrow = i === arrowPlotId;
         if (!inWindow && !audibleHum && !isArrow && i !== lockedTargetPlot) {
            continue;
         }

         const dist = Math.hypot(p.x - f.x, p.z - f.z);
         const speed = FARMER.carrySpeeds[carry];
         const travel = Math.max(0, dist - 0.8) / speed;
         const arrive = t + travel;
         const k =
            arrive < p.b0 ? 0 : Math.floor((arrive - p.b0) / p.cycleS);
         if (p.harvestedCycle === k || p.missedCycle === k) continue;
         const peak = p.b0 + k * p.cycleS + p.cycleS * CYCLE.peakFrac;
         const w = windowHalfWidthForPeak(peak);
         if (arrive > peak + w - 0.15) continue;
         const wait = Math.max(0, peak - perfW - arrive);
         const newSourceBonus =
            (run.sourceMask & (1 << i)) === 0 && run.sourceCount < 6 ? -2.0 : 0;
         const cost = travel + wait + newSourceBonus;
         if (cost < bestCost) {
            bestCost = cost;
            bestPlot = i;
         }
      }

      if (bestPlot < 0) bestPlot = arrowPlotId;
      if (bestPlot < 0) return { dirX: 0, dirZ: 0, harvestPressed: false };
      lockedTargetPlot = bestPlot;

      const target = PLOTS[bestPlot];
      const dx = target.x - f.x;
      const dz = target.z - f.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 0.75) return { dirX: 0, dirZ: 0, harvestPressed: false };
      return { dirX: dx / dist, dirZ: dz / dist, harvestPressed: false };
   };
}
