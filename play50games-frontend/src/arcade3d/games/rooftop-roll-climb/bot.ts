// An honest climbing bot: it reads only what a player sees (the roofs, where the movers are now, the
// arcs, Ashback) and plays through step() with the stick and the jump press. Pure; used by the tests
// (the limits proof's "best real run") and by the preview-only ?autoplay=1 (Scene.tsx, screenshots).
// It never uses the hero power.
//
// The route is the course order. On a flat roof it runs at the next one and jumps on the first frame
// from which a look-ahead jump lands on it (braking instead of running off an edge). On a top deck
// before a slope it rehearses the whole descent (roll down leaning at the roof after the slope, jump at
// the lip, steer in the air) and only goes when that lands: so it waits for a gondola or a crane slab
// to swing into line, for a spark arc to go dark, or for a blinking deck to come back. On the slope it
// rolls on the roll line (where the coin is) and jumps a little before the lip, or rolls off it onto a
// chained slope. From the last climb step it rehearses the skilled line (skip the top deck, leap straight
// onto the slope's upper half) and takes it only when it beats the ordinary route (a plain copy of this
// bot rehearses that). In the boss arena it waits on its side's deck and sets off down the ramp as soon as
// a rehearsed roll meets Ashback while he is open, so it arrives as his window opens.
import { copyCombo } from "@/arcade3d/menu2/combo/combo";
import { copySecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { ACCEL, FOOT, NONE, arenaSide, createRun, createStepInput, deckOfSide, heroSpeed, onSupport, step, supportX, supportZ, type RoofRun, type StepInput, type Support } from "./rules";

export interface Bot {
   /** the frame time (ms) the look-ahead simulates with */
   frameMs: number;
   /** the highest support index stood on so far (route order) */
   reached: number;
   scratch: RoofRun;
   scratchInput: StepInput;
   /** the descent rehearsal's verdict and until when it holds (rules ms) */
   goUntil: number;
   go: boolean;
   /** the step-to-slope shortcut: the support it was planned from (NONE = none), where to land, when to jump */
   planFrom: number;
   planOn: boolean;
   planX: number;
   planLead: number;
   planZ: number;
   planJumpAt: number;
   planJumped: boolean;
   /** the arena: rolling at Ashback (committed by a rehearsal), the side it left from, until when; the next rehearsal ms */
   rush: boolean;
   rushFrom: number;
   rushUntil: number;
   rushCheckAt: number;
   /** a plain copy of this bot (no shortcut plans) that rehearses the ordinary route the plans must beat */
   base: Bot | null;
   noPlan: boolean;
   baseRun: RoofRun | null;
}

export function createBot(run: RoofRun, frameMs = 1000 / 60): Bot {
   return {
      frameMs,
      reached: 0,
      scratch: createRun(run.seed, run.level, run.heroId, { boss: run.boss !== null }),
      scratchInput: { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, actionPressed: false },
      goUntil: -1,
      go: false,
      planFrom: NONE,
      planOn: false,
      planX: 0,
      planLead: 0,
      planZ: 0,
      planJumpAt: 0,
      planJumped: false,
      rush: false,
      rushFrom: 0,
      rushUntil: 0,
      rushCheckAt: 0,
      base: null,
      noPlan: false,
      baseRun: null,
   };
}

/** Copies the mutable run state (not the course or the events) from `src` into `dst`. */
export function copyRun(src: RoofRun, dst: RoofRun): void {
   dst.simMs = src.simMs;
   dst.remainder = src.remainder;
   dst.stepMs = src.stepMs;
   dst.heroId = src.heroId;
   Object.assign(dst.hero, src.hero);
   dst.pressMs = src.pressMs;
   dst.actionMs = src.actionMs;
   dst.powerReadyAt = src.powerReadyAt;
   dst.checkpoint = src.checkpoint;
   dst.respawns = src.respawns;
   dst.collected.set(src.collected);
   dst.orbs = src.orbs;
   dst.finishMs = src.finishMs;
   copyCombo(src.combo, dst.combo);
   dst.visited.set(src.visited);
   dst.banked.set(src.banked);
   dst.broken.set(src.broken);
   copySecretTracker(src.secrets, dst.secrets);
   dst.hits = src.hits;
   dst.bestTop = src.bestTop;
   dst.ended = src.ended;
   if (src.boss && dst.boss) {
      const b = dst.boss;
      const s = src.boss;
      Object.assign(b.state, s.state);
      b.wokeMs = s.wokeMs;
      b.side = s.side;
      b.x = s.x;
      b.y = s.y;
      b.z = s.z;
      b.tankX = s.tankX;
      b.tankOn = s.tankOn;
      b.paint = s.paint;
   }
}

/** The stick towards (tx, tz): full when far, proportional within 0.4 m. */
function steerTo(run: RoofRun, tx: number, tz: number, input: StepInput): void {
   const dx = tx - run.hero.x;
   const dz = tz - run.hero.z;
   const d = Math.sqrt(dx * dx + dz * dz);
   const k = d > 0.4 ? 1 / d : 2.5;
   input.moveX = dx * k;
   input.moveZ = dz * k;
}

/** The last index on the route (the goal; the arena's far deck with the boss; extras come after). */
function routeEnd(run: RoofRun): number {
   const c = run.course;
   return c.arena ? c.arena.far : c.goal;
}

function targetOf(bot: Bot, run: RoofRun): number {
   const sup = run.course.supports;
   const r = sup[bot.reached];
   if (r && r.role === "chimney") {
      // the updraft's shortcut: straight to the block's top deck
      for (let i = bot.reached + 1; i <= routeEnd(run); i++) if (sup[i].role === "top" && sup[i].block === r.block) return i;
   }
   return Math.min(routeEnd(run), bot.reached + 1);
}

/** The roof the bot is really heading for: past a slope, the roof after it. */
function aimOf(run: RoofRun, target: number): number {
   const s = run.course.supports;
   let t = target;
   while (t < routeEnd(run) && s[t].slope && !s[t].arena) t += 1;
   return t;
}

/** Steer at a roof's centre where it is now. */
function steerAt(run: RoofRun, t: Support, input: StepInput): void {
   steerTo(run, supportX(t, run.simMs), supportZ(t, run.simMs), input);
}

/**
 * The descent: lean at the roof after the slope (that curls the ball on the slope), jump a little
 * before the lip, steer at that roof in the air. Fills `input` for one frame.
 */
function descend(run: RoofRun, aim: number, input: StepInput): void {
   const h = run.hero;
   const sup = run.course.supports;
   input.jumpPressed = false;
   steerAt(run, sup[aim], input);
   if (!h.grounded || h.support === NONE) return;
   const s = sup[h.support];
   const sl = s.slope;
   if (!sl) {
      // the top deck: head for the slope's high edge on its roll line (the coin sits on it)
      const n = sup[h.support + 1];
      if (n && n.slope && !n.arena) steerTo(run, n.cx - n.slope.dir * (n.hw - 0.6), n.cz, input);
      return;
   }
   if (!s.arena) {
      // lean straight downhill, holding the roll line (the slope's middle, where its coin is)
      const dz = Math.max(-0.6, Math.min(0.6, 2.5 * (s.cz - h.z)));
      input.moveX = sl.dir;
      input.moveZ = dz;
   }
   const lipX = s.cx + sl.dir * s.hw;
   // a chained slope just past the lip and lower: roll off the lip onto it, curled (no jump)
   const next = sup[h.support + 1];
   if (next && next.slope && next.keep && !next.arena && next.top < s.low) return;
   const lead = 0.1 + (heroSpeed(h) * 18) / 1000;
   if ((h.x - lipX) * sl.dir >= -lead) input.jumpPressed = true;
}

/** Rehearse the descent from now: does it land on `aim` (or further) without a fall within 3.5 s? */
function descentLands(bot: Bot, run: RoofRun, aim: number): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   let left = 3500;
   while (left > 0 && sim.ended === null) {
      descend(sim, aim, input);
      step(sim, bot.frameMs, input);
      left -= bot.frameMs;
      if (sim.hero.state !== "play") return false;
      if (sim.events.landedOn !== NONE) {
         const on = sim.events.landedOn;
         if (on >= aim && on <= routeEnd(run)) return true;
         // a landing on the slope itself (the run-up) is not a verdict
         if (!sim.course.supports[on].slope || on < bot.reached) return false;
      }
   }
   return sim.ended === "win";
}

/** Does a jump now, steering at the target, land on it (or beyond) within 2 s? */
function jumpLands(bot: Bot, run: RoofRun, target: number): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   const t = run.course.supports[target];
   input.jumpPressed = true;
   steerAt(sim, t, input);
   let left = 2000;
   let first = true;
   while (left > 0 && sim.ended === null) {
      step(sim, bot.frameMs, input);
      left -= bot.frameMs;
      if (first) {
         first = false;
         if (sim.hero.grounded && !sim.events.jumped) return false;
      }
      input.jumpPressed = false;
      if (sim.hero.state !== "play") return false;
      if (sim.events.landedOn !== NONE) return sim.events.landedOn >= target && sim.events.landedOn <= routeEnd(run);
      if (sim.hero.grounded) return sim.hero.support >= target && sim.hero.support <= routeEnd(run);
      steerAt(sim, t, input);
   }
   return sim.ended === "win";
}

/** Would `frames` frames of running at the target leave the ground (run off an edge)? */
function runsOff(bot: Bot, run: RoofRun, target: number, frames: number): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   input.jumpPressed = false;
   for (let i = 0; i < frames; i++) {
      steerAt(sim, sim.course.supports[target], input);
      step(sim, bot.frameMs, input);
      if (!sim.hero.grounded || sim.hero.state !== "play") return true;
   }
   return false;
}

/** Ice and fast landings need a longer brake: the stop distance, looked ahead in frames. */
function brakeFrames(bot: Bot, run: RoofRun): number {
   const h = run.hero;
   const v = Math.max(1, heroSpeed(h));
   const icy = h.grounded && h.support !== NONE && run.course.supports[h.support].slippery;
   const stopMs = (v / (icy ? ACCEL.ice : 22)) * 1000 + 140;
   return Math.min(40, Math.max(4, Math.ceil(stopMs / bot.frameMs)));
}

/** Gap between two roofs where they are right now (not a mover's whole sweep). */
function touchingNow(a: Support, b: Support, ms: number): boolean {
   const dx = Math.max(0, Math.abs(supportX(a, ms) - supportX(b, ms)) - a.hw - b.hw - 2 * FOOT);
   const dz = Math.max(0, Math.abs(supportZ(a, ms) - supportZ(b, ms)) - a.hd - b.hd - 2 * FOOT);
   return dx < 0.02 && dz < 0.02;
}

/**
 * The skilled line up a block (the bound's route): from the last climb step, skip the top deck and leap
 * straight onto the upper half of its slope. One frame of the plan: run at the landing spot until the
 * jump ms, then jump and steer at it.
 */
function planInput(plan: Plan, run: RoofRun, input: StepInput): void {
   input.jumpPressed = false;
   // in the air, lean downhill past the spot so the ball lands already rolling
   steerTo(run, plan.jumped && !run.hero.grounded ? plan.x + plan.lead : plan.x, plan.z, input);
   if (!plan.jumped && run.hero.grounded && run.simMs + 1 >= plan.jumpAt) {
      input.jumpPressed = true;
      plan.jumped = true;
   }
}

interface Plan {
   x: number;
   /** the air steer's lead past the spot (m, signed downhill) */
   lead: number;
   z: number;
   jumpAt: number;
   jumped: boolean;
}

const PLAN: Plan = { x: 0, lead: 0, z: 0, jumpAt: 0, jumped: false };

/** Rehearse a plan: the ms it lands on `aim` (or further), less 400 per coin picked up on the way; Infinity when it fails. */
function rehearsePlan(bot: Bot, run: RoofRun, slope: number, aim: number, plan: Plan): number {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   const orbs0 = sim.orbs;
   let onSlope = false;
   let left = 4000;
   while (left > 0 && sim.ended === null) {
      if (!onSlope) planInput(plan, sim, input);
      else descend(sim, aim, input);
      step(sim, bot.frameMs, input);
      left -= bot.frameMs;
      if (sim.hero.state !== "play") return Infinity;
      const on = sim.events.landedOn;
      if (on !== NONE) {
         if (on >= aim && on <= routeEnd(run)) return sim.simMs - 400 * (sim.orbs - orbs0);
         if (on === slope || (onSlope && on > slope && on < aim && sim.course.supports[on].slope)) onSlope = true;
         else return Infinity;
      }
      if (!onSlope && plan.jumped && sim.hero.grounded && sim.hero.support !== slope) return Infinity;
      if (!plan.jumped && !sim.hero.grounded) return Infinity;
   }
   return Infinity;
}

/** The ordinary route from here (a plain bot, no plans): the ms it lands on `aim` or beyond, less 400 per coin. */
function baselineMs(bot: Bot, run: RoofRun, aim: number): number {
   if (!bot.baseRun) bot.baseRun = createRun(run.seed, run.level, run.heroId, { boss: run.boss !== null });
   const sim = bot.baseRun;
   if (!bot.base) {
      bot.base = createBot(sim, bot.frameMs);
      bot.base.noPlan = true;
   }
   const b = bot.base;
   copyRun(run, sim);
   b.reached = bot.reached;
   b.goUntil = -1;
   b.go = false;
   const input = createStepInput();
   const orbs0 = sim.orbs;
   let left = 6000;
   while (left > 0 && sim.ended === null) {
      botInput(b, sim, input);
      step(sim, bot.frameMs, input);
      left -= bot.frameMs;
      if (sim.hero.state !== "play") return Infinity;
      const on = sim.events.landedOn;
      if (on !== NONE && on >= aim && on <= routeEnd(run)) return sim.simMs - 400 * (sim.orbs - orbs0);
   }
   return Infinity;
}

/** On the last climb step: pick the best shortcut plan (or none). */
function makePlan(bot: Bot, run: RoofRun, slope: number, aim: number): void {
   const s = run.course.supports[slope];
   const dir = s.slope!.dir;
   const high = s.cx - dir * s.hw;
   let best = Infinity;
   for (const f of [0.1, 0.18, 0.28, 0.38, 0.48]) for (const lead of [0, 2, 5, 12, 30]) {
      for (const wait of [0, 80, 160, 240, 320, 400, 480, 560, 640]) {
         PLAN.x = high + dir * 2 * s.hw * f;
         PLAN.lead = dir * lead;
         PLAN.z = s.cz;
         PLAN.jumpAt = run.simMs + wait;
         PLAN.jumped = false;
         const t = rehearsePlan(bot, run, slope, aim, PLAN);
         if (t < best) {
            best = t;
            bot.planX = PLAN.x;
            bot.planLead = PLAN.lead;
            bot.planZ = PLAN.z;
            bot.planJumpAt = PLAN.jumpAt;
         }
      }
   }
   bot.planOn = Number.isFinite(best) && best < baselineMs(bot, run, aim);
   bot.planJumped = false;
}

/** Roll from the deck on side `from` straight across the pad at the far deck (through Ashback's foot spot). */
function rushInput(run: RoofRun, from: number, input: StepInput): void {
   const c = run.course;
   const deck = c.supports[deckOfSide(c, 1 - from)];
   input.jumpPressed = false;
   input.moveX = deck.cx > run.hero.x ? 1 : -1;
   input.moveZ = Math.max(-0.5, Math.min(0.5, 2 * (c.arena!.z - run.hero.z)));
}

/** Rehearse a rush from now: does it hit Ashback within 3 s without being hit? */
function rushHits(bot: Bot, run: RoofRun, from: number): boolean {
   const sim = bot.scratch;
   const input = bot.scratchInput;
   copyRun(run, sim);
   let left = 3000;
   while (left > 0 && sim.ended === null) {
      rushInput(sim, from, input);
      step(sim, bot.frameMs, input);
      left -= bot.frameMs;
      if (sim.events.bossHit) return true;
      if (sim.hero.state !== "play") return false;
   }
   return false;
}

/**
 * The boss arena: wait on your side's deck; set off down the ramp as soon as a rehearsed roll would meet
 * Ashback while he is open (so it arrives as his window opens); else roll into him while he is open.
 */
function arenaInput(bot: Bot, run: RoofRun, input: StepInput): void {
   const c = run.course;
   const h = run.hero;
   const b = run.boss!;
   input.jumpPressed = false;
   if (bot.rush) {
      if (run.events.bossHit || h.state !== "play" || run.simMs > bot.rushUntil) bot.rush = false;
      else {
         rushInput(run, bot.rushFrom, input);
         return;
      }
   }
   const here = arenaSide(c, h.x);
   const onDeck = h.grounded && h.support === deckOfSide(c, here);
   if (onDeck && b.state.step !== "defeat" && b.state.step !== "done" && run.simMs >= bot.rushCheckAt) {
      bot.rushCheckAt = run.simMs + 40;
      if (rushHits(bot, run, here)) {
         bot.rush = true;
         bot.rushFrom = here;
         bot.rushUntil = run.simMs + 3000;
         rushInput(run, here, input);
         return;
      }
   }
   const st = b.state.step;
   if (st === "vulnerable" && b.side === here && h.grounded && h.support !== c.arena!.pad) {
      steerTo(run, b.x, b.z, input);
      return;
   }
   // between windows: the deck of the half you are on, or the one you are rolling towards
   let side = here;
   if (Math.abs(h.vx) > 3) side = arenaSide(c, h.x + h.vx);
   const deck = c.supports[deckOfSide(c, side)];
   steerTo(run, deck.cx, deck.cz, input);
}

/** Fills `input` for this frame. */
export function botInput(bot: Bot, run: RoofRun, input: StepInput): void {
   const h = run.hero;
   const sup = run.course.supports;
   const end = routeEnd(run);
   input.actionPressed = false;
   input.jumpPressed = false;
   if (h.grounded && h.support !== NONE && h.state === "play" && h.support <= end) {
      // a missed leap that lands lower: carry on from there (the route is still in order)
      if (h.support < bot.reached && sup[h.support].top < sup[bot.reached].top - 1) bot.reached = h.support;
      else if (h.support > bot.reached) bot.reached = h.support;
   }
   if (run.events.landedOn > bot.reached && run.events.landedOn <= end) bot.reached = run.events.landedOn;
   if (run.events.respawned) bot.reached = run.course.checkpoints[run.checkpoint];
   if (h.state !== "play") return;

   // the boss arena, once he is awake
   if (run.boss && run.boss.wokeMs !== NONE) {
      arenaInput(bot, run, input);
      return;
   }

   const target = targetOf(bot, run);
   const aim = aimOf(run, target);
   if (run.events.respawned) bot.planOn = false;
   // the shortcut: decided once on the last climb step, then followed until the slope
   if (!bot.noPlan && h.grounded && h.support !== bot.planFrom && h.support < target && sup[target].role === "top" && !sup[h.support].slope) {
      const sl = target + 1;
      bot.planFrom = h.support;
      bot.planOn = false;
      if (sl <= end && sup[sl].slope && !sup[sl].arena && sup[sl].block === sup[target].block && !sup[sl].mover) makePlan(bot, run, sl, aimOf(run, sl));
   }
   if (bot.planOn) {
      if (h.grounded && sup[h.support].slope) bot.planOn = false;
      else if (h.grounded && bot.planJumped && h.support !== bot.planFrom) bot.planOn = false;
      else {
         PLAN.x = bot.planX;
         PLAN.lead = bot.planLead;
         PLAN.z = bot.planZ;
         PLAN.jumpAt = bot.planJumpAt;
         PLAN.jumped = bot.planJumped;
         planInput(PLAN, run, input);
         bot.planJumped = PLAN.jumped;
         return;
      }
   }
   if (!h.grounded) {
      steerAt(run, sup[aim], input);
      return;
   }
   const here = sup[h.support];
   if (here.slope && !here.arena) {
      descend(run, aim, input);
      return;
   }
   if (h.support > end) {
      // an extra roof (a catch roof): jump back to the route
      steerAt(run, sup[Math.max(0, bot.reached)], input);
      if (jumpLands(bot, run, Math.max(0, bot.reached))) input.jumpPressed = true;
      return;
   }
   if (sup[target].slope && !sup[target].arena && touchingNow(here, sup[target], run.simMs)) {
      // the top deck before a slope: go only when the rehearsed descent lands
      if (run.simMs > bot.goUntil) {
         bot.go = descentLands(bot, run, aim);
         bot.goUntil = run.simMs + 30;
      }
      if (bot.go) descend(run, aim, input);
      else {
         input.moveX = 0;
         input.moveZ = 0;
      }
      return;
   }
   steerAt(run, sup[target], input);
   if (target <= h.support) return;
   if (touchingNow(here, sup[target], run.simMs) && Math.abs(sup[target].top - here.top) < 0.05) return;
   if (onSupport(sup[target], h.x, h.z, run.simMs)) return;
   if (jumpLands(bot, run, target)) {
      input.jumpPressed = true;
      return;
   }
   if (runsOff(bot, run, target, brakeFrames(bot, run))) {
      input.moveX = 0;
      input.moveZ = 0;
   }
}
