// The honest bot (pure). It climbs like a careful player: up the spiral ledge by ledge (a jump near each
// ledge's end), tagging to the next claw's hero a few ledges early; at the claw's ledge it walks to the
// centre and charges it: by touch, Zuno's magnet for a yellow claw on the wall, Nami's jumps up the two
// skip ledges for a high blue one. It plants itself for the guardian's sweep and jumps as the arm comes
// round, and jumps the hazard orbs. In the chain phases it keeps the paired claws for them and charges a
// pair at a telegraph (inside the drain); on level 5's Grey Heart it tags through the five glyphs as they
// light. After a fall it walks to the spiral's foot and climbs again. `mash` fires the active hero's power
// whenever it is ready (the proof's check). Its ledge is always the physical one (Hero.ledge).
import { LEDGE_LEN, YELLOW_LIFT } from "./levels";
import { GLYPH_MS } from "./progression";
import { HERO_OF_COLOUR, TAG_ORDER, type TagHeroId } from "../../menu2/heroTag/rules";
import { HORB_R, R_PATH_CONST, arcDelta, createRun, createStepInput, isGrand, litColour, needsChain, step, type CbtRun, type StepInput } from "./rules";
import type { LevelId } from "../../types";

export interface Bot {
   frameMs: number;
   mash: boolean;
   /** the claw it is going for (-1 none) */
   target: number;
   /** the last ledge it stood on (-1 floor) */
   lastLedge: number;
   /** a skip climb: 0 none, 1 first jump up, 2 the second */
   skipStage: number;
   doubled: boolean;
   still: number;
   lastA: number;
}

export function createBot(run: CbtRun, frameMs = 1000 / 60): Bot {
   return { frameMs, mash: false, target: -1, lastLedge: 0, skipStage: 0, doubled: false, still: 0, lastA: run.hero.a };
}

/** Claws kept for a chain phase (level 4's second phase, level 5's): the pairs on neighbouring ledges. */
export function chainClaw(run: CbtRun, c: number): boolean {
   const cl = run.claws[c];
   const pair = run.claws.some((o, j) => j !== c && Math.abs(o.ledge - cl.ledge) === 1);
   return pair && (run.level === 4 || isGrand(run));
}

/** The next claw to go for. */
function pickClaw(run: CbtRun): number {
   const chain = needsChain(run);
   const lit = litColour(run);
   let best = -1;
   for (let c = 0; c < run.claws.length; c++) {
      const cl = run.claws[c];
      if (cl.chargedAt !== -1) continue;
      if (chain !== chainClaw(run, c)) continue;
      if (lit && cl.colour !== lit) continue;
      if (best < 0 || cl.ledge < run.claws[best].ledge) best = c;
   }
   return best;
}

function waiting(run: CbtRun): number {
   let n = 0;
   for (const c of run.claws) if (c.chargedAt >= 0) n++;
   return n;
}

/** The stick along the ring (dir +1 up the spiral), camera yaw 0. */
function moveAlong(input: StepInput, run: CbtRun, dir: number, k = 1): void {
   const th = run.hero.a / R_PATH_CONST;
   input.moveX = Math.cos(th) * dir * k;
   input.moveZ = -Math.sin(th) * dir * k;
}

function tagFor(input: StepInput, run: CbtRun, hero: TagHeroId): void {
   if (run.tag.active !== hero) input.tag = hero;
}

export function botInput(bot: Bot, run: CbtRun, input: StepInput): void {
   input.yaw = 0;
   input.moveX = 0;
   input.moveZ = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   input.tag = null;
   if (run.ended) return;
   const h = run.hero;
   const t = run.tower;
   const b = run.boss;
   if (h.grounded) bot.lastLedge = h.ledge >= 0 ? h.ledge : h.skip >= 0 ? bot.lastLedge : -1;

   // level 5's Grey Heart: the tag finish
   if (isGrand(run) && b.phase === 2) {
      if (b.step === "vulnerable") tagFor(input, run, TAG_ORDER[Math.min(4, Math.floor(b.stepMs / GLYPH_MS))]);
      else if (run.simMs >= run.tag.lockedUntil) tagFor(input, run, "riko");
      dodge(run, input);
      return;
   }

   if (bot.target < 0 || run.claws[bot.target].chargedAt !== -1) {
      bot.target = pickClaw(run);
      bot.skipStage = 0;
   }
   const chain = needsChain(run);
   const cl = bot.target >= 0 ? run.claws[bot.target] : null;
   const here = bot.lastLedge;

   if (!cl) {
      // all charged (or none left in this phase): hold still till the window
      dodge(run, input);
      return;
   }
   const lift = cl.y - 1 - t.ly[cl.ledge];
   const orbNear = orbAhead(run) < 14;
   if (h.grounded && h.skip < 0 && bot.skipStage > 0 && !(here === cl.ledge && Math.abs(arcDelta(t.la[cl.ledge], h.a)) < 0.35)) bot.skipStage = 0;
   if (cl.ledge - here <= 3) tagFor(input, run, HERO_OF_COLOUR[cl.colour]);

   if (!h.grounded) {
      if (bot.skipStage > 0) {
         // a skip climb (straight up): Nami's second jump near the top of the first
         if (!bot.doubled && h.vy < 0.8 && run.tag.active === "nami") {
            input.jumpPressed = true;
            bot.doubled = true;
         }
      } else if (here >= 0 && here < cl.ledge) moveAlong(input, run, 1);
      else if (here > cl.ledge) moveAlong(input, run, -1);
   } else if (h.skip >= 0 || (here === cl.ledge && Math.abs(arcDelta(t.la[cl.ledge], h.a)) < 0.35)) {
      // at the claw's ledge centre (or on its skip ledges)
      const holdForTelegraph = chain && b.step !== "telegraph";
      if (holdForTelegraph && h.skip < 0) {
         // wait for the telegraph (the pair must fire in the next window, before the drain)
      } else if (cl.colour === "yellow" && lift >= YELLOW_LIFT - 0.1) {
         if (run.tag.active === "zuno") input.actionPressed = true;
      } else if (lift > 2) {
         if (run.tag.active === "nami") {
            input.jumpPressed = true;
            bot.skipStage = Math.min(2, bot.skipStage + 1);
            bot.doubled = false;
         }
      } else {
         // a plain claw: step through it
         moveAlong(input, run, 1, 0.5);
      }
   } else if (here === cl.ledge) {
      const d = arcDelta(t.la[cl.ledge], h.a);
      moveAlong(input, run, Math.sign(d), Math.min(1, Math.abs(d) / 1.2 + 0.15));
   } else if (here < 0) {
      // on the floor after a fall: round to the spiral's foot (ledge 0 at a = 0)
      const d = arcDelta(0, h.a);
      moveAlong(input, run, Math.abs(d) < 0.4 ? 1 : Math.sign(d));
   } else if (orbNear && h.grounded) {
      // an orb is rolling down at us: hold the ledge (dodge() hops it as it arrives)
   } else {
      // climb: up the spiral, a jump near the ledge's end
      const dir = here < cl.ledge ? 1 : -1;
      moveAlong(input, run, dir);
      const end = t.la[here] + (dir * LEDGE_LEN) / 2;
      if (dir * arcDelta(end, h.a) < 0.55 && dir * arcDelta(end, h.a) > -0.3) input.jumpPressed = true;
   }
   dodge(run, input);
   if (bot.mash && run.tag.cooldown[run.tag.active] <= 0) input.actionPressed = true;
   // unstick
   if (Math.abs(h.a - bot.lastA) < 0.002 && Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.3 && h.grounded) bot.still += bot.frameMs;
   else bot.still = 0;
   bot.lastA = h.a;
   if (bot.still > 700) {
      input.jumpPressed = true;
      bot.still = 0;
   }
}

/** The nearest hazard orb coming down the spiral at the hero (m along the spiral; Infinity none). */
function orbAhead(run: CbtRun): number {
   const h = run.hero;
   const ledge = h.ledge >= 0 ? h.ledge : -1;
   if (ledge < 0) return Infinity;
   const hs = run.tower.la[ledge] + arcDelta(h.a, run.tower.la[ledge]);
   let best = Infinity;
   for (const o of run.horbs) {
      if (!o.alive) continue;
      const d = o.s - hs;
      if (d > -0.5 && d < best) best = d;
   }
   return best;
}

/** The sweep (plant, then jump as the arm comes round) and the hazard orbs (jump them). */
function dodge(run: CbtRun, input: StepInput): void {
   const b = run.boss;
   const h = run.hero;
   const phases = run.tower.bossCfg.phases;
   const atk = phases[Math.min(b.phase, phases.length - 1)].attacks[0];
   if (b.step === "telegraph" && b.stepMs > atk.telegraphMs - 450 && h.grounded) {
      input.moveX = 0;
      input.moveZ = 0;
      input.jumpPressed = false;
   }
   if (b.step === "attack" && h.grounded) {
      const pass = atk.attackMs / 2;
      input.moveX = 0;
      input.moveZ = 0;
      input.jumpPressed = b.stepMs >= pass - 320 && b.stepMs <= pass - 180;
   }
   // hazard orbs: along the spiral (the hero's spiral position from its ledge); hold, then jump it
   const ledge = h.ledge >= 0 ? h.ledge : -1;
   if (ledge < 0 || !h.grounded) return;
   const hs = run.tower.la[ledge] + arcDelta(h.a, run.tower.la[ledge]);
   for (const o of run.horbs) {
      if (!o.alive) continue;
      const d = o.s - hs;
      if (d <= -0.5 || d > 14) continue;
      input.moveX = 0;
      input.moveZ = 0;
      input.jumpPressed = d > 1.4 && d < 1.8;
   }
}

/** Runs a bot until the level ends (tests and the preview's ?autoplay=1). */
export function botRun(level: LevelId, fps = 60, lead: TagHeroId = "riko", mash = false, seed = 1): CbtRun {
   const fms = 1000 / fps;
   const run = createRun(seed, level, lead);
   const bot = createBot(run, fms);
   bot.mash = mash;
   const input = createStepInput();
   const cap = Math.ceil(run.tower.spec.timerMs / fms) + 5;
   for (let f = 0; f < cap && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}
