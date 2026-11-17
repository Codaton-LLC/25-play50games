// The honest bot (proof.test.ts, `?autoplay=1` in preview builds): it plays through StepInput only,
// like a player at camera yaw 0. During a call it routes over the solid tiles (a breadth-first search,
// round the holes) to the best safe tile it can reach in time: the Keeper's beacon, the orb's tile,
// the rainbow tile, else the nearest of the called colour. It stops on it to lock in, jumps the sweeper
// bar and the Keeper's shock ring, and fires its power where it helps (Riko dashes along a clear
// straight, Zuno pulls the orb, Kiro shields against a knock).
import { heroById } from "./heroes";
import { SHOCK_SPEED } from "./progression";
import { BAR_HALF, BAR_INNER, BODY_R, TILE_P, V_RUN, tileAt, tileCentre, tileSafe, tileSolid, wrapPi, type ArenaRun, type StepInput } from "./rules";

export interface Bot {
   /** the frame length the bot plans with (ms) */
   frameMs: number;
   target: number;
   /** BFS scratch: steps from the hero's tile, the previous tile on the route */
   dist: Int16Array;
   prev: Int16Array;
   queue: Int16Array;
}

export function createBot(run: ArenaRun, frameMs = 1000 / 60): Bot {
   const n = run.arena.n * run.arena.n;
   return { frameMs, target: -1, dist: new Int16Array(n), prev: new Int16Array(n), queue: new Int16Array(n) };
}

const c = { x: 0, z: 0 };

/** Breadth-first steps over the solid tiles from the hero's tile (-1 = unreachable on foot). */
function route(bot: Bot, run: ArenaRun): void {
   const a = run.arena;
   const n = a.n;
   bot.dist.fill(-1);
   bot.prev.fill(-1);
   const start = tileAt(a, run.hero.x, run.hero.z);
   if (start < 0) return;
   let head = 0;
   let tail = 0;
   bot.dist[start] = 0;
   bot.queue[tail++] = start;
   while (head < tail) {
      const i = bot.queue[head++];
      const col = i % n;
      const row = Math.floor(i / n);
      for (let k = 0; k < 4; k++) {
         const cc = col + (k === 0 ? 1 : k === 1 ? -1 : 0);
         const rr = row + (k === 2 ? 1 : k === 3 ? -1 : 0);
         if (cc < 0 || rr < 0 || cc >= n || rr >= n) continue;
         const j = rr * n + cc;
         if (bot.dist[j] >= 0 || !tileSolid(a, j)) continue;
         bot.dist[j] = bot.dist[i] + 1;
         bot.prev[j] = i;
         bot.queue[tail++] = j;
      }
   }
}

/** Seconds to walk to tile i along the route (Infinity when no route). */
function reachS(bot: Bot, run: ArenaRun, i: number): number {
   const d = bot.dist[i];
   if (d < 0) return Infinity;
   tileCentre(run.arena, i, c);
   const straight = Math.hypot(c.x - run.hero.x, c.z - run.hero.z);
   // a clear straight is run straight; round holes, the grid steps (cut a little for the diagonals)
   return (clearLine(run, c.x, c.z) ? straight : Math.max(straight, d * TILE_P * 0.85)) / V_RUN + 0.15;
}

function pickTarget(bot: Bot, run: ArenaRun): number {
   const a = run.arena;
   const left = (a.callLen - a.phaseMs) / 1000 - 0.45;
   const ok = (i: number): boolean => i >= 0 && tileSafe(a, i) && (a.swapDone || !a.swapTiles.includes(i));
   // a target already on the way is kept while it can still be made (no margin)
   const inTime = (i: number): boolean => ok(i) && reachS(bot, run, i) <= left + (i === bot.target ? 0.4 : 0);
   if (a.beaconTile >= 0 && inTime(a.beaconTile)) return a.beaconTile;
   if (a.orbLive && inTime(a.orbTile)) return a.orbTile;
   if (a.rainbowTile >= 0 && inTime(a.rainbowTile)) return a.rainbowTile;
   let best = -1;
   let bd = Infinity;
   for (let i = 0; i < a.colour.length; i++) {
      if (!ok(i)) continue;
      const d = reachS(bot, run, i);
      if (d < bd) {
         bd = d;
         best = i;
      }
   }
   return best;
}

/** Solid floor all along the straight from the hero to (x, z). */
function clearLine(run: ArenaRun, x: number, z: number): boolean {
   const h = run.hero;
   const dx = x - h.x;
   const dz = z - h.z;
   const len = Math.hypot(dx, dz);
   if (len < 1e-6) return true;
   for (let s = 0.3; s <= len; s += 0.3) {
      const t = tileAt(run.arena, h.x + (dx / len) * s, h.z + (dz / len) * s);
      if (t < 0 || !tileSolid(run.arena, t)) return false;
   }
   return true;
}

/** The point to head for now: the farthest tile on the route the hero sees in a clear straight line. */
function waypoint(bot: Bot, run: ArenaRun, target: number, out: { x: number; z: number }): void {
   let i = target;
   let pick = target;
   let found = false;
   for (let guard = 0; guard < 128 && i >= 0; guard++) {
      tileCentre(run.arena, i, out);
      if (!found && clearLine(run, out.x, out.z)) {
         pick = i;
         found = true;
      }
      i = bot.prev[i];
   }
   tileCentre(run.arena, pick, out);
}

function steer(input: StepInput, h: { x: number; z: number }, x: number, z: number, d: number): void {
   const dx = x - h.x;
   const dz = z - h.z;
   const dw = Math.hypot(dx, dz) || 1;
   const k = Math.min(1, d / 1.1) / dw;
   input.moveX = dx * k;
   input.moveZ = dz * k;
}

export function botInput(bot: Bot, run: ArenaRun, input: StepInput): void {
   input.moveX = 0;
   input.moveZ = 0;
   input.yaw = 0;
   input.jumpPressed = false;
   input.actionPressed = false;
   const a = run.arena;
   const h = run.hero;
   if (h.state !== "play" || run.ended !== null) return;
   const power = heroById(run.heroId).power;
   const ready = run.simMs >= run.powerReadyAt;

   route(bot, run);
   if (a.phase === "call") bot.target = pickTarget(bot, run);
   else if (a.phase === "start" || a.phase === "wait") bot.target = -1;
   // in a drop or a rise the bot holds its tile (the beacon's window is the rise)

   // the sweeper bar's face reaching the hero (s, the hero held still), Infinity when it does not
   const w = a.cfg.sweeper;
   let barIn = Infinity;
   if (w > 0 && a.phase !== "start") {
      const r = Math.hypot(h.x, h.z);
      if (r >= BAR_INNER - 0.4 && r < a.half + 0.6) {
         // the face reaches the hero when r sin(diff) = BAR_HALF + BODY_R
         const diff = wrapPi(Math.atan2(h.z, h.x) - a.sweepAngle);
         const touch = Math.asin(Math.min(1, (BAR_HALF + BODY_R) / Math.max(r, 1e-3)));
         if (diff > touch && diff < Math.PI / 2 + touch) barIn = (diff - touch) / w;
      }
   }

   if (!h.grounded) {
      // in the air the bot lets go of the stick: it only jumps from a standstill, so it lands where it rose
   } else if (bot.target >= 0) {
      tileCentre(a, bot.target, c);
      const tx = c.x;
      const tz = c.z;
      const d = Math.hypot(tx - h.x, tz - h.z);
      if (d > 0.12) {
         // the first tile back from the target that the hero sees in a clear line (round the holes)
         if (h.grounded && bot.dist[bot.target] > 0) waypoint(bot, run, bot.target, c);
         else {
            c.x = tx;
            c.z = tz;
         }
         steer(input, h, c.x, c.z, d);
         // Riko dashes along a clear straight that ends well short of the target
         if (power === "dash" && ready && h.grounded && a.phase === "call" && d > 6 && clearLine(run, tx, tz)) input.actionPressed = true;
      }
   }
   if (power === "magnet" && ready && a.orbLive && a.orbTile >= 0) {
      tileCentre(a, a.orbTile, c);
      if (Math.hypot(c.x - h.x, c.z - h.z) < 5.5) input.actionPressed = true;
   }

   // the sweeper bar: hold still as its face comes (so the timing is sure), then jump it
   if (h.grounded && barIn < 0.5) {
      input.moveX = 0;
      input.moveZ = 0;
      if (barIn < 0.2) {
         if (power === "shield" && ready) input.actionPressed = true;
         else input.jumpPressed = true;
      }
   }
   // the Keeper's shock ring: jump as it reaches you
   const boss = a.boss;
   if (boss && boss.phase === 1 && h.grounded) {
      const d = Math.hypot(h.x, h.z);
      const lead = a.phase === "drop" && a.shockR >= 0 ? d - a.shockR : a.phase === "call" && a.callLen - a.phaseMs < 120 ? d : Infinity;
      if (lead > -0.2 && lead < SHOCK_SPEED * 0.22) {
         if (power === "shield" && ready) input.actionPressed = true;
         else input.jumpPressed = true;
      }
   }
}
