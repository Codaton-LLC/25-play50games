// Switch Color Hero's rules: a deterministic auto-runner in fixed 8 ms substeps. The hero runs along -z
// at the level's speed in one of three lanes and switches its own colour (1-5, a tap, the HUD swatches).
// A gate is passed only in the matching colour; the wrong colour bounces the hero back 4 m, stuns it and
// costs a heart. Hazards (energy blocks, low walls, beams, gaps, sweepers) cost a heart too. Three hearts:
// the last one lost ends the run "lose" (unranked). Level 5 ends in Chroma's arena: his core gates passed
// in his windows hit him, and his defeat is the win.
//
// The proof (README "Scoring and the proof"): the hero never runs faster than speed + V_DASH, and the
// rules clamp its distance from the start to that pace every substep; a bounce or a respawn only puts it
// back. The finish is track.length away (level 5: the arena, then Chroma's windows).
import type { LevelId } from "@/arcade3d/types";
import type { RunState } from "@/arcade3d/core/types";
import { comboBreak, comboHit, comboMaxBonus, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, MAGNET_REACH, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { CHROMA, COMBO, COMBO_BASE_MS, SECRETS, STREAK_SECRET } from "./progression";
import { BOSS_GATES, LANES, START_Z, buildTrack, gateColor, sweeperX, type Gate, type Obstacle, type Track } from "./track";

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const SUB_MS = 8;
export const G = 22;
export const V_JUMP = 7.5;
export const V_LATERAL = 14;
export const SLIDE_MS = 650;
export const STUN_MS = 800;
export const BOUNCE = 4;
export const HEARTS = 3;
export const FALL_MS = 700;
export const SPAWN_MS = 400;
/** a true gate surges the hero on */
export const V_SURGE = 3;
export const SURGE_MS = 500;
export const PICKUP_R = 1.15;
export const SECRET_R = 1.1;
export const ORB = { bonusMs: 50 } as const;
/** the hero's half width for lane hits (m) */
export const HIT_W = 1.2;
/** heights: a low wall is cleared above WALL_H, a beam's underside is BEAM_H, a sweeper is SWEEP_H tall */
export const WALL_H = 0.85;
export const BEAM_H = 0.9;
export const SWEEP_H = 0.7;
/** Chroma's core gate lands this far ahead of the hero; he runs this far ahead */
export const BOSS_THROW = 22;
export const GOLEM_AHEAD = 27;

export type Mode = "run" | "air" | "fall" | "spawn";

export interface Hero {
   x: number;
   y: number;
   z: number;
   vy: number;
   lane: number;
   color: number;
   mode: Mode;
   airJump: boolean;
   slideUntil: number;
   stunUntil: number;
   surgeUntil: number;
   timer: number;
}

export interface ArenaGate extends Gate {
   live: boolean;
   boss: boolean;
}

export interface ArenaSweep {
   z: number;
   periodMs: number;
   phase: number;
   live: boolean;
}

export interface Golem {
   z: number;
   color: number;
   visible: boolean;
}

export interface StepInput {
   /** one-frame lane presses (screen left / right) */
   left: boolean;
   right: boolean;
   jumpPressed: boolean;
   slidePressed: boolean;
   /** a colour picked directly (-1 none) */
   colorPick: number;
   /** cycle to the next colour */
   cycle: boolean;
   actionPressed: boolean;
   yaw: number;
}

export function createStepInput(): StepInput {
   return { left: false, right: false, jumpPressed: false, slidePressed: false, colorPick: NONE, cycle: false, actionPressed: false, yaw: 0 };
}

export interface StepEvents {
   laned: boolean;
   jumped: boolean;
   airJumped: boolean;
   slid: boolean;
   switched: boolean;
   gatePassed: number;
   bossGatePassed: boolean;
   wrong: boolean;
   hit: boolean;
   smashed: number;
   pickupCount: number;
   pickupList: number[];
   secretCount: number;
   secretList: number[];
   checkpoint: boolean;
   fell: boolean;
   respawned: boolean;
   powered: boolean;
   shielded: boolean;
   finished: boolean;
   timeup: boolean;
   gameOver: boolean;
   bossGate: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   comboBonus: number;
}

export interface SwitchRun {
   track: Track;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   rng: number;
   simMs: number;
   remainder: number;
   hero: Hero;
   speed: number;
   hearts: number;
   /** wrong gates, hazards and falls (the badge: a clean run) */
   hits: number;
   gateIdx: number;
   passed: number;
   streak: number;
   bestStreak: number;
   gateLinks: number;
   collected: Uint8Array;
   smashed: Uint8Array;
   checkpoint: number;
   powerReadyAt: number;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   orbs: number;
   mainOrbs: number;
   combo: ComboState;
   secrets: SecretTracker;
   finishMs: number;
   ended: "win" | "lose" | "timeup" | null;
   events: StepEvents;
   boss: BossState | null;
   bossEv: BossEvents;
   inArena: boolean;
   golem: Golem;
   arena: ArenaGate[];
   sweeps: ArenaSweep[];
   bossGates: number;
   multi: boolean;
   versus: boolean;
   seat: number;
}

function createEvents(): StepEvents {
   return {
      laned: false, jumped: false, airJumped: false, slid: false, switched: false, gatePassed: NONE, bossGatePassed: false, wrong: false, hit: false, smashed: NONE,
      pickupCount: 0, pickupList: new Array<number>(16).fill(0), secretCount: 0, secretList: [0, 0, 0, 0], checkpoint: false, fell: false, respawned: false,
      powered: false, shielded: false, finished: false, timeup: false, gameOver: false, bossGate: false, bossHit: false, bossPhase: false, bossDefeated: false, comboBonus: 0,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.laned = ev.jumped = ev.airJumped = ev.slid = ev.switched = ev.bossGatePassed = ev.wrong = ev.hit = ev.checkpoint = ev.fell = ev.respawned = false;
   ev.powered = ev.shielded = ev.finished = ev.timeup = ev.gameOver = ev.bossGate = ev.bossHit = ev.bossPhase = ev.bossDefeated = false;
   ev.gatePassed = ev.smashed = NONE;
   ev.pickupCount = ev.secretCount = ev.comboBonus = 0;
}

export function courseFor(level: LevelId): Track {
   return buildTrack(level);
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): SwitchRun {
   const track = courseFor(level);
   const first = track.gates[0];
   return {
      track, level, heroId, seed, rng: (seed >>> 0) % 2147483646 + 1, simMs: 0, remainder: 0,
      hero: { x: 0, y: 0, z: START_Z, vy: 0, lane: 1, color: first ? (first.colors[1] + 1) % track.colors : 0, mode: "run", airJump: true, slideUntil: -1, stunUntil: -1, surgeUntil: -1, timer: 0 },
      speed: LEVELS[level].speed, hearts: HEARTS, hits: 0, gateIdx: 0, passed: 0, streak: 0, bestStreak: 0, gateLinks: 0,
      collected: new Uint8Array(track.pickups.length), smashed: new Uint8Array(track.obstacles.length), checkpoint: START_Z,
      powerReadyAt: 0, dashUntil: -1, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, orbs: 0, mainOrbs: 0,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]), finishMs: 0, ended: null, events: createEvents(),
      boss: track.arenaZ !== null ? createBoss(CHROMA) : null, bossEv: createBossEvents(), inArena: false,
      golem: { z: (track.arenaZ ?? 0) - GOLEM_AHEAD, color: 0, visible: track.arenaZ !== null },
      arena: [], sweeps: [], bossGates: 0, multi: false, versus: false, seat: 0,
   };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function rand(run: SwitchRun): number {
   run.rng = (run.rng * 16807) % 2147483647;
   return (run.rng - 1) / 2147483646;
}

/** The fastest the hero ever runs on this level (m/s): the level's speed plus the dash. */
export function vCap(level: LevelId): number {
   return LEVELS[level].speed + V_DASH;
}

export function laneOf(x: number): number {
   let best = 0;
   for (let i = 1; i < 3; i++) if (Math.abs(x - LANES[i]) < Math.abs(x - LANES[best])) best = i;
   return best;
}

/** A lane press is camera-relative: with the camera turned round, screen right is world left. */
export function laneStep(right: boolean, yaw: number): number {
   const d = right ? 1 : -1;
   return Math.cos(yaw) >= 0 ? d : -d;
}

function link(run: SwitchRun, base: number, ev: StepEvents): void {
   ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, base);
}

function secret(run: SwitchRun, i: number, ev: StepEvents): void {
   if (!collectSecret(run.secrets, i)) return;
   if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount] = i;
   ev.secretCount++;
}

function loseHeart(run: SwitchRun, ev: StepEvents): void {
   run.hits++;
   run.hearts--;
   run.streak = 0;
   comboBreak(run.combo);
   if (run.hearts <= 0) {
      run.ended = "lose";
      ev.gameOver = true;
   }
}

/** A hazard stopped the hero: back BOUNCE metres from where it stood, a stun, a heart. */
function bounce(run: SwitchRun, fromZ: number, ev: StepEvents, heart: boolean): void {
   const h = run.hero;
   h.z = Math.max(h.z, fromZ + BOUNCE);
   h.stunUntil = run.simMs + STUN_MS;
   h.surgeUntil = -1;
   if (heart && run.shieldUntil < run.simMs) loseHeart(run, ev);
   else if (heart) ev.shielded = true;
}

function passGate(run: SwitchRun, g: Gate, isBoss: boolean, ev: StepEvents): boolean {
   const h = run.hero;
   const want = gateColor(g, laneOf(h.x), run.simMs);
   if (want !== h.color) {
      ev.wrong = true;
      bounce(run, g.z, ev, true);
      run.streak = 0;
      return false;
   }
   run.passed++;
   ev.gatePassed = run.passed;
   run.streak++;
   run.bestStreak = Math.max(run.bestStreak, run.streak);
   h.surgeUntil = run.simMs + SURGE_MS;
   if (run.gateLinks < gateLinksOf(run.track)) {
      run.gateLinks++;
      link(run, COMBO_BASE_MS.gate, ev);
   }
   if (run.streak >= STREAK_SECRET) secret(run, 1, ev);
   if (isBoss) {
      ev.bossGatePassed = true;
      const b = run.boss;
      if (b && b.step === "vulnerable") {
         const r = hitBoss(b, CHROMA, 1, run.bossEv);
         if (r !== "ignored") {
            ev.bossHit = true;
            link(run, COMBO_BASE_MS.boss, ev);
            if (r === "phase") ev.bossPhase = true;
            if (r === "defeated") {
               ev.bossDefeated = true;
               win(run, ev);
            }
         }
      }
   }
   return true;
}

function win(run: SwitchRun, ev: StepEvents): void {
   if (run.ended) return;
   run.ended = "win";
   run.finishMs = run.simMs;
   ev.finished = true;
}

function phasing(run: SwitchRun): boolean {
   return run.phaseUntil >= run.simMs;
}

function shielded(run: SwitchRun): boolean {
   return run.shieldUntil >= run.simMs;
}

function overGap(run: SwitchRun, z: number): boolean {
   for (const o of run.track.obstacles) if (o.kind === "gap" && z <= o.z && z >= o.z - o.len) return true;
   return false;
}

/** The hazard checks when the hero crosses obstacle i's line this substep. */
function crossObstacle(run: SwitchRun, i: number, ev: StepEvents): void {
   const o: Obstacle = run.track.obstacles[i];
   const h = run.hero;
   if (o.kind === "gap") return;
   if (run.smashed[i]) return;
   const sliding = h.slideUntil >= run.simMs && h.y <= 0.01;
   const free = phasing(run) || shielded(run);
   if (o.kind === "block" || o.kind === "wall") {
      if (Math.abs(h.x - LANES[o.lane]) >= HIT_W) return;
      if (o.kind === "wall" && h.y > WALL_H) return;
      if (o.kind === "block" && run.dashUntil >= run.simMs) {
         run.smashed[i] = 1;
         ev.smashed = i;
         return;
      }
      if (free) return;
   } else if (o.kind === "beam") {
      if (sliding || free) return;
   } else if (o.kind === "sweeper") {
      if (Math.abs(h.x - sweeperX(o, run.simMs)) >= HIT_W || h.y > SWEEP_H || free) return;
   }
   ev.hit = true;
   bounce(run, o.z, ev, true);
}

function respawn(run: SwitchRun, ev: StepEvents): void {
   const h = run.hero;
   h.z = run.checkpoint;
   h.x = 0;
   h.lane = 1;
   h.y = 0;
   h.vy = 0;
   h.mode = "spawn";
   h.timer = 0;
   h.stunUntil = -1;
   // the gates behind the checkpoint stay passed; the next one ahead is the one to pass
   while (run.gateIdx > 0 && run.track.gates[run.gateIdx - 1].z < h.z) run.gateIdx--;
   // (co-op can pull the checkpoint past gates this hero never reached: those are behind it now)
   while (run.gateIdx < run.track.gates.length && run.track.gates[run.gateIdx].z > h.z) run.gateIdx++;
   ev.respawned = true;
}

function firePower(run: SwitchRun, ev: StepEvents): void {
   const hero = heroById(run.heroId);
   const h = run.hero;
   if (run.powerReadyAt > run.simMs || h.mode === "fall" || h.mode === "spawn") return;
   if (hero.power === "doubleJump") return;
   if (hero.power === "dash") run.dashUntil = run.simMs + POWER_MS.dash;
   else if (hero.power === "shield") run.shieldUntil = run.simMs + POWER_MS.shield;
   else if (hero.power === "magnet") run.magnetUntil = run.simMs + POWER_MS.magnet;
   else run.phaseUntil = run.simMs + POWER_MS.phase;
   run.powerReadyAt = run.simMs + hero.cooldownMs;
   ev.powered = true;
}

function frameInput(run: SwitchRun, input: StepInput, ev: StepEvents): void {
   const h = run.hero;
   if (h.mode === "fall") return;
   if (input.left || input.right) {
      const d = laneStep(input.right && !input.left, input.yaw);
      const lane = clamp(h.lane + d, 0, 2);
      if (lane !== h.lane) {
         h.lane = lane;
         ev.laned = true;
      }
   }
   const n = run.track.colors;
   let c = h.color;
   if (input.colorPick >= 0 && input.colorPick < n) c = input.colorPick;
   else if (input.cycle) c = (c + 1) % n;
   if (c !== h.color) {
      h.color = c;
      ev.switched = true;
   }
   if (input.jumpPressed && h.mode !== "spawn") {
      if (h.mode === "run") {
         h.mode = "air";
         h.vy = V_JUMP;
         h.slideUntil = -1;
         h.airJump = run.heroId === "nami";
         ev.jumped = true;
      } else if (h.mode === "air" && h.airJump) {
         h.vy = V_JUMP;
         h.airJump = false;
         ev.airJumped = true;
      }
   }
   if (input.slidePressed && h.mode === "run") {
      h.slideUntil = run.simMs + SLIDE_MS;
      ev.slid = true;
   } else if (input.slidePressed && h.mode === "air") {
      // a fast drop, then the slide on landing
      h.vy = Math.min(h.vy, -10);
      h.slideUntil = run.simMs + SLIDE_MS + 300;
   }
   if (input.actionPressed) firePower(run, ev);
}

function bossFrame(run: SwitchRun, dtMs: number, ev: StepEvents): void {
   const b = run.boss;
   const t = run.track;
   if (!b || t.arenaZ === null) return;
   const h = run.hero;
   const gol = run.golem;
   if (!run.inArena) {
      gol.z = t.arenaZ - GOLEM_AHEAD;
      return;
   }
   const bev = stepBoss(b, CHROMA, dtMs, run.bossEv);
   if (bev.phaseChanged) ev.bossPhase = true;
   gol.visible = b.step !== "done";
   gol.z = Math.min(gol.z, h.z - GOLEM_AHEAD);
   if (b.step === "telegraph" && b.stepMs < dtMs + 1) gol.color = Math.floor(rand(run) * t.colors);
   if (bev.vulnerable) {
      // his core gate lands ahead of the hero
      const z = h.z - BOSS_THROW;
      const c = gol.color;
      const g: ArenaGate = { z, kind: "full", colors: [c, c, c], alt: c, periodMs: 0, live: true, boss: true };
      if (b.phase === 1) {
         const a = Math.floor(rand(run) * t.colors);
         g.kind = "split";
         g.colors = [a, (a + 1) % t.colors, (a + 2) % t.colors];
      } else if (b.phase === 2) {
         g.kind = "blink";
         g.alt = (c + 1 + Math.floor(rand(run) * (t.colors - 1))) % t.colors;
         g.periodMs = 900;
      }
      run.arena.push(g);
      run.bossGates++;
      ev.bossGate = true;
   }
   if (bev.attack && b.phase >= 1) run.sweeps.push({ z: h.z - BOSS_THROW - 6, periodMs: 2200, phase: rand(run), live: true });
   if (run.arena.length > 6) run.arena.splice(0, run.arena.length - 6);
   if (run.sweeps.length > 4) run.sweeps.splice(0, run.sweeps.length - 4);
}

function substep(run: SwitchRun, dtMs: number, ev: StepEvents): void {
   const h = run.hero;
   const t = run.track;
   run.simMs += dtMs;
   const dt = dtMs / 1000;
   if (h.mode === "fall") {
      h.timer += dtMs;
      h.vy -= G * dt;
      h.y += h.vy * dt;
      if (h.timer >= FALL_MS) respawn(run, ev);
      return;
   }
   if (h.mode === "spawn") {
      h.timer += dtMs;
      if (h.timer >= SPAWN_MS) h.mode = "run";
      return;
   }
   const z0 = h.z;
   const stunned = h.stunUntil >= run.simMs;
   const boost = Math.max(run.dashUntil >= run.simMs ? V_DASH : 0, h.surgeUntil >= run.simMs ? V_SURGE : 0);
   const v = stunned ? 0 : run.speed + boost;
   h.z -= v * dt;
   // the proof's pace: never farther from the start than vCap x t
   const lim = START_Z - (vCap(run.level) * run.simMs) / 1000;
   if (h.z < lim) h.z = lim;
   // lanes
   const tx = LANES[h.lane];
   const dx = tx - h.x;
   const step = V_LATERAL * dt;
   h.x = Math.abs(dx) <= step ? tx : h.x + Math.sign(dx) * step;
   // up and down
   if (h.mode === "air") {
      h.vy -= G * dt;
      h.y += h.vy * dt;
      if (h.y <= 0) {
         // over a gap, or too far below the deck for its far edge to catch (a forgiving 0.5 m lip)
         if (overGap(run, h.z) || h.y < -0.5) {
            if (h.y < -1.2 || !overGap(run, h.z)) {
               h.mode = "fall";
               h.timer = 0;
               run.hits++;
               loseHeartQuiet(run, ev);
               ev.fell = true;
               return;
            }
         } else {
            h.y = 0;
            h.vy = 0;
            h.mode = "run";
         }
      }
   } else if (overGap(run, h.z)) {
      // ran off the edge without a jump: a fall (the lip only catches jump landings)
      h.mode = "fall";
      h.timer = 0;
      h.vy = 0;
      run.hits++;
      loseHeartQuiet(run, ev);
      ev.fell = true;
      return;
   }
   // crossings: obstacles, gates, checkpoints, the finish
   if (h.z < z0) {
      const obs = t.obstacles;
      for (let i = 0; i < obs.length; i++) if (obs[i].z <= z0 && obs[i].z > h.z) crossObstacle(run, i, ev);
      if (run.ended) return;
      const g = t.gates[run.gateIdx];
      if (g && g.z <= z0 && g.z > h.z) {
         if (passGate(run, g, false, ev)) run.gateIdx++;
         if (run.ended) return;
      }
      for (const a of run.arena) {
         if (!a.live || a.z > z0 || a.z <= h.z) continue;
         if (passGate(run, a, a.boss, ev)) a.live = false;
         if (run.ended) return;
         break;
      }
      for (const s of run.sweeps) {
         if (!s.live || s.z > z0 || s.z <= h.z) continue;
         const o: Obstacle = { kind: "sweeper", z: s.z, lane: -1, len: 0, periodMs: s.periodMs, phase: s.phase };
         const sx = sweeperX(o, run.simMs);
         if (Math.abs(h.x - sx) < HIT_W && h.y <= SWEEP_H && !phasing(run) && !shielded(run)) {
            ev.hit = true;
            bounce(run, s.z, ev, true);
         } else s.live = false;
         if (run.ended) return;
      }
      for (const c of t.checkpoints) {
         if (c <= z0 && c > h.z && c < run.checkpoint) {
            run.checkpoint = c;
            ev.checkpoint = true;
         }
      }
      if (t.arenaZ !== null && !run.inArena && h.z <= t.arenaZ && run.gateIdx >= t.gates.length) {
         run.inArena = true;
         run.checkpoint = t.arenaZ;
      }
      if (t.arenaZ === null && h.z <= t.finishZ && run.gateIdx >= t.gates.length) win(run, ev);
      // the course's last gate must be passed before the finish counts: a bounce keeps it ahead
   }
   if (t.arenaZ !== null && !run.inArena && h.z < t.arenaZ - 1) h.z = Math.max(h.z, t.arenaZ - 1);
}

function loseHeartQuiet(run: SwitchRun, ev: StepEvents): void {
   run.hearts--;
   run.streak = 0;
   comboBreak(run.combo);
   if (run.hearts <= 0) {
      run.ended = "lose";
      ev.gameOver = true;
   }
}

function pickups(run: SwitchRun, ev: StepEvents): void {
   const h = run.hero;
   const ps = run.track.pickups;
   const magnet = run.magnetUntil >= run.simMs;
   const cy = h.y + 0.9;
   for (let i = 0; i < ps.length; i++) {
      if (run.collected[i]) continue;
      const p = ps[i];
      if (Math.abs(p.z - h.z) > MAGNET_REACH + 1) continue;
      const d = Math.hypot(p.x - h.x, p.y - cy, p.z - h.z);
      if (d > PICKUP_R && !(magnet && d <= MAGNET_REACH)) continue;
      run.collected[i] = 1;
      run.orbs++;
      if (p.main) run.mainOrbs++;
      if (ev.pickupCount < ev.pickupList.length) ev.pickupList[ev.pickupCount] = i;
      ev.pickupCount++;
      link(run, COMBO_BASE_MS.pickup, ev);
   }
   const t = run.track;
   if (Math.hypot(t.high.x - h.x, t.high.y - cy, t.high.z - h.z) < SECRET_R) secret(run, 0, ev);
   if (Math.hypot(t.ghost.x - h.x, t.ghost.y - cy, t.ghost.z - h.z) < SECRET_R) secret(run, 2, ev);
}

export function step(run: SwitchRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended !== null || !(dtMs > 0)) return ev;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   if (whole <= 0) return ev;
   frameInput(run, input, ev);
   bossFrame(run, whole, ev);
   let left = whole;
   while (left > 0 && run.ended === null) {
      const d = Math.min(SUB_MS, left);
      substep(run, d, ev);
      left -= d;
      if (run.hero.mode !== "fall") pickups(run, ev);
   }
   if (run.ended === null && run.simMs >= LEVELS[run.level].durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
   return ev;
}

// ---------------- the proof ----------------

let bossFloor = 0;

/** The least rules ms to land every Chroma hit, striking at the first moment of each window. */
export function bossMinMs(): number {
   if (bossFloor > 0) return bossFloor;
   const s = createBoss(CHROMA);
   const ev = createBossEvents();
   let ms = 0;
   while (s.hp > 0 && ms < 300_000) {
      stepBoss(s, CHROMA, 10, ev);
      ms += 10;
      if (s.step === "vulnerable") hitBoss(s, CHROMA, 1, ev);
   }
   bossFloor = ms;
   return ms;
}

/** No run gets farther from the start than vCap x t: the least time to the finish (or the arena). */
export function travelFloorMs(t: Track): number {
   return (t.length / vCap(t.level)) * 1000;
}

/** Level 5: the arena first, then Chroma's windows (his clock only runs in the arena). */
export function minFinishMs(t: Track): number {
   return travelFloorMs(t) + (t.arenaZ !== null ? bossMinMs() : 0);
}

/** The most gate links a run's flow meter counts. */
export function gateLinksOf(t: Track): number {
   return t.gates.length + (t.arenaZ !== null ? BOSS_GATES * 3 : 0);
}

export function comboSpecOf(t: Track): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: t.pickups.length, base: COMBO_BASE_MS.pickup },
         { count: gateLinksOf(t), base: COMBO_BASE_MS.gate },
         { count: t.arenaZ !== null ? CHROMA.maxHp : 0, base: COMBO_BASE_MS.boss },
      ],
   };
}

export function minDurationMsOf(t: Track): number {
   return minFinishMs(t) - t.pickups.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(t));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(t: Track): LevelLimits {
   const lb = minDurationMsOf(t);
   if (!(lb > 200)) throw new Error(`switch-color-hero L${t.level} floor ${lb} is not positive`);
   const minDurationMs = Math.floor((lb * 0.95) / 100) * 100;
   const timeBaseMs = LEVELS[t.level].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(courseFor(1)),
   2: proposeLimits(courseFor(2)),
   3: proposeLimits(courseFor(3)),
   4: proposeLimits(courseFor(4)),
   5: proposeLimits(courseFor(5)),
};

export const STAT = {
   orbs: "orbs",
   mainOrbs: "mainOrbs",
   finishMs: "finishMs",
   hearts: "hearts",
   passed: "passed",
   color: "color",
   streak: "streak",
   distance: "distance",
   hero: "hero",
   power: "power",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB.bonusMs - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export function badgeHits(run: SwitchRun): number {
   return run.hits;
}
