// The honest bot (tests, and `?autoplay=1` on preview builds): it rides like a player with the same
// inputs a player has (world-space stick at yaw 0, Jump, the power only when a proof mashes it): it
// pumps in rhythm (up above the band, a hard carve down through it), steers onto a main orb only when
// its pump would miss it, keeps a free line clear of rocks, buoys, jellies, the spray, diving gulls
// and King Breaker's attacks, goes to the lip for the lip orbs, the gates and the boss and airs so the
// apex meets them, and holds a spin through every air. It looks only at the next ~1.4 s of the ride
// (what is on screen) and never touches the rules' state.
import { BAND, FACE_W, LIP_W } from "./waves";
import { BOSS_SPEED, CARVE_ACC, CRAB, GULL, HERO, MINE_R, V_CARVE, bossAlive, gullBeat, jellyX, type StepInput, type SurfRun } from "./rules";

export interface Bot {
   frameMs: number;
   /** +1 climbing to the top of the pump, -1 carving down */
   dir: number;
   /** press the power every frame (proofs) */
   mash: boolean;
}

export function createBot(_run: SurfRun, frameMs = 1000 / 60): Bot {
   return { frameMs, dir: 1, mash: false };
}

/** The pump's turning points: just above the band's top, just under its bottom (it overshoots ~0.9 m). */
const TOP = BAND.hi + 0.5;
const BOT = BAND.lo - 0.2;

/** Where the pump rhythm alone takes the hero in `t` s (the same controller, 10 ms steps). */
export function pumpForecast(x0: number, vx0: number, dir0: number, t: number, lo: number, hi: number): number {
   let x = x0;
   let vx = vx0;
   let dir = dir0;
   const dt = 0.01;
   for (let s = 0; s < t; s += dt) {
      if (dir > 0 && x >= TOP) dir = -1;
      else if (dir < 0 && x <= BOT) dir = 1;
      const target = dir * V_CARVE;
      const dv = target - vx;
      const a = CARVE_ACC * dt;
      vx += dv > a ? a : dv < -a ? -a : dv;
      x += vx * dt;
      if (x < lo) x = lo;
      if (x > hi) x = hi;
   }
   return x;
}

/** Blocked x ranges ahead (min, max), merged into free intervals. */
const BLOCK_LO = new Float64Array(48);
const BLOCK_HI = new Float64Array(48);
const FREE_LO = new Float64Array(50);
const FREE_HI = new Float64Array(50);

function freeIntervals(n: number, lo: number, hi: number): number {
   // sort the blocks by their start (n is small)
   for (let i = 1; i < n; i++) {
      const a = BLOCK_LO[i];
      const b = BLOCK_HI[i];
      let j = i - 1;
      while (j >= 0 && BLOCK_LO[j] > a) {
         BLOCK_LO[j + 1] = BLOCK_LO[j];
         BLOCK_HI[j + 1] = BLOCK_HI[j];
         j--;
      }
      BLOCK_LO[j + 1] = a;
      BLOCK_HI[j + 1] = b;
   }
   let m = 0;
   let at = lo;
   for (let i = 0; i < n; i++) {
      if (BLOCK_LO[i] > at && m < FREE_LO.length) {
         FREE_LO[m] = at;
         FREE_HI[m] = Math.min(hi, BLOCK_LO[i]);
         if (FREE_HI[m] > FREE_LO[m]) m++;
      }
      at = Math.max(at, BLOCK_HI[i]);
   }
   if (at < hi && m < FREE_LO.length) {
      FREE_LO[m] = at;
      FREE_HI[m] = hi;
      m++;
   }
   return m;
}

export function botInput(bot: Bot, run: SurfRun, out: StepInput): void {
   const h = run.hero;
   const c = run.course;
   const ms = run.simMs;
   out.yaw = 0;
   out.moveZ = 0;
   out.jumpPressed = false;
   out.jumpHeld = false;
   out.actionPressed = bot.mash;
   out.moveX = 0;
   if (h.state !== "play") return;
   const v = Math.max(1, h.v);
   if (!h.grounded) {
      // a spin, held through the whole air (it lands well past the trick's 320 ms)
      out.moveX = -1;
      return;
   }
   let lo = 0.2;
   for (const nr of c.narrows) if (h.z <= nr.z0 + 20 && h.z >= nr.z1) lo = Math.max(lo, nr.lo + 0.2);
   const hi = FACE_W;
   // the pump rhythm
   if (bot.dir > 0 && h.x >= TOP) bot.dir = -1;
   else if (bot.dir < 0 && h.x <= BOT) bot.dir = 1;
   let want = bot.dir > 0 ? TOP + 1.5 : BOT - 1.5;
   let lip = false;
   let jump = false;
   // the lip: the next main air orb or gate within 1.4 s
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = c.orbs[i];
      if (o.kind !== "main" || o.y <= c.H + 1) continue;
      const dz = h.z - o.z;
      if (dz < -0.5) continue;
      if (dz > v * 1.4) break;
      lip = true;
      if (dz <= v * 0.42 && dz >= v * 0.22) jump = true;
      break;
   }
   // a rider orb the pump would miss: steer onto it
   if (!lip) {
      for (let i = 0; i < c.orbs.length; i++) {
         if (run.collected[i]) continue;
         const o = c.orbs[i];
         if (o.kind !== "main" || o.y > c.H + 1) continue;
         const dz = h.z - o.z;
         if (dz < -0.6) continue;
         if (dz > v * 0.9) break;
         const pred = pumpForecast(h.x, h.vx, bot.dir, dz / v, lo, hi);
         if (Math.abs(pred - o.x) > 0.7) want = o.x;
         break;
      }
   }
   // the boss (level 5)
   const b = run.boss;
   if (b && bossAlive(run) && b.hp > 0) {
      const dz = h.z - run.crab.z;
      if (b.step === "vulnerable" && (b.phase === 0 || (b.phase === 1 && h.v >= BOSS_SPEED.eyes))) {
         lip = true;
         jump = dz >= -1 && dz <= Math.max(2, (h.v - CRAB.slow) * 0.42);
      } else if (b.step === "vulnerable" && b.phase === 2 && h.v >= BOSS_SPEED.barrel) {
         want = run.crab.x;
         lip = false;
      }
   }
   if (lip) want = FACE_W - 0.3;
   // hazards ahead: keep to a free line
   let n = 0;
   const add = (x: number, r: number) => {
      if (n < BLOCK_LO.length) {
         BLOCK_LO[n] = x - r;
         BLOCK_HI[n] = x + r;
         n++;
      }
   };
   const window = v * 0.75 + 3;
   for (const r of c.rocks) {
      const dz = h.z - r.z;
      if (dz > -r.r - 1 && dz < window) add(r.x, r.r + HERO.radius + 0.5);
   }
   for (const bu of c.buoys) {
      const dz = h.z - bu.z;
      if (dz > -1.5 && dz < window) add(bu.x, 0.7 + HERO.radius + 0.45);
   }
   const safe = ms <= h.graceUntil || ms <= h.shieldUntil;
   if (!safe) {
      for (const j of c.jellies) {
         const dz = h.z - j.z;
         if (dz > -1.5 && dz < window) add(jellyX(j, ms + (Math.max(0, dz) / v) * 1000), 0.8 + HERO.radius + 0.45);
      }
      for (const s of c.sprays) if (h.z - window < s.z0 && h.z > s.z1 - 1) add((s.x0 + FACE_W + 2) / 2, (FACE_W + 2 - s.x0) / 2 + 0.5);
      for (const g of c.gulls) {
         const dz = h.z - g.z;
         if (dz < -2 || dz > window) continue;
         const beat = gullBeat(g, ms + (Math.max(0, dz) / v) * 1000);
         if (beat >= GULL.telegraph - 0.15) add(g.x, GULL.r + 0.6);
      }
      if (b && b.step !== "vulnerable") {
         if (run.slam.live) {
            const dz = h.z - run.slam.z;
            if (dz > -4 && dz < window + 8) add(run.slam.x, 1.8 + 0.9);
         }
         if (run.minesLive)
            for (let k = 0; k < 3; k++) {
               const dz = h.z - run.mines[k * 2 + 1];
               if (dz > -2 && dz < window + 8) add(run.mines[k * 2], MINE_R + HERO.radius + 0.5);
            }
         if (b.phase === 2 && (b.step === "attack" || b.step === "telegraph")) {
            const dz = h.z - run.crab.z;
            if (dz > -5 && dz < window + 4) add(run.crab.x, 2.2 + 0.9);
         }
      }
   }
   want = Math.max(lo, Math.min(hi, want));
   if (n > 0) {
      const m = freeIntervals(n, lo, hi);
      // the free stretch the hero is on (or the nearest one), and the wanted x kept inside it
      let best = -1;
      let bestD = Infinity;
      for (let k = 0; k < m; k++) {
         const d = h.x < FREE_LO[k] ? FREE_LO[k] - h.x : h.x > FREE_HI[k] ? h.x - FREE_HI[k] : 0;
         // a near stretch that holds the wanted x wins a tie
         const holds = want >= FREE_LO[k] && want <= FREE_HI[k] ? -0.5 : 0;
         if (d + holds < bestD) {
            bestD = d + holds;
            best = k;
         }
      }
      if (best >= 0) want = Math.max(FREE_LO[best] + 0.05, Math.min(FREE_HI[best] - 0.05, want));
   }
   const d = want - h.x;
   out.moveX = Math.abs(d) > 0.35 ? Math.sign(d) : d / 0.35;
   if (jump && h.x >= FACE_W - LIP_W) out.jumpPressed = true;
}
