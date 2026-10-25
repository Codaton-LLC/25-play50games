// Jungle Bridge Run rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
import { createRng } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type JungleLevel, type PatternKind } from "./levels";

// ---------- tuning (scoring proof cites these) ----------

export const INITIAL_LIVES = 3;
export const SECTION_LEN = 24;
export const RUN_IN_Z = 6;
export const LANE_X = [-2, 0, 2] as const;
export const LANE_CHANGE_S = 0.18;
export const JUMP_S = 0.55;
export const JUMP_ARC = 1.3;
export const SLIDE_S = 0.60;
export const RESPAWN_S = 0.8;
export const PLAYER_RADIUS = 0.38;
export const SLIDE_HEIGHT = 0.6;
export const STAND_HEIGHT = 1.76;

export const SECTION_POINTS = 100;
export const GEM_POINTS = 20;
/** Win only: full seconds left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 4;

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { kind: "points", maxScore: 780, minDurationMs: 4000, maxDurationMs: 75_000, base: 480, maxPointsPerSec: 24, unitLabel: "pts", display: "int" },
   2: { kind: "points", maxScore: 1140, minDurationMs: 4000, maxDurationMs: 90_000, base: 800, maxPointsPerSec: 20, unitLabel: "pts", display: "int" },
   3: { kind: "points", maxScore: 1510, minDurationMs: 4000, maxDurationMs: 110_000, base: 1120, maxPointsPerSec: 18, unitLabel: "pts", display: "int" },
   4: { kind: "points", maxScore: 1860, minDurationMs: 4000, maxDurationMs: 120_000, base: 1440, maxPointsPerSec: 16, unitLabel: "pts", display: "int" },
   5: { kind: "points", maxScore: 2310, minDurationMs: 4000, maxDurationMs: 120_000, base: 1920, maxPointsPerSec: 14, unitLabel: "pts", display: "int" },
};

// ---------- obstacles & layout ----------

export interface GapObstacle {
   kind: "gap";
   z: number;
   length: number; // 3.0 m
   lanes: number[]; // affected lanes (e.g. [0, 1, 2] or [0, 1])
}

export interface VineObstacle {
   kind: "vine";
   z: number;
   lanes: number[]; // 1 or 2 lanes
}

export interface LogObstacle {
   kind: "log";
   z: number;
   speed: number;
   minX: number;
   maxX: number;
}

export interface BridgeObstacle {
   kind: "bridge";
   z: number;
   length: number; // 8.0 m
   plankLane: number; // 0, 1, or 2
}

export interface PillarObstacle {
   kind: "pillar";
   z: number;
   lane: number;
}

export interface LavaObstacle {
   kind: "lava";
   z: number;
   lane: number;
}

export type Obstacle = GapObstacle | VineObstacle | LogObstacle | BridgeObstacle | PillarObstacle | LavaObstacle;

export interface GemData {
   id: number;
   section: number;
   lane: number;
   x: number;
   y: number;
   z: number;
   collected: boolean;
}

export interface SectionData {
   index: number;
   startZ: number;
   gateZ: number;
   obstacles: Obstacle[];
   clearLane: number;
}

export interface RunnerInput {
   left?: boolean;
   right?: boolean;
   jump?: boolean;
   slide?: boolean;
}

export const idleInput = (): RunnerInput => ({
   left: false,
   right: false,
   jump: false,
   slide: false,
});

export interface StepEvents {
   score: number;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   gemCollected: boolean;
   sectionCleared: boolean;
   jump: boolean;
   slide: boolean;
}

export interface Run {
   seed: number;
   level: JungleLevel;
   levelId: LevelId;
   time: number;
   score: number;
   lives: number;
   over: false | "win" | "lose";
   speed: number;
   x: number;
   y: number;
   z: number;
   lane: number;
   laneFromX: number;
   laneToX: number;
   laneTimer: number;
   jumpTimer: number;
   slideTimer: number;
   respawning: boolean;
   respawnTimer: number;
   currentSection: number;
   gemsTaken: number;
   sections: SectionData[];
   gems: GemData[];
   ev: StepEvents;
}

// ---------- generation ----------

export function createRun(seed: number, level: JungleLevel): Run {
   const rng = createRng(seed);
   const sections: SectionData[] = [];
   const gems: GemData[] = [];
   let gemId = 0;

   // Level id lookup
   let levelId: LevelId = 1;
   for (const key of [1, 2, 3, 4, 5] as const) {
      if (LEVELS[key].sections === level.sections && LEVELS[key].speed === level.speed) {
         levelId = key;
         break;
      }
   }

   let prevClearLane = 1;

   for (let s = 0; s < level.sections; s++) {
      const startZ = RUN_IN_Z + s * SECTION_LEN;
      const gateZ = startZ + SECTION_LEN;
      const obstacles: Obstacle[] = [];

      // Require lane navigation across sections: clear lane shifts between sections
      const candidateLanes = s === 0 ? [0, 1, 2] : [0, 1, 2].filter((l) => l !== prevClearLane);
      const clearLane = candidateLanes[Math.floor(rng() * candidateLanes.length)];
      prevClearLane = clearLane;

      // Decide how many patterns in this section (L4+ can have 2 if spaced >= 10 m)
      const patternCount = level.patterns.length > 2 && level.speed >= 7.8 && rng() < 0.5 ? 2 : 1;

      if (patternCount === 1) {
         const pattern = level.patterns[Math.floor(rng() * level.patterns.length)];
         const obs = buildObstacle(pattern, startZ + 8, clearLane, level, rng);
         obstacles.push(obs);
      } else {
         // 2 patterns spaced at least 10 m apart: at relZ = 4 and relZ = 15
         const p1 = level.patterns[Math.floor(rng() * level.patterns.length)];
         const p2 = level.patterns[Math.floor(rng() * level.patterns.length)];
         obstacles.push(buildObstacle(p1, startZ + 4, clearLane, level, rng));
         obstacles.push(buildObstacle(p2, startZ + 15, clearLane, level, rng));
      }

      sections.push({
         index: s,
         startZ,
         gateZ,
         obstacles,
         clearLane,
      });

      // Gems: gemsPerSection placed at relZ 4, 11, 18
      const gemOffsets = [4, 11, 18];
      for (let g = 0; g < level.gemsPerSection; g++) {
         const offset = gemOffsets[g] ?? (4 + g * 7);
         // Place mostly on clearLane, sometimes adjacent lane
         const lane = rng() < 0.65 ? clearLane : Math.floor(rng() * 3);
         const z = startZ + offset;
         gems.push({
            id: gemId++,
            section: s,
            lane,
            x: LANE_X[lane],
            y: 0.5,
            z,
            collected: false,
         });
      }
   }

   const ev: StepEvents = {
      score: 0,
      lifeLost: false,
      won: false,
      lost: false,
      gemCollected: false,
      sectionCleared: false,
      jump: false,
      slide: false,
   };

   return {
      seed,
      level,
      levelId,
      time: 0,
      score: 0,
      lives: INITIAL_LIVES,
      over: false,
      speed: level.speed,
      x: LANE_X[1],
      y: 0,
      z: 0,
      lane: 1,
      laneFromX: LANE_X[1],
      laneToX: LANE_X[1],
      laneTimer: 0,
      jumpTimer: 0,
      slideTimer: 0,
      respawning: false,
      respawnTimer: 0,
      currentSection: 0,
      gemsTaken: 0,
      sections,
      gems,
      ev,
   };
}

function buildObstacle(
   kind: PatternKind,
   z: number,
   clearLane: number,
   level: JungleLevel,
   rng: () => number,
): Obstacle {
   switch (kind) {
      case "gap": {
         // Gap is 2.5 m missing planks across lanes: jumping clears it
         return {
            kind: "gap",
            z,
            length: 2.5,
            lanes: [0, 1, 2],
         };
      }
      case "vine": {
         // Low bar across lanes including clearLane: sliding clears it
         const lanes = rng() < 0.5 ? [clearLane] : [0, 1, 2].filter((l) => l !== (clearLane === 0 ? 2 : 0));
         return {
            kind: "vine",
            z,
            lanes,
         };
      }
      case "bridge": {
         // Only one lane has planks for 8 m: be on it
         return {
            kind: "bridge",
            z,
            length: 8.0,
            plankLane: clearLane,
         };
      }
      case "pillar": {
         // Block 1 lane (never the clear lane)
         const nonClear = [0, 1, 2].filter((l) => l !== clearLane);
         const lane = nonClear[Math.floor(rng() * nonClear.length)] ?? (clearLane === 0 ? 1 : 0);
         return {
            kind: "pillar",
            z,
            lane,
         };
      }
      case "log": {
         return {
            kind: "log",
            z,
            speed: level.logSpeed > 0 ? level.logSpeed : 2.5,
            minX: -2.2,
            maxX: 2.2,
         };
      }
      case "lava": {
         const nonClear = [0, 1, 2].filter((l) => l !== clearLane);
         const lane = nonClear[Math.floor(rng() * nonClear.length)] ?? (clearLane === 0 ? 1 : 0);
         return {
            kind: "lava",
            z,
            lane,
         };
      }
   }
}

// ---------- bot / clear line validation ----------

export function hasClearLine(run: Run): boolean {
   // Verify every section has at least one safe passage
   for (const sec of run.sections) {
      const clear = sec.clearLane;
      for (const obs of sec.obstacles) {
         if (obs.kind === "pillar" && obs.lane === clear) return false;
         if (obs.kind === "bridge" && obs.plankLane !== clear) return false;
         if (obs.kind === "lava" && obs.lane === clear) return false;
      }
   }
   return true;
}

export function logXAt(log: LogObstacle, time: number): number {
   const range = log.maxX - log.minX;
   if (range <= 0 || log.speed <= 0) return 0;
   const period = (2 * range) / log.speed;
   const mod = (time * log.speed) % (2 * range);
   return mod < range ? log.minX + mod : log.maxX - (mod - range);
}

export function isLavaActive(time: number): boolean {
   return (time % 3.0) < 1.2;
}

export function timeBonus(timeLeftMs: number): number {
   return Math.max(0, Math.floor(timeLeftMs / 1000) * TIME_BONUS_PER_SECOND);
}

// ---------- step ----------

export function step(run: Run, input: RunnerInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   ev.gemCollected = false;
   ev.sectionCleared = false;
   ev.jump = false;
   ev.slide = false;

   if (run.over || !(dt > 0)) return ev;

   run.time += dt;

   // Handle respawn delay
   if (run.respawning) {
      run.respawnTimer = Math.max(0, run.respawnTimer - dt);
      if (run.respawnTimer <= 0) {
         run.respawning = false;
         // Place at start of current section
         const sec = run.sections[run.currentSection];
         run.z = sec ? sec.startZ : RUN_IN_Z;
         run.lane = 1;
         run.x = LANE_X[1];
         run.laneFromX = run.x;
         run.laneToX = run.x;
         run.laneTimer = 0;
         run.y = 0;
         run.jumpTimer = 0;
         run.slideTimer = 0;
      }
      return ev;
   }

   // Discrete lane changes
   if (input.left && run.lane > 0) {
      run.lane -= 1;
      run.laneFromX = run.x;
      run.laneToX = LANE_X[run.lane];
      run.laneTimer = LANE_CHANGE_S;
   } else if (input.right && run.lane < 2) {
      run.lane += 1;
      run.laneFromX = run.x;
      run.laneToX = LANE_X[run.lane];
      run.laneTimer = LANE_CHANGE_S;
   }

   // Update horizontal lane transition
   if (run.laneTimer > 0) {
      run.laneTimer = Math.max(0, run.laneTimer - dt);
      const t = 1 - run.laneTimer / LANE_CHANGE_S;
      run.x = run.laneFromX + (run.laneToX - run.laneFromX) * t;
   } else {
      run.x = LANE_X[run.lane];
   }

   // Jump trigger
   if (input.jump && run.jumpTimer <= 0) {
      run.jumpTimer = JUMP_S;
      run.slideTimer = 0;
      ev.jump = true;
   }

   // Slide trigger
   if (input.slide && run.slideTimer <= 0) {
      run.slideTimer = SLIDE_S;
      run.jumpTimer = 0;
      run.y = 0;
      ev.slide = true;
   }

   // Vertical motion (jump arc)
   if (run.jumpTimer > 0) {
      run.jumpTimer = Math.max(0, run.jumpTimer - dt);
      const progress = 1 - run.jumpTimer / JUMP_S;
      run.y = Math.sin(progress * Math.PI) * JUMP_ARC;
   } else {
      run.y = 0;
   }

   // Slide duration
   if (run.slideTimer > 0) {
      run.slideTimer = Math.max(0, run.slideTimer - dt);
   }

   // Forward motion
   run.z += run.speed * dt;

   // Check collisions with current section obstacles
   const currentSec = run.sections[run.currentSection];
   if (currentSec) {
      for (const obs of currentSec.obstacles) {
         if (collidesWithObstacle(run, obs)) {
            triggerHit(run, ev);
            return ev;
         }
      }
   }

   // Gem pickups
   for (let i = 0; i < run.gems.length; i++) {
      const gem = run.gems[i];
      if (gem.collected) continue;
      const dz = Math.abs(run.z - gem.z);
      const dx = Math.abs(run.x - gem.x);
      const dy = Math.abs(run.y - gem.y);
      if (dz <= 0.9 && dx <= 0.8 && dy <= 1.1) {
         gem.collected = true;
         run.score += GEM_POINTS;
         ev.score += GEM_POINTS;
         run.gemsTaken += 1;
         ev.gemCollected = true;
      }
   }

   // Section checkpoint and finish line
   if (currentSec && run.z >= currentSec.gateZ) {
      if (run.currentSection + 1 < run.level.sections) {
         run.currentSection += 1;
         run.score += SECTION_POINTS;
         ev.score += SECTION_POINTS;
         ev.sectionCleared = true;
      } else {
         // Reached the finish line!
         run.score += SECTION_POINTS;
         ev.score += SECTION_POINTS;
         const bonus = timeBonus(timeLeftMs);
         run.score += bonus;
         ev.score += bonus;
         run.over = "win";
         ev.won = true;
      }
   }

   return ev;
}

function collidesWithObstacle(run: Run, obs: Obstacle): boolean {
   switch (obs.kind) {
      case "gap": {
         // Gap is missing planks: falling if on ground inside the gap
         if (run.z >= obs.z + 0.2 && run.z <= obs.z + obs.length - 0.2) {
            const laneAffected = obs.lanes.includes(run.lane);
            if (laneAffected && (run.jumpTimer <= 0 || run.y < 0.2)) {
               return true; // fell into gap
            }
         }
         return false;
      }
      case "vine": {
         // Vine is a low bar. Slide clears it; jumping or running standing hits it
         if (Math.abs(run.z - obs.z) <= 0.35) {
            const laneAffected = obs.lanes.includes(run.lane);
            if (laneAffected) {
               if (run.slideTimer <= 0 || run.y > 0.1) {
                  return true; // didn't slide
               }
            }
         }
         return false;
      }
      case "log": {
         // Rolling log across track. Jumping clears it; standing or sliding hits it
         if (Math.abs(run.z - obs.z) <= 0.4) {
            const lx = logXAt(obs, run.time);
            const LOG_HALF_WIDTH = 0.9;
            if (Math.abs(run.x - lx) <= LOG_HALF_WIDTH + PLAYER_RADIUS) {
               if (run.y < 0.4) {
                  return true; // tripped on log
               }
            }
         }
         return false;
      }
      case "pillar": {
         // Solid block on one lane. Cannot jump or slide
         if (Math.abs(run.z - obs.z) <= 0.6) {
            if (Math.abs(run.x - LANE_X[obs.lane]) <= 0.55 + PLAYER_RADIUS) {
               return true; // hit pillar
            }
         }
         return false;
      }
      case "bridge": {
         // Only plankLane has planks for 8 m
         if (run.z >= obs.z && run.z <= obs.z + obs.length) {
            const onPlank = Math.abs(run.x - LANE_X[obs.plankLane]) <= 0.7;
            if (!onPlank && run.y < 0.3) {
               return true; // fell off bridge
            }
         }
         return false;
      }
      case "lava": {
         // Timed lava vent
         if (Math.abs(run.z - obs.z) <= 0.6) {
            if (Math.abs(run.x - LANE_X[obs.lane]) <= 0.6) {
               if (isLavaActive(run.time) && run.y < 0.3) {
                  return true; // burned by lava
               }
            }
         }
         return false;
      }
   }
}

function triggerHit(run: Run, ev: StepEvents): void {
   run.lives -= 1;
   ev.lifeLost = true;
   if (run.lives <= 0) {
      run.over = "lose";
      ev.lost = true;
   } else {
      run.respawning = true;
      run.respawnTimer = RESPAWN_S;
      run.jumpTimer = 0;
      run.slideTimer = 0;
   }
}
