// The hero animator's state machine: which animation the hero is in, and the blend weights the
// pose and the body are built from. Pure (no three.js, no React) and allocation-free after
// createHeroAnimState(): stepHeroAnimState() updates the same object every frame.
//
// Inputs (HeroMotion, the game writes it every frame): the velocity, grounded, the power that is up,
// whether the hero is rolled up in its ball, celebrating or defeated, and one-frame events (jumped,
// the double jump, landed, hurt). Output (HeroAnimState): `state`, the one weight per state
// (`weights`, they always sum to 1, cross-faded at the state's own speed), the timers since each
// event and the eased run amount.
//
// The priority, highest first: defeat > hurt > cheer > ball > dash > flip (the double jump) >
// takeoff > rise / fall (in the air) > land > run / idle (on the ground).
//
// Visual only: nothing here feeds back into a game's rules.

export const HERO_ANIM_STATES = ["idle", "run", "takeoff", "rise", "fall", "land", "flip", "ball", "dash", "hurt", "cheer", "defeat"] as const;
export type HeroAnimStateId = (typeof HERO_ANIM_STATES)[number];
export const HERO_STATE_COUNT = HERO_ANIM_STATES.length;

/** Index of each state in HERO_ANIM_STATES (and in `weights`). */
export const HS = {
   idle: 0,
   run: 1,
   takeoff: 2,
   rise: 3,
   fall: 4,
   land: 5,
   flip: 6,
   ball: 7,
   dash: 8,
   hurt: 9,
   cheer: 10,
   defeat: 11,
} as const satisfies Record<HeroAnimStateId, number>;

/** The five heroes' powers (menu2 games' heroes.ts PowerId). */
export type HeroPowerKind = "dash" | "doubleJump" | "shield" | "magnet" | "phase";

/** One-frame events. The game sets them; stepHeroAnimState reads them and clears them. */
export interface HeroMotionEvents {
   /** a jump from the ground */
   jumped: boolean;
   /** a jump in the air (Nami's double jump): the somersault */
   airJumped: boolean;
   /** the feet touched down; `landSpeed` = the fall speed then (m/s, > 0) */
   landed: boolean;
   landSpeed: number;
   /** a hit; (hurtX, hurtZ) = the direction the hero is pushed (world, any length) */
   hurt: boolean;
   hurtX: number;
   hurtZ: number;
}

/** What the game tells the animator every frame. */
export interface HeroMotion {
   /** velocity, m/s, world (y up) */
   vx: number;
   vy: number;
   vz: number;
   grounded: boolean;
   /** the power that is up right now (null = none) */
   power: HeroPowerKind | null;
   /** rolled up in the armoured ball (a bounce, a roll power, a long fall) */
   rolling: boolean;
   /** the win: arms up, hopping */
   celebrating: boolean;
   /** out of the run (lost): slumps down, stays */
   defeated: boolean;
   events: HeroMotionEvents;
}

export function createHeroMotion(): HeroMotion {
   return {
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: true,
      power: null,
      rolling: false,
      celebrating: false,
      defeated: false,
      events: { jumped: false, airJumped: false, landed: false, landSpeed: 0, hurt: false, hurtX: 0, hurtZ: 0 },
   };
}

export function clearHeroEvents(m: HeroMotion): void {
   const e = m.events;
   e.jumped = false;
   e.airJumped = false;
   e.landed = false;
   e.landSpeed = 0;
   e.hurt = false;
}

/** How long the one-shot states last (s). */
export const HERO_TIMING = {
   takeoff: 0.16,
   land: 0.24,
   flip: 0.5,
   hurt: 0.45,
} as const;

/** Cross-fade speed into each state (1/s: about 3 / rate s to settle). Snappy for hits, soft for idle. */
export const HERO_FADE: Readonly<Record<HeroAnimStateId, number>> = {
   idle: 8,
   run: 12,
   takeoff: 30,
   rise: 14,
   fall: 8,
   land: 32,
   flip: 30,
   ball: 16,
   dash: 28,
   hurt: 36,
   cheer: 9,
   defeat: 6,
};

/** Below this ground speed (m/s) the hero stands. */
export const RUN_FROM = 0.35;

export interface HeroAnimConfig {
   /** the hero's full run speed (m/s): runAmount 1 */
   topSpeed: number;
   /** the jump's take-off speed (m/s): the rise tucks as vy falls from it */
   jumpSpeed: number;
}

export interface HeroAnimState {
   readonly config: HeroAnimConfig;
   /** the current state (index into HERO_ANIM_STATES) and the one before it */
   state: number;
   prev: number;
   /** s in the current state */
   time: number;
   /** s since the animator started (idle breathing, flutters) */
   clock: number;
   /** one per state, sum 1 */
   readonly weights: Float32Array;
   /** ground speed (m/s), and the run amount 0..1 (eased) */
   speed: number;
   runAmount: number;
   /** s since each event (Infinity = never); sinceDefeat / sinceCheer / sinceFall: s in it (0 when not) */
   sinceJump: number;
   sinceAirJump: number;
   sinceLand: number;
   sinceHurt: number;
   sinceDefeat: number;
   sinceCheer: number;
   sinceFall: number;
   /** the last landing's impact 0..1 and the last hit's push direction (unit, world xz) */
   landImpact: number;
   hurtX: number;
   hurtZ: number;
   /** the rise's tuck 0..1 */
   tuck: number;
   /** the stride phase (rad) and the ball's roll angle (rad): advanced by the pose / body steps */
   phase: number;
}

export function createHeroAnimState(config: Partial<HeroAnimConfig> = {}): HeroAnimState {
   const weights = new Float32Array(HERO_STATE_COUNT);
   weights[HS.idle] = 1;
   return {
      config: { topSpeed: config.topSpeed ?? 6.5, jumpSpeed: config.jumpSpeed ?? 14 },
      state: HS.idle,
      prev: HS.idle,
      time: 0,
      clock: 0,
      weights,
      speed: 0,
      runAmount: 0,
      sinceJump: Infinity,
      sinceAirJump: Infinity,
      sinceLand: Infinity,
      sinceHurt: Infinity,
      sinceDefeat: 0,
      sinceCheer: 0,
      sinceFall: 0,
      landImpact: 0,
      hurtX: 0,
      hurtZ: 1,
      tuck: 0,
      phase: 0,
   };
}

/** The state the hero should be in now (pure: from the timers and the motion, no fading). */
export function pickHeroState(s: HeroAnimState, m: HeroMotion): number {
   if (m.defeated) return HS.defeat;
   if (s.sinceHurt < HERO_TIMING.hurt) return HS.hurt;
   if (m.celebrating) return HS.cheer;
   if (m.rolling) return HS.ball;
   if (m.power === "dash") return HS.dash;
   if (!m.grounded) {
      if (s.sinceAirJump < HERO_TIMING.flip) return HS.flip;
      if (s.sinceJump < HERO_TIMING.takeoff) return HS.takeoff;
      return m.vy > 0 ? HS.rise : HS.fall;
   }
   // a landing at a run is shorter (the run takes over sooner)
   if (s.sinceLand < HERO_TIMING.land * (1 - 0.6 * s.runAmount)) return HS.land;
   return s.speed > RUN_FROM ? HS.run : HS.idle;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * One frame: reads (and clears) the motion's events, advances the timers by `dt` (visual s; 0 =
 * paused: nothing changes, the events wait), picks the state and cross-fades the weights to it.
 */
export function stepHeroAnimState(s: HeroAnimState, m: HeroMotion, dt: number): HeroAnimState {
   if (!(dt > 0)) return s;
   const e = m.events;
   s.sinceJump += dt;
   s.sinceAirJump += dt;
   s.sinceLand += dt;
   s.sinceHurt += dt;
   if (e.jumped) s.sinceJump = 0;
   if (e.airJumped) {
      s.sinceAirJump = 0;
      s.sinceJump = Infinity;
   }
   if (e.landed) {
      s.sinceLand = 0;
      s.landImpact = clamp01((e.landSpeed - 4) / 16);
   }
   if (e.hurt) {
      s.sinceHurt = 0;
      const len = Math.hypot(e.hurtX, e.hurtZ);
      if (len > 1e-6) {
         s.hurtX = e.hurtX / len;
         s.hurtZ = e.hurtZ / len;
      }
   }
   clearHeroEvents(m);
   s.sinceDefeat = m.defeated ? s.sinceDefeat + dt : 0;
   s.sinceCheer = m.celebrating ? s.sinceCheer + dt : 0;
   s.sinceFall = !m.grounded && m.vy <= 0 ? s.sinceFall + dt : 0;
   s.clock += dt;

   s.speed = Math.hypot(m.vx, m.vz);
   const run = m.grounded ? clamp01(s.speed / s.config.topSpeed) : s.runAmount;
   s.runAmount += (run - s.runAmount) * (1 - Math.exp(-12 * dt));
   const rising = clamp01(m.vy / s.config.jumpSpeed);
   s.tuck += (0.3 + 0.7 * (1 - rising) - s.tuck) * (1 - Math.exp(-14 * dt));

   const target = pickHeroState(s, m);
   if (target !== s.state) {
      s.prev = s.state;
      s.state = target;
      s.time = 0;
   } else s.time += dt;

   // every weight moves to the one-hot target at the target's fade speed: the sum stays 1
   const k = 1 - Math.exp(-HERO_FADE[HERO_ANIM_STATES[target]] * dt);
   const w = s.weights;
   let sum = 0;
   for (let i = 0; i < HERO_STATE_COUNT; i++) {
      w[i] += ((i === target ? 1 : 0) - w[i]) * k;
      if (w[i] < 1e-4) w[i] = 0;
      sum += w[i];
   }
   for (let i = 0; i < HERO_STATE_COUNT; i++) w[i] /= sum;
   return s;
}

/** The current state's name. */
export function heroStateName(s: HeroAnimState): HeroAnimStateId {
   return HERO_ANIM_STATES[s.state];
}
