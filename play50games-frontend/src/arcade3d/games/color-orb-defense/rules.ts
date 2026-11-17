// Color Orb Defense's rules: deterministic, fixed 8 ms substeps. The hero runs free inside the arena
// (camera-relative stick, a jump, the power). Orbs leave their portals on the schedule (arena.ts) and fly
// straight down their lane at the level's speed. An orb crossing a zone's radius is blocked when the hero
// stands on that zone and the zone's colour is the orb's colour at that moment; a block scores (more at
// the outermost zone) and links the combo. An orb that reaches the core costs a hit point; none left and
// the run is lost (unranked: a points game ends "win" only when every wave is over). From level 2 the drone
// sweeps the middle ring and knocks the hero off his zone (jump it). Level 5 ends with the Orb Mortar:
// his golden core orbs, blocked in their colour in his window, fly back into him.
//
// The proof (README "Scoring and the proof"): every orb is on the schedule, so the score is bounded by
// every orb blocked early, every wave perfect, the most flow bonus and the boss; a run cannot end before
// the last orb leaves its portal (level 5: before the waves end plus the Mortar's least time).
import type { LevelId } from "@/arcade3d/types";
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import { comboBreak, comboHit, comboMaxBonus, createCombo, type ComboLevelSpec, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { DEFAULT_HERO, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { COMBO, COMBO_BASE, CORE_HP, MORTAR, PTS, SECRETS } from "./progression";
import { ORB_Y, R_ARENA, R_CORE, R_DRONE, R_PORTAL, ZONE_R, buildArena, orbColor, type Arena } from "./arena";

export const NONE = -1;
export const MAX_STEP_MS = 50;
export const SUB_MS = 8;
export const V_RUN = 7;
export const ACCEL = 40;
export const G = 22;
export const V_JUMP = 7;
export const BODY_R = 0.45;
export const DRONE_R = 0.7;
export const DRONE_H = 0.55;
export const KNOCK_MS = 700;
export const KNOCK_PUSH = 9;
export const SECRET_R = 1.0;
/** an orb touching the hero's shield (this far from his chest) is blocked if the colours match; Zuno's magnet widens it */
export const BLOCK_R = 1.1;
export const MAGNET_BLOCK_R = 3.2;
/** a block this far from the core or farther is early */
export const EARLY_R = 8.5;
/** the hero counts as on a zone this close to its centre, on the ground */
export const ON_ZONE = ZONE_R;

export interface Hero {
   x: number;
   z: number;
   y: number;
   vx: number;
   vz: number;
   vy: number;
   grounded: boolean;
   airJump: boolean;
   stunUntil: number;
   /** the zone he stands on (-1 none) */
   zone: number;
   /** his shield's colour: the last zone he stood on (-1 none yet) */
   color: number;
   faceX: number;
   faceZ: number;
}

export interface Orb {
   live: boolean;
   lane: number;
   r: number;
   color: number;
   alt: number;
   periodMs: number;
   bornMs: number;
   wave: number;
   /** a Mortar core orb (level 5) */
   core: boolean;
   /** it already passed through a hero of the wrong colour (one clink) */
   next: number;
}

export interface StepInput {
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false };
}

export interface StepEvents {
   blocked: number;
   blockList: number[];
   early: number;
   leaked: number;
   wrong: number;
   spawned: number;
   waveDone: number;
   perfect: boolean;
   knocked: boolean;
   jumped: boolean;
   airJumped: boolean;
   powered: boolean;
   shielded: boolean;
   zoneIn: number;
   secretCount: number;
   secretList: number[];
   coreOrb: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   finished: boolean;
   gameOver: boolean;
   timeup: boolean;
   points: number;
   comboBonus: number;
}

export interface DefenseRun {
   arena: Arena;
   level: LevelId;
   heroId: HeroId;
   seed: number;
   rng: number;
   simMs: number;
   remainder: number;
   hero: Hero;
   orbs: Orb[];
   /** the next schedule entry to spawn */
   nextSpawn: number;
   coreHp: number;
   score: number;
   blocks: number;
   leaks: number;
   /** blocked orbs (the "all orbs" star counts the regular ones) */
   orbsBlocked: number;
   knocks: number;
   /** per wave: orbs resolved, leaks, early blocks */
   waveResolved: Int32Array;
   waveLeaks: Int32Array;
   waveEarly: Int32Array;
   /** the rainbow chain: the colours blocked in a row */
   chainMask: number;
   powerReadyAt: number;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   combo: ComboState;
   secrets: SecretTracker;
   finishMs: number;
   ended: "win" | "lose" | "timeup" | null;
   events: StepEvents;
   boss: BossState | null;
   bossEv: BossEvents;
   droneAngle: number;
   /** multiplayer: seat 0 owns the shared orbs and the core and checks every partner's zone */
   owner: boolean;
   partners: DefenseRun[];
   shared: { coreHp: number };
   multi: boolean;
   versus: boolean;
   seat: number;
}

function createEvents(): StepEvents {
   return {
      blocked: 0, blockList: [0, 0, 0, 0, 0, 0, 0, 0], early: 0, leaked: 0, wrong: 0, spawned: 0, waveDone: NONE, perfect: false, knocked: false,
      jumped: false, airJumped: false, powered: false, shielded: false, zoneIn: NONE, secretCount: 0, secretList: [0, 0, 0, 0], coreOrb: false,
      bossHit: false, bossPhase: false, bossDefeated: false, finished: false, gameOver: false, timeup: false, points: 0, comboBonus: 0,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.blocked = ev.early = ev.leaked = ev.wrong = ev.spawned = ev.secretCount = ev.points = ev.comboBonus = 0;
   ev.waveDone = ev.zoneIn = NONE;
   ev.perfect = ev.knocked = ev.jumped = ev.airJumped = ev.powered = ev.shielded = ev.coreOrb = false;
   ev.bossHit = ev.bossPhase = ev.bossDefeated = ev.finished = ev.gameOver = ev.timeup = false;
}

export function courseFor(level: LevelId): Arena {
   return buildArena(level);
}

export function createRun(seed: number, level: LevelId = 1, heroId: HeroId = DEFAULT_HERO): DefenseRun {
   const arena = courseFor(level);
   const shared = { coreHp: CORE_HP };
   return {
      arena, level, heroId, seed, rng: (seed >>> 0) % 2147483646 + 1, simMs: 0, remainder: 0,
      hero: { x: 0, z: 5.2, y: 0, vx: 0, vz: 0, vy: 0, grounded: true, airJump: false, stunUntil: -1, zone: NONE, color: NONE, faceX: 0, faceZ: -1 },
      orbs: [], nextSpawn: 0, coreHp: CORE_HP, score: 0, blocks: 0, leaks: 0, orbsBlocked: 0, knocks: 0,
      waveResolved: new Int32Array(arena.waves), waveLeaks: new Int32Array(arena.waves), waveEarly: new Int32Array(arena.waves),
      chainMask: 0, powerReadyAt: 0, dashUntil: -1, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]), finishMs: 0, ended: null, events: createEvents(),
      boss: arena.boss ? createBoss(MORTAR) : null, bossEv: createBossEvents(), droneAngle: 0,
      owner: true, partners: [], shared, multi: false, versus: false, seat: 0,
   };
}

function rand(run: DefenseRun): number {
   run.rng = (run.rng * 16807) % 2147483647;
   return (run.rng - 1) / 2147483646;
}

/** The drone's angular speed (rad/s): from level 2, faster in the Mortar's last phase. */
export function droneSpeed(run: DefenseRun): number {
   const L = LEVELS[run.level];
   if (!L.drone) return 0;
   const base = [0, 0, 0.3, 0.38, 0.45, 0.45][run.level];
   return run.boss && run.boss.phase === 2 ? base * 1.6 : base;
}

export function dronePos(run: DefenseRun, out: { x: number; z: number }): { x: number; z: number } {
   out.x = Math.cos(run.droneAngle) * R_DRONE;
   out.z = -Math.sin(run.droneAngle) * R_DRONE;
   return out;
}

function addPoints(run: DefenseRun, p: number, ev: StepEvents): void {
   run.score += p;
   ev.points += p;
}

function secret(run: DefenseRun, i: number, ev: StepEvents): void {
   if (!collectSecret(run.secrets, i)) return;
   if (ev.secretCount < ev.secretList.length) ev.secretList[ev.secretCount] = i;
   ev.secretCount++;
}

/** The zone the hero stands on (on the ground, within its radius), or -1. */
export function zoneUnder(run: DefenseRun): number {
   const h = run.hero;
   if (!h.grounded) return NONE;
   const zs = run.arena.zones;
   for (let i = 0; i < zs.length; i++) if (Math.hypot(h.x - zs[i].x, h.z - zs[i].z) <= ON_ZONE) return i;
   return NONE;
}

function resolveWave(run: DefenseRun, w: number, ev: StepEvents): void {
   if (w < 0 || w >= run.arena.waves) return;
   run.waveResolved[w]++;
   if (run.waveResolved[w] < run.arena.waveSize[w]) return;
   ev.waveDone = w;
   // a held wave repairs the beacon (a perfect one twice)
   run.shared.coreHp = Math.min(CORE_HP, run.shared.coreHp + (run.waveLeaks[w] === 0 ? 2 : 1));
   run.coreHp = run.shared.coreHp;
   if (run.waveLeaks[w] === 0) {
      ev.perfect = true;
      addPoints(run, PTS.perfectWave, ev);
      if (run.waveEarly[w] === run.arena.waveSize[w]) secret(run, 0, ev);
   }
}

/** Orb o is blocked by `who` (points, combo, secrets his); the wave bookkeeping is the owner's. */
function block(who: DefenseRun, owner: DefenseRun, o: Orb, early: boolean, ev: StepEvents): void {
   o.live = false;
   if (ev.blocked < ev.blockList.length) ev.blockList[ev.blocked] = owner.orbs.indexOf(o);
   ev.blocked++;
   if (o.core) {
      const b = owner.boss;
      if (b && b.step === "vulnerable") {
         const r = hitBoss(b, MORTAR, 1, owner.bossEv);
         if (r !== "ignored") {
            ev.bossHit = true;
            addPoints(who, PTS.bossHit, ev);
            const bonus = comboHit(who.combo, COMBO, who.simMs, COMBO_BASE.boss);
            ev.comboBonus += bonus;
            addPoints(who, bonus, ev);
            if (r === "phase") ev.bossPhase = true;
            if (r === "defeated") {
               ev.bossDefeated = true;
               addPoints(who, PTS.defeat, ev);
               win(owner, owner.events);
            }
         }
      }
      return;
   }
   who.blocks++;
   who.orbsBlocked++;
   addPoints(who, PTS.block + (early ? PTS.early : 0), ev);
   if (early) {
      ev.early++;
      owner.waveEarly[o.wave]++;
   }
   const bonus = comboHit(who.combo, COMBO, who.simMs, COMBO_BASE.block);
   ev.comboBonus += bonus;
   addPoints(who, bonus, ev);
   const c = orbColor(o.color, o.alt, o.periodMs, owner.simMs - o.bornMs);
   who.chainMask |= 1 << c;
   if (who.chainMask === (1 << owner.arena.colors) - 1) secret(who, 1, ev);
   resolveWave(owner, o.wave, owner.events);
}

function leak(run: DefenseRun, o: Orb, ev: StepEvents): void {
   o.live = false;
   ev.leaked++;
   comboBreak(run.combo);
   run.chainMask = 0;
   if (!o.core) {
      run.leaks++;
      run.waveLeaks[o.wave]++;
   }
   if (o.core) {
      // the Mortar's core orbs only matter sent back: one that reaches the beacon fizzles
      return;
   }
   if (run.shieldUntil >= run.simMs) {
      ev.shielded = true;
   } else {
      run.shared.coreHp--;
      run.coreHp = run.shared.coreHp;
      if (run.shared.coreHp <= 0) {
         run.ended = "lose";
         ev.gameOver = true;
      }
   }
   if (!o.core) resolveWave(run, o.wave, ev);
}

function win(run: DefenseRun, ev: StepEvents): void {
   if (run.ended) return;
   run.ended = "win";
   run.finishMs = run.simMs;
   ev.finished = true;
}

function firePower(run: DefenseRun, ev: StepEvents): void {
   const hero = heroById(run.heroId);
   if (run.powerReadyAt > run.simMs || hero.power === "doubleJump") return;
   if (hero.power === "dash") run.dashUntil = run.simMs + POWER_MS.dash;
   else if (hero.power === "shield") run.shieldUntil = run.simMs + POWER_MS.shield;
   else if (hero.power === "magnet") run.magnetUntil = run.simMs + POWER_MS.magnet;
   else run.phaseUntil = run.simMs + POWER_MS.phase;
   run.powerReadyAt = run.simMs + hero.cooldownMs;
   ev.powered = true;
}

function bossFrame(run: DefenseRun, dtMs: number, ev: StepEvents): void {
   const b = run.boss;
   if (!b || !run.owner || run.simMs < run.arena.wavesEndMs) return;
   const bev = stepBoss(b, MORTAR, dtMs, run.bossEv);
   if (bev.phaseChanged) ev.bossPhase = true;
   if (!bev.vulnerable) return;
   // the window opens: he lobs his golden core orb(s) down a lane, launched part way in
   const A = run.arena;
   const n = b.phase === 1 ? 2 : 1;
   const first = Math.floor(rand(run) * A.lanes.length);
   for (let k = 0; k < n; k++) {
      const lane = (first + k * Math.max(1, Math.floor(A.lanes.length / 2))) % A.lanes.length;
      const lz = A.lanes[lane].zones;
      const color = A.zones[lz[Math.floor(rand(run) * lz.length)]].color;
      const o: Orb = { live: true, lane, r: R_PORTAL - 1, color, alt: color, periodMs: 0, bornMs: run.simMs, wave: NONE, core: true, next: 0 };
      if (b.phase === 2) {
         o.alt = A.zones[lz[(lz.findIndex((zi) => A.zones[zi].color === color) + 1) % lz.length]].color;
         o.periodMs = 1100;
      }
      run.orbs.push(o);
   }
   ev.coreOrb = true;
}

function spawn(run: DefenseRun, ev: StepEvents): void {
   const sp = run.arena.spawns;
   while (run.nextSpawn < sp.length && sp[run.nextSpawn].t <= run.simMs) {
      const s = sp[run.nextSpawn++];
      if (!run.owner) continue;
      run.orbs.push({ live: true, lane: s.lane, r: R_PORTAL, color: s.color, alt: s.alt, periodMs: s.periodMs, bornMs: s.t, wave: s.wave, core: false, next: 0 });
      ev.spawned++;
   }
}

/** The orbs move (the owner's run); an orb touching a hero whose shield has its colour is blocked (credited to him). */
function orbsStep(run: DefenseRun, dt: number, ev: StepEvents): void {
   if (!run.owner) return;
   const A = run.arena;
   const v = LEVELS[run.level].orbSpeed;
   const team = run.partners.length ? [run, ...run.partners] : SOLO;
   if (team === SOLO) SOLO[0] = run;
   for (const o of run.orbs) {
      if (!o.live) continue;
      o.r -= (o.core ? v * 1.1 : v) * dt;
      const lane = A.lanes[o.lane];
      const c = orbColor(o.color, o.alt, o.periodMs, run.simMs - o.bornMs);
      const ox = lane.dx * o.r;
      const oz = lane.dz * o.r;
      for (const who of team) {
         if (who.ended) continue;
         const h = who.hero;
         const reach = who.magnetUntil >= who.simMs ? MAGNET_BLOCK_R : BLOCK_R;
         const d = Math.hypot(ox - h.x, ORB_Y - (h.y + 0.9), oz - h.z);
         if (d > reach) continue;
         if (h.color === c) {
            block(who, run, o, o.r >= EARLY_R, who === run ? ev : who.events);
            break;
         }
         if (!o.next) {
            o.next = 1;
            (who === run ? ev : who.events).wrong++;
         }
      }
      if (o.live && o.r <= R_CORE) leak(run, o, ev);
      if (run.ended) return;
   }
}

const SOLO: DefenseRun[] = [];

function heroStep(run: DefenseRun, dt: number, input: StepInput, ev: StepEvents): void {
   const h = run.hero;
   const stunned = h.stunUntil >= run.simMs;
   const w = inputToWorld(input.moveX, input.moveZ, input.yaw);
   let mx = w.x;
   let mz = w.z;
   const m = Math.hypot(mx, mz);
   if (m > 1) {
      mx /= m;
      mz /= m;
   }
   let top = V_RUN * (run.phaseUntil >= run.simMs ? 1.4 : 1);
   if (run.dashUntil >= run.simMs) top = V_DASH;
   if (stunned) top = 0;
   const tx = mx * top;
   const tz = mz * top;
   const k = Math.min(1, ACCEL * dt / Math.max(1, top));
   if (!stunned) {
      if (run.dashUntil >= run.simMs) {
         // a dash is at full speed at once: along the stick, or where he faces
         const dx = m >= 0.2 ? mx / Math.max(m, 1e-6) * Math.min(1, m) : h.faceX;
         const dz = m >= 0.2 ? mz / Math.max(m, 1e-6) * Math.min(1, m) : h.faceZ;
         const n = Math.hypot(dx, dz) || 1;
         h.vx = (dx / n) * V_DASH;
         h.vz = (dz / n) * V_DASH;
      } else {
         h.vx += (tx - h.vx) * k;
         h.vz += (tz - h.vz) * k;
      }
   }
   h.x += h.vx * dt;
   h.z += h.vz * dt;
   const sp = Math.hypot(h.vx, h.vz);
   if (sp > 0.5) {
      h.faceX = h.vx / sp;
      h.faceZ = h.vz / sp;
   }
   // the rim and the core are walls
   const r = Math.hypot(h.x, h.z);
   if (r > R_ARENA - BODY_R) {
      h.x *= (R_ARENA - BODY_R) / r;
      h.z *= (R_ARENA - BODY_R) / r;
   } else if (r < R_CORE + BODY_R + 0.2 && r > 1e-6) {
      const s = (R_CORE + BODY_R + 0.2) / r;
      h.x *= s;
      h.z *= s;
   }
   if (!h.grounded) {
      h.vy -= G * dt;
      h.y += h.vy * dt;
      if (h.y <= 0) {
         h.y = 0;
         h.vy = 0;
         h.grounded = true;
      }
   }
   // the drone
   if (LEVELS[run.level].drone && run.phaseUntil < run.simMs && !stunned) {
      const d = dronePos(run, DP);
      const dist = Math.hypot(h.x - d.x, h.z - d.z);
      if (dist < DRONE_R + BODY_R && h.y < DRONE_H) {
         const out = Math.hypot(h.x, h.z) || 1;
         h.vx = (h.x / out) * KNOCK_PUSH;
         h.vz = (h.z / out) * KNOCK_PUSH;
         h.stunUntil = run.simMs + KNOCK_MS;
         run.knocks++;
         comboBreak(run.combo);
         ev.knocked = true;
      }
   }
   if (stunned) {
      h.vx *= 1 - Math.min(1, 6 * dt);
      h.vz *= 1 - Math.min(1, 6 * dt);
   }
   const z = zoneUnder(run);
   if (z >= 0 && run.arena.zones[z].color !== h.color) {
      h.color = run.arena.zones[z].color;
      ev.zoneIn = z;
   }
   h.zone = z;
   const b = run.arena.beacon;
   if (Math.hypot(h.x - b.x, h.y + 0.9 - b.y, h.z - b.z) < SECRET_R) secret(run, 2, ev);
}

const DP = { x: 0, z: 0 };

function substep(run: DefenseRun, dtMs: number, input: StepInput, ev: StepEvents): void {
   run.simMs += dtMs;
   const dt = dtMs / 1000;
   run.droneAngle += droneSpeed(run) * dt;
   spawn(run, ev);
   heroStep(run, dt, input, ev);
   orbsStep(run, dt, ev);
   if (run.ended) return;
   run.coreHp = run.shared.coreHp;
   if (run.shared.coreHp <= 0) {
      run.ended = "lose";
      ev.gameOver = true;
      return;
   }
   if (run.owner && !run.arena.boss && run.nextSpawn >= run.arena.spawns.length && run.simMs >= run.arena.lastSpawnMs && !run.orbs.some((o) => o.live)) win(run, ev);
}

export function step(run: DefenseRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended !== null || !(dtMs > 0)) return ev;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   if (whole <= 0) return ev;
   const h = run.hero;
   if (input.jumpPressed && h.stunUntil < run.simMs) {
      if (h.grounded) {
         h.grounded = false;
         h.vy = V_JUMP;
         h.airJump = run.heroId === "nami";
         ev.jumped = true;
      } else if (h.airJump) {
         h.vy = V_JUMP;
         h.airJump = false;
         ev.airJumped = true;
      }
   }
   if (input.actionPressed) firePower(run, ev);
   bossFrame(run, whole, ev);
   let left = whole;
   while (left > 0 && run.ended === null) {
      const d = Math.min(SUB_MS, left);
      substep(run, d, input, ev);
      left -= d;
   }
   // drop resolved orbs now and then (the array stays small)
   if (run.owner && run.orbs.length > 48) {
      // compact in place: partners share this array
      let n = 0;
      for (const o of run.orbs) if (o.live) run.orbs[n++] = o;
      run.orbs.length = n;
   }
   if (run.ended === null && run.simMs >= LEVELS[run.level].durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
   return ev;
}

// ---------------- the proof ----------------

let bossFloor = 0;

/** The least rules ms to land every Mortar hit, striking at the first moment of each window. */
export function bossMinMs(): number {
   if (bossFloor > 0) return bossFloor;
   const s = createBoss(MORTAR);
   const ev = createBossEvents();
   let ms = 0;
   while (s.hp > 0 && ms < 300_000) {
      stepBoss(s, MORTAR, 10, ev);
      ms += 10;
      if (s.step === "vulnerable") hitBoss(s, MORTAR, 1, ev);
   }
   bossFloor = ms;
   return ms;
}

/** The least finish: never before the last orb leaves its portal; level 5: the waves, then the Mortar. */
export function minFinishMs(a: Arena): number {
   return a.boss ? a.wavesEndMs + bossMinMs() : a.lastSpawnMs;
}

export function comboSpecOf(a: Arena): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: a.spawns.length, base: COMBO_BASE.block },
         { count: a.boss ? MORTAR.maxHp : 0, base: COMBO_BASE.boss },
      ],
   };
}

/** Every regular orb blocked early, every wave perfect, the most flow bonus, every Mortar hit and his defeat. */
export function maxScoreOf(a: Arena): number {
   const orbs = a.spawns.length * (PTS.block + PTS.early);
   const waves = a.waves * PTS.perfectWave;
   const boss = a.boss ? MORTAR.maxHp * PTS.bossHit + PTS.defeat : 0;
   return orbs + waves + boss + comboMaxBonus(comboSpecOf(a));
}

export interface LevelLimits {
   kind: "points";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   base: number;
   maxPointsPerSec: number;
}

export function proposeLimits(a: Arena): LevelLimits {
   const lb = minFinishMs(a);
   const minDurationMs = Math.floor((lb * 0.95) / 100) * 100;
   const maxScore = maxScoreOf(a);
   return { kind: "points", maxScore, minDurationMs, maxDurationMs: LEVELS[a.level].durationMs + 1000, base: 0, maxPointsPerSec: Math.ceil((maxScore * 1000) / minDurationMs) };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(courseFor(1)),
   2: proposeLimits(courseFor(2)),
   3: proposeLimits(courseFor(3)),
   4: proposeLimits(courseFor(4)),
   5: proposeLimits(courseFor(5)),
};

export const STAT = {
   coreHp: "coreHp",
   blocks: "blocks",
   leaks: "leaks",
   wave: "wave",
   zoneColor: "zoneColor",
   hero: "hero",
   power: "power",
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

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The "clean defence" badge: no orb leaked and the drone never knocked the hero. */
export function badgeHits(run: DefenseRun): number {
   return run.leaks + run.knocks;
}

/** The wave the run is in (0-based; the boss's phases count on after the waves on level 5). */
export function currentWave(run: DefenseRun): number {
   const sp = run.arena.spawns;
   if (run.nextSpawn < sp.length) return sp[Math.max(0, run.nextSpawn - 1)]?.wave ?? 0;
   if (run.boss && run.simMs >= run.arena.wavesEndMs) return run.arena.waves + Math.min(2, run.boss.phase);
   return run.arena.waves - 1;
}

export { R_PORTAL, ORB_Y, ZONE_R };
