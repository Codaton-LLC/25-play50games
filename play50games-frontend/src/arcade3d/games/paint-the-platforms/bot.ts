// An honest player for Paint the Platforms (tests, proofs and `?autoplay=1`): it reads the arena like a
// player and drives the real StepInput, camera-relative like a thumb on the stick. It runs to the
// nearest grey tile (finishing rows first when it can), crosses to the other platforms by the course's
// links (walking a bridge, jumping a gap, waiting at a dock for a raft and riding it), keeps clear of
// the grey blots and the roller's glowing lane, and on level 5 runs out of the slam's ring and splats
// the Blob while its core is open. It never sets the run's state.
import { HERO_R, NONE, blobDown, blotPos, boxOffset, canSplat, laneBand, platOfBox, raftOff, rollerAt, tileCentre, type PaintRun, type RollerView, type StepInput } from "./rules";
import { raftOffset, type Box } from "./course";
import { SLAM_R } from "./progression";

export interface Bot {
   frameMs: number;
   target: number;
   targetSince: number;
   /** the link being crossed, or -1 */
   crossing: number;
   lastPlat: number;
   pressedAt: number;
   wasDead: boolean;
   /** tiles given up on (unreached for long), until this ms */
   skip: Map<number, number>;
}

export function createBot(run: PaintRun, frameMs = 1000 / 60): Bot {
   return { frameMs, target: NONE, targetSince: 0, crossing: NONE, lastPlat: platOfBox(run.course, run.hero.ground), pressedAt: -1, wasDead: false, skip: new Map() };
}

function setStick(input: StepInput, wx: number, wz: number): void {
   const cy = Math.cos(input.yaw);
   const sy = Math.sin(input.yaw);
   input.moveX = cy * wx - sy * wz;
   input.moveZ = sy * wx + cy * wz;
}

const V = { x: 0, z: 0 };
const T = { x: 0, z: 0 };
const O = { x: 0, z: 0 };
const RV: RollerView = { cycle: 0, step: "idle", lane: 0, x: 0, t: 0 };

/** Steers toward (tx, tz), bending round the Blob's body and away from close blots. */
function steer(run: PaintRun, input: StepInput, tx: number, tz: number, gain = 3, avoid = true): void {
   const h = run.hero;
   let wx = (tx - h.x) * gain;
   let wz = (tz - h.z) * gain;
   let l = Math.hypot(wx, wz);
   if (l > 1) {
      wx /= l;
      wz /= l;
   }
   const spec = run.course.boss;
   if (spec && run.boss && run.boss.step !== "done") {
      // round the Blob: if it lies ahead within 2.4 m of the line, go round its side
      const dx = spec.x - h.x;
      const dz = spec.z - h.z;
      const d = Math.hypot(dx, dz);
      const ahead = (dx * wx + dz * wz) / Math.max(1e-6, Math.hypot(wx, wz));
      const across = Math.abs(dx * wz - dz * wx) / Math.max(1e-6, Math.hypot(wx, wz));
      if (ahead > 0 && ahead < Math.hypot(tx - h.x, tz - h.z) && across < spec.r + 1 && d < 6) {
         const side = dx * wz - dz * wx >= 0 ? -1 : 1;
         wx += (-dz / d) * side * 1.2;
         wz += (dx / d) * side * 1.2;
      }
   }
   if (avoid) {
      for (let i = 0; i < run.course.blots.length; i++) {
         if (run.simMs <= run.blotFrozen[i]) continue;
         const p = blotPos(run, i, V);
         const dx = h.x - p.x;
         const dz = h.z - p.z;
         const d = Math.hypot(dx, dz);
         if (d > 2.2 || d < 1e-6) continue;
         const k = ((2.2 - d) / 2.2) * 2;
         wx += (dx / d) * k;
         wz += (dz / d) * k;
      }
   }
   l = Math.hypot(wx, wz);
   if (l > 1) {
      wx /= l;
      wz /= l;
   }
   setStick(input, wx, wz);
}

/** The highest box top under (x, z) the hero could stand on. */
function topAt(run: PaintRun, x: number, z: number): Box | null {
   let best: Box | null = null;
   for (const b of run.course.boxes) {
      if (b.top > run.hero.y + 0.5) continue;
      boxOffset(run, b, O);
      if (x < b.minX + O.x || x > b.maxX + O.x || z < b.minZ + O.z || z > b.maxZ + O.z) continue;
      if (!best || b.top > best.top) best = b;
   }
   return best;
}

/** Is the raft at this dock now and for 0.6 s more (time to step across)? */
function docked(run: PaintRun, raft: number, dock: number): boolean {
   const amp = run.course.rafts[raft].amp;
   return Math.abs(raftOffset(run.simMs, amp) - dock) < 0.01 && Math.abs(raftOffset(run.simMs + 600, amp) - dock) < 0.01;
}

/** Goes to (tx, tz): runs, and jumps a gap ahead (unless told not to). */
function goTo(run: PaintRun, input: StepInput, tx: number, tz: number, jump = true): void {
   const h = run.hero;
   const d = Math.hypot(tx - h.x, tz - h.z);
   steer(run, input, tx, tz);
   if (!jump || h.ground < 0 || d < 0.6) return;
   const ux = (tx - h.x) / d;
   const uz = (tz - h.z) / d;
   const ahead = topAt(run, h.x + ux * (HERO_R + 0.4), h.z + uz * (HERO_R + 0.4));
   if (!ahead && d < 5.2) input.jumpPressed = true;
}

/** Hops from platform a to every platform (BFS over the links); the first link toward each. */
function firstLinks(run: PaintRun, from: number): { hops: Int32Array; first: Int32Array } {
   const n = run.course.platforms.length;
   const hops = new Int32Array(n).fill(-1);
   const first = new Int32Array(n).fill(-1);
   hops[from] = 0;
   const queue = [from];
   while (queue.length) {
      const p = queue.shift()!;
      run.course.links.forEach((l, i) => {
         if (l.from !== p || hops[l.to] >= 0) return;
         hops[l.to] = hops[p] + 1;
         first[l.to] = p === from ? i : first[p];
         queue.push(l.to);
      });
   }
   return { hops, first };
}

function pickTarget(bot: Bot, run: PaintRun, cur: number): number {
   const c = run.course;
   const h = run.hero;
   const { hops } = firstLinks(run, cur);
   let best = NONE;
   let bestCost = Infinity;
   for (const t of c.tiles) {
      if (run.board.paint[t.id] >= 0 || hops[t.plat] < 0) continue;
      if ((bot.skip.get(t.id) ?? -1) > run.simMs) continue;
      tileCentre(run, t.id, T);
      const row = c.rows[t.row];
      let done = 0;
      for (const id of row) if (run.board.paint[id] >= 0) done += 1;
      const cost = Math.hypot(T.x - h.x, T.z - h.z) + hops[t.plat] * 14 - (done / row.length) * 1.5;
      if (cost < bestCost) {
         bestCost = cost;
         best = t.id;
      }
   }
   return best;
}

function rollerDodge(run: PaintRun, input: StepInput): boolean {
   const r = rollerAt(run, RV);
   if (!r || (r.step !== "glow" && r.step !== "roll")) return false;
   const h = run.hero;
   const [z0, z1] = laneBand(run.course, r.lane);
   if (h.z < z0 - 0.7 || h.z > z1 + 0.7 || platOfBox(run.course, h.ground) !== run.course.roller) return false;
   if (r.step === "roll" && h.x < r.x - 2.5) return false;
   const p = run.course.platforms[run.course.roller];
   const up = z0 - 1.2;
   const down = z1 + 1.2;
   const goUp = up > p.z0 && (h.z - up < down - h.z || down > p.z0 + p.nz * 2);
   steer(run, input, h.x, goUp ? up : down, 3, false);
   return true;
}

function bossInput(bot: Bot, run: PaintRun, input: StepInput): boolean {
   const b = run.boss;
   const spec = run.course.boss;
   if (!b || !spec || blobDown(run) || b.step === "intro") return false;
   const h = run.hero;
   if (b.step === "telegraph" || b.step === "attack") {
      const r = (SLAM_R[b.phase] ?? SLAM_R[0]) + HERO_R + 0.8;
      const rings = run.ring.twin ? 2 : 1;
      for (let k = 0; k < rings; k++) {
         const cx = k === 0 ? run.ring.x : 2 * spec.x - run.ring.x;
         const cz = k === 0 ? run.ring.z : 2 * spec.z - run.ring.z;
         const d = Math.hypot(h.x - cx, h.z - cz);
         if (d > r) continue;
         // out of the ring, away from its centre (along the court if the centre is on him)
         let ux = d > 0.05 ? (h.x - cx) / d : 0;
         let uz = d > 0.05 ? (h.z - cz) / d : 1;
         const fx = h.x + ux * 4;
         const fz = h.z + uz * 4;
         const p = run.course.platforms[0];
         if (fx < p.x0 + 1 || fx > p.x0 + p.nx * 2 - 1) ux = -ux;
         if (fz < p.z0 + 1 || fz > p.z0 + p.nz * 2 - 1) uz = -uz;
         steer(run, input, h.x + ux * 4, h.z + uz * 4, 3);
         return true;
      }
      return false;
   }
   if (b.step === "vulnerable") {
      if (canSplat(run)) {
         if (bot.pressedAt < 0 || run.simMs - bot.pressedAt > 200) {
            input.actionPressed = true;
            bot.pressedAt = run.simMs;
         }
         return true;
      }
      const d = Math.hypot(h.x - spec.x, h.z - spec.z) || 1;
      steer(run, input, spec.x + ((h.x - spec.x) / d) * (spec.r + 1.2), spec.z + ((h.z - spec.z) / d) * (spec.r + 1.2), 3);
      return true;
   }
   if (run.board.painted >= run.course.need) {
      // all painted: wait by the Blob for its core
      const d = Math.hypot(h.x - spec.x, h.z - spec.z) || 1;
      steer(run, input, spec.x + ((h.x - spec.x) / d) * 4, spec.z + ((h.z - spec.z) / d) * 4, 3);
      return true;
   }
   return false;
}

export function botInput(bot: Bot, run: PaintRun, input: StepInput): void {
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
      bot.wasDead = false;
      bot.crossing = NONE;
      bot.target = NONE;
   }
   const on = h.ground >= 0 ? platOfBox(c, h.ground) : NONE;
   if (on >= 0) bot.lastPlat = on;
   const cur = bot.lastPlat;
   if (bossInput(bot, run, input)) return;
   if (rollerDodge(run, input)) return;
   // crossing a link
   if (bot.crossing >= 0) {
      const l = c.links[bot.crossing];
      if (on === l.to) bot.crossing = NONE;
      else {
         if (l.raft >= 0 && on >= 0 && c.platforms[on].raft === l.raft) {
            // riding: wait for the far dock
            if (docked(run, l.raft, l.dock)) goTo(run, input, l.tx, l.tz, false);
            else {
               const b = c.boxes[c.rafts[l.raft].box];
               raftOff(run, l.raft, O);
               steer(run, input, (b.minX + b.maxX) / 2 + O.x, (b.minZ + b.maxZ) / 2 + O.z, 4, false);
            }
            return;
         }
         if (l.raft >= 0 && on === l.from) {
            // boarding: wait at the dock for the raft
            if (docked(run, l.raft, l.dock)) goTo(run, input, l.tx, l.tz, false);
            else steer(run, input, l.x, l.z, 4, false);
            return;
         }
         goTo(run, input, l.tx, l.tz, l.raft < 0);
         return;
      }
   }
   if (bot.target >= 0 && run.board.paint[bot.target] >= 0) bot.target = NONE;
   if (bot.target >= 0 && run.simMs - bot.targetSince > 7000) {
      bot.skip.set(bot.target, run.simMs + 15_000);
      bot.target = NONE;
   }
   if (bot.target < 0) {
      bot.target = pickTarget(bot, run, cur);
      bot.targetSince = run.simMs;
      if (bot.target < 0) return;
   }
   const t = c.tiles[bot.target];
   if (t.plat === cur) {
      tileCentre(run, t.id, T);
      steer(run, input, T.x, T.z, 3);
      return;
   }
   const { first } = firstLinks(run, cur);
   const li = first[t.plat];
   if (li < 0) {
      bot.target = NONE;
      return;
   }
   const l = c.links[li];
   if (Math.hypot(h.x - l.x, h.z - l.z) < 0.6) {
      bot.crossing = li;
      return;
   }
   if (l.raft >= 0 && c.platforms[cur].raft === l.raft) {
      // on the raft already: let the crossing logic wait for the dock
      bot.crossing = li;
      return;
   }
   goTo(run, input, l.x, l.z, l.raft < 0);
}
