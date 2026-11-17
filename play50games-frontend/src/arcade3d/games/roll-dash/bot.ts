// The honest bot (tests, and `?autoplay=1` in preview builds): it plays through the same StepInput a
// player gives. Each frame it reads the street ahead (what a player sees: the locks light up leadS
// ahead), picks the best lane (a single lock it can answer for its orbs, else a free lane), tags the
// right hero for the next lock and fires its power on time (Nami: jump, then her second jump at the
// top), jumps crates and carts and tucks under signs. On level 5 it also answers the Hawk: its swoop
// lane, its glowing plate (be that hero, jump into it) and the five plates.
import { cartX, laneX } from "./course";
import { DASH_BOOST, HERO_IDS, heroById, type HeroId } from "./heroes";
import { BODY_HALF, LANE_MS, canTag, createStepInput, dashing, speedOf, type DashRun, type LiveItem, type StepInput } from "./rules";

export interface Bot {
   frameMs: number;
   laneAt: number;
   jumpAt: number;
   tuckAt: number;
}

export function createBot(_run: DashRun, frameMs = 1000 / 60): Bot {
   return { frameMs, laneAt: -1e9, jumpAt: -1e9, tuckAt: -1e9 };
}

const IDLE = createStepInput();

/** The first live item ahead whose span covers this lane (full locks cover every lane). */
function firstIn(run: DashRun, lane: number, horizon: number): LiveItem | null {
   const h = run.hero;
   for (let i = run.scan; i < run.items.length; i++) {
      const it = run.items[i];
      if (it.d > h.d + horizon) break;
      if (it.done || it.d + it.depth < h.d - BODY_HALF) continue;
      if (it.boss === "plate") continue;
      if (it.lane < 0 || it.lane === lane) return it;
      if (it.kind === "cart" && Math.abs(cartX(it, run.simMs + ((it.d - h.d) / speedOf(run)) * 1000) - laneX(lane)) < 1.6) return it;
   }
   return null;
}

/** Can the hero answer a lock of this colour when it gets there (power ready or ready by then)? */
function canAnswer(run: DashRun, c: HeroId | ""): boolean {
   if (!c) return false;
   if (c === "nami") return true;
   return run.cool[c] <= (run.active === c ? 0 : 400);
}

function laneCost(run: DashRun, lane: number, horizon: number): number {
   const it = firstIn(run, lane, horizon);
   let cost = Math.abs(lane - run.hero.lane) * 0.05;
   if (it) {
      if (it.kind === "lock") cost += it.lane < 0 ? 0 : canAnswer(run, it.now) ? -0.6 : 6;
      else if (it.kind === "cart") cost += 4;
      else cost += 1;
   }
   const h = run.hero;
   const c = run.course;
   for (let i = 0; i < c.orbs.length; i++) {
      const o = c.orbs[i];
      if (o.d < h.d) continue;
      if (o.d > h.d + horizon) break;
      if (!run.orbTaken[i] && o.lane === lane && o.y < 2) cost -= 0.12;
   }
   return cost;
}

export function botInput(bot: Bot, run: DashRun, input: StepInput): void {
   input.lane = IDLE.lane;
   input.jumpPressed = false;
   input.downPressed = false;
   input.actionPressed = false;
   input.tag = 0;
   input.tagCycle = 0;
   if (run.ended !== null) return;
   const h = run.hero;
   // the speed to time things by: a dash ends within 0.3 s, so it is left out
   const v = Math.max(1, speedOf(run) - (dashing(run) ? DASH_BOOST * (run.simMs < run.stumbleUntil ? 0.5 : 1) : 0));
   const ms = run.simMs;
   const horizon = v * 2.2;
   const b = run.boss;

   // the lane: level 5's swoop (and its plate) first, else the cheapest lane ahead
   let want = h.lane;
   if (b && b.phase === 1 && (b.step === "telegraph" || b.step === "attack")) {
      if (h.lane === run.swoopLane) want = run.swoopLane === 1 ? 0 : 1;
   } else if (b && b.phase === 1 && b.step === "vulnerable") want = run.swoopLane;
   else {
      let best = Infinity;
      for (const lane of [h.lane, 0, 1, 2]) {
         const cost = laneCost(run, lane, horizon);
         if (cost < best - 1e-9) {
            best = cost;
            want = lane;
         }
      }
   }
   // never start a lane change with something about to arrive in either lane
   const soon = (lane: number) => {
      const x = firstIn(run, lane, v * 0.35 + 2);
      return x !== null && (x.d - (h.d + BODY_HALF)) / v < 0.32;
   };
   if (want !== h.lane && ms - bot.laneAt > LANE_MS + 30 && !soon(h.lane) && !soon(want)) {
      input.lane = want > h.lane ? 1 : -1;
      bot.laneAt = ms;
   }

   // level 5, P2: be the plate's hero and jump into it
   if (b && b.phase === 1 && b.step === "vulnerable" && h.lane === run.swoopLane) {
      if (run.active !== run.plateColour && canTag(run)) input.tag = HERO_IDS.indexOf(run.plateColour) + 1;
      else if (run.active === run.plateColour && h.grounded && ms - bot.jumpAt > 300) {
         input.jumpPressed = true;
         bot.jumpAt = ms;
      }
      return;
   }
   // level 5, P3: tag to each plate's hero before it
   if (b && b.phase === 2) {
      for (let i = run.scan; i < run.items.length; i++) {
         const it = run.items[i];
         if (it.done || it.boss !== "plate") continue;
         if (it.now && run.active !== it.now && canTag(run) && (it.d - h.d) / v < 0.55) input.tag = HERO_IDS.indexOf(it.now) + 1;
         break;
      }
   }

   // the item in our lane
   const it = firstIn(run, h.lane, horizon + 4);
   // rotation: a hero whose power is spent goes to the bench (it recharges twice as fast there)
   const nextLock = it && it.kind === "lock" ? it.now : "";
   if (run.cool[run.active] > 0 && nextLock !== run.active && input.tag === 0 && canTag(run)) {
      let rest: HeroId = "nami";
      for (const id of HERO_IDS) if (id !== run.active && run.cool[id] < run.cool[rest]) rest = id;
      if (nextLock && nextLock !== run.active) rest = nextLock;
      if (rest !== run.active) input.tag = HERO_IDS.indexOf(rest) + 1;
   }
   if (!it) return;
   const t = (it.d - (h.d + BODY_HALF)) / v;
   if (it.kind === "lock") {
      const c = it.now;
      if (!c) return;
      if (run.active !== c) {
         if (t < 2.8 && canTag(run) && input.tag === 0) input.tag = HERO_IDS.indexOf(c) + 1;
         return;
      }
      const power = heroById(c).power;
      if (power === "doubleJump") {
         if (h.grounded && t <= 0.62 && t > 0.2 && ms - bot.jumpAt > 300) {
            input.jumpPressed = true;
            bot.jumpAt = ms;
         } else if (!h.grounded && !h.airJumped && h.vy <= 0.6) input.jumpPressed = true;
         return;
      }
      const lead = power === "dash" ? 0.1 : power === "phase" ? 0.3 : power === "shield" ? 0.8 : 1.4;
      if (t <= lead && run.cool[c] <= 0) input.actionPressed = true;
      return;
   }
   if (it.kind === "sign") {
      if (t <= 0.25 && ms - bot.tuckAt > 500) {
         input.downPressed = true;
         bot.tuckAt = ms;
      }
      return;
   }
   // a crate or a cart: jump it (timed by the true speed: a dash brings it sooner)
   const tReal = (it.d - (h.d + BODY_HALF)) / speedOf(run);
   if (h.grounded && tReal <= 0.22 && ms - bot.jumpAt > 250) {
      input.jumpPressed = true;
      bot.jumpAt = ms;
   }
}
