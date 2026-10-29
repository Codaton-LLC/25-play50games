// The honest bot (pure). It plays like a careful player with no hero power: for each gap it starts
// the chain that bridges it (walking into the root starter of a fork from behind), pushes a spare
// into a stalled slot, follows the wave a step behind its front across the bridge, stands on a drum
// for its throw, and on level 5 starts the right chain for each of Jack's windows. `mash` adds the
// hero power whenever it is ready (the proof's power-mashing check); it never changes the line.
import { BOXES } from "./levels";
import { DRUM_R, PIECE_SPACING, type Course } from "./course";
import { createRun, createStepInput, step, type StepInput, type ToyRun } from "./rules";
import { heroById, type HeroId } from "./heroes";
import type { LevelId } from "../../types";

export interface Bot {
   frameMs: number;
   mash: boolean;
   still: number;
   lastX: number;
   lastZ: number;
   /** the gap (index into the desks in z order) it is working on */
   gap: number;
   launched: boolean;
}

export function createBot(run: ToyRun, frameMs = 1000 / 60): Bot {
   return { frameMs, mash: false, still: 0, lastX: run.hero.x, lastZ: run.hero.z, gap: 0, launched: false };
}

interface Plan {
   /** the chain whose pieces bridge the gap (or end on the drum), and its root (the one you push) */
   chain: number;
   root: number;
   drum: number;
}

/** Desks in z order. */
function desks(c: Course) {
   return c.plats.filter((p) => p.y === 0).sort((a, b) => a.z0 - b.z0);
}

/** For gap g (between desk g and g + 1): the chain that bridges it (no empty slot preferred), or the drum's. */
function planFor(c: Course, g: number): Plan | null {
   const ds = desks(c);
   if (g >= ds.length - 1) return null;
   const z0 = ds[g].z1;
   const z1 = ds[g + 1].z0;
   let best: Plan | null = null;
   let bestScore = Infinity;
   c.chains.forEach((ch, ci) => {
      let crosses = false;
      for (let k = 0; k < ch.count; k++) {
         const p = c.pieces[ch.first + k];
         if (p.gap && p.z > z0 - 0.5 && p.z < z1 + 0.5) crosses = true;
      }
      if (!crosses) return;
      let root = ci;
      while (c.chains[root].spec.from) root = c.chains[root].spec.from!.chain;
      const score = (ch.spec.missing?.length ?? 0) * 10 + ch.length / 100;
      if (score < bestScore) {
         bestScore = score;
         best = { chain: ci, root, drum: -1 };
      }
   });
   if (best) return best;
   // no bridge: a drum on this desk throws you up to the shelf over the gap
   for (let d = 0; d < c.drums.length; d++) {
      const dr = c.drums[d];
      if (dr.z > ds[g].z0 && dr.z < z0 + 0.5) {
         let root = dr.chain;
         while (c.chains[root].spec.from) root = c.chains[root].spec.from!.chain;
         return { chain: dr.chain, root, drum: d };
      }
   }
   return null;
}

function steer(run: ToyRun, tx: number, tz: number, input: StepInput, k = 1): number {
   const h = run.hero;
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   if (d < 0.15) {
      input.moveX = 0;
      input.moveZ = 0;
      return d;
   }
   const s = Math.min(1, k, d / 0.6);
   input.moveX = (dx / d) * s;
   input.moveZ = (dz / d) * s;
   return d;
}

/** The front of a running chain: the last fallen piece (its index), or -1 if none has fallen. */
function frontOf(run: ToyRun, chain: number): number {
   const ch = run.course.chains[chain];
   let f = -1;
   for (let k = 0; k < ch.count; k++) if (run.fallAt[ch.first + k] <= run.simMs) f = k;
   return f;
}

/** Walk into a chain's starter from behind it. */
function pushStarter(run: ToyRun, chain: number, input: StepInput): void {
   const c = run.course;
   const p = c.pieces[c.chains[chain].first];
   const bx = p.x - p.dx * 1.4;
   const bz = p.z - p.dz * 1.4;
   const h = run.hero;
   const behind = (h.x - p.x) * p.dx + (h.z - p.z) * p.dz;
   const side = Math.abs((h.x - p.x) * p.dz - (h.z - p.z) * p.dx);
   if (behind < -0.9 && side < 0.5) steer(run, p.x + p.dx, p.z + p.dz, input);
   else steer(run, bx, bz, input);
}

function bossPlay(bot: Bot, run: ToyRun, input: StepInput): void {
   const b = run.boss!;
   const c = run.course;
   const ph = b.phase;
   if (ph < 2) {
      const k = run.jack.box;
      const ready = (b.step === "telegraph" || (ph === 1 && b.step === "attack")) && run.status[k] === 0;
      if (ready && !(ph === 1 && b.step === "telegraph" && b.stepMs < 300)) {
         pushStarter(run, k, input);
         return;
      }
      steer(run, 0, 9, input);
      return;
   }
   // Bounce: the giant line takes ~3.1 s; push it just after he takes off so its last book meets his crouch
   const ch = c.chains[3];
   const p = c.pieces[ch.first];
   const t = (ch.length * 1000) / ch.speed;
   const lead = 2600 + 500 + 200 - t;
   if (b.step === "telegraph" && b.stepMs >= Math.max(0, lead) && run.status[3] === 0) {
      pushStarter(run, 3, input);
      return;
   }
   steer(run, p.x - p.dx * 1.6, p.z - p.dz * 1.6, input);
   void BOXES;
}

export function botInput(bot: Bot, run: ToyRun, input: StepInput): void {
   input.yaw = 0;
   input.jumpPressed = false;
   input.jumpHeld = false;
   input.actionPressed = false;
   input.moveX = 0;
   input.moveZ = 0;
   const c = run.course;
   const h = run.hero;
   if (run.ended || h.lostUntil >= 0) return;
   if (run.boss && run.boss.hp > 0) {
      bossPlay(bot, run, input);
   } else {
      const ds = desks(c);
      // which gap: the one after the desk the hero is on (the shelf counts as past its gap)
      for (let g = 0; g < ds.length - 1; g++) if (h.z > ds[g + 1].z0 + 0.5 && h.y < 1) bot.gap = Math.max(bot.gap, g + 1);
      const plan = planFor(c, bot.gap);
      if (!plan) {
         steer(run, c.finish.x, c.finish.z, input);
      } else if (plan.drum >= 0) {
         const dr = c.drums[plan.drum];
         if (h.y > 2 || (!h.grounded && bot.launched)) {
            // on (or flying to) the shelf: run along it and drop off its far end
            bot.launched = true;
            const shelf = c.plats.find((p) => p.kind === "shelf" && h.z < p.z1 + 2);
            if (shelf) steer(run, (shelf.x0 + shelf.x1) / 2, shelf.z1 + 3, input);
            else steer(run, c.finish.x, c.finish.z, input);
         } else if (run.status[plan.root] === 0 && run.drumFired[plan.drum] < 0) {
            pushStarter(run, plan.root, input);
         } else if (run.drumFired[plan.drum] >= 0 && run.simMs - run.drumFired[plan.drum] > 400) {
            // missed it: the wave is spent; respawn logic re-arms on a fall, so step off the desk edge
            steer(run, dr.x, dr.z + 30, input);
         } else {
            // stand on the drum and wait for the wave
            if (Math.hypot(h.x - dr.x, h.z - dr.z) > DRUM_R * 0.5) {
               steer(run, dr.x, dr.z, input);
               if (h.grounded && Math.hypot(h.x - dr.x, h.z - dr.z) < DRUM_R + 1 && h.y < 0.3) input.jumpPressed = true;
            }
         }
      } else {
         const ch = c.chains[plan.chain];
         if (run.status[plan.root] === 0) {
            pushStarter(run, plan.root, input);
         } else {
            // a stalled wave: push the spare in
            let spareTarget = -1;
            for (let s = 0; s < run.spares.length; s++) {
               if (run.spareUsed[s]) continue;
               const sp = run.spares[s];
               const slotChain = sp.chain;
               let onRoute = slotChain === plan.chain;
               for (let r = plan.chain; c.chains[r].spec.from && !onRoute; r = c.chains[r].spec.from!.chain) if (c.chains[r].spec.from!.chain === slotChain) onRoute = true;
               if (!onRoute) continue;
               const before = run.fallAt[sp.piece - 1];
               if (before <= run.simMs + 600) spareTarget = s;
            }
            if (spareTarget >= 0) {
               const sp = run.spares[spareTarget];
               steer(run, sp.x, sp.z, input);
            } else {
               // follow the wave a step behind its front along the bridging chain (or its parents)
               let follow = plan.chain;
               let f = frontOf(run, follow);
               while (f < 0 && c.chains[follow].spec.from) {
                  follow = c.chains[follow].spec.from!.chain;
                  f = frontOf(run, follow);
               }
               const chf = c.chains[follow];
               if (f < 0) {
                  const p = c.pieces[chf.first];
                  steer(run, p.x - p.dx * 1.5, p.z - p.dz * 1.5, input);
               } else {
                  const done = follow === plan.chain && f >= ch.count - 1;
                  const p = c.pieces[chf.first + f];
                  if (done) steer(run, p.x + p.dx * 3, p.z + p.dz * 3, input);
                  else {
                     // a step behind the front, on its line (pieces fall forward PIECE_H: the bridge reaches it)
                     const back = Math.max(0, 1.6 - PIECE_SPACING);
                     steer(run, p.x + p.dx * (0.6 - back), p.z + p.dz * (0.6 - back), input);
                  }
               }
            }
         }
      }
   }
   if (bot.mash && run.simMs >= h.powerReadyAt && heroById(run.heroId).power !== "doubleJump" && heroById(run.heroId).power !== "dash") input.actionPressed = true;
   // unstick: a jump after 800 ms pushing without moving
   const moved = Math.hypot(h.x - bot.lastX, h.z - bot.lastZ);
   const trying = Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.3;
   if (moved < 0.01 && trying && h.grounded) bot.still += bot.frameMs;
   else bot.still = 0;
   bot.lastX = h.x;
   bot.lastZ = h.z;
   if (bot.still > 800) {
      input.jumpPressed = true;
      bot.still = 0;
   }
}

/** Runs a bot until the level ends (tests and the preview's ?autoplay=1). */
export function botRun(level: LevelId, fps = 60, hero: HeroId = "zuno", mash = false, seed = 1): ToyRun {
   const fms = 1000 / fps;
   const run = createRun(seed, level, hero);
   const bot = createBot(run, fms);
   bot.mash = mash;
   const input = createStepInput();
   const cap = Math.ceil(run.course.timerMs / fms) + 5;
   for (let f = 0; f < cap && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}
