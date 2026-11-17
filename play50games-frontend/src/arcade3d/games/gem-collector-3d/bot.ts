// The honest bot (pure). It plays like a careful player with no hero power: it rolls to the nearest
// gem it can reach, steers clear of its own tail (no self-cut), of sunk and sinking tiles, of an
// active frost band and of slimes, opens chests, and banks a full train (20 link weight) at the
// nearest open beacon, or whatever it has when the round is nearly over. On level 5 it lassoes the
// Glutton by circling him with a long train while he squats, banks during the stun, lassoes the
// minis, and drives a 10+ train into his yawn. `mash` adds the hero power whenever it is ready (the
// proof's power-mashing check); it never changes the plan.
import { BOSS_HOME } from "./levels";
import { BANK_R, CUT_SKIP, HERO_R, LINK_SPACING, LINK_WEIGHT, MAX_LINKS, PED_R, inBox, overPit, sunkGroup, sweepBand, beaconActive } from "./arena";
import { BOSS_R, CHEW_MS, GEM, MOUTH_OFFSET, SLAM_R, YAWN_MIN, V_RUN, createRun, createStepInput, step, trainWeight, type GemRun, type StepInput } from "./rules";
import { heroById, type HeroId } from "./heroes";
import type { LevelId } from "../../types";

export interface Bot {
   frameMs: number;
   mash: boolean;
   still: number;
   lastX: number;
   lastZ: number;
   /** the circle it rolls for a lasso: its centre is the target's, this radius, this many radians done */
   circling: boolean;
   circleDir: number;
}

export function createBot(run: GemRun, frameMs = 1000 / 60): Bot {
   return { frameMs, mash: false, still: 0, lastX: run.hero.x, lastZ: run.hero.z, circling: false, circleDir: 1 };
}

const BAND = { x0: 0, x1: 0 };

function setMove(input: StepInput, dx: number, dz: number, k = 1): void {
   const d = Math.hypot(dx, dz);
   if (d < 1e-6) {
      input.moveX = 0;
      input.moveZ = 0;
      return;
   }
   const s = Math.min(1, k);
   input.moveX = (dx / d) * s;
   input.moveZ = (dz / d) * s;
}

/** Is this gem worth heading for (on the floor or loose, visible, reachable without a power)? */
function reachable(run: GemRun, i: number): boolean {
   const st = run.gemState[i];
   if (st !== GEM.floor && st !== GEM.loose) return false;
   const g = run.arena.gems[i];
   if (g.hidden && !run.revealed[i]) return false;
   if (run.gy[i] > 0.5) return false;
   const a = run.arena;
   const x = run.gx[i];
   const z = run.gz[i];
   if (inBox(a.vault, x, z, 0.3) || (inBox(a.pocket, x, z, 0.3) && !run.wallBroken[0])) return false;
   // a loose gem about to fade is not worth the trip
   if (st === GEM.loose && run.fadeAt[i] - run.simMs < (Math.hypot(x - run.hero.x, z - run.hero.z) / V_RUN) * 1000 + 300) return false;
   if (overPit(a, x, z, run.simMs) || overPit(a, x, z, run.simMs + 1500)) return false;
   if (run.boss && run.boss.hp > 0 && Math.hypot(x - run.glutton.x, z - run.glutton.z) < BOSS_R + 1.2) return false;
   for (const bc of a.beacons) if (Math.hypot(bc.x - x, bc.z - z) < BANK_R + 0.6) return false;
   return true;
}

/** Does the straight line from the head to (x, z) pass within 0.8 m of a link from CUT_SKIP back? */
export function crossesTail(run: GemRun, x: number, z: number): boolean {
   const h = run.hero;
   const sx = x - h.x;
   const sz = z - h.z;
   const len2 = sx * sx + sz * sz || 1;
   for (let k = CUT_SKIP; k < run.n; k++) {
      const lx = run.linkPos[k * 2] - h.x;
      const lz = run.linkPos[k * 2 + 1] - h.z;
      const t = Math.max(0, Math.min(1, (lx * sx + lz * sz) / len2));
      if (Math.hypot(lx - sx * t, lz - sz * t) < 0.8) return true;
   }
   return false;
}

function nearestGem(run: GemRun, avoidX = NaN, avoidZ = NaN, avoidR = 0): number {
   const h = run.hero;
   let best = -1;
   let bestCost = Infinity;
   // the direction the train trails: gems behind the head cost more (turning back risks a cut)
   const tx = run.n > 0 ? run.linkPos[0] - h.x : 0;
   const tz = run.n > 0 ? run.linkPos[1] - h.z : 0;
   const tl = Math.hypot(tx, tz) || 1;
   for (let i = 0; i < run.gemState.length; i++) {
      if (!reachable(run, i)) continue;
      const dx = run.gx[i] - h.x;
      const dz = run.gz[i] - h.z;
      const d = Math.hypot(dx, dz);
      if (avoidR > 0 && Math.hypot(run.gx[i] - avoidX, run.gz[i] - avoidZ) < avoidR) continue;
      const back = run.n > 2 ? Math.max(0, (dx * tx + dz * tz) / (tl * (d || 1))) : 0;
      // a straight run there that passes over the tail (from link 3) would cut it
      const crosses = crossesTail(run, run.gx[i], run.gz[i]);
      const cost = (crosses ? 40 : 0) + d * (1 + 1.5 * back) + (run.arena.gems[i].kind === "frost" ? 2 : 0) - (run.arena.gems[i].kind === "gold" ? 1 : 0);
      if (cost < bestCost) {
         bestCost = cost;
         best = i;
      }
   }
   return best;
}

/** Adds the avoidance (own tail, pits, frost bands, slimes, the boss) to the input. */
function avoid(run: GemRun, input: StepInput, bossR = 0, beacons = false): void {
   const h = run.hero;
   const a = run.arena;
   const ms = run.simMs;
   let ax = 0;
   let az = 0;
   // sunk tiles now and the next group
   if (a.tiles) {
      const now = sunkGroup(a.tiles, ms);
      const soon = sunkGroup(a.tiles, ms + 1300);
      for (const c of a.tiles.cells) {
         if (c.group !== now && c.group !== soon) continue;
         const cx = Math.max(c.x0, Math.min(c.x1, h.x));
         const cz = Math.max(c.z0, Math.min(c.z1, h.z));
         let dx = h.x - cx;
         let dz = h.z - cz;
         let d = Math.hypot(dx, dz);
         if (d < 1e-6) {
            // inside: out toward the nearest edge
            const mx = (c.x0 + c.x1) / 2;
            const mz = (c.z0 + c.z1) / 2;
            dx = h.x - mx;
            dz = h.z - mz;
            d = 0.01;
            const m = Math.hypot(dx, dz) || 1;
            ax += (dx / m) * 3;
            az += (dz / m) * 3;
            continue;
         }
         if (d < 1.4) {
            ax += (dx / d) * ((1.4 - d) / 1.4) * 3;
            az += (dz / d) * ((1.4 - d) / 1.4) * 3;
         }
      }
   }
   // a frost band that is (or is about to be) sweeping
   for (const sw of a.sweepers) {
      const live = sweepBand(sw, ms, BAND) || sweepBand(sw, ms + 700, BAND);
      if (!live) continue;
      if (h.x > sw.x0 - 1.5 && h.x < sw.x1 + 1.5 && h.z > sw.z0 - 1.6 && h.z < sw.z1 + 1.6) {
         const mz = (sw.z0 + sw.z1) / 2;
         az += h.z > mz ? 2.5 : -2.5;
      }
   }
   // slimes
   for (let i = 0; i < run.slimeAlive.length; i++) {
      if (!run.slimeAlive[i]) continue;
      const dx = h.x - run.slimeX[i];
      const dz = h.z - run.slimeZ[i];
      const d = Math.hypot(dx, dz);
      if (d < 2.2 && d > 1e-6) {
         ax += (dx / d) * ((2.2 - d) / 2.2) * 2.5;
         az += (dz / d) * ((2.2 - d) / 2.2) * 2.5;
      }
   }
   // the Glutton
   if (bossR > 0 && run.boss && run.boss.hp > 0) {
      const g = run.glutton;
      const dx = h.x - g.x;
      const dz = h.z - g.z;
      const d = Math.hypot(dx, dz);
      if (d < bossR && d > 1e-6) {
         ax += (dx / d) * ((bossR - d) / bossR) * 3;
         az += (dz / d) * ((bossR - d) / bossR) * 3;
      }
   }
   // open beacons, while it is not banking (driving past one banks the train)
   if (beacons && run.n > 0) {
      for (let i = 0; i < a.beacons.length; i++) {
         const bc = a.beacons[i];
         const dx = h.x - bc.x;
         const dz = h.z - bc.z;
         const d = Math.hypot(dx, dz);
         const r = BANK_R + 1.6;
         if (d < r && d > 1e-6) {
            ax += (dx / d) * ((r - d) / r) * 3;
            az += (dz / d) * ((r - d) / r) * 3;
         }
      }
   }
   // pedestals (the bot never climbs them)
   for (const p of a.pedestals) {
      const dx = h.x - p.x;
      const dz = h.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < PED_R + 1.2 && d > 1e-6) {
         ax += (dx / d) * 0.8;
         az += (dz / d) * 0.8;
      }
   }
   // about to roll into its own tail: sidestep along it, on the goal's side
   const gl = Math.hypot(input.moveX, input.moveZ);
   if (gl > 0.1) {
      const gx = input.moveX / gl;
      const gz = input.moveZ / gl;
      let worst = -1;
      let wd = 1.3;
      for (let k = CUT_SKIP; k < run.n; k++) {
         const lx = run.linkPos[k * 2] - h.x;
         const lz = run.linkPos[k * 2 + 1] - h.z;
         const d = Math.hypot(lx, lz);
         if (d < wd && (lx * gx + lz * gz) / (d || 1) > 0.5) {
            wd = d;
            worst = k;
         }
      }
      if (worst >= 0) {
         const lx = run.linkPos[worst * 2] - h.x;
         const lz = run.linkPos[worst * 2 + 1] - h.z;
         let px = -lz;
         let pz = lx;
         if (px * gx + pz * gz < 0) {
            px = -px;
            pz = -pz;
         }
         ax += px * 2 - lx * 0.8;
         az += pz * 2 - lz * 0.8;
      }
   }
   if (ax === 0 && az === 0) return;
   let mx = input.moveX + ax;
   let mz = input.moveZ + az;
   let m = Math.hypot(mx, mz);
   if (m < 0.35 && Math.hypot(input.moveX, input.moveZ) > 0.1) {
      // boxed in (the goal and the push cancel, e.g. inside its own coil): swing the goal 70 degrees
      const c = Math.cos(1.22);
      const sn = Math.sin(1.22);
      mx = input.moveX * c - input.moveZ * sn;
      mz = input.moveX * sn + input.moveZ * c;
      m = Math.hypot(mx, mz);
   }
   m = m || 1;
   input.moveX = mx / Math.max(1, m);
   input.moveZ = mz / Math.max(1, m);
}

function nearestBeacon(run: GemRun): number {
   const a = run.arena;
   const h = run.hero;
   let best = -1;
   let bd = Infinity;
   for (let b = 0; b < a.beacons.length; b++) {
      // level 4: the beacon that will be open when it gets there
      const d = Math.hypot(a.beacons[b].x - h.x, a.beacons[b].z - h.z);
      if (!beaconActive(a, b, run.simMs + (d / V_RUN) * 1000)) continue;
      if (d < bd) {
         bd = d;
         best = b;
      }
   }
   return best;
}

/** Rolls a circle round (cx, cz) at radius r (the lasso): the tangent plus a capped pull to the radius (a smooth spiral in). */
function circle(bot: Bot, run: GemRun, input: StepInput, cx: number, cz: number, r: number): void {
   const h = run.hero;
   const dx = h.x - cx;
   const dz = h.z - cz;
   const d = Math.hypot(dx, dz) || 1;
   const ux = dx / d;
   const uz = dz / d;
   // the tangent (counter-clockwise for circleDir 1) and the radial pull
   const tx = uz * bot.circleDir;
   const tz = -ux * bot.circleDir;
   const pull = Math.max(-1.5, Math.min(1.5, (r - d) * 2.5));
   setMove(input, tx + ux * pull, tz + uz * pull);
}

function collect(bot: Bot, run: GemRun, input: StepInput, bankAt: number, bossR = 0, avoidX = NaN, avoidZ = NaN, avoidR = 0): void {
   const h = run.hero;
   const a = run.arena;
   const left = a.durationMs - run.simMs;
   const w = trainWeight(run);
   const gem = nearestGem(run, avoidX, avoidZ, avoidR);
   const b = nearestBeacon(run);
   const toBeacon = b >= 0 ? Math.hypot(a.beacons[b].x - h.x, a.beacons[b].z - h.z) : Infinity;
   const late = left < (toBeacon / V_RUN) * 1000 + 2500;
   const swallowed = run.boss !== null && run.boss.phase === 2;
   // nothing in reach: a wave still to come is worth the wait (a partial bank scores only n^2)
   const every = a.waveEveryMs;
   const nextWave = every > 0 ? Math.ceil((run.simMs + 1) / every) * every : Infinity;
   const waveLeft = every > 0 && nextWave / every - 1 < a.spec.waves.length && nextWave < a.durationMs - 6000;
   const banking = b >= 0 && !swallowed && run.n > 0 && (w >= bankAt || run.n >= MAX_LINKS || (gem < 0 && !waveLeft) || late);
   if (banking) {
      setMove(input, a.beacons[b].x - h.x, a.beacons[b].z - h.z);
   } else if (gem >= 0 && run.n < MAX_LINKS) {
      // level 4: a closed chest close by first
      let cx = run.gx[gem];
      let cz = run.gz[gem];
      for (let c = 0; c < run.chestOpen.length; c++) {
         if (run.chestOpen[c]) continue;
         const ch = a.spec.chests[c];
         if (Math.hypot(ch.x - h.x, ch.z - h.z) < Math.hypot(cx - h.x, cz - h.z) + 2) {
            cx = ch.x;
            cz = ch.z;
         }
      }
      setMove(input, cx - h.x, cz - h.z);
   } else {
      setMove(input, -h.x * 0.3, -h.z * 0.3, 0.4);
   }
   avoid(run, input, bossR, !banking);
   void bot;
}

/** Level 3: with a train of 11+, circle the nearest chewing slime within 12 m (a lasso freezes it into gold). */
function slimeLasso(bot: Bot, run: GemRun, input: StepInput): boolean {
   if (run.n < 11) return false;
   const h = run.hero;
   let best = -1;
   let bd = 12;
   for (let i = 0; i < run.slimeAlive.length; i++) {
      // only a chewing slime (it sits still after a bite) with time left to go round it
      if (!run.slimeAlive[i] || run.simMs - run.slimeBite[i] > CHEW_MS - 1200) continue;
      const d = Math.hypot(run.slimeX[i] - h.x, run.slimeZ[i] - h.z);
      if (d < bd) {
         bd = d;
         best = i;
      }
   }
   if (best < 0) return false;
   circle(bot, run, input, run.slimeX[best], run.slimeZ[best], 1.3);
   return true;
}

function bossPlay(bot: Bot, run: GemRun, input: StepInput): void {
   const b = run.boss!;
   const g = run.glutton;
   const h = run.hero;
   const ms = run.simMs;
   const ph = b.phase;
   if (ph === 0) {
      if (g.stunUntil >= ms) {
         // stunned: bank now for the hit
         const bi = nearestBeacon(run);
         if (bi >= 0) setMove(input, run.arena.beacons[bi].x - h.x, run.arena.beacons[bi].z - h.z);
         bot.circling = false;
         return;
      }
      const home = Math.hypot(g.x - BOSS_HOME.x, g.z - BOSS_HOME.z) < 0.2;
      if (b.step === "vulnerable" && home && run.n >= 15) {
         bot.circling = true;
         circle(bot, run, input, g.x, g.z, BOSS_R + HERO_R + 0.1);
         return;
      }
      bot.circling = false;
      // build a long train, well clear of his mouth; never bank it now
      collect(bot, run, input, 99, 5.5, g.x, g.z, 3.2);
      return;
   }
   if (ph === 1) {
      if (b.step === "vulnerable" && run.n >= 10) {
         let best = -1;
         let bd = Infinity;
         for (let m = 0; m < 3; m++) {
            if (!g.mAlive[m]) continue;
            const d = Math.hypot(g.mx[m] - h.x, g.mz[m] - h.z);
            if (d < bd) {
               bd = d;
               best = m;
            }
         }
         if (best >= 0) {
            circle(bot, run, input, g.mx[best], g.mz[best], 1.35);
            return;
         }
      }
      collect(bot, run, input, 99, 0);
      // keep the tail away from the minis outside the window
      for (let m = 0; m < 3; m++) {
         if (!g.mAlive[m] || b.step === "vulnerable") continue;
         const dx = h.x - g.mx[m];
         const dz = h.z - g.mz[m];
         const d = Math.hypot(dx, dz);
         if (d < 3 && d > 1e-6) {
            input.moveX += (dx / d) * 1.5;
            input.moveZ += (dz / d) * 1.5;
         }
      }
      return;
   }
   // phase 3: a 10+ train, wait south of the mouth out of the slam, then into the yawn
   const mx = g.x;
   const mz = g.z - MOUTH_OFFSET;
   if (run.n >= YAWN_MIN + 2 || (run.n >= YAWN_MIN && b.step !== "telegraph")) {
      if (b.step === "vulnerable") setMove(input, mx - h.x, mz - h.z);
      else {
         const wx = g.x;
         const wz = g.z - (SLAM_R + 1.2);
         setMove(input, wx - h.x, wz - h.z, Math.min(1, Math.hypot(wx - h.x, wz - h.z) / 1.5));
         avoid(run, input, SLAM_R + 0.5);
      }
      return;
   }
   collect(bot, run, input, 99, SLAM_R + 0.6, g.x, g.z, SLAM_R + 0.6);
}

export function botInput(bot: Bot, run: GemRun, input: StepInput): void {
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   input.moveX = 0;
   input.moveZ = 0;
   const h = run.hero;
   if (run.ended || h.lostUntil >= 0) return;
   if (run.boss && run.boss.hp > 0) bossPlay(bot, run, input);
   else if (!slimeLasso(bot, run, input)) collect(bot, run, input, 20);
   if (bot.mash && run.simMs >= h.powerReadyAt && heroById(run.heroId).power !== "doubleJump") input.actionPressed = true;
   // unstick: a jump after 800 ms pushing without moving
   const moved = Math.hypot(h.x - bot.lastX, h.z - bot.lastZ);
   const trying = Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.3;
   if (moved < 0.002 && trying && h.grounded) bot.still += bot.frameMs;
   else bot.still = 0;
   bot.lastX = h.x;
   bot.lastZ = h.z;
   if (bot.still > 800) {
      input.jumpPressed = true;
      bot.still = 0;
   }
   void LINK_SPACING;
   void LINK_WEIGHT;
}

/** Runs a bot until the level ends (tests and the preview's ?autoplay=1). */
export function botRun(level: LevelId, fps = 60, hero: HeroId = "zuno", mash = false, seed = 1): GemRun {
   const fms = 1000 / fps;
   const run = createRun(seed, level, hero);
   const bot = createBot(run, fms);
   bot.mash = mash;
   const input = createStepInput();
   const cap = Math.ceil(run.arena.durationMs / fms) + 5;
   for (let f = 0; f < cap && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}
