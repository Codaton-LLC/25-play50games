// What the bay shows between rule events (looks only, never read by rules.ts): parts flying to the
// cradle or the bin, the claw's dip and carry, the sweeper's swing, status flashes, the cradle's
// build-up. Pure and allocation-free after createLook(); Scene.tsx feeds it events and advances it.
import { BELT, CRADLE, KIND, SCRAP_BIN, SHAPE_OF, type RunEvent } from "./rules";

export const CLAW_REST = { x: 0, y: 1.42, z: BELT.Z } as const;
/** The claw head's underside sits this far above what it holds. */
export const CLAW_GRIP = 0.5;
/** s: the claw dips to the part, carries it to the cradle, comes back. */
export const CLAW_TIMES = { dip: 0.08, carry: 0.3, back: 0.6 } as const;
export const BIN_FLIGHT = 0.36;
/** The cradle's turntable top (parts are built on it). */
export const CRADLE_TOP = 0.22;

export interface Flyer {
   on: boolean;
   shape: number;
   colour: number;
   faulty: boolean;
   toCradle: boolean;
   kind: number;
   slot: number;
   /** the cradle build it belongs to (a finished robot's last part lands on nothing) */
   build: number;
   t: number;
   from: { x: number; y: number; z: number };
   to: { x: number; y: number; z: number };
}

export interface Look {
   flyers: Flyer[];
   claw: { mode: "idle" | "install" | "wrong" | "strike"; t: number; part: { x: number; y: number; z: number }; drop: { x: number; y: number; z: number } };
   sweep: number;
   good: number;
   bad: number;
   /** blueprint slots standing on the cradle, and the shapes / colours there */
   landed: number;
   build: number;
   cradleShape: Int8Array;
   cradleColour: Int8Array;
   cradleKind: Int8Array;
   /** a part just landed on the cradle at this slot (Scene bursts sparks), -1 = none */
   landedNow: number;
   /** a part just fell into the bin (Scene puffs), false = none */
   binnedNow: boolean;
}

const v3 = () => ({ x: 0, y: 0, z: 0 });
const flyer = (): Flyer => ({ on: false, shape: 0, colour: 0, faulty: false, toCradle: false, kind: 0, slot: 0, build: 0, t: 0, from: v3(), to: v3() });

export function createLook(): Look {
   return {
      flyers: Array.from({ length: 6 }, flyer),
      claw: { mode: "idle", t: 9, part: v3(), drop: v3() },
      sweep: 9,
      good: 9,
      bad: 9,
      landed: 0,
      build: 0,
      cradleShape: new Int8Array(5),
      cradleColour: new Int8Array(5),
      cradleKind: new Int8Array(5),
      landedNow: -1,
      binnedNow: false,
   };
}

/** Where blueprint slot `slot` (of kind `kind`) stands on the cradle: its feet, and its scale. */
export function cradleSlot(kind: number, slot: number, torsoShape: number, out: { x: number; y: number; z: number; s: number }): void {
   const torsoH = torsoShape === SHAPE_OF[KIND.torso][1] ? 0.34 : 0.46;
   out.x = CRADLE.x;
   out.z = CRADLE.z;
   out.s = 1;
   if (kind === KIND.torso) out.y = CRADLE_TOP;
   else if (kind === KIND.cell) {
      out.y = CRADLE_TOP + 0.06;
      out.z = CRADLE.z + 0.26;
      out.s = 0.6;
   } else if (kind === KIND.head) out.y = CRADLE_TOP + torsoH;
   else {
      out.y = CRADLE_TOP + torsoH * 0.35;
      out.x = CRADLE.x + (slot === 3 ? 0.32 : -0.32);
      out.s = 0.85;
   }
}

const slot = { x: 0, y: 0, z: 0, s: 1 };

function launch(look: Look, e: RunEvent, toCradle: boolean): Flyer | null {
   const f = look.flyers.find((q) => !q.on) ?? null;
   if (!f) return null;
   f.on = true;
   f.shape = e.shape;
   f.colour = e.colour;
   f.faulty = e.faulty;
   f.toCradle = toCradle;
   f.t = 0;
   f.from.x = e.x;
   f.from.y = e.y + 0.02;
   f.from.z = e.z;
   if (!toCradle) {
      f.to.x = SCRAP_BIN.x + (e.x - SCRAP_BIN.x) * 0.15;
      f.to.y = SCRAP_BIN.y;
      f.to.z = SCRAP_BIN.z;
   }
   return f;
}

/** One rule event into the looks. `kind` is the installed part's kind (the blueprint step). */
export function noteEvent(look: Look, e: RunEvent, kind: number): void {
   const claw = look.claw;
   if (e.kind === "install") {
      const f = launch(look, e, true);
      const torso = e.slot === 0 ? e.shape : look.cradleShape[0];
      cradleSlot(kind, e.slot, torso, slot);
      if (f) {
         f.kind = kind;
         f.slot = e.slot;
         f.build = look.build;
         f.to.x = slot.x;
         f.to.y = slot.y;
         f.to.z = slot.z;
      }
      if (e.slot === 0) look.landed = 0;
      look.cradleShape[e.slot] = e.shape;
      look.cradleColour[e.slot] = e.colour;
      look.cradleKind[e.slot] = kind;
      claw.mode = "install";
      claw.t = 0;
      claw.part.x = e.x;
      claw.part.y = e.y;
      claw.part.z = e.z;
      claw.drop.x = slot.x;
      claw.drop.y = slot.y;
      claw.drop.z = slot.z;
      look.good = 0;
   } else if (e.kind === "robot") {
      look.landed = 0;
      look.build++;
   } else if (e.kind === "wrong" || e.kind === "strike") {
      claw.mode = e.kind;
      claw.t = 0;
      claw.part.x = e.x;
      claw.part.y = e.y;
      claw.part.z = e.z;
      look.bad = 0;
      if (e.kind === "wrong") look.landed = 0;
      if (e.kind === "strike") launch(look, e, false);
   } else if (e.kind === "scrapFault" || e.kind === "scrapClean") {
      launch(look, e, false);
      look.sweep = 0;
      if (e.kind === "scrapClean") look.bad = 0;
   } else if (e.kind === "zap") {
      look.bad = 0;
   }
}

/** Advances every look by dt (s): flyers land, the claw comes back, flashes fade. */
export function stepLook(look: Look, dt: number): void {
   look.landedNow = -1;
   look.binnedNow = false;
   look.claw.t += dt;
   look.sweep += dt;
   look.good += dt;
   look.bad += dt;
   if (look.claw.t > CLAW_TIMES.back) look.claw.mode = "idle";
   for (const f of look.flyers) {
      if (!f.on) continue;
      f.t += dt;
      const end = f.toCradle ? CLAW_TIMES.carry : BIN_FLIGHT;
      if (f.t >= end) {
         f.on = false;
         if (f.toCradle && f.build === look.build) {
            look.landed = Math.max(look.landed, f.slot + 1);
            look.landedNow = f.slot;
         } else if (!f.toCradle) look.binnedNow = true;
      }
   }
}

const ease = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

/** The claw head's position (the point under its fingers). */
export function clawAt(look: Look, now: number, out: { x: number; y: number; z: number }): void {
   const c = look.claw;
   const restY = CLAW_REST.y + 0.03 * Math.sin(now * 2.2);
   const t = c.t;
   const px = c.part.x;
   const py = c.part.y + CLAW_GRIP;
   const pz = c.part.z;
   if (c.mode === "idle") {
      out.x = CLAW_REST.x;
      out.y = restY;
      out.z = CLAW_REST.z;
      return;
   }
   if (t < CLAW_TIMES.dip) {
      const k = ease(t / CLAW_TIMES.dip);
      out.x = CLAW_REST.x + (px - CLAW_REST.x) * k;
      out.y = restY + (py - restY) * k;
      out.z = CLAW_REST.z + (pz - CLAW_REST.z) * k;
      return;
   }
   if (c.mode === "install" && t < CLAW_TIMES.carry) {
      const k = ease((t - CLAW_TIMES.dip) / (CLAW_TIMES.carry - CLAW_TIMES.dip));
      const dy = c.drop.y + CLAW_GRIP;
      out.x = px + (c.drop.x - px) * k;
      out.y = py + (dy - py) * k + 0.35 * Math.sin(k * Math.PI);
      out.z = pz + (c.drop.z - pz) * k;
      return;
   }
   const from = c.mode === "install" ? CLAW_TIMES.carry : CLAW_TIMES.dip;
   const k = ease(clamp01((t - from) / (CLAW_TIMES.back - from)));
   const sx = c.mode === "install" ? c.drop.x : px;
   const sy = c.mode === "install" ? c.drop.y + CLAW_GRIP : py;
   const sz = c.mode === "install" ? c.drop.z : pz;
   // a wrong grab or a strike recoils with a rattle
   const rattle = c.mode === "install" ? 0 : 0.04 * Math.sin(t * 60) * (1 - k);
   out.x = sx + (CLAW_REST.x - sx) * k + rattle;
   out.y = sy + (restY - sy) * k;
   out.z = sz + (CLAW_REST.z - sz) * k;
}

/** A flyer's feet now, and its tumble angle. */
export function flyerAt(look: Look, f: Flyer, now: number, out: { x: number; y: number; z: number; spin: number }): void {
   if (f.toCradle) {
      if (f.t < CLAW_TIMES.dip) {
         out.x = f.from.x;
         out.y = f.from.y;
         out.z = f.from.z;
      } else {
         clawAt(look, now, out);
         out.y -= CLAW_GRIP - 0.02;
      }
      out.spin = 0;
      return;
   }
   const k = clamp01(f.t / BIN_FLIGHT);
   out.x = f.from.x + (f.to.x - f.from.x) * k;
   out.z = f.from.z + (f.to.z - f.from.z) * k;
   out.y = f.from.y + (f.to.y - f.from.y) * k + 0.5 * Math.sin(k * Math.PI);
   out.spin = k * 7;
}
