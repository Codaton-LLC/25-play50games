// The honest bot (the tests, the proof and ?autoplay=1): it only writes a StepInput (a move, Jump,
// Action), what a player's keys or touch give. It follows the course's plan room by room the way a
// player reads the vault: jump the low beams, find the gap, wait at a pulsing wall until it goes dark
// with time to spare, jump a sliding beam as it reaches it, press a gate's switch and walk through, slip
// past a barrier on the side that stays open, and in the Vault Core's arena hold a pylon, jump its
// sweeps and overload it while it is open. With `routes` it plays its hero's own route too: Vexa phases
// into the cages, Zuno pulls their orbs with the magnet, Kiro shields across the live floor, Riko
// dash-jumps the short floor, Nami double-jumps the high orbs. After a hit it starts the room again.
import { HALF, LOW, ZONE, type Course, type Step } from "./course";
import { BODY_R, SPEED, V_HOP, G, barrierX, bossOpen, coreSweepS, laserOn, laserS, pulseLeft, switchNear, type LaserRun, type StepInput } from "./rules";
import { DASH_X, type HeroId } from "./heroes";

/** The bot's own steps on top of the plan's: Action for the power, Nami's double hop. */
type BotStep = (Step | { t: "power"; x: number; s: number } | { t: "dashjump"; x: number; s: number } | { t: "hop2"; x: number; s: number }) & { route?: boolean };

export interface Bot {
   frameMs: number;
   steps: BotStep[];
   at: number;
   /** the step started at (ms), a press done */
   since: number;
   done: boolean;
   lastHits: number;
   /** the last position (the sweep's timing reads the real pace) */
   prevS: number;
   prevMs: number;
   vs: number;
   /** a barrier gap picked (-1 left, 1 right, 0 none) */
   side: number;
}

function stepS(c: Course, st: BotStep): number {
   if (st.t === "press") return c.switches[st.sw].s;
   if (st.t === "pulse") return laserS0(c, st.laser);
   if (st.t === "barrier") return c.barriers[st.b].s;
   if (st.t === "boss") return c.arena ? c.arena.s0 + 12 : 0;
   return st.s;
}

function laserS0(c: Course, i: number): number {
   return c.lasers[i].s;
}

/** The hero's route steps for a zone (inserted before the zone's plan). */
function routeSteps(c: Course, hero: HeroId, zs0: number, zs1: number): BotStep[] {
   const out: BotStep[] = [];
   if (hero === "vexa" || hero === "zuno") {
      // a cage: its two cross beams at s0 / s1
      for (let i = 0; i < c.lasers.length; i++) {
         const l = c.lasers[i];
         if (l.kind !== "cage" || l.along || l.s < zs0 || l.s >= zs1) continue;
         const end = c.lasers.find((m) => m.kind === "cage" && !m.along && m.x0 === l.x0 && m.s > l.s && m.s - l.s < 8);
         if (!end) continue;
         const cx = (l.x0 + l.x1) / 2;
         if (hero === "vexa") {
            out.push({ t: "go", x: cx, s: l.s - 0.9 }, { t: "power", x: cx, s: l.s - 0.9 }, { t: "go", x: cx, s: end.s + 0.9 });
         } else {
            const nx = cx < 0 ? -1.2 : 1.2;
            out.push({ t: "go", x: nx, s: (l.s + end.s) / 2 }, { t: "power", x: nx, s: (l.s + end.s) / 2 });
         }
      }
   }
   for (const f of c.floors) {
      if (f.s0 < zs0 || f.s0 >= zs1) continue;
      const fx = (f.x0 + f.x1) / 2;
      const len = f.s1 - f.s0;
      if (hero === "kiro") out.push({ t: "go", x: fx, s: f.s0 - 0.5 }, { t: "power", x: fx, s: f.s0 - 0.5 }, { t: "go", x: fx, s: f.s1 + 0.6 });
      else if (hero === "riko" && len <= 4.2) out.push({ t: "go", x: fx, s: f.s0 - 0.45 }, { t: "dashjump", x: fx, s: f.s1 + 1 });
   }
   if (hero === "nami") {
      const highs = c.orbs.filter((o) => o.bonus === "high" && o.s >= zs0 && o.s < zs1);
      if (highs.length) {
         const mid = (highs[0].s + highs[highs.length - 1].s) / 2;
         out.push({ t: "go", x: highs[0].x, s: mid - 2.6 }, { t: "hop2", x: highs[0].x, s: mid + 3.2 });
      }
   }
   return out;
}

export function createBot(run: LaserRun, frameMs = 1000 / 60, routes = true): Bot {
   const c = run.course;
   const steps: BotStep[] = [];
   let zi = -1;
   for (const st of c.plan) {
      const s = stepS(c, st);
      const z = c.zones.findIndex((q) => s >= q.s0 && s < q.s1);
      if (routes && z > zi && z >= 0) {
         for (let k = zi + 1; k <= z; k++) for (const rs of routeSteps(c, run.heroId, c.zones[k].s0, c.zones[k].s1)) steps.push({ ...rs, route: true } as BotStep);
         zi = z;
      }
      steps.push(st);
   }
   return { frameMs, steps, at: 0, since: -1, done: false, lastHits: 0, prevS: 0, prevMs: 0, vs: 0, side: 0 };
}

function toward(r: { x: number; s: number }, x: number, s: number, input: StepInput): number {
   const dx = x - r.x;
   const ds = s - r.s;
   const d = Math.hypot(dx, ds);
   if (d > 1e-6) {
      const k = Math.min(1, d / 0.15);
      input.moveX = (dx / d) * k;
      input.moveY = -(ds / d) * k;
   }
   return d;
}

/** The first plan step of the zone holding s (after a hit, the room starts again, its route skipped). */
function zoneStart(bot: Bot, c: Course, s: number): number {
   const z = c.zones.find((q) => s >= q.s0 - 0.01 && s < q.s1);
   if (!z) return bot.at;
   for (let i = 0; i < bot.steps.length; i++) if (!bot.steps[i].route && stepS(c, bot.steps[i]) >= z.s0 - 1) return i;
   return bot.at;
}

/** A step already behind you (passed on a route): skipped. A switch whose gates are behind you too. */
function passed(c: Course, st: BotStep, s: number): boolean {
   if (st.t === "boss" || st.t === "power" || st.t === "dashjump" || st.t === "hop2") return false;
   if (st.t === "press") {
      const sw = c.switches[st.sw];
      return sw.off.length > 0 && sw.off.every((g) => c.lasers[g].s < s - 0.6);
   }
   if (st.t === "go" && st.route) return false;
   return stepS(c, st) < s - 0.6;
}

export function botInput(bot: Bot, run: LaserRun, input: StepInput): void {
   input.moveX = input.moveY = 0;
   input.yaw = 0;
   input.jumpPressed = input.actionPressed = false;
   const r = run.runner;
   const c = run.course;
   if (run.hits !== bot.lastHits) {
      bot.lastHits = run.hits;
      bot.at = zoneStart(bot, c, run.cp);
      bot.since = -1;
      bot.side = 0;
   }
   if (run.ms > bot.prevMs) {
      bot.vs = ((r.s - bot.prevS) / (run.ms - bot.prevMs)) * 1000;
      bot.prevS = r.s;
      bot.prevMs = run.ms;
   }
   if (run.ms < r.heldUntil) return;
   while (bot.steps[bot.at] && passed(c, bot.steps[bot.at], r.s)) bot.at += 1;
   const st = bot.steps[bot.at];
   if (!st) return;
   if (bot.since < 0) bot.since = run.ms;
   const next = () => {
      bot.at += 1;
      bot.since = -1;
   };
   const ground = r.h <= 0.001;
   switch (st.t) {
      case "go": {
         if (toward(r, st.x, st.s, input) < 0.25) next();
         break;
      }
      case "jump": {
         const d = st.s - r.s;
         toward(r, st.x, st.s + 1.5, input);
         if (ground && d > 1.25 && d < 1.6) input.jumpPressed = true;
         if (r.s > st.s + 1.4) next();
         break;
      }
      case "pulse": {
         const l = c.lasers[st.laser];
         const need = ((1.75 + BODY_R) / SPEED) * 1000 + 160;
         const crossing = r.s > l.s - 1.2;
         if (crossing || (!laserOn(run, st.laser) && pulseLeft(run, st.laser) >= need)) toward(r, st.x, l.s + 1.6, input);
         else toward(r, st.x, l.s - 1.4, input);
         if (r.s > l.s + 1.2) next();
         break;
      }
      case "sweep": {
         // a beam just ahead sliding away from you: hold back until it turns
         const bs = laserS(run, st.laser);
         const vb = (laserS(run, st.laser, run.ms + 50) - bs) / 0.05;
         if (laserOn(run, st.laser) && bs > r.s && vb > 0 && bs - r.s < 2.2 && ground) {
            toward(r, st.x, r.s - 0.5, input);
            break;
         }
         toward(r, st.x, st.s, input);
         // jump when the sliding beam will meet you 0.1-0.3 s from now
         if (ground && laserOn(run, st.laser)) {
            for (let k = 100; k <= 300; k += 25) {
               const ahead = laserS(run, st.laser, run.ms + k);
               const me = r.s + (bot.vs * k) / 1000;
               if (Math.abs(ahead - me) < BODY_R + 0.15) {
                  input.jumpPressed = true;
                  break;
               }
            }
         }
         if (Math.abs(st.s - r.s) < 0.3) next();
         break;
      }
      case "press": {
         const sw = c.switches[st.sw];
         const d = toward(r, sw.x, sw.s, input);
         if (d < 0.8 && switchNear(run) === st.sw) {
            input.actionPressed = true;
            next();
         }
         break;
      }
      case "barrier": {
         const b = c.barriers[st.b];
         const wait = b.s - 1.6;
         const gapX = (side: number, ms: number) => {
            const cx = barrierX(run, st.b, ms);
            return side < 0 ? (-HALF + cx - b.width / 2) / 2 : (HALF + cx + b.width / 2) / 2;
         };
         const open = (side: number, from: number, to: number) => {
            for (let t = from; t <= to; t += 50) {
               const cx = barrierX(run, st.b, run.ms + t);
               const gap = side < 0 ? cx - b.width / 2 + HALF : HALF - (cx + b.width / 2);
               if (gap < 1.6) return false;
            }
            return true;
         };
         if (bot.side !== 0) {
            // committed: through the gap, following it
            toward(r, gapX(bot.side, run.ms + 150), b.s + 1.6, input);
            if (r.s > b.s + 1.4) {
               bot.side = 0;
               next();
            }
            break;
         }
         for (const side of [-1, 1]) {
            const gx = gapX(side, run.ms + 300);
            const reach = (Math.hypot(gx - r.x, b.s + 0.7 - r.s) / SPEED) * 1000;
            if (r.s > wait - 0.6 && open(side, 0, reach + 300)) {
               bot.side = side;
               break;
            }
         }
         if (bot.side === 0) toward(r, 0, wait, input);
         break;
      }
      case "boss": {
         const a = c.arena!;
         const py = c.switches[a.pylons[1]];
         toward(r, py.x, py.s, input);
         const cs = coreSweepS(run);
         if (Number.isFinite(cs) && ground) {
            const atk = run.boss ? run.boss : null;
            void atk;
            // the sweep comes toward the start; jump when it is about 0.25 s away
            const speed = (a.coreS - 2 - (a.s0 + 4)) / 1.4;
            const d = cs - r.s;
            if (d > 0 && d < speed * 0.27 + BODY_R) input.jumpPressed = true;
         }
         if (bossOpen(run) && switchNear(run) === a.pylons[1]) input.actionPressed = true;
         if (run.boss && run.boss.step === "done") next();
         break;
      }
      case "power": {
         // not ready: the route is given up (its remaining steps skipped)
         if (run.ms + 1500 < run.powerReadyAt) {
            while (bot.steps[bot.at] && bot.steps[bot.at].route) bot.at += 1;
            bot.since = -1;
            break;
         }
         if (toward(r, st.x, st.s, input) < 0.3 && run.ms >= run.powerReadyAt && switchNear(run) < 0) {
            input.actionPressed = true;
            next();
         }
         break;
      }
      case "dashjump": {
         if (run.ms < run.powerReadyAt && run.ms >= run.dashUntil && bot.since === run.ms) {
            // no dash ready: give the route up
            while (bot.steps[bot.at] && bot.steps[bot.at].route) bot.at += 1;
            bot.since = -1;
            break;
         }
         if (run.ms >= run.powerReadyAt) input.actionPressed = true;
         toward(r, st.x, st.s, input);
         if (ground && run.ms < run.dashUntil && r.s < st.s - 3) input.jumpPressed = true;
         if (r.s > st.s - 0.2) next();
         break;
      }
      case "hop2": {
         toward(r, st.x, st.s, input);
         if (ground && run.ms - bot.since < 50) input.jumpPressed = true;
         if (!ground && r.airHops === 0 && r.vy < 0.6) input.jumpPressed = true;
         if (ground && run.ms - bot.since > 400) next();
         break;
      }
   }
   void LOW;
   void ZONE;
   void DASH_X;
   void V_HOP;
   void G;
}
