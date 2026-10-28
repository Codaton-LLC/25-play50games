import type { LevelId } from "../../types";
import { createCombo, comboHit, comboTick, DEFAULT_COMBO } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, stepBoss, hitBoss, type BossConfig } from "@/arcade3d/menu2/boss/boss";
import { createSecretTracker, collectSecret, type SecretSpec } from "@/arcade3d/menu2/secrets/secrets";
import { evaluateStars } from "@/arcade3d/menu2/stars/stars";
import { LEVELS } from "./levels";
import { DEFAULT_HERO, type HeroId } from "./heroes";
export const QUEEN: BossConfig = {
   id: "soot-bat-queen", name: "Soot Bat Queen", maxHp: 7, introMs: 1000, transitionMs: 800,
   hitFlashMs: 220, oneHitPerWindow: true, defeatMs: 1600, slowMo: { scale: 0.2, durationMs: 1200 },
   phases: [
      { id: "wings", name: "Relight three lanterns", endsAt: 4 / 7, attacks: [{ id: "blackout", telegraphMs: 1000, attackMs: 500, vulnerableMs: 4500 }] },
      { id: "dive", name: "Bounce into her dive", endsAt: 1 / 7, attacks: [{ id: "dive", telegraphMs: 1200, attackMs: 800, vulnerableMs: 3200 }] },
      { id: "brazier", name: "Throw ember into the roof brazier", endsAt: 0, attacks: [{ id: "roof", telegraphMs: 1200, attackMs: 800, vulnerableMs: 4000 }] },
   ],
};
export const SECRETS: readonly SecretSpec[] = [
   { id: "first-light", kind: "sticker", name: "First Light" },
   { id: "lantern-room", kind: "shard", name: "Hidden lantern room", hero: "vexa" },
   { id: "roof-brazier", kind: "sticker", name: "Nine Lights" },
];
export interface Pad { x: number; y: number; z: number; kind: "plain" | "glyph" | "lantern" | "balcony"; }
export interface StepInput { moveX: number; moveZ: number; yaw: number; jumpPressed: boolean; actionPressed: boolean; }
export const createStepInput = (): StepInput => ({ moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false });
export function courseFor(id: LevelId): Pad[] {
   const l = LEVELS[id];
   return [{ x: 0, y: 0, z: 0, kind: "plain" }, ...Array.from({ length: l.lanterns }, (_, i): Pad => ({
      x: Math.sin(i * 1.7) * 2.2, z: Math.cos(i * 1.7) * 1.5, y: (i + 1) * l.height / l.lanterns,
      kind: "lantern",
   }))];
}
export function createRun(level: LevelId = 1, heroId: HeroId = DEFAULT_HERO) {
   const pads = courseFor(level);
   return { level, heroId, pads, hero: { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, grounded: true, airJump: false },
      ms: 0, ember: LEVELS[level].emberMs, minEmber: LEVELS[level].emberMs, lit: pads.map((_, i) => i === 1 ? 12000 : 0),
      visited: pads.map(() => false), crumble: pads.map(() => 0), checkpoint: 0, hits: 0, cooldown: 0, powerUntil: 0,
      orbs: new Uint8Array(5), sparks: new Uint8Array(5), combo: createCombo(), secrets: createSecretTracker(SECRETS),
      boss: level === 5 ? createBoss(QUEEN) : null, bossEvents: createBossEvents(), relights: 0,
      bossActive: false, lastFlap: -1, finishMs: 0, ended: null as "win" | "timeup" | null,
      event: "" as string, lastPad: 0, allies: [] as { x: number; y: number; z: number; radius: number }[],
   };
}
export type TempleRun = ReturnType<typeof createRun>;
export function padAt(r: TempleRun, i: number): Pad {
   const p = r.pads[i];
   return r.level === 2 && i > 1 ? { ...p, x: p.x + 2 * Math.sin(r.ms / 3000 * Math.PI * 2 + i) } : p;
}
export const emberRadius = (r: TempleRun) => 1.5 + 4.5 * r.ember / LEVELS[r.level].emberMs;
const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function illuminated(r: TempleRun, p: Pad): boolean {
   if (distance(r.hero, p) <= emberRadius(r)) return true;
   if (r.allies.some((a) => distance(a, p) <= a.radius)) return true;
   return r.lit.some((t, i) => t > r.ms && distance(padAt(r, i), p) <= 5);
}
export function ignite(r: TempleRun, i: number) {
   r.lit[i] = r.ms + (r.level === 3 && r.ms % 9000 > 6000 ? 6000 : 12000);
   r.ember = LEVELS[r.level].emberMs;
   r.visited[i] = true;
   r.checkpoint = Math.max(r.checkpoint, i);
   r.lastPad = i;
   r.event = "ignite";
   comboHit(r.combo, DEFAULT_COMBO, r.ms, 0);
   if (r.bossActive && r.boss?.phase === 0 && r.boss.step === "vulnerable") {
      r.relights++;
      if (r.relights >= 3) { hitBoss(r.boss, QUEEN, 1, r.bossEvents); r.relights = 0; r.event = "boss"; }
   }
}
export function respawn(r: TempleRun) {
   const p = padAt(r, r.checkpoint);
   Object.assign(r.hero, { x: p.x, y: p.y + 0.1, z: p.z, vy: 9, grounded: false });
   r.ember = LEVELS[r.level].emberMs; r.hits++; r.event = "hurt";
}
export function step(r: TempleRun, dtMs: number, input: StepInput): void {
   if (r.ended) return;
   const dt = Math.min(50, Math.max(0, dtMs)) / 1000;
   r.ms += dt * 1000; r.event = "";
   r.ember = Math.max(0, r.ember - dt * 1000); r.minEmber = Math.min(r.minEmber, r.ember);
   comboTick(r.combo, DEFAULT_COMBO, r.ms);
   const h = r.hero;
   const mx = input.moveX * Math.cos(input.yaw) + input.moveZ * Math.sin(input.yaw);
   const mz = input.moveZ * Math.cos(input.yaw) - input.moveX * Math.sin(input.yaw);
   const norm = Math.max(1, Math.hypot(mx, mz));
   const dash = r.heroId === "riko" && r.powerUntil > r.ms;
   h.vx = mx / norm * (dash ? 12 : 5); h.vz = mz / norm * (dash ? 12 : 5);
   if (input.jumpPressed && (h.grounded || (r.heroId === "nami" && !h.airJump))) {
      h.airJump = !h.grounded; h.vy = 8; h.grounded = false; r.event = "jump";
   }
   if (input.actionPressed) {
      if (!h.grounded && r.ember >= 3000) {
         r.ember -= 3000; r.event = "throw";
         let best = -1, d = 4;
         r.pads.forEach((p, i) => { const q = padAt(r, i); const dx = Math.hypot(q.x - h.x, q.z - h.z); if (q.y <= h.y && dx < d) { d = dx; best = i; } });
         if (best > 0) { const ember = r.ember; ignite(r, best); r.ember = ember; }
         if (r.bossActive && r.boss?.phase === 2 && h.y >= LEVELS[5].height && Math.hypot(h.x, h.z) < 3) hitBoss(r.boss, QUEEN, 1, r.bossEvents);
      }
      if (r.ms >= r.cooldown) { r.cooldown = r.ms + (r.heroId === "kiro" ? 20000 : 10000); r.powerUntil = r.ms + 3000; }
   }
   const oldY = h.y;
   h.x += h.vx * dt; h.z += h.vz * dt;
   if (!h.grounded) { h.vy -= 18 * dt; h.y += h.vy * dt; }
   else h.grounded = false;
   for (let i = r.pads.length - 1; i >= 0; i--) {
      const p = padAt(r, i);
      const radius = i === 0 ? 3.4 : 1.1;
      if (Math.hypot(h.x - p.x, h.z - p.z) > radius || h.vy > 0 || oldY < p.y - 0.08 || h.y > p.y + 0.08) continue;
      h.y = p.y; h.airJump = false;
      if (i > 0) { ignite(r, i); h.vy = 11.2; }
      else { h.vy = 0; h.grounded = true; }
      break;
   }
   // Light-dependent stepping stones connect each pair of cage lanterns.
   for (let i = 1; i < r.pads.length; i++) {
      const a = padAt(r, i - 1), b = padAt(r, i);
      const p: Pad = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, kind: "glyph" };
      const solid = illuminated(r, p) && !(r.level >= 3 && r.crumble[i] > 0 && r.ms - r.crumble[i] > 1200);
      if (solid && h.vy <= 0 && oldY >= p.y && h.y <= p.y && Math.hypot(h.x - p.x, h.z - p.z) < 1) {
         h.y = p.y; h.vy = 0; h.grounded = true; h.airJump = false;
         if (!r.crumble[i]) r.crumble[i] = r.ms;
      }
   }
   for (let j = 0; j < 5; j++) {
      const p = r.pads[Math.max(1, Math.round((j + 1) * (r.pads.length - 1) / 6))];
      const side = j > 2 ? 3.3 : 0;
      const o = { x: p.x + side, y: p.y + (j === 4 ? 2.5 : 1), z: p.z };
      if (!r.orbs[j] && distance(h, o) < (r.heroId === "zuno" && r.powerUntil > r.ms ? 6 : 1.2)) { r.orbs[j] = 1; r.event = "pickup"; }
      if (r.heroId === "zuno" && r.powerUntil > r.ms && !r.sparks[j] && distance(h, p) < 5) { r.sparks[j] = 1; r.ember = Math.min(LEVELS[r.level].emberMs, r.ember + 2000); }
   }
   if (r.powerUntil > r.ms && r.heroId === "riko" && h.x > 3) { r.lit.fill(r.ms + 20000); r.event = "brazier"; }
   if (r.heroId === "vexa" && r.powerUntil > r.ms && h.x < -3 && h.y > 2) collectSecret(r.secrets, 1);
   const fire = r.level > 1 && Math.abs(h.x) < 0.7 && h.y > 5 && r.ms % 5000 > 3500;
   if (fire && !(r.powerUntil > r.ms && (r.heroId === "kiro" || r.heroId === "vexa"))) respawn(r);
   if (r.level >= 4 && Math.floor(r.ms / 4000) !== Math.floor((r.ms - dt * 1000) / 4000)) {
      const i = 1 + Math.floor(r.ms / 4000) % (r.pads.length - 1); r.lit[i] = 0;
   }
   if (h.y < r.pads[r.checkpoint].y - 8 || Math.abs(h.x) > 12 || Math.abs(h.z) > 12) respawn(r);
   const top = LEVELS[r.level].height;
   if (r.level === 1 && r.visited.slice(1).every(Boolean)) collectSecret(r.secrets, 2);
   if (r.boss && h.y > top - 5) r.bossActive = true;
   if (r.bossActive && r.boss) {
      stepBoss(r.boss, QUEEN, dt * 1000, r.bossEvents);
      const flap = Math.floor(r.ms / 6000);
      if (r.boss.phase === 0 && flap !== r.lastFlap) { r.lastFlap = flap; r.lit.fill(0); r.relights = 0; r.event = "blackout"; }
      if (r.boss.phase === 1 && r.boss.step === "vulnerable" && h.vy > 1 && r.ember > 0 && h.y > top - 1 && Math.hypot(h.x, h.z) < 3) { hitBoss(r.boss, QUEEN, 1, r.bossEvents); r.event = "boss"; }
   }
   if ((r.level < 5 && h.y >= top + 1) || r.boss?.step === "done") {
      r.ended = "win"; r.finishMs = r.ms;
      if (r.minEmber >= 2000) collectSecret(r.secrets, 0);
   } else if (r.ms >= LEVELS[r.level].durationMs) r.ended = "timeup";
}
export function starResult(r: TempleRun) { return evaluateStars({ orbTotal: 5, goal: { kind: "time", targetMs: LEVELS[r.level].targetMs } }, { cleared: r.ended === "win", orbs: r.orbs.reduce((a,b) => a+b,0), goalValue: r.finishMs, hits: r.hits }); }
// A vertical-speed bound: bounce is the fastest ascent, even with Nami resetting upward velocity.
// Riko affects horizontal velocity only. No pickups, combo or secrets discount board time.
export const PROPOSED_LEVEL_LIMITS = Object.fromEntries(Object.values(LEVELS).map((l) => {
   const minDurationMs = Math.floor(l.height / 11.2 * 1000);
   return [l.id, { kind: "time" as const, maxScore: Math.floor((l.durationMs - minDurationMs) / 10), minDurationMs, timeBaseMs: l.durationMs, maxDurationMs: l.durationMs }];
})) as Record<LevelId, { kind: "time"; maxScore: number; minDurationMs: number; timeBaseMs: number; maxDurationMs: number }>;
export const finalScore = (s: { elapsedMs: number }) => Math.round(s.elapsedMs);
