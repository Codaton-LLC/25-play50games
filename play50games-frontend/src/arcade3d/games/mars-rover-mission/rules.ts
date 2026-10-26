// Mars Rover Mission rules (docs/menu1-new/specs-41-50.md §43). Pure and deterministic with a seed:
// no three.js, React or DOM. The Scene calls createRun once per run and step from one useRunFrame.
import { sweptAabbXZ, type AABB } from "@/arcade3d/core/collision";
import { capScore } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import type { ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import type { StoreApi } from "zustand/vanilla";
import { LEVELS, type MarsLevel } from "./levels";

/** The street-vehicle integrator (specs-31-40.md) with the rover's numbers. Yaw 0 faces +z. */
export const ROVER = {
   topSpeed: 7,
   accel: 7,
   brake: 12,
   reverse: 2.5,
   /** rad/s at full stick, times turnScale = clamp(|speed| / 2, 0.35, 1) */
   steer: 1.8,
   radius: 1.1,
   /** coasting drag (1/s) */
   drag: 0.6,
   /** stick dead zone on both axes */
   deadZone: 0.2,
   /** the integrator runs in fixed 1/120 s steps so 30 / 60 / 144 Hz drive the same */
   fixedStep: 1 / 120,
   /** the rover's box half size for the swept boulder test */
   boxHalf: 0.9,
} as const;

export const LIVES = 3;
export const SITE_RING_RADIUS = 1.8;
export const SCAN_SPEED_MAX = 0.5;
export const SCAN_HOLD_S = 1.0;
export const CHARGER_PAD_RADIUS = 2.2;
export const CHARGE_RATE = 12;
export const BASE_PAD_RADIUS = 2.4;
export const WIN_HOLD_S = 0.6;
export const ROCK_RADIUS = 0.95;
/** a hit on a rock faster than this spends a life and bounces the rover back */
export const ROCK_HIT_SPEED = 3.0;
export const BOULDER_RADIUS = 0.85;
/** after a hit, no second life is spent for this long (play time) */
export const HIT_GRACE_S = 1.0;
export const IDLE_DRAIN = 0.35;
export const DRIVE_DRAIN = 0.9;

export const BASE_SCAN_SCORE = 120;
export const CENTER_BONUS_SCORE = 60;
export const CENTER_BONUS_RADIUS = 1.0;
export const TIME_BONUS_PER_SEC = 5;

/** Generator clearances (m). Boulder lanes keep the rings, pads and base clear of a rolling boulder. */
export const GEN = {
   siteSpacing: 10,
   /** a lane's x from a site centre: a rover centred within 1 m (1 + 1.1) plus the boulder (0.85) and air */
   laneFromSite: 3.4,
   laneFromPad: CHARGER_PAD_RADIUS + ROVER.radius + BOULDER_RADIUS + 0.3,
   laneFromBase: BASE_PAD_RADIUS + ROVER.radius + BOULDER_RADIUS + 0.5,
   laneSpacing: 5,
   /** a rock's x from a lane */
   rockFromLane: ROCK_RADIUS + BOULDER_RADIUS + 0.3,
   /** rocks apart, centre to centre: the rover always fits between two */
   rockSpacing: 2 * ROCK_RADIUS + 2 * ROVER.radius + 0.6,
   wallMargin: 3.5,
   baseInset: 3.5,
} as const;

const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

/** Bobj = 180 per site (120 + the 60 centre bonus): each site pays once. */
export function objectiveCeiling(sites: number): number {
   return (BASE_SCAN_SCORE + CENTER_BONUS_SCORE) * sites;
}

/**
 * Per level (README "Server limits and why they hold"): base = Bobj, the time bonus 5 floor(D - t) is
 * largest at the earliest win M, so maxScore >= Bobj + 5 (D - M) and pps >= 5 (D / M - 1). M = 0.8 x the
 * fastest oracle / careful-bot win over 200 seeds at 30 / 60 / 144 Hz (PROOF_EARLIEST_WIN_S, pinned by tests).
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 540, D 120 s, fastest bot win 14.28 s → M 11.42 s, peak 1080; pps 5 (120 / 11.42 - 1) = 47.5 */
   1: { ...PTS, maxScore: 1115, minDurationMs: 4000, maxDurationMs: 120_000, base: 540, maxPointsPerSec: 49 },
   /** L2: Bobj 720, D 150 s, 18.17 s → M 14.53 s, peak 1395; pps 46.6 */
   2: { ...PTS, maxScore: 1440, minDurationMs: 4000, maxDurationMs: 150_000, base: 720, maxPointsPerSec: 48 },
   /** L3: Bobj 900, D 180 s, 22.33 s → M 17.87 s, peak 1710; pps 45.4 */
   3: { ...PTS, maxScore: 1765, minDurationMs: 4000, maxDurationMs: 180_000, base: 900, maxPointsPerSec: 47 },
   /** L4: Bobj 1080, D 180 s, 32.55 s → M 26.04 s, peak 1845; pps 29.6 */
   4: { ...PTS, maxScore: 1905, minDurationMs: 4000, maxDurationMs: 180_000, base: 1080, maxPointsPerSec: 31 },
   /** L5: Bobj 1260, D 240 s, 40.57 s → M 32.46 s, peak 2295; pps 32.0 */
   5: { ...PTS, maxScore: 2365, minDurationMs: 4000, maxDurationMs: 240_000, base: 1260, maxPointsPerSec: 33 },
};

/** The earliest win each proof assumes (s): 0.8 x the fastest oracle / careful win over 200 seeds (tests pin it). */
export const PROOF_EARLIEST_WIN_S: Record<LevelId, number> = { 1: 11.42, 2: 14.53, 3: 17.87, 4: 26.04, 5: 32.46 };

export interface MarsInput {
   moveX: number;
   moveY: number;
}

export interface Site {
   index: number;
   x: number;
   z: number;
   scanned: boolean;
   holdTime: number;
}

export interface Pad {
   index: number;
   x: number;
   z: number;
}
export type Charger = Pad;

export interface Rock {
   index: number;
   x: number;
   z: number;
   radius: number;
   /** visual turn only */
   rotY: number;
}

export interface Boulder {
   index: number;
   x: number;
   z: number;
   speed: number;
   minZ: number;
   maxZ: number;
   /** distance rolled (visual spin) */
   rolled: number;
}

export interface RoverState {
   x: number;
   z: number;
   yaw: number;
   speed: number;
   vx: number;
   vz: number;
   battery: number;
   /** hit grace left (s) */
   invulnerable: number;
}

export interface StepEvents {
   score: number;
   siteScanned: number;
   centerBonus: boolean;
   charging: boolean;
   rockHit: boolean;
   boulderHit: boolean;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   timeBonus: number;
}

export interface Run {
   seed: number;
   levelId: LevelId;
   level: MarsLevel;
   rover: RoverState;
   sites: Site[];
   chargers: Charger[];
   rocks: Rock[];
   boulders: Boulder[];
   basePad: { x: number; z: number; radius: number };
   score: number;
   lives: number;
   samplesScanned: number;
   baseHoldTime: number;
   over: "win" | "lose" | "timeup" | null;
   charging: boolean;
   /** this frame's events, one object reused every step */
   ev: StepEvents;
   time: number;
   /** fixed-step remainder (s) */
   acc: number;
}

export function idleInput(): MarsInput {
   return { moveX: 0, moveY: 0 };
}

export function timeBonus(timeLeftS: number): number {
   return Math.floor(Math.max(0, timeLeftS)) * TIME_BONUS_PER_SEC;
}

/** A stick axis past the dead zone, rescaled to 0..1 (keyboard ±1 gives 1, the same as a full stick). */
export function axis(v: number): number {
   const a = Math.abs(v);
   if (a <= ROVER.deadZone) return 0;
   return (Math.sign(v) * Math.min(1, (a - ROVER.deadZone) / (1 - ROVER.deadZone)));
}

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

/** Energy per metre at the rover's cruise (drive drain at the level's scale + the idle drain at ~3.5 m/s). */
export function drainPerMetre(level: MarsLevel): number {
   return DRIVE_DRAIN * level.drainScale + IDLE_DRAIN / 3.5;
}

/** The farthest a site may lie from its charger: a there-and-back at 1.35 x the straight line on 85 % of a battery. */
export function energyReach(level: MarsLevel): number {
   return 85 / (2 * 1.35 * drainPerMetre(level));
}

interface Layout {
   sites: Site[];
   chargers: Charger[];
   rocks: Rock[];
   boulders: Boulder[];
}

/** One seeded attempt at the layout; null when a count could not be met (createRun draws again). */
function layout(rng: () => number, level: MarsLevel, basePad: { x: number; z: number }): Layout | null {
   const halfW = level.width / 2;
   const halfD = level.depth / 2;

   // 1. Boulder lanes first (x positions; the boulders roll south along z), clear of the base.
   const boulders: Boulder[] = [];
   const laneMin = -halfW + GEN.wallMargin;
   const laneMax = halfW - GEN.wallMargin;
   for (let tries = 0; boulders.length < level.boulders && tries < 400; tries++) {
      const x = laneMin + rng() * (laneMax - laneMin);
      const z = -halfD + 2 + rng() * (level.depth - 4);
      if (Math.abs(x - basePad.x) < GEN.laneFromBase) continue;
      if (boulders.some((b) => Math.abs(b.x - x) < GEN.laneSpacing)) continue;
      boulders.push({ index: boulders.length, x, z, speed: level.boulderSpeed, minZ: -halfD + 1, maxZ: halfD - 1, rolled: 0 });
   }
   if (boulders.length < level.boulders) return null;
   const laneClear = (x: number, gap: number) => boulders.every((b) => Math.abs(b.x - x) >= gap);

   // 2. Scan sites: >= 10 m apart, away from the base, the walls and every lane.
   const sites: Site[] = [];
   for (let tries = 0; sites.length < level.sites && tries < 1500; tries++) {
      const x = (rng() * 2 - 1) * (halfW - GEN.wallMargin - 0.5);
      const z = -halfD + GEN.wallMargin + 0.5 + rng() * (level.depth - 2 * GEN.wallMargin - 1 - GEN.baseInset - 2);
      if (dist(x, z, basePad.x, basePad.z) < 7) continue;
      if (sites.some((s) => dist(s.x, s.z, x, z) < GEN.siteSpacing)) continue;
      if (!laneClear(x, GEN.laneFromSite)) continue;
      sites.push({ index: sites.length, x, z, scanned: false, holdTime: 0 });
   }
   if (sites.length < level.sites) return null;

   // 3. Chargers beside the sites farthest from the base (the farthest first), each within 4.5-7.5 m.
   const chargers: Charger[] = [];
   const far = [...sites].sort((a, b) => dist(b.x, b.z, basePad.x, basePad.z) - dist(a.x, a.z, basePad.x, basePad.z));
   for (let k = 0; chargers.length < level.chargers && k < far.length; k++) {
      const anchor = far[k];
      for (let tries = 0; tries < 60; tries++) {
         const a = rng() * Math.PI * 2;
         const d = 4.5 + rng() * 3;
         const x = anchor.x + Math.cos(a) * d;
         const z = anchor.z + Math.sin(a) * d;
         if (Math.abs(x) > halfW - GEN.wallMargin || z < -halfD + GEN.wallMargin || z > halfD - GEN.wallMargin) continue;
         if (dist(x, z, basePad.x, basePad.z) < 6) continue;
         if (sites.some((s) => dist(s.x, s.z, x, z) < SITE_RING_RADIUS + CHARGER_PAD_RADIUS + 1)) continue;
         if (chargers.some((ch) => dist(ch.x, ch.z, x, z) < 10)) continue;
         if (!laneClear(x, GEN.laneFromPad)) continue;
         chargers.push({ index: chargers.length, x, z });
         break;
      }
   }
   if (chargers.length < level.chargers) return null;

   // 4. Rocks: solid circles, clear of every ring, pad, the base and the lanes; never two too close.
   const rocks: Rock[] = [];
   for (let tries = 0; rocks.length < level.rocks && tries < 3000; tries++) {
      const x = (rng() * 2 - 1) * (halfW - 2.5);
      const z = -halfD + 2.5 + rng() * (level.depth - 5);
      const rotY = rng() * Math.PI * 2;
      if (dist(x, z, basePad.x, basePad.z) < BASE_PAD_RADIUS + ROCK_RADIUS + 3) continue;
      if (sites.some((s) => dist(s.x, s.z, x, z) < SITE_RING_RADIUS + ROCK_RADIUS + 3)) continue;
      if (chargers.some((ch) => dist(ch.x, ch.z, x, z) < CHARGER_PAD_RADIUS + ROCK_RADIUS + 2.5)) continue;
      if (!laneClear(x, GEN.rockFromLane)) continue;
      if (rocks.some((r) => dist(r.x, r.z, x, z) < GEN.rockSpacing)) continue;
      rocks.push({ index: rocks.length, x, z, radius: ROCK_RADIUS, rotY });
   }
   if (rocks.length < level.rocks) return null;
   // energy: every site within REACH of a charger, the first charger within two REACH of the base, the
   // chargers within two REACH of each other, so a full battery always covers a there-and-back
   const reach = energyReach(level);
   if (sites.some((s) => chargers.every((ch) => dist(s.x, s.z, ch.x, ch.z) > reach))) return null;
   if (chargers.every((ch) => dist(ch.x, ch.z, basePad.x, basePad.z) > 2 * reach)) return null;
   if (chargers.some((a) => chargers.some((b) => dist(a.x, a.z, b.x, b.z) > 2 * reach))) return null;
   return { sites, chargers, rocks, boulders };
}

export function createRun(seed: number, level: MarsLevel = LEVELS[1], levelId: LevelId = 1): Run {
   const rng = createRng(seed);
   const halfD = level.depth / 2;
   const basePad = { x: 0, z: halfD - GEN.baseInset, radius: BASE_PAD_RADIUS };
   let found: Layout | null = null;
   for (let attempt = 0; attempt < 200 && !found; attempt++) found = layout(rng, level, basePad);
   if (!found) throw new Error(`mars-rover-mission: no layout for seed ${seed}`);
   const { sites, chargers, rocks, boulders } = found;

   return {
      seed,
      levelId,
      level,
      rover: { x: basePad.x, z: basePad.z, yaw: Math.PI, speed: 0, vx: 0, vz: 0, battery: 100, invulnerable: 0 },
      sites,
      chargers,
      rocks,
      boulders,
      basePad,
      score: 0,
      lives: LIVES,
      samplesScanned: 0,
      baseHoldTime: 0,
      over: null,
      charging: false,
      ev: { score: 0, siteScanned: -1, centerBonus: false, charging: false, rockHit: false, boulderHit: false, lifeLost: false, won: false, lost: false, timeBonus: 0 },
      time: 0,
      acc: 0,
   };
}

const ROVER_BOX: AABB = { min: { x: 0, y: -1, z: 0 }, max: { x: 0, y: 1, z: 0 } };
const BOULDER_BOX: AABB = { min: { x: 0, y: -1, z: 0 }, max: { x: 0, y: 1, z: 0 } };
const REL = { x: 0, z: 0 };

function resetEvents(ev: StepEvents): void {
   ev.score = 0;
   ev.siteScanned = -1;
   ev.centerBonus = false;
   ev.charging = false;
   ev.rockHit = false;
   ev.boulderHit = false;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   ev.timeBonus = 0;
}

function spendLife(run: Run): void {
   run.lives -= 1;
   run.ev.lifeLost = true;
   run.rover.invulnerable = HIT_GRACE_S;
}

/** One fixed 1/120 s step of the rover, the boulders, the battery, the scans and the base. */
function substep(run: Run, throttle: number, brake: number, steer: number, h: number): void {
   const r = run.rover;
   const ev = run.ev;
   if (r.invulnerable > 0) r.invulnerable = Math.max(0, r.invulnerable - h);

   // speed: throttle, brake (into reverse once stopped), drag while coasting
   let s = r.speed;
   if (throttle > 0) s += (s < 0 ? ROVER.brake : ROVER.accel) * throttle * h;
   else if (brake > 0) s -= (s > 0 ? ROVER.brake : ROVER.accel) * brake * h;
   else {
      s *= Math.max(0, 1 - ROVER.drag * h);
      if (Math.abs(s) < 0.05) s = 0;
   }
   r.speed = Math.max(-ROVER.reverse, Math.min(ROVER.topSpeed, s));
   // steer: right (moveX > 0) turns clockwise seen from above, so the yaw falls
   const turnScale = Math.min(1, Math.max(0.35, Math.abs(r.speed) / 2));
   r.yaw -= steer * ROVER.steer * turnScale * h;
   if (r.yaw > Math.PI) r.yaw -= 2 * Math.PI;
   else if (r.yaw < -Math.PI) r.yaw += 2 * Math.PI;
   r.vx = Math.sin(r.yaw) * r.speed;
   r.vz = Math.cos(r.yaw) * r.speed;
   const px = r.x;
   const pz = r.z;
   r.x += r.vx * h;
   r.z += r.vz * h;

   // the mesa walls: stop against them (no damage)
   const hw = run.level.width / 2 - ROVER.radius;
   const hd = run.level.depth / 2 - ROVER.radius;
   if (r.x < -hw || r.x > hw || r.z < -hd || r.z > hd) {
      r.x = Math.max(-hw, Math.min(hw, r.x));
      r.z = Math.max(-hd, Math.min(hd, r.z));
      r.speed = 0;
   }

   // rocks: solid circles; a hit above 3 m/s spends a life and bounces the speed to -0.3 of itself
   for (const rock of run.rocks) {
      const dx = r.x - rock.x;
      const dz = r.z - rock.z;
      const d = Math.hypot(dx, dz);
      const min = ROVER.radius + rock.radius;
      if (d >= min) continue;
      const nx = d > 1e-9 ? dx / d : 0;
      const nz = d > 1e-9 ? dz / d : 1;
      r.x = rock.x + nx * min;
      r.z = rock.z + nz * min;
      if (Math.abs(r.speed) > ROCK_HIT_SPEED) {
         if (r.invulnerable <= 0) {
            spendLife(run);
            ev.rockHit = true;
         }
         r.speed = -0.3 * r.speed;
      }
   }

   // boulders roll south down their lanes; the swept box test cannot tunnel at any frame rate
   for (const b of run.boulders) {
      const bdz = b.speed * h;
      ROVER_BOX.min.x = px - ROVER.boxHalf;
      ROVER_BOX.max.x = px + ROVER.boxHalf;
      ROVER_BOX.min.z = pz - ROVER.boxHalf;
      ROVER_BOX.max.z = pz + ROVER.boxHalf;
      BOULDER_BOX.min.x = b.x - BOULDER_RADIUS;
      BOULDER_BOX.max.x = b.x + BOULDER_RADIUS;
      BOULDER_BOX.min.z = b.z - BOULDER_RADIUS;
      BOULDER_BOX.max.z = b.z + BOULDER_RADIUS;
      REL.x = r.x - px;
      REL.z = r.z - pz - bdz;
      if (sweptAabbXZ(ROVER_BOX, REL, BOULDER_BOX) !== null && r.invulnerable <= 0) {
         spendLife(run);
         ev.boulderHit = true;
         r.speed = -0.3 * r.speed;
      }
      b.z += bdz;
      b.rolled += bdz;
      if (b.z > b.maxZ) b.z = b.minZ;
   }
   if (run.lives <= 0) {
      run.lives = 0;
      r.speed = 0;
      run.over = "lose";
      ev.lost = true;
      return;
   }

   // battery: a charge while stopped on a pad, else the drain
   const stopped = Math.abs(r.speed) < SCAN_SPEED_MAX;
   let onPad = false;
   for (const ch of run.chargers) if (dist(r.x, r.z, ch.x, ch.z) <= CHARGER_PAD_RADIUS) onPad = true;
   run.charging = onPad && stopped;
   if (run.charging) {
      ev.charging = true;
      r.battery = Math.min(100, r.battery + CHARGE_RATE * h);
   } else {
      r.battery -= IDLE_DRAIN * h + DRIVE_DRAIN * Math.abs(r.speed) * h * run.level.drainScale;
      if (r.battery <= 0) {
         r.battery = 0;
         r.speed = 0;
         run.over = "lose";
         ev.lost = true;
         return;
      }
   }

   // scans: stopped inside a ring for 1.00 s; each site pays once
   for (const site of run.sites) {
      if (site.scanned) continue;
      const d = dist(r.x, r.z, site.x, site.z);
      if (d <= SITE_RING_RADIUS && stopped) {
         site.holdTime += h;
         if (site.holdTime >= SCAN_HOLD_S - 1e-9) {
            site.scanned = true;
            run.samplesScanned += 1;
            const centre = d <= CENTER_BONUS_RADIUS;
            const pts = BASE_SCAN_SCORE + (centre ? CENTER_BONUS_SCORE : 0);
            run.score += pts;
            ev.score += pts;
            ev.siteScanned = site.index;
            ev.centerBonus = centre;
         }
      } else site.holdTime = 0;
   }

   // the win: every site scanned, then parked on the base pad for 0.6 s
   if (run.samplesScanned === run.sites.length && dist(r.x, r.z, run.basePad.x, run.basePad.z) <= run.basePad.radius && stopped) {
      run.baseHoldTime += h;
      if (run.baseHoldTime >= WIN_HOLD_S - 1e-9) {
         run.over = "win";
         ev.won = true;
         const timeLeft = run.level.durationMs / 1000 - run.time;
         const bonus = timeBonus(timeLeft);
         const capped = capScore(run.score + bonus, run.time * 1000, PROPOSED_LEVEL_LIMITS[run.levelId]);
         ev.timeBonus = capped - run.score;
         ev.score += ev.timeBonus;
         run.score = capped;
      }
   } else run.baseHoldTime = 0;
}

/** One frame (dt = the run clock's play time). Mutates `run`, returns its event object (reused). */
export function step(run: Run, input: MarsInput, dt: number): StepEvents {
   const ev = run.ev;
   resetEvents(ev);
   if (!(dt > 0) || run.over) return ev;
   run.time += dt;
   const throttle = Math.max(0, -axis(input.moveY));
   const brake = Math.max(0, axis(input.moveY));
   const steer = axis(input.moveX);
   run.acc += dt;
   let n = 0;
   while (run.acc >= ROVER.fixedStep - 1e-12 && n < 8 && !run.over) {
      run.acc -= ROVER.fixedStep;
      n++;
      substep(run, throttle, brake, steer, ROVER.fixedStep);
   }
   if (n === 8) run.acc = Math.min(run.acc, ROVER.fixedStep);
   if (!run.over && run.time >= run.level.durationMs / 1000) {
      run.over = "timeup";
   }
   return ev;
}

/** What the store last got (-1 = never): the Scene and the bots push score and stats only on a change. */
export interface StoreSync {
   score: number;
   samples: number;
   battery: number;
}

export function createStoreSync(): StoreSync {
   return { score: -1, samples: -1, battery: -1 };
}

/** The frame the Scene and the bots both run: step, then hand the result to the store. */
export function frame(run: Run, input: MarsInput, dt: number, store: StoreApi<ArcadeStore>, sync: StoreSync): StepEvents {
   const ev = step(run, input, dt);
   const s = store.getState();
   if (sync.score !== run.score) s.setScore((sync.score = run.score));
   if (sync.samples !== run.samplesScanned) s.setStat("samples", (sync.samples = run.samplesScanned));
   const battery = Math.round(run.rover.battery);
   if (sync.battery !== battery) s.setStat("battery", (sync.battery = battery));
   if (ev.lifeLost) s.loseLife();
   if (run.over === "win") s.end("win");
   else if (run.over === "lose") s.end("lose");
   else if (run.over === "timeup") s.end("timeup");
   return ev;
}
