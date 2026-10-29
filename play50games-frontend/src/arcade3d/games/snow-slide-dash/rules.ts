// Pure downhill simulation. Renderers and proof bots call the same step; no score-only shortcuts.
import type { LevelId, ScoringRules } from "../../types";
import type { RunState } from "../../core/types";
import { inputToWorld } from "../../core/math";
import { createCombo, comboHit, comboBreak, comboTick, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, stepBoss, hitBoss, type BossState } from "../../menu2/boss/boss";
import { createSecretTracker, collectSecret, type SecretTracker } from "../../menu2/secrets/secrets";
import { LEVELS, type SnowLevel } from "./levels";
import { DEFAULT_HERO, heroById, type HeroId } from "./heroes";
import { BIG_DRIFT, COMBO, SECRETS } from "./progression";
import { buildCourse, heightAt, HALF_WIDTH, obstacleX, type Course } from "./slope";

export const TOP_SPEED = 44;
export const TRICK_RATE = Math.PI * 2;
export const STAT = {
   level: "snowLevel", orbs: "snowOrbs", speed: "snowSpeed", distance: "snowDistance", streak: "snowStreak",
   hits: "snowHits", power: "snowPower", hero: "snowHero", surface: "snowSurface",
   chain: "snowChain", multiplier: "snowMultiplier", flow: "snowFlow", finishMs: "snowFinishMs",
   bossHp: "snowBossHp", bossPhase: "snowBossPhase", bossOpen: "snowBossOpen", bossFlash: "snowBossFlash",
   charges: "snowCharges", gap: "snowGap", stars: "snowStars", newStars: "snowNewStars",
   noHit: "snowNoHit", secrets: "snowSecrets", newSecrets: "snowNewSecrets", xp: "snowXp",
} as const;
export type Surface = "powder" | "packed" | "ice";
export interface StepInput { moveX: number; moveY: number; jumpPressed: boolean; actionPressed: boolean; carve: boolean; yaw: number; }
export const idleInput = (): StepInput => ({ moveX: 0, moveY: 0, jumpPressed: false, actionPressed: false, carve: false, yaw: 0 });
export interface Events {
   gate: boolean; missed: boolean; landed: boolean; perfect: boolean; jumped: boolean;
   hit: boolean; powered: boolean; secret: boolean; bossHit: boolean; bossDefeated: boolean;
   finished: boolean; checkpoint: boolean; airJump: boolean; route: number;
}
const clearEvents = (): Events => ({ gate: false, missed: false, landed: false, perfect: false, jumped: false, hit: false, powered: false, secret: false, bossHit: false, bossDefeated: false, finished: false, checkpoint: false, airJump: false, route: -1 });
export interface SnowRun {
   seed: number; level: LevelId; config: SnowLevel; course: Course; heroId: HeroId;
   hero: { x: number; y: number; z: number; vx: number; vy: number; vz: number };
   simMs: number; distance: number; speed: number; streak: number; orbs: number; hits: number;
   nextGate: number; collected: Uint8Array; rampUsed: Uint8Array; obstacleHit: Uint8Array;
   airMs: number; airTotal: number; airApex: number; spin: number; flip: number; lastSpin: number; lastFlip: number;
   airRamp: number; airJumped: boolean; boost: number; stumbleUntil: number; immuneUntil: number;
   powerUntil: number; powerReadyAt: number; routeDone: Uint8Array; hats: number; trailCoins: number;
   combo: ComboState; secrets: SecretTracker; boss: BossState | null; bossEvents: ReturnType<typeof createBossEvents>;
   charges: number; gap: number; rockX: number; rockD: number; rockAt: number; rockHit: boolean;
   draft: boolean; twinUntil: number; checkpoint: number; finishMs: number; ended: "win" | "lose" | "timeup" | null;
   events: Events;
}
export function surfaceAt(l: SnowLevel, d: number, x: number): Surface {
   if (l.id === 3 && d >= 140 && d < l.length - 130 && Math.floor((d - 140) / 90) % 2 === 0) return "ice";
   if (l.id >= 2 && Math.abs(x) > 7) return "powder";
   return "packed";
}
export function aligned(angle: number): boolean {
   return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) <= Math.PI / 9 + 1e-9;
}
export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): SnowRun {
   const config = LEVELS[level], course = buildCourse(config);
   return {
      seed, level, config, course, heroId, hero: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: -config.baseSpeed },
      simMs: 0, distance: 0, speed: config.baseSpeed, streak: 0, orbs: 0, hits: 0, nextGate: 0,
      collected: new Uint8Array(course.gates.length), rampUsed: new Uint8Array(course.ramps.length), obstacleHit: new Uint8Array(course.obstacles.length),
      airMs: 0, airTotal: 0, airApex: 3.3, spin: 0, flip: 0, lastSpin: 0, lastFlip: 0, airRamp: -1, airJumped: false,
      boost: 0, stumbleUntil: 0, immuneUntil: 0, powerUntil: 0, powerReadyAt: 0, routeDone: new Uint8Array(5), hats: 0, trailCoins: 0,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]), boss: level === 5 ? createBoss(BIG_DRIFT) : null,
      bossEvents: createBossEvents(), charges: 0, gap: 110, rockX: 0, rockD: -100, rockAt: 0, rockHit: false,
      draft: false, twinUntil: 0, checkpoint: 0, finishMs: 0, ended: null, events: clearEvents(),
   };
}
export function powerActive(r: SnowRun, hero: HeroId): boolean { return r.heroId === hero && r.simMs < r.powerUntil; }
function launch(r: SnowRun, duration: number, ramp: number, apex = 3.3): void {
   r.airTotal = r.airMs = duration;
   r.airRamp = ramp;
   r.airApex = apex;
   r.spin = r.flip = 0;
   r.airJumped = false;
   r.events.jumped = true;
}
function hurt(r: SnowRun, duration = 600): void {
   if (r.simMs < r.immuneUntil || powerActive(r, "kiro") || powerActive(r, "vexa")) return;
   r.hits++;
   r.stumbleUntil = r.simMs + duration;
   r.immuneUntil = r.simMs + 1300;
   r.streak = 0;
   r.boost = 0;
   comboBreak(r.combo);
   r.events.hit = true;
}
function bossHit(r: SnowRun): boolean {
   if (!r.boss) return false;
   const result = hitBoss(r.boss, BIG_DRIFT, 1, r.bossEvents);
   if (result === "ignored") return false;
   r.events.bossHit = true;
   if (result === "defeated") r.events.bossDefeated = true;
   return true;
}
function rewind(r: SnowRun, d: number): void {
   r.distance = d;
   r.hero.x = 0;
   r.hero.z = -d;
   r.hero.y = heightAt(d);
   r.nextGate = r.course.gates.findIndex((g) => g.d > d);
   if (r.nextGate < 0) r.nextGate = r.course.gates.length;
   r.gap = Math.max(70, r.gap);
}
function land(r: SnowRun): void {
   const halves = Math.floor((Math.abs(r.spin) + Math.abs(r.flip) + 0.1) / Math.PI);
   const perfect = aligned(r.spin) && aligned(r.flip) && halves >= 2;
   r.lastSpin = r.spin;
   r.lastFlip = r.flip;
   r.events.landed = true;
   r.events.perfect ||= perfect;
   if (perfect) {
      r.boost = Math.min(8, r.boost + halves * 2);
      if (r.airRamp >= 0) {
         // A landing scores flow only once per ramp; repeated runs at a boss checkpoint cannot farm it.
         if (r.rampUsed[r.airRamp] !== 2) comboHit(r.combo, COMBO, r.simMs, 0);
         r.rampUsed[r.airRamp] = 2;
         if (r.boss?.phase === 1) r.charges = Math.min(3, r.charges + 1);
      }
   } else if (!aligned(r.spin) || !aligned(r.flip)) hurt(r);
   const final = r.airRamp >= 0 && r.course.ramps[r.airRamp].final;
   if (final) {
      if (r.boss?.hp === 1 && perfect && Math.abs(r.spin) >= Math.PI * 4 - 0.35 && Math.abs(r.hero.x) <= 3 && bossHit(r)) {
         r.distance = r.config.length;
      } else {
         hurt(r);
         // An unsuccessful final jump is retryable. Missing barrage charges returns to its ramps.
         rewind(r, r.boss && r.boss.hp > 1 ? r.config.length * 0.38 : r.config.length - 75);
      }
   }
   r.airRamp = -1;
}
function substep(r: SnowRun, ms: number, input: StepInput, first: boolean): void {
   const dt = ms / 1000, h = r.hero, ev = r.events;
   const old = r.distance;
   r.simMs += ms;
   comboTick(r.combo, COMBO, r.simMs);
   if (r.boss) {
      stepBoss(r.boss, BIG_DRIFT, ms, r.bossEvents);
      if (r.bossEvents.attack && r.boss.phase === 1) {
         r.rockX = h.x;
         r.rockD = old + 52;
         r.rockAt = r.simMs + 900;
         r.rockHit = false;
      }
   }
   if (first && input.actionPressed && r.simMs >= r.powerReadyAt) {
      r.powerUntil = r.simMs + (r.heroId === "riko" ? 650 : 2800);
      r.powerReadyAt = r.simMs + heroById(r.heroId).cooldownMs;
      ev.powered = true;
      if (r.heroId === "riko") r.boost = 8;
      if (r.heroId === "nami" && r.airMs > 0 && !r.airJumped) {
         r.airMs += 600;
         r.airTotal += 600;
         r.airJumped = true;
         r.airApex = Math.max(5.3, r.airApex + 2);
         ev.airJump = true;
      }
   }
   const direction = inputToWorld(input.moveX, input.moveY, input.yaw);
   const surface = surfaceAt(r.config, old, h.x);
   const carving = input.carve || input.moveY > 0.35;
   const target = (r.config.baseSpeed + r.streak * 1.5 + r.boost) * (surface === "powder" ? 0.72 : surface === "ice" ? 1.2 : 1) * (carving ? 0.85 : 1) * (r.draft ? 1.1 : 1) + (r.simMs < r.twinUntil ? 4 : 0);
   const finalAir = r.airRamp >= 0 && r.course.ramps[r.airRamp].final;
   r.speed += (Math.min(TOP_SPEED, r.simMs < r.stumbleUntil ? 5 : target) - r.speed) * Math.min(1, dt * 5);
   r.speed = Math.min(TOP_SPEED, r.speed);
   r.boost = Math.max(0, r.boost - dt * 0.7);
   if (r.airMs > 0) {
      r.spin += Math.max(-1, Math.min(1, input.moveX)) * TRICK_RATE * dt;
      r.flip += Math.max(-1, Math.min(1, input.moveY)) * TRICK_RATE * dt;
      r.airMs = Math.max(0, r.airMs - ms);
      h.vx *= Math.exp(-dt * 8);
   } else {
      const steer = surface === "ice" ? 0 : direction.x * (carving ? 17 : 9);
      h.vx += (steer - h.vx) * Math.min(1, dt * (carving || surface === "powder" ? 14 : 7));
   }
   h.x = Math.max(-HALF_WIDTH + 0.8, Math.min(HALF_WIDTH - 0.8, h.x + h.vx * dt));
   r.distance += (finalAir ? 20 : r.speed) * dt;
   h.vz = -(finalAir ? 20 : r.speed);
   h.z = -r.distance;
   const flight = r.airTotal > 0 ? 1 - r.airMs / r.airTotal : 0;
   h.y = heightAt(r.distance) + (r.airMs > 0 ? Math.sin(flight * Math.PI) * r.airApex : 0);
   h.vy = r.airMs > 0 ? Math.cos(flight * Math.PI) * r.airApex * Math.PI / (r.airTotal / 1000) : 0;
   if (r.airMs === 0 && r.airTotal > 0) { land(r); r.airTotal = 0; }
   if (r.airMs === 0) {
      for (let k = 0; k < r.course.ramps.length; k++) {
         const ramp = r.course.ramps[k];
         if (old < ramp.d && r.distance >= ramp.d && Math.abs(h.x - ramp.x) < (ramp.final ? 6 : 3.3)) {
            r.rampUsed[k] = Math.max(1, r.rampUsed[k]);
            launch(r, ramp.final ? 2000 : ramp.rooftop ? 1800 : 1100, k, ramp.final ? 9 : ramp.rooftop && r.speed > 20 ? 6 : 3.3);
            break;
         }
      }
      if (first && input.jumpPressed && r.airMs === 0) launch(r, 700, -1);
   }
   while (r.nextGate < r.course.gates.length && r.distance >= r.course.gates[r.nextGate].d) {
      const k = r.nextGate++, gate = r.course.gates[k];
      const pass = Math.abs(h.x - gate.x) <= 3.2;
      if (pass) {
         r.streak = Math.min(6, r.streak + 1);
         ev.gate = true;
         if (!r.collected[k]) comboHit(r.combo, COMBO, r.simMs, 0);
         if (r.boss?.phase === 1 && r.charges > 0 && bossHit(r)) r.charges--;
      } else { r.streak = 0; comboBreak(r.combo); ev.missed = true; }
      // Zuno's passive four-metre star reach does not count a missed gate as a streak.
      if (!r.collected[k] && (pass || (r.heroId === "zuno" && Math.abs(h.x - gate.x) <= 4))) {
         r.collected[k] = 1;
         r.orbs++;
      }
   }
   for (let i = 0; i < r.course.obstacles.length; i++) {
      const o = r.course.obstacles[i];
      if (r.obstacleHit[i] || Math.abs(r.distance - o.d) > 1.6 || h.y - heightAt(r.distance) > 1.5) continue;
      if (Math.abs(h.x - obstacleX(o, r.simMs)) > 1.3) continue;
      r.obstacleHit[i] = 1;
      if (o.kind === "snowman" && carving) {
         r.hats++;
         if (r.hats >= 5 && collectSecret(r.secrets, 1)) ev.secret = true;
      } else hurt(r, o.kind === "pine" ? 1000 : 600);
   }
   if (!r.rockHit && r.simMs >= r.rockAt && Math.abs(r.distance - r.rockD) < 1.8 && Math.abs(h.x - r.rockX) < 1.7 && r.airMs === 0) {
      r.rockHit = true;
      hurt(r);
   }
   for (let k = 0; k < r.course.routes.length; k++) {
      const route = r.course.routes[k];
      if (r.routeDone[k] || r.distance < route.d || r.distance > route.end || Math.abs(h.x - route.x) > 2.7) continue;
      if (r.heroId === route.hero && powerActive(r, route.hero)) {
         if (route.hero === "nami" && (!r.airJumped || h.y - heightAt(r.distance) < 4.2)) continue;
         r.routeDone[k] = 1;
         ev.route = k;
         r.boost = 8;
         if (route.hero === "zuno") r.trailCoins += 12;
         if (route.hero === "vexa" && collectSecret(r.secrets, 0)) ev.secret = true;
      } else if (route.hero !== "zuno") hurt(r, route.hero === "kiro" ? 1000 : 600);
   }
   if (r.level === 2 && r.distance > 455 && r.distance < 485 && h.x > 9 && r.speed > 20 && h.y - heightAt(r.distance) > 5.3 && collectSecret(r.secrets, 1)) ev.secret = true;
   const checkpoint = Math.floor(r.distance / 150);
   if (checkpoint > r.checkpoint) { r.checkpoint = checkpoint; ev.checkpoint = true; }
   if (r.boss && r.boss.hp > 0) {
      if (r.boss.phase === 0) {
         if (r.distance > r.config.length * 0.28 && r.streak >= 3) bossHit(r);
         r.gap += (r.streak >= 3 ? 1 : -7) * dt;
      } else r.gap += (r.speed - r.config.baseSpeed + 1) * dt;
      r.gap = Math.min(130, r.gap);
      if (r.gap <= 0) r.ended = "lose";
   }
   if (r.distance >= r.config.length && r.airMs === 0) {
      if (!r.boss || r.boss.hp === 0) {
         r.distance = r.config.length;
         r.hero.z = -r.distance;
         r.hero.y = heightAt(r.distance);
         r.finishMs = r.simMs;
         r.ended = "win";
         ev.finished = true;
      } else rewind(r, r.boss.hp > 1 ? r.config.length * 0.38 : r.config.length - 75);
   }
   if (!r.ended && r.simMs >= r.config.durationMs) r.ended = "timeup";
}
export function step(r: SnowRun, dtMs: number, input: StepInput): Events {
   Object.assign(r.events, clearEvents());
   if (r.ended || !Number.isFinite(dtMs) || dtMs <= 0) return r.events;
   let left = Math.min(250, dtMs, r.config.durationMs - r.simMs), first = true;
   while (left > 1e-7 && !r.ended) {
      const ms = Math.min(8, left);
      substep(r, ms, input, first);
      first = false;
      left -= ms;
   }
   return r.events;
}
export const LIMITS: Record<LevelId, ScoringRules> = Object.fromEntries(([1, 2, 3, 4, 5] as const).map((id) => {
   const l = LEVELS[id], minDurationMs = Math.floor(l.length / TOP_SPEED * 1000) - 1;
   return [id, { kind: "time", minDurationMs, maxDurationMs: l.durationMs, timeBaseMs: l.durationMs,
      maxScore: Math.floor((l.durationMs - minDurationMs) / 10), base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" }];
})) as Record<LevelId, ScoringRules>;
export function finalScore(s: RunState) {
   const durationMs = Math.ceil(s.stats[STAT.finishMs] || s.elapsedMs);
   const score = Math.max(0, Math.floor((LEVELS[(s.stats[STAT.level] ?? 1) as LevelId].durationMs - durationMs) / 10));
   return { score, durationMs };
}
