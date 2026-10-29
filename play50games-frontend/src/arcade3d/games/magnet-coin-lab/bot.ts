// The honest bot: inputs only (it never writes the world), for the proofs through the real store and
// the preview-only ?autoplay=1. Each room has a short plan of steps (walk, gather, flip, ride a pad,
// launch, push a block, bank, leave); the steps read the world and press the same buttons a player does.
import { HERO, idleInput, type Hero, type StepInput, type World } from "./rules";

type Ctx = { w: World; h: Hero; out: StepInput; m: Mem };
/** A step returns true once it is done (the next step starts on the next frame). */
type Step = (c: Ctx) => boolean;

interface Mem {
   room: number;
   step: number;
   t0: number;
   tapped: number;
   holdMs: number;
   lastX: number;
   stuckMs: number;
}
const memory = new WeakMap<Hero, Mem>();
const mem = (h: Hero): Mem => {
   let m = memory.get(h);
   if (!m) memory.set(h, (m = { room: -1, step: 0, t0: 0, tapped: 0, holdMs: 0, lastX: 0, stuckMs: 0 }));
   return m;
};

const roomOf = (c: Ctx) => c.w.rooms[c.h.room];
const since = (c: Ctx) => c.w.ms - c.m.t0;

// ---------- steps ----------

/** Walk to x (hopping a step that blocks the way); done when there and standing. */
const go =
   (x: number | ((c: Ctx) => number), tol = 0.3): Step =>
   (c) => {
      const tx = typeof x === "number" ? x : x(c);
      const dx = tx - c.h.x;
      if (Math.abs(dx) < tol) return c.h.grounded || c.h.latched >= 0;
      c.out.x = Math.sign(dx);
      // blocked against a low step: hop it
      if (c.h.grounded && Math.abs(c.h.vx) < 0.4 && Math.abs(c.h.x - c.m.lastX) < 0.01) {
         c.m.stuckMs += 1000 / 60;
         if (c.m.stuckMs > 120) {
            c.out.jump = true;
            c.m.stuckMs = 0;
         }
      } else c.m.stuckMs = 0;
      return false;
   };

/** Stand at the pile until the swarm holds `n` coins (or `ms` passed). */
const gather =
   (n: number, ms = 1600): Step =>
   (c) =>
      c.h.swarm >= n || since(c) > ms;

/** Make sure of the sign: a short Action tap (the flip fires on release). */
const sign =
   (s: 1 | -1): Step =>
   (c) => {
      if (c.h.sign === s && !c.h.wasHeld) return true;
      if (c.h.sign !== s && !c.h.wasHeld) c.out.action = true;
      return false;
   };

/** Hold the hero power (Action held past HOLD_MS). */
const power: Step = (c) => {
   if (since(c) < 520) {
      c.out.action = true;
      return false;
   }
   return !c.h.wasHeld;
};

const wait =
   (cond: (c: Ctx) => boolean, ms = 4000): Step =>
   (c) =>
      cond(c) || since(c) > ms;

/** Hold a direction until a condition (in the air, a pull, a launch). */
const hold =
   (dir: number, until: (c: Ctx) => boolean, ms = 4000): Step =>
   (c) => {
      c.out.x = dir;
      return until(c) || since(c) > ms;
   };

const jump =
   (dir = 0): Step =>
   (c) => {
      c.out.jump = true;
      c.out.x = dir;
      return true;
   };

/** Walk over the bank and wait for the quota (walking to and fro by it so the swarm sweeps through). */
const bank: Step = (c) => {
   const r = roomOf(c);
   if (r.doorOpen) return true;
   const b = r.def.bank;
   // short of the quota: sweep up loose coins on this floor first
   if (r.banked + c.h.swarm < r.def.need) {
      let best: { x: number } | null = null;
      for (const k of r.coins) {
         if (k.state !== "free" || Math.abs(k.y - c.h.y) > 1.5) continue;
         if (!best || Math.abs(k.x - c.h.x) < Math.abs(best.x - c.h.x)) best = k;
      }
      if (best) {
         if (c.h.sign !== 1 && !c.h.wasHeld) c.out.action = true;
         go(best.x, 0.2)(c);
         return since(c) > 20000;
      }
   }
   const phase = Math.floor(since(c) / 900) % 2;
   const tx = b.x + (phase ? 1.3 : -0.6);
   if (Math.abs(tx - c.h.x) > 0.25) c.out.x = Math.sign(tx - c.h.x);
   return since(c) > 20000;
};

const door: Step = (c) => go(roomOf(c).def.door.x + 0.4, 0.2)(c);

/** Walk onto a floor pad until it launches. */
const launchFrom =
   (x: number): Step =>
   (c) => {
      if (c.h.ev.launch || c.h.vy > 10 || c.h.latched >= 0) return true;
      c.out.x = Math.abs(x - c.h.x) > 0.15 ? Math.sign(x - c.h.x) : 0;
      return false;
   };

const goPile = (k = 0): Step => (c) => go(roomOf(c).def.piles[k].x)(c);
const ground: Step = (c) => c.h.grounded;
const aboveY = (y: number) => (c: Ctx) => c.h.y > y;
const latched = (c: Ctx) => c.h.latched >= 0;
/** In the air: steer over block k and land on it. */
const toBlock =
   (k: number): Step =>
   (c) => {
      const b = roomOf(c).blocks[k];
      const dx = b.x - c.h.x;
      c.out.x = Math.abs(dx) > 0.2 ? Math.sign(dx) : 0;
      return (c.h.grounded && c.h.y > b.y + 0.9) || since(c) > 2500;
   };
/** Wait until the whole swarm is past x (so a flip does not shut a gate on it). */
const swarmPast =
   (x: number): Step =>
   (c) => {
      for (const k of roomOf(c).coins) if (k.state === "swarm" && k.owner === c.h.index && k.x < x) return since(c) > 2500;
      return true;
   };

// ---------- plans per level and room ----------

const PLANS: Record<number, Step[][]> = {
   1: [
      [goPile(), gather(6), bank, door],
      [goPile(), gather(6), sign(-1), hold(1, latched, 3500), sign(1), wait((c) => c.h.grounded), bank, door],
      [goPile(), gather(6), sign(1), launchFrom(10.5), hold(1, (c) => c.h.grounded && c.h.y > 5), bank, door],
      [goPile(), gather(6), sign(-1), hold(1, latched, 3500), sign(1), wait(ground), launchFrom(13.5), hold(1, (c) => c.h.grounded && c.h.y > 5), bank, door],
      [goPile(), gather(10), go(9.2, 0.15), jump(1), hold(1, (c) => c.h.grounded && c.h.x > 12.3, 2000), bank, door],
   ],
   2: [
      [goPile(), gather(6), sign(1), go(10.3), swarmPast(9.3), sign(-1), hold(1, latched, 3500), sign(1), wait(ground), bank, door],
      [goPile(), gather(10), sign(1), go(13.5), swarmPast(12.3), sign(-1), go(19.5), swarmPast(18.3), bank, door],
      [goPile(), gather(6), sign(-1), launchFrom(10.5), hold(1, (c) => c.h.grounded && c.h.y > 5), bank, door],
      [goPile(), gather(6), go(9.4, 0.15), jump(1), hold(1, (c) => c.h.grounded && c.h.x > 14.2, 2500), bank, door],
      [goPile(), gather(10), sign(-1), hold(1, latched, 4000), sign(1), wait(ground), go(18.6), swarmPast(18.2), bank, door],
   ],
   3: [
      [goPile(), gather(6), sign(1), go(4.6), wait((c) => roomOf(c).blocks[0].x > 9.2, 3500), sign(-1), go(5.4, 0.15), jump(1), toBlock(0), jump(1), hold(1, (c) => c.h.grounded && c.h.x > 13.6, 2500), sign(1), bank, door],
      [goPile(), gather(6), sign(1), go(9.4), wait((c) => roomOf(c).blocks[0].x > 12.3, 3000), go(10.9), jump(1), hold(1, (c) => c.h.y > 1.5 && c.h.grounded, 1500), jump(1), hold(1, (c) => c.h.grounded && c.h.y > 3.5, 2500), bank, door],
      [goPile(), gather(6), sign(1), go(6.0), go(16.5), wait((c) => roomOf(c).ventOpen, 3000), bank, door],
      [goPile(), gather(10), sign(-1), wait((c) => Math.abs(roomOf(c).blocks[0].x - c.h.x) < 1.0, 3000), jump(1), toBlock(0), hold(1, (c) => c.h.grounded && c.h.x > 16.8, 4000), sign(1), bank, door],
      [goPile(), gather(10), sign(-1), wait((c) => Math.abs(roomOf(c).blocks[0].x - c.h.x) < 1.0, 3000), jump(1), toBlock(0), hold(1, (c) => roomOf(c).ventOpen, 5000), sign(1), bank, door],
   ],
   4: [
      [goPile(), gather(10), sign(1), bank, door],
      [goPile(), gather(10), sign(-1), hold(1, latched, 3500), sign(1), wait(ground), bank, door],
      [goPile(), gather(10), sign(1), launchFrom(10.5), hold(1, (c) => c.h.grounded && c.h.y > 5), bank, door],
      [goPile(), gather(10), sign(1), launchFrom(10.5), hold(1, (c) => c.h.grounded && c.h.y > 5), bank, door],
      [goPile(1), gather(10), sign(-1), hold(1, latched, 3500), sign(1), wait(ground), bank, door],
   ],
   5: [
      [goPile(), gather(10), sign(1), launchFrom(9.5), wait(latched, 2500), wait(() => false, 250), jump(1), hold(1, (c) => c.h.grounded && c.h.y > 4.5, 3000), bank, door],
      [goPile(), gather(10), sign(-1), launchFrom(13.5), hold(1, (c) => c.h.grounded && c.h.y > 5), bank, door],
      [magnusFight],
   ],
};

/** Scrap Magnus: read his sign and step, and do what the coach line says. */
function magnusFight(c: Ctx): boolean {
   const m = c.w.magnus!;
   const s = m.state;
   const r = roomOf(c);
   if (r.doorOpen) return door(c);
   const h = c.h;
   if (s.phase === 0) {
      // keep his sign through the slam, flip to the opposite once his core is open
      const want = s.step === "vulnerable" ? (m.sign === 1 ? -1 : 1) : m.sign;
      if (h.sign !== want && !h.wasHeld) c.out.action = true;
      if (s.step !== "vulnerable") go(m.x - 5)(c);
      else c.out.x = Math.sign(m.x - h.x);
      return false;
   }
   if (s.phase === 1) {
      // stand clear, catch the block as -, flip to + to throw it back
      const b = m.block;
      if (b.alive && b.held === h.index) {
         // hold it over your head until his core opens, then flip to + to throw
         if (s.step === "vulnerable" && h.sign !== 1 && !h.wasHeld) c.out.action = true;
         return false;
      }
      if (h.sign !== -1 && !h.wasHeld) c.out.action = true;
      go(m.x - 6)(c);
      return false;
   }
   // the core rises over the pad ring: + on the floor pad launches, the - node over it pulls in
   const pad = r.def.pads.find((p) => p.floor && p.x < m.x)!;
   if (s.step !== "vulnerable") {
      if (h.sign !== -1 && !h.wasHeld) c.out.action = true;
      go(pad.x - 2)(c);
      return false;
   }
   if (h.grounded && Math.abs(h.x - pad.x) > 0.3) {
      if (h.sign !== 1 && !h.wasHeld) c.out.action = true;
      go(pad.x, 0.25)(c);
      return false;
   }
   // in flight: hold toward the core
   c.out.x = Math.sign(m.x - h.x);
   return false;
}

/** The bot's input for hero k this frame. */
export function botInput(w: World, k = 0): StepInput {
   const out = idleInput();
   const h = w.heroes[k];
   if (!h || h.ended) return out;
   const m = mem(h);
   if (m.room !== h.room) {
      m.room = h.room;
      m.step = 0;
      m.t0 = w.ms;
   }
   const plan = PLANS[w.level][h.room] ?? [door];
   const step = plan[Math.min(m.step, plan.length - 1)];
   const done = step({ w, h, out, m });
   m.lastX = h.x;
   if (done && m.step < plan.length - 1) {
      m.step++;
      m.t0 = w.ms;
   }
   void HERO;
   return out;
}
