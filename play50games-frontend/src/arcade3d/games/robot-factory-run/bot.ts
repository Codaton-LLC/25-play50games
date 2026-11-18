// The honest bot (tests, and `?autoplay=1` on preview builds): it plays through the same StepInput
// a player has. It works out which plates to step on (each turntable's plate, as many times as the
// level's wiring needs, nearest first), walks there by a tile path (around machinery, closed lasers,
// presses and tread bots; it hops up boxes and catwalks), steps off and on again for a second turn,
// picks up the floor orbs while the cells ride, and waits in the exit. Level 5: it keeps the line
// wired into M-8's chest (a punched table gets fixed), reverses the lane while M-8 walks it, and
// climbs to the catwalk to roll-drop into the vents while they are open. No power is used.
import { DC, DR, H, K, W, at, colOf, inside, rowOf, tileX, tileZ, type Dir } from "./factory";
import { HERO_R, NONE, botPos, bossPos, pressState, type FactoryRun, type StepInput } from "./rules";

export interface FactoryBot {
   frameMs: number;
   /** plates still to press, in order */
   todo: number[];
   /** a plate just pressed: the free tile to step off to before pressing it again */
   stepOff: number;
   offUntil: number;
   planned: boolean;
   lastPlanMs: number;
   jumpAt: number;
}

export function createBot(run?: FactoryRun, frameMs = 1000 / 60): FactoryBot {
   void run;
   return { frameMs, todo: [], stepOff: NONE, offUntil: 0, planned: false, lastPlanMs: -1, jumpAt: -1 };
}

const P = { x: 0, z: 0 };

/** The plates to press so every turntable points along the level's route (bot plate order if given). */
export function platePlan(run: FactoryRun): number[] {
   const spec = run.floor.spec;
   const b = run.board;
   const out: number[] = [];
   for (let i = 0; i < spec.route.length; i++) {
      if (b.jamUntil[i] > run.simMs) continue;
      const need = (spec.route[i] - b.turns[i] + 4) % 4;
      if (need === 0) continue;
      const p = spec.plates.findIndex((pl) => pl.turns.length === 1 && pl.turns[0] === i);
      const q = p >= 0 ? p : spec.plates.findIndex((pl) => pl.turns.includes(i));
      for (let k = 0; k < need; k++) out.push(q);
   }
   return out;
}

/** Can the bot stand on this tile now (and how high)? */
function standable(run: FactoryRun, i: number): number {
   const t = run.floor.tiles[i];
   switch (t.k) {
      case K.Wall:
      case K.Charger:
      case K.Secret:
      case K.Boss:
      case K.Ghost:
         return NONE;
      case K.Cracked:
         return run.board.broken[i] ? 0 : NONE;
      case K.Laser:
         return run.board.lasers[t.idx] ? NONE : 0;
      case K.Box:
      case K.Catwalk:
         return t.top;
      default:
         return 0;
   }
}

function blockedNow(run: FactoryRun, c: number, r: number): boolean {
   const f = run.floor;
   const ms = run.simMs;
   for (const [pc, pr] of f.spec.presses) if (pc === c && pr === r) return true;
   for (const bt of f.spec.bots) {
      for (const dt of [0, 400, 800]) {
         botPos(bt, ms + dt, P);
         if (Math.abs(P.x - tileX(c)) < 1.6 && Math.abs(P.z - tileZ(r)) < 1.6) return true;
      }
   }
   if (run.boss && run.boss.phase === 1) {
      bossPos(run, P);
      if (Math.abs(P.x - tileX(c)) < 2.2 && Math.abs(P.z - tileZ(r)) < 1.5) return true;
   }
   return false;
}

/** The next tile on the shortest walk from the hero's tile to `goal` (NONE if none). */
function nextTile(run: FactoryRun, goal: number, avoidPlates: boolean): number {
   const h = run.hero;
   const start = at(colOf(h.x), rowOf(h.z));
   if (start === goal) return goal;
   const prev = new Int32Array(W * H).fill(-2);
   prev[start] = -1;
   const q = [start];
   while (q.length > 0) {
      const i = q.shift()!;
      if (i === goal) break;
      const c = i % W;
      const r = Math.floor(i / W);
      const hi = standable(run, i);
      for (let d = 0; d < 4; d++) {
         const nc = c + DC[d];
         const nr = r + DR[d];
         if (!inside(nc, nr)) continue;
         const j = at(nc, nr);
         if (prev[j] !== -2) continue;
         const hj = standable(run, j);
         if (hj === NONE) continue;
         if (hj - Math.max(0, hi) > 1.15) continue;
         if (j !== goal && blockedNow(run, nc, nr)) continue;
         if (avoidPlates && j !== goal && run.floor.tiles[j].k === K.Plate) continue;
         prev[j] = i;
         q.push(j);
      }
   }
   if (prev[goal] === -2) return NONE;
   let j = goal;
   while (prev[j] !== start && prev[j] >= 0) j = prev[j];
   return j;
}

function steer(run: FactoryRun, input: StepInput, tx: number, tz: number, slow = false): void {
   const h = run.hero;
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   if (d < 0.08) return;
   const k = slow ? Math.min(1, d / 0.6) : 1;
   input.moveX = (dx / d) * k;
   input.moveZ = (dz / d) * k;
}

/** Walk towards tile `goal` (a hop up when the next tile is higher). Returns false when no path. */
function walkTo(bot: FactoryBot, run: FactoryRun, input: StepInput, goal: number, avoidPlates = true): boolean {
   const n = nextTile(run, goal, avoidPlates);
   if (n === NONE) return false;
   const h = run.hero;
   const nc = n % W;
   const nr = Math.floor(n / W);
   const top = standable(run, n);
   steer(run, input, tileX(nc), tileZ(nr), n === goal);
   if (top > h.y + 0.3 && h.grounded && run.simMs > bot.jumpAt + 300) {
      const near = Math.max(Math.abs(tileX(nc) - h.x), Math.abs(tileZ(nr) - h.z));
      if (near < 1 + HERO_R + 0.5) {
         input.jumpPressed = true;
         input.jumpHeld = true;
         bot.jumpAt = run.simMs;
      }
   }
   return true;
}

function nearestOf(run: FactoryRun, tiles: number[]): number {
   const h = run.hero;
   let best = NONE;
   let bd = Infinity;
   for (const i of tiles) {
      const d = Math.hypot(tileX(i % W) - h.x, tileZ(Math.floor(i / W)) - h.z);
      if (d < bd) {
         bd = d;
         best = i;
      }
   }
   return best;
}

export function botInput(bot: FactoryBot, run: FactoryRun, input: StepInput): void {
   input.moveX = 0;
   input.moveZ = 0;
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   const f = run.floor;
   const h = run.hero;
   const ms = run.simMs;
   // (re)plan the plates whenever the wiring is off and the list is empty (M-8 punches tables)
   if (bot.todo.length === 0 && ms - bot.lastPlanMs > 250) {
      bot.lastPlanMs = ms;
      const plan = !bot.planned && f.spec.botPlates ? f.spec.botPlates.slice() : platePlan(run);
      bot.planned = true;
      // nearest plate first (the same plate's repeats stay together)
      bot.todo = plan;
   }
   const here = at(colOf(h.x), rowOf(h.z));
   if (run.events.plate >= 0 && bot.todo.length > 0 && run.events.plate === bot.todo[0]) {
      bot.todo.shift();
      // step off to a free tile beside the plate (the plate needs a moment to reset)
      bot.stepOff = NONE;
      const c = here % W;
      const r = Math.floor(here / W);
      for (let d = 0; d < 4 && bot.stepOff === NONE; d++) {
         const nc = c + DC[d];
         const nr = r + DR[d];
         if (!inside(nc, nr)) continue;
         const j = at(nc, nr);
         if (standable(run, j) === 0 && !blockedNow(run, nc, nr) && f.tiles[j].k !== K.Plate) bot.stepOff = j;
      }
      bot.offUntil = run.board.plateReadyAt[run.events.plate];
   }
   if (bot.stepOff !== NONE) {
      const oc = bot.stepOff % W;
      const or = Math.floor(bot.stepOff / W);
      if (Math.hypot(tileX(oc) - h.x, tileZ(or) - h.z) > 0.3 || ms < bot.offUntil) {
         steer(run, input, tileX(oc), tileZ(or), true);
         return;
      }
      bot.stepOff = NONE;
   }
   if (bot.todo.length > 0) {
      const p = bot.todo[0];
      const [pc, pr] = f.plateAt[p];
      walkTo(bot, run, input, at(pc, pr), true);
      return;
   }
   if (run.boss) return bossFrame(bot, run, input);
   // floor orbs (the main ones) while the cells ride, then the exit
   const open = run.board.charged >= f.spec.cells;
   const orbTiles: number[] = [];
   f.spec.orbs.forEach((o, i) => {
      if (run.collected[i] || o.hero !== null || o.y > 1.2) return;
      orbTiles.push(at(colOf(o.x), rowOf(o.z)));
   });
   void open;
   if (orbTiles.length > 0) {
      const t = nearestOf(run, orbTiles);
      if (walkTo(bot, run, input, t)) return;
   }
   const [ec, er] = f.exit;
   walkTo(bot, run, input, at(ec, er), true);
}

function bossFrame(bot: FactoryBot, run: FactoryRun, input: StepInput): void {
   const f = run.floor;
   const b = run.boss!;
   const h = run.hero;
   const spec = f.spec.boss!;
   if (b.phase === 1) {
      // reverse the lane once M-8 walks it (one press per drag)
      if (!run.board.laneReversed) {
         const p = f.spec.plates.findIndex((pl) => pl.bossLane);
         const [pc, pr] = f.plateAt[p];
         walkTo(bot, run, input, at(pc, pr), true);
         return;
      }
   }
   if (b.phase === 2) {
      // up to the catwalk beside a vent, then jump and roll-drop on it while it is open
      const [vx, , vz] = spec.vents[0];
      const goal = at(colOf(vx), rowOf(vz));
      const there = at(colOf(h.x), rowOf(h.z)) === goal && h.y > 2;
      if (!there) {
         walkTo(bot, run, input, goal, true);
         return;
      }
      steer(run, input, vx, vz, true);
      if (b.step === "vulnerable" && h.grounded && Math.hypot(h.x - vx, h.z - vz) < 0.4) {
         input.jumpPressed = true;
         input.jumpHeld = true;
         bot.jumpAt = run.simMs;
      } else if (!h.grounded && h.vy < 2 && run.simMs - bot.jumpAt > 120) {
         input.jumpPressed = true;
         input.jumpHeld = true;
      }
      return;
   }
   // P1: a junction knocked off the line (jammed for now): wait beside its plate to put it right
   if (b.phase === 0) {
      for (let i = 0; i < f.spec.route.length; i++) {
         if (run.board.turns[i] === f.spec.route[i]) continue;
         const p = f.spec.plates.findIndex((pl) => pl.turns.length === 1 && pl.turns[0] === i);
         const [pc, pr] = f.plateAt[p];
         const c = pc + (pc < 5 ? 1 : -1);
         walkTo(bot, run, input, at(c, pr), true);
         return;
      }
   }
   // P1 (and between): orbs on the floor, else wait near the lane plate
   const orbTiles: number[] = [];
   f.spec.orbs.forEach((o, i) => {
      if (run.collected[i] || o.hero !== null) return;
      const top = o.y > 2 ? 2.2 : 0;
      if (o.y - top > 1.2) return;
      orbTiles.push(at(colOf(o.x), rowOf(o.z)));
   });
   if (orbTiles.length > 0) {
      const t = nearestOf(run, orbTiles);
      if (walkTo(bot, run, input, t)) return;
   }
   const p = f.spec.plates.findIndex((pl) => pl.bossLane);
   const [pc, pr] = f.plateAt[p];
   walkTo(bot, run, input, at(pc + 1, pr), true);
}

export { type Dir };
