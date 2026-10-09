// Construction worker: crane, pendulum, blueprint and score. Pure. No three, React or DOM.
// Crane and pendulum advance only inside fixedStep (1/120 s).
import { createFixedStep, fixedStep, stepPendulum2D, type FixedStepState, type Pendulum2D } from "@/arcade3d/core/kinematics";
import { rngNext, type RngState } from "@/arcade3d/core/math";

export const CLOCK_S = 240;
export const JIB_Y = 10;
export const CABLE = 5.5;
export const HOOK_BLOCK = 1.2;
export const PIECE_H = 0.7;
export const FLOOR = 0.75;
export const PICK_R = 0.45;
export const PICK_MAX_R = 7.8;
export const BOB_SPEED = 0.15;
export const DWELL_S = 0.25;
export const DROP_R = 8.9;
export const DROP_R_TOWER = 9.02;
export const ANGLE_LIM = 0.6;
export const RADIUS_MIN = 4.5;
export const RADIUS_MAX = 9.6;
export const MAX_OMEGA = 0.9;
export const ANG_ACCEL = 1.8;
export const MAX_VR = 2.5;
export const RAD_ACCEL = 5;
export const ACCEL_CAP = 2;
export const SWING_MAX = 0.35;
export const GRAVITY = 9.81;
export const DAMPING = 0.55;
export const COARSE_DAMPING = 1.4;
export const WIND = 3;
export const LOCK_S = 1;
export const WRONG_S = 1;
export const CHEER_S = 1.2;
export const PERFECT = 0.15;
export const GOOD = 0.35;
export const OK_BAND = 0.6;
export const TOWER_BAND = 0.8;
export const PILE_R = 7;
export const SLOT_R = 9.5;
export const BUILDING_BONUS = 500;
export const TIME_BONUS = 5;

export const PILE_A = [-0.45, -0.15, 0, 0.15, 0.45] as const;
export const SLOT_A = [-0.45, -0.15, 0.15, 0.45] as const;
export const PIECE_NAME = ["Slab", "Pillar", "Wall", "Window", "Roof"] as const;
const POINTS = [100, 60, 30, 0] as const;
const STAB_HIT = [0, -3, -6, -12] as const;
const COUNTS = [
   [2, 2, 2, 1, 1],
   [3, 3, 3, 2, 1],
   [4, 4, 4, 3, 1],
] as const;

const PEND_FINE = { length: CABLE, gravity: GRAVITY, damping: DAMPING };
const PEND_COARSE = { length: CABLE, gravity: GRAVITY, damping: COARSE_DAMPING };

export interface PlanStep {
   kind: number;
   slot: number;
   floor: number;
   building: number;
}

export const PLAN: readonly PlanStep[] = (() => {
   const plan: PlanStep[] = [];
   for (let b = 0; b < COUNTS.length; b++) {
      const kinds: number[] = [];
      for (let k = 0; k < 5; k++) for (let n = 0; n < COUNTS[b][k]; n++) kinds.push(k);
      for (let i = 0; i < kinds.length; i++) {
         plan.push({ kind: kinds[i], slot: i % 4, floor: (i / 4) | 0, building: b });
      }
   }
   return plan;
})();

export interface Placed {
   on: number;
   kind: number;
   slot: number;
   floor: number;
}

export interface Run {
   windowStyle: 0 | 1;
   roofStyle: 0 | 1;
   coarse: boolean;
   angle: number;
   radius: number;
   omega: number;
   vr: number;
   swing: Pendulum2D;
   fixed: FixedStepState;
   carried: number;
   armed: number;
   dwell: number;
   lock: number;
   planIndex: number;
   stability: number;
   score: number;
   gained: number;
   timeLeft: number;
   cheer: number;
   towerTime: number;
   streak: number;
   phase: "play" | "win" | "lose" | "timeup";
   pieces: Placed[];
   hookX: number;
   hookY: number;
   hookZ: number;
   bobVx: number;
   bobVz: number;
   landX: number;
   landZ: number;
   /** 0 slate, 1 mint (inside ok), 2 gold (inside perfect) */
   guide: number;
   flash: number;
   flashSlot: number;
   /** bit field: pickup 1, drop 2, miss 4, wrong 8, collapse 16, cheer 32, win 64 */
   cue: number;
   dropRating: number;
   rawAccel: number;
   cappedAccel: number;
}

export interface CraneInput {
   rot: number;
   radial: number;
   /** pile 0-4 this frame, or -1 */
   pick: number;
   /** Action while empty: the pile under the hook */
   actionPick: boolean;
   drop: boolean;
}

export const CUE_PICKUP = 1;
export const CUE_DROP = 2;
export const CUE_MISS = 4;
export const CUE_WRONG = 8;
export const CUE_COLLAPSE = 16;
export const CUE_CHEER = 32;
export const CUE_WIN = 64;

const scratch = { x: 0, z: 0, raw: 0 };
const tick = { run: null as unknown as Run, rot: 0, radial: 0, gust: 0 };

function onTick(h: number): void {
   integrate(tick.run, tick.rot, tick.radial, tick.gust, h);
}

export function polar(radius: number, angle: number, out: { x: number; z: number }): { x: number; z: number } {
   out.x = radius * Math.sin(angle);
   out.z = radius * Math.cos(angle);
   return out;
}

export function pileAt(index: number, out: { x: number; z: number }): { x: number; z: number } {
   return polar(PILE_R, PILE_A[index] ?? 0, out);
}

export function slotAt(index: number, out: { x: number; z: number }): { x: number; z: number } {
   return polar(SLOT_R, SLOT_A[index] ?? 0, out);
}

/** Energy of both pendulum axes about angle 0 (zero pivot acceleration). */
export function swingEnergy(swing: Pendulum2D): number {
   const k = GRAVITY / CABLE;
   const e = (s: { x: number; v: number }) => 0.5 * s.v * s.v + 0.5 * k * s.x * s.x;
   return e(swing.x) + e(swing.z);
}

export function swingMagnitude(swing: Pendulum2D): number {
   return Math.hypot(swing.x.x, swing.z.x);
}

/** Pivot acceleration in world xz. Centripetal is inward. Wind is added, then the vector is scaled to ACCEL_CAP. */
export function pivotAccel(
   angle: number,
   radius: number,
   omega: number,
   angAcc: number,
   radAcc: number,
   wind: number,
   out: { x: number; z: number; raw: number },
): { x: number; z: number; raw: number } {
   const s = Math.sin(angle);
   const c = Math.cos(angle);
   const w2r = omega * omega * radius;
   let x = radAcc * s + angAcc * radius * c - w2r * s;
   let z = radAcc * c - angAcc * radius * s - w2r * c;
   x += wind;
   const raw = Math.hypot(x, z);
   if (raw > ACCEL_CAP) {
      const scale = ACCEL_CAP / raw;
      x *= scale;
      z *= scale;
   }
   out.x = x;
   out.z = z;
   out.raw = raw;
   return out;
}

/** If the swing magnitude exceeds 0.35, scale both axes down and zero the outward angular speed. */
export function clampSwing(swing: Pendulum2D): void {
   const ax = swing.x.x;
   const az = swing.z.x;
   const mag = Math.hypot(ax, az);
   if (mag <= SWING_MAX) return;
   const scale = SWING_MAX / mag;
   swing.x.x = ax * scale;
   swing.z.x = az * scale;
   const along = (swing.x.v * ax + swing.z.v * az) / (mag * mag);
   if (along > 0) {
      swing.x.v -= along * ax;
      swing.z.v -= along * az;
   }
}

export function rateLanding(dist: number, tower: boolean): number {
   const scale = tower ? TOWER_BAND : 1;
   if (dist < PERFECT * scale) return 0;
   if (dist < GOOD * scale) return 1;
   if (dist < OK_BAND * scale) return 2;
   return 3;
}

export function dropRadius(building: number): number {
   return building === 2 ? DROP_R_TOWER : DROP_R;
}

function approach(value: number, target: number, maxDelta: number): number {
   const d = target - value;
   if (d > maxDelta) return value + maxDelta;
   if (d < -maxDelta) return value - maxDelta;
   return target;
}

function clamp(value: number, lo: number, hi: number): number {
   return value < lo ? lo : value > hi ? hi : value;
}

function writeHook(run: Run): void {
   const mag = swingMagnitude(run.swing);
   const s = Math.sin(run.angle);
   const c = Math.cos(run.angle);
   run.hookX = run.radius * s + CABLE * Math.sin(run.swing.x.x);
   run.hookZ = run.radius * c + CABLE * Math.sin(run.swing.z.x);
   run.hookY = JIB_Y - CABLE * Math.cos(mag);
   const craneVx = run.vr * s + run.radius * c * run.omega;
   const craneVz = run.vr * c - run.radius * s * run.omega;
   run.bobVx = craneVx + CABLE * run.swing.x.v;
   run.bobVz = craneVz + CABLE * run.swing.z.v;
}

export function pileUnder(run: Run): number {
   let best = -1;
   let bestD = PICK_R;
   for (let i = 0; i < PILE_A.length; i++) {
      const px = PILE_R * Math.sin(PILE_A[i]);
      const pz = PILE_R * Math.cos(PILE_A[i]);
      const d = Math.hypot(run.hookX - px, run.hookZ - pz);
      if (d <= bestD) {
         best = i;
         bestD = d;
      }
   }
   return best;
}

function current(run: Run): PlanStep | undefined {
   return PLAN[run.planIndex];
}

function buildingNow(run: Run): number {
   return current(run)?.building ?? 2;
}

function predict(run: Run, step: PlanStep): number {
   const slotTop = step.floor * FLOOR;
   const bottom = run.hookY - PIECE_H;
   const fall = Math.max(0, bottom - slotTop);
   const t = Math.sqrt((2 * fall) / GRAVITY);
   const sx = SLOT_R * Math.sin(SLOT_A[step.slot]);
   const sz = SLOT_R * Math.cos(SLOT_A[step.slot]);
   run.landX = run.hookX + run.bobVx * t;
   run.landZ = run.hookZ + run.bobVz * t;
   return Math.hypot(run.landX - sx, run.landZ - sz);
}

function refreshGuide(run: Run): void {
   const step = current(run);
   if (!step || run.carried < 0) {
      run.guide = 0;
      return;
   }
   const dist = predict(run, step);
   const rating = rateLanding(dist, step.building === 2);
   run.guide = rating === 0 ? 2 : rating < 3 ? 1 : 0;
}

export function createRun(seed: number): Run {
   const rng: RngState = { s: seed >>> 0 };
   const pieces: Placed[] = [];
   for (let i = 0; i < 16; i++) pieces.push({ on: 0, kind: 0, slot: 0, floor: 0 });
   const run: Run = {
      windowStyle: rngNext(rng) < 0.5 ? 0 : 1,
      roofStyle: rngNext(rng) < 0.5 ? 0 : 1,
      coarse: false,
      angle: 0,
      radius: RADIUS_MIN,
      omega: 0,
      vr: 0,
      swing: { x: { x: 0, v: 0 }, z: { x: 0, v: 0 } },
      fixed: createFixedStep(1 / 120),
      carried: -1,
      armed: -1,
      dwell: 0,
      lock: 0,
      planIndex: 0,
      stability: 100,
      score: 0,
      gained: 0,
      timeLeft: CLOCK_S,
      cheer: 0,
      towerTime: -1,
      streak: 0,
      phase: "play",
      pieces,
      hookX: 0,
      hookY: JIB_Y - CABLE,
      hookZ: RADIUS_MIN,
      bobVx: 0,
      bobVz: 0,
      landX: 0,
      landZ: 0,
      guide: 0,
      flash: 0,
      flashSlot: 0,
      cue: 0,
      dropRating: 0,
      rawAccel: 0,
      cappedAccel: 0,
   };
   writeHook(run);
   return run;
}

function integrate(run: Run, rot: number, radial: number, gust: number, dt: number): void {
   const prevW = run.omega;
   const prevVr = run.vr;
   const targetW = clamp(rot, -1, 1) * MAX_OMEGA;
   const targetVr = clamp(radial, -1, 1) * MAX_VR;
   run.omega = approach(run.omega, targetW, ANG_ACCEL * dt);
   run.vr = approach(run.vr, targetVr, RAD_ACCEL * dt);
   const maxA = MAX_OMEGA * dt;
   const maxR = MAX_VR * dt;
   run.angle = clamp(run.angle + clamp(run.omega * dt, -maxA, maxA), -ANGLE_LIM, ANGLE_LIM);
   run.radius = clamp(run.radius + clamp(run.vr * dt, -maxR, maxR), RADIUS_MIN, RADIUS_MAX);
   if (run.angle >= ANGLE_LIM && run.omega > 0) run.omega = 0;
   if (run.angle <= -ANGLE_LIM && run.omega < 0) run.omega = 0;
   if (run.radius >= RADIUS_MAX && run.vr > 0) run.vr = 0;
   if (run.radius <= RADIUS_MIN && run.vr < 0) run.vr = 0;
   const angAcc = (run.omega - prevW) / dt;
   const radAcc = (run.vr - prevVr) / dt;
   const wind = gust ? WIND : 0;
   pivotAccel(run.angle, run.radius, run.omega, angAcc, radAcc, wind, scratch);
   run.rawAccel = Math.max(run.rawAccel, scratch.raw);
   run.cappedAccel = Math.max(run.cappedAccel, Math.hypot(scratch.x, scratch.z));
   stepPendulum2D(run.swing, dt, run.coarse ? PEND_COARSE : PEND_FINE, scratch);
   clampSwing(run.swing);
}

function refuse(run: Run): void {
   run.timeLeft -= WRONG_S;
   run.lock = LOCK_S;
   run.armed = -1;
   run.dwell = 0;
   run.cue |= CUE_WRONG;
   if (run.timeLeft <= 0) {
      run.timeLeft = 0;
      run.phase = "timeup";
   }
}

function requestPick(run: Run, pile: number): void {
   if (pile < 0 || pile > 4) return;
   if (run.carried >= 0 || run.lock > 0) return;
   if (pileUnder(run) !== pile) return;
   const need = current(run)?.kind;
   if (pile !== need) {
      refuse(run);
      return;
   }
   if (run.armed !== pile) {
      run.armed = pile;
      run.dwell = 0;
   }
}

function clearPieces(run: Run): void {
   for (let i = 0; i < run.pieces.length; i++) run.pieces[i].on = 0;
}

function onPlaced(run: Run, step: PlanStep, rating: number): void {
   let slot = -1;
   for (let i = 0; i < run.pieces.length; i++) if (run.pieces[i].on === 0) { slot = i; break; }
   if (slot >= 0) {
      const piece = run.pieces[slot];
      piece.on = 1;
      piece.kind = step.kind;
      piece.slot = step.slot;
      piece.floor = step.floor;
   }
   run.stability += STAB_HIT[rating];
   const points = POINTS[rating];
   run.score += points;
   run.gained += points;
   run.streak = rating === 0 ? run.streak + 1 : 0;
   run.carried = -1;
   run.dropRating = rating;
   run.cue |= CUE_DROP;
   run.planIndex += 1;
   if (run.stability <= 0) {
      run.phase = "lose";
      run.cue |= CUE_COLLAPSE;
      return;
   }
   const next = PLAN[run.planIndex];
   if (next && next.building === step.building) return;
   run.score += BUILDING_BONUS;
   run.gained += BUILDING_BONUS;
   run.cheer = CHEER_S;
   run.cue |= CUE_CHEER;
   if (!next) {
      const bonus = TIME_BONUS * Math.floor(run.timeLeft);
      run.score += bonus;
      run.gained += bonus;
      run.phase = "win";
      run.cue |= CUE_WIN;
   }
}

function tryDrop(run: Run): void {
   if (run.carried < 0 || run.cheer > 0 || run.lock > 0 || run.phase !== "play") return;
   const step = current(run);
   if (!step) return;
   if (run.radius < dropRadius(step.building)) return;
   const dist = predict(run, step);
   const rating = rateLanding(dist, step.building === 2);
   run.dropRating = rating;
   if (rating === 3) {
      run.carried = -1;
      run.streak = 0;
      run.stability += STAB_HIT[3];
      run.flash = 0.35;
      run.flashSlot = step.slot;
      run.cue |= CUE_MISS;
      if (run.stability <= 0) {
         run.phase = "lose";
         run.cue |= CUE_COLLAPSE;
      }
      return;
   }
   onPlaced(run, step, rating);
}

export function stepRun(run: Run, input: CraneInput, dt: number): void {
   if (!(dt > 0) || run.phase !== "play") return;
   run.cue = 0;
   run.gained = 0;
   run.rawAccel = 0;
   run.cappedAccel = 0;
   if (run.flash > 0) run.flash = Math.max(0, run.flash - dt);
   run.timeLeft -= dt;
   if (run.timeLeft <= 0) {
      run.timeLeft = 0;
      run.phase = "timeup";
      return;
   }
   if (run.lock > 0) run.lock = Math.max(0, run.lock - dt);
   const tower = run.cheer <= 0 && buildingNow(run) === 2;
   if (tower) {
      if (run.towerTime < 0) run.towerTime = 0;
      run.towerTime += dt;
   }
   const gust = run.towerTime >= 0 && tower && run.towerTime % 7 < 1;
   tick.run = run;
   tick.rot = input.rot;
   tick.radial = input.radial;
   tick.gust = gust ? 1 : 0;
   fixedStep(run.fixed, dt, onTick);
   writeHook(run);
   if (run.cheer > 0) {
      run.cheer -= dt;
      if (run.cheer <= 0) {
         run.cheer = 0;
         clearPieces(run);
         run.stability = 100;
      }
   }
   if (run.phase !== "play") return;
   if (input.pick >= 0) requestPick(run, input.pick);
   if (input.actionPick) {
      const under = pileUnder(run);
      if (under >= 0) requestPick(run, under);
   }
   if (run.phase !== "play") return;
   let picked = false;
   if (run.armed >= 0 && run.carried < 0 && run.lock <= 0) {
      const held = run.radius <= PICK_MAX_R && pileUnder(run) === run.armed && Math.hypot(run.bobVx, run.bobVz) < BOB_SPEED;
      run.dwell = held ? run.dwell + dt : 0;
      if (run.dwell >= DWELL_S && run.armed === current(run)?.kind) {
         run.carried = run.armed;
         run.armed = -1;
         run.dwell = 0;
         run.cue |= CUE_PICKUP;
         picked = true;
      }
   }
   refreshGuide(run);
   if (!picked && input.drop) tryDrop(run);
}

/** Roof height of the building on screen (m). Tower top is 3. */
export function roofHeight(run: Run): number {
   let top = 0;
   for (let i = 0; i < run.pieces.length; i++) {
      const piece = run.pieces[i];
      if (piece.on) top = Math.max(top, (piece.floor + 1) * FLOOR);
   }
   return top;
}
