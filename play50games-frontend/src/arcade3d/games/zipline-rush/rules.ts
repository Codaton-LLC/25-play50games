// Pure fixed-step simulation. No browser, React, renderer or private level persistence.
import type { LevelId } from "../../types";
import { inputToWorld } from "../../core/math";
import { createCombo, comboHit, comboBreak, comboTick } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, stepBoss, hitBoss } from "../../menu2/boss/boss";
import { createSecretTracker, collectSecret } from "../../menu2/secrets/secrets";
import type { M2HeroId } from "../../menu2/heroModels";
import { LEVELS, type ZipLevel } from "./levels";
import { COMBO, SECRETS, VOLT_EEL } from "./progression";

export const MAX_SPEED = 19.6;
export const FIXED_MS = 1000 / 120;
export interface Point { x: number; y: number; z: number }
export interface StepInput { x: number; throttle: number; yaw: number; jump: boolean; power: boolean }
export const idleInput = (): StepInput => ({ x: 0, throttle: 0, yaw: 0, jump: false, power: false });
export type Zone = "short" | "edge" | "centre" | "over";
export const landingZone = (speed: number): Zone => speed < 4.5 ? "short" : speed > 10 ? "over" : speed >= 6 && speed <= 8 ? "centre" : "edge";
export const targetSpeed = (base: number, throttle: number) => base * (throttle > 0.25 ? 1.4 : throttle < -0.25 ? 0.4 : 1);
export function cablePoint(c: ZipLevel, section: number, lane: number, t: number, ms = 0): Point {
   const u = Math.max(0, Math.min(1, t));
   const side = lane === 0 || lane === 2 ? -1 : 1;
   // L1's first two beats have just one usable line. L2+ cross at midspan.
   let x = side * 1.25 * (c.crossing ? Math.cos(Math.PI * u) : 1);
   let y = 24 - section * 2 - u * 2 - (c.sag + (section === 1 ? 1 : 0)) * 4 * u * (1 - u);
   let z = -section * (c.length + 8) - u * c.length;
   if (lane === 2) y += 2.6 * Math.sin(u * Math.PI); // Nami's high express line
   if (lane === 3) x += 4.8 * Math.sin(u * Math.PI); // Riko's distant cracked-stair cable
   if (lane === 4) { x = -1.25; y += 0.4; } // Vexa's inner signal line
   if (c.boss && section === 3) {
      x += Math.sin(u * Math.PI * 2) * 7;
      z += (1 - Math.cos(u * Math.PI * 2)) * 4;
      y += u * 7;
   }
   if (c.boss && section >= 5) y -= Math.min(3, u * 6) * 4 * u * (1 - u);
   return { x, y, z };
}
export function deckPoint(c: ZipLevel, section: number, ms: number): Point {
   const p = cablePoint(c, section, 0, 1, ms);
   p.x = c.moving ? Math.sin(ms / 1100 + section) * 1.6 : 0;
   p.y -= 2.15;
   p.z -= 2;
   return p;
}
export interface ZipRun {
   level: LevelId; cfg: ZipLevel; heroId: M2HeroId; ms: number; accumulator: number;
   section: number; lane: number; t: number; speed: number; mode: "deck" | "ride" | "air" | "bell" | "fall";
   hero: Point; vx: number; vy: number; vz: number; airMs: number; releaseT: number;
   targetLane: number; cooldown: number; powerMs: number; airPower: boolean;
   wallBroken: boolean;
   relayOpenMs: number; tandemMs: number;
   /** the last throttle input (-1 brake .. 1 tuck), for the drawn pose only */
   throttle: number;
   score: number; orbs: number; collected: Uint8Array; landings: Uint8Array; centres: number;
   secrets: ReturnType<typeof createSecretTracker>; combo: ReturnType<typeof createCombo>;
   boss: ReturnType<typeof createBoss> | null; bossEvents: ReturnType<typeof createBossEvents>;
   electricLane: number; hits: number; hurtMs: number; finishMs: number; ended: "win" | "timeup" | null;
   event: { jump: boolean; hop: boolean; landed: boolean; pickup: boolean; hit: boolean; power: boolean; bossHit: boolean; bell: boolean; secret: boolean };
}
export function createRun(level: LevelId = 1, heroId: M2HeroId = "nami"): ZipRun {
   const cfg = LEVELS[level];
   const hero = cablePoint(cfg, 0, 0, 0); hero.y -= 2.15;
   return {
      level, cfg, heroId, ms: 0, accumulator: 0, section: 0, lane: 0, t: 0, speed: 7,
      mode: "deck", hero, vx: 0, vy: 0, vz: 0, airMs: 0, releaseT: 0, targetLane: -1,
      cooldown: 0, powerMs: 0, airPower: false, wallBroken: false, relayOpenMs: 0, tandemMs: 0, throttle: 0, score: 0, orbs: 0,
      collected: new Uint8Array(cfg.sections * 4), landings: new Uint8Array(cfg.sections), centres: 0,
      secrets: createSecretTracker(SECRETS), combo: createCombo(),
      boss: cfg.boss ? createBoss(VOLT_EEL) : null, bossEvents: createBossEvents(),
      electricLane: 0, hits: 0, hurtMs: 0, finishMs: 0, ended: null,
      event: { jump: false, hop: false, landed: false, pickup: false, hit: false, power: false, bossHit: false, bell: false, secret: false },
   };
}
function award(r: ZipRun, base: number) {
   r.score += base + comboHit(r.combo, COMBO, r.ms, 20);
}
function hurt(r: ZipRun) {
   if (r.hurtMs > 0 || (r.powerMs > 0 && (r.heroId === "kiro" || r.heroId === "vexa"))) return;
   r.hits++; r.event.hit = true; r.hurtMs = 1200; comboBreak(r.combo);
}
function retry(r: ZipRun) {
   hurt(r);
   r.mode = "deck"; r.t = 0; r.speed = 7; r.lane = 0; r.airPower = false;
   const p = cablePoint(r.cfg, r.section, 0, 0); p.y -= 2.15;
   Object.assign(r.hero, p); r.vx = r.vy = r.vz = 0;
}
function fall(r: ZipRun) {
   hurt(r); r.mode = "fall"; r.airMs = 0; r.vy = 0; r.vz = -r.speed;
}
function secret(r: ZipRun, index: number) {
   if (collectSecret(r.secrets, index)) r.event.secret = true;
}
function attackBoss(r: ZipRun) {
   if (!r.boss) return;
   const result = hitBoss(r.boss, VOLT_EEL, 1, r.bossEvents);
   if (result !== "ignored") { r.score += 250; r.event.bossHit = true; }
}
function land(r: ZipRun) {
   const zone = landingZone(r.speed);
   const deck = deckPoint(r.cfg, r.section, r.ms);
   // The deck is wide enough for any hero; moving rafts still require lateral correction.
   if (zone === "short" || zone === "over" || Math.abs(r.hero.x - deck.x) > 3.4 || Math.abs(r.hero.y - deck.y) > 4.5 || r.releaseT < 0.84) { fall(r); return; }
   r.event.landed = true;
   if (!r.landings[r.section]) {
      r.landings[r.section] = 1;
      award(r, zone === "centre" ? 100 : 60);
      if (zone === "centre") r.centres++;
   }
   // Boss loops cannot pay repeated landing points. Three head hits precede the spiral gill.
   if (r.boss && r.section === 2 && r.boss.phase === 0) { retryWithoutHit(r); return; }
   if (r.boss && r.section === 3 && r.boss.phase < 2) { retryWithoutHit(r); return; }
   if (r.section === r.cfg.sections - 1) {
      r.mode = "bell"; Object.assign(r.hero, deck);
      return;
   }
   r.section++; r.lane = 0; r.mode = "deck"; r.t = 0; r.speed = 7; r.airPower = false;
   const next = cablePoint(r.cfg, r.section, 0, 0); next.y -= 2.15;
   Object.assign(r.hero, next);
}
function retryWithoutHit(r: ZipRun) {
   r.t = 0; r.mode = "deck"; r.speed = 7; r.lane = 0;
   const p = cablePoint(r.cfg, r.section, 0, 0); p.y -= 2.15;
   Object.assign(r.hero, p);
}
function power(r: ZipRun, i: StepInput) {
   if (!i.power || r.cooldown > 0) return;
   r.cooldown = r.heroId === "nami" ? 2500 : 7000;
   r.powerMs = 2200; r.event.power = true;
   if (r.mode === "air" && !r.airPower) {
      r.airPower = true;
      if (r.heroId === "nami") { r.vy = 7; if (r.section === 1) r.targetLane = 2; r.event.jump = true; }
      if (r.heroId === "riko") { r.vx += (Math.sign(i.x) || 1) * 12; if (r.section === 1) r.targetLane = 3; }
   }
   if (r.heroId === "vexa" && r.mode === "ride" && r.section === 1 && r.t > 0.3 && r.t < 0.7) { r.lane = 4; secret(r, 1); }
}
function quantum(r: ZipRun, i: StepInput, dt: number) {
   const ms = dt * 1000;
   r.ms += ms; r.cooldown = Math.max(0, r.cooldown - ms); r.powerMs = Math.max(0, r.powerMs - ms); r.hurtMs = Math.max(0, r.hurtMs - ms);
   r.relayOpenMs = Math.max(0, r.relayOpenMs - ms); r.tandemMs = Math.max(0, r.tandemMs - ms);
   comboTick(r.combo, COMBO, r.ms);
   r.throttle = i.throttle;
   if (r.ms >= r.cfg.durationMs) { r.ended = "timeup"; return; }
   if (r.boss && r.section >= 2) {
      stepBoss(r.boss, VOLT_EEL, ms, r.bossEvents);
      if (r.bossEvents.telegraph) r.electricLane = r.lane;
   }
   power(r, i);
   const world = { x: 0, z: 0 }; inputToWorld(i.x, 0, i.yaw, world);
   const lateral = world.x;
   if (r.mode === "bell") {
      if (i.power || i.jump) {
         if (r.boss && r.boss.hp > 0) {
            if (r.boss.phase !== 2 || r.boss.step !== "vulnerable") return;
            attackBoss(r);
         }
         r.event.bell = true; r.score += 500; r.ended = "win"; r.finishMs = r.ms;
      }
      return;
   }
   if (r.mode === "deck") {
      if (i.jump || i.throttle > 0.25) { r.mode = "ride"; r.event.jump = true; }
      return;
   }
   if (r.mode === "fall") {
      r.airMs += ms; r.vy -= 18 * dt; r.hero.y += r.vy * dt; r.hero.z += r.vz * dt;
      if (r.airMs > 900) retry(r);
      return;
   }
   const before = { ...r.hero };
   if (r.mode === "ride") {
      const u = r.t;
      const slope = (-2 - 4 * (r.cfg.sag + (r.section === 1 ? 1 : 0)) * (1 - 2 * u)) / r.cfg.length;
      const base = 9 - slope * 12 + (r.cfg.boss && r.section === 3 ? 4 : 0);
      const want = Math.min(MAX_SPEED, targetSpeed(base, i.throttle) * (r.tandemMs > 0 ? 1.1 : 1));
      r.speed += (want - r.speed) * Math.min(1, dt * 3);
      // Climbing the deep dip without tucking loses momentum visibly, but can always recover.
      if (r.section === 1 && u > 0.45 && u < 0.7 && i.throttle <= 0.25) r.speed = Math.max(0, r.speed - dt * 18);
      r.t += r.speed * dt / r.cfg.length;
      if (r.lane === 4) r.t += r.speed * dt / r.cfg.length * 0.18;
      if (r.lane === 2 || (r.lane === 3 && r.wallBroken)) r.t += r.speed * dt / r.cfg.length * 0.12;
      if (r.lane === 3 && r.t > 0.47 && !r.wallBroken) {
         if (r.heroId === "riko" && r.powerMs > 0) { r.wallBroken = true; secret(r, 2); }
         else { fall(r); return; }
      }
      const p = cablePoint(r.cfg, r.section, r.lane, r.t, r.ms); p.y -= 2.15;
      Object.assign(r.hero, p);
      const storm = (r.section > 0 && r.t > 0.32 && r.t < 0.46 && (r.lane === 1 || r.cfg.night) && Math.floor(r.ms / 2400) % 2 === r.lane)
         || (r.boss?.phase === 0 && r.section === 2 && r.boss.step === "attack" && r.lane === r.electricLane);
      if (storm) hurt(r);
      if (r.cfg.moving && r.t > 0.58 && r.t < 0.62 && i.throttle < 0.25) hurt(r); // gull flight: tuck underneath
      if (i.jump) {
         if (r.relayOpenMs > 0 && r.section === 1 && r.t > 0.3 && r.t < 0.7) { r.lane = 4; secret(r, 1); }
         r.mode = "air"; r.airMs = 0; r.releaseT = r.t; r.airPower = false;
         const other = r.lane === 0 ? 1 : 0;
         const neighbour = cablePoint(r.cfg, r.section, other, r.t);
         const gap = neighbour.x - r.hero.x;
         r.targetLane = Math.abs(lateral) > 0.25 && lateral * gap > 0 && Math.abs(gap) <= 3 && (r.level > 1 || r.section === 2) ? other : r.t < 0.84 ? r.lane : -1;
         r.vy = 5.5; r.vx = r.targetLane >= 0 ? (cablePoint(r.cfg, r.section, r.targetLane, r.t).x - r.hero.x) * 3 : lateral * 4;
         r.vz = -r.speed; r.event.jump = true;
         if (r.targetLane >= 0 && r.targetLane !== r.lane) { r.event.hop = true; if (i.throttle > 0.25 && r.speed > 11) secret(r, 0); }
         if (r.boss?.step === "vulnerable" && r.section === 2 && r.boss.phase === 0 && r.t > 0.4 && r.t < 0.68 && r.lane !== r.electricLane) attackBoss(r);
         if (r.boss?.step === "vulnerable" && r.section === 3 && r.boss.phase === 1 && r.t > 0.84 && r.speed >= 11) attackBoss(r);
      }
      if (r.t > 1.025 && r.mode === "ride") fall(r);
   } else {
      r.airMs += ms; r.vy -= dt * 15;
      r.vx += lateral * dt * 8; r.vx *= Math.exp(-dt * 1.6);
      r.hero.x += r.vx * dt; r.hero.y += r.vy * dt; r.hero.z += r.vz * dt;
      r.t += r.speed * dt / r.cfg.length;
      if (r.targetLane >= 0 && r.airMs >= 250 && r.t < 0.86) {
         const p = cablePoint(r.cfg, r.section, r.targetLane, r.t, r.ms); p.y -= 2.15;
         if (Math.abs(r.hero.x - p.x) < 1.2 && Math.abs(r.hero.y - p.y) < 2) {
            r.lane = r.targetLane; r.targetLane = -1; r.mode = "ride"; Object.assign(r.hero, p);
            if (r.lane === 2 || r.lane === 3) secret(r, 2);
         }
      }
      if (r.t >= 1 && r.mode === "air") land(r);
      else if (r.airMs > 1800 && r.mode === "air") fall(r);
   }
   // Swept parameter pickups cannot tunnel at 30 Hz. Every source has a one-shot bit.
   for (let k = 0; k < 4; k++) {
      const at = 0.22 + k * 0.16, index = r.section * 4 + k;
      const lane = r.level === 1 && r.section < 2 ? 0 : k < 2 ? 0 : 1;
      const magnet = r.heroId === "zuno" && r.powerMs > 0;
      if (!r.collected[index] && r.t >= at && r.t <= at + 0.045 && (r.lane === lane || magnet)) {
         r.collected[index] = 1; r.orbs++; award(r, 30); r.event.pickup = true;
      }
   }
   if (r.powerMs > 0 && r.t > 0.3 && r.t < 0.75) {
      if (r.heroId === "vexa") secret(r, 1);
      if (r.heroId === "kiro" && r.section > 0 && r.lane === 1 && r.t > 0.32 && r.t < 0.46) secret(r, 2);
      if (r.heroId === "zuno" && r.lane === 0) secret(r, 2);
   }
   if (r.cfg.night && r.t > 0.7 && r.t < 0.75 && Math.sin(r.ms / 1800) > 0.9 && r.event.hop) secret(r, 2);
   r.vx = r.mode === "air" ? r.vx : (r.hero.x - before.x) / dt;
   r.vy = r.mode === "air" ? r.vy : (r.hero.y - before.y) / dt;
   r.vz = r.mode === "air" ? r.vz : (r.hero.z - before.z) / dt;
}
export function step(r: ZipRun, dtMs: number, input: StepInput) {
   for (const key of Object.keys(r.event) as (keyof ZipRun["event"])[]) r.event[key] = false;
   if (r.ended || !Number.isFinite(dtMs) || dtMs <= 0) return r.event;
   r.accumulator += Math.min(250, dtMs);
   const i = { ...input, x: Number.isFinite(input.x) ? Math.max(-1, Math.min(1, input.x)) : 0, throttle: Number.isFinite(input.throttle) ? Math.max(-1, Math.min(1, input.throttle)) : 0, yaw: Number.isFinite(input.yaw) ? input.yaw : 0 };
   // Edge inputs survive a render shorter than one simulation quantum.
   pending(r).jump ||= i.jump; pending(r).power ||= i.power;
   while (r.accumulator + 1e-7 >= FIXED_MS && !r.ended) {
      i.jump = pending(r).jump; i.power = pending(r).power;
      quantum(r, i, FIXED_MS / 1000);
      pending(r).jump = pending(r).power = false;
      r.accumulator -= FIXED_MS;
   }
   return r.event;
}
const edges = new WeakMap<ZipRun, { jump: boolean; power: boolean }>();
function pending(r: ZipRun) {
   let p = edges.get(r); if (!p) { p = { jump: false, power: false }; edges.set(r, p); } return p;
}
// Each section: four unique orbs (30+20), one unique landing (100+20).
// Boss: three head hits, one gill, one bell hit (5*250). Clear pays 500 once.
// Secrets, powers, failed retries, switching and the flow display pay no other points.
export const maxScoreFor = (id: LevelId) => LEVELS[id].sections * (4 * 50 + 120) + (id === 5 ? 1250 : 0) + 500;
// No hero changes longitudinal speed above MAX_SPEED. The fastest route adds 18% parameter
// travel, so every required span takes at least length/(MAX_SPEED*1.18). Round down to 100 ms.
export const minDurationFor = (id: LevelId) => Math.floor(LEVELS[id].length * LEVELS[id].sections / (MAX_SPEED * 1.18) * 10) * 100;
export const limitsFor = (id: LevelId) => ({ kind: "points" as const, maxScore: maxScoreFor(id), base: maxScoreFor(id), maxPointsPerSec: 0, minDurationMs: minDurationFor(id), maxDurationMs: LEVELS[id].durationMs + 1000, unitLabel: "points", display: "int" as const });
