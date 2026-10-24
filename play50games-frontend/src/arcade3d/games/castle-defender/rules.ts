import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type CastleLevel } from "./levels";
import { bufferFire, clampTo, createAxisAim, createBufferedFire, stepAimKeys, type AxisAimInput } from "@/arcade3d/core/aim";
import { landingPoint, launchForTime, trajectoryPoints, type Projectile } from "@/arcade3d/core/ballistics";
import { circlesOverlapXZ } from "@/arcade3d/core/collision";
import { rngNext } from "@/arcade3d/core/math";
import { advance, createPath, pointAt, tangentAt, type RiderState } from "@/arcade3d/core/path";
import { MUZZLE } from "./assets";

export const TUNING = {
   hp: 100, repair: 25, reload: 1.1, reloadFactor: 0.85, radius: 1.2, splashFactor: 1.25,
   gravity: 9.81, climb: 2, rockCooldown: 8, rockBuffer: 1, rockHeight: 3,
   kill: 20, clear: 200, bonus: 2, period: 28, clearAt: 24, spawnSpan: 8,
   safety: 139.9, bodyRadius: 0.3, rearAim: 0.65, snap: 0.7, banner: 1.6, resultDelayMs: 1600,
   rearOffset: 0.8, lateral: 0.65, laneLength: 8.8, aimError: 0.6,
   comboMultipliers: [1, 1, 1.5, 2, 2.5, 3], comboLostDuration: 1.2,
} as const;
export const TYPES = {
   walker: { hp: 1, speed: 0.7, damage: 5 },
   shield: { hp: 2, speed: 0.7, damage: 8 },
   runner: { hp: 1, speed: 1.2, damage: 5 },
   crew: { hp: 1, speed: 0.7, damage: 5 },
} as const;
export type Kind = keyof typeof TYPES;
export type Upgrade = "reload" | "splash" | "repair" | "double";
export const UPGRADE_NAMES: readonly Upgrade[] = ["reload", "splash", "repair", "double"];
export const COUNTS = LEVELS[1].counts;
export const STARTS = [0, 28, 56, 84, 112] as const;
/** Level 1 (meta.scoring): proven ceiling B = 98 * 20 * 3 + 5 * 200 + 2 * 125. */
export const PROPOSED_LIMITS = {
   kind: "points", maxScore: 7130, minDurationMs: 39000, maxDurationMs: 140000,
   base: 480, maxPointsPerSec: 56, unitLabel: "pts", display: "int",
} as const;
/**
 * Per-level limits (README "Server limits and why they hold"): maxScore = N goblins x 60 + waves x 200 + 250,
 * base = 60 x wave-1 goblins, pps = the steepest kill/clear prefix slope + 3 %, rounded up.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: today's limits, unchanged. */
   1: PROPOSED_LIMITS,
   /** L2: 102 x 60 + 5 x 200 + 250; slope 58.52; first possible loss after 33.35 s; safety end 134.9 s. */
   2: { ...PROPOSED_LIMITS, maxScore: 7370, minDurationMs: 33000, maxDurationMs: 135000, base: 600, maxPointsPerSec: 61 },
   /** L3: 128 x 60 + 6 x 200 + 250; slope 63.08; first possible loss after 36.58 s; safety end 155.9 s. */
   3: { ...PROPOSED_LIMITS, maxScore: 9130, minDurationMs: 36000, maxDurationMs: 156000, base: 480, maxPointsPerSec: 65 },
   /** L4: 151 x 60 + 7 x 200 + 250; slope 63.92; first possible loss after 35.89 s; safety end 178.4 s. */
   4: { ...PROPOSED_LIMITS, maxScore: 10710, minDurationMs: 35000, maxDurationMs: 178500, base: 480, maxPointsPerSec: 66 },
   /** L5: 162 x 60 + 8 x 200 + 250; slope 60.80; first possible loss after 30.85 s; safety end 200.4 s. */
   5: { ...PROPOSED_LIMITS, maxScore: 11570, minDurationMs: 30000, maxDurationMs: 200500, base: 480, maxPointsPerSec: 63 },
};
export const AIM = {
   x: { min: -5, max: 5, step: 0.5, rate: 6, dragGain: 0 },
   y: { min: -2, max: 6, step: 0.5, rate: 6, dragGain: 0 }, holdDelay: 0.25,
};
export const BALLISTICS = { gravity: TUNING.gravity };
export const ROCK_FLIGHT = Math.sqrt(6 / TUNING.gravity);
export const LANES = [-3, 0, 3].map((x) => createPath([{ x, y: 0, z: -6.8 }, { x, y: 0, z: 2 }]));
export const LANE_X = [-3, 0, 3] as const;
/** where the three climbers of a crew stand on their ladder (visual only: rocks hit the whole crew) */
export const CLIMB_OFFSETS = [-0.6, 0, 0.6] as const;
/** drawn ladder (half width between the rails, height from y 0.08) and climber scale: visuals only */
export const LADDER = { half: 0.9, height: 2.8, climberScale: 1.25 } as const;
const EPS = 1e-9;
export interface Goblin extends RiderState {
   speed: number; id: number; wave: number; pack: number; lane: number; kind: Kind; crew: number;
   spawn: number; lateral: number; initialS: number; hp: number;
   status: "waiting" | "ground" | "rail" | "climb" | "dead" | "escaped";
   x: number; y: number; z: number; resolvedAt: number;
}
export interface Crew { id: number; wave: number; lane: number; erected: number; destroyed: boolean; }
export interface Ball extends Projectile { active: boolean; id: number; shot: number; launched: number; impact: number; tx: number; tz: number; }
export interface StepInput extends AxisAimInput {
   coarse: boolean; point: boolean; x: number; z: number; fire: boolean; rock: boolean; choice: number;
}
export function createInput(): StepInput {
   return {
      drag: { active: false, released: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, power: 0, angle: 0, cancelled: false },
      pressed: { left: false, right: false, up: false, down: false }, moveX: 0, moveY: 0,
      coarse: false, point: false, x: 0, z: -2, fire: false, rock: false, choice: 0,
   };
}

export function generateArmy(seed: number, level: CastleLevel = LEVELS[1]): { goblins: Goblin[]; crews: Crew[] } {
   const rng = { s: seed };
   const goblins: Goblin[] = [];
   const crews: Crew[] = [];
   for (let wave = 0; wave < level.counts.length; wave++) {
      const kinds: Kind[] = [];
      for (let k = 0; k < 3; k++) for (let n = 0; n < level.counts[wave][k]; n++) kinds.push((["walker", "shield", "runner"] as const)[k]);
      for (let n = kinds.length - 1; n > 0; n--) {
         const j = Math.floor(rngNext(rng) * (n + 1));
         const a = kinds[n]; kinds[n] = kinds[j]; kinds[j] = a;
      }
      const packs: { kinds: Kind[]; crew: number }[] = [];
      for (let n = 0; n < kinds.length; n += 3) packs.push({ kinds: kinds.slice(n, n + 3), crew: -1 });
      for (let n = 0; n < level.counts[wave][3] / 3; n++) {
         const id = crews.length;
         crews.push({ id, wave, lane: -1, erected: -1, destroyed: false });
         packs.push({ kinds: ["crew", "crew", "crew"], crew: id });
      }
      for (let n = packs.length - 1; n > 0; n--) {
         const j = Math.floor(rngNext(rng) * (n + 1));
         const a = packs[n]; packs[n] = packs[j]; packs[j] = a;
      }
      const offset = Math.floor(rngNext(rng) * 3);
      let used = 0;
      for (let p = 0; p < packs.length; p++) {
         const pack = packs[p];
         let lane = (p + offset) % 3;
         if (pack.crew >= 0) {
            while (used & (1 << lane)) lane = (lane + 1) % 3;
            used |= 1 << lane;
            crews[pack.crew].lane = lane;
         }
         let leader = 0;
         for (let n = 1; n < pack.kinds.length; n++) if (TYPES[pack.kinds[n]].speed > TYPES[pack.kinds[leader]].speed) leader = n;
         let side = 0;
         for (let n = 0; n < pack.kinds.length; n++) {
            const lateral = n === leader ? 0 : (++side === 1 ? -0.65 : 0.65);
            const s = n === leader ? 0.8 : 0;
            const position = pointAt(LANES[lane], s);
            goblins.push({ id: goblins.length, wave, pack: p, kind: pack.kinds[n], crew: pack.crew, lane,
               spawn: wave * level.period + (packs.length === 1 ? 0 : 8 * p / (packs.length - 1)),
               speed: TYPES[pack.kinds[n]].speed * level.speed, lateral, initialS: s, path: LANES[lane], s, position, hp: TYPES[pack.kinds[n]].hp,
               status: "waiting", x: position.x + lateral, y: 0, z: position.z, resolvedAt: -1 });
         }
      }
   }
   return { goblins, crews };
}

export function createRun(seed: number, level: CastleLevel = LEVELS[1]) {
   const army = generateArmy(seed, level);
   const run = {
      ...army, config: level, starts: level.counts.map((_, wave) => wave * level.period),
      safety: (level.counts.length - 1) * level.period + level.clearAt + 3.9,
      waves: level.counts.map((_, wave) => army.goblins.filter((g) => g.wave === wave)),
      seed, rng: { s: seed ^ 0x93fca }, time: 0, wave: 0, hp: Number(TUNING.hp), maxHP: Number(TUNING.hp),
      killed: 0, cleared: 0, score: 0, combo: 0, comboLostAt: -10, end: null as "win" | "lose" | "timeup" | null,
      aim: createAxisAim(0, 2), fire: createBufferedFire(), ready: 0, shotId: 0,
      balls: Array.from({ length: 8 }, (): Ball => ({ active: false, id: 0, shot: 0, launched: 0, impact: 0, tx: 0, tz: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })),
      rock: { active: false, crew: -1, launched: 0, impact: 0, ready: 0, pending: false, expires: 0, target: -1 },
      stacks: [0, 0, 0, 0], offer: false, offered: -1, cards: [0, 1], chosen: -1, eligible: [0, 0, 0, 0],
      impacts: 0, launches: 0, drops: 0, damageEvents: 0, rearHits: 0, erections: 0, upgrades: 0, spawns: 0,
      lastImpact: { x: 0, y: 0.06, z: 0 }, rear: { x: 0, y: 0.07, z: 0, at: -10 },
      lastDamage: { x: 0, y: 0.6, z: 2.5 },
      target: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, tangent: { x: 0, y: 0, z: 1 },
      landing: { x: 0, y: 0, z: 0 }, preview: new Float32Array(72),
   };
   return run;
}
export type CastleRun = ReturnType<typeof createRun>;
export const reload = (run: CastleRun) => TUNING.reload * TUNING.reloadFactor ** run.stacks[0];
export const splash = (run: CastleRun) => TUNING.radius * TUNING.splashFactor ** run.stacks[1];
export const comboMultiplier = (combo: number) => TUNING.comboMultipliers[Math.min(combo, TUNING.comboMultipliers.length - 1)];
export const runScore = (killPoints: number, clears: number, won: boolean, hp: number) => killPoints + TUNING.clear * clears + (won ? TUNING.bonus * hp : 0);
export const flightTime = (x: number, z: number) => 0.6 + 0.4 * clampTo(Math.hypot(x - MUZZLE.x, z - MUZZLE.z) / 10, 0, 1);
export function predict(g: Goblin, dt: number, out: { x: number; y: number; z: number }): void {
   pointAt(g.path, g.s + g.speed * dt, out);
   out.x += g.lateral;
}
export function snapAim(run: CastleRun, x: number, z: number): void {
   let best = TUNING.snap ** 2, picked = -1;
   for (const g of run.waves[run.wave]) {
      if (g.status !== "ground") continue;
      let t = flightTime(x, z);
      for (let n = 0; n < 2; n++) { predict(g, t, run.target); t = flightTime(run.target.x, run.target.z); }
      predict(g, t, run.target);
      const d = (run.target.x - x) ** 2 + (run.target.z - z) ** 2;
      if (d < best || (d === best && (picked < 0 || g.id < picked))) { best = d; picked = g.id; }
   }
   if (picked >= 0) {
      const g = run.goblins[picked];
      let t = flightTime(x, z);
      for (let n = 0; n < 2; n++) { predict(g, t, run.target); t = flightTime(run.target.x, run.target.z); }
      predict(g, t, run.target);
      tangentAt(g.path, g.s, run.tangent);
      x = run.target.x - (g.kind === "shield" ? TUNING.rearAim * run.tangent.x : 0);
      z = run.target.z - (g.kind === "shield" ? TUNING.rearAim * run.tangent.z : 0);
   }
   run.aim.x = clampTo(x, -5, 5); run.aim.y = -clampTo(z, -6, 2);
}
export function chooseUpgrade(run: CastleRun, choice: number): void {
   if (!run.offer || run.chosen >= 0 || (choice !== 1 && choice !== 2)) return;
   const k = run.cards[choice - 1];
   run.chosen = choice - 1; run.stacks[k]++;
   run.upgrades++;
   if (k === 2) { run.maxHP = 125; run.hp = Math.min(125, run.hp + 25); }
}
function offer(run: CastleRun): void {
   run.offer = true; run.offered = run.wave; run.chosen = -1; run.fire.pending = false; run.rock.pending = false;
   let count = 0;
   for (let k = 0; k < 4; k++) if (run.stacks[k] < (k < 2 ? 2 : 1)) run.eligible[count++] = k;
   const a = Math.floor(rngNext(run.rng) * count);
   const first = run.eligible[a]; run.eligible[a] = run.eligible[--count];
   const second = run.eligible[Math.floor(rngNext(run.rng) * count)];
   run.cards[0] = Math.min(first, second); run.cards[1] = Math.max(first, second);
}
function kill(run: CastleRun, g: Goblin): void {
   if (g.status === "dead" || g.status === "escaped") return;
   g.hp = 0; g.status = "dead"; g.resolvedAt = run.time; run.killed++;
   run.score += Math.round(TUNING.kill * comboMultiplier(run.combo));
}
function resetCombo(run: CastleRun): void {
   if (run.combo >= 2) run.comboLostAt = run.time;
   run.combo = 0;
}
export function impact(run: CastleRun, x: number, z: number, balls = 1): void {
   const radius = splash(run);
   let hits = 0, kills = 0;
   run.target.x = x; run.target.z = z;
   for (const g of run.waves[run.wave]) {
      if (g.status !== "ground" || !circlesOverlapXZ(g, 0, run.target, radius)) continue;
      hits++;
      tangentAt(g.path, g.s, run.tangent);
      const rear = (x - g.x) * run.tangent.x + (z - g.z) * run.tangent.z < 0;
      g.hp -= balls * (g.kind === "shield" && !rear ? 0.5 : 1);
      if (g.kind === "shield" && rear) { run.rearHits++; run.rear.x = g.x; run.rear.z = g.z; run.rear.at = run.time; }
      if (g.hp <= 0) {
         if (kills++ === 0) run.combo++;
         kill(run, g);
      }
   }
   if (hits === 0) resetCombo(run);
}
function launch(run: CastleRun): void {
   const x = run.fire.x, z = run.fire.y;
   const t = flightTime(x, z);
   run.target.x = x; run.target.y = 0; run.target.z = z;
   launchForTime(MUZZLE, run.target, t, BALLISTICS, run.velocity);
   const shot = run.shotId;
   for (let n = 0; n < (run.stacks[3] ? 2 : 1); n++) {
      for (const b of run.balls) if (!b.active) {
         b.active = true; b.id = run.shotId++; b.shot = shot; b.launched = run.time; b.impact = run.time + t;
         b.x = MUZZLE.x; b.y = MUZZLE.y; b.z = MUZZLE.z;
         b.vx = run.velocity.x; b.vy = run.velocity.y; b.vz = run.velocity.z;
         landingPoint(b, BALLISTICS, 0, run.landing);
         b.tx = run.landing.x; b.tz = run.landing.z;
         trajectoryPoints(b, BALLISTICS, 24, t / 23, run.preview);
         break;
      }
   }
   run.launches++; run.ready = run.time + reload(run); run.fire.pending = false;
}
export function threatenedCrew(run: CastleRun): number {
   let id = -1, earliest = Infinity;
   for (const c of run.crews) {
      if (c.destroyed || c.erected < 0) continue;
      let living = false;
      for (const g of run.waves[run.wave]) if (g.crew === c.id && g.status === "climb") living = true;
      if (living && c.erected < earliest) { earliest = c.erected; id = c.id; }
   }
   return id;
}
function nextCrew(run: CastleRun): number {
   let id = -1, earliest = Infinity;
   for (const c of run.crews) {
      if (c.wave !== run.wave || c.destroyed) continue;
      let at = -1;
      for (const g of run.waves[run.wave]) if (g.crew === c.id && g.status !== "dead" && g.status !== "escaped") at = Math.max(at, g.spawn + (8.8 - g.initialS) / g.speed);
      if (at >= 0 && at < earliest) { earliest = at; id = c.id; }
   }
   return id;
}
function drop(run: CastleRun, crew: number): void {
   run.rock.active = true; run.rock.crew = crew; run.rock.launched = run.time;
   run.rock.impact = run.time + ROCK_FLIGHT; run.rock.ready = run.time + 8; run.rock.pending = false; run.drops++;
}
function damage(run: CastleRun, g: Goblin): void {
   resetCombo(run);
   g.status = "escaped"; g.resolvedAt = run.time;
   run.hp = Math.max(0, run.hp - TYPES[g.kind].damage); run.damageEvents++;
   run.lastDamage.x = g.x;
   if (run.hp === 0) run.end = "lose";
}
function events(run: CastleRun): void {
   if (run.end) return;
   const wave = run.waves[run.wave];
   for (const g of wave) if (g.status === "waiting" && g.spawn <= run.time + EPS) { g.status = "ground"; run.spawns++; }
   if (!run.offer && run.fire.pending && run.ready <= run.time + EPS) launch(run);
   for (const g of wave) {
      if (g.status === "ground" && g.s >= 8.8 - EPS) {
         if (g.crew >= 0) g.status = "rail"; else damage(run, g);
      } else if (g.status === "climb" && run.time >= run.crews[g.crew].erected + 2 - EPS) damage(run, g);
      if (run.end) return;
   }
   for (const c of run.crews) {
      if (c.erected >= 0 || c.destroyed) continue;
      let alive = 0, arrived = 0;
      if (c.wave !== run.wave) continue;
      for (const g of wave) if (g.crew === c.id && g.status !== "dead" && g.status !== "escaped") { alive++; if (g.status === "rail") arrived++; }
      if (alive && alive === arrived) {
         c.erected = run.time;
         run.erections++;
         let n = 0;
         for (const g of wave) if (g.crew === c.id && g.status === "rail") {
            g.status = "climb"; g.x = LANE_X[c.lane] + CLIMB_OFFSETS[n++ % 3]; g.z = 2; g.y = 0.08;
         }
      }
   }
   // Slot recycling can change array order; resolve simultaneous balls by their single-use id.
   for (;;) {
      let picked: Ball | null = null;
      for (const b of run.balls) if (b.active && b.impact <= run.time + EPS && (!picked || b.id < picked.id)) picked = b;
      if (!picked) break;
      // Double is one input/volley: both balls hit together and advance/reset combo once.
      let balls = 0;
      for (const b of run.balls) if (b.active && b.shot === picked.shot) { b.active = false; balls++; }
      impact(run, picked.tx, picked.tz, balls); run.impacts += balls;
      run.lastImpact.x = picked.tx; run.lastImpact.z = picked.tz;
   }
   if (run.rock.active && run.rock.impact <= run.time + EPS) {
      for (const g of run.waves[run.wave]) if (g.crew === run.rock.crew && g.status === "climb") kill(run, g);
      run.crews[run.rock.crew].destroyed = true; run.rock.active = false; run.impacts++;
      run.lastImpact.x = LANE_X[run.crews[run.rock.crew].lane]; run.lastImpact.z = 2;
   }
   if (run.rock.pending) {
      const c = run.crews[run.rock.target];
      if (run.time <= run.rock.expires + EPS && c?.erected >= 0 && !c.destroyed) drop(run, c.id);
      else if (run.time >= run.rock.expires - EPS) run.rock.pending = false;
   }
   let resolved = true;
   for (const g of wave) if (g.status !== "dead" && g.status !== "escaped") resolved = false;
   if (resolved && run.wave < Math.min(4, run.waves.length - 1) && run.offered !== run.wave) offer(run);
   if (run.cleared === run.wave && run.time >= run.starts[run.wave] + run.config.clearAt - EPS) {
      run.cleared++; run.score += TUNING.clear;
      if (run.wave === run.waves.length - 1 && resolved) { run.score += TUNING.bonus * run.hp; run.end = "win"; return; }
   }
   if (run.wave < run.waves.length - 1 && run.time >= run.starts[run.wave + 1] - EPS) {
      if (run.offer && run.chosen < 0) chooseUpgrade(run, 1);
      run.wave++; run.offer = false; run.fire.pending = false; run.rock.pending = false;
      run.aim.holdX = 0; run.aim.holdY = 0;
      events(run); // Spawn the next wave at its boundary even if this call still has dt left.
   }
   if (run.time >= run.safety - EPS) run.end = "timeup";
}
function advanceTime(run: CastleRun, dt: number): void {
   let left = dt;
   while (left > 1e-12 && !run.end) {
      const wave = run.waves[run.wave];
      let h = left;
      h = boundary(h, run.time, run.safety); h = boundary(h, run.time, run.starts[run.wave] + run.config.clearAt);
      if (run.wave < run.waves.length - 1) h = boundary(h, run.time, run.starts[run.wave + 1]);
      if (run.fire.pending) h = boundary(h, run.time, run.ready);
      if (run.rock.active) h = boundary(h, run.time, run.rock.impact);
      if (run.rock.pending) h = boundary(h, run.time, run.rock.expires);
      for (const b of run.balls) if (b.active) h = boundary(h, run.time, b.impact);
      for (const g of wave) {
         if (g.status === "waiting") h = boundary(h, run.time, g.spawn);
         if (g.status === "ground") h = boundary(h, run.time, run.time + (8.8 - g.s) / g.speed);
         if (g.status === "climb") h = boundary(h, run.time, run.crews[g.crew].erected + 2);
      }
      for (const g of wave) {
         if (g.status === "ground") { advance(g, g.speed * h); g.x = g.position.x + g.lateral; g.z = g.position.z; }
         if (g.status === "climb") g.y = 0.08 + clampTo((run.time + h - run.crews[g.crew].erected) / 2, 0, 1) * 2;
      }
      run.time += h; left -= h; events(run);
   }
}
function boundary(h: number, now: number, at: number): number {
   const d = at - now; return d > EPS && d < h ? d : h;
}
export function stepRun(run: CastleRun, input: StepInput, dt: number): void {
   if (run.end || !(dt > 0)) return;
   events(run);
   if (run.offer) chooseUpgrade(run, input.choice);
   else {
      // Screen-relative axes equal world x / -z with the fixed VIEW.yaws: [0] (test-pinned).
      if (!input.coarse) stepAimKeys(run.aim, input, dt, AIM);
      if (input.point) {
         if (input.coarse) snapAim(run, input.x, input.z);
         else { run.aim.x = clampTo(input.x, -5, 5); run.aim.y = -clampTo(input.z, -6, 2); }
      }
      if (input.fire) { run.fire.pending = false; bufferFire(run.fire, true, run.aim.x, -run.aim.y); }
      if (input.rock && run.time >= run.rock.ready - EPS && !run.rock.active) {
         const c = threatenedCrew(run);
         if (c >= 0) drop(run, c);
         else { run.rock.target = nextCrew(run); run.rock.pending = run.rock.target >= 0; run.rock.expires = run.time + 1; }
      }
   }
   // Constant-speed paths and analytic projectiles already split at every event boundary.
   if (!run.offer && run.fire.pending && run.ready <= run.time + EPS) launch(run);
   advanceTime(run, dt);
}
