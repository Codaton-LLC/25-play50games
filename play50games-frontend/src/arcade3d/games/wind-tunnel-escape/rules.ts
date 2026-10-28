// Deterministic fan-routing simulation. Positions are feet in metres; forward is -z.
import type { LevelId } from "../../types";
import type { RunState } from "../../core/types";
import { inputToWorld } from "../../core/math";
import { createCombo, comboHit, comboTick, comboBreak, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, stepBoss, hitBoss, type BossState, type BossEvents } from "../../menu2/boss/boss";
import { LEVELS, type WindLevel } from "./levels";
import { COMBO, GALE } from "./progression";
import type { HeroId } from "./heroes";

export interface Point { x: number; y: number; z: number }
export interface Fan extends Point { index: number; room: number; dir: number; on: boolean; rail: boolean; auto: boolean; baseX: number; length: number }
export interface Platform extends Point { hw: number; hd: number; room: number; lift: boolean }
export interface Orb extends Point { taken: boolean; bonus: boolean }
export interface Gate extends Point { hero: HeroId; open: boolean; room: number }
export interface Crate extends Point { delivered: boolean; fan: number }
export interface Hero extends Point { vx: number; vy: number; vz: number; hp: number; grounded: boolean; jumps: number }
export interface WindInput { moveX: number; moveZ: number; yaw?: number; jumpPressed: boolean; jumpHeld: boolean; actionPressed: boolean }
export const createInput = (): WindInput => ({ moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false });
export interface Events { rotate: boolean; power: boolean; jump: boolean; land: boolean; orb: boolean; secret: boolean; hit: boolean; checkpoint: boolean; bossHit: boolean; collapse: boolean; bell: boolean }
const events = (): Events => ({ rotate: false, power: false, jump: false, land: false, orb: false, secret: false, hit: false, checkpoint: false, bossHit: false, collapse: false, bell: false });
export interface WindRun {
   level: LevelId; config: WindLevel; heroId: HeroId; hero: Hero; ms: number;
   fans: Fan[]; platforms: Platform[]; orbs: Orb[]; gates: Gate[]; crates: Crate[];
   room: number; checkpoint: Point; solved: boolean[]; enteredAt: number[];
   stormMs: number; stormZ: number; stormTouched: boolean; damageAt: number;
   hint: boolean; riding: boolean; nearFan: number; powerUntil: number; powerReady: number;
   combo: ComboState; linked: boolean[]; secrets: boolean[]; boss: BossState | null; bossEvents: BossEvents;
   returned: boolean[]; escapeAt: number; end: "win" | "lose" | "timeup" | null; finishMs: number; hits: number; events: Events;
}
export const ROOM_LENGTH = 18;
export const ROOM_RISE = 6;
export const CURRENT_SPEED = 7;
// Currents sum as vectors, then cap to 12 m/s; steering and dash are applied before a FINAL
// horizontal cap of 16. Thus forward progress <= 16 m/s, for every hero, yaw and fan overlap.
export const MAX_FORWARD_SPEED = 16;
export const FAN_REACH = 3.2;
export const DIRS: readonly Point[] = [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];
export const rotateFan = (f: Fan) => { f.dir = (f.dir + 1) % 4; };
export const courseOffset = (id: LevelId) => LEVELS[id].boss ? 22 : 0;
export const finishZ = (id: LevelId) => -(courseOffset(id) + LEVELS[id].rooms * ROOM_LENGTH);
export const roomStart = (r: WindRun, room: number) => -(courseOffset(r.level) + room * ROOM_LENGTH);

export function createRun(level: LevelId = 1, heroId: HeroId = "nami"): WindRun {
   const config = LEVELS[level];
   const fans: Fan[] = [];
   const platforms: Platform[] = [];
   const orbs: Orb[] = [];
   const gates: Gate[] = [];
   const addFan = (x: number, y: number, z: number, room: number, dir: number, auto = false, rail = false) => {
      fans.push({ index: fans.length, x, baseX: x, y, z, room, dir, on: true, auto, rail, length: dir === 0 ? 8 : 14 });
   };
   if (config.boss) {
      platforms.push({ x: 0, y: 0, z: -10, hw: 8, hd: 13, room: -1, lift: false });
      for (const x of [-4, 0, 4]) addFan(x, 0, -5, -1, 0);
   }
   for (let i = 0; i < config.rooms; i++) {
      const z = -(courseOffset(level) + i * ROOM_LENGTH);
      const y = i * ROOM_RISE;
      platforms.push({ x: 0, y, z: z - 2, hw: 7, hd: 4, room: i, lift: false });
      platforms.push({ x: 0, y: y + 6, z: z - 15, hw: 7, hd: 3, room: i, lift: false });
      // The first lift is ready. L1 beat 2 asks for a rotation; beat 3 chains both fans.
      addFan(0, y, z - 3, i, 0);
      addFan(0, y + 6, z - 3, i, i === 0 && level === 1 ? 1 : 2);
      if (config.crosswinds) addFan(-2.8, y + 6, z - 9, i, 2);
      if (config.rails) {
         fans[fans.length - 2].rail = true;
         addFan(5, y + 3, z - 7, i, 0, true, true);
      }
      if (config.lifts) platforms.push({ x: -3, y, z: z - 8, hw: 2.2, hd: 2.2, room: i, lift: true });
      for (let j = 0; j < 3; j++) orbs.push({ x: j === 1 ? 1 : 0, y: y + 6.8, z: z - 5 - j * 4, taken: false, bonus: false });
      // Each room has a five-hero side gallery; the main route never needs a power.
      ["riko", "nami", "kiro", "zuno", "vexa"].forEach((hero, k) => {
         const gx = k % 2 ? -5 : 5;
         const gz = z - 1 - Math.floor(k / 2) * 1.6;
         gates.push({ x: gx, y: y + (hero === "nami" ? 3 : 0), z: gz, hero: hero as HeroId, room: i, open: false });
         orbs.push({ x: gx, y: y + (hero === "nami" ? 3.8 : 0.8), z: gz, taken: false, bonus: true });
      });
      platforms.push({ x: -5, y: y + 3, z: z - 1, hw: 1.4, hd: 1.2, room: i, lift: false });
   }
   const hero: Hero = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hp: 5, grounded: true, jumps: 0 };
   return {
      level, config, heroId, hero, ms: 0, fans, platforms, orbs, gates,
      crates: config.boss ? [-4, 0, 4].map((x, fan) => ({ x, y: 0.8, z: -5, fan, delivered: false })) : [],
      room: 0, checkpoint: { x: 0, y: 0, z: 0 }, solved: Array(config.rooms).fill(false),
      enteredAt: Array(config.rooms).fill(-1), stormMs: 0, stormZ: 35, stormTouched: false, damageAt: -1000,
      hint: false, riding: false, nearFan: -1, powerUntil: -1, powerReady: 0,
      combo: createCombo(), linked: Array(config.rooms).fill(false), secrets: [false, false, false],
      boss: config.boss ? createBoss(GALE) : null, bossEvents: createBossEvents(), returned: [false, false, false],
      escapeAt: -1, end: null, finishMs: 0, hits: 0, events: events(),
   };
}

export function fanX(f: Fan, ms: number): number { return f.baseX + (f.rail ? Math.sin(ms / 1500 + f.index) * 1.6 : 0); }
export function fanDir(f: Fan, ms: number): number { return (f.dir + (f.auto ? Math.floor(ms / 3000) : 0)) % 4; }

/** Axis-aligned 8–14 m jets, 3.2 m wide. Overlaps add (crosswinds); no gravity inside a jet. */
export function currentAt(r: WindRun, p: Point): Point {
   const v = { x: 0, y: 0, z: 0 };
   for (const f of r.fans) {
      if (!f.on || (f.room < 0 && r.boss && r.boss.hp > 0)) continue;
      const d = DIRS[fanDir(f, r.ms)];
      const dx = p.x - fanX(f, r.ms), dy = p.y - f.y, dz = p.z - f.z;
      const along = dx * d.x + dy * d.y + dz * d.z;
      const across = d.y ? Math.hypot(dx, dz) : d.x ? Math.hypot(dy, dz) : Math.hypot(dx, dy);
      if (along >= -0.6 && along <= f.length && across <= 1.8) {
         v.x += d.x * 7; v.y += d.y * 7; v.z += d.z * 7;
      }
   }
   const n = Math.hypot(v.x, v.y, v.z);
   if (n > 12) { v.x *= 12 / n; v.y *= 12 / n; v.z *= 12 / n; }
   return v;
}

export function liftTop(r: WindRun, p: Platform): number {
   if (!p.lift) return p.y;
   const fan = r.fans.find((f) => f.room === p.room && f.y === p.y);
   return p.y + (fan?.on && fanDir(fan, r.ms) === 0 ? 6 * (0.5 + Math.sin(r.ms / 2200) * 0.5) : 0);
}

function damage(r: WindRun, storm = false) {
   if (r.ms - r.damageAt < 1000 || (r.heroId === "kiro" && r.powerUntil > r.ms) || (r.heroId === "vexa" && r.powerUntil > r.ms)) return;
   r.damageAt = r.ms; r.hero.hp--; r.hits++; r.events.hit = true;
   if (storm) r.stormTouched = true;
   comboBreak(r.combo);
   if (r.hero.hp <= 0) r.end = "lose";
}

function power(r: WindRun) {
   if (r.ms < r.powerReady) return;
   r.powerReady = r.ms + (r.heroId === "nami" ? 2500 : 6500);
   r.powerUntil = r.ms + (r.heroId === "riko" ? 500 : 2500);
   r.events.power = true;
   if (r.heroId === "nami" && !r.hero.grounded && r.hero.jumps < 2) { r.hero.vy = 9; r.hero.jumps++; }
   for (const g of r.gates) {
      if (!g.open && g.hero === r.heroId && Math.hypot(g.x - r.hero.x, g.z - r.hero.z) < 3.6) {
         g.open = true;
         if (g.hero === "riko" || g.hero === "vexa") {
            // The cracked vent / maintenance duct is a real, optional six metre shortcut.
            r.hero.z -= 6;
            if (g.hero === "vexa" && !r.secrets[1]) { r.secrets[1] = true; r.events.secret = true; }
         }
      }
   }
}

function bossStep(r: WindRun, dt: number) {
   const b = r.boss;
   if (!b || r.escapeAt >= 0) return;
   stepBoss(b, GALE, dt, r.bossEvents);
   if (b.step === "attack" && r.hero.z < -8 && Math.abs(r.hero.x) < 2.5) {
      if (b.phase === 0) r.hero.z = Math.min(1, r.hero.z + dt * 0.004);
      else r.hero.z = Math.max(-12, r.hero.z - dt * 0.003);
      damage(r);
   }
   if (b.step === "vulnerable") {
      if (b.phase === 0) {
         const i = r.fans.slice(0, 3).findIndex((f, k) => !r.returned[k] && f.on && f.dir === 1);
         if (i >= 0) {
            r.returned[i] = true; r.fans[i].dir = 0;
            hitBoss(b, GALE, 1, r.bossEvents); r.events.bossHit = true;
         }
      } else {
         for (const c of r.crates) {
            const f = r.fans[c.fan];
            if (c.delivered || !f.on || f.dir !== 1) continue;
            c.z -= dt * 0.007;
            if (c.z <= -12) {
               c.delivered = true; f.dir = 0;
               hitBoss(b, GALE, 1, r.bossEvents); r.events.bossHit = true;
               break;
            }
         }
      }
   }
   if (b.step === "done") {
      r.escapeAt = r.ms; r.events.collapse = true;
      r.hero.x = 0; r.hero.y = 0; r.hero.z = -22; r.hero.vy = 0;
      r.checkpoint = { x: 0, y: 0, z: -22 };
      // Four rooms in 25s: these escape fans start aligned, still editable by the player.
      for (const f of r.fans) if (f.room >= 0) f.dir = f.y === f.room * 6 ? 0 : 1;
   }
}

function substep(r: WindRun, dt: number, i: WindInput) {
   r.ms += dt;
   const h = r.hero, seconds = dt / 1000;
   const beforeY = h.y;
   const wasGrounded = h.grounded;
   r.nearFan = -1;
   let nearest = FAN_REACH;
   for (const f of r.fans) {
      const d = Math.hypot(h.x - fanX(f, r.ms), h.y - f.y, h.z - f.z);
      if (d < nearest) { nearest = d; r.nearFan = f.index; }
   }
   if (i.actionPressed) {
      if (r.nearFan >= 0) {
         const f = r.fans[r.nearFan];
         if (i.jumpHeld) f.on = !f.on; else rotateFan(f);
         r.events.rotate = true;
      } else power(r);
   }
   const world = inputToWorld(Number.isFinite(i.moveX) ? i.moveX : 0, Number.isFinite(i.moveZ) ? i.moveZ : 0, Number.isFinite(i.yaw) ? i.yaw! : 0);
   const mag = Math.max(1, Math.hypot(world.x, world.z));
   const jet = currentAt(r, h);
   r.riding = Math.hypot(jet.x, jet.y, jet.z) > 0;
   h.vx = world.x / mag * (r.riding ? 2 : 5) + jet.x;
   h.vz = world.z / mag * (r.riding ? 2 : 5) + jet.z;
   if (r.heroId === "riko" && r.powerUntil > r.ms) { h.vz -= 12; }
   const horizontal = Math.hypot(h.vx, h.vz);
   if (horizontal > MAX_FORWARD_SPEED) { h.vx *= MAX_FORWARD_SPEED / horizontal; h.vz *= MAX_FORWARD_SPEED / horizontal; }
   if (i.jumpPressed && (h.grounded || (r.heroId === "nami" && h.jumps < 2))) {
      h.vy = 9; h.jumps++; h.grounded = false; r.events.jump = true;
   }
   if (r.riding && !r.events.jump) h.vy = jet.y;
   else h.vy -= 22 * seconds;
   h.x = Math.max(-7, Math.min(7, h.x + h.vx * seconds));
   h.z += h.vz * seconds;
   h.y += h.vy * seconds;
   h.grounded = false;
   for (const p of r.platforms) {
      const top = liftTop(r, p);
      if (Math.abs(h.x - p.x) > p.hw || Math.abs(h.z - p.z) > p.hd) continue;
      if (h.vy <= 0 && beforeY >= top - (p.lift ? 0.25 : 0.05) && h.y <= top + 0.05) {
         h.y = top; h.vy = 0; h.grounded = true; h.jumps = 0;
      }
   }
   if (h.grounded && !wasGrounded) r.events.land = true;
   if (r.boss && r.escapeAt < 0) h.z = Math.max(-13, h.z);
   bossStep(r, dt);
   const room = Math.max(0, Math.min(r.config.rooms - 1, Math.floor((-h.z - courseOffset(r.level)) / 18)));
   r.room = room;
   if (r.enteredAt[room] < 0) r.enteredAt[room] = r.ms;
   const fs = r.fans.filter((f) => f.room === room);
   const correct = fs.length >= 2 && fs[0].on && fs[0].dir === 0 && fs[1].on && fs[1].dir === 1;
   r.hint = r.ms - r.enteredAt[room] >= 20000 && !correct;
   if (correct) r.solved[room] = true;
   // A setup pauses the front, not the run clock. After solving, the 30-second trail begins.
   const setup = !r.solved[room] || (r.level === 1 && room < r.config.rooms - 1);
   if (!setup && (!r.boss || r.escapeAt >= 0)) r.stormMs += dt;
   r.stormZ = 35 - Math.max(0, r.stormMs - 30000) * (r.escapeAt >= 0 ? 0.008 : 0.0035);
   if (r.escapeAt >= 0) r.stormZ = -22 - Math.max(0, r.ms - r.escapeAt - 4000) * 0.003;
   if (h.z > r.stormZ) damage(r, true);
   if (r.level >= 2 && Math.abs(h.x) > 4 && Math.abs(h.z - (roomStart(r, room) - 11)) < 0.7) damage(r);
   if (r.config.rails && Math.hypot(h.x - Math.sin(r.ms / 900) * 4, h.y - (room * 6 + 6), h.z - (roomStart(r, room) - 10)) < 1.1) damage(r);
   if (h.y < room * 6 - 8) {
      damage(r); Object.assign(h, r.checkpoint); h.vy = 0; h.jumps = 0;
   }
   const endOfRoom = roomStart(r, room) - 14;
   if (h.z < endOfRoom && h.y >= room * 6 + 5 && !r.linked[room]) {
      r.linked[room] = true; r.events.checkpoint = true;
      r.checkpoint = { x: 0, y: room * 6 + 6, z: roomStart(r, room) - 16 };
      comboHit(r.combo, COMBO, r.ms, 100);
   }
   const reach = r.heroId === "zuno" && r.powerUntil > r.ms ? 7 : 1.35;
   for (const o of r.orbs) {
      if (o.taken || Math.hypot(h.x - o.x, h.y + 0.7 - o.y, h.z - o.z) > reach) continue;
      if (o.bonus) {
         const g = r.gates.find((g) => Math.abs(g.x - o.x) < 0.1 && Math.abs(g.z - o.z) < 0.1);
         if (g && !g.open && g.hero !== "zuno" && g.hero !== "nami") continue;
      }
      o.taken = true; r.events.orb = true;
      comboHit(r.combo, COMBO, r.ms, 50);
   }
   // Creative wrong-way fan route, Vexa duct, and the correctly tuned anemometer.
   if (!r.secrets[0] && fs.some((f) => f.dir === 2 && f.on) && h.x > 4 && h.y > room * 6 + 5) { r.secrets[0] = true; r.events.secret = true; }
   if (!r.secrets[2] && correct && Math.hypot(h.x + 4, h.z - (roomStart(r, room) - 15), h.y - (room * 6 + 6)) < 2) { r.secrets[2] = true; r.events.secret = true; }
   comboTick(r.combo, COMBO, r.ms);
   if (r.ms >= r.config.durationMs || (r.escapeAt >= 0 && r.ms - r.escapeAt > 25000)) r.end = "timeup";
   if (!r.end && h.z <= finishZ(r.level) + 0.8 && h.y >= r.config.rooms * 6 - 1 && (!r.boss || r.escapeAt >= 0)) {
      r.end = "win"; r.finishMs = r.ms; r.events.bell = true;
   }
}

/** Integrate in <= 8 ms slices, with a single edge per outer frame (keyboard = touch). */
export function step(r: WindRun, dtMs: number, input: WindInput): Events {
   for (const key of Object.keys(r.events) as Array<keyof Events>) r.events[key] = false;
   if (r.end || !Number.isFinite(dtMs) || dtMs <= 0) return r.events;
   let left = Math.min(250, dtMs), first = true;
   while (left > 0.001 && !r.end) {
      const dt = Math.min(8, left);
      substep(r, dt, first ? input : { ...input, jumpPressed: false, actionPressed: false });
      first = false; left -= dt;
   }
   return r.events;
}

// Score proof: horizontal progress <=16 m/s. Optional ducts skip <=6 m per gate, at most
// 2 eligible gates/room. Account for ALL shortcuts even though only one hero is played.
// All pickups, flow, stars and secrets add NO leaderboard score/time discounts.
export function minimumMs(id: LevelId): number {
   const distance = LEVELS[id].rooms * ROOM_LENGTH - 0.8 - LEVELS[id].rooms * 12;
   return Math.floor(distance / MAX_FORWARD_SPEED * 1000 / 100) * 100;
}
export const limitsFor = (id: LevelId) => ({
   kind: "time" as const, minDurationMs: minimumMs(id), maxDurationMs: LEVELS[id].durationMs,
   timeBaseMs: LEVELS[id].durationMs, maxScore: Math.floor((LEVELS[id].durationMs - minimumMs(id)) / 10),
});
export const PROPOSED_LEVEL_LIMITS = { 1: limitsFor(1), 2: limitsFor(2), 3: limitsFor(3), 4: limitsFor(4), 5: limitsFor(5) };
export function finalScore(s: RunState) {
   const id = (s.stats.windLevel ?? 1) as LevelId;
   const durationMs = Math.ceil(s.stats.finishMs || s.elapsedMs);
   return { durationMs, score: Math.max(0, Math.floor((LEVELS[id].durationMs - durationMs) / 10)) };
}
