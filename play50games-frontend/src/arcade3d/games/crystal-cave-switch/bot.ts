// An honest player for Crystal Cave Switch (tests, proofs and `?autoplay=1`): it reads the beacons
// (each room's order) like a player and follows the level's route (course.ts) through the real
// StepInput, camera-relative like a thumb on the stick: run to each crystal in order and strike it,
// jump onto the boulder steps and ledges, wait for the moving slab and ride it, walk through the opened
// gates. In the Prism's arena it steps out of the beam's lane and strikes the colour code the open core
// shows. It never sets the run's state.
import { ACT_REACH } from "./heroes";
import { HERO_R, boxOffset, boxSolid, roomAt, type CaveRun, type StepInput } from "./rules";
import type { Box } from "./course";

export interface Bot {
   frameMs: number;
   idx: number;
   /** ms the bot has been pressing at the current crystal (it retries) */
   pressedAt: number;
   wasDead: boolean;
}

export function createBot(run: CaveRun, frameMs = 1000 / 60): Bot {
   void run;
   return { frameMs, idx: 0, pressedAt: -1, wasDead: false };
}

function setStick(input: StepInput, wx: number, wz: number): void {
   const cy = Math.cos(input.yaw);
   const sy = Math.sin(input.yaw);
   input.moveX = cy * wx - sy * wz;
   input.moveZ = sy * wx + cy * wz;
}

function steer(run: CaveRun, input: StepInput, tx: number, tz: number, gain = 3): void {
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

const O = { x: 0, z: 0 };

/** The highest solid box top under (x, z) that the hero could stand on (within 2.6 m above him). */
function topAt(run: CaveRun, x: number, z: number): Box | null {
   let best: Box | null = null;
   for (const b of run.course.boxes) {
      if (!boxSolid(run, b) || b.top > run.hero.y + 2.6) continue;
      boxOffset(run, b, O);
      if (x < b.minX + O.x || x > b.maxX + O.x || z < b.minZ + O.z || z > b.maxZ + O.z) continue;
      if (!best || b.top > best.top) best = b;
   }
   return best;
}

/** Is a route step done (a crystal lit / its room solved; a point reached)? */
function stepDone(run: CaveRun, i: number): boolean {
   const s = run.course.route[i];
   if (s.act !== undefined) {
      const sw = run.course.switches[s.act];
      return run.lit[s.act] === 1 || (sw.room >= 0 && run.solved[sw.room] === 1);
   }
   if (s.rail !== undefined) return run.hero.ground === s.rail;
   return Math.hypot(run.hero.x - s.x, run.hero.z - s.z) < 0.9 && run.hero.ground >= 0;
}

/** Goes to (tx, tz): runs, and jumps where the point stands higher (or across a gap). */
function goTo(run: CaveRun, input: StepInput, tx: number, tz: number): void {
   const h = run.hero;
   const d = Math.hypot(tx - h.x, tz - h.z);
   steer(run, input, tx, tz);
   if (h.ground < 0) return;
   const there = topAt(run, tx, tz);
   const g = run.course.boxes[h.ground];
   const up = there ? there.top - g.top : 0;
   if (up > 0.3 && d < 2.6) input.jumpPressed = true;
   // a gap ahead: no floor half a metre on toward the point
   if (d > 1) {
      const ux = (tx - h.x) / d;
      const uz = (tz - h.z) / d;
      const ahead = topAt(run, h.x + ux * (HERO_R + 0.35), h.z + uz * (HERO_R + 0.35));
      if (!ahead && d < 5.2) input.jumpPressed = true;
   }
}

function bossInput(run: CaveRun, input: StepInput): void {
   const b = run.boss!;
   const spec = run.course.boss!;
   const h = run.hero;
   if (b.step === "telegraph" || b.step === "attack") {
      // step out of the lane: sideways from the line through the Prism
      const lx = Math.sin(run.lane);
      const lz = Math.cos(run.lane);
      const dx = h.x - spec.x;
      const dz = h.z - spec.z;
      const across = dx * lz - dz * lx;
      const side = across >= 0 ? 1 : -1;
      const tx = h.x + lz * side * 3;
      const tz = h.z - lx * side * 3;
      steer(run, input, Math.max(-9, Math.min(9, tx)), Math.max(spec.wakeZ - 19, Math.min(spec.wakeZ - 2, tz)));
      return;
   }
   if (b.step === "vulnerable" && run.codeAt < run.code.length) {
      const want = run.code[run.codeAt];
      const id = spec.switches.find((s) => run.course.switches[s].color === want)!;
      const s = run.course.switches[id];
      if (Math.hypot(h.x - s.x, h.z - s.z) < ACT_REACH - 0.3) input.actionPressed = true;
      else steer(run, input, s.x, s.z);
      return;
   }
   steer(run, input, spec.x, spec.wakeZ - 9);
}

export function botInput(bot: Bot, run: CaveRun, input: StepInput): void {
   const h = run.hero;
   const c = run.course;
   input.jumpPressed = false;
   input.actionPressed = false;
   input.moveX = 0;
   input.moveZ = 0;
   if (run.ended !== null) return;
   if (h.deadMs >= 0) {
      bot.wasDead = true;
      return;
   }
   if (bot.wasDead) {
      // back at a room's entrance: pick the route up at the first unfinished step from here on
      bot.wasDead = false;
      const room = roomAt(run);
      let i = 0;
      while (i < c.route.length && (stepDone(run, i) || (room >= 0 && c.route[i].z > h.z + 1.5 && c.route[i].act === undefined))) i++;
      bot.idx = Math.min(i, c.route.length - 1);
   }
   if (run.boss && run.bossAwake && run.boss.step !== "defeat" && run.boss.step !== "done") {
      bossInput(run, input);
      return;
   }
   while (bot.idx < c.route.length - 1 && stepDone(run, bot.idx)) {
      bot.idx += 1;
      bot.pressedAt = -1;
   }
   const s = c.route[bot.idx];
   // riding the slab: wait on it until the next point is within a jump, then jump to it
   if (s.rail === undefined && h.ground >= 0 && c.boxes[h.ground].rail && Math.hypot(s.x - h.x, s.z - h.z) > 1.2) {
      const box = c.boxes[h.ground];
      boxOffset(run, box, O);
      const cx = (box.minX + box.maxX) / 2 + O.x;
      const cz = (box.minZ + box.maxZ) / 2 + O.z;
      const d = Math.hypot(s.x - h.x, s.z - h.z);
      if (d < 4) {
         steer(run, input, s.x, s.z, 5);
         input.jumpPressed = true;
      } else steer(run, input, cx, cz, 5);
      return;
   }
   if (s.act !== undefined) {
      const sw = c.switches[s.act];
      const d = Math.hypot(h.x - sw.x, h.z - sw.z);
      if (d < ACT_REACH - 0.35 && h.ground >= 0 && Math.abs(h.y - sw.base) < 1) {
         if (bot.pressedAt < 0 || run.simMs - bot.pressedAt > 250) {
            input.actionPressed = true;
            bot.pressedAt = run.simMs;
         }
         return;
      }
      goTo(run, input, sw.x, sw.z);
      return;
   }
   if (s.rail !== undefined) {
      const box = c.boxes[s.rail];
      boxOffset(run, box, O);
      const cx = (box.minX + box.maxX) / 2 + O.x;
      const cz = (box.minZ + box.maxZ) / 2 + O.z;
      const d = Math.hypot(cx - h.x, cz - h.z);
      if (h.ground < 0) {
         steer(run, input, cx, cz, 5);
         return;
      }
      if (d < 3.6) {
         steer(run, input, cx, cz, 5);
         input.jumpPressed = true;
      }
      return;
   }
   if (h.ground < 0) {
      steer(run, input, s.x, s.z, 5);
      return;
   }
   goTo(run, input, s.x, s.z);
}
