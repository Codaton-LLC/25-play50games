// The honest bot (tests, `?autoplay=1` on preview builds): it plays the way a player does. It reads the
// lit switch and decides the branch (an orb branch or a shortcut yes, a dead end no, a hero gate only with
// that hero's power ready), and on level 4 first throws a switch to send a toy train ahead of it into a
// dead end, then throws it back for itself. A frozen switch gets a jump-stomp. It hops for the orbs and
// rings ahead, jumps the gaps, crouches downhill, keeps out of icicle tunnels and long gaps it cannot
// take, and uses each hero's power at its gate. On level 5 it routes the Express into the buffers,
// dodges the wagons, takes the rings and ramps, and stomps the key between the steam puffs. With
// `mash` it also presses the power every frame (tests). Pure: it only reads the run and writes the input.
import { heroById } from "./heroes";
import {
   BRANCH,
   END,
   GRID,
   HAZ,
   LANE_V,
   LANE_W,
   NONE,
   arenaLane,
   bossAlive,
   bossPhase,
   createStepInput,
   laneX,
   litArenaSwitch,
   litSwitch,
   onSlope,
   pieceAt,
   type RailRun,
   type StepInput,
} from "./rules";

export interface RailBot {
   frameMs: number;
   mash: boolean;
   lastPress: number;
   lastJump: number;
   lastSwitch: number;
}

export function createBot(_run: RailRun, frameMs = 1000 / 60): RailBot {
   return { frameMs, mash: false, lastPress: -1e9, lastJump: -1e9, lastSwitch: -1e9 };
}

const ready = (run: RailRun, inMs = 0) => run.simMs + inMs >= run.powerReadyAt;

/** Does the bot want this switch's branch for itself? */
export function wantsBranch(run: RailRun, j: number): boolean {
   const c = run.course;
   const p = c.pieces[c.junctions[j].piece];
   const power = heroById(run.heroId).power;
   switch (p.branch) {
      case BRANCH.orb:
      case BRANCH.fast:

         return true;
      case BRANCH.barrier:
         return power === "dash" && ready(run, 1200);
      case BRANCH.ghost:
         return power === "phase" && ready(run, 1200);
      default:
         return false;
   }
}

/** The state the bot wants a switch in now: a train ahead about to pass it gets sent into a dead end first. */
function desired(run: RailRun, j: number): boolean {
   const c = run.course;
   const jd = c.junctions[j];
   const p = c.pieces[jd.piece];
   for (const t of run.trains) {
      if (!t.live || t.lane !== jd.lane || t.z < jd.z) continue;
      if (run.hero.z <= t.z) continue;
      // the train reaches the switch before the hero: into the dead end with it
      if (p.end === END.buffer) return true;
   }
   return wantsBranch(run, j);
}

/** Is lane l bad ahead within `range` m (an icicle tunnel it cannot shield, a gap too long, a train)? */
function laneBad(run: RailRun, l: number, range: number): boolean {
   const h = run.hero;
   const c = run.course;
   if (l < 0 || l >= GRID || !pieceAt(c, l, 0, h.z, true)) return true;
   const power = heroById(run.heroId).power;
   for (const hz of c.hazards) {
      if (hz.kind !== HAZ.icicles || hz.lane !== l) continue;
      if (h.z - hz.z0 > range || h.z < hz.z1) continue;
      if (power === "shield" && (run.simMs < h.shieldUntil || ready(run))) continue;
      return true;
   }
   // a gap on this lane too long to jump (Riko's broken rail), unless Riko
   const p = pieceAt(c, l, 0, h.z, true);
   if (p && p.end === END.gap && h.z - p.z1 < range) {
      const next = pieceAt(c, l, 0, p.z1 - 10.5);
      if (!next && power !== "dash") return true;
   }
   for (const t of run.trains) {
      if (t.live && t.lane === l && h.z - t.z > -1 && h.z - t.z < range + 10) return true;
   }
   const w = run.wagon;
   if (w.live && w.lane === l && h.z - w.z > -2 && h.z - w.z < 40) return true;
   return false;
}

/** The lane the bot wants now (between switches). */
export function botTargetLane(run: RailRun): number {
   const h = run.hero;
   const c = run.course;
   const cur = h.piece !== NONE ? c.pieces[h.piece] : null;
   if (cur && cur.side !== 0) return h.lane;
   let lane = h.lane;
   let best = Infinity;
   const zuno = heroById(run.heroId).power === "magnet";
   // a switch it wants on another rail, in reach
   let jLane = NONE;
   let jD = Infinity;
   for (const j of c.junctions) {
      const d = h.z - j.z;
      if (d < 3) continue;
      if (d > 28) break;
      if (run.junctionResult[j.index] !== 0) continue;
      if (wantsBranch(run, j.index) && !laneBad(run, j.lane, 20)) {
         jLane = j.lane;
         jD = d;
      }
      break;
   }
   {
      // orbs and rings ahead on the grid (main orbs first)
      for (let i = 0; i < c.orbs.length; i++) {
         const o = c.orbs[i];
         if (run.collected[i] || o.lane < 0 || o.lane >= GRID || o.piece !== NONE || o.hidden) continue;
         const d = (h.z - o.z) * (o.kind === "main" ? 1 : 1.6);
         if (h.z - o.z < 1 || d > 22 || d >= best) continue;
         if (o.y > 2.5 && heroById(run.heroId).power !== "doubleJump") continue;
         if (laneBad(run, o.lane, d + 3)) continue;
         best = d;
         lane = o.lane;
      }
      for (let i = 0; i < c.rings.length; i++) {
         const r = c.rings[i];
         if (run.ringsHit[i] || r.lane >= GRID) continue;
         const d = (h.z - r.z) * 1.4;
         if (h.z - r.z < 1 || d > 20 || d >= best) continue;
         if (laneBad(run, r.lane, d + 3)) continue;
         best = d;
         lane = r.lane;
      }
      // the wanted switch wins unless an orb comes well before it
      if (jLane !== NONE && !(best < jD - 9)) lane = jLane;
      if (jLane === NONE) {
         // Zuno: his loop's lane
         if (zuno) for (const lp of c.loops) if (h.z - lp.z0 > 0 && h.z - lp.z0 < 30 && !laneBad(run, lp.lane, 30)) lane = lp.lane;
         // Nami: a high rail ahead
         if (heroById(run.heroId).power === "doubleJump") {
            for (let l = 0; l < GRID; l++) {
               const top = pieceAt(c, l, 1, h.z - 12);
               if (top && h.z - top.z0 > 0 && h.z - top.z0 < 25 && !laneBad(run, l, 25)) lane = l;
            }
         }
      }
   }
   // level 5: the arena's rings and ramps
   if (run.bossOn && bossAlive(run)) {
      const ph = bossPhase(run);
      if (ph >= 1) {
         for (let s = 0; s < run.arenaSpawned; s++) {
            const d = h.z - run.arenaZ[s];
            if (d < 1) continue;
            if (d > 40) break;
            if (run.arenaTaken[s] || run.arenaPhase[s] === 0) continue;
            if (!laneBad(run, arenaLane(s), d)) lane = arenaLane(s);
            break;
         }
      }
   }
   if (laneBad(run, lane, 18)) {
      for (const alt of [lane - 1, lane + 1, lane - 2, lane + 2]) if (!laneBad(run, alt, 18)) return alt;
   }
   return lane;
}

export function botInput(bot: RailBot, run: RailRun, out: StepInput = createStepInput()): StepInput {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   out.left = false;
   out.right = false;
   out.up = false;
   out.down = false;
   out.jumpPressed = false;
   out.actionPressed = bot.mash;
   out.switchPressed = false;
   out.yaw = 0;
   if (run.ended !== null || ms < h.bonkUntil || ms < h.hookUntil) return out;
   const v = Math.max(1, h.v || c.speed);
   const lead = (bot.frameMs / 1000) * v;
   const power = heroById(run.heroId).power;
   // the switches
   if (ms - bot.lastSwitch > 120) {
      const a = litArenaSwitch(run);
      if (a !== NONE && !run.arenaThrown[a]) {
         out.switchPressed = true;
         bot.lastSwitch = ms;
      } else {
         const j = litSwitch(run);
         if (j !== NONE && !!run.board.thrown[j] !== desired(run, j)) {
            const jd = c.junctions[j];
            if (jd.frozen) {
               // a frozen switch: jump, then stomp it in the air
               if (h.grounded && ms - bot.lastJump > 300 && h.z - jd.z < v * 0.9) {
                  out.jumpPressed = true;
                  bot.lastJump = ms;
               } else if (!h.grounded && h.vy < 3) {
                  out.switchPressed = true;
                  bot.lastSwitch = ms;
               }
            } else {
               out.switchPressed = true;
               bot.lastSwitch = ms;
            }
         }
      }
   }
   // lanes
   if (h.grounded && !h.roof && ms - bot.lastPress >= 90) {
      const want = botTargetLane(run);
      if (want !== h.lane && Math.abs(h.x - laneX(h.lane)) < LANE_W * 0.6 + (LANE_V * bot.frameMs) / 1000) {
         if (want > h.lane) out.right = true;
         else out.left = true;
         bot.lastPress = ms;
      }
   }
   // jumps: a gap ahead on its rail, a ring over a gap, Nami's high rail, the wagons, the roof stomps
   let jump = false;
   const p = h.piece !== NONE ? c.pieces[h.piece] : null;
   if (h.grounded && p && p.end === END.gap) {
      const d = h.z - p.z1 - lead;
      if (d > 0 && d < v * 0.12) jump = true;
   }
   if (power === "doubleJump" && h.grounded && !h.roof) {
      const top = pieceAt(c, h.lane, 1, h.z - v * 0.5);
      if (top && h.z - top.z0 < v * 0.5 && h.z > top.z0) jump = true;
   }
   const w = run.wagon;
   if (w.live && w.lane === h.lane && h.z - w.z > 0 && h.z - w.z < v * 0.35 + 3) jump = true;
   if (h.roof && run.boss) {
      const b = run.boss;
      // stomp while it is open; be in the air when the steam comes
      if (b.step === "vulnerable" || b.step === "telegraph") jump = true;
   }
   if (jump && h.grounded && ms - bot.lastJump > 200) {
      out.jumpPressed = true;
      bot.lastJump = ms;
   }
   // crouch downhill
   if (h.grounded && onSlope(c, h.z) && !(ms < h.crouchUntil - 200) && !(p && p.frozen)) out.down = true;
   // the powers
   if (ready(run) && !bot.mash) {
      if (power === "doubleJump" && !h.grounded && h.vy < 1 && h.airJump && pieceAt(c, h.lane, 1, h.z - 2)) out.actionPressed = true;
      if (power === "dash" && !h.grounded && h.vy < 2 && !pieceAt(c, h.lane, 0, h.z - 4)) out.actionPressed = true;
      if (power === "dash" && p && p.side !== 0) for (const hz of c.hazards) if (hz.piece === p.index && hz.kind === HAZ.barrier && h.z - hz.z0 > 0 && h.z - hz.z0 < v * 0.3) out.actionPressed = true;
      if (power === "phase" && p && p.side !== 0) for (const hz of c.hazards) if (hz.piece === p.index && hz.kind === HAZ.ghost && h.z - hz.z0 > 0 && h.z - hz.z0 < v * 0.4) out.actionPressed = true;
      if (power === "shield") for (const hz of c.hazards) if (hz.kind === HAZ.icicles && hz.lane === h.lane && h.z - hz.z0 > 0 && h.z - hz.z0 < v * 0.4) out.actionPressed = true;
      if (power === "magnet") {
         for (const lp of c.loops) if (lp.lane === h.lane && h.z - lp.z0 > 0 && h.z - lp.z0 < v * 0.5) out.actionPressed = true;
         for (let i = 0; i < c.orbs.length; i++) {
            const o = c.orbs[i];
            if (!o.hidden || run.collected[i]) continue;
            const d = h.z - o.z;
            if (d > 0 && d < 5) out.actionPressed = true;
         }
      }
      // the Action press throws a lit switch first: never fire the power then
      if (out.actionPressed && (litSwitch(run) !== NONE || litArenaSwitch(run) !== NONE)) out.actionPressed = false;
   }
   return out;
}
