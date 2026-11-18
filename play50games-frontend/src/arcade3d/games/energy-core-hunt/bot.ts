// The honest bot (the tests, the proof and ?autoplay=1): it only writes a StepInput (a move, Jump,
// Action), what a player's keys or touch give. It reads the order the way a player reads the HUD: it
// walks to the nearest landed core of a colour the order still wants, opens a capsule on the way, steers
// round crates, unwanted cores, flickering decoys and live tesla coils, takes the golden orbs near its
// path, and walks into the gate once it opens. On level 5 it jumps the Core Sprite's shock rings and runs
// into it while it is dazed. With `routes` it first plays its hero's own route: Vexa phases into the
// crate ring, Zuno pulls its orbs with the magnet, Nami double-jumps over the crate stack.
import { CRATE_R, type Course } from "./course";
import { CORE_SPRITE } from "./progression";
import {
   BODY_R,
   CAPSULE_R,
   DROP_MS,
   RING_MAX,
   SPEED,
   capsuleNear,
   coreReady,
   corePos,
   shockRadius,
   spritePos,
   teslaOn,
   wanted,
   bossOpen,
   type CoreRun,
   type StepInput,
} from "./rules";

type Goal = { x: number; z: number; t: "go" | "power" | "hop2" | "jumpAt" };

export interface Bot {
   frameMs: number;
   /** the hero's route, step by step (done first) */
   route: Goal[];
   at: number;
   since: number;
   lastHits: number;
}

function routeOf(c: Course, hero: string): Goal[] {
   const out: Goal[] = [];
   const ring = c.orbs.filter((o) => o.bonus === "ring");
   if (ring.length && (hero === "vexa" || hero === "zuno")) {
      const cx = (ring[0].x + ring[1].x) / 2;
      const cz = ring[0].z;
      // approach from the arena's centre side
      const sx = cx - Math.sign(cx) * 2.6;
      if (hero === "vexa") out.push({ x: sx, z: cz, t: "go" }, { x: sx, z: cz, t: "power" }, { x: cx, z: cz + 0.4, t: "go" }, { x: sx, z: cz, t: "go" });
      else out.push({ x: sx - Math.sign(cx) * 0.5, z: cz, t: "go" }, { x: sx, z: cz, t: "power" });
   }
   const high = c.orbs.filter((o) => o.bonus === "high");
   if (high.length && hero === "nami") {
      out.push({ x: high[0].x, z: high[0].z + 1.8, t: "go" }, { x: high[0].x, z: high[0].z - 3.4, t: "hop2" });
   }
   return out;
}

export function createBot(run: CoreRun, frameMs = 1000 / 60, routes = true): Bot {
   return { frameMs, route: routes ? routeOf(run.course, run.heroId) : [], at: 0, since: -1, lastHits: 0 };
}

const P = { x: 0, z: 0 };
const OUT = { x: 0, z: 0 };

/** The move toward (tx, tz), bent round what must not be touched. */
function steer(run: CoreRun, tx: number, tz: number, input: StepInput, avoidCores = true): number {
   const h = run.hero;
   let dx = tx - h.x;
   let dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   if (d < 1e-6) return 0;
   dx /= d;
   dz /= d;
   let ax = 0;
   let az = 0;
   const push = (ox: number, oz: number, r: number) => {
      const qx = h.x - ox;
      const qz = h.z - oz;
      const q = Math.hypot(qx, qz);
      if (q > r + 1.4 || q < 1e-6) return;
      // only what lies ahead
      if ((ox - h.x) * dx + (oz - h.z) * dz < -0.3) return;
      const k = (r + 1.4 - q) / 1.4;
      // sideways, round it
      const side = Math.sign(-dz * qx + dx * qz) || 1;
      ax += (qx / q) * k * 1.2 + -dz * side * k * 1.5;
      az += (qz / q) * k * 1.2 + dx * side * k * 1.5;
   };
   const phase = run.ms < run.phaseUntil;
   if (!phase) for (const c of run.course.crates) push(c.x, c.z, CRATE_R * 1.45 + BODY_R);
   const w = run.course.waves[run.wave];
   if (w && avoidCores) {
      for (let i = 0; i < w.cores.length; i++) {
         if (run.taken[i] || wanted(run, w.cores[i].color)) continue;
         corePos(run, i, run.ms, P);
         if (Math.hypot(P.x - tx, P.z - tz) < 0.3) continue;
         push(P.x, P.z, 1.1);
      }
      for (const dc of w.decoys) push(dc.x, dc.z, 1.2);
   }
   for (let i = 0; i < run.course.teslas.length; i++) {
      const t = run.course.teslas[i];
      const soon = teslaOn(run, i, run.ms + 400) || teslaOn(run, i);
      if (soon) push(t.x, t.z, t.radius + 0.3);
   }
   let mx = dx + ax;
   let mz = dz + az;
   const m = Math.hypot(mx, mz);
   if (m > 1e-6) {
      mx /= m;
      mz /= m;
   }
   const k = Math.min(1, d / 0.2);
   input.moveX = mx * k;
   input.moveY = mz * k;
   return d;
}

export function botInput(bot: Bot, run: CoreRun, input: StepInput): void {
   input.moveX = input.moveY = 0;
   input.yaw = 0;
   input.jumpPressed = input.actionPressed = false;
   const h = run.hero;
   const c = run.course;
   if (run.ms < h.heldUntil) return;
   const ground = h.h <= 0.001;

   // the hero's route first
   const g = bot.route[bot.at];
   if (g) {
      if (bot.since < 0) bot.since = run.ms;
      if (g.t === "go") {
         if (steer(run, g.x, g.z, input) < 0.3) {
            bot.at += 1;
            bot.since = -1;
         }
      } else if (g.t === "power") {
         if (run.ms >= run.powerReadyAt) input.actionPressed = true;
         bot.at += 1;
         bot.since = -1;
      } else if (g.t === "hop2") {
         steer(run, g.x, g.z, input, false);
         if (ground && run.ms - bot.since < 40) input.jumpPressed = true;
         if (!ground && h.airHops === 0 && h.vy < 0.6) input.jumpPressed = true;
         if (ground && run.ms - bot.since > 400) {
            bot.at += 1;
            bot.since = -1;
         }
      }
      if (run.ms - (bot.since < 0 ? run.ms : bot.since) > 5000) {
         bot.at += 1;
         bot.since = -1;
      }
      return;
   }

   // the gate
   if (run.gateOpen) {
      steer(run, c.gate.x, c.gate.z, input);
      return;
   }

   // level 5: the Core Sprite
   if (run.bossAwake && run.boss && run.boss.step !== "done") {
      const sp = spritePos(run, OUT);
      const ring = shockRadius(run);
      const d = Math.hypot(sp.x - h.x, sp.z - h.z);
      if (bossOpen(run)) steer(run, sp.x, sp.z, input, false);
      else {
         // keep about 3.5 m off it
         const away = d < 3.5 ? -1 : d > 4.5 ? 1 : 0;
         if (away !== 0) steer(run, h.x + ((sp.x - h.x) / Math.max(d, 1e-3)) * away, h.z + ((sp.z - h.z) / Math.max(d, 1e-3)) * away, input, false);
      }
      if (Number.isFinite(ring) && ground) {
         const atk = CORE_SPRITE.phases[run.boss.phase]?.attacks[0].attackMs ?? 1200;
         const speed = RING_MAX / (atk / 1000);
         const gap = d - ring;
         if (gap > 0 && gap < speed * 0.26 + 0.45) input.jumpPressed = true;
      }
      return;
   }

   // the wave: the nearest landed core the order still wants (a capsule: open it)
   const w = c.waves[run.wave];
   if (!w) return;
   let best = -1;
   let bd = Infinity;
   let waitBest = -1;
   let wd = Infinity;
   for (let i = 0; i < w.cores.length; i++) {
      if (run.taken[i] || !wanted(run, w.cores[i].color)) continue;
      corePos(run, i, run.ms + 200, P);
      const d = Math.hypot(P.x - h.x, P.z - h.z);
      if (run.ms >= run.dropAt[i] + DROP_MS - 300) {
         if (d < bd) {
            bd = d;
            best = i;
         }
      } else if (d < wd) {
         wd = d;
         waitBest = i;
      }
   }
   const i = best >= 0 ? best : waitBest;
   if (i < 0) return;
   // a golden orb of this wave nearer than the core: take it first
   let ob = -1;
   let od = Math.min(6, best >= 0 ? bd : Infinity);
   for (let k = 0; k < c.orbs.length; k++) {
      const o = c.orbs[k];
      if (o.bonus !== null || run.collected[k] || o.wave > run.wave) continue;
      const d = Math.hypot(o.x - h.x, o.z - h.z);
      if (d < od) {
         od = d;
         ob = k;
      }
   }
   if (ob >= 0) {
      steer(run, c.orbs[ob].x, c.orbs[ob].z, input);
      return;
   }
   corePos(run, i, run.ms + 150, P);
   const cap = w.cores[i].kind === "capsule" && !run.open[i];
   if (cap) {
      const d = steer(run, P.x, P.z, input);
      if (d < CAPSULE_R - 0.4 && capsuleNear(run) >= 0) input.actionPressed = true;
      void coreReady;
      return;
   }
   steer(run, P.x, P.z, input);
   void SPEED;
}
