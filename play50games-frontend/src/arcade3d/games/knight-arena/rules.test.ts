import { describe, expect, it } from "vitest";
import { createRng, rngNext, type RngState } from "../../core/math";
import { fixedFrames, simulateRun } from "../../core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "../../core/useArcadeStore";
import {
   ARENA,
   BEAT,
   BEAT_TIMES_MS,
   COMBO,
   comboForStreak,
   createBeatMap,
   createRunState,
   DIRECTIONS,
   KNIGHT,
   perfectScore,
   POSTS,
   PROPOSED_LIMITS,
   SCORING,
   solveOptimalSpinSchedule,
   SPIN,
   STAGES,
   stepRun,
   TARGETS,
   TIMING,
} from "./rules";

function rngNormal(rng: () => number, mean = 0, std = 1): number {
   const u1 = Math.max(1e-9, rng());
   const u2 = rng();
   const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
   return mean + z0 * std;
}

function withinProposedLimits(finalState: ArcadeStore): boolean {
   const dur = finalState.elapsedMs;
   if (dur < PROPOSED_LIMITS.minDurationMs || dur > PROPOSED_LIMITS.maxDurationMs) return false;
   if (finalState.score < 0 || finalState.score > PROPOSED_LIMITS.maxScore) return false;
   const rateCap = PROPOSED_LIMITS.rateLimits.base + (dur / 1000) * PROPOSED_LIMITS.rateLimits.maxPointsPerSec;
   return finalState.score <= rateCap;
}

function capScoreWithLimits(score: number, durationMs: number): number {
   if (durationMs < PROPOSED_LIMITS.minDurationMs || durationMs > PROPOSED_LIMITS.maxDurationMs) return 0;
   const rateCap = Math.floor(
      PROPOSED_LIMITS.rateLimits.base + (durationMs / 1000) * PROPOSED_LIMITS.rateLimits.maxPointsPerSec,
   );
   return Math.max(0, Math.min(score, PROPOSED_LIMITS.maxScore, rateCap));
}

function runOracleOnStore(seed: number, frameMs: number): ArcadeStore {
   const state = createRunState(seed);
   const { spinBeats } = solveOptimalSpinSchedule(state.map);
   const handledBeats = new Set<number>();

   return simulateRun(createArcadeStore(), {
      durationMs: BEAT.DURATION_MS,
      frame: fixedFrames(frameMs),
      step: (dt, time, store) => {
         const judgeMs = Math.max(0, (time - dt * 0.5) * 1000);
         let strikeDir: (typeof DIRECTIONS)[number] | null = null;
         let spin = false;

         for (const cue of state.map.cues) {
            if (cue.kind === "tomato" || cue.status !== "pending") continue;
            if (handledBeats.has(cue.beatIndex)) continue;
            const dJudge = Math.abs(judgeMs - cue.beatTimeMs);
            if (dJudge <= TIMING.ON_BEAT_WINDOW_MS) {
               handledBeats.add(cue.beatIndex);
               if (spinBeats.has(cue.beatIndex) && state.spinMeter >= SPIN.MAX_METER) {
                  spin = true;
               } else {
                  strikeDir = cue.direction;
               }
               break;
            }
         }

         stepRun(state, { strikeDir, spin }, dt, time);
         const s = store.getState();
         s.setScore(state.score);
      },
   });
}

describe("knight-arena rules and bot verification", () => {
   it("pins arena, knight, post layout, timing, combo, spin, and scoring constants", () => {
      expect(ARENA.RADIUS_M).toBe(3.5);
      expect(ARENA.SIDES).toBe(8);
      expect(KNIGHT.HEIGHT_M).toBe(1.75);
      expect(KNIGHT.RADIUS_M).toBe(0.40);
      expect(KNIGHT.LUNGE_STEP_M).toBe(1.00);
      expect(KNIGHT.SWING_DURATION_S).toBe(0.25);

      expect(TIMING.LEAD_BEATS).toBe(2);
      expect(TIMING.ACTIVE_WINDOW_MS).toBe(200);
      expect(TIMING.ON_BEAT_WINDOW_MS).toBe(110);

      expect(COMBO.STEP_HITS).toBe(8);
      expect(COMBO.MAX_MULTIPLIER).toBe(4);
      expect(SPIN.MAX_METER).toBe(100);
      expect(SPIN.ON_BEAT_CHARGE).toBe(15);
      expect(SPIN.OFF_BEAT_CHARGE).toBe(10);
      expect(SPIN.BONUS_PTS).toBe(50);
      expect(SPIN.DURATION_S).toBe(0.40);

      expect(SCORING.ON_BEAT_PTS).toBe(20);
      expect(SCORING.OFF_BEAT_PTS).toBe(10);
      expect(SCORING.SPIN_HIT_PTS).toBe(20);
      expect(SCORING.SPIN_BONUS_PTS).toBe(50);
      expect(SCORING.TOMATO_PENALTY_PTS).toBe(50);

      expect(POSTS).toHaveLength(8);
      for (let i = 0; i < 4; i++) {
         const near = POSTS[i];
         const far = POSTS[i + 4];
         expect(near.ring).toBe("near");
         expect(far.ring).toBe("far");
         expect(Math.hypot(near.x, near.z)).toBeCloseTo(TARGETS.NEAR_RADIUS_M, 5);
         expect(Math.hypot(far.x, far.z)).toBeCloseTo(TARGETS.FAR_RADIUS_M, 5);
         for (let j = 0; j < 4; j++) {
            const diff = Math.abs(Math.atan2(Math.sin(far.rayYaw - POSTS[j].rayYaw), Math.cos(far.rayYaw - POSTS[j].rayYaw)));
            expect(diff).toBeGreaterThan(0.35);
         }
      }
   });

   it("verifies beat schedule invariants across 1,000 seeds", () => {
      expect(BEAT.BEAT_COUNT).toBe(111);
      expect(BEAT_TIMES_MS).toHaveLength(111);
      expect(STAGES.reduce((acc, s) => acc + s.beatCount, 0)).toBe(111);

      for (let i = 0; i < BEAT_TIMES_MS.length; i++) {
         const t = BEAT_TIMES_MS[i];
         expect(t).toBeGreaterThanOrEqual(1500);
         expect(t).toBeLessThanOrEqual(59_600);
         expect(t).not.toBeCloseTo(15_000, 1);
         expect(t).not.toBeCloseTo(30_000, 1);
         expect(t).not.toBeCloseTo(45_000, 1);
         if (i > 0) expect(t).toBeGreaterThan(BEAT_TIMES_MS[i - 1]);
      }

      for (let seed = 1; seed <= 1000; seed++) {
         const map = createBeatMap(seed);
         expect(map.realSlotCount).toBe(BEAT.MAX_HIT_SLOTS);
         expect(map.shieldCount).toBe(BEAT.MAX_SHIELDS);
         expect(map.doubleCount).toBe(BEAT.MAX_DOUBLES);
         expect(map.tomatoCount).toBe(BEAT.TOMATO_COUNT);

         const pairs = new Map<number, typeof map.cues>();
         for (const c of map.cues) {
            expect(c.beatTimeMs).toBeLessThanOrEqual(59_600);
            expect(c.expireTimeMs).toBeLessThanOrEqual(59_800);
            if (c.doublePairId >= 0) {
               const list = pairs.get(c.doublePairId) ?? [];
               list.push(c);
               pairs.set(c.doublePairId, list);
            }
         }
         expect(pairs.size).toBe(29);
         for (const [, list] of pairs) {
            expect(list).toHaveLength(2);
            expect(list[0].direction).toBe(list[1].direction);
            expect(list[0].beatTimeMs).toBe(list[1].beatTimeMs);
            expect(new Set([list[0].ring, list[1].ring])).toEqual(new Set(["near", "far"]));
         }

         const tomatoes = map.cues.filter((c) => c.kind === "tomato");
         expect(tomatoes).toHaveLength(18);
         for (const tom of tomatoes) {
            for (const c of map.cues) {
               if (c.kind !== "tomato" && c.direction === tom.direction) {
                  expect(Math.abs(c.beatTimeMs - tom.beatTimeMs)).toBeGreaterThan(TIMING.TOMATO_CLEARANCE_MS);
               }
            }
         }
      }
   });

   it("enforces exact timing boundaries (110/111/200/201 ms), combo steps (9/17/25), shields, doubles, tomatoes, and spin", () => {
      expect(comboForStreak(0)).toBe(1);
      expect(comboForStreak(1)).toBe(1);
      expect(comboForStreak(8)).toBe(1);
      expect(comboForStreak(9)).toBe(2);
      expect(comboForStreak(16)).toBe(2);
      expect(comboForStreak(17)).toBe(3);
      expect(comboForStreak(24)).toBe(3);
      expect(comboForStreak(25)).toBe(4);
      expect(comboForStreak(140)).toBe(4);

      // 110 ms -> on-beat (+20, +15 spinMeter)
      const r110 = createRunState(101);
      const cue0 = r110.map.cues[0];
      const dt = 0.002; // midpoint = time - 0.001 s = timeMs - 1 ms
      stepRun(r110, { strikeDir: cue0.direction, spin: false }, dt, (cue0.beatTimeMs + 110 + 1) / 1000);
      expect(cue0.status).toBe("hit");
      expect(cue0.hitGrade).toBe("onBeat");
      expect(r110.score).toBe(20);
      expect(r110.spinMeter).toBe(15);

      // 111 ms -> off-beat (+10, +10 spinMeter)
      const r111 = createRunState(101);
      const cue111 = r111.map.cues[0];
      stepRun(r111, { strikeDir: cue111.direction, spin: false }, dt, (cue111.beatTimeMs - 111 + 1) / 1000);
      expect(cue111.status).toBe("hit");
      expect(cue111.hitGrade).toBe("offBeat");
      expect(r111.score).toBe(10);
      expect(r111.spinMeter).toBe(10);

      // 200 ms -> off-beat (+10, +10 spinMeter)
      const r200 = createRunState(101);
      const cue200 = r200.map.cues[0];
      stepRun(r200, { strikeDir: cue200.direction, spin: false }, dt, (cue200.beatTimeMs - 200 + 1) / 1000);
      expect(cue200.status).toBe("hit");
      expect(cue200.hitGrade).toBe("offBeat");
      expect(r200.score).toBe(10);

      // 201 ms early -> whiff (0 pts, combo reset)
      const r201 = createRunState(101);
      r201.streak = 10;
      r201.combo = 2;
      const cue201 = r201.map.cues[0];
      stepRun(r201, { strikeDir: cue201.direction, spin: false }, dt, (cue201.beatTimeMs - 201 + 1) / 1000);
      expect(cue201.status).toBe("pending");
      expect(r201.whiffs).toBe(1);
      expect(r201.streak).toBe(0);
      expect(r201.combo).toBe(1);

      // Unhit expiry past +200 ms resets combo and increments misses
      stepRun(r201, { strikeDir: null, spin: false }, dt, (cue201.beatTimeMs + 205) / 1000);
      expect(cue201.status).toBe("expired");
      expect(r201.misses).toBe(1);

      // Shield 2-hit progression
      const rShield = createRunState(101);
      const sHit1 = rShield.map.cues.find((c) => c.kind === "shield" && c.shieldHitIndex === 1)!;
      const sHit2 = rShield.map.cues.find((c) => c.kind === "shield" && c.shieldGroupId === sHit1.shieldGroupId && c.shieldHitIndex === 2)!;
      for (const c of rShield.map.cues) {
         if (c !== sHit1 && c !== sHit2) c.status = "hit";
      }
      stepRun(rShield, { strikeDir: sHit1.direction, spin: false }, dt, (sHit1.beatTimeMs + 1) / 1000);
      expect(sHit1.status).toBe("hit");
      expect(rShield.shieldCrackedGroups.has(sHit1.shieldGroupId)).toBe(true);
      stepRun(rShield, { strikeDir: sHit2.direction, spin: false }, dt, (sHit2.beatTimeMs + 1) / 1000);
      expect(sHit2.status).toBe("hit");

      // Double pair: one strike in that direction clears both near and far
      const rDouble = createRunState(101);
      const dCue = rDouble.map.cues.find((c) => c.doublePairId === 0)!;
      const dPair = rDouble.map.cues.filter((c) => c.doublePairId === 0);
      for (const c of rDouble.map.cues) {
         if (c.doublePairId !== 0) c.status = "hit";
      }
      stepRun(rDouble, { strikeDir: dCue.direction, spin: false }, dt, (dCue.beatTimeMs + 1) / 1000);
      expect(dPair.every((c) => c.status === "hit")).toBe(true);
      expect(rDouble.streak).toBe(2);
      expect(rDouble.score).toBe(40);
      expect(rDouble.spinMeter).toBe(30);
      expect(rDouble.swingIsFar).toBe(true);

      // Tomato decoy penalty (-50 floored at 0, resets combo)
      const rTom = createRunState(101);
      rTom.score = 30;
      rTom.streak = 12;
      rTom.combo = 2;
      const tomCue = rTom.map.cues.find((c) => c.kind === "tomato")!;
      for (const c of rTom.map.cues) {
         if (c !== tomCue) c.status = "hit";
      }
      stepRun(rTom, { strikeDir: tomCue.direction, spin: false }, dt, (tomCue.beatTimeMs + 1) / 1000);
      expect(tomCue.status).toBe("hit");
      expect(rTom.score).toBe(0);
      expect(rTom.streak).toBe(0);
      expect(rTom.combo).toBe(1);
      expect(rTom.tomatoesHit).toBe(1);

      // Spin Attack clears active real targets, skips active tomatoes, awards +50 bonus, does not charge meter
      const rSpin = createRunState(101);
      rSpin.spinMeter = 100;
      rSpin.streak = 8;
      const spinTom = rSpin.map.cues.find((c) => c.kind === "tomato")!;
      const spinReals = rSpin.map.cues.filter((c) => c.beatIndex === spinTom.beatIndex && c.kind !== "tomato");
      for (const c of rSpin.map.cues) {
         if (c.beatIndex !== spinTom.beatIndex) c.status = "hit";
      }
      stepRun(rSpin, { strikeDir: null, spin: true }, dt, (spinTom.beatTimeMs + 1) / 1000);
      expect(rSpin.spinMeter).toBe(0);
      expect(spinTom.status).toBe("pending");
      expect(spinReals.every((c) => c.status === "hit")).toBe(true);
      expect(rSpin.score).toBe(spinReals.length * 40 + 50);
   });

   it("verifies oracle, human, random mash, and adversarial bots on the real store across seeds and framerates", () => {
      // 1. Frame-rate independence across 20, 30, 60, 144 Hz on the 3 rotational seeds
      for (const seed of BEAT.MAP_SEEDS) {
         const pScore = perfectScore(createBeatMap(seed));
         for (const hz of [20, 30, 60, 144]) {
            const res = runOracleOnStore(seed, 1000 / hz);
            expect(res.phase).toBe("over");
            expect(res.endReason).toBe("timeup");
            expect(res.score).toBeGreaterThanOrEqual(Math.floor(pScore * 0.97));
            expect(res.score).toBeLessThanOrEqual(PROPOSED_LIMITS.maxScore);
            expect(withinProposedLimits(res)).toBe(true);
            expect(capScoreWithLimits(res.score, res.elapsedMs)).toBe(res.score);
         }
      }

      // 2. Oracle across 200 seeds (60 Hz)
      for (let i = 0; i < 200; i++) {
         const seed = 1000 + i;
         const map = createBeatMap(seed);
         const pScore = perfectScore(map);
         const res = runOracleOnStore(seed, 1000 / 60);
         expect(res.score).toBeGreaterThanOrEqual(Math.floor(pScore * 0.97));
         expect(withinProposedLimits(res)).toBe(true);
         expect(capScoreWithLimits(res.score, res.elapsedMs)).toBe(res.score);
      }

      const oracleRef = runOracleOnStore(101, 1000 / 60).score;

      // 3. Human bot (150-250 ms reaction delay, N(0, 50 ms) timing jitter, 92% hit rate, 4% decoy mistake) >= 50% of oracle
      const humanRng = createRng(42);
      const humanState = createRunState(101);
      const scheduledBeatPressMs = new Map<number, { timeMs: number; dir: (typeof DIRECTIONS)[number] }>();
      for (const cue of humanState.map.cues) {
         if (cue.kind === "tomato") {
            if (humanRng() < 0.04 && !scheduledBeatPressMs.has(cue.beatIndex)) {
               scheduledBeatPressMs.set(cue.beatIndex, {
                  timeMs: cue.beatTimeMs + rngNormal(humanRng, 0, 50),
                  dir: cue.direction,
               });
            }
            continue;
         }
         if (scheduledBeatPressMs.has(cue.beatIndex)) continue;
         const reactionDelayMs = 150 + humanRng() * 100;
         const leadTimeMs = cue.beatTimeMs - cue.spawnTimeMs;
         if (leadTimeMs >= reactionDelayMs && humanRng() < 0.92) {
            const jitter = Math.max(-160, Math.min(160, rngNormal(humanRng, 0, 50)));
            scheduledBeatPressMs.set(cue.beatIndex, {
               timeMs: cue.beatTimeMs + jitter,
               dir: cue.direction,
            });
         }
      }

      const humanRes = simulateRun(createArcadeStore(), {
         durationMs: BEAT.DURATION_MS,
         frame: fixedFrames(1000 / 60),
         step: (dt, time, store) => {
            const judgeMs = Math.max(0, (time - dt * 0.5) * 1000);
            let strikeDir: (typeof DIRECTIONS)[number] | null = null;
            let spin = false;
            for (const [b, action] of scheduledBeatPressMs) {
               if (judgeMs >= action.timeMs) {
                  scheduledBeatPressMs.delete(b);
                  if (humanState.spinMeter >= SPIN.MAX_METER) {
                     spin = true;
                  } else {
                     strikeDir = action.dir;
                  }
                  break;
               }
            }
            stepRun(humanState, { strikeDir, spin }, dt, time);
            const s = store.getState();
            s.setScore(humanState.score);
         },
      });
      expect(humanRes.score).toBeGreaterThanOrEqual(Math.floor(oracleRef * 0.50));
      expect(humanRes.score).toBeLessThan(oracleRef);
      expect(withinProposedLimits(humanRes)).toBe(true);

      // 4. Random 4-direction mash bot <= 15% of oracle
      const mashRng: RngState = { s: 99 };
      const mashState = createRunState(101);
      let nextMashMs = 120;
      const mashRes = simulateRun(createArcadeStore(), {
         durationMs: BEAT.DURATION_MS,
         frame: fixedFrames(1000 / 60),
         step: (dt, time, store) => {
            const nowMs = time * 1000;
            let strikeDir: (typeof DIRECTIONS)[number] | null = null;
            if (nowMs >= nextMashMs) {
               strikeDir = DIRECTIONS[Math.floor(rngNext(mashRng) * 4)];
               nextMashMs = nowMs + 110 + rngNext(mashRng) * 90;
            }
            stepRun(mashState, { strikeDir, spin: false }, dt, time);
            store.getState().setScore(mashState.score);
         },
      });
      expect(mashRes.score).toBeLessThanOrEqual(Math.floor(oracleRef * 0.15));

      // 5. Adversarial bot: decoy-hitter strictly < oracle and within limits
      const decoyState = createRunState(101);
      const decoyDone = new Set<number>();
      const decoyRes = simulateRun(createArcadeStore(), {
         durationMs: BEAT.DURATION_MS,
         frame: fixedFrames(1000 / 60),
         step: (dt, time, store) => {
            const judgeMs = Math.max(0, (time - dt * 0.5) * 1000);
            let strikeDir: (typeof DIRECTIONS)[number] | null = null;
            for (const cue of decoyState.map.cues) {
               if (cue.status === "pending" && !decoyDone.has(cue.id) && Math.abs(judgeMs - cue.beatTimeMs) <= 25) {
                  decoyDone.add(cue.id);
                  strikeDir = cue.direction;
                  break;
               }
            }
            stepRun(decoyState, { strikeDir, spin: false }, dt, time);
            store.getState().setScore(decoyState.score);
         },
      });
      expect(decoyRes.score).toBeLessThan(oracleRef);
      expect(withinProposedLimits(decoyRes)).toBe(true);
   });
});
