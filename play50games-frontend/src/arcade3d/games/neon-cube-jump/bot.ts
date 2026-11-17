// An honest player for Neon Cube Jump (tests, proofs and `?autoplay=1`): it follows the level's route
// (course.ts: the cubes in order, walked onto or jumped to) through the real StepInput, camera-relative
// like a thumb on the stick. Before a jump it reads what a player sees: which set the jump will make
// solid, the rogue cubes' clock, where a moving cube is, where a sentry drone will be when it lands. In
// Flipframe's arena it plans each hop from the same reading (the stomp's set, the core's cube, the
// overdrive clock). It never sets the run's state.
import { HALF, ROGUE_MS, type Cube } from "./course";
import { GRAV, HERO_R, V_JUMP, V_RUN, cubePos, dronePos, type NeonRun, type StepInput } from "./rules";
import { OVERDRIVE_MS } from "./progression";
import { heroById } from "./heroes";

export interface Bot {
   frameMs: number;
   /** the next route step */
   idx: number;
   /** the cube the bot is jumping to (-1: none) */
   jumpTo: number;
}

export function createBot(run: NeonRun, frameMs = 1000 / 60): Bot {
   void run;
   return { frameMs, idx: 0, jumpTo: -1 };
}

/** Flight time (s) of a jump that lands dh m higher (or lower). */
export function flightS(dh: number): number {
   const d = V_JUMP * V_JUMP - 2 * GRAV * dh;
   if (d <= 0) return Infinity;
   return (V_JUMP + Math.sqrt(d)) / GRAV;
}

/** How far (m, centre to centre) a running jump carries for a landing dh higher, with room to stop. */
export function reachM(dh: number): number {
   return V_RUN * flightS(dh) + 0.6;
}

const P = { x: 0, z: 0 };
const D = { x: 0, y: 0, z: 0 };

/** The solid set the field will show at rules ms `at`, if the hero jumps now (overdrive flips counted). */
function solidAfterJump(run: NeonRun, at: number): "A" | "B" {
   let s: "A" | "B" = run.solid === "A" ? "B" : "A";
   if (run.nextAutoFlip >= 0 && run.boss && run.boss.phase === 2) {
      for (let t = run.nextAutoFlip; t <= at; t += OVERDRIVE_MS) s = s === "A" ? "B" : "A";
   }
   return s;
}

/** Will cube c be solid at ms `at` if the hero jumps now? */
function solidAt(run: NeonRun, c: Cube, at: number): boolean {
   if (c.set === "N") return true;
   if (c.set === "R") return Math.floor(at / ROGUE_MS) % 2 === c.phase;
   return solidAfterJump(run, at) === c.set;
}

/** Is it safe to jump to cube c now: solid at landing and for `holdMs` after, no drone there? */
function jumpOk(run: NeonRun, c: Cube, holdMs: number, leadMs: number): boolean {
   const h = run.hero;
   const dh = c.top - h.y;
   const land = run.simMs + leadMs + flightS(dh) * 1000;
   for (let t = land - 60; t <= land + holdMs; t += 40) if (!solidAt(run, c, t)) return false;
   cubePos(run, c, P);
   for (const d of run.course.drones) {
      for (let t = land - 150; t <= land + 350; t += 25) {
         if (solidAfterJump(run, t) !== d.set) continue;
         dronePos(d, t, D);
         if (Math.hypot(P.x - D.x, c.top + 0.75 - D.y, P.z - D.z) < 1.55) return false;
      }
   }
   return true;
}

/** Is it safe to walk across to cube c now (no active drone over the way for the next second)? */
function walkOk(run: NeonRun, c: Cube): boolean {
   const h = run.hero;
   cubePos(run, c, P);
   for (const d of run.course.drones) {
      if (run.solid !== d.set) continue;
      for (let t = 0; t <= 750; t += 25) {
         const k = Math.min(1, t / 450);
         const x = h.x + (P.x - h.x) * k;
         const z = h.z + (P.z - h.z) * k;
         dronePos(d, run.simMs + t, D);
         if (Math.hypot(x - D.x, h.y + 0.75 - D.y, z - D.z) < 1.38) return false;
      }
   }
   return true;
}

/** Is the hero (where he stands) in an active drone's way within the next 0.8 s? */
function droneNear(run: NeonRun): boolean {
   const h = run.hero;
   for (const d of run.course.drones) {
      if (run.solid !== d.set) continue;
      for (let t = 0; t <= 800; t += 50) {
         dronePos(d, run.simMs + t, D);
         if (Math.hypot(h.x - D.x, h.y + 0.75 - D.y, h.z - D.z) < 1.45) return true;
      }
   }
   return false;
}

/** A spot on cube g away from the nearest active drone's patrol line (where to wait it out). */
function retreatPoint(run: NeonRun, g: Cube, out: { x: number; z: number }): { x: number; z: number } {
   const h = run.hero;
   cubePos(run, g, out);
   let best = Infinity;
   let nx = 0;
   let nz = 0;
   for (const d of run.course.drones) {
      // the closest point of the drone's patrol segment
      const t = Math.max(-d.amp, Math.min(d.amp, (h.x - d.x) * d.ax + (h.z - d.z) * d.az));
      const px = d.x + d.ax * t;
      const pz = d.z + d.az * t;
      const dist = Math.hypot(h.x - px, h.z - pz);
      if (dist < best) {
         best = dist;
         nx = (h.x - px) / (dist || 1);
         nz = (h.z - pz) / (dist || 1);
      }
   }
   if (best < 3) {
      out.x += nx * 0.62;
      out.z += nz * 0.62;
   }
   return out;
}

const R = { x: 0, z: 0 };

function setStick(input: StepInput, wx: number, wz: number): void {
   const cy = Math.cos(input.yaw);
   const sy = Math.sin(input.yaw);
   input.moveX = cy * wx - sy * wz;
   input.moveZ = sy * wx + cy * wz;
}

/** Steers toward (tx, tz): full speed far, easing in near (stops on the spot). */
function steer(run: NeonRun, input: StepInput, tx: number, tz: number, gain = 4): void {
   const h = run.hero;
   let wx = (tx - h.x) * gain;
   let wz = (tz - h.z) * gain;
   const l = Math.hypot(wx, wz);
   if (l > 1) {
      wx /= l;
      wz /= l;
   }
   setStick(input, wx, wz);
}

/**
 * The jump step: run to the edge of the cube underfoot toward c and jump when the reading allows,
 * else wait near the middle of the cube (away from a drone). In the air, steer onto c.
 */
function jumpStep(bot: Bot, run: NeonRun, input: StepInput, c: Cube, holdMs: number): void {
   const h = run.hero;
   cubePos(run, c, P);
   const tx = P.x;
   const tz = P.z;
   if (h.ground < 0) {
      if (bot.jumpTo === c.id) steer(run, input, tx, tz, 5);
      return;
   }
   const g = run.course.cubes[h.ground];
   const gp = cubePos(run, g, { x: 0, z: 0 });
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz) || 1;
   const dh = c.top - g.top;
   if (dh > 2.4 || d > reachM(dh) + 2.2) {
      // too far (a moving cube elsewhere): wait in the middle
      steer(run, input, gp.x, gp.z);
      return;
   }
   const ok = d <= reachM(dh) && jumpOk(run, c, holdMs, 120) && !(run.simMs <= h.stunUntil);
   if (!ok) {
      // wait in the middle, or away from a drone's sweep
      if (droneNear(run)) {
         retreatPoint(run, g, R);
         steer(run, input, R.x, R.z);
      } else steer(run, input, gp.x, gp.z);
      return;
   }
   // run toward it; jump at the edge (or at once when it is close)
   const ux = dx / d;
   const uz = dz / d;
   const proj = (h.x - gp.x) * ux + (h.z - gp.z) * uz;
   const edge = Math.min(HALF / Math.max(Math.abs(ux), Math.abs(uz)), 1.4) - HERO_R * 0.6;
   setStick(input, ux, uz);
   if (proj >= edge - 0.25 || d <= 2.4) {
      input.jumpPressed = true;
      bot.jumpTo = c.id;
   }
}

/** A route walk: onto an adjacent cube of the solid set (or neutral). */
function walkStep(run: NeonRun, input: StepInput, c: Cube): void {
   cubePos(run, c, P);
   if (!walkOk(run, c)) {
      const g = run.course.cubes[Math.max(0, run.hero.ground)];
      retreatPoint(run, g, R);
      steer(run, input, R.x, R.z);
      return;
   }
   steer(run, input, P.x, P.z, 3);
}

/** Flipframe's arena: the next hop from the reading (stomp set, core cube, overdrive clock). */
function bossInput(bot: Bot, run: NeonRun, input: StepInput): void {
   const b = run.boss!;
   const c = run.course;
   const h = run.hero;
   const cubes = c.cubes;
   const here = h.ground >= 0 ? cubes[h.ground] : null;
   if (h.ground < 0) {
      if (bot.jumpTo >= 0) {
         cubePos(run, cubes[bot.jumpTo], P);
         steer(run, input, P.x, P.z, 5);
      }
      return;
   }
   bot.jumpTo = -1;
   const near = (q: Cube) => Math.hypot(q.x - h.x, q.z - h.z);
   const arena = cubes.filter((q) => q.arena && q.set !== "N" && near(q) <= reachM(q.top - h.y) && near(q) > 0.9 && q.top - h.y <= 2.2);
   const hold = (q: Cube, ms: number) => jumpOk(run, q, ms, 60);
   const go = (q: Cube | undefined) => {
      if (!q) return false;
      bot.jumpTo = q.id;
      const dx = q.x - h.x;
      const dz = q.z - h.z;
      const l = Math.hypot(dx, dz) || 1;
      setStick(input, dx / l, dz / l);
      input.jumpPressed = true;
      return true;
   };
   const stay = () => {
      if (here) steer(run, input, here.x, here.z);
   };
   if (b.phase === 0) {
      // the stomp hits the set it locked at its tell (and the floor): be on the other one
      const danger = b.step === "telegraph" || b.step === "attack";
      const onTarget = !!here && (here.set === "N" || here.set === run.stompSet);
      if (danger && onTarget && b.step === "telegraph") {
         const safe = arena.filter((q) => q.set !== run.stompSet && !q.tower && hold(q, 300)).sort((p, q) => near(p) - near(q));
         if (go(safe[0])) return;
      }
      // back up onto the checkerboard from the floor between stomps
      if (here && here.set === "N" && !danger) {
         const up = arena.filter((q) => !q.tower && hold(q, 300)).sort((p, q) => near(p) - near(q));
         if (go(up[0])) return;
      }
      stay();
      return;
   }
   if (b.phase === 1) {
      const core = run.coreCube >= 0 ? cubes[run.coreCube] : null;
      if (core && b.step === "vulnerable" && near(core) <= reachM(core.top - h.y) && hold(core, 100)) {
         go(core);
         return;
      }
      // get within a hop of the core (or back onto the board)
      if (core && near(core) > 2.9 && b.step !== "vulnerable") {
         const hop = arena.filter((q) => !q.tower && hold(q, 400) && Math.hypot(q.x - core.x, q.z - core.z) < near(core) - 0.5).sort((p, q) => Math.hypot(p.x - core.x, p.z - core.z) - Math.hypot(q.x - core.x, q.z - core.z));
         if (go(hop[0])) return;
      }
      if (here && here.set === "N") {
         const up = arena.filter((q) => !q.tower && hold(q, 400)).sort((p, q) => near(p) - near(q));
         if (go(up[0])) return;
      }
      stay();
      return;
   }
   // P3 overdrive: climb to the tower top (the hop that gets closest, with time to hop again)
   const top = cubes[c.boss!.towerTop];
   const score = (q: Cube) => (q.id === top.id ? -100 : q.tower ? -50 : 0) + Math.hypot(q.x - top.x, q.z - top.z);
   const cands = arena
      .concat(cubes.filter((q) => q.tower && near(q) <= reachM(q.top - h.y) && q.top - h.y <= 2.2 && near(q) > 0.9))
      .filter((q) => hold(q, q.id === top.id ? 120 : q.tower ? 760 : 450))
      .sort((p, q) => score(p) - score(q));
   const best = cands[0];
   const hereScore = here ? score(here) : 99;
   if (best && score(best) < hereScore - 0.5) {
      go(best);
      return;
   }
   if (here && here.set === "N" && best) {
      go(best);
      return;
   }
   stay();
}

export function botInput(bot: Bot, run: NeonRun, input: StepInput): void {
   const h = run.hero;
   const c = run.course;
   input.jumpPressed = false;
   input.actionPressed = false;
   input.moveX = 0;
   input.moveZ = 0;
   if (run.ended !== null || h.deadMs >= 0) {
      bot.jumpTo = -1;
      return;
   }
   // the route step: the one after the cube underfoot (back at a checkpoint after a fall, too)
   if (h.ground >= 0) {
      if (h.ground === c.start) bot.idx = 0;
      else {
         const at = c.route.findIndex((s) => s.cube === h.ground);
         if (at >= 0) bot.idx = at + 1;
      }
      if (bot.jumpTo === h.ground) bot.jumpTo = -1;
   }
   // powers where the card puts them
   const ready = run.simMs >= run.powerReadyAt;
   const power = heroById(run.heroId).power;
   if (ready && power === "magnet" && c.coins.some((k, i) => !run.coinTaken[i] && Math.hypot(k.x - h.x, k.y - h.y, k.z - h.z) < 4.5)) input.actionPressed = true;
   if (run.boss && run.bossAwake && run.boss.step !== "defeat" && run.boss.step !== "done") {
      bossInput(bot, run, input);
      return;
   }
   const stepDef = c.route[Math.min(bot.idx, c.route.length - 1)];
   const target = c.cubes[stepDef.cube];
   if (stepDef.mode === "walk" && h.ground >= 0 && bot.jumpTo < 0) walkStep(run, input, target);
   else jumpStep(bot, run, input, target, 300);
}
