// Magnet Coin Lab (Menu 2 #42, World 4): polarity flip. Pure, deterministic, a fixed 120 Hz quantum.
// A side-view lab of small rooms (x right, y up, metres). The hero carries a sign (+ / -): magnet pads
// of the opposite sign pull it (across gaps), a same-sign pad under its feet launches it 8 m. Steel
// coins swarm after the hero (they lag, catch on corners, fall into pits) and are banked in the piggy
// bank; a room's door opens when its quota is in. Gates filter by sign, metal blocks slide when pulled
// or pushed, lab drones steal coins, static floors scatter a swarm. L5: Scrap Magnus.
import type { LevelId } from "../../types";
import { inputToWorld } from "../../core/math";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import type { M2HeroId } from "../../menu2/heroModels";
import { LEVELS, T, parseRoom, type LabLevel, type ParsedRoom } from "./levels";
import { COMBO, COMBO_BASE_MS, MAGNUS, SECRETS } from "./progression";

export { T } from "./levels";

export const FIXED_MS = 1000 / 120;
export const HERO = { half: 0.35, height: 1.35 } as const;
export const WALK = 6.5;
export const GRAVITY = 30;
export const JUMP = 13;
export const MAX_FALL = 20;
export const COYOTE_MS = 100;
export const BUFFER_MS = 130;
/** A same-sign floor pad's launch: 8 m up (v = sqrt(2 g h)). */
export const LAUNCH = Math.sqrt(2 * GRAVITY * 8);
export const PAD = { range: 7, pull: 95, pullBase: 20, pullMax: 70, push: 40, latch: 0.7, launchCooldownMs: 500, gravityWhilePulled: 0.35 } as const;
export const COIN = { swarmMax: 30, pickup: 2.2, follow: 7, joinMs: 70, maxSpeed: 13, spring: 16, damping: 3.5, accelMax: 70, sag: 8, bankR: 1.1, respawnMs: 3000, radius: 0.15 } as const;
export const DASH = { speed: 16, ms: 250, cooldownMs: 2000 } as const;
export const POWER_MS = { kiro: 3000, zuno: 3000, vexa: 2500 } as const;
export const POWER_COOLDOWN_MS = { riko: DASH.cooldownMs, nami: 0, kiro: 6000, zuno: 6000, vexa: 6000 } as const;
/** Holding Action this long fires the hero power instead of a flip (a short tap flips). */
export const HOLD_MS = 400;
export const BLOCK = { range: 6, accel: 14, friction: 8, maxSpeed: 5, rideSpeed: WALK } as const;
export const DRONE = { speed: 3.5, steal: 0.6, carry: 6, repel: 2.5 } as const;
export const STUN_MS = 500;
export const GRACE_MS = 1000;
export const ORB_BONUS_MS = 400;
/** The fastest anything crosses the lab: a Riko-dash-boosted launch (LAUNCH x sqrt 1.5). */
/** the hero's speed cap (every move is clamped to it) */
export const V_MAX = Math.max(18, LAUNCH * 1.25);
/** a coin's speed cap: a free coin's fall, or a quarter over its hero's speed while it follows */
export const COIN_V_MAX = Math.max(COIN.maxSpeed * 1.6, V_MAX * 1.25);
export const MAGNUS_SIGN_MS = 3000;

export interface StepInput {
   x: number;
   y: number;
   yaw: number;
   jump: boolean;
   /** Action held (a tap flips the sign, a hold fires the hero power) */
   action: boolean;
}
export const idleInput = (): StepInput => ({ x: 0, y: 0, yaw: 0, jump: false, action: false });

export type CoinState = "pile" | "swarm" | "free" | "stolen" | "banked" | "lost";
export interface Coin {
   x: number;
   y: number;
   vx: number;
   vy: number;
   state: CoinState;
   sign: 1 | -1;
   owner: number;
   pile: number;
   slot: number;
   respawnMs: number;
   drone: number;
}

export interface Block {
   x: number;
   y: number;
   vx: number;
   vy: number;
}

export interface Drone {
   x: number;
   y: number;
   vx: number;
   vy: number;
   homeX: number;
   homeY: number;
   carrying: number;
   stunMs: number;
}

export interface Projectile {
   x: number;
   y: number;
   vx: number;
   vy: number;
   held: number;
   thrown: boolean;
   alive: boolean;
}

export interface Magnus {
   state: BossState;
   ev: BossEvents;
   active: boolean;
   x: number;
   y: number;
   sign: 1 | -1;
   signMs: number;
   phaseSeen: number;
   /** P3: the core's height over the floor (it rises) */
   coreLift: number;
   block: Projectile;
   defeatedAtMs: number;
}

export interface RoomState {
   def: ParsedRoom;
   tiles: Uint8Array;
   coins: Coin[];
   piles: number[];
   blocks: Block[];
   drones: Drone[];
   banked: number;
   doorOpen: boolean;
   ventOpen: boolean;
   orbsTaken: Uint8Array;
}

export interface HeroEvents {
   flip: boolean;
   jump: boolean;
   launch: boolean;
   latch: boolean;
   land: boolean;
   landSpeed: number;
   bank: number;
   pickup: number;
   orb: boolean;
   secret: boolean;
   hit: boolean;
   fell: boolean;
   power: boolean;
   room: boolean;
   bossHit: boolean;
   won: boolean;
   scatter: boolean;
}
const newEvents = (): HeroEvents => ({ flip: false, jump: false, launch: false, latch: false, land: false, landSpeed: 0, bank: 0, pickup: 0, orb: false, secret: false, hit: false, fell: false, power: false, room: false, bossHit: false, won: false, scatter: false });

export interface Hero {
   index: number;
   heroId: M2HeroId;
   room: number;
   x: number;
   y: number;
   vx: number;
   vy: number;
   sign: 1 | -1;
   facing: 1 | -1;
   grounded: boolean;
   coyoteMs: number;
   bufferMs: number;
   airJumped: boolean;
   latched: number;
   pulled: boolean;
   /** after jumping off a pad, its pull lets go until the hero lands */
   releaseMs: number;
   releasedPad: number;
   launchCdMs: number;
   holdMs: number;
   holdFired: boolean;
   wasHeld: boolean;
   powerMs: number;
   cooldown: number;
   dashMs: number;
   stunMs: number;
   graceMs: number;
   swarm: number;
   orbs: number;
   banked: number;
   lost: number;
   hits: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   combo: ComboState;
   comboMs: number;
   secrets: SecretTracker;
   pendingJump: boolean;
   joinMs: number;
   ev: HeroEvents;
}

export interface WorldEvents {
   bank: number;
   bankX: number;
   bankY: number;
   lost: number;
   vent: boolean;
   crack: boolean;
   droneSteal: boolean;
   droneRepel: boolean;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   bossFlip: boolean;
   throwBlock: boolean;
   door: boolean;
}
const newWorldEvents = (): WorldEvents => ({ bank: 0, bankX: 0, bankY: 0, lost: 0, vent: false, crack: false, droneSteal: false, droneRepel: false, bossTelegraph: false, bossAttack: false, bossHit: false, bossPhase: false, bossDefeated: false, bossFlip: false, throwBlock: false, door: false });

export interface World {
   level: LevelId;
   cfg: LabLevel;
   rooms: RoomState[];
   heroes: Hero[];
   magnus: Magnus | null;
   ms: number;
   accumulator: number;
   ended: "win" | "timeup" | null;
   ev: WorldEvents;
   version: number;
}

// ---------- creation ----------

function createRoom(def: ParsedRoom): RoomState {
   const coins: Coin[] = [];
   def.piles.forEach((p, i) => {
      for (let k = 0; k < p.count; k++) coins.push({ x: p.x, y: p.y + 0.15, vx: 0, vy: 0, state: "pile", sign: 1, owner: -1, pile: i, slot: 0, respawnMs: 0, drone: -1 });
   });
   return {
      def,
      tiles: Uint8Array.from(def.tiles),
      coins,
      piles: def.piles.map((p) => p.count),
      blocks: def.blocks.map((b) => ({ x: b.x, y: b.y, vx: 0, vy: 0 })),
      drones: def.drones.map((d) => ({ x: d.x, y: d.y, vx: 0, vy: 0, homeX: d.x, homeY: d.y, carrying: 0, stunMs: 0 })),
      banked: 0,
      doorOpen: def.need === 0 && !def.boss,
      ventOpen: false,
      orbsTaken: new Uint8Array(def.orbs.length),
   };
}

function createHero(w: World, index: number, heroId: M2HeroId): Hero {
   const s = w.rooms[0].def.start;
   return {
      index, heroId, room: 0, x: s.x, y: s.y, vx: 0, vy: 0, sign: 1, facing: 1, grounded: true, coyoteMs: 0, bufferMs: 0, airJumped: false,
      latched: -1, pulled: false, releaseMs: 0, releasedPad: -1, launchCdMs: 0, holdMs: 0, holdFired: false, wasHeld: false, powerMs: 0, cooldown: 0, dashMs: 0, stunMs: 0, graceMs: 0,
      swarm: 0, orbs: 0, banked: 0, lost: 0, hits: 0, finishMs: 0, ended: null, combo: createCombo(), comboMs: 0, secrets: createSecretTracker(SECRETS),
      pendingJump: false, joinMs: 0, ev: newEvents(),
   };
}

export function createWorld(level: LevelId = 1, heroIds: readonly M2HeroId[] = ["zuno"]): World {
   const cfg = LEVELS[level];
   const rooms = cfg.rooms.map((r) => createRoom(parseRoom(r)));
   const w: World = { level, cfg, rooms, heroes: [], magnus: null, ms: 0, accumulator: 0, ended: null, ev: newWorldEvents(), version: 0 };
   const arena = rooms.find((r) => r.def.boss);
   if (arena) {
      const b = arena.def.boss!;
      w.magnus = {
         state: createBoss(MAGNUS), ev: createBossEvents(), active: false, x: b.x, y: b.y - 3, sign: 1, signMs: 0, phaseSeen: 0, coreLift: 0,
         block: { x: 0, y: 0, vx: 0, vy: 0, held: -1, thrown: false, alive: false }, defeatedAtMs: -1,
      };
   }
   w.heroes = heroIds.slice(0, 4).map((id, i) => createHero(w, i, id));
   return w;
}
export const createRun = (level: LevelId = 1, heroId: M2HeroId = "zuno") => createWorld(level, [heroId]);

// ---------- tiles ----------

const tileOf = (room: RoomState, x: number, y: number): number => {
   const d = room.def;
   const c = Math.floor(x);
   const r = d.h - 1 - Math.floor(y);
   if (c < 0 || c >= d.w) return T.WALL;
   if (r < 0) return T.WALL;
   // below the room: a pit carries on down under an open floor cell; under a floor it is solid
   if (r >= d.h) return room.tiles[(d.h - 1) * d.w + c] === T.WALL ? T.WALL : T.AIR;
   return room.tiles[r * d.w + c];
};

function solidFor(room: RoomState, t: number, sign: 1 | -1, phase: boolean, glassOpen: boolean): boolean {
   switch (t) {
      case T.AIR:
      case T.RAIL:
         return false;
      case T.GATE_P:
         return sign !== 1;
      case T.GATE_N:
         return sign !== -1;
      case T.GHOST:
         return !phase;
      case T.GLASS:
         return !glassOpen;
      case T.HIDDEN:
         return !room.ventOpen;
      case T.DOOR:
         return !room.doorOpen;
      default:
         return true;
   }
}

function heroSolidAt(w: World, room: RoomState, h: Hero, x: number, y: number): boolean {
   const t = tileOf(room, x, y);
   if (solidFor(room, t, h.sign, h.heroId === "vexa" && h.powerMs > 0, false)) return true;
   for (const b of room.blocks) if (x >= b.x - 0.5 && x <= b.x + 0.5 && y >= b.y && y <= b.y + 1) return true;
   if (w.magnus && room.def.boss && magnusSolid(w.magnus, x, y)) return true;
   return false;
}

function magnusSolid(m: Magnus, x: number, y: number): boolean {
   if (!m.active || m.state.step === "done") return false;
   return Math.abs(x - m.x) < 1.2 && y >= m.y && y <= m.y + 3.2;
}

/** The hero's box overlaps something solid? (samples the four corners and the mid-sides) */
function heroHits(w: World, room: RoomState, h: Hero, x: number, y: number): boolean {
   const l = x - HERO.half;
   const r = x + HERO.half;
   const t = y + HERO.height;
   const m = y + HERO.height / 2;
   return (
      heroSolidAt(w, room, h, l, y + 0.01) || heroSolidAt(w, room, h, r, y + 0.01) || heroSolidAt(w, room, h, l, t) || heroSolidAt(w, room, h, r, t) ||
      heroSolidAt(w, room, h, l, m) || heroSolidAt(w, room, h, r, m) || heroSolidAt(w, room, h, x, y + 0.01) || heroSolidAt(w, room, h, x, t)
   );
}

// ---------- heroes ----------

function award(w: World, h: Hero, base: number) {
   h.comboMs += comboHit(h.combo, COMBO, w.ms, base);
}

function hurt(w: World, h: Hero, knockX = 0) {
   if (h.graceMs > 0 || h.ended) return;
   if (h.heroId === "kiro" && h.powerMs > 0) {
      h.powerMs = 0;
      h.graceMs = 500;
      return;
   }
   h.hits++;
   h.ev.hit = true;
   h.stunMs = STUN_MS;
   h.graceMs = GRACE_MS;
   h.latched = -1;
   h.vx = knockX;
   h.vy = 8;
   comboBreak(h.combo);
   scatter(w, h);
}

/** The swarm flies apart and falls free (a spark, a hit). */
function scatter(w: World, h: Hero) {
   const room = w.rooms[h.room];
   let n = 0;
   for (const c of room.coins) {
      if (c.state !== "swarm" || c.owner !== h.index) continue;
      c.state = "free";
      c.vx = ((n % 5) - 2) * 2.5;
      c.vy = 5 + (n % 3) * 2;
      n++;
   }
   h.swarm = 0;
   if (n) h.ev.scatter = true;
}

function respawnHero(w: World, h: Hero) {
   const s = w.rooms[h.room].def.start;
   for (const c of w.rooms[h.room].coins) if (c.state === "swarm" && c.owner === h.index) c.state = "free";
   h.swarm = 0;
   h.x = s.x;
   h.y = s.y;
   h.vx = h.vy = 0;
   h.latched = -1;
   h.ev.fell = true;
}

function power(w: World, h: Hero) {
   if (h.cooldown > 0) return;
   h.ev.power = true;
   if (h.heroId === "riko") {
      h.dashMs = DASH.ms;
      h.cooldown = DASH.cooldownMs;
      h.latched = -1;
      return;
   }
   if (h.heroId === "nami") return; // her double jump is always there
   h.powerMs = POWER_MS[h.heroId];
   h.cooldown = POWER_COOLDOWN_MS[h.heroId];
}

const range = (h: Hero, base: number) => (h.heroId === "zuno" && h.powerMs > 0 ? base * 2 : base);

function stepHero(w: World, h: Hero, input: StepInput, dt: number) {
   const ms = dt * 1000;
   h.cooldown = Math.max(0, h.cooldown - ms);
   h.powerMs = Math.max(0, h.powerMs - ms);
   h.graceMs = Math.max(0, h.graceMs - ms);
   h.launchCdMs = Math.max(0, h.launchCdMs - ms);
   h.releaseMs = Math.max(0, h.releaseMs - ms);
   h.dashMs = Math.max(0, h.dashMs - ms);
   h.stunMs = Math.max(0, h.stunMs - ms);
   comboTick(h.combo, COMBO, w.ms);
   if (h.ended) return;
   const room = w.rooms[h.room];
   const world = { x: 0, z: 0 };
   inputToWorld(input.x, 0, input.yaw, world);
   const x = Math.abs(world.x) > 0.2 ? Math.max(-1, Math.min(1, world.x)) : 0;

   // Action: a tap flips, a hold fires the power
   if (input.action) {
      h.holdMs += ms;
      if (!h.holdFired && h.holdMs >= HOLD_MS) {
         h.holdFired = true;
         power(w, h);
      }
   } else if (h.wasHeld) {
      if (!h.holdFired) flip(w, h);
      h.holdMs = 0;
      h.holdFired = false;
   }
   h.wasHeld = input.action;

   if (h.pendingJump) {
      h.bufferMs = BUFFER_MS;
      h.pendingJump = false;
   } else h.bufferMs = Math.max(0, h.bufferMs - ms);

   // pads: pull (opposite sign), push / launch (same sign)
   h.pulled = false;
   let ax = 0;
   let ay = 0;
   const cx = h.x;
   const cy = h.y + HERO.height / 2;
   room.def.pads.forEach((p, i) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d = Math.hypot(dx, dy) || 1e-6;
      const R = range(h, PAD.range);
      if (d > R) return;
      if (p.sign !== h.sign) {
         // a floor pad only launches; the hanging nodes pull
         if (p.floor) return;
         if (h.releasedPad === i && (h.releaseMs > 0 || !h.grounded)) return;
         const a = Math.min(PAD.pullMax, PAD.pull * (1 - d / R) + PAD.pullBase);
         ax += (dx / d) * a;
         ay += (dy / d) * a;
         h.pulled = true;
         if (d < PAD.latch && h.latched !== i) {
            h.latched = i;
            h.ev.latch = true;
         }
      } else {
         const onTop = p.floor && Math.abs(h.x - p.x) < 0.9 && h.y - p.y > -0.15 && h.y - p.y < 0.6;
         if (onTop && h.launchCdMs === 0 && h.vy <= 1) {
            h.vy = LAUNCH * (h.heroId === "riko" && h.dashMs > 0 ? Math.sqrt(1.5) : 1);
            h.launchCdMs = PAD.launchCooldownMs;
            h.grounded = false;
            h.latched = -1;
            h.ev.launch = true;
         } else if (!p.floor) {
            const a = PAD.push * (1 - d / R);
            ax -= (dx / d) * a;
            ay -= (dy / d) * a;
         }
      }
   });
   if (h.latched >= 0) {
      const p = room.def.pads[h.latched];
      if (!p || p.sign === h.sign) h.latched = -1;
   }
   if (h.latched >= 0) {
      // hanging on the pad: Jump lets go upward, a flip lets go
      const p = room.def.pads[h.latched];
      h.x += (p.x - h.x) * Math.min(1, dt * 12);
      h.y += (p.y - HERO.height / 2 - h.y) * Math.min(1, dt * 12);
      h.vx = h.vy = 0;
      if (h.bufferMs > 0) {
         h.releasedPad = h.latched;
         h.releaseMs = 450;
         h.latched = -1;
         h.vy = JUMP;
         h.bufferMs = 0;
         h.ev.jump = true;
      }
      if (x !== 0) h.facing = x > 0 ? 1 : -1;
      after(w, h, room);
      return;
   }

   // walking, dashing, gravity
   const stunned = h.stunMs > 0;
   if (h.dashMs > 0) {
      h.vx = DASH.speed * h.facing;
      h.vy = Math.max(h.vy, 0);
   } else if (!stunned) {
      const target = x * WALK;
      const accel = h.grounded ? 60 : 30;
      const dv = target - h.vx;
      h.vx += Math.sign(dv) * Math.min(Math.abs(dv), accel * dt);
      if (x !== 0) h.facing = x > 0 ? 1 : -1;
   }
   h.vx += ax * dt;
   const g = GRAVITY * (h.pulled ? PAD.gravityWhilePulled : 1);
   if (h.dashMs <= 0) h.vy -= g * dt;
   h.vy += ay * dt;
   const sp = Math.hypot(h.vx, h.vy);
   const cap = V_MAX;
   if (sp > cap) {
      h.vx *= cap / sp;
      h.vy *= cap / sp;
   }
   h.vy = Math.max(-MAX_FALL, h.vy);

   // jumps: the ground (with coyote time) or, for Nami, once in the air
   if (h.bufferMs > 0 && !stunned) {
      if (h.grounded || h.coyoteMs > 0) {
         h.vy = JUMP;
         h.grounded = false;
         h.coyoteMs = 0;
         h.bufferMs = 0;
         h.ev.jump = true;
      } else if (h.heroId === "nami" && !h.airJumped) {
         h.vy = JUMP;
         h.airJumped = true;
         h.bufferMs = 0;
         h.ev.jump = true;
      }
   }

   // move and collide, axis by axis (a blocked move closes the gap by bisection)
   const vyBefore = h.vy;
   const was = h.grounded;
   const mx = moveAxis(w, room, h, h.vx * dt, 0);
   if (mx.blocked) {
      if (h.dashMs > 0) breakGlass(w, room, h.x + h.facing * (HERO.half + 0.2), h.y + 0.6);
      h.vx = 0;
   }
   const my = moveAxis(w, room, h, 0, h.vy * dt);
   h.grounded = false;
   if (my.blocked) {
      if (h.vy < 0) {
         h.grounded = true;
         h.releasedPad = -1;
         h.airJumped = false;
      }
      h.vy = 0;
   }
   if (!h.grounded && heroHits(w, room, h, h.x, h.y - 0.03)) h.grounded = h.vy <= 0.01;
   if (h.grounded && !was) {
      h.ev.land = true;
      h.ev.landSpeed = -vyBefore;
   }
   h.coyoteMs = h.grounded ? COYOTE_MS : Math.max(0, h.coyoteMs - ms);

   // the static floor stings and scatters the swarm
   if (h.grounded && (tileOf(room, h.x - HERO.half, h.y - 0.05) === T.SPARK || tileOf(room, h.x + HERO.half, h.y - 0.05) === T.SPARK)) {
      if (!(h.heroId === "kiro" && h.powerMs > 0)) hurt(w, h, -h.facing * 4);
   }
   if (h.y < -2) respawnHero(w, h);
   after(w, h, room);
}

function moveAxis(w: World, room: RoomState, h: Hero, dx: number, dy: number): { blocked: boolean } {
   if (dx === 0 && dy === 0) return { blocked: false };
   if (!heroHits(w, room, h, h.x + dx, h.y + dy)) {
      h.x += dx;
      h.y += dy;
      return { blocked: false };
   }
   let lo = 0;
   let hi = 1;
   for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      if (heroHits(w, room, h, h.x + dx * mid, h.y + dy * mid)) hi = mid;
      else lo = mid;
   }
   h.x += dx * lo;
   h.y += dy * lo;
   return { blocked: true };
}

function flip(w: World, h: Hero) {
   h.sign = h.sign === 1 ? -1 : 1;
   h.ev.flip = true;
   for (const c of w.rooms[h.room].coins) if (c.state === "swarm" && c.owner === h.index) c.sign = h.sign;
}

function breakGlass(w: World, room: RoomState, x: number, y: number) {
   for (const yy of [y, y + 0.7]) {
      const c = Math.floor(x);
      const r = room.def.h - 1 - Math.floor(yy);
      if (c < 0 || r < 0 || c >= room.def.w || r >= room.def.h) continue;
      const i = r * room.def.w + c;
      if (room.tiles[i] === T.CRACKED) {
         room.tiles[i] = T.AIR;
         w.version++;
         w.ev.crack = true;
      }
   }
}

/** Pickups, secrets, the door. */
function after(w: World, h: Hero, room: RoomState) {
   const cx = h.x;
   const cy = h.y + HERO.height / 2;
   room.def.orbs.forEach((o, i) => {
      if (!room.orbsTaken[i] && Math.abs(o.x - cx) < 0.8 && Math.abs(o.y - cy) < 1.0) {
         room.orbsTaken[i] = 1;
         h.orbs++;
         h.ev.orb = true;
      }
   });
   for (const s of room.def.secrets) {
      // the prototype sticker sits behind lab glass: Zuno's overcharge pulls it through from up to 3.5 m
      const pulledThrough = s.id === 1 && h.heroId === "zuno" && h.powerMs > 0 && Math.hypot(s.x - cx, s.y - cy) < 3.5;
      if (((Math.abs(s.x - cx) < 0.8 && Math.abs(s.y - cy) < 1.0) || pulledThrough) && collectSecret(h.secrets, s.id)) h.ev.secret = true;
   }
   // the door: walking into the open door cell
   const d = room.def.door;
   if (room.doorOpen && Math.abs(h.x - d.x) < 0.7 && Math.abs(h.y - d.y) < 1.2) {
      if (h.room + 1 < w.rooms.length) {
         for (const c of room.coins) if (c.state === "swarm" && c.owner === h.index) c.state = "free";
         h.room++;
         const s = w.rooms[h.room].def.start;
         h.x = s.x;
         h.y = s.y;
         h.vx = h.vy = 0;
         h.swarm = 0;
         h.latched = -1;
         h.ev.room = true;
      } else if (!h.ended) {
         h.ended = "win";
         h.finishMs = w.ms;
         h.ev.won = true;
      }
   }
}

// ---------- coins ----------

function coinSolid(w: World, room: RoomState, c: Coin, x: number, y: number): boolean {
   const t = tileOf(room, x, y);
   const owner = c.owner >= 0 ? w.heroes[c.owner] : null;
   const glassOpen = c.state === "swarm" && !!owner && owner.heroId === "zuno" && owner.powerMs > 0;
   if (solidFor(room, t, c.sign, false, glassOpen)) return true;
   for (const b of room.blocks) if (x >= b.x - 0.5 && x <= b.x + 0.5 && y >= b.y && y <= b.y + 1) return true;
   return false;
}

function stepCoins(w: World, room: RoomState, ri: number, dt: number) {
   const ms = dt * 1000;
   const heroes = w.heroes.filter((h) => h.room === ri && !h.ended);
   // pickups: one coin at a time from a pile or the floor
   for (const h of heroes) {
      h.swarm = 0;
      for (const c of room.coins) if (c.state === "swarm" && c.owner === h.index) h.swarm++;
   }
   for (const h of heroes) {
      h.joinMs = Math.max(0, h.joinMs - ms);
      if (h.stunMs > 0) continue;
      const cx = h.x;
      const cy = h.y + HERO.height / 2;
      const R = range(h, COIN.pickup);
      for (const c of room.coins) {
         if (h.swarm >= COIN.swarmMax) break;
         if (c.state !== "pile" && c.state !== "free") continue;
         if (Math.hypot(c.x - cx, c.y - cy) > (c.state === "pile" ? R : R * 0.6)) continue;
         // a pile feeds its coins one at a time
         if (c.state === "pile" && h.joinMs > 0) continue;
         if (c.state === "pile") h.joinMs = COIN.joinMs;
         c.state = "swarm";
         c.owner = h.index;
         c.sign = h.sign;
         c.slot = h.swarm;
         h.swarm++;
         h.ev.pickup++;
         break;
      }
   }
   const bank = room.def.bank;
   for (const c of room.coins) {
      if (c.state === "banked" || c.state === "pile") continue;
      if (c.state === "lost") {
         c.respawnMs -= ms;
         if (c.respawnMs <= 0) {
            const p = room.def.piles[c.pile];
            c.state = "pile";
            c.x = p.x;
            c.y = p.y + 0.15;
            c.vx = c.vy = 0;
         }
         continue;
      }
      if (c.state === "stolen") {
         const d = room.drones[c.drone];
         if (d) {
            c.x = d.x + Math.sin(c.slot * 1.7 + w.ms / 300) * 0.3;
            c.y = d.y - 0.5;
         }
         continue;
      }
      if (c.state === "swarm") {
         const h = w.heroes[c.owner];
         if (!h || h.room !== ri || h.ended) {
            c.state = "free";
         } else {
            const ang = c.slot * 2.4 + w.ms / 600;
            const r = 0.75 + c.slot * 0.035;
            const tx = h.x - h.facing * 0.5 + Math.cos(ang) * r;
            const ty = h.y + 0.9 + Math.sin(ang) * r * 0.6;
            let ax = (tx - c.x) * COIN.spring - c.vx * COIN.damping;
            let ay = (ty - c.y) * COIN.spring - c.vy * COIN.damping - COIN.sag;
            const a = Math.hypot(ax, ay);
            if (a > COIN.accelMax) {
               ax *= COIN.accelMax / a;
               ay *= COIN.accelMax / a;
            }
            c.vx += ax * dt;
            c.vy += ay * dt;
            // the swarm shares the hero's sign, so a pad's field that carries the hero carries it too
            const riding = h.pulled || h.latched >= 0 || (!h.grounded && Math.hypot(h.vx, h.vy) > WALK * 1.2);
            if (riding) {
               c.vx += (h.vx - c.vx) * Math.min(1, 6 * dt);
               c.vy += (h.vy - c.vy) * Math.min(1, 6 * dt);
            }
            if (Math.hypot(c.x - h.x, c.y - h.y - 0.7) > range(h, COIN.follow) * (riding ? 1.6 : 1)) c.state = "free";
         }
      }
      if (c.state === "free") c.vy -= GRAVITY * dt;
      const sp = Math.hypot(c.vx, c.vy);
      const ownerSp = c.state === "swarm" && w.heroes[c.owner] ? Math.hypot(w.heroes[c.owner].vx, w.heroes[c.owner].vy) * 1.25 : 0;
      const cap = Math.min(COIN_V_MAX, Math.max(COIN.maxSpeed * (c.state === "free" ? 1.6 : 1), ownerSp));
      if (sp > cap) {
         const k = cap / sp;
         c.vx *= k;
         c.vy *= k;
      }
      // a coin caught halfway through a gate when its sign flipped slips out of it
      const here = tileOf(room, c.x, c.y);
      const inside = (here === T.GATE_P || here === T.GATE_N) && coinSolid(w, room, c, c.x, c.y);
      const nx = c.x + c.vx * dt;
      if (inside || !coinSolid(w, room, c, nx, c.y)) c.x = nx;
      else c.vx *= -0.2;
      const ny = c.y + c.vy * dt;
      if (inside || !coinSolid(w, room, c, c.x, ny)) c.y = ny;
      else {
         if (c.state === "free" && c.vy < 0) c.vx *= 0.6;
         c.vy *= -0.15;
      }
      // the bank swallows any coin that reaches it
      if (Math.abs(c.x - bank.x) < COIN.bankR && Math.abs(c.y - (bank.y + 0.6)) < COIN.bankR) {
         const owner = c.state === "swarm" ? w.heroes[c.owner] : nearestHero(heroes, c.x, c.y);
         c.state = "banked";
         room.banked++;
         w.ev.bank++;
         w.ev.bankX = bank.x;
         w.ev.bankY = bank.y;
         if (owner) {
            owner.banked++;
            owner.ev.bank++;
            award(w, owner, COMBO_BASE_MS.bank);
         }
         if (!room.doorOpen && room.banked >= room.def.need && !room.def.boss) {
            room.doorOpen = true;
            w.ev.door = true;
         }
         continue;
      }
      if (c.y < -1.5) {
         if (c.state === "swarm" && c.owner >= 0) w.heroes[c.owner].lost++;
         c.state = "lost";
         c.respawnMs = COIN.respawnMs;
         w.ev.lost++;
      }
   }
}

function nearestHero(heroes: Hero[], x: number, y: number): Hero | null {
   let best: Hero | null = null;
   for (const h of heroes) if (!best || Math.hypot(h.x - x, h.y - y) < Math.hypot(best.x - x, best.y - y)) best = h;
   return best;
}

// ---------- blocks ----------

function stepBlocks(w: World, room: RoomState, ri: number, dt: number) {
   for (const b of room.blocks) {
      let a = 0;
      for (const h of w.heroes) {
         if (h.room !== ri || h.ended) continue;
         const dx = h.x - b.x;
         const dy = h.y + 0.6 - (b.y + 0.5);
         const d = Math.hypot(dx, dy);
         if (d > range(h, BLOCK.range) || Math.abs(dx) < 0.05) continue;
         // the blocks are + steel: an opposite (-) hero pulls, a same (+) hero pushes
         const k = BLOCK.accel * (1 - d / range(h, BLOCK.range)) + 4;
         a += (h.sign === -1 ? Math.sign(dx) : -Math.sign(dx)) * k;
      }
      // a - hero standing on a block holds it to their feet: the block rides along under them
      const rider = w.heroes.find((h) => h.room === ri && !h.ended && h.sign === -1 && h.grounded && Math.abs(h.y - (b.y + 1)) < 0.06 && Math.abs(h.x - b.x) < 0.5 + HERO.half);
      if (rider) b.vx = Math.max(-BLOCK.rideSpeed, Math.min(BLOCK.rideSpeed, rider.vx));
      else {
         b.vx += a * dt;
         b.vx -= Math.sign(b.vx) * Math.min(Math.abs(b.vx), BLOCK.friction * dt);
         b.vx = Math.max(-BLOCK.maxSpeed, Math.min(BLOCK.maxSpeed, b.vx));
      }
      const nx = b.x + b.vx * dt;
      const edge = nx + Math.sign(b.vx) * 0.5;
      const t = tileOf(room, edge, b.y + 0.5);
      const blockedByWall = t !== T.AIR && t !== T.RAIL;
      const blockedByBlock = room.blocks.some((o) => o !== b && Math.abs(o.x - nx) < 1 && Math.abs(o.y - b.y) < 0.9);
      const blockedByHero = w.heroes.some((h) => h.room === ri && Math.abs(h.x - nx) < 0.5 + HERO.half + 0.02 && h.y < b.y + 0.98 && h.y + HERO.height > b.y);
      if (!blockedByWall && !blockedByBlock && !blockedByHero) b.x = nx;
      else b.vx = 0;
      // supported by a floor or a rail; else it drops
      const below = tileOf(room, b.x, b.y - 0.05);
      const below2 = tileOf(room, b.x - 0.45, b.y - 0.05);
      const below3 = tileOf(room, b.x + 0.45, b.y - 0.05);
      const supported = [below, below2, below3].some((v) => v !== T.AIR) || room.blocks.some((o) => o !== b && Math.abs(o.x - b.x) < 0.95 && Math.abs(o.y + 1 - b.y) < 0.05);
      if (!supported) {
         b.vy -= GRAVITY * dt;
         b.y += b.vy * dt;
         if (b.y < -3) {
            const home = room.def.blocks[room.blocks.indexOf(b)];
            b.x = home.x;
            b.y = home.y;
            b.vy = 0;
            b.vx = 0;
         }
      } else {
         if (b.vy < 0) b.y = Math.round(b.y);
         b.vy = 0;
      }
      // a block pushed into a vent plugs it: the hidden route opens
      for (const v of room.def.vents) {
         if (!room.ventOpen && Math.abs(b.x - v.x) < 0.35 && Math.abs(b.y - v.y) < 0.4) {
            room.ventOpen = true;
            w.ev.vent = true;
            w.version++;
         }
      }
   }
}

// ---------- drones ----------

function stepDrones(w: World, room: RoomState, ri: number, dt: number) {
   room.drones.forEach((d, di) => {
      d.stunMs = Math.max(0, d.stunMs - dt * 1000);
      // repel: a + hero up close blasts it back and knocks its coins loose
      for (const h of w.heroes) {
         if (h.room !== ri || h.ended || h.sign !== 1) continue;
         const dd = Math.hypot(h.x - d.x, h.y + 0.7 - d.y);
         if (dd < range(h, DRONE.repel) && d.stunMs === 0) {
            d.vx = Math.sign(d.x - h.x || 1) * 9;
            d.vy = 6;
            d.stunMs = 1200;
            if (d.carrying) {
               for (const c of room.coins) if (c.state === "stolen" && c.drone === di) {
                  c.state = "free";
                  c.vy = 3;
                  c.vx = ((c.slot % 3) - 1) * 1.5;
               }
               d.carrying = 0;
            }
            w.ev.droneRepel = true;
         }
      }
      let tx = d.homeX;
      let ty = d.homeY;
      if (d.carrying < DRONE.carry && d.stunMs === 0) {
         // hunt the biggest swarm in the room
         let best: Hero | null = null;
         for (const h of w.heroes) if (h.room === ri && !h.ended && h.swarm > 0 && (!best || h.swarm > best.swarm)) best = h;
         if (best) {
            tx = best.x - best.facing * 0.6;
            ty = best.y + 1.0;
         }
      }
      const dx = tx - d.x;
      const dy = ty - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      // a drone back home with a load drops it down the recycler: the coins return to their pile
      if (d.carrying && tx === d.homeX && ty === d.homeY && dist < 0.6) {
         for (const c of room.coins) if (c.state === "stolen" && c.drone === di) {
            c.state = "lost";
            c.respawnMs = COIN.respawnMs;
         }
         d.carrying = 0;
         w.ev.lost++;
      }
      const sp = d.stunMs > 0 ? 0 : DRONE.speed;
      d.vx += ((dx / dist) * sp - d.vx) * Math.min(1, dt * 3);
      d.vy += ((dy / dist) * sp - d.vy) * Math.min(1, dt * 3);
      d.x = Math.max(1, Math.min(room.def.w - 1, d.x + d.vx * dt));
      d.y = Math.max(1, Math.min(room.def.h - 1.5, d.y + d.vy * dt));
      // steal
      if (d.carrying < DRONE.carry && d.stunMs === 0) {
         for (const c of room.coins) {
            if (c.state !== "swarm") continue;
            if (Math.hypot(c.x - d.x, c.y - d.y) < DRONE.steal) {
               const h = w.heroes[c.owner];
               if (h) h.swarm--;
               c.state = "stolen";
               c.drone = di;
               c.slot = d.carrying;
               d.carrying++;
               w.ev.droneSteal = true;
               if (d.carrying >= DRONE.carry) break;
            }
         }
      }
   });
}

// ---------- Scrap Magnus (L5) ----------

function stepMagnus(w: World, dt: number) {
   const m = w.magnus;
   if (!m) return;
   const ri = w.rooms.findIndex((r) => r.def.boss);
   const room = w.rooms[ri];
   const heroes = w.heroes.filter((h) => h.room === ri && !h.ended);
   if (!m.active) {
      if (!heroes.length) return;
      m.active = true;
   }
   const ev = m.ev;
   for (const k of Object.keys(ev) as (keyof BossEvents)[]) ev[k] = false;
   const before = m.state.step;
   stepBoss(m.state, MAGNUS, dt * 1000, ev);
   if (m.state.hp === 0 && m.defeatedAtMs < 0) {
      m.defeatedAtMs = w.ms;
      room.doorOpen = true;
      w.ev.bossDefeated = true;
      w.ev.door = true;
   }
   if (m.state.phase !== m.phaseSeen) {
      m.phaseSeen = m.state.phase;
      w.ev.bossPhase = true;
   }
   // P1: his sign swaps at the start of every slam (the HUD ring shows it) and holds through it
   m.signMs += dt * 1000;
   const step = m.state.step;
   if (step !== before) {
      if (step === "telegraph") {
         w.ev.bossTelegraph = true;
         if (m.state.phase === 0 && m.signMs >= MAGNUS_SIGN_MS) {
            m.signMs = 0;
            m.sign = m.sign === 1 ? -1 : 1;
            w.ev.bossFlip = true;
         }
      }
      if (step === "attack") {
         w.ev.bossAttack = true;
         if (m.state.phase === 1) {
            // he hurls a block at the nearest hero
            const h = heroes[0];
            if (h) {
               const sx = m.x;
               const sy = m.y + 3.2;
               const dx = h.x - sx;
               const dy = h.y + 0.8 - sy;
               const d = Math.hypot(dx, dy) || 1;
               m.block = { x: sx, y: sy, vx: (dx / d) * 9, vy: (dy / d) * 9 + 3, held: -1, thrown: false, alive: true };
               w.ev.throwBlock = true;
            }
         }
      }
   }
   const coreX = m.x;
   const coreY = m.y + 2.4 + m.coreLift;
   if (m.state.phase === 2) m.coreLift = Math.min(4.6, m.coreLift + dt * 2);
   for (const h of heroes) {
      const cx = h.x;
      const cy = h.y + HERO.height / 2;
      const d = Math.hypot(coreX - cx, coreY - cy);
      if (m.state.phase === 0) {
         // the slam: a same-sign hero rides the shove out; an opposite one is caught in it
         if (step === "attack" && Math.abs(cx - m.x) < 5 && h.y < m.y + 1.5) {
            if (h.sign === m.sign) {
               h.vx += Math.sign(cx - m.x || 1) * 40 * dt;
            } else hurt(w, h, Math.sign(cx - m.x || 1) * 8);
         }
         // the open core yanks an opposite-sign hero in: contact is the hit
         if (step === "vulnerable" && h.sign !== m.sign && d < 8) {
            h.vx += ((coreX - cx) / d) * 90 * dt;
            h.vy += ((coreY - cy) / d) * 90 * dt;
            // reaching his chest plate (the open core sits behind it) is the hit
            if (d < 1.4 || (Math.abs(cx - m.x) < 1.2 + HERO.half + 0.15 && cy > m.y && cy < m.y + 3.6)) strike(w, m, h, cx);
         }
      } else if (m.state.phase === 2) {
         if (step === "vulnerable" && d < 1.3) strike(w, m, h, cx);
      }
   }
   // P2's block
   const b = m.block;
   if (b.alive) {
      if (b.held >= 0) {
         const h = w.heroes[b.held];
         // held by a - hero over its head; a flip to + throws it back at Magnus
         if (h.sign === -1) {
            b.x += (h.x - b.x) * Math.min(1, dt * 10);
            b.y += (h.y + 2.2 - b.y) * Math.min(1, dt * 10);
         } else {
            const dx = coreX - b.x;
            const dy = coreY - b.y;
            const dd = Math.hypot(dx, dy) || 1;
            b.vx = (dx / dd) * 18;
            b.vy = (dy / dd) * 18;
            b.held = -1;
            b.thrown = true;
         }
      } else {
         if (!b.thrown) b.vy -= GRAVITY * 0.4 * dt;
         b.x += b.vx * dt;
         b.y += b.vy * dt;
         for (const h of heroes) {
            const d = Math.hypot(h.x - b.x, h.y + 0.8 - b.y);
            if (!b.thrown && h.sign === -1 && d < 3) {
               b.held = h.index;
               b.vx = b.vy = 0;
            } else if (!b.thrown && d < 0.9) {
               hurt(w, h, Math.sign(b.vx) * 6);
               b.alive = false;
            }
         }
         if (b.thrown && Math.hypot(b.x - coreX, b.y - coreY) < 1.6) {
            b.alive = false;
            const res = hitBoss(m.state, MAGNUS, 1, m.ev);
            if (res !== "ignored") {
               w.ev.bossHit = true;
               const h = heroes[0];
               if (h) {
                  h.ev.bossHit = true;
                  award(w, h, COMBO_BASE_MS.boss);
               }
            }
         }
         if (b.y < -1 || b.x < 0 || b.x > room.def.w) b.alive = false;
         if (!b.thrown && tileOf(room, b.x, b.y) === T.WALL) b.alive = false;
      }
   }
}

function strike(w: World, m: Magnus, h: Hero, cx: number) {
   const res = hitBoss(m.state, MAGNUS, 1, m.ev);
   if (res === "ignored") return;
   w.ev.bossHit = true;
   h.ev.bossHit = true;
   award(w, h, COMBO_BASE_MS.boss);
   // thrown clear of the chest
   h.vx = Math.sign(cx - m.x || -1) * 12;
   h.vy = 9;
   h.latched = -1;
}

// ---------- the step ----------

const edges = new WeakMap<Hero, { jump: boolean }>();

export function stepWorld(w: World, dtMs: number, inputs: readonly StepInput[]) {
   for (const h of w.heroes) {
      const e = h.ev as unknown as Record<string, number | boolean>;
      for (const k of Object.keys(e)) e[k] = typeof e[k] === "number" ? 0 : false;
   }
   const we = w.ev as unknown as Record<string, number | boolean>;
   for (const k of Object.keys(we)) we[k] = typeof we[k] === "number" ? 0 : false;
   if (w.ended || !Number.isFinite(dtMs) || dtMs <= 0) return;
   w.accumulator += Math.min(250, dtMs);
   w.heroes.forEach((h, k) => {
      const i = inputs[k];
      if (!i) return;
      let p = edges.get(h);
      if (!p) edges.set(h, (p = { jump: false }));
      p.jump ||= i.jump;
   });
   while (w.accumulator + 1e-7 >= FIXED_MS && !w.ended) {
      quantum(w, inputs, FIXED_MS / 1000);
      w.accumulator -= FIXED_MS;
   }
}

function sanitize(i: StepInput): StepInput {
   const f = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
   return { x: f(i.x), y: f(i.y), yaw: Number.isFinite(i.yaw) ? i.yaw : 0, jump: !!i.jump, action: !!i.action };
}

function quantum(w: World, inputs: readonly StepInput[], dt: number) {
   w.ms += dt * 1000;
   if (w.ms >= w.cfg.durationMs) {
      w.ended = "timeup";
      for (const h of w.heroes) if (!h.ended) h.ended = "timeup";
      return;
   }
   w.heroes.forEach((h, k) => {
      const p = edges.get(h);
      if (p) {
         h.pendingJump ||= p.jump;
         p.jump = false;
      }
      stepHero(w, h, sanitize(inputs[k] ?? idleInput()), dt);
   });
   w.rooms.forEach((room, ri) => {
      if (!w.heroes.some((h) => h.room === ri)) return;
      stepBlocks(w, room, ri, dt);
      stepDrones(w, room, ri, dt);
      stepCoins(w, room, ri, dt);
   });
   stepMagnus(w, dt);
   if (w.heroes.every((h) => h.ended !== null)) w.ended = w.heroes.some((h) => h.ended === "win") ? "win" : "timeup";
}

export function step(w: World, dtMs: number, input: StepInput) {
   stepWorld(w, dtMs, [input]);
}

// ---------- scoring and limits ----------

export const runTimeMs = (finishMs: number, orbs: number, comboMs = 0) => Math.max(0, Math.round(finishMs - orbs * ORB_BONUS_MS - comboMs));
export const submittedMs = (h: Hero) => runTimeMs(h.finishMs, h.orbs, h.comboMs);

export const orbTotal = (level: LevelId) => LEVELS[level].rooms.reduce((n, r) => n + parseRoom(r).orbs.length, 0);
export const coinsNeeded = (level: LevelId) => LEVELS[level].rooms.reduce((n, r) => n + parseRoom(r).need, 0);

/** What the level can feed the flow meter: every banked coin (at most every coin in the lab), every Magnus hit. */
export function comboSpecOf(level: LevelId): ComboLevelSpec {
   const coins = LEVELS[level].rooms.reduce((n, r) => n + parseRoom(r).piles.reduce((m, p) => m + p.count, 0), 0);
   const boss = LEVELS[level].rooms.some((r) => parseRoom(r).boss);
   return { combo: COMBO, sources: [{ count: coins, base: COMBO_BASE_MS.bank }, { count: boss ? MAGNUS.maxHp : 0, base: COMBO_BASE_MS.boss }] };
}

/** The earliest rules ms Magnus can be down once he wakes: every vulnerable window hit at its first ms. */
export function bossMinMs(): number {
   const s = createBoss(MAGNUS);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, MAGNUS, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, MAGNUS, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

/**
 * The least finish ms: each room takes at least the straight line from its start to its door at
 * V_MAX (every hero move is clamped to it), and at least the nearest pile's straight line to the bank
 * at COIN_V_MAX (every coin move is clamped to it); the arena adds Magnus's fastest defeat.
 */
export function minFinishMs(level: LevelId): number {
   let total = 0;
   for (const r of LEVELS[level].rooms) {
      const d = parseRoom(r);
      const hero = (Math.hypot(d.door.x - d.start.x, d.door.y - d.start.y) / V_MAX) * 1000;
      let coin = 0;
      if (d.need > 0 && d.piles.length) {
         const near = Math.min(...d.piles.map((p) => Math.hypot(d.bank.x - p.x, d.bank.y - p.y)));
         coin = (Math.max(0, near - COIN.bankR * 1.5) / COIN_V_MAX) * 1000;
      }
      total += Math.max(hero, coin);
      if (d.boss) total += bossMinMs();
   }
   return Math.floor(total);
}

export function minDurationMsOf(level: LevelId): number {
   return Math.max(0, minFinishMs(level) - orbTotal(level) * ORB_BONUS_MS - comboMaxBonus(comboSpecOf(level)));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(id: LevelId): LevelLimits {
   const lb = minDurationMsOf(id);
   const minDurationMs = Math.max(100, Math.floor(lb / 100) * 100);
   const timeBaseMs = LEVELS[id].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = { 1: proposeLimits(1), 2: proposeLimits(2), 3: proposeLimits(3), 4: proposeLimits(4), 5: proposeLimits(5) };

export const STAT = {
   orbs: "orbs",
   finishMs: "finishMs",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   room: "room",
   banked: "banked",
   need: "need",
   swarm: "swarm",
   sign: "sign",
   power: "power",
   lost: "lost",
   hits: "hits",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossSign: "bossSign",
   coach: "coach",
   boss: "boss",
   noLoss: "noLoss",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

export function finalScore(s: { score: number; endReason: string | null; stats: Record<string, number>; elapsedMs: number }): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}
