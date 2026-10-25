// Pure deterministic state & rules for knight-arena. No React, no Three.js.
// Level 1 is today's game: createBeatMap(seed) / createRun(seed) keep the frozen grid and the
// same RNG order. Levels 2-5 go through createRun(seed, level) (levels.ts).
import { rngNext, type RngState, turnTowards } from "../../core/math";
import { spring, type SpringState } from "../../core/motion";
import type { LevelId, ScoringRules } from "../../types";
import { LEVELS, type KnightLevel } from "./levels";
import type { StrikeDir } from "./poses";

function rngInt(rng: RngState, min: number, max: number): number {
   return min + Math.floor(rngNext(rng) * (max - min + 1));
}

export type { StrikeDir };
export type PostRing = "near" | "far";
export type TargetKind = "regular" | "shield" | "tomato";

export const COLORS = {
   grass: "#557a3a", arenaFloor: "#c7a36e", arenaRing: "#8b5a2b",
   stone: "#8a857d", stoneDark: "#57534e", wood: "#8b5a2b", woodLight: "#d6a36c",
   steel: "#cbd5e1", steelDark: "#64748b", royalBlue: "#2563eb", gold: "#f59e0b",
   regular: "#f59e0b", shield: "#38bdf8", tomato: "#ef4444",
   approachRing: "#facc15", activeRing: "#4ade80",
} as const;

export const ARENA = {
   RADIUS_M: 3.5, SIDES: 8, FENCE_HEIGHT_M: 0.9,
   TOWER_POSITIONS: [[-4.2, -3.5], [4.2, -3.5]] as const,
   TREE_POSITIONS: [[-4.8, -1.5], [4.8, -1.5], [-4.8, 2.2], [4.8, 2.2]] as const,
} as const;

export const KNIGHT = {
   HEIGHT_M: 1.75, RADIUS_M: 0.40, LUNGE_STEP_M: 1.00, TURN_RATE_RAD_S: 40, SWING_DURATION_S: 0.25,
} as const;

export interface PostSpec {
   index: number; direction: StrikeDir; ring: PostRing; x: number; z: number;
   rayYaw: number; facingYaw: number;
}

const RAW_POSTS: Array<{ direction: StrikeDir; ring: PostRing; x: number; z: number }> = [
   { direction: "up", ring: "near", x: 0, z: -1.60 },
   { direction: "down", ring: "near", x: 0, z: 1.60 },
   { direction: "left", ring: "near", x: -1.60, z: 0 },
   { direction: "right", ring: "near", x: 1.60, z: 0 },
   { direction: "up", ring: "far", x: 1.00, z: -2.40 },
   { direction: "down", ring: "far", x: -1.00, z: 2.40 },
   { direction: "left", ring: "far", x: -2.40, z: -1.00 },
   { direction: "right", ring: "far", x: 2.40, z: 1.00 },
];

export const POSTS: readonly PostSpec[] = RAW_POSTS.map((p, index) => ({
   index, direction: p.direction, ring: p.ring, x: p.x, z: p.z,
   rayYaw: Math.atan2(p.x, p.z), facingYaw: Math.atan2(-p.x, -p.z),
}));

export const TARGETS = {
   DUMMY_HEIGHT_M: 1.50, DUMMY_RADIUS_M: 0.32, DISC_RADIUS_M: 0.50,
   NEAR_RADIUS_M: 1.60, FAR_RADIUS_M: 2.60, FAR_YAW_OFFSET_RAD: Math.PI / 8,
   WOBBLE_STIFFNESS: 64, WOBBLE_DAMPING: 8, WOBBLE_HIT_IMPULSE_RAD: 0.35, POSTS,
} as const;

export const TIMING = {
   LEAD_BEATS: 2, ACTIVE_WINDOW_MS: 200,
   ON_BEAT_WINDOW_MS: 110, // Q3 Decision: one ±110 ms on-beat window for every device
   TOMATO_CLEARANCE_MS: 400,
} as const;

export const COMBO = { STEP_HITS: 8, MAX_MULTIPLIER: 4 } as const;

export const SPIN = {
   MAX_METER: 100, ON_BEAT_CHARGE: 15, OFF_BEAT_CHARGE: 10, BONUS_PTS: 50, DURATION_S: 0.40,
} as const;

export const SCORING = {
   ON_BEAT_PTS: 20, OFF_BEAT_PTS: 10, SPIN_HIT_PTS: 20, SPIN_BONUS_PTS: 50, TOMATO_PENALTY_PTS: 50,
} as const;

export interface StageSpec {
   stage: 1 | 2 | 3 | 4; startMs: number; endMs: number; bpm: number;
   periodMs: number; beatCount: number; startBeatIndex: number; firstBeatMs: number;
}

export const STAGES: readonly StageSpec[] = [
   { stage: 1, startMs: 0, endMs: 15_000, bpm: 100, periodMs: 600, beatCount: 23, startBeatIndex: 0, firstBeatMs: 1500 },
   { stage: 2, startMs: 15_000, endMs: 30_000, bpm: 110, periodMs: 60_000 / 110, beatCount: 27, startBeatIndex: 23, firstBeatMs: 14_700 + 60_000 / 110 },
   { stage: 3, startMs: 30_000, endMs: 45_000, bpm: 120, periodMs: 500, beatCount: 29, startBeatIndex: 50, firstBeatMs: 30_427.272727272728 },
   { stage: 4, startMs: 45_000, endMs: 60_000, bpm: 130, periodMs: 60_000 / 130, beatCount: 32, startBeatIndex: 79, firstBeatMs: 45_230.769230769234 },
];

function buildBeatTimesMs(): readonly number[] {
   const times: number[] = [];
   for (const s of STAGES) {
      for (let k = 0; k < s.beatCount; k++) times.push(s.firstBeatMs + k * s.periodMs);
   }
   return times;
}

export const BEAT_TIMES_MS: readonly number[] = buildBeatTimesMs();

export const BEAT = {
   DURATION_MS: 60_000, DURATION_S: 60, MAP_SEEDS: [101, 202, 303] as const,
   BEAT_COUNT: 111, MAX_HIT_SLOTS: 140, MAX_SHIELDS: 12, MAX_DOUBLES: 29, TOMATO_COUNT: 18,
   STAGES, BEAT_TIMES_MS,
} as const;

export const DIRECTIONS: readonly StrikeDir[] = ["up", "down", "left", "right"];

export function dirToIndex(dir: StrikeDir): number {
   if (dir === "up") return 0;
   if (dir === "down") return 1;
   if (dir === "left") return 2;
   return 3;
}

export function comboForStreak(streak: number, stepHits: number = COMBO.STEP_HITS): number {
   if (streak <= 0) return 1;
   return Math.min(COMBO.MAX_MULTIPLIER, 1 + Math.floor((streak - 1) / stepHits));
}

export function stageAtTimeMs(timeMs: number): StageSpec {
   if (timeMs < 15_000) return STAGES[0];
   if (timeMs < 30_000) return STAGES[1];
   if (timeMs < 45_000) return STAGES[2];
   return STAGES[3];
}

export interface TargetCue {
   id: number; beatIndex: number; stage: 1 | 2 | 3 | 4; kind: TargetKind;
   postIndex: number; direction: StrikeDir; ring: PostRing;
   beatTimeMs: number; spawnTimeMs: number; expireTimeMs: number;
   shieldHitIndex: 1 | 2; shieldGroupId: number; doublePairId: number;
   /** Near post the marker slides from, or -1 when it stays on its post (every level-1 cue). */
   originPostIndex: number;
   status: "pending" | "hit" | "expired"; hitGrade: "none" | "onBeat" | "offBeat" | "spin";
}

export interface BeatMap {
   seed: number; cues: TargetCue[];
   realSlotCount: number; shieldCount: number; doubleCount: number; tomatoCount: number;
   beatCount: number; comboStep: number;
   stages: readonly StageSpec[]; beatTimesMs: readonly number[];
}

function pickFrom<T>(rng: RngState, items: readonly T[]): T {
   return items[rngInt(rng, 0, items.length - 1)];
}

/**
 * Deterministically builds the 111-beat schedule for `seed`:
 * 140 real hit slots (12 two-hit shields, 29 same-direction doubles, 58 singles) + 18 tomatoes.
 */
export function createBeatMap(seed: number, level: KnightLevel = LEVELS[1]): BeatMap {
   if (level.id !== 1) return createVariantBeatMap(seed, level);
   const rng: RngState = { s: (seed | 0) || 101 };
   const beatKind: Array<"single" | "shield1" | "shield2" | "double"> = new Array(BEAT.BEAT_COUNT).fill("single");

   const stageShieldTargets = [
      { start: 23, end: 49, count: 4 },
      { start: 50, end: 78, count: 4 },
      { start: 79, end: 110, count: 4 },
   ];
   for (const st of stageShieldTargets) {
      let placed = 0;
      const offset = rngInt(rng, 0, 2);
      for (let attempt = 0; attempt < 200 && placed < st.count; attempt++) {
         const b = attempt < 16 ? st.start + offset + attempt * 6 : rngInt(rng, st.start, st.end - 2);
         if (b + 1 >= st.end) continue;
         let ok = true;
         for (let k = Math.max(st.start, b - 2); k <= Math.min(st.end - 1, b + 3); k++) {
            if (beatKind[k] !== "single") {
               ok = false;
               break;
            }
         }
         if (ok) {
            beatKind[b] = "shield1";
            beatKind[b + 1] = "shield2";
            placed++;
         }
      }
   }

   const stageDoubleTargets = [
      { start: 50, end: 79, count: 13 },
      { start: 79, end: 111, count: 16 },
   ];
   for (const st of stageDoubleTargets) {
      const candidates: number[] = [];
      for (let b = st.start; b < st.end; b++) {
         if (beatKind[b] === "single") candidates.push(b);
      }
      for (let i = candidates.length - 1; i > 0; i--) {
         const j = rngInt(rng, 0, i);
         const tmp = candidates[i];
         candidates[i] = candidates[j];
         candidates[j] = tmp;
      }
      for (let i = 0; i < st.count && i < candidates.length; i++) {
         beatKind[candidates[i]] = "double";
      }
   }

   const beatPost: number[] = new Array(BEAT.BEAT_COUNT).fill(0);
   const beatDir: StrikeDir[] = new Array(BEAT.BEAT_COUNT).fill("up");
   const lastUsedBeatForPost = new Array(8).fill(-10);

   for (let b = 0; b < BEAT.BEAT_COUNT; b++) {
      const stage = b < 23 ? 1 : b < 50 ? 2 : b < 79 ? 3 : 4;
      const kind = beatKind[b];

      if (kind === "shield2") {
         const p = beatPost[b - 1];
         beatPost[b] = p;
         beatDir[b] = POSTS[p].direction;
         lastUsedBeatForPost[p] = b;
         continue;
      }

      if (kind === "double") {
         const validDirs = DIRECTIONS.filter((d) => {
            const di = dirToIndex(d);
            return b - lastUsedBeatForPost[di] >= 3 && b - lastUsedBeatForPost[di + 4] >= 3;
         });
         const fallbackDirs = validDirs.length > 0 ? validDirs : DIRECTIONS.filter((d) => {
            const di = dirToIndex(d);
            return b - lastUsedBeatForPost[di] >= 2 && b - lastUsedBeatForPost[di + 4] >= 2;
         });
         const chosenDir = pickFrom(rng, fallbackDirs.length > 0 ? fallbackDirs : DIRECTIONS);
         const di = dirToIndex(chosenDir);
         beatPost[b] = di;
         beatDir[b] = chosenDir;
         lastUsedBeatForPost[di] = b;
         lastUsedBeatForPost[di + 4] = b;
         continue;
      }

      const maxPost = stage === 1 ? 4 : 8;
      const validPosts: number[] = [];
      for (let p = 0; p < maxPost; p++) {
         if (b - lastUsedBeatForPost[p] >= 3) validPosts.push(p);
      }
      const fallbackPosts = validPosts.length > 0
         ? validPosts
         : Array.from({ length: maxPost }, (_, p) => p).filter((p) => b - lastUsedBeatForPost[p] >= 2);
      const chosenPost = pickFrom(rng, fallbackPosts.length > 0 ? fallbackPosts : [0]);
      beatPost[b] = chosenPost;
      beatDir[b] = POSTS[chosenPost].direction;
      lastUsedBeatForPost[chosenPost] = b;
   }

   const cues: TargetCue[] = [];
   let nextId = 0;
   let shieldGroupCount = 0;
   let doublePairCount = 0;

   const pushCue = (
      b: number, stageSpec: StageSpec, kind: TargetKind, post: PostSpec,
      shieldHitIndex: 1 | 2, shieldGroupId: number, doublePairId: number,
   ) => {
      const beatTimeMs = BEAT_TIMES_MS[b];
      cues.push({
         id: nextId++, beatIndex: b, stage: stageSpec.stage, kind,
         postIndex: post.index, direction: post.direction, ring: post.ring, beatTimeMs,
         spawnTimeMs: Math.max(0, beatTimeMs - TIMING.LEAD_BEATS * stageSpec.periodMs),
         expireTimeMs: beatTimeMs + TIMING.ACTIVE_WINDOW_MS,
         shieldHitIndex, shieldGroupId, doublePairId, originPostIndex: -1, status: "pending", hitGrade: "none",
      });
   };

   for (let b = 0; b < BEAT.BEAT_COUNT; b++) {
      const stageSpec = b < 23 ? STAGES[0] : b < 50 ? STAGES[1] : b < 79 ? STAGES[2] : STAGES[3];
      const kind = beatKind[b];
      if (kind === "double") {
         const pairId = doublePairCount++;
         const di = dirToIndex(beatDir[b]);
         pushCue(b, stageSpec, "regular", POSTS[di], 1, -1, pairId);
         pushCue(b, stageSpec, "regular", POSTS[di + 4], 1, -1, pairId);
      } else if (kind === "shield1" || kind === "shield2") {
         const groupId = kind === "shield1" ? shieldGroupCount++ : shieldGroupCount - 1;
         pushCue(b, stageSpec, "shield", POSTS[beatPost[b]], kind === "shield1" ? 1 : 2, groupId, -1);
      } else {
         pushCue(b, stageSpec, "regular", POSTS[beatPost[b]], 1, -1, -1);
      }
   }

   const stageTomatoTargets = [
      { start: 50, end: 79, count: 9 },
      { start: 79, end: 111, count: 9 },
   ];
   const tomatoBeatUsed = new Set<number>();
   let tomatoCount = 0;

   for (const st of stageTomatoTargets) {
      const beatOrder: number[] = [];
      for (let b = st.start; b < st.end; b++) beatOrder.push(b);
      for (let i = beatOrder.length - 1; i > 0; i--) {
         const j = rngInt(rng, 0, i);
         const tmp = beatOrder[i];
         beatOrder[i] = beatOrder[j];
         beatOrder[j] = tmp;
      }

      let placedInStage = 0;
      for (const b of beatOrder) {
         if (placedInStage >= st.count) break;
         if (tomatoBeatUsed.has(b)) continue;
         const beatTimeMs = BEAT_TIMES_MS[b];
         const stageSpec = b < 79 ? STAGES[2] : STAGES[3];

         const findSafePosts = (postBeatGap: number): number[] => {
            const safe: number[] = [];
            for (let p = 0; p < 8; p++) {
               const dir = POSTS[p].direction;
               let dirSafe = true;
               let postSafe = true;
               for (const c of cues) {
                  if (c.kind !== "tomato" && c.direction === dir && Math.abs(c.beatTimeMs - beatTimeMs) <= TIMING.TOMATO_CLEARANCE_MS) {
                     dirSafe = false;
                     break;
                  }
                  if (c.postIndex === p && Math.abs(c.beatIndex - b) <= postBeatGap) {
                     postSafe = false;
                  }
               }
               if (dirSafe && postSafe) safe.push(p);
            }
            return safe;
         };

         const safePosts = findSafePosts(2).length > 0 ? findSafePosts(2) : findSafePosts(1);
         if (safePosts.length > 0) {
            const p = pickFrom(rng, safePosts);
            tomatoBeatUsed.add(b);
            placedInStage++;
            tomatoCount++;
            pushCue(b, stageSpec, "tomato", POSTS[p], 1, -1, -1);
         }
      }
   }

   cues.sort((a, b) => a.beatTimeMs - b.beatTimeMs || a.id - b.id);
   return {
      seed, cues,
      realSlotCount: cues.filter((c) => c.kind !== "tomato").length,
      shieldCount: shieldGroupCount, doubleCount: doublePairCount, tomatoCount,
      beatCount: BEAT.BEAT_COUNT, comboStep: COMBO.STEP_HITS, stages: STAGES, beatTimesMs: BEAT_TIMES_MS,
   };
}

/** Beats stay at least this far from a 15 s stage boundary, so a ±200 ms window never crosses it. */
export const BOUNDARY_GAP_MS = 280;
const FIRST_BEAT_MS = 1500;
const LAST_BEAT_MS = 59_600;

/**
 * Levels 2-5: four 15 s stages, each beat on that stage's BPM, first beat at 1.5 s, last ≤ 59.6 s.
 * Level 1 does not use this (its grid is the frozen STAGES).
 */
export function buildVariantSchedule(bpm: readonly [number, number, number, number]): { stages: StageSpec[]; beatTimesMs: number[] } {
   const stages: StageSpec[] = [];
   const beatTimesMs: number[] = [];
   let last: number | null = null;
   let beatIndex = 0;
   for (let i = 0; i < 4; i++) {
      const periodMs = 60_000 / bpm[i];
      const startMs = i * 15_000;
      const endMs = (i + 1) * 15_000;
      let t = last === null ? FIRST_BEAT_MS : last + periodMs;
      const minT = i === 0 ? FIRST_BEAT_MS : startMs + BOUNDARY_GAP_MS;
      while (t < minT) t += periodMs;
      const firstBeatMs = t;
      const startBeatIndex = beatIndex;
      let count = 0;
      while (t <= endMs - BOUNDARY_GAP_MS && t <= LAST_BEAT_MS) {
         beatTimesMs.push(t);
         count++;
         t += periodMs;
      }
      last = beatTimesMs[beatTimesMs.length - 1];
      stages.push({
         stage: (i + 1) as 1 | 2 | 3 | 4,
         startMs, endMs, bpm: bpm[i], periodMs, beatCount: count, startBeatIndex, firstBeatMs,
      });
      beatIndex += count;
   }
   return { stages, beatTimesMs };
}

function stageSpecAtBeat(stages: readonly StageSpec[], beatIndex: number): StageSpec {
   for (let i = stages.length - 1; i >= 0; i--) {
      if (beatIndex >= stages[i].startBeatIndex) return stages[i];
   }
   return stages[0];
}

/** Levels 2-5. Same placer as level 1, with the level's grid and caps. */
function createVariantBeatMap(seed: number, level: KnightLevel): BeatMap {
   const rng: RngState = { s: (seed | 0) || 101 };
   const { stages, beatTimesMs } = buildVariantSchedule(level.bpm);
   const beatCount = beatTimesMs.length;
   const beatKind: Array<"single" | "shield1" | "shield2" | "double"> = new Array(beatCount).fill("single");
   const stageStart = stages.map((s) => s.startBeatIndex);
   const stageEnd = stages.map((s) => s.startBeatIndex + s.beatCount);

   for (let i = 1; i <= 3; i++) {
      const count = level.shields[i - 1];
      if (count <= 0) continue;
      const start = stageStart[i];
      const end = stageEnd[i] - 1;
      let placed = 0;
      const offset = rngInt(rng, 0, 2);
      for (let attempt = 0; attempt < 200 && placed < count; attempt++) {
         const b = attempt < 16 ? start + offset + attempt * 6 : rngInt(rng, start, end - 2);
         if (b + 1 >= end) continue;
         let ok = true;
         for (let k = Math.max(start, b - 2); k <= Math.min(end - 1, b + 3); k++) {
            if (beatKind[k] !== "single") {
               ok = false;
               break;
            }
         }
         if (ok) {
            beatKind[b] = "shield1";
            beatKind[b + 1] = "shield2";
            placed++;
         }
      }
   }

   for (let i = 1; i <= 3; i++) {
      const count = level.doubles[i - 1];
      if (count <= 0) continue;
      const candidates: number[] = [];
      for (let b = stageStart[i]; b < stageEnd[i]; b++) {
         if (beatKind[b] === "single") candidates.push(b);
      }
      for (let n = candidates.length - 1; n > 0; n--) {
         const j = rngInt(rng, 0, n);
         const tmp = candidates[n];
         candidates[n] = candidates[j];
         candidates[j] = tmp;
      }
      for (let n = 0; n < count && n < candidates.length; n++) beatKind[candidates[n]] = "double";
   }

   const beatPost: number[] = new Array(beatCount).fill(0);
   const beatDir: StrikeDir[] = new Array(beatCount).fill("up");
   const beatOrigin: number[] = new Array(beatCount).fill(-1);
   const lastUsedBeatForPost = new Array(8).fill(-10);

   for (let b = 0; b < beatCount; b++) {
      const kind = beatKind[b];
      if (kind === "shield2") {
         const p = beatPost[b - 1];
         beatPost[b] = p;
         beatDir[b] = POSTS[p].direction;
         lastUsedBeatForPost[p] = b;
         continue;
      }
      if (kind === "double") {
         const validDirs = DIRECTIONS.filter((d) => {
            const di = dirToIndex(d);
            return b - lastUsedBeatForPost[di] >= 3 && b - lastUsedBeatForPost[di + 4] >= 3;
         });
         const fallbackDirs = validDirs.length > 0 ? validDirs : DIRECTIONS.filter((d) => {
            const di = dirToIndex(d);
            return b - lastUsedBeatForPost[di] >= 2 && b - lastUsedBeatForPost[di + 4] >= 2;
         });
         const chosenDir = pickFrom(rng, fallbackDirs.length > 0 ? fallbackDirs : DIRECTIONS);
         const di = dirToIndex(chosenDir);
         beatPost[b] = di;
         beatDir[b] = chosenDir;
         lastUsedBeatForPost[di] = b;
         lastUsedBeatForPost[di + 4] = b;
         continue;
      }
      const maxPost = b >= level.farFromBeat ? 8 : 4;
      const validPosts: number[] = [];
      for (let p = 0; p < maxPost; p++) {
         if (b - lastUsedBeatForPost[p] >= 3) validPosts.push(p);
      }
      const fallbackPosts = validPosts.length > 0
         ? validPosts
         : Array.from({ length: maxPost }, (_, p) => p).filter((p) => b - lastUsedBeatForPost[p] >= 2);
      const chosenPost = pickFrom(rng, fallbackPosts.length > 0 ? fallbackPosts : [0]);
      beatPost[b] = chosenPost;
      beatDir[b] = POSTS[chosenPost].direction;
      if (level.moving && chosenPost >= 4) beatOrigin[b] = chosenPost - 4;
      lastUsedBeatForPost[chosenPost] = b;
   }

   const cues: TargetCue[] = [];
   let nextId = 0;
   let shieldGroupCount = 0;
   let doublePairCount = 0;

   const pushCue = (
      b: number, kind: TargetKind, post: PostSpec,
      shieldHitIndex: 1 | 2, shieldGroupId: number, doublePairId: number, originPostIndex: number,
   ) => {
      const stageSpec = stageSpecAtBeat(stages, b);
      const beatTimeMs = beatTimesMs[b];
      cues.push({
         id: nextId++, beatIndex: b, stage: stageSpec.stage, kind,
         postIndex: post.index, direction: post.direction, ring: post.ring, beatTimeMs,
         spawnTimeMs: Math.max(0, beatTimeMs - TIMING.LEAD_BEATS * stageSpec.periodMs),
         expireTimeMs: beatTimeMs + TIMING.ACTIVE_WINDOW_MS,
         shieldHitIndex, shieldGroupId, doublePairId, originPostIndex, status: "pending", hitGrade: "none",
      });
   };

   for (let b = 0; b < beatCount; b++) {
      const kind = beatKind[b];
      if (kind === "double") {
         const pairId = doublePairCount++;
         const di = dirToIndex(beatDir[b]);
         pushCue(b, "regular", POSTS[di], 1, -1, pairId, -1);
         pushCue(b, "regular", POSTS[di + 4], 1, -1, pairId, -1);
      } else if (kind === "shield1" || kind === "shield2") {
         const groupId = kind === "shield1" ? shieldGroupCount++ : shieldGroupCount - 1;
         pushCue(b, "shield", POSTS[beatPost[b]], kind === "shield1" ? 1 : 2, groupId, -1, -1);
      } else {
         pushCue(b, "regular", POSTS[beatPost[b]], 1, -1, -1, beatOrigin[b]);
      }
   }

   const tomatoBeatUsed = new Set<number>();
   let tomatoCount = 0;
   for (let i = 1; i <= 3; i++) {
      const count = level.tomatoes[i - 1];
      if (count <= 0) continue;
      const beatOrder: number[] = [];
      for (let b = stageStart[i]; b < stageEnd[i]; b++) beatOrder.push(b);
      for (let n = beatOrder.length - 1; n > 0; n--) {
         const j = rngInt(rng, 0, n);
         const tmp = beatOrder[n];
         beatOrder[n] = beatOrder[j];
         beatOrder[j] = tmp;
      }
      let placedInStage = 0;
      for (const b of beatOrder) {
         if (placedInStage >= count) break;
         if (tomatoBeatUsed.has(b)) continue;
         const beatTimeMs = beatTimesMs[b];
         const findSafePosts = (postBeatGap: number): number[] => {
            const safe: number[] = [];
            for (let p = 0; p < 8; p++) {
               const dir = POSTS[p].direction;
               let dirSafe = true;
               let postSafe = true;
               for (const c of cues) {
                  if (c.kind !== "tomato" && c.direction === dir && Math.abs(c.beatTimeMs - beatTimeMs) <= TIMING.TOMATO_CLEARANCE_MS) {
                     dirSafe = false;
                     break;
                  }
                  if (c.postIndex === p && Math.abs(c.beatIndex - b) <= postBeatGap) postSafe = false;
               }
               if (dirSafe && postSafe) safe.push(p);
            }
            return safe;
         };
         const safePosts = findSafePosts(2).length > 0 ? findSafePosts(2) : findSafePosts(1);
         if (safePosts.length > 0) {
            const p = pickFrom(rng, safePosts);
            tomatoBeatUsed.add(b);
            placedInStage++;
            tomatoCount++;
            pushCue(b, "tomato", POSTS[p], 1, -1, -1, -1);
         }
      }
   }

   cues.sort((a, b) => a.beatTimeMs - b.beatTimeMs || a.id - b.id);
   return {
      seed, cues,
      realSlotCount: cues.filter((c) => c.kind !== "tomato").length,
      shieldCount: shieldGroupCount, doubleCount: doublePairCount, tomatoCount,
      beatCount, comboStep: level.comboStep, stages, beatTimesMs,
   };
}

/** Where a cue's marker is drawn at `nowMs` (level 1: the post itself). `out` is reused. */
export function travelXZ(cue: TargetCue, nowMs: number, out: { x: number; z: number }): void {
   const post = POSTS[cue.postIndex];
   if (cue.originPostIndex < 0) {
      out.x = post.x;
      out.z = post.z;
      return;
   }
   const origin = POSTS[cue.originPostIndex];
   const lead = Math.max(1, cue.beatTimeMs - cue.spawnTimeMs);
   const u = Math.max(0, Math.min(1, (nowMs - cue.spawnTimeMs) / lead));
   out.x = origin.x + (post.x - origin.x) * u;
   out.z = origin.z + (post.z - origin.z) * u;
}

/**
 * Computes the exact theoretical maximum score on `map` (all 140 real slots hit on-beat,
 * optimal spin activations via dynamic programming over the 111 beats).
 */
export function solveOptimalSpinSchedule(map: BeatMap): { maxScore: number; spinBeats: Set<number> } {
   const B = map.beatCount;
   const slotsOnBeat = new Int32Array(B);
   for (const c of map.cues) {
      if (c.kind !== "tomato") slotsOnBeat[c.beatIndex]++;
   }

   let baseHitScore = 0;
   for (let s = 1; s <= map.realSlotCount; s++) {
      baseHitScore += SCORING.ON_BEAT_PTS * comboForStreak(s, map.comboStep);
   }

   const dp = Array.from({ length: B + 1 }, () => new Int32Array(101).fill(-1));
   const choice = Array.from({ length: B }, () => new Uint8Array(101));
   for (let m = 0; m <= 100; m++) dp[B][m] = 0;

   for (let b = B - 1; b >= 0; b--) {
      const c = slotsOnBeat[b];
      for (let m = 0; m <= 100; m++) {
         const nextManual = Math.min(SPIN.MAX_METER, m + SPIN.ON_BEAT_CHARGE * c);
         let best = dp[b + 1][nextManual];
         let act = 0;
         if (m === SPIN.MAX_METER && c > 0) {
            const spinVal = SCORING.SPIN_BONUS_PTS + dp[b + 1][0];
            if (spinVal >= best) {
               best = spinVal;
               act = 1;
            }
         }
         dp[b][m] = best;
         choice[b][m] = act;
      }
   }

   const spinBeats = new Set<number>();
   let m = 0;
   for (let b = 0; b < B; b++) {
      const c = slotsOnBeat[b];
      if (choice[b][m] === 1 && m === SPIN.MAX_METER && c > 0) {
         spinBeats.add(b);
         m = 0;
      } else {
         m = Math.min(SPIN.MAX_METER, m + SPIN.ON_BEAT_CHARGE * c);
      }
   }

   return { maxScore: baseHitScore + dp[0][0], spinBeats };
}

export function perfectScore(map: BeatMap): number {
   return solveOptimalSpinSchedule(map).maxScore;
}

/**
 * Map-independent score ceiling: every real slot on-beat in one streak, plus SPIN_BONUS_PTS for
 * each spin a run can charge (ceil(100 / 15) = 7 charging hits, plus ≥ 1 cleared slot that charges
 * nothing, so 8 slots per paid spin). Level 1 is scoreCeiling() (140 slots, step 8) = 11090.
 */
export function scoreCeilingFor(slots: number, comboStep: number = COMBO.STEP_HITS): number {
   let hits = 0;
   for (let s = 1; s <= slots; s++) hits += SCORING.ON_BEAT_PTS * comboForStreak(s, comboStep);
   const perSpin = Math.ceil(SPIN.MAX_METER / SPIN.ON_BEAT_CHARGE) + 1;
   return hits + Math.floor(slots / perSpin) * SCORING.SPIN_BONUS_PTS;
}

export function scoreCeiling(): number {
   return scoreCeilingFor(BEAT.MAX_HIT_SLOTS, COMBO.STEP_HITS);
}

/**
 * Proposed server limits, one set per level (README "Levels"). Level 1 is meta.scoring.
 * maxScore = ceil(ceiling * 1.04 / 100) * 100. pps = ceil(maxScore / 58) so the rate line
 * never binds inside 58-62 s (base 0). Claude copies levels 2-5 into arcade-games.json.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: ceiling 11090. Today's limits, unchanged. */
   1: {
      kind: "points", maxScore: 11600, minDurationMs: 58000, maxDurationMs: 62000,
      base: 0, maxPointsPerSec: 200, unitLabel: "pts", display: "int",
   },
   /** L2: 145 slots, step 8. Hits 10640 + spins 900 = 11540. */
   2: {
      kind: "points", maxScore: 12100, minDurationMs: 58000, maxDurationMs: 62000,
      base: 0, maxPointsPerSec: 209, unitLabel: "pts", display: "int",
   },
   /** L3: 156 slots, step 8. Hits 11520 + spins 950 = 12470. */
   3: {
      kind: "points", maxScore: 13000, minDurationMs: 58000, maxDurationMs: 62000,
      base: 0, maxPointsPerSec: 225, unitLabel: "pts", display: "int",
   },
   /** L4: 163 slots, step 6. Hits 12320 + spins 1000 = 13320. Recomputed if the slot count moves. */
   4: {
      kind: "points", maxScore: 13900, minDurationMs: 58000, maxDurationMs: 62000,
      base: 0, maxPointsPerSec: 240, unitLabel: "pts", display: "int",
   },
   /** L5: 176 slots, step 6. Hits 13360 + spins 1100 = 14460. */
   5: {
      kind: "points", maxScore: 15100, minDurationMs: 58000, maxDurationMs: 62000,
      base: 0, maxPointsPerSec: 261, unitLabel: "pts", display: "int",
   },
};

export interface RunInput { strikeDir: StrikeDir | null; spin: boolean; }

export interface RunEvent {
   kind: "hit" | "shieldCrack" | "spinSweep" | "tomatoHit" | "whiff" | "miss";
   postIndex: number; direction: StrikeDir; points: number; onBeat: boolean;
}

export interface RunState {
   seed: number; map: BeatMap; level: KnightLevel;
   stages: readonly StageSpec[]; beatTimesMs: readonly number[];
   durationMs: number; onBeatWindowMs: number; comboStep: number;
   timeMs: number; score: number;
   streak: number; combo: number; maxCombo: number; spinMeter: number;
   stage: 1 | 2 | 3 | 4; bpm: number; knightYaw: number; targetYaw: number;
   swingDir: StrikeDir; swingTimerS: number; swingIsFar: boolean; swingPostYaw: number;
   spinTimerS: number; postWobble: SpringState[];
   shieldCrackedGroups: Set<number>; shieldExpiredGroups: Set<number>;
   hitsOnBeat: number; hitsOffBeat: number; misses: number; whiffs: number;
   tomatoesHit: number; spinsUsed: number; finished: boolean; events: RunEvent[];
}

export function createRun(seed: number = BEAT.MAP_SEEDS[0], level: KnightLevel = LEVELS[1]): RunState {
   const map = createBeatMap(seed, level);
   return {
      seed, map, level, stages: map.stages, beatTimesMs: map.beatTimesMs,
      durationMs: level.durationMs, onBeatWindowMs: level.onBeatWindowMs, comboStep: level.comboStep,
      timeMs: 0, score: 0, streak: 0, combo: 1, maxCombo: 1, spinMeter: 0,
      stage: 1, bpm: level.bpm[0], knightYaw: Math.PI, targetYaw: Math.PI,
      swingDir: "up", swingTimerS: 0, swingIsFar: false, swingPostYaw: Math.PI, spinTimerS: 0,
      postWobble: Array.from({ length: 8 }, () => ({ x: 0, v: 0 })),
      shieldCrackedGroups: new Set<number>(), shieldExpiredGroups: new Set<number>(),
      hitsOnBeat: 0, hitsOffBeat: 0, misses: 0, whiffs: 0, tomatoesHit: 0, spinsUsed: 0,
      finished: false, events: [],
   };
}

export function createRunState(seed: number = BEAT.MAP_SEEDS[0], level: KnightLevel = LEVELS[1]): RunState {
   return createRun(seed, level);
}

function stageOf(run: RunState, timeMs: number): StageSpec {
   const stages = run.stages;
   if (timeMs < stages[1].startMs) return stages[0];
   if (timeMs < stages[2].startMs) return stages[1];
   if (timeMs < stages[3].startMs) return stages[2];
   return stages[3];
}

function isCueUnlocked(run: RunState, cue: TargetCue): boolean {
   if (cue.kind === "shield" && cue.shieldHitIndex === 2) {
      return run.shieldCrackedGroups.has(cue.shieldGroupId) && !run.shieldExpiredGroups.has(cue.shieldGroupId);
   }
   return true;
}

function isCueActiveAt(run: RunState, cue: TargetCue, judgeMs: number): boolean {
   if (cue.status !== "pending" || !isCueUnlocked(run, cue)) return false;
   return Math.abs(judgeMs - cue.beatTimeMs) <= TIMING.ACTIVE_WINDOW_MS;
}

/**
 * Steps the knight-arena run state by `dt` seconds (`time` is cumulative run time in seconds).
 * Evaluates strike timing against frame midpoint `tJudgeMs = (time - dt * 0.5) * 1000`.
 */
export function stepRun(run: RunState, input: RunInput, dt: number, time: number): void {
   run.events.length = 0;
   if (run.finished || dt <= 0) return;

   const nowMs = time * 1000;
   const judgeMs = Math.max(0, (time - dt * 0.5) * 1000);
   run.timeMs = nowMs;

   const stageSpec = stageOf(run, nowMs);
   run.stage = stageSpec.stage;
   run.bpm = stageSpec.bpm;

   if (run.swingTimerS > 0) run.swingTimerS = Math.max(0, run.swingTimerS - dt);
   if (run.spinTimerS > 0) run.spinTimerS = Math.max(0, run.spinTimerS - dt);
   run.knightYaw = turnTowards(run.knightYaw, run.targetYaw, Math.min(1, KNIGHT.TURN_RATE_RAD_S * dt));
   for (let p = 0; p < 8; p++) spring(run.postWobble[p], 0, TARGETS.WOBBLE_STIFFNESS, TARGETS.WOBBLE_DAMPING, dt);

   let spinTriggeredThisFrame = false;
   if (input.spin && run.spinMeter >= SPIN.MAX_METER) {
      spinTriggeredThisFrame = true;
      run.spinMeter = 0;
      run.spinTimerS = SPIN.DURATION_S;
      run.spinsUsed += 1;
      const activeReal = run.map.cues.filter((cue) => cue.kind !== "tomato" && isCueActiveAt(run, cue, judgeMs));
      let spinPoints = 0;
      for (const cue of activeReal) {
         cue.status = "hit";
         cue.hitGrade = "spin";
         if (cue.kind === "shield" && cue.shieldHitIndex === 1) run.shieldCrackedGroups.add(cue.shieldGroupId);
         run.streak += 1;
         run.combo = comboForStreak(run.streak, run.comboStep);
         if (run.combo > run.maxCombo) run.maxCombo = run.combo;
         run.hitsOnBeat += 1;
         spinPoints += SCORING.SPIN_HIT_PTS * run.combo;
         run.postWobble[cue.postIndex].x = TARGETS.WOBBLE_HIT_IMPULSE_RAD;
      }
      if (activeReal.length > 0) {
         spinPoints += SCORING.SPIN_BONUS_PTS;
         run.score += spinPoints;
         run.events.push({ kind: "spinSweep", postIndex: activeReal[0].postIndex, direction: activeReal[0].direction, points: spinPoints, onBeat: true });
      }
   }

   if (input.strikeDir !== null && !spinTriggeredThisFrame) {
      const dir = input.strikeDir;
      run.swingDir = dir;
      run.swingTimerS = KNIGHT.SWING_DURATION_S;
      const candidates = run.map.cues.filter(
         (cue) => cue.direction === dir && cue.status === "pending" && isCueUnlocked(run, cue) && Math.abs(judgeMs - cue.beatTimeMs) <= TIMING.ACTIVE_WINDOW_MS,
      );
      if (candidates.length === 0) {
         const postIdx = dirToIndex(dir);
         run.targetYaw = POSTS[postIdx].rayYaw;
         run.swingPostYaw = POSTS[postIdx].rayYaw;
         run.swingIsFar = false;
         run.streak = 0;
         run.combo = 1;
         run.whiffs += 1;
         run.events.push({ kind: "whiff", postIndex: postIdx, direction: dir, points: 0, onBeat: false });
      } else {
         candidates.sort((a, b) => a.beatTimeMs - b.beatTimeMs || a.id - b.id);
         const primary = candidates[0];
         const targetsToHit = primary.doublePairId >= 0 ? candidates.filter((c) => c.doublePairId === primary.doublePairId) : [primary];
         const onBeat = Math.abs(judgeMs - primary.beatTimeMs) <= run.onBeatWindowMs;
         const aimPost = POSTS[targetsToHit[targetsToHit.length - 1].postIndex];
         run.targetYaw = aimPost.rayYaw;
         run.swingPostYaw = aimPost.rayYaw;
         run.swingIsFar = targetsToHit.some((c) => c.ring === "far");

         if (primary.kind === "tomato") {
            primary.status = "hit";
            primary.hitGrade = "offBeat";
            run.score = Math.max(0, run.score - SCORING.TOMATO_PENALTY_PTS);
            run.streak = 0;
            run.combo = 1;
            run.tomatoesHit += 1;
            run.postWobble[primary.postIndex].x = TARGETS.WOBBLE_HIT_IMPULSE_RAD;
            run.events.push({ kind: "tomatoHit", postIndex: primary.postIndex, direction: dir, points: -SCORING.TOMATO_PENALTY_PTS, onBeat: false });
         } else {
            for (const cue of targetsToHit) {
               cue.status = "hit";
               cue.hitGrade = onBeat ? "onBeat" : "offBeat";
               if (cue.kind === "shield" && cue.shieldHitIndex === 1) run.shieldCrackedGroups.add(cue.shieldGroupId);
               run.streak += 1;
               run.combo = comboForStreak(run.streak, run.comboStep);
               if (run.combo > run.maxCombo) run.maxCombo = run.combo;
               if (onBeat) run.hitsOnBeat += 1;
               else run.hitsOffBeat += 1;
               const pts = (onBeat ? SCORING.ON_BEAT_PTS : SCORING.OFF_BEAT_PTS) * run.combo;
               run.score += pts;
               run.spinMeter = Math.min(SPIN.MAX_METER, run.spinMeter + (onBeat ? SPIN.ON_BEAT_CHARGE : SPIN.OFF_BEAT_CHARGE));
               run.postWobble[cue.postIndex].x = TARGETS.WOBBLE_HIT_IMPULSE_RAD;
               run.events.push({ kind: cue.kind === "shield" && cue.shieldHitIndex === 1 ? "shieldCrack" : "hit", postIndex: cue.postIndex, direction: dir, points: pts, onBeat });
            }
         }
      }
   }

   for (const cue of run.map.cues) {
      if (cue.status !== "pending") continue;
      if (cue.kind === "shield" && cue.shieldHitIndex === 2 && run.shieldExpiredGroups.has(cue.shieldGroupId)) {
         cue.status = "expired";
         continue;
      }
      if (nowMs > cue.expireTimeMs) {
         cue.status = "expired";
         if (cue.kind === "tomato") continue;
         if (cue.kind === "shield" && cue.shieldHitIndex === 1) run.shieldExpiredGroups.add(cue.shieldGroupId);
         run.streak = 0;
         run.combo = 1;
         run.misses += 1;
         run.events.push({ kind: "miss", postIndex: cue.postIndex, direction: cue.direction, points: 0, onBeat: false });
      }
   }
   if (nowMs >= run.durationMs) run.finished = true;
}
