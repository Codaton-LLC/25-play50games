// An honest wall-running bot: it reads the course's legs (pad to pad) and plays them with the stick,
// Jump and Action like a player: run to the pad's edge, jump at a wall, kick across in rhythm, ride the
// last wall out onto the next pad, aim each column whip's entry point, climb the shaft, roll under spike
// panels. On level 5 it kicks into Umbra in his windows and runs a leg backwards while a gate is shut.
// It never writes the hero. Preview autoplay (`?autoplay=1`) and the proofs use it.
import { ramAt, right, wallOut, type Leg, type Vec3 } from "./course";
import { BODY_R, RUN_MS, V_WALL, blockSolid, createStepInput, type StepInput, type WallRun } from "./rules";

export interface Bot {
   /** the leg being played and whether it runs backwards (a shut gate ahead) */
   leg: number;
   reverse: boolean;
   /** whip legs: the next column in the leg's order */
   whip: number;
   /** the kick side for the next jump (+1 = the right-hand wall) */
   side: number;
   lastMode: string;
   frameMs: number;
}

export function createBot(_run: WallRun): Bot {
   return { leg: 0, reverse: false, whip: 0, side: 1, lastMode: "ground", frameMs: 16 };
}

const H = { x: 0, y: 0, z: 0 };

function steer(input: StepInput, dx: number, dz: number, k = 1): void {
   const d = Math.hypot(dx, dz);
   if (d < 1e-6) return;
   // the stick: screen-up is -z in input space with yaw 0 → world (x, z) = (moveX, moveZ)
   input.moveX = (dx / d) * k;
   input.moveZ = (dz / d) * k;
}

/** Is a gate ahead on this leg still shut? */
function gateShut(run: WallRun, leg: Leg): boolean {
   const c = run.course;
   const a = c.pads[leg.from];
   for (let i = 0; i < c.blocks.length; i++) {
      const b = c.blocks[i];
      if (b.kind !== "gate" || !blockSolid(run, i)) continue;
      const gx = (b.x0 + b.x1) / 2;
      const gz = (b.z0 + b.z1) / 2;
      const d = (gx - a.x) * leg.heading.x + (gz - a.z) * leg.heading.z;
      if (d > 0 && d < a.r + 3 && Math.abs((gx - a.x) * leg.heading.z - (gz - a.z) * leg.heading.x) < 4) return true;
   }
   return false;
}

interface Plan {
   from: number;
   to: number;
   heading: Vec3;
   kind: Leg["kind"];
   side: number;
   columns: number[];
   /** per column: the heading into it and out of it */
   ins: Vec3[];
   outs: Vec3[];
}

const neg = (v: Vec3): Vec3 => ({ x: -v.x, y: 0, z: -v.z });

function planOf(leg: Leg, reverse: boolean): Plan {
   if (!reverse) {
      const ins: Vec3[] = [];
      let h = leg.heading;
      for (const t of leg.turns) {
         ins.push(h);
         h = t;
      }
      // the heading of a whip leg's start is the heading before its first turn
      return { from: leg.from, to: leg.to, heading: ins[0] ?? leg.heading, kind: leg.kind, side: leg.side, columns: leg.columns, ins, outs: leg.turns };
   }
   const insF: Vec3[] = [];
   let h = leg.heading;
   for (const t of leg.turns) {
      insF.push(h);
      h = t;
   }
   const n = leg.columns.length;
   const cols = leg.columns.slice().reverse();
   const ins: Vec3[] = [];
   const outs: Vec3[] = [];
   for (let k = n - 1; k >= 0; k--) {
      ins.push(neg(leg.turns[k]));
      outs.push(neg(insF[k]));
   }
   const end = leg.kind === "whip" ? neg(leg.turns[n - 1]) : neg(leg.heading);
   return { from: leg.to, to: leg.from, heading: end, kind: leg.kind, side: -leg.side, columns: cols, ins, outs };
}

export function botInput(bot: Bot, run: WallRun, input: StepInput): void {
   input.moveX = 0;
   input.moveZ = 0;
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   const h = run.hero;
   if (run.ended || h.mode === "lost" || h.mode === "spawn") {
      bot.lastMode = h.mode;
      return;
   }
   const c = run.course;
   // on a pad: pick the leg that starts here (or, with a gate shut ahead, the one that ends here, backwards)
   if (h.mode === "ground") {
      const p = h.support;
      const fwd = c.legs.findIndex((l) => l.from === p);
      const back = c.legs.findIndex((l) => l.to === p);
      if (fwd >= 0 && !gateShut(run, c.legs[fwd])) {
         bot.leg = fwd;
         bot.reverse = false;
      } else if (back >= 0 && run.boss) {
         bot.leg = back;
         bot.reverse = true;
      } else if (fwd >= 0) {
         bot.leg = fwd;
         bot.reverse = false;
      } else if (back >= 0) {
         // a side deck: walk back to the leg's start pad
         bot.leg = back;
         bot.reverse = false;
      }
      bot.whip = 0;
   }
   const leg = c.legs[bot.leg];
   if (!leg) return;
   const plan = planOf(leg, bot.reverse);
   const from = c.pads[plan.from];
   const to = c.pads[plan.to];
   const hd = plan.heading;
   const rt = right(hd);
   if (h.mode === "ground") {
      // walk to the launch point at the pad's far edge, then jump at the first wall (or the column)
      if (h.support !== plan.from) {
         steer(input, from.x - h.x, from.z - h.z);
         bot.lastMode = h.mode;
         return;
      }
      const ahead = (h.x - from.x) * hd.x + (h.z - from.z) * hd.z;
      const lateral = (h.x - from.x) * rt.x + (h.z - from.z) * rt.z;
      const goal = from.r - 0.45;
      if (ahead < goal) {
         steer(input, hd.x * 2 - rt.x * lateral * 0.8, hd.z * 2 - rt.z * lateral * 0.8);
      } else {
         steer(input, hd.x, hd.z);
         // a swinging ram on this leg: wait on the pad until it will be clear when we pass under it
         if (ramBlocks(run, plan) || panelIn(run, plan)) {
            input.moveX = 0;
            input.moveZ = 0;
            bot.lastMode = h.mode;
            return;
         }
         input.jumpPressed = true;
         bot.side = plan.kind === "walls" || plan.kind === "shaft" ? plan.side : 0;
      }
      bot.lastMode = h.mode;
      return;
   }
   if (plan.kind === "whip") {
      airWhip(bot, run, plan, input);
      bot.lastMode = h.mode;
      return;
   }
   if (h.mode === "wall") {
      onWall(bot, run, plan, input);
      bot.lastMode = h.mode;
      return;
   }
   if (h.mode === "air") {
      // after a kick or a jump: steer at the wall on bot.side; past the walls: steer at the pad
      const toX = to.x - h.x;
      const toZ = to.z - h.z;
      const distTo = toX * hd.x + toZ * hd.z;
      const endOfWalls = wallsEnd(run, plan);
      const pastWalls = (h.x - from.x) * hd.x + (h.z - from.z) * hd.z > endOfWalls - 0.2;
      if (plan.kind === "shaft") {
         const top = to.y;
         if (h.y > top + 0.6) steer(input, toX, toZ);
         else steer(input, rt.x * bot.side, rt.z * bot.side, 1);
      } else if (pastWalls || distTo < to.r) {
         steer(input, toX, toZ);
      } else {
         steer(input, hd.x * 0.7 + rt.x * bot.side, hd.z * 0.7 + rt.z * bot.side);
      }
   }
   bot.lastMode = h.mode;
}

const RP = { x: 0, y: 0, z: 0 };

/** A sliding panel where the jump lands: wait until it is out on arrival and stays out a while. */
function panelIn(run: WallRun, plan: Plan): boolean {
   if (plan.kind !== "walls") return false;
   const c = run.course;
   const a = c.pads[plan.from];
   const rt = right(plan.heading);
   const px = a.x + plan.heading.x * (a.r + 1.5) + rt.x * plan.side * 2.6;
   const pz = a.z + plan.heading.z * (a.r + 1.5) + rt.z * plan.side * 2.6;
   for (const w of c.walls) {
      if (w.kind !== "moving") continue;
      const al = w.axis === "x" ? px : pz;
      const ac = w.axis === "x" ? pz : px;
      if (al < w.a0 || al > w.a1 || Math.abs(ac - w.c) > 0.8) continue;
      return !(wallOut(w, run.simMs + 450) && wallOut(w, run.simMs + 1100));
   }
   return false;
}

/** Is a ram's bob within `reach` m (xz) of a point at rules time `ms`, low enough to hit? */
function ramNear(run: WallRun, ms: number, x: number, z: number, y: number, reach: number): boolean {
   for (const r of run.course.rams) {
      ramAt(r, ms, RP);
      if (Math.hypot(RP.x - x, RP.z - z) < reach && Math.abs(RP.y - y) < 2.6) return true;
   }
   return false;
}

/** The pad jump never meets a ram (they hang mid-corridor). */
function ramBlocks(_run: WallRun, _plan: Plan): boolean {
   return false;
}

/** how far past the plan's start pad's centre the corridor's walls end (along the heading) */
function wallsEnd(run: WallRun, plan: Plan): number {
   const c = run.course;
   const a = c.pads[plan.from];
   const b = c.pads[plan.to];
   return (b.x - a.x) * plan.heading.x + (b.z - a.z) * plan.heading.z - b.r + 0.6;
}

function onWall(bot: Bot, run: WallRun, plan: Plan, input: StepInput): void {
   const h = run.hero;
   const c = run.course;
   const w = c.walls[h.wall];
   const hd = plan.heading;
   const rt = right(hd);
   // which side this wall is: kick to the other next
   const sideHere = (w.axis === "x" ? w.n * -rt.z : w.n * -rt.x) > 0 ? 1 : -1;
   bot.side = -sideHere;
   // roll under a spike panel just ahead on this wall
   for (const s of c.spikes) {
      if (s.wall !== h.wall) continue;
      const mid = w.axis === "x" ? (s.x0 + s.x1) / 2 : (s.z0 + s.z1) / 2;
      const at = w.axis === "x" ? h.x : h.z;
      const d = (mid - at) * h.runDir;
      if (d > 1.35 && d < 1.65) input.actionPressed = true;
   }
   if (plan.kind === "shaft") {
      // climb: kick as soon as the catch settles; near the top, kick toward the pad
      if (h.wallT > 90) input.jumpPressed = true;
      return;
   }
   const at = (h.x - c.pads[plan.from].x) * hd.x + (h.z - c.pads[plan.from].z) * hd.z;
   const end = wallsEnd(run, plan);
   const left = end - at;
   const timeLeft = (RUN_MS - h.wallT) / 1000;
   const b = c.pads[plan.to];
   // ride the wall out onto the pad when it gets there before the run ends, and the pad is not above
   if (left < V_WALL * timeLeft - 0.6 && b.y <= h.y + 0.3 && w.kind !== "crumble") return;
   let kickAt = 1050;
   if (w.kind === "crumble") kickAt = 420;
   if (w.kind === "moving") {
      // kick when the facing panel will be out on arrival, or now if this panel is about to go in
      const other = facing(run, h.wall);
      const ok = other < 0 || wallOut(c.walls[other], run.simMs + 750);
      const goingIn = !wallOut(w, run.simMs + 160);
      if ((h.wallT > 380 && ok) || goingIn) input.jumpPressed = true;
      return;
   }
   if (left < 1.2) return;
   if (h.wallT >= kickAt) {
      // a ram in the gap: hold the kick while its bob would meet the crossing (unless the run is ending)
      const mx = h.x + h.vx * 0.4 + (w.axis === "x" ? 0 : -w.n * 0) ;
      const mz = h.z + h.vz * 0.4;
      const cx = w.axis === "x" ? mx : mx + w.n * 2.6;
      const cz = w.axis === "x" ? mz + w.n * 2.6 : mz;
      const late = h.wallT > (w.kind === "crumble" ? 680 : RUN_MS - 160);
      if (!late && (ramNear(run, run.simMs + 400, cx, cz, h.y + 1.5, 2.6) || ramNear(run, run.simMs + 200, cx, cz, h.y + 1.5, 2.6))) return;
      // never kick into a spike panel on the facing wall
      if (!late && spikeAhead(run, h.wall, at + V_WALL * h.runDir * 0.8)) return;
      input.jumpPressed = true;
   }
   // level 5 phase 1: kick into Umbra the moment his window opens
   if (run.boss && run.boss.phase === 0 && run.boss.step === "vulnerable" && h.wallT > 200) input.jumpPressed = true;
}

/** a spike panel on the wall facing `i` within 1.8 m of along-position `at` (from the plan's pad... world along) */
function spikeAhead(run: WallRun, i: number, _at: number): boolean {
   const c = run.course;
   const h = run.hero;
   const w = c.walls[i];
   for (let t = 0.3; t <= 1.0; t += 0.1) {
      const land = (w.axis === "x" ? h.x : h.z) + V_WALL * h.runDir * t;
      for (const s of c.spikes) {
         const o = c.walls[s.wall];
         if (s.wall === i || o.axis !== w.axis || o.n === w.n) continue;
         const mid = o.axis === "x" ? (s.x0 + s.x1) / 2 : (s.z0 + s.z1) / 2;
         if (land < o.a0 || land > o.a1) continue;
         if (Math.abs(mid - land) < 1.7) return true;
      }
   }
   return false;
}

/** the facing wall of a corridor wall (same span, opposite normal) */
function facing(run: WallRun, i: number): number {
   const w = run.course.walls[i];
   for (let k = 0; k < run.course.walls.length; k++) {
      const o = run.course.walls[k];
      if (k === i || o.axis !== w.axis || o.n === w.n || o.kind !== w.kind) continue;
      if (Math.abs(o.a0 - w.a0) < 0.5 && Math.abs(o.a1 - w.a1) < 0.5) return k;
   }
   return -1;
}

function airWhip(bot: Bot, run: WallRun, plan: Plan, input: StepInput): void {
   const h = run.hero;
   const c = run.course;
   if (h.mode === "whip") {
      const k = plan.columns.indexOf(h.col);
      if (k >= 0) bot.whip = Math.max(bot.whip, k + 1);
      return;
   }
   if (h.mode !== "air") return;
   const R = 1.2;
   if (bot.whip < plan.columns.length) {
      const col = c.columns[plan.columns[bot.whip]];
      const t = plan.outs[bot.whip];
      const hin = plan.ins[bot.whip];
      // the entry point C - t * R, approached along the heading into it
      H.x = col.x - t.x * R - hin.x * 0.6;
      H.z = col.z - t.z * R - hin.z * 0.6;
      steer(input, H.x - h.x + hin.x * 1.5, H.z - h.z + hin.z * 1.5);
      return;
   }
   const to = c.pads[plan.to];
   steer(input, to.x - h.x, to.z - h.z);
   void BODY_R;
}

export function blankInput(): StepInput {
   return createStepInput();
}
