// Procedural poses for the quadruped auto-rig (quadruped.ts). Owned by Claude. Pure and
// allocation-free per frame: no three.js, no React.
//
//    const pose = createQuadrupedPose();
//    phase = quadrupedPhaseStep(phase, metres, speed01, LANDMARKS, scale, dt);  // planted paws
//    quadrupedGait(phase, speed01, LANDMARKS, pose, turn);                       // walk -> trot -> gallop
//    quadrupedIdle(t, LANDMARKS, pose) · quadrupedSit(amount, t, LANDMARKS, pose) · quadrupedLeap(f, LANDMARKS, pose)
//    blendQuadrupedPoses(a, b, k, out)
//
// A pose is one Euler rotation (x, y, z, radians, XYZ order) per bone relative to the bind pose
// (the mesh as modelled), plus `lift`: the hips' height change in GLB units. Legs are placed by a
// two-bone IK in the side plane (y, z) of the model: every paw has a target on the ground (the
// model's y = 0 plane; the game moves the model), so a paw in stance stays where it was put while
// the body travels over it by exactly the stride (quadrupedStride).
//
// Gaits by speed01 (0 = stand, 1 = top speed): a 4-beat lateral walk (HL, FL, HR, FR), a trot
// (diagonal pairs) and a transverse gallop (HL, HR, FL, FR with spine flex and a body rock). Their
// timing, duty factor, paw sweep and swing height blend smoothly between the three.
import { QBONE, QUAD_BONE_COUNT, QUAD_LEGS, type QuadrupedLandmarks } from "./quadruped";

export interface QuadrupedPose {
   /** Euler XYZ per bone (QUADRUPED_BONES order), radians, relative to the bind pose */
   rot: Float32Array;
   /** hips height change, GLB units */
   lift: number;
}

export function createQuadrupedPose(): QuadrupedPose {
   return { rot: new Float32Array(QUAD_BONE_COUNT * 3), lift: 0 };
}

export function copyQuadrupedPose(from: QuadrupedPose, out: QuadrupedPose): QuadrupedPose {
   out.rot.set(from.rot);
   out.lift = from.lift;
   return out;
}

/** out = a + (b - a) * k, per angle and lift. */
export function blendQuadrupedPoses(a: QuadrupedPose, b: QuadrupedPose, k: number, out: QuadrupedPose): QuadrupedPose {
   const n = a.rot.length;
   for (let i = 0; i < n; i++) out.rot[i] = a.rot[i] + (b.rot[i] - a.rot[i]) * k;
   out.lift = a.lift + (b.lift - a.lift) * k;
   return out;
}

// ---------- the rig's side-plane geometry (cached per landmarks object) ----------

interface LegGeo {
   front: boolean;
   /** rest top joint (z, y) */
   tz: number;
   ty: number;
   /** rest ankle (z, y) */
   az: number;
   ay: number;
   a: number;
   b: number;
   /** rest polar angles (atan2(y, z)) of the upper and lower bones */
   phiA: number;
   phiB: number;
   /** +1: the middle joint bends forward (+z), -1: backward */
   bend: number;
   /** ankle to toe tip along z: a paw tilted toes-down by t drops its toes toeLen * sin(t) */
   toeLen: number;
   /** z the gait's stance sweep is centred on: halfway from the rest ankle to below the top joint */
   cz: number;
   /** the furthest an ankle is planted from the top joint: the rest distance, or 99.5 % of the leg */
   reach: number;
}

interface Geo {
   hipZ: number;
   hipY: number;
   spineZ: number;
   spineY: number;
   chestZ: number;
   chestY: number;
   legs: LegGeo[];
   /** mean leg length (upper + lower) */
   legLen: number;
   /** per tail bone, the side-plane normal (y, z) of its rest direction: the axis a side-to-side sway turns about */
   sway: Float32Array;
}

const GEO = new WeakMap<QuadrupedLandmarks, Geo>();

function geometry(lm: QuadrupedLandmarks): Geo {
   let g = GEO.get(lm);
   if (g) return g;
   const legs = QUAD_LEGS.map((leg): LegGeo => {
      const m = leg.front ? lm.front : lm.hind;
      const Az = m.knee[2] - m.top[2];
      const Ay = m.knee[1] - m.top[1];
      const Bz = m.ankle[2] - m.knee[2];
      const By = m.ankle[1] - m.knee[1];
      const phiA = Math.atan2(Ay, Az);
      const phiD = Math.atan2(m.ankle[1] - m.top[1], m.ankle[2] - m.top[2]);
      const diff = phiA - phiD;
      return {
         front: leg.front,
         tz: m.top[2],
         ty: m.top[1],
         az: m.ankle[2],
         ay: m.ankle[1],
         a: Math.hypot(Az, Ay),
         b: Math.hypot(Bz, By),
         phiA,
         phiB: Math.atan2(By, Bz),
         toeLen: Math.hypot(m.toeZ - m.ankle[2], m.ankle[1]),
         cz: (m.ankle[2] + m.top[2]) / 2,
         reach: 0,
         bend: m.bend ?? (Math.abs(diff) < 0.02 ? (leg.front ? 1 : -1) : Math.sign(diff)),
      };
   });
   for (const leg of legs) leg.reach = Math.max((leg.a + leg.b) * 0.995, Math.hypot(leg.az - leg.tz, leg.ay - leg.ty) + 1e-4);
   g = {
      hipZ: lm.hind.top[2],
      hipY: lm.hind.top[1],
      chestZ: lm.front.top[2],
      chestY: lm.front.top[1],
      spineZ: (lm.hind.top[2] + lm.front.top[2]) / 2,
      spineY: (lm.hind.top[1] + lm.front.top[1]) / 2,
      legs,
      legLen: legs.reduce((s, l) => s + l.a + l.b, 0) / legs.length,
      sway: new Float32Array(6),
   };
   for (let k = 0; k < 3; k++) {
      const dy = lm.tail[k + 1][1] - lm.tail[k][1];
      const dz = lm.tail[k + 1][2] - lm.tail[k][2];
      const n = Math.hypot(dy, dz) || 1;
      // perpendicular to the bone in the side plane: (y, z) = (dz, -dy) / n; a raised tail sways about z, a level one about y
      g.sway[k * 2] = dz / n;
      g.sway[k * 2 + 1] = -dy / n;
   }
   GEO.set(lm, g);
   return g;
}

/** The mean leg length (upper + lower bone) in GLB units. */
export function quadrupedLegLength(lm: QuadrupedLandmarks): number {
   return geometry(lm).legLen;
}

// rotation of a side-plane vector (z, y) by angle t about +x (three.js): y' = y c - z s, z' = y s + z c
let RZ = 0;
let RY = 0;
function rot(z: number, y: number, t: number): void {
   const c = Math.cos(t);
   const s = Math.sin(t);
   RZ = y * s + z * c;
   RY = y * c - z * s;
}

/** World (model root) top joint of leg l and its parent's total pitch, from the trunk bones of `pose`. */
let TOPZ = 0;
let TOPY = 0;
let TOPP = 0;
function legTop(g: Geo, pose: QuadrupedPose, l: number): void {
   const r = pose.rot;
   const th = r[QBONE.hips * 3];
   const hz = g.hipZ;
   const hy = g.hipY + pose.lift;
   const leg = g.legs[l];
   if (!leg.front) {
      rot(leg.tz - g.hipZ, leg.ty - g.hipY, th);
      TOPZ = hz + RZ;
      TOPY = hy + RY;
      TOPP = th;
      return;
   }
   const ts = th + r[QBONE.spine * 3];
   const tc = ts + r[QBONE.chest * 3];
   rot(g.spineZ - g.hipZ, g.spineY - g.hipY, th);
   let z = hz + RZ;
   let y = hy + RY;
   rot(g.chestZ - g.spineZ, g.chestY - g.spineY, ts);
   z += RZ;
   y += RY;
   rot(leg.tz - g.chestZ, leg.ty - g.chestY, tc);
   TOPZ = z + RZ;
   TOPY = y + RY;
   TOPP = tc;
}

/**
 * Two-bone IK of leg l to an ankle target (vz, vy) relative to its top joint, in the frame of its
 * parent (the parent's pitch removed); `tilt` = the paw's world pitch (+ = toes down), `parent` =
 * the parent's total pitch. Writes the three bones' x angles.
 */
function solveLeg(g: Geo, l: number, vz: number, vy: number, parent: number, tilt: number, out: QuadrupedPose): void {
   const leg = g.legs[l];
   const spec = QUAD_LEGS[l];
   const { a, b } = leg;
   let d = Math.hypot(vz, vy);
   const lo = Math.abs(a - b) + 1e-4;
   const hi = (a + b) * 0.9995;
   if (d < lo) d = lo;
   if (d > hi) d = hi;
   const phiV = Math.atan2(vy, vz);
   const cosG = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
   const phiU = phiV + leg.bend * Math.acos(cosG);
   const thU = leg.phiA - phiU;
   // the knee, then the lower bone towards the (reach-clamped) target
   const kz = a * Math.cos(phiU);
   const ky = a * Math.sin(phiU);
   const s = d / (Math.hypot(vz, vy) || 1);
   const phiL = Math.atan2(vy * s - ky, vz * s - kz);
   const thL = leg.phiB - thU - phiL;
   const r = out.rot;
   r[spec.upper * 3] = thU;
   r[spec.upper * 3 + 1] = 0;
   r[spec.upper * 3 + 2] = 0;
   r[spec.lower * 3] = thL;
   r[spec.lower * 3 + 1] = 0;
   r[spec.lower * 3 + 2] = 0;
   r[spec.paw * 3] = tilt - parent - thU - thL;
   r[spec.paw * 3 + 1] = 0;
   r[spec.paw * 3 + 2] = 0;
}

/** Leg l's ankle to a world (model root) point (z, y), the trunk already posed in `out`. */
function plantLeg(g: Geo, l: number, z: number, y: number, tilt: number, out: QuadrupedPose): void {
   legTop(g, out, l);
   rot(z - TOPZ, y - TOPY, -TOPP);
   solveLeg(g, l, RZ, RY, TOPP, tilt, out);
}

const TZ = new Float32Array(4);
const TY = new Float32Array(4);
const TT = new Float32Array(4);

/** Sets leg l's ankle target (world z, y) and paw tilt for plantAll. */
function target(l: number, z: number, y: number, tilt: number): void {
   TZ[l] = z;
   TY[l] = y;
   TT[l] = tilt;
}

/**
 * Plants all four legs on their targets. A target out of a leg's reach (the trunk's pitch or bob
 * lifted its top joint too far) lowers the whole body just enough first, so no paw ever floats.
 */
function plantAll(g: Geo, out: QuadrupedPose): void {
   for (let pass = 0; pass < 2; pass++) {
      let drop = 0;
      for (let l = 0; l < 4; l++) {
         const leg = g.legs[l];
         legTop(g, out, l);
         const vz = TZ[l] - TOPZ;
         const vy = TY[l] - TOPY;
         const max = leg.reach;
         if (vz * vz + vy * vy <= max * max || Math.abs(vz) >= max) continue;
         drop = Math.max(drop, -vy - Math.sqrt(max * max - vz * vz));
      }
      if (drop <= 0) break;
      out.lift -= drop;
   }
   for (let l = 0; l < 4; l++) plantLeg(g, l, TZ[l], TY[l], TT[l], out);
}

/**
 * The ankles' world (model root) side-plane positions [z, y] per leg (QUAD_LEGS order) for a pose:
 * forward kinematics of the same side-plane rig the IK solves (tests: paws stay planted).
 */
export function quadrupedAnkles(pose: QuadrupedPose, lm: QuadrupedLandmarks, out = new Float32Array(8)): Float32Array {
   const g = geometry(lm);
   for (let l = 0; l < 4; l++) {
      const leg = g.legs[l];
      const spec = QUAD_LEGS[l];
      legTop(g, pose, l);
      const tu = TOPP + pose.rot[spec.upper * 3];
      const tl = tu + pose.rot[spec.lower * 3];
      // rest bone vectors rotated by their total pitch
      rot(leg.a * Math.cos(leg.phiA), leg.a * Math.sin(leg.phiA), tu);
      let z = TOPZ + RZ;
      let y = TOPY + RY;
      rot(leg.b * Math.cos(leg.phiB), leg.b * Math.sin(leg.phiB), tl);
      z += RZ;
      y += RY;
      out[l * 2] = z;
      out[l * 2 + 1] = y;
   }
   return out;
}

// ---------- gaits ----------

const smooth = (a: number, b: number, x: number) => {
   const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
   return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);
const TAU = Math.PI * 2;

/** Leg timing per gait, QUAD_LEGS order (FL, FR, HL, HR): when (cycle fraction) each paw lands. */
const OFFSETS = {
   walk: [0.25, 0.75, 0, 0.5],
   trot: [0.5, 1.0, 0, 0.5],
   gallop: [0.5, 0.6, 0, 0.1],
} as const;
const DUTY = { walk: 0.64, trot: 0.5, gallop: 0.3 };
/** paw sweep in stance, x leg length */
const SWEEP = { walk: 0.5, trot: 0.72, gallop: 1.0 };
/** swing height, x leg length */
const SWING = { walk: 0.14, trot: 0.2, gallop: 0.26 };
/** body bob (down only), x leg length */
const BOB = { walk: 0.02, trot: 0.035, gallop: 0.05 };

export interface QuadrupedGaitMix {
   walk: number;
   trot: number;
   gallop: number;
   duty: number;
   /** paw sweep in stance, GLB units */
   sweep: number;
   offsets: [number, number, number, number];
}

const MIX: QuadrupedGaitMix = { walk: 1, trot: 0, gallop: 0, duty: 0.64, sweep: 0, offsets: [0, 0, 0, 0] };

/**
 * Optional gait tweaks (all default to the plain gait):
 * - `walkOffsets`: the walk's landing times (QUAD_LEGS order FL, FR, HL, HR, cycle fractions);
 *   DIAGONAL_WALK is a diagonal-sequence walk (HL, FR, HR, FL: each diagonal pair lands close
 *   together), written so it blends into the trot without wrapping.
 * - `pawFold`: scales how far a swinging paw folds (tilts toes down); a big flat paw looks better at 0.3-0.5.
 */
export interface QuadrupedGaitOptions {
   walkOffsets?: readonly [number, number, number, number];
   pawFold?: number;
}

/** A diagonal-sequence walk (HL 0, FR 0.25, HR 0.5, FL 0.75), FR written as 1.25 so it blends into the trot's 1.0. */
export const DIAGONAL_WALK = [0.75, 1.25, 0, 0.5] as const;

/** The blend of the three gaits at speed01 (walk to 0.3, trot 0.5-0.7, gallop from 0.9). Returns a shared object. */
export function quadrupedGaitMix(speed01: number, lm: QuadrupedLandmarks, walkOffsets: readonly number[] = OFFSETS.walk): QuadrupedGaitMix {
   const s = Math.min(1, Math.max(0, speed01));
   const toTrot = smooth(0.3, 0.5, s);
   const gallop = smooth(0.7, 0.9, s);
   const walk = 1 - toTrot;
   const trot = toTrot - gallop;
   MIX.walk = walk;
   MIX.trot = trot;
   MIX.gallop = gallop;
   MIX.duty = walk * DUTY.walk + trot * DUTY.trot + gallop * DUTY.gallop;
   // slow steps are short: the cadence stays lively at a stroll
   const amount = 0.35 + 0.65 * smooth(0, 0.25, s);
   MIX.sweep = (walk * SWEEP.walk + trot * SWEEP.trot + gallop * SWEEP.gallop) * amount * geometry(lm).legLen;
   for (let l = 0; l < 4; l++) MIX.offsets[l] = walk * walkOffsets[l] + trot * OFFSETS.trot[l] + gallop * OFFSETS.gallop[l];
   return MIX;
}

/**
 * Distance the body travels in one gait cycle at speed01 (GLB units): sweep / duty. Advance the
 * phase by 2π × distance / (stride × scale) and every paw in stance stays put on the ground.
 */
export function quadrupedStride(speed01: number, lm: QuadrupedLandmarks): number {
   const m = quadrupedGaitMix(speed01, lm);
   return m.sweep / m.duty;
}

/**
 * The next gait phase after moving `metres` in `dt` seconds at speed01, for a model drawn at
 * `scale` (metres per GLB unit). The cadence is capped at maxHz cycles a second (a fast, small
 * animal then slides a little rather than paddling).
 */
export function quadrupedPhaseStep(phase: number, metres: number, speed01: number, lm: QuadrupedLandmarks, scale: number, dt: number, maxHz = 5): number {
   const stride = Math.max(1e-4, quadrupedStride(speed01, lm) * scale);
   const step = Math.min((TAU * metres) / stride, TAU * maxHz * dt);
   const next = phase + step;
   return next > TAU * 64 ? next - TAU * 64 : next;
}

/** The drop of the trunk (GLB units) that lets a stance paw reach `half` ahead and behind its rest point. */
function reachDrop(g: Geo, half: number, reach = 0.97): number {
   let drop = 0;
   for (const leg of g.legs) {
      const dz = Math.abs(leg.cz - leg.tz) + half;
      const dy = leg.ty - leg.ay;
      const max = (leg.a + leg.b) * reach;
      const h = dz < max ? Math.sqrt(max * max - dz * dz) : 0;
      drop = Math.max(drop, dy - h);
   }
   return Math.max(0, drop);
}

function clearRot(out: QuadrupedPose): void {
   out.rot.fill(0);
   out.lift = 0;
}

/**
 * Tail bones: a side-to-side wave down the tail (about each bone's own sway axis, so a raised tail
 * swings and never twists) and a pitch (+ = forward over the back, - = streaming back).
 */
function tail(g: Geo, out: QuadrupedPose, sway: number, wave: number, pitch: number, turn = 0): void {
   for (let k = 0; k < 3; k++) {
      const b = (QBONE.tail1 + k) * 3;
      const a = sway * Math.sin(wave - k * 0.7) * (k === 0 ? 0.6 : 1) - (k === 0 ? 0.3 * turn : 0);
      out.rot[b] = k === 0 ? pitch : pitch * 0.25;
      out.rot[b + 1] = a * g.sway[k * 2];
      out.rot[b + 2] = a * g.sway[k * 2 + 1];
   }
}

/**
 * Walk -> trot -> gallop at speed01 (0..1; below ~0.05 the paws barely move), phase in radians
 * (one cycle = 2π). `turn` (-1..1, + = turning left) turns the head into the turn and the tail
 * out of it.
 */
export function quadrupedGait(phase: number, speed01: number, lm: QuadrupedLandmarks, out: QuadrupedPose, turn = 0, options?: QuadrupedGaitOptions): QuadrupedPose {
   const g = geometry(lm);
   const m = quadrupedGaitMix(speed01, lm, options?.walkOffsets);
   const fold = options?.pawFold ?? 1;
   const { walk, trot, gallop, duty, sweep } = m;
   const L = g.legLen;
   const f = frac(phase / TAU);
   const moving = smooth(0, 0.08, speed01);
   clearRot(out);
   const r = out.rot;

   // trunk: down far enough for the stride, a bob (lowest at mid-stance), the gallop's rock and spine flex
   const bobWT = (walk * BOB.walk + trot * BOB.trot) * L * (0.5 - 0.5 * Math.cos(4 * Math.PI * f));
   const bobG = gallop * BOB.gallop * L * (0.5 + 0.5 * Math.cos(TAU * (f - 0.1)));
   // (the gallop's rock and spine flex lift the shoulders and hips: more slack in the legs)
   out.lift = -(reachDrop(g, sweep / 2, 0.97 - 0.07 * gallop) + (bobWT + bobG) * moving);
   const rock = gallop * 0.08 * Math.sin(TAU * f + 0.6) + trot * 0.012 * Math.sin(4 * Math.PI * f);
   const flex = gallop * 0.12 * Math.sin(TAU * f + 0.3);
   r[QBONE.hips * 3] = rock;
   r[QBONE.spine * 3] = flex;
   r[QBONE.chest * 3] = -flex * 0.6;

   // head: nods with the steps, steadier at a trot, swinging with the gallop; turns into a turn
   const nod = walk * 0.07 * Math.sin(4 * Math.PI * f + 0.8) + trot * 0.03 * Math.sin(4 * Math.PI * f + 0.8) + gallop * 0.14 * Math.sin(TAU * f + 1.6);
   r[QBONE.neck * 3] = nod * moving - rock * 0.7 - gallop * 0.12;
   r[QBONE.head * 3] = -nod * 0.4 * moving + gallop * 0.1;
   r[QBONE.neck * 3 + 1] = 0.3 * turn;
   r[QBONE.head * 3 + 1] = 0.2 * turn;

   // tail: sways with the walk, streams back at speed
   tail(g, out, (walk * 0.28 + trot * 0.22 + gallop * 0.12) * (0.4 + 0.6 * moving), TAU * f, -(trot * 0.25 + gallop * 0.6) * moving, turn);

   // legs: stance sweeps back on the ground, swing arcs forward
   const lift = (walk * SWING.walk + trot * SWING.trot + gallop * SWING.gallop) * L * moving;
   for (let l = 0; l < 4; l++) {
      const leg = g.legs[l];
      const c = frac(f - m.offsets[l]);
      let dz: number;
      let dy = 0;
      let tilt = 0;
      if (c < duty) {
         dz = sweep / 2 - (sweep * c) / duty;
      } else {
         const u = (c - duty) / (1 - duty);
         dz = -sweep / 2 + sweep * (0.5 - 0.5 * Math.cos(Math.PI * u));
         const arc = Math.sin(Math.PI * u);
         tilt = (leg.front ? 0.75 : 0.45) * arc * moving * fold;
         // the toes clear the ground: the ankle rises by the tilted toes' drop on top of the arc
         dy = lift * arc + leg.toeLen * Math.sin(tilt) * 1.1;
      }
      // the stance centre eases from the rest point (standing) to halfway under the top joint (moving)
      target(l, leg.az + (leg.cz - leg.az) * moving + dz, leg.ay + dy, tilt);
   }
   plantAll(g, out);
   return out;
}

/** Standing still: breathing, the head looking about, the tail swaying. t = seconds. */
export function quadrupedIdle(t: number, lm: QuadrupedLandmarks, out: QuadrupedPose): QuadrupedPose {
   const g = geometry(lm);
   clearRot(out);
   const r = out.rot;
   const breath = Math.sin(t * 1.8);
   out.lift = -0.006 * g.legLen * (0.5 + 0.5 * breath);
   r[QBONE.spine * 3] = 0.015 * breath;
   r[QBONE.chest * 3] = -0.01 * breath;
   r[QBONE.neck * 3] = 0.05 * Math.sin(t * 0.5) - 0.02;
   r[QBONE.neck * 3 + 1] = 0.32 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1);
   r[QBONE.head * 3] = 0.06 * Math.sin(t * 0.7 + 2);
   r[QBONE.head * 3 + 2] = 0.08 * Math.sin(t * 0.29);
   tail(g, out, 0.3, t * 1.5, 0);
   for (let l = 0; l < 4; l++) target(l, g.legs[l].az, g.legs[l].ay, 0);
   plantAll(g, out);
   return out;
}

/**
 * Sitting: the rump down, the front legs straight, the hind legs folded, the head level and the
 * tail laid back. amount 0 = standing, 1 = sitting; t (seconds) keeps the head and tail alive.
 */
export function quadrupedSit(amount: number, t: number, lm: QuadrupedLandmarks, out: QuadrupedPose): QuadrupedPose {
   const g = geometry(lm);
   const k = Math.min(1, Math.max(0, amount));
   clearRot(out);
   const r = out.rot;
   // the rump (under the tail's base) comes down to the floor while the shoulders keep their height:
   // drop d at the hips and nose-up pitch p with d = span * sin p and rumpY - d - back * sin p = 0.02
   const span = Math.max(1e-3, g.chestZ - g.hipZ);
   const back = Math.max(0, g.hipZ - lm.tail[0][2]);
   const drop = (k * Math.max(0, lm.bellyY - 0.02)) / (1 + back / span);
   const pitch = -Math.asin(Math.min(0.9, drop / span));
   out.lift = -drop;
   r[QBONE.hips * 3] = pitch;
   r[QBONE.neck * 3] = -pitch * 0.8 + 0.04 * Math.sin(t * 0.6);
   r[QBONE.neck * 3 + 1] = 0.25 * Math.sin(t * 0.4) * k;
   r[QBONE.head * 3] = -pitch * 0.15;
   tail(g, out, 0.25 * k + 0.05, t * 1.2, -1.0 * k);
   for (let l = 0; l < 4; l++) {
      const leg = g.legs[l];
      target(l, leg.az + (leg.front ? 0 : k * 0.12 * g.legLen), leg.ay, 0);
   }
   plantAll(g, out);
   return out;
}

/**
 * A leap or pounce, f = 0 at take-off .. 1 at landing (the game moves the body through the air):
 * nose up and the hind legs pushing back at take-off, everything tucked at the top, the front paws
 * reaching for the ground to land.
 */
export function quadrupedLeap(f: number, lm: QuadrupedLandmarks, out: QuadrupedPose): QuadrupedPose {
   const g = geometry(lm);
   const x = Math.min(1, Math.max(0, f));
   clearRot(out);
   const r = out.rot;
   const L = g.legLen;
   const top = Math.sin(Math.PI * x);
   const pitch = -0.32 + 0.56 * x;
   r[QBONE.hips * 3] = pitch;
   r[QBONE.spine * 3] = -0.1 * top;
   r[QBONE.chest * 3] = 0.05 * top;
   r[QBONE.neck * 3] = -pitch * 0.6;
   r[QBONE.head * 3] = 0.1 * top;
   tail(g, out, 0.1, x * 6, -0.55);
   for (let l = 0; l < 4; l++) {
      const leg = g.legs[l];
      const restZ = leg.az - leg.tz;
      const restY = leg.ay - leg.ty;
      const dz = leg.front ? L * (0.42 * (1 - top) + 0.08) : L * (-0.5 * (1 - x) * (1 - x) + 0.18 * x);
      const dy = leg.front ? L * 0.34 * top : L * (0.32 * top + 0.04);
      legTop(g, out, l);
      solveLeg(g, l, restZ + dz, restY + dy, TOPP, leg.front ? 0.5 * top : 0.6 * (1 - x), out);
   }
   return out;
}

const CROUCH_ANKLES = new Float32Array(8);

/**
 * Crouches a finished pose (a gait, idle): the trunk drops by `drop` (GLB units) with the paws kept
 * on their spots (every leg re-planted on its ankle point and paw tilt), and the neck dips by `dip`
 * rad (+ = head down) so the animal sneaks low. drop 0 leaves the pose as it is.
 */
export function quadrupedCrouch(drop: number, dip: number, lm: QuadrupedLandmarks, out: QuadrupedPose): QuadrupedPose {
   if (drop <= 0 && dip === 0) return out;
   const g = geometry(lm);
   const a = quadrupedAnkles(out, lm, CROUCH_ANKLES);
   const r = out.rot;
   for (let l = 0; l < 4; l++) {
      const spec = QUAD_LEGS[l];
      legTop(g, out, l);
      target(l, a[l * 2], a[l * 2 + 1], r[spec.paw * 3] + TOPP + r[spec.upper * 3] + r[spec.lower * 3]);
   }
   out.lift -= Math.max(0, drop);
   r[QBONE.neck * 3] += dip;
   r[QBONE.head * 3] -= dip * 0.5;
   plantAll(g, out);
   return out;
}

/** Standing square with the paws at rest (the bind pose). */
export function quadrupedStand(lm: QuadrupedLandmarks, out: QuadrupedPose): QuadrupedPose {
   const g = geometry(lm);
   clearRot(out);
   for (let l = 0; l < 4; l++) target(l, g.legs[l].az, g.legs[l].ay, 0);
   plantAll(g, out);
   return out;
}
