// An honest swinging bot. It aims the hook with the stick, reels for the gap in front of it, and
// releases when a plain ballistic arc from the rope would reach the next ring, turret or deck.
// It never writes the hero's position. Preview autoplay and the limits proof both use it.
import { G, PEAK_BONUS, aimedAnchor, anchorPoint, createStepInput, type StepInput, type SwingRun } from "./rules";
import { gustAt } from "./course";

export interface Bot {
   /** which route ring we have already gone past */
   passed: number;
   /** ring just released, so the next press does not grab it again */
   skip: number;
   skipUntil: number;
}

export function createBot(_run: SwingRun): Bot {
   return { passed: -1, skip: -1, skipUntil: 0 };
}

interface Aim {
   /** ring to hook, or -1 when the hero should just travel */
   hook: number;
   x: number;
   y: number;
   z: number;
   r: number;
   /** "air": get within r of the point. "deck": land on it. */
   kind: "air" | "deck";
}

const P = { x: 0, y: 0, z: 0 };
const V = { x: 0, y: 0, z: 0 };

function pointReach(x: number, y: number, z: number, vx: number, vy: number, vz: number, goal: Aim, wind: number): boolean {
   let px = x;
   let py = y;
   let pz = z;
   let vy2 = vy;
   let vx2 = vx;
   const r2 = goal.r * goal.r;
   for (let n = 0; n < 140; n++) {
      vx2 += wind * 0.016;
      vy2 -= G * 0.016;
      px += vx2 * 0.016;
      py += vy2 * 0.016;
      pz += vz * 0.016;
      const dx = px - goal.x;
      const dy = py - goal.y;
      const dz = pz - goal.z;
      if (goal.kind === "air") {
         if (dx * dx + dy * dy + dz * dz <= r2) return true;
      } else if (vy2 <= 0 && py <= goal.y + 0.25 && py >= goal.y - 0.9 && dx * dx + dz * dz <= r2) return true;
      if (py < -10) return false;
   }
   return false;
}

function aimOf(run: SwingRun, bot: Bot): Aim {
   const course = run.course;
   const h = run.hero;
   const finish = course.islands[course.finish];
   const deck: Aim = { hook: -1, x: finish.x, y: finish.y, z: finish.z, r: finish.r, kind: "deck" };
   if (run.boss && run.boss.phase > 0) {
      const phase = run.boss.phase;
      if (phase === 1 && course.mast) {
         const drone = course.anchors.findIndex((a) => a.kind === "drone");
         return { hook: drone, x: course.mast.x, y: course.mast.y, z: course.mast.z, r: course.mast.r, kind: "air" };
      } else if (course.bell) {
         // the next falling ring still ahead, else the bell
         for (let k = 0; k < course.anchors.length; k++) {
            if (course.anchors[k].kind !== "fall") continue;
            anchorPoint(run, k, run.simMs, P);
            if (P.x > h.x + 1) return { hook: k, x: P.x, y: P.y, z: P.z, r: 11, kind: "air" };
         }
         return { hook: -1, x: course.bell.x, y: course.bell.y, z: course.bell.z, r: course.bell.r + 0.6, kind: "air" };
      }
   }
   const route = course.route;
   let next = -1;
   for (let k = 0; k < route.length; k++) {
      const index = route[k];
      if (k <= bot.passed) continue;
      if (course.anchors[index].kind === "blade") {
         anchorPoint(run, index, run.simMs, P);
         if (P.y < 8) {
            next = index;
            break;
         }
      }
      next = index;
      break;
   }
   if (next === bot.skip && run.simMs < bot.skipUntil) {
      const held = next;
      anchorPoint(run, held, run.simMs, P);
      const islands = course.islands;
      let deckI = -1;
      for (let i = 0; i < islands.length; i++) {
         const s = islands[i];
         if (s.kind === "net" || !s.cp || s.x < P.x + 1) continue;
         if (deckI < 0 || s.x < islands[deckI].x) deckI = i;
      }
      if (deckI >= 0) {
         const s = islands[deckI];
         return { hook: -1, x: s.x, y: s.y, z: s.z, r: s.r, kind: "deck" };
      }
   }
   if (h.mode === "swing" && h.anchor >= 0) {
      const pos = route.indexOf(h.anchor);
      const after = pos >= 0 ? route[pos + 1] : next;
      anchorPoint(run, h.anchor, run.simMs, P);
      if (after !== undefined && after >= 0 && after !== h.anchor) {
         const ax = P.x;
         const az = P.z;
         anchorPoint(run, after, run.simMs, P);
         const gap = Math.hypot(P.x - ax, P.z - az);
         // the turret run: land first and wait for the turret's open window
         const turretRun = !!run.boss && run.boss.phase === 0 && course.anchors[after].cut;
         if (gap <= 16 && !turretRun) return { hook: after, x: P.x, y: P.y, z: P.z, r: 11, kind: "air" };
         const islands = course.islands;
         let deckI = -1;
         for (let i = 0; i < islands.length; i++) {
            const s = islands[i];
            if (!s.cp || s.x <= ax + 1 || s.x >= P.x) continue;
            if (deckI < 0 || s.x < islands[deckI].x) deckI = i;
         }
         if (deckI >= 0) {
            const s = islands[deckI];
            return { hook: after, x: s.x, y: s.y, z: s.z, r: s.r, kind: "deck" };
         }
      }
      return deck;
   }
   if (next >= 0) {
      anchorPoint(run, next, run.simMs, P);
      if (h.mode === "air" && run.boss && run.boss.phase === 0 && course.anchors[next].cut) {
         // the turret run: come down on the deck before the hull ring, then wait for the window
         let deckI = -1;
         for (let i = 0; i < course.islands.length; i++) {
            const s = course.islands[i];
            if (!s.cp || s.x > P.x || s.x < h.x - 8) continue;
            if (deckI < 0 || s.x > course.islands[deckI].x) deckI = i;
         }
         if (deckI >= 0) {
            const s = course.islands[deckI];
            return { hook: -1, x: s.x, y: s.y, z: s.z, r: s.r, kind: "deck" };
         }
      }
      return { hook: next, x: P.x, y: P.y, z: P.z, r: 11, kind: "air" };
   }
   return deck;
}

function wallAhead(run: SwingRun, gx: number): boolean {
   const h = run.hero;
   const blocks = run.course.blocks;
   for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind !== "wall") continue;
      if (b.x0 < h.x + 1 || b.x0 > gx) continue;
      if (h.z < b.z0 - 1 || h.z > b.z1 + 1) continue;
      if (b.y1 > h.y + 0.4) return true;
   }
   return false;
}

function wantLength(run: SwingRun, aim: Aim): number {
   anchorPoint(run, run.hero.anchor, run.simMs, P);
   if (wallAhead(run, aim.x)) return 4.4;
   // a deck right under the swing: reel down onto it
   if (aim.kind === "deck" && Math.hypot(aim.x - P.x, aim.z - P.z) < aim.r + 2.5) return Math.min(11.8, P.y - aim.y + 0.05);
   const dx = Math.hypot(aim.x - P.x, aim.z - P.z);
   if (dx > 18) return 9.5;
   if (dx > 14) return 8;
   return 6.4;
}

/** On the galleon's turret run the bot waits on a deck for the turret's open window. Never in the air. */
function bossReady(run: SwingRun, hook = -1): boolean {
   if (!run.boss) return true;
   if (run.hero.mode === "air") return true;
   if (run.boss.phase === 0 && hook >= 0 && !run.course.anchors[hook].cut) return true;
   return run.boss.step === "vulnerable";
}

export function botInput(bot: Bot, run: SwingRun, input: StepInput): void {
   input.moveX = 0;
   input.moveZ = 0;
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   if (run.ended || run.hero.mode === "lost" || run.hero.mode === "spawn") return;
   const h = run.hero;
   if (h.mode === "ground") {
      const deck = run.course.islands[h.support];
      if (deck.cp) {
         const route = run.course.route;
         let behind = -1;
         for (let k = 0; k < route.length; k++) {
            anchorPoint(run, route[k], run.simMs, P);
            if (P.x < deck.x - 1) behind = k;
            else break;
         }
         bot.passed = behind;
      }
   }
   const aim = aimOf(run, bot);
   if (h.mode === "swing" && h.anchor >= 0) {
      anchorPoint(run, h.anchor, run.simMs, P);
      const awayX = P.x - aim.x;
      const awayZ = P.z - aim.z;
      const want = Math.atan2(awayX, awayZ);
      let d = want - h.phi;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      input.moveX = Math.max(-1, Math.min(1, d * 2.2));
      const wantL = wantLength(run, aim);
      input.moveZ = h.L > wantL + 0.35 ? -1 : h.L < wantL - 0.35 ? 1 : 0;
      // a weak swing: pump it (reel in through the bottom, out at the ends), like a player would
      if (Math.abs(h.omega) * h.L < 7 && run.simMs - h.hookAt > 900 && !h.peak) input.moveZ = Math.abs(h.theta) < 0.3 ? -1 : 1;
      if (!bossReady(run) && run.boss && run.boss.phase < 2 && (run.boss.phase > 0 || run.course.anchors[h.anchor].cut)) return;
      // stalled on one ring: let go at the next forward climb (any deck beats a stall)
      const stalled = run.simMs - h.hookAt > 4500 && h.peak && h.vx > 2;
      const k = h.peak ? PEAK_BONUS : 1;
      V.x = h.vx * k;
      V.y = h.vy * k;
      V.z = h.vz * k;
      const wind = gustAt(run.course, run.simMs);
      const toward = V.x * (aim.x - h.x) + V.z * (aim.z - h.z) > 0.5;
      const go = (h.peak && toward && pointReach(h.x, h.y, h.z, V.x, V.y, V.z, aim, wind)) || stalled;
      if (go) {
         input.actionPressed = true;
         bot.skip = h.anchor;
         bot.skipUntil = run.simMs + 900;
         const pos = run.course.route.indexOf(h.anchor);
         if (pos > bot.passed) bot.passed = pos;
      }
      return;
   }
   // on a ring we've swung past — passed advances on the release, and a checkpoint puts it back
   if (aim.hook < 0) {
      if (h.mode === "air" && Math.hypot(h.vx, h.vz) > 12) return;
      steer(input, aim.x - h.x, aim.z - h.z);
      if (h.mode === "ground" && Math.hypot(aim.x - h.x, aim.z - h.z) < aim.r - 0.4) return;
      return;
   }
   if (run.boss && !bossReady(run, aim.hook)) {
      anchorPoint(run, aim.hook, run.simMs, P);
      if (h.mode === "ground") {
         const deck = run.course.islands[h.support];
         const stand = Math.min(P.x - 8, deck.x + deck.r - 1.3);
         const parked = Math.max(stand, deck.x - deck.r + 1.3);
         steer(input, parked - h.x, deck.z - h.z);
      }
      return;
   }
   anchorPoint(run, aim.hook, run.simMs, P);
   const dx = P.x - h.x;
   const dy = P.y - h.y;
   const dz = P.z - h.z;
   const dist = Math.hypot(dx, dy, dz);
   const horiz = Math.hypot(dx, dz);
   if (h.mode === "ground" && horiz < dist * 0.42) {
      steer(input, P.x - 7 - h.x, P.z - h.z);
      return;
   }
   const bladeLow = aim.hook >= 0 && run.course.anchors[aim.hook].kind === "blade" && P.y < 8;
   const flat = dy < 2.2 && horiz > Math.max(2.5, dy * 1.1);
   steer(input, dx, dz);
   if (flat) return;
   if (!bladeLow && dist < 13.2 && aimedAnchor(run, input) === aim.hook) input.actionPressed = true;
   else if (h.mode === "ground" && dist >= 13.2) {
      const standX = P.x - 8;
      steer(input, standX - h.x, P.z - h.z);
   } else if (!bladeLow && dist < 13.2 && (h.mode === "ground" || aimedAnchor(run, input) === aim.hook)) input.actionPressed = true;
}

function steer(input: StepInput, dx: number, dz: number): void {
   const d = Math.hypot(dx, dz);
   if (d < 0.35) return;
   const k = Math.min(1, 1.4 / d);
   input.moveX = dx * (d > 1 ? 1 / d : k);
   input.moveZ = dz * (d > 1 ? 1 / d : k);
}
