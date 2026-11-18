// The honest bot (tests, and `?autoplay=1` on preview builds): it plays through the same StepInput
// a player has. In a cannon it plans a shot by trying candidate (pitch, fire moment) pairs on a copy
// of the run (rules.ts copyRun) and keeps the fastest one that ends where its route leg wants (the
// next cannon, a platform, a balloon, the finish ring), counting the orbs it takes on the way. Then
// it turns the barrel with the stick at the real turn rates and presses Jump on the planned frame,
// after checking that very press on a copy (the press fires at the next rules ms, whatever the frame
// length). On a platform it walks to the orbs and into the next cannon. Level 5's stage: it reads
// Ashbag's next window from a copy of the boss machine and fires through the pod, bounces into the
// gondola, or rides the auto chain and roll-dives into the valve. No power is used.
import { stepBoss, createBossEvents } from "@/arcade3d/menu2/boss/boss";
import {
   AIM_TIMEOUT_MS,
   AUTO_FIRE_MS,
   G,
   HERO_R,
   NONE,
   PITCH_MAX,
   PITCH_MIN,
   PITCH_RATE,
   VALVE_DY,
   YAW_RANGE,
   YAW_RATE,
   bossWindowSpot,
   cannonPos,
   copyRun,
   createStepInput,
   powerForSpeed,
   pulseAt,
   pulseWaitMs,
   step,
   wheelYaw,
   type CannonRun,
   type StepInput,
} from "./rules";
import { ASHBAG } from "./progression";
import { DEG, yawTowards, type Leg, type SpotDef } from "./show";

export interface BotShot {
   yaw: number;
   pitch: number;
   /** the aim ms (since the aim opened) to fire at */
   fireAt: number;
   /** dive when over Ashbag's valve (P3) */
   valveDive: boolean;
   /** the planned outcome's rules ms (for tests) and the main orbs it takes */
   arriveMs: number;
   main: number;
}

export interface Bot {
   frameMs: number;
   leg: number;
   shot: BotShot | null;
   /** the aim the shot was planned for (aimFrom) */
   shotFor: number;
   /** failed plans in a row at this aim (the bot then fires anything that stays safe) */
   misses: number;
   scratch: CannonRun | null;
   probe: CannonRun | null;
   /** level 5: the stage cannon the bot is walking to, and when to go */
   stageCannon: number;
   /** P3 dive in progress */
   diving: boolean;
   /** when to plan again after a plan found nothing */
   retryAt: number;
}

export function createBot(run: CannonRun, frameMs = 1000 / 60): Bot {
   void run;
   return { frameMs, leg: 0, shot: null, shotFor: NONE, misses: 0, scratch: null, probe: null, stageCannon: NONE, diving: false, retryAt: 0 };
}

const IDLE = createStepInput();
const PRESS: StepInput = { ...createStepInput(), jumpPressed: true, jumpHeld: true };
const HOLD: StepInput = { ...createStepInput(), jumpHeld: true };
const BOSS_EV = createBossEvents();
const P = { x: 0, y: 0, z: 0 };
const CENTRE: SpotDef = { x: 0, y: 0, z: 0 };
const PART: SpotDef = { x: 0, y: 0, z: 0 };

/** What a simulated flight ended in. */
interface Outcome {
   kind: "cannon" | "platform" | "balloon" | "finish" | "lost" | "none";
   index: number;
   ms: number;
   orbs: number;
   main: number;
   bossHit: boolean;
   defeated: boolean;
}

/** Jumps a copy's clock forward without input (its aim stays open; the boss machine runs). */
function skipTo(sim: CannonRun, ms: number): void {
   const d = ms - sim.simMs;
   if (d <= 0) return;
   if (sim.boss && sim.arenaAt !== NONE) stepBoss(sim.boss, ASHBAG, d, BOSS_EV);
   sim.simMs = ms;
}

/** Is the hero over the valve so a dive now lands in it (P3 policy, the same in the copy and live)? */
function overValve(run: CannonRun): boolean {
   const b = run.boss;
   if (!b || b.phase < 2) return false;
   const a = run.course.arena!;
   const h = run.hero;
   const vx = a.topSpot.x;
   const vz = a.topSpot.z;
   const vy = a.topSpot.y + VALVE_DY;
   // dive just before passing over it (the dive pulls straight down at 50 m/s^2)
   const d = Math.hypot(h.x - vx, h.z - vz);
   const closing = (h.x - vx) * h.vx + (h.z - vz) * h.vz < 0;
   return d < (closing ? 1.6 : 0.9) && h.y > vy && h.y < vy + 4;
}

/** Steps a copy in flight (and through auto cannons on the P3 chain) until the flight settles. */
function flyOut(sim: CannonRun, base: CannonRun, chain: boolean, maxMs = 6000): Outcome {
   const out: Outcome = { kind: "none", index: NONE, ms: 0, orbs: 0, main: 0, bossHit: false, defeated: false };
   let diving = false;
   for (let t = 0; t < maxMs && sim.ended === null; t++) {
      const h = sim.hero;
      let input = IDLE;
      if (chain && h.mode === "aim" && h.cannon >= 0 && sim.course.cannons[h.cannon].kind === "auto") input = PRESS;
      if (chain && h.mode === "fly") {
         if (!diving && overValve(sim)) {
            diving = true;
            input = PRESS;
         } else if (diving) input = HOLD;
      } else diving = false;
      const ev = step(sim, 1, input);
      if (ev.bossHit) out.bossHit = true;
      if (ev.bossDefeated || ev.finished) {
         out.defeated = ev.bossDefeated;
         out.kind = ev.finished && !ev.bossDefeated ? "finish" : out.kind;
         out.ms = sim.simMs;
         if (ev.bossDefeated) out.kind = "finish";
         break;
      }
      if (ev.lost) {
         out.kind = "lost";
         out.ms = sim.simMs;
         break;
      }
      if (ev.caught >= 0) {
         const c = sim.course.cannons[ev.caught];
         if (chain && c.kind === "auto") continue;
         out.kind = "cannon";
         out.index = ev.caught;
         out.ms = sim.simMs;
         break;
      }
      if (ev.landed >= 0) {
         out.kind = "platform";
         out.index = ev.landed;
         out.ms = sim.simMs;
         break;
      }
      if (ev.balloon >= 0) {
         out.kind = "balloon";
         out.index = ev.balloon;
         out.ms = sim.simMs;
         break;
      }
   }
   out.orbs = sim.orbs - base.orbs;
   out.main = sim.mainOrbs - base.mainOrbs;
   return out;
}

interface Goal {
   /** the analytic aim point (the arc's target) */
   x: number;
   y: number;
   z: number;
   /** does an outcome satisfy the leg? */
   ok: (o: Outcome, sim: CannonRun) => boolean;
   /** rules-ms window the hit must land in (boss) */
   chain: boolean;
   /** the aim point moves (a rail cannon): it is re-read at the guessed arrival */
   cannon: number;
}

/** The speed that carries an arc (d across, dy up) at `pitch`, or NaN. */
function speedFor(d: number, dy: number, pitch: number): number {
   const c = Math.cos(pitch);
   const den = 2 * c * c * (d * Math.tan(pitch) - dy);
   if (!(den > 0)) return Number.NaN;
   return Math.sqrt((G * d * d) / den);
}

function angleDiff(a: number, b: number): number {
   return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function turnMs(run: CannonRun, yaw: number, pitch: number, frameMs: number): number {
   const h = run.hero;
   const ty = Math.abs(angleDiff(yaw, h.yaw)) / YAW_RATE;
   const tp = Math.abs(pitch - h.pitch) / PITCH_RATE;
   return Math.max(ty, tp) * 1000 + frameMs * 1.5;
}

/** Tries one candidate shot on a copy: aim (yaw, pitch), fire at aim ms `fireAt`. */
function tryShot(bot: Bot, run: CannonRun, yaw: number, pitch: number, fireAt: number, goal: Goal): Outcome | null {
   const h = run.hero;
   const fireMs = h.aimFrom + fireAt;
   if (fireMs <= run.simMs) return null;
   const sim = (bot.scratch = copyRun(run, bot.scratch));
   skipTo(sim, fireMs - 1);
   sim.hero.yaw = yaw;
   sim.hero.pitch = pitch;
   step(sim, 1, PRESS);
   if (sim.hero.mode !== "fly") return null;
   const o = flyOut(sim, run, goal.chain);
   return goal.ok(o, sim) ? o : null;
}

/** Where the goal's cannon will be about `ms` from now. */
function goalPoint(run: CannonRun, goal: Goal, atMs: number): { x: number; y: number; z: number } {
   if (goal.cannon >= 0) {
      cannonPos(run.course.cannons[goal.cannon], atMs, P);
      return { x: P.x, y: P.y, z: P.z };
   }
   return { x: goal.x, y: goal.y, z: goal.z };
}

function shotScore(o: Outcome): number {
   // the bot plays for the clock and every colour orb (the all-orbs star weighs the main ones in)
   return o.ms - 400 * o.orbs - 1500 * o.main;
}

/** Plans the shot out of the current aim (null when nothing reaches the goal). */
export function planShot(bot: Bot, run: CannonRun, goal: Goal, latestMs = Infinity): BotShot | null {
   const h = run.hero;
   const c = h.cannon >= 0 ? run.course.cannons[h.cannon] : null;
   const kind = c ? c.kind : "aim";
   const now = run.simMs - h.aimFrom;
   let best: { o: Outcome; shot: BotShot } | null = null;
   const consider = (yaw: number, pitch: number, fireAt: number) => {
      if (fireAt <= now || fireAt >= AIM_TIMEOUT_MS) return;
      if (kind === "auto" && fireAt > AUTO_FIRE_MS) return;
      const o = tryShot(bot, run, yaw, pitch, fireAt, goal);
      if (!o || o.ms > latestMs) return;
      if (!best || shotScore(o) < shotScore(best.o)) best = { o, shot: { yaw, pitch, fireAt, valveDive: goal.chain, arriveMs: o.ms, main: o.main } };
   };
   if (kind === "aim") {
      for (let deg = 20; deg <= 70; deg += 2.5) {
         const pitch = deg * DEG;
         // the target where it will be: guess the flight, re-read the moving cannon, twice
         let flight = 1000;
         let aimYaw = h.yaw;
         let speed = Number.NaN;
         for (let it = 0; it < 3; it++) {
            const g = goalPoint(run, goal, run.simMs + 300 + flight);
            const d = Math.hypot(g.x - h.x, g.z - h.z);
            aimYaw = yawTowards(h.x, h.z, g.x, g.z);
            speed = speedFor(d, g.y - h.y, pitch);
            if (!Number.isFinite(speed)) break;
            flight = (d / (speed * Math.cos(pitch))) * 1000;
         }
         if (!Number.isFinite(speed)) continue;
         if (c && Math.abs(angleDiff(aimYaw, c.yaw)) > YAW_RANGE) continue;
         const power = powerForSpeed(speed);
         if (power < 0.6 || power > 1) continue;
         const w = pulseWaitMs(power);
         const earliest = now + turnMs(run, aimYaw, pitch, bot.frameMs);
         for (const f0 of [w, 1200 - w, 1200 + w, 2400 - w]) {
            for (const df of [0, -6, 6]) {
               const f = Math.round(f0 + df);
               if (f < earliest) continue;
               consider(aimYaw, pitch, f);
            }
         }
      }
   } else if (c) {
      // locked aim: only the moment is chosen (a wheel's yaw sweeps with it)
      const from = Math.max(now + 1, Math.ceil(bot.frameMs));
      const until = kind === "auto" ? AUTO_FIRE_MS : AIM_TIMEOUT_MS - 1;
      const stepMs = kind === "fixed" ? until : kind === "auto" ? 25 : 8;
      for (let f = from; f <= until; f += stepMs) {
         const yaw = wheelYaw(c, h.aimFrom + f);
         consider(yaw, c.pitch, f);
         if (kind === "auto" && best) break;
      }
      if (kind === "auto" && !best) consider(c.yaw, c.pitch, AUTO_FIRE_MS - 1);
   }
   return best ? (best as { shot: BotShot }).shot : null;
}

/** The goal of the current route leg (levels 1-4 and the run-in of level 5). */
function legGoal(run: CannonRun, leg: Leg): Goal | null {
   const c = run.course;
   switch (leg.to) {
      case "cannon": {
         const k = c.cannons[leg.i];
         const ok = (o: Outcome) => o.kind === "cannon" && o.index === leg.i;
         if (leg.via >= 0) {
            // aim at the trampoline: the bounce carries on into the cannon
            const t = c.tramps[leg.via];
            return { x: t.x, y: t.y + HERO_R, z: t.z, cannon: NONE, chain: false, ok };
         }
         return { x: k.x, y: k.y, z: k.z, cannon: k.rail ? leg.i : NONE, chain: false, ok };
      }
      case "platform": {
         const p = c.platforms[leg.i];
         return { x: p.x, y: p.y + HERO_R, z: p.z, cannon: NONE, chain: false, ok: (o) => o.kind === "platform" && o.index === leg.i };
      }
      case "balloon": {
         const b = c.balloons[leg.i];
         return { x: b.x, y: b.y, z: b.z, cannon: NONE, chain: false, ok: (o) => o.kind === "balloon" && o.index === leg.i };
      }
      case "finish": {
         const f = c.finish!;
         return { x: f.x, y: f.y, z: f.z, cannon: NONE, chain: false, ok: (o) => o.kind === "finish" };
      }
      default:
         return null;
   }
}

/** The next boss window from now: its start, end, phase and attack (from a copy of the machine). */
export function nextWindow(run: CannonRun): { start: number; end: number; phase: number; attack: number } | null {
   const b = run.boss;
   if (!b || run.arenaAt === NONE) return null;
   if (b.step === "defeat" || b.step === "done") return null;
   const atk = ASHBAG.phases[b.phase].attacks[0];
   const now = run.simMs;
   if (b.step === "vulnerable") return { start: now, end: now + (atk.vulnerableMs - b.stepMs), phase: b.phase, attack: b.attack };
   let rest = 0;
   if (b.step === "intro") rest = ASHBAG.introMs - b.stepMs + atk.telegraphMs + atk.attackMs;
   else if (b.step === "transition") rest = ASHBAG.transitionMs - b.stepMs + atk.telegraphMs + atk.attackMs;
   else if (b.step === "telegraph") rest = atk.telegraphMs - b.stepMs + atk.attackMs;
   else rest = atk.attackMs - b.stepMs;
   const attack = b.step === "intro" || b.step === "transition" ? 0 : b.attack;
   return { start: now + rest, end: now + rest + atk.vulnerableMs, phase: b.phase, attack };
}

/** The boss goal for the window: the pod, the gondola (via its trampoline) or the valve (via the chain). */
function bossGoal(run: CannonRun, win: { phase: number; attack: number; start: number; end: number }): Goal {
   bossWindowSpot(run, win.phase, win.attack, CENTRE, PART);
   const a = run.course.arena!;
   if (win.phase === 0) return { x: PART.x, y: PART.y, z: PART.z, cannon: NONE, chain: false, ok: (o) => o.bossHit };
   if (win.phase === 1) {
      const t = run.course.tramps[a.tramps[win.attack % a.tramps.length]];
      return { x: t.x, y: t.y + HERO_R, z: t.z, cannon: NONE, chain: false, ok: (o) => o.bossHit };
   }
   const c0 = run.course.cannons[a.chain[0]];
   return { x: c0.x, y: c0.y, z: c0.z, cannon: NONE, chain: true, ok: (o) => o.defeated };
}

/** The stage cannon best placed for a boss goal: inside its yaw range, about 6.5 m off it across. */
function bestStageCannon(run: CannonRun, gx: number, gz: number, avoid: number): number {
   const a = run.course.arena!;
   let best = NONE;
   let bestD = Infinity;
   for (const i of a.cannons) {
      if (i === avoid) continue;
      const c = run.course.cannons[i];
      const yaw = yawTowards(c.x, c.z, gx, gz);
      if (Math.abs(angleDiff(yaw, c.yaw)) > YAW_RANGE - 3 * DEG) continue;
      // a cannon's shortest shot carries about 4.6 m: prefer one about 6.5 m off the goal
      const d = Math.abs(Math.hypot(c.x - gx, c.z - gz) - 6.5);
      if (d < bestD) {
         bestD = d;
         best = i;
      }
   }
   return best;
}

function walkTo(input: StepInput, run: CannonRun, x: number, z: number): void {
   const h = run.hero;
   const dx = x - h.x;
   const dz = z - h.z;
   const d = Math.hypot(dx, dz);
   if (d < 0.05) return;
   const k = Math.min(1, d / 0.25);
   input.moveX = (dx / d) * k;
   input.moveZ = (dz / d) * k;
}

function advanceLeg(bot: Bot, run: CannonRun): void {
   const ev = run.events;
   const route = run.course.route;
   const leg = route[bot.leg];
   if (!leg) return;
   const done =
      (leg.to === "cannon" && ev.caught === leg.i) ||
      (leg.to === "platform" && ev.landed === leg.i) ||
      (leg.to === "balloon" && ev.balloon === leg.i);
   if (done) bot.leg += 1;
}

/** The safest fallback: fire back onto the nearest platform, else at the leg anyway. */
function fallbackShot(bot: Bot, run: CannonRun): BotShot | null {
   for (let i = 0; i < run.course.platforms.length; i++) {
      const p = run.course.platforms[i];
      const s = planShot(bot, run, { x: p.x, y: p.y + HERO_R, z: p.z, cannon: NONE, chain: false, ok: (o) => o.kind === "platform" && o.index === i });
      if (s) return s;
   }
   return null;
}

/** One frame of bot input (yaw 0: world-space stick). */
export function botInput(bot: Bot, run: CannonRun, input: StepInput): void {
   input.moveX = 0;
   input.moveZ = 0;
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   advanceLeg(bot, run);
   const h = run.hero;
   const route = run.course.route;
   const leg = route[Math.min(bot.leg, route.length - 1)];
   if (h.mode === "fly") {
      if (bot.shot?.valveDive) {
         if (!bot.diving && overValve(run)) {
            bot.diving = true;
            input.jumpPressed = true;
            input.jumpHeld = true;
         } else if (bot.diving) input.jumpHeld = true;
      }
      return;
   }
   bot.diving = false;
   if (h.mode === "walk") {
      walkFrame(bot, run, input, leg);
      return;
   }
   if (h.mode !== "aim") return;
   // an auto cannon on the P3 chain: fire as soon as it opens
   const c = h.cannon >= 0 ? run.course.cannons[h.cannon] : null;
   if (c && c.kind === "auto" && leg.to === "boss" && bot.shot?.valveDive) {
      input.jumpPressed = true;
      input.jumpHeld = true;
      return;
   }
   if (bot.shotFor !== h.aimFrom || (!bot.shot && run.simMs >= bot.retryAt)) {
      bot.shotFor = h.aimFrom;
      bot.shot = makePlan(bot, run, leg);
      bot.misses = 0;
      // nothing reaches from here yet (a boss window still far off): look again a little later
      bot.retryAt = run.simMs + 250;
   }
   const shot = bot.shot;
   if (!shot) return;
   // turn the barrel (exact on the last frame)
   const dt = Math.max(1, bot.frameMs);
   if (!c || c.kind === "aim") {
      const ey = angleDiff(shot.yaw, h.yaw);
      const ep = shot.pitch - h.pitch;
      input.moveX = Math.max(-1, Math.min(1, -ey / ((YAW_RATE * dt) / 1000)));
      input.moveZ = Math.max(-1, Math.min(1, -ep / ((PITCH_RATE * dt) / 1000)));
      if (Math.abs(input.moveX) < 0.16) input.moveX = Math.abs(ey) > 0.002 ? Math.sign(input.moveX) * 0.16 : 0;
      if (Math.abs(input.moveZ) < 0.16) input.moveZ = Math.abs(ep) > 0.002 ? Math.sign(input.moveZ) * 0.16 : 0;
   }
   const next = run.simMs + 1 - h.aimFrom;
   if (next + dt / 2 < shot.fireAt) return;
   // check this very press on a copy (the aim as it stands, the pulse at the next ms)
   const goal = leg.to === "boss" ? null : legGoal(run, leg);
   const sim = (bot.probe = copyRun(run, bot.probe));
   step(sim, 1, PRESS);
   let good = sim.hero.mode === "fly";
   if (good) {
      const o = flyOut(sim, run, shot.valveDive);
      good = goal ? goal.ok(o, sim) && o.main >= shot.main : o.kind !== "lost" || o.bossHit;
      if (leg.to === "boss") good = o.bossHit || o.kind === "platform" || o.kind === "cannon";
   }
   if (good || next > shot.fireAt + dt + 40) {
      if (good) {
         input.moveX = 0;
         input.moveZ = 0;
         input.jumpPressed = true;
         input.jumpHeld = true;
      } else {
         // the moment passed: plan again from here
         bot.misses += 1;
         bot.shot = makePlan(bot, run, leg);
      }
   }
}

function makePlan(bot: Bot, run: CannonRun, leg: Leg): BotShot | null {
   if (leg.to === "boss") return bossPlan(bot, run);
   const goal = legGoal(run, leg);
   const s = goal ? planShot(bot, run, goal) : null;
   return s ?? fallbackShot(bot, run);
}

function bossPlan(bot: Bot, run: CannonRun): BotShot | null {
   const a = run.course.arena;
   if (!a) return null;
   if (run.arenaAt === NONE) {
      // the run-in's last shot: onto the stage (any stage cannon will do too)
      const stage = run.course.platforms[a.platform];
      return planShot(bot, run, { x: stage.x, y: stage.y + HERO_R, z: stage.z + stage.hw * 0.5, cannon: NONE, chain: false, ok: (o) => (o.kind === "platform" && o.index === a.platform) || (o.kind === "cannon" && a.cannons.includes(o.index)) });
   }
   const win = nextWindow(run);
   if (!win) return null;
   const goal = bossGoal(run, win);
   const s = planShot(bot, run, goal, win.end);
   if (s) return s;
   // not this window from here: drop back onto the stage
   const stage = run.course.platforms[a.platform];
   return planShot(bot, run, { x: stage.x, y: stage.y + HERO_R, z: stage.z, cannon: NONE, chain: false, ok: (o) => o.kind === "platform" && o.index === a.platform });
}

function walkFrame(bot: Bot, run: CannonRun, input: StepInput, leg: Leg): void {
   const h = run.hero;
   const course = run.course;
   const p = course.platforms[h.support];
   // the main orbs on this platform first (active rain included)
   let ox = 0;
   let oz = 0;
   let od = Infinity;
   for (let i = 0; i < course.orbs.length; i++) {
      const o = course.orbs[i];
      if (run.collected[i] || o.kind !== "main" || o.hidden) continue;
      if (o.pod >= 0 && !run.pods[o.pod]) continue;
      if (Math.abs(o.y - h.y) > 0.8) continue;
      if (Math.abs(o.x - p.x) > p.hw + 0.3 || Math.abs(o.z - p.z) > p.hd + 0.3) continue;
      const d = Math.hypot(o.x - h.x, o.z - h.z);
      if (d < od) {
         od = d;
         ox = o.x;
         oz = o.z;
      }
   }
   if (leg.to === "boss" && course.arena) {
      const win = nextWindow(run);
      if (!win) return;
      bossWindowSpot(run, win.phase, win.attack, CENTRE, PART);
      let gx = PART.x;
      let gz = PART.z;
      if (win.phase === 1) {
         const t = course.tramps[course.arena.tramps[win.attack % course.arena.tramps.length]];
         gx = t.x;
         gz = t.z;
      } else if (win.phase === 2) {
         const c0 = course.cannons[course.arena.chain[0]];
         gx = c0.x;
         gz = c0.z;
      }
      const jammed = (i: number) => run.jamUntil[i] > run.simMs + 600 || run.bombMark === i;
      let k = bestStageCannon(run, gx, gz, NONE);
      if (k >= 0 && jammed(k)) k = bestStageCannon(run, gx, gz, k);
      if (k < 0) return;
      cannonPos(course.cannons[k], run.simMs, P);
      const walk = (Math.hypot(P.x - h.x, P.z - h.z) * 1000) / 4;
      // the shot itself: about 1.4 s (P3: the chain's 4 catches and flights, about 5 s)
      const lead = walk + 400 + (win.phase === 2 ? 5600 : 1400);
      const goAt = win.start - lead;
      const viaOrb = od < Infinity ? ((od + Math.hypot(P.x - ox, P.z - oz)) * 1000) / 4 : Infinity;
      if (od < Infinity && run.simMs + viaOrb + 400 + (win.phase === 2 ? 5600 : 1400) < win.end - 400) {
         walkTo(input, run, ox, oz);
         return;
      }
      if (run.simMs < goAt) {
         // wait near the cannon, just out of its reach
         const dx = h.x - P.x;
         const dz = h.z - P.z;
         const d = Math.hypot(dx, dz);
         if (d > 2.2) walkTo(input, run, P.x + (dx / d) * 1.8, P.z + (dz / d) * 1.8);
         return;
      }
      walkTo(input, run, P.x, P.z);
      return;
   }
   if (od < Infinity) {
      walkTo(input, run, ox, oz);
      return;
   }
   // into the leg's cannon (else the nearest cannon this platform carries)
   let target = leg.to === "cannon" ? leg.i : NONE;
   if (target < 0) {
      let bd = Infinity;
      for (let i = 0; i < course.cannons.length; i++) {
         cannonPos(course.cannons[i], run.simMs, P);
         const d = Math.hypot(P.x - h.x, P.z - h.z);
         if (Math.abs(P.y - h.y) < 1.2 && d < bd) {
            bd = d;
            target = i;
         }
      }
   }
   if (target < 0) return;
   cannonPos(course.cannons[target], run.simMs, P);
   walkTo(input, run, P.x, P.z);
}

export { PITCH_MIN, PITCH_MAX, pulseAt };
