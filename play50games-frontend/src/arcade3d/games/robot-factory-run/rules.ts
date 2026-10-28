// Pure deterministic factory simulation. The shell supplies ALL rules time; no wall clocks.
import type { LevelId, ScoringRules } from "../../types";
import type { RunState } from "../../core/types";
import { inputToWorld } from "../../core/math";
import { createCombo, comboHit, comboTick, comboBreak, comboMaxBonus } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, stepBoss, hitBoss } from "../../menu2/boss/boss";
import { createSecretTracker, collectSecret } from "../../menu2/secrets/secrets";
import { LEVELS } from "./levels";
import { COMBO, OVERSEER, SECRETS } from "./progression";
import { DEFAULT_HERO, heroById, type HeroId } from "./heroes";
export const ORB_MS = 300;
export const BELT_SPEED = 2.5;
export const STAT = Object.fromEntries(["orbs", "finishMs", "comboMs", "stars", "newStars", "noHit", "secrets", "newSecrets", "xp", "cells", "lost", "hearts", "power", "hero", "bossHp", "bossPhase", "bossOpen", "bossFlash", "chain", "flow", "mult", "hint", "reverse"].map((s) => [s, s])) as Record<string, string>;
export const JUNCTION_X = [-4, 2, 4, 6];
export const ORBS = [-7, -5, -3, -1, 1, 3, 5, 7].map((x, i) => ({ x, y: i === 7 ? 2.65 : 0.65, z: i === 7 ? -4 : i % 2 ? 3.6 : -2 }));
export interface StepInput {
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   roll: boolean;
   actionPressed: boolean;
}
export const createStepInput = (): StepInput => ({ moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, roll: false, actionPressed: false });
export interface Cell {
   x: number;
   z: number;
   nodeX: number;
   nodeZ: number;
   dx: number;
   dz: number;
   distance: number;
   sleepUntil: number;
   active: boolean;
   serial: number;
   sideHop: boolean;
   armReadyAt: number;
}
export interface Board {
   turns: number[];
   turnedAt: number[];
   jamUntil: number[];
   charged: number;
   lost: number;
   cells: Cell[];
   nextSpawn: number;
   secretTurn: number;
   secretCharged: boolean;
   bossReverseAt: number;
   bossDragged: number;
}
export interface FactoryRun {
   seed: number;
   level: LevelId;
   heroId: HeroId;
   simMs: number;
   finishMs: number;
   ended: "win" | "lose" | "timeup" | null;
   hero: {
      x: number;
      y: number;
      z: number;
      vx: number;
      vz: number;
      vy: number;
      grounded: boolean;
      airJump: boolean;
      roll: boolean;
      powerUntil: number;
      powerReady: number;
      hurtUntil: number;
      plate: number;
      drop: boolean;
   };
   board: Board;
   boss: ReturnType<typeof createBoss> | null;
   bossEv: ReturnType<typeof createBossEvents>;
   combo: ReturnType<typeof createCombo>;
   secrets: ReturnType<typeof createSecretTracker>;
   collected: Uint8Array;
   orbs: number;
   hits: number;
   hearts: number;
   lastUseful: number;
   armCycle: number;
   ventLatch: boolean;
   crateBroken: boolean;
   worldDriver: boolean;
   events: {
      turn: boolean;
      pickup: boolean;
      charged: boolean;
      scrap: boolean;
      hit: boolean;
      jump: boolean;
      land: boolean;
      power: boolean;
      secret: boolean;
      bossHit: boolean;
      bossDefeated: boolean;
      arm: boolean;
   };
}
export function createRun(seed = 1, level: LevelId = 1, heroId = DEFAULT_HERO): FactoryRun {
   return { seed, level, heroId, simMs: 0, finishMs: 0, ended: null,
      hero: { x: -8, y: 0, z: 3.5, vx: 0, vz: 0, vy: 0, grounded: true, airJump: true, roll: false, powerUntil: -1, powerReady: 0, hurtUntil: -1, plate: -1, drop: false },
      board: { turns: Array.from({ length: LEVELS[level].junctions }, (_, i) => i % 2 ? 3 : 1), turnedAt: [-999, -999, -999, -999], jamUntil: [0, 0, 0, 0], charged: 0, lost: 0, cells: [], nextSpawn: 2000, secretTurn: 0, secretCharged: false, bossReverseAt: -1, bossDragged: 0 },
      boss: level === 5 ? createBoss(OVERSEER) : null, bossEv: createBossEvents(), combo: createCombo(), secrets: createSecretTracker(SECRETS[level]),
      collected: new Uint8Array(ORBS.length + 4), orbs: 0, hits: 0, hearts: 5, lastUseful: 0, armCycle: -1, ventLatch: false, crateBroken: false,
      worldDriver: true,
      events: { turn: false, pickup: false, charged: false, scrap: false, hit: false, jump: false, land: false, power: false, secret: false, bossHit: false, bossDefeated: false, arm: false },
   };
}
export function reverseOn(r: FactoryRun): boolean { return LEVELS[r.level].reverse && Math.floor(r.simMs / 6000) % 2 === 1; }
export function pressState(ms: number): "safe" | "warning" | "slam" { const t = (ms + 400) % 1600; return t < 850 ? "safe" : t < 1350 ? "warning" : "slam"; }
export function laserOn(r: FactoryRun, index = 0): boolean { return LEVELS[r.level].lasers && (index === 0 ? (r.board.turns[0] ?? 0) !== 0 : (r.board.turns[0] ?? 0) === 0); }
export function floorAt(x: number, z: number): number {
   // A broad ramp lets every hero reach the boss catwalk. Nami skips the ramp.
   if (z < -3 && z > -5.2 && x >= 0 && x < 4)
      return x * 0.5;
   return z < -3 && z > -5.2 && x >= 4 ? 2 : 0;
}
export function rotateSwitch(r: FactoryRun, index: number): boolean {
   const b = r.board;
   if (index < 0 || index >= b.turns.length || r.simMs - b.turnedAt[index] < 350 || b.jamUntil[index] > r.simMs)
      return false;
   b.turns[index] = (b.turns[index] + 1) % 4;
   b.turnedAt[index] = r.simMs;
   r.events.turn = true;
   r.lastUseful = r.simMs;
   // Only the FIRST useful route per junction earns flow; repeated switching never farms time.
   if (b.turns[index] === 0 && !r.collected[ORBS.length + index]) {
      r.collected[ORBS.length + index] = 1;
      comboHit(r.combo, COMBO, r.simMs, 40);
   }
   return true;
}
function bossHit(r: FactoryRun): boolean {
   if (!r.boss || hitBoss(r.boss, OVERSEER, 1, r.bossEv) === "ignored")
      return false;
   r.events.bossHit = true;
   r.events.bossDefeated = r.boss.hp === 0;
   r.lastUseful = r.simMs;
   return true;
}
function hurt(r: FactoryRun): void {
   const h = r.hero;
   if (r.simMs < h.hurtUntil || (h.powerUntil > r.simMs && (r.heroId === "kiro" || r.heroId === "vexa")))
      return;
   r.hearts--;
   r.hits++;
   h.hurtUntil = r.simMs + 1800;
   r.events.hit = true;
   comboBreak(r.combo);
   h.x = Math.max(-8, h.x - 1.2);
   h.z = 3.5;
   h.y = 0;
   h.vy = 0;
   h.grounded = true;
   if (r.hearts <= 0)
      r.ended = "lose";
}
function resetCell(c: Cell, ms: number): void {
   c.x = c.nodeX = -8;
   c.z = c.nodeZ = 0;
   c.dx = 1;
   c.dz = 0;
   c.distance = 0;
   c.active = false;
   c.sleepUntil = ms;
   c.sideHop = false;
   c.armReadyAt = 0;
}
function loseCell(r: FactoryRun, c: Cell): void { r.board.lost++; r.events.scrap = true; resetCell(c, r.simMs + 4000); }
function deliver(r: FactoryRun, c: Cell): boolean {
   if (r.boss && r.boss.phase === 0 && !bossHit(r))
      return false;
   if (!r.boss || r.boss.phase === 0 || r.boss.hp === 5)
      r.board.charged = Math.min(LEVELS[r.level].cells, r.board.charged + 1);
   r.events.charged = true;
   r.lastUseful = r.simMs;
   resetCell(c, r.simMs + 5000);
   return true;
}
function cellStep(r: FactoryRun, dt: number): void {
   const b = r.board;
   const cfg = LEVELS[r.level];
   if (r.simMs >= b.nextSpawn && b.cells.length < cfg.cells) {
      const c: Cell = { x: -8, z: 0, nodeX: -8, nodeZ: 0, dx: 1, dz: 0, distance: 0, active: true, sleepUntil: 0, serial: b.cells.length, sideHop: false, armReadyAt: 0 };
      b.cells.push(c);
      b.nextSpawn += 5000;
   }
   for (const c of b.cells) {
      if (!c.active) {
         if (r.simMs < c.sleepUntil || b.charged >= cfg.cells)
            continue;
         c.active = true;
      }
      if (c.nodeX >= 8 && c.nodeZ === 0) {
         deliver(r, c);
         continue;
      }
      if (cfg.arms && c.nodeX === 0 && c.nodeZ === 0 && c.distance === 0 && b.secretTurn === 0) {
         if (c.armReadyAt === 0)
            c.armReadyAt = Math.ceil(r.simMs / 5000) * 5000;
         if (r.simMs < c.armReadyAt)
            continue;
         c.nodeX = c.x = 4;
         c.armReadyAt = 0;
         r.events.arm = true;
      }
      if (c.nodeX === 0 && c.nodeZ === 0 && b.secretTurn === 1) {
         c.dx = 0;
         c.dz = -1;
      }
      if (c.sideHop && c.nodeX >= 6 && c.nodeZ !== 0 && c.distance === 0) {
         c.dx = 0;
         c.dz = -Math.sign(c.nodeZ);
      }
      const j = JUNCTION_X.indexOf(c.nodeX);
      if (j >= 0 && j < b.turns.length && c.nodeZ === 0 && c.distance === 0) {
         if (r.simMs - b.turnedAt[j] < 350 || b.jamUntil[j] > r.simMs)
            continue;
         const a = b.turns[j];
         c.dx = [1, 0, -1, 0][a];
         c.dz = [0, 1, 0, -1][a];
      }
      // The klaxon reverses every six seconds. Junction detents catch backing cells at a node.
      const speed = reverseOn(r) && c.dz === 0 ? -BELT_SPEED : BELT_SPEED;
      c.distance = Math.max(0, c.distance + speed * dt);
      c.x = c.nodeX + c.dx * c.distance;
      c.z = c.nodeZ + c.dz * c.distance;
      if (c.distance >= 2) {
         c.nodeX += c.dx * 2;
         c.nodeZ += c.dz * 2;
         c.distance = 0;
         c.x = c.nodeX + c.dx * c.distance;
         c.z = c.nodeZ + c.dz * c.distance;
         if (c.nodeX === 0 && c.nodeZ === -2) {
            b.secretCharged = true;
            r.events.secret = collectSecret(r.secrets, 0) || r.events.secret;
            resetCell(c, r.simMs + 4000);
         }
         else if ((!c.sideHop && Math.abs(c.nodeZ) >= 2) || c.nodeX < -8 || c.nodeX > 8)
            loseCell(r, c);
         else if (c.sideHop && c.nodeZ === 0) {
            c.sideHop = false;
            c.dx = 1;
            c.dz = 0;
         }
      }
      // The main press is bypassable by the human on the walkway. First teaching cell is safe.
      if (c.x > -1.3 && c.x < -0.7 && pressState(r.simMs) === "slam")
         loseCell(r, c);
   }
}
function tick(r: FactoryRun, ms: number, i: StepInput): void {
   r.simMs += ms;
   const dt = ms / 1000;
   const h = r.hero;
   const b = r.board;
   const cfg = LEVELS[r.level];
   comboTick(r.combo, COMBO, r.simMs);
   if (r.boss && r.worldDriver) {
      stepBoss(r.boss, OVERSEER, ms, r.bossEv);
      if (r.bossEv.attack && r.boss.phase === 0)
         b.jamUntil[(r.boss.attack + r.seed) % b.turns.length] = r.simMs + 3000;
      if (r.boss.phase === 1 && b.bossReverseAt >= 0 && r.simMs - b.bossReverseAt < 3000) {
         b.bossDragged += BELT_SPEED * dt;
         if (b.bossDragged >= 2 && bossHit(r)) {
            b.bossDragged = 0;
            b.bossReverseAt = -1;
         }
      }
   }
   let x = i.moveX;
   let z = i.moveZ;
   const norm = Math.hypot(x, z);
   if (norm > 1) {
      x /= norm;
      z /= norm;
   }
   const w = inputToWorld(x, z, i.yaw);
   x = w.x;
   z = w.z;
   h.roll = i.roll;
   if (i.actionPressed && r.simMs >= h.powerReady) {
      h.powerReady = r.simMs + heroById(r.heroId).cooldownMs;
      h.powerUntil = r.simMs + (r.heroId === "riko" ? 450 : 2500);
      r.events.power = true;
      if (r.heroId === "nami" && !h.grounded && h.airJump) {
         h.vy = 8;
         h.airJump = false;
         r.events.jump = true;
      }
      if (r.heroId === "riko") {
         if (Math.hypot(h.x + 6, h.z + 4) < 2.2)
            r.crateBroken = true;
         for (let j = 0; j < b.turns.length; j++)
            if (Math.hypot(h.x - JUNCTION_X[j], h.z) < 4)
               b.jamUntil[j] = 0;
         // A dash flicks nearby cells one neighbouring belt (2 m) in the chosen direction.
         for (const c of b.cells)
            if (c.active && Math.hypot(c.x - h.x, c.z - h.z) < 1.7) {
               const nx = Math.max(-8, Math.min(6, Math.round((c.x + (x < 0 ? -2 : 2)) / 2) * 2));
               c.nodeX = c.x = nx;
               c.nodeZ = c.z = Math.abs(z) > Math.abs(x) ? Math.sign(z) * 2 : 0;
               c.sideHop = c.nodeZ !== 0;
               c.distance = 0;
               c.dx = 1;
               c.dz = 0;
            }
      }
      if (r.heroId === "zuno")
         for (const c of b.cells)
            if (c.active && Math.hypot(c.x - h.x, c.z - h.z) <= 4) {
               c.nodeX = c.x = Math.max(-8, Math.min(6, Math.round(h.x / 2) * 2));
               c.nodeZ = c.z = Math.abs(h.z) > 1 ? Math.sign(h.z) * 2 : 0;
               c.sideHop = c.nodeZ !== 0;
               c.distance = 0;
               c.dx = 1;
               c.dz = 0;
            }
   }
   const active = h.powerUntil > r.simMs;
   if (i.jumpPressed && (h.grounded || (r.heroId === "nami" && h.airJump))) {
      if (!h.grounded)
         h.airJump = false;
      h.vy = 8;
      h.grounded = false;
      h.drop = false;
      r.events.jump = true;
   }
   if (!h.grounded && i.roll && h.vy < 0) {
      h.vy = -14;
      h.drop = true;
   }
   const speed = active && r.heroId === "riko" ? 11 : i.roll ? 6.4 : 4.6;
   h.vx = x * speed;
   h.vz = z * speed;
   if (h.grounded && Math.abs(h.z) < 0.95)
      h.vx += (reverseOn(r) ? -1 : 1) * BELT_SPEED;
   const oldX = h.x, oldZ = h.z;
   h.x = Math.max(-9, Math.min(9, h.x + h.vx * dt));
   h.z = Math.max(-5, Math.min(5, h.z + h.vz * dt));
   // Cracked crate and ghost crate are optional routes, never the mandatory route.
   const cracked = h.x < -5 && h.x > -7 && h.z < -3.2;
   const ghost = h.x > -5 && h.x < -3 && h.z < -3.2;
   if ((cracked && !r.crateBroken) || (ghost && !(active && r.heroId === "vexa"))) {
      h.x = oldX;
      h.z = oldZ;
   }
   const floor = floorAt(h.x, h.z);
   const wasGrounded = h.grounded;
   if (h.grounded && floor <= h.y + 0.15)
      h.y = floor;
   else if (h.grounded && floor > h.y + 0.15) {
      h.x = oldX;
      h.z = oldZ;
   }
   if (!h.grounded) {
      h.vy -= 20 * dt;
      h.y += h.vy * dt;
      if (h.y <= floor && h.vy < 0) {
         if (r.boss?.phase === 2 && h.drop && h.x > 5 && h.z < -3 && !r.ventLatch) {
            if (bossHit(r))
               r.ventLatch = true;
         }
         h.y = floor;
         h.vy = 0;
         h.grounded = true;
         h.airJump = true;
         r.events.land = true;
      }
   }
   if (!h.grounded && wasGrounded)
      h.airJump = true;
   if (!h.grounded)
      r.ventLatch = false;
   let plate = -1;
   for (let j = 0; j < b.turns.length; j++)
      if (Math.hypot(h.x - JUNCTION_X[j], h.z - 2) < 0.7 && h.y < 0.5)
         plate = j;
   if (plate >= 0 && plate !== h.plate && i.roll)
      rotateSwitch(r, plate);
   // Fifth is the boss reversal plate; the hidden sixth feeds a side charger.
   if (Math.hypot(h.x - 6, h.z - 4) < 0.7 && h.y < 0.5) {
      plate = 4;
      if (h.plate !== 4 && i.roll) {
         if (b.bossReverseAt < 0 || r.simMs - b.bossReverseAt >= 3000) {
            b.bossReverseAt = r.simMs;
            b.bossDragged = 0;
         }
         r.events.turn = true;
      }
   }
   if (Math.hypot(h.x, h.z + 2) < 0.65 && h.y < 0.5) {
      plate = 5;
      if (h.plate !== 5 && i.roll) {
         b.secretTurn = 1 - b.secretTurn;
         r.events.turn = true;
      }
   }
   h.plate = plate;
   // Co-op helper can rotate its own high table, Nami reaches this without the long ramp.
   if (h.y > 1.8 && Math.hypot(h.x - 4, h.z + 4) < 0.65 && i.roll && !wasGrounded)
      rotateSwitch(r, Math.min(2, b.turns.length - 1));
   for (let j = 0; j < ORBS.length; j++) {
      const o = ORBS[j];
      const reach = active && r.heroId === "zuno" ? 4 : 0.75;
      if (!r.collected[j] && Math.hypot(h.x - o.x, h.z - o.z, h.y + 0.65 - o.y) < reach) {
         r.collected[j] = 1;
         r.orbs++;
         r.events.pickup = true;
         comboHit(r.combo, COMBO, r.simMs, 40);
      }
   }
   if (active && r.heroId === "vexa" && h.x < -3 && h.x > -5 && h.z < -3.5)
      r.events.secret = collectSecret(r.secrets, 1) || r.events.secret;
   if (h.y >= 1.9 && h.x > 6.8 && h.z < -3.6)
      r.events.secret = collectSecret(r.secrets, 2) || r.events.secret;
   const armCycle = Math.floor(r.simMs / 5000);
   if (cfg.arms && armCycle !== r.armCycle) {
      r.armCycle = armCycle;
      if (Math.hypot(h.x, h.z + 2) < 0.9) {
         h.x = 4;
         h.z = -4;
         h.y = 2;
         h.grounded = true;
         r.events.arm = true;
      }
   }
   if (r.boss?.step === "attack" && r.boss.phase === 0 && h.y < 0.6 && Math.hypot(h.x - 6, h.z + 2.4) < 2.7)
      hurt(r);
   if (h.y < 0.6 && Math.abs(h.x + 1) < 0.65 && Math.abs(h.z) < 0.9 && pressState(r.simMs) === "slam")
      hurt(r);
   if (h.y < 1.5 && Math.abs(h.x + 3) < 0.4 && h.z > -1.2 && h.z < 1.2 && laserOn(r, 1))
      hurt(r);
   if (h.y < 1.5 && Math.abs(h.x - 5) < 0.4 && h.z > -1.2 && h.z < 1.2 && laserOn(r))
      hurt(r);
   // Tread bot, patrol bot and drone have distinct readable lanes and never block all paths.
   if (r.level >= 2 && h.y < 0.7 && Math.hypot(h.x - (-1 + Math.sin(r.simMs / 1600) * 2), h.z - 4.5) < 0.65)
      hurt(r);
   if (r.level >= 3 && h.y < 0.7 && Math.hypot(h.x - 5, h.z - (2 + Math.sin(r.simMs / 1800) * 2)) < 0.6)
      hurt(r);
   if (r.level >= 4 && h.y > 0.8 && Math.hypot(h.x - 2 - Math.sin(r.simMs / 1700) * 2, h.z + 3) < 0.7)
      hurt(r);
   if (r.worldDriver)
      cellStep(r, dt);
   const clear = b.charged >= cfg.cells && (!r.boss || r.boss.step === "done");
   if (clear && h.x > 7.5 && Math.abs(h.z) < 1.4 && h.y < 1) {
      r.finishMs = r.simMs;
      r.ended = "win";
   }
   else if (r.simMs >= cfg.durationMs)
      r.ended = "timeup";
}
export function step(r: FactoryRun, dtMs: number, i: StepInput): FactoryRun["events"] {
   for (const k of Object.keys(r.events) as (keyof FactoryRun["events"])[])
      r.events[k] = false;
   if (r.ended || !Number.isFinite(dtMs) || dtMs <= 0)
      return r.events;
   // Max 10 ms microsteps: no tunnelling, stable press/switch edges at 30/60/144 Hz.
   let left = Math.min(250, dtMs);
   let first = true;
   while (left > 0.00001 && !r.ended) {
      const ms = Math.min(10, left, LEVELS[r.level].durationMs - r.simMs);
      if (ms <= 0) {
         r.ended = "timeup";
         break;
      }
      tick(r, ms, first ? i : { ...i, jumpPressed: false, actionPressed: false });
      left -= ms;
      first = false;
   }
   return r.events;
}
export function runTimeMs(finishMs: number, orbs: number, comboMs = 0): number { return Math.max(1, Math.round(finishMs - Math.min(8, orbs) * ORB_MS - comboMs)); }
export const bonusBound = (id: LevelId) => 8 * ORB_MS + comboMaxBonus({ combo: COMBO, sources: [{ count: 8 + LEVELS[id].junctions, base: 40 }] });
// No power can deliver before the first 2 s dispenser delay. Lower bound deliberately includes
// maximum orb + once-only flow discounts; there are no repeatable score sources or secret bonuses.
export function proposeLimits(id: LevelId): ScoringRules {
   const earliest = id === 5 ? 19050 : 2000 + (LEVELS[id].cells - 1) * 5000;
   const floor = Math.max(1, Math.floor(earliest - bonusBound(id)));
   return { kind: "time", base: 0, maxPointsPerSec: 0, timeBaseMs: LEVELS[id].durationMs, minDurationMs: floor, maxDurationMs: LEVELS[id].durationMs, maxScore: Math.floor((LEVELS[id].durationMs - floor) / 10), unitLabel: "time", display: "time" };
}
export const PROPOSED_LEVEL_LIMITS = { 1: proposeLimits(1), 2: proposeLimits(2), 3: proposeLimits(3), 4: proposeLimits(4), 5: proposeLimits(5) };
export function finalScore(s: Pick<RunState, "score" | "stats" | "endReason" | "elapsedMs">) {
   return { score: s.score, durationMs: s.endReason === "win" ? runTimeMs(s.stats.finishMs ?? s.elapsedMs, s.stats.orbs ?? 0, s.stats.comboMs ?? 0) : s.elapsedMs };
}
