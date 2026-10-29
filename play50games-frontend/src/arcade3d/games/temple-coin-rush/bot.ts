// The honest bot (tests, `?autoplay=1` on preview builds): it plays the way a player does. At each
// gate it weighs the lanes it can see (a toll lane's coins less its price, its boost and its relic
// orb, only when the purse can pay; a slow lane's coins; Riko's cracked wall and Vexa's ghost gate
// when the power is ready), takes that lane early (level 4's surge punishes hesitation) and keeps it.
// Between gates it steers for the coins ahead, jumps blocks, spikes and broken tiles, rolls under
// beams, steps out of fire jets (Kiro shields through them instead), dodges the side-ramp boulders,
// uses Zuno's magnet at the veins and Nami's double jump at the ledges, and on level 5 leaves the
// lunge's lane, jumps and rolls the coils and pays every bell and bowl. With `mash` it also presses
// the power every frame (tests). Pure: it only reads the run and writes the step input.
import { heroById } from "./heroes";
import {
   ARENA,
   BLOCK_CLEAR,
   COIN,
   CROSS,
   GATE,
   HAZ,
   LANES,
   LANE_V,
   LANE_W,
   NONE,
   SLOW_FACTOR,
   TIER,
   arenaToll,
   bossAlive,
   createStepInput,
   crossX,
   laneX,
   priceOf,
   spikeUp,
   type TempleRun,
   type StepInput,
} from "./rules";

export interface TempleBot {
   frameMs: number;
   mash: boolean;
   /** the lane picked for each gate (NONE: not yet) */
   plan: Int8Array;
   lastPress: number;
   lastJump: number;
   lastRoll: number;
}

export function createBot(run: TempleRun, frameMs = 1000 / 60): TempleBot {
   return { frameMs, mash: false, plan: new Int8Array(run.course.gates.length).fill(NONE), lastPress: -1e9, lastJump: -1e9, lastRoll: -1e9 };
}

/** The bot decides a gate's lane this far before it (m). */
const DECIDE = 34;

function powerReadyBy(run: TempleRun, inMs: number): boolean {
   return run.simMs + inMs >= run.powerReadyAt;
}

/** How a lane at gate g is worth to the bot (points-ish), or -Infinity when it cannot take it. */
export function laneValue(run: TempleRun, g: number, l: number): number {
   const c = run.course;
   const gate = c.gates[g];
   const r = gate.lanes[l];
   const hero = heroById(run.heroId).power;
   const len = gate.z - gate.z1;
   let coins = 0;
   for (const i of c.laneCoins[g * LANES + l]) coins += c.coins[i].value;
   if (hero === "doubleJump" && r.tier === TIER.slow) for (const q of c.coins) if (q.gate === g && q.lane === l && q.y > 2) coins += q.value;
   const v = c.speed;
   const relic = c.orbs.some((o, i) => o.gate === g && Math.round(o.x / LANE_W + 1) === l && !(run.orbMask & (1 << i))) ? 40 : 0;
   const toll = (net: number, boost: number) => 2 * net + ((len / v - len / (v + boost)) * 10 + (len / (v * SLOW_FACTOR) - len / v) * 10) + 6 + relic;
   let best = -Infinity;
   if (r.tier === TIER.slow) best = 2 * coins;
   else if (run.purse.coins >= priceOf(run, g, l)) best = toll(coins - priceOf(run, g, l), r.boost);
   if (hero === "dash" && l === gate.cracked && powerReadyBy(run, 3000)) {
      let free = -Infinity;
      for (let q = 0; q < LANES; q++) {
         if (gate.lanes[q].tier === TIER.slow) continue;
         let n = 0;
         for (const i of c.laneCoins[g * LANES + q]) n += c.coins[i].value;
         free = Math.max(free, toll(n, gate.lanes[q].boost));
      }
      best = Math.max(best, free + 1);
   }
   if (hero === "phase" && l === gate.ghost && powerReadyBy(run, 3000)) {
      let n = 0;
      for (const q of c.coins) if (q.gate === g && q.lane === l && q.need === 2) n += q.value;
      best = Math.max(best, 2 * n + 30);
   }
   return best;
}

function planGate(run: TempleRun, bot: TempleBot, g: number): number {
   if (bot.plan[g] !== NONE) return bot.plan[g];
   let best = 1;
   let bestV = -Infinity;
   for (let l = 0; l < LANES; l++) {
      const v = laneValue(run, g, l) - Math.abs(l - run.hero.lane) * 0.5;
      if (v > bestV) {
         bestV = v;
         best = l;
      }
   }
   bot.plan[g] = best;
   return best;
}

/** Is lane l blocked ahead within `range` m for this bot (a jet it cannot shield, a side boulder about to cross it)? */
function laneDanger(run: TempleRun, l: number, range: number): boolean {
   const h = run.hero;
   const c = run.course;
   const v = Math.max(1, h.v || c.speed);
   const kiro = heroById(run.heroId).power === "shield";
   for (const hz of c.hazards) {
      if (hz.gate !== NONE || hz.lane !== l) continue;
      const d = h.z - hz.z;
      if (d < -1.5 || d > range) continue;
      if (hz.kind === HAZ.jet && !(kiro && (run.simMs < h.shieldUntil || powerReadyBy(run, (d / v) * 1000 - 300)))) return true;
   }
   for (let i = 0; i < c.crosses.length; i++) {
      const cr = c.crosses[i];
      const d = h.z - cr.z;
      if (d < -1 || d > range) continue;
      const t = (d / v) * 1000;
      const start = run.crossStart[i] >= 0 ? run.crossStart[i] : run.simMs + Math.max(0, ((d - CROSS.lead) / v) * 1000);
      const at = run.simMs + t;
      const bx = cr.side * CROSS.start - (cr.side * CROSS.vx * (at - start)) / 1000;
      if (Math.abs(bx - laneX(l)) < CROSS.r + 0.6 && Math.abs(bx) <= CROSS.start) return true;
   }
   const bh = run.hazard;
   if (bh.live && bh.kind === 0 && bh.lane === l) return true;
   return false;
}

/** The lane the bot wants now. */
export function botTargetLane(run: TempleRun, bot: TempleBot): number {
   const h = run.hero;
   const c = run.course;
   if (h.route !== NONE) return h.lane;
   const g = run.nextGate;
   const gateGap = g < c.gates.length ? h.z - c.gates[g].z : Infinity;
   if (gateGap < DECIDE) return planGate(run, bot, g);
   // level 5: the bell gate's middle lane when the purse can pay; any lane for the bowls
   if (run.bossOn && bossAlive(run)) {
      for (let s = run.arenaMet; s < run.arenaSpawned; s++) {
         const d = h.z - run.arenaZ[s];
         if (d < 0) continue;
         if (d > 14) break;
         const t = arenaToll(run, s);
         if (!t.bowls && run.purse.coins >= t.price && !laneDanger(run, 1, 10)) return 1;
      }
   }
   // coins ahead (the nearest reachable one), else stay
   let lane = h.lane;
   let best = Infinity;
   const zuno = heroById(run.heroId).power === "magnet";
   for (let i = 0; i < c.coins.length; i++) {
      if (run.collected[i]) continue;
      const o = c.coins[i];
      if (o.gate !== NONE || o.need !== 0) continue;
      const d = h.z - o.z;
      if (d < 0.5 || d > 16 || d >= best) continue;
      if (o.y > 2.1) continue;
      const ol = Math.round(o.x / LANE_W + 1);
      if (ol < 0 || ol >= LANES) continue;
      if (laneDanger(run, ol, Math.min(d + 2, 14))) continue;
      best = d;
      lane = ol;
   }
   if (run.bossOn && bossAlive(run)) {
      for (let s = run.arenaMet; s < run.arenaSpawned; s++) {
         const z0 = run.arenaZ[s] + 32;
         const d = h.z - z0;
         if (d > 16) break;
         if (d < -16) continue;
         if (run.arenaTaken[s] !== (1 << ARENA.coins) - 1) {
            const ol = s % LANES;
            if (!laneDanger(run, ol, 12)) lane = ol;
         }
      }
   }
   void zuno;
   if (laneDanger(run, lane, 12)) {
      for (const alt of [lane - 1, lane + 1, lane - 2, lane + 2]) {
         if (alt >= 0 && alt < LANES && !laneDanger(run, alt, 12)) return alt;
      }
   }
   return lane;
}

export function botInput(bot: TempleBot, run: TempleRun, out: StepInput = createStepInput()): StepInput {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   out.left = false;
   out.right = false;
   out.up = false;
   out.down = false;
   out.jumpPressed = false;
   out.actionPressed = bot.mash;
   out.yaw = 0;
   if (run.ended !== null) return out;
   const v = Math.max(1, h.v || c.speed);
   const lead = (bot.frameMs / 1000) * v;
   const power = heroById(run.heroId).power;
   // lanes
   if (h.route === NONE && ms - bot.lastPress >= 70) {
      const want = botTargetLane(run, bot);
      if (want !== h.lane && Math.abs(h.x - laneX(h.lane)) < LANE_W * 0.6 + (LANE_V * bot.frameMs) / 1000) {
         if (want > h.lane) out.right = true;
         else out.left = true;
         bot.lastPress = ms;
      }
   }
   const myLane = (l: number) => l === NONE || Math.abs(h.x - laneX(l)) < LANE_W * 0.5;
   const ahead = (z: number, t: number) => {
      const d = h.z - z - lead;
      return d > 0 && d < v * t;
   };
   let jump = false;
   let roll = false;
   for (let i = 0; i < c.hazards.length; i++) {
      const hz = c.hazards[i];
      if (!myLane(hz.lane)) continue;
      if (hz.gate !== NONE && !(h.route === hz.gate && h.routeKind !== GATE.ghost)) continue;
      if (hz.kind === HAZ.block && ahead(hz.z, 0.3)) jump = true;
      else if (hz.kind === HAZ.beam && ahead(hz.z, 0.25)) roll = true;
      else if (hz.kind === HAZ.spike && ahead(hz.z, 0.3)) {
         const at = ms + ((h.z - hz.z) / v) * 1000;
         if (spikeUp(hz, at) || spikeUp(hz, at - 150) || spikeUp(hz, at + 150)) jump = true;
      } else if (hz.kind === HAZ.broken && ahead(hz.z, 0.28)) jump = true;
   }
   const bh = run.hazard;
   if (bh.live && bh.kind !== 0 && ahead(bh.z, 0.3)) {
      if (bh.kind === 1) jump = true;
      else roll = true;
   }
   // Nami: the ledge coins over a slow lane
   let ledge = false;
   if (power === "doubleJump" && h.route !== NONE) {
      for (let i = 0; i < c.coins.length; i++) {
         const o = c.coins[i];
         if (run.collected[i] || o.gate !== h.route || o.lane !== h.lane || o.y < 2) continue;
         const d = h.z - o.z;
         if (d > 0 && d < v * 0.75) ledge = true;
      }
      if (ledge) jump = true;
   }
   if (jump && h.grounded && h.y < BLOCK_CLEAR && ms - bot.lastJump > 250 && ms >= h.rollUntil) {
      out.jumpPressed = true;
      bot.lastJump = ms;
   }
   if (roll && ms - bot.lastRoll > 500 && ms >= h.rollUntil) {
      out.down = true;
      bot.lastRoll = ms;
   }
   // the powers
   const ready = ms >= run.powerReadyAt;
   if (ready) {
      const g = run.nextGate;
      const gate = g < c.gates.length ? c.gates[g] : null;
      const gd = gate ? h.z - gate.z : Infinity;
      if (power === "doubleJump" && ledge && !h.grounded && h.vy < 2 && h.airJump) out.actionPressed = true;
      if (power === "dash" && gate && h.lane === gate.cracked && gd > 0 && gd < v * 0.3) out.actionPressed = true;
      if (power === "phase" && gate && h.lane === gate.ghost && gd > 0 && gd < v * 0.6) out.actionPressed = true;
      if (power === "magnet") {
         for (let i = 0; i < c.coins.length; i++) {
            const o = c.coins[i];
            if (run.collected[i] || o.need !== 1) continue;
            const d = h.z - o.z;
            if (d > 0 && d < 6) out.actionPressed = true;
         }
      }
      if (power === "shield") {
         for (const hz of c.hazards) {
            if (hz.kind !== HAZ.jet || !myLane(hz.lane)) continue;
            if (ahead(hz.z, 0.4)) out.actionPressed = true;
         }
         if (bh.live && bh.kind === 0 && myLane(bh.lane)) out.actionPressed = true;
      }
   }
   void COIN;
   return out;
}
