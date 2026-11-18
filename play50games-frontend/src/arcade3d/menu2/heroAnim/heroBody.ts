// The animator's body transform: what the groups around the rigged hero do (the turn to its travel,
// squash and stretch, the double jump's somersault, the knockback's tilt and hop, the ball's roll and
// the shell closing round the curled body). Pure numbers (no three.js) and allocation-free;
// <AnimatedHero> copies them onto its groups.
import { turnTowards } from "@/arcade3d/core/math";
import { airStretch, createSpring, forwardStretch, kickSpring, stepSpring, volumeScale, type Scale3, type Spring } from "@/arcade3d/menu2/juice/squash";
import { HERO_TIMING, HS, type HeroAnimState, type HeroMotion } from "./heroAnimState";

/** One hero's ball and curl, in metres at its drawn size (heroAnimLandmarks.ts heroBallFit). */
export interface HeroBallFit {
   /** the shell's radius (m): the ball rests on the floor, its centre this high */
   radius: number;
   /** the curled body's centre height over the feet point (m), as drawn */
   curlCenterY: number;
   /** the curled body's centre along the facing (m) */
   curlCenterZ: number;
   /** the body's scale inside the shell (the curled body fits within 0.92 of the radius) */
   bodyScale: number;
}

export interface HeroBody {
   /** the facing (rad about y, 0 = +z) */
   yaw: number;
   /** volume-kept squash and stretch (x, y, z in the facing's frame) */
   readonly scale: Scale3;
   /** extra rise of the whole hero (m): a cheer's hops, the knockback's hop */
   hop: number;
   /** the body's shift along its facing (m): the run's planted-foot surge */
   surge: number;
   /** the turn about the pivot's x (rad, + = top forward): the somersault, the ball's roll */
   roll: number;
   /** the knockback's tilt (rad): about x (+ = top forward) and z (+ = top to the hero's right, -x) */
   tiltX: number;
   tiltZ: number;
   /** the pivot of `roll` over the feet point (m) and along the facing */
   pivotY: number;
   pivotZ: number;
   /** 0..1 the ball (eased): the shell's share; `bodyScale` the curled body's scale */
   ball: number;
   bodyScale: number;
   /** the shell's scale (0 hidden .. 1 the full ball) */
   shell: number;
   /** the dash streak's strength 0..1 and the power aura's */
   streak: number;
   aura: number;
   /** the ball's own roll (rad), kept for the spin-down */
   spin: number;
   readonly squash: Spring;
}

export function createHeroBody(yaw = 0): HeroBody {
   return {
      yaw,
      scale: { x: 1, y: 1, z: 1 },
      hop: 0,
      surge: 0,
      roll: 0,
      tiltX: 0,
      tiltZ: 0,
      pivotY: 0,
      pivotZ: 0,
      ball: 0,
      bodyScale: 1,
      shell: 0,
      streak: 0,
      aura: 0,
      spin: 0,
      squash: createSpring(0),
   };
}

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth01 = (v: number) => {
   const t = clamp01(v);
   return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

/** Turns towards the travel above this ground speed (m/s). */
const TURN_FROM = 0.6;
const TURN_RATE = 14;
const STRETCH = { scale: { x: 1, y: 1, z: 1 } as Scale3 };

/**
 * One frame of the body: `s` the stepped state machine, `m` the motion (its events already read),
 * `fit` the hero's ball, `surge` the run's foot shift (m, composeHeroPose x scale), `dt` visual s.
 */
export function stepHeroBody(b: HeroBody, s: HeroAnimState, m: HeroMotion, fit: HeroBallFit, surge: number, dt: number): HeroBody {
   if (!(dt > 0)) return b;
   const w = s.weights;
   const speed = Math.hypot(m.vx, m.vz);
   // the facing: towards the travel (not while hurt, defeated or cheering: those keep their facing)
   if (speed > TURN_FROM && w[HS.hurt] < 0.5 && !m.defeated && !m.celebrating) {
      b.yaw = turnTowards(b.yaw, Math.atan2(m.vx, m.vz), Math.min(1, dt * TURN_RATE));
   }

   // the ball: the shell closes round the curled body as the ball's weight rises
   b.ball = w[HS.ball];
   const k = smooth01(b.ball);
   b.bodyScale = lerp(1, fit.bodyScale, k);
   b.shell = b.ball < 0.03 ? 0 : 0.55 + 0.45 * smooth01((b.ball - 0.03) / 0.6);
   b.pivotY = lerp(fit.curlCenterY, fit.radius, k);
   b.pivotZ = fit.curlCenterZ * (1 - k);
   // the roll: with the travel speed while balled up, then back to upright the short way
   if (m.rolling && b.ball > 0.02) {
      b.spin += (Math.hypot(speed, m.vy) / fit.radius) * dt;
      if (b.spin > TAU * 64) b.spin -= TAU * 64;
   } else if (b.spin !== 0) {
      const home = Math.round(b.spin / TAU) * TAU;
      b.spin += (home - b.spin) * (1 - Math.exp(-10 * dt));
      if (Math.abs(home - b.spin) < 1e-3) b.spin = 0;
   }
   // the somersault: once round over HERO_TIMING.flip
   const flip = s.sinceAirJump < HERO_TIMING.flip ? TAU * easeInOut(s.sinceAirJump / HERO_TIMING.flip) : 0;
   b.roll = flip + b.spin;

   // squash and stretch: stretched in the air by the vertical speed, kicked down by a landing, up by a jump
   if (s.sinceLand === 0) kickSpring(b.squash, -(4 + 8 * s.landImpact));
   if (s.sinceJump === 0 || s.sinceAirJump === 0) kickSpring(b.squash, 3);
   const air = !m.grounded && b.ball < 0.5 ? airStretch(m.vy) - 1 : 0;
   stepSpring(b.squash, air, 6, 0.42, dt);
   const sy = 1 + Math.max(-0.3, Math.min(0.3, b.squash.x)) * (1 - k);
   volumeScale(sy, b.scale);
   // the dash: stretched along the facing
   b.streak = w[HS.dash];
   if (b.streak > 0) {
      forwardStretch(1 + 0.22 * b.streak, STRETCH.scale);
      b.scale.x *= STRETCH.scale.x;
      b.scale.y *= STRETCH.scale.y;
      b.scale.z *= STRETCH.scale.z;
   }

   // the knockback: tipped along the push, a quick hop; the cheer: hops
   const th = s.sinceHurt;
   const knock = th < HERO_TIMING.hurt ? Math.sin(Math.PI * Math.min(1, th / 0.12)) * Math.exp(-th * 5) + 0.35 * Math.exp(-th * 7) : 0;
   const fx = Math.sin(b.yaw);
   const fz = Math.cos(b.yaw);
   // the push in the facing's frame: forward = (sin yaw, cos yaw), the hero's left (+x) = (cos yaw, -sin yaw)
   const forward = s.hurtX * fx + s.hurtZ * fz;
   const left = s.hurtX * fz - s.hurtZ * fx;
   b.tiltX = 0.5 * knock * forward;
   b.tiltZ = -0.5 * knock * left;
   const hurtHop = th < 0.35 ? 0.22 * Math.sin((Math.PI * th) / 0.35) : 0;
   const cheerHop = w[HS.cheer] * 0.3 * Math.abs(Math.sin(s.sinceCheer * 5.5)) * (s.sinceCheer < 3 ? 1 : 0.5);
   b.hop = hurtHop * w[HS.hurt] + cheerHop;

   b.surge = surge;
   // the power aura: up while a lasting power is on (the dash has its streak)
   const auraOn = m.power !== null && m.power !== "dash" && m.power !== "doubleJump" ? 1 : 0;
   b.aura += (auraOn - b.aura) * (1 - Math.exp(-8 * dt));
   return b;
}
