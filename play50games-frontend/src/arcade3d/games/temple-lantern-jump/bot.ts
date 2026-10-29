// The honest bot (README "Server limits and why they hold"): it climbs the course the way a careful
// player does, node by node along the chain: walk to the jump point, jump, steer in the air, land on
// the next ledge or lantern. It hops in place on a ledge under an orb, detours to a gallery for its orb
// while the ember is high, and on level 5 fights the Queen (relight three in her window, bounce into
// her dive, throw the ember into the roof brazier). It never uses an express column, a power or a
// secret, and is the same at any frame rate. Used by proof.test.ts and by `?autoplay=1` (preview).
import { padX, padZ, type Pad } from "./course";
import { GRAV, V_JUMP, V_WALK, THROW_COST_MS, overRoofBrazier, type StepInput, type TempleRun } from "./rules";

export interface Bot {
   /** the chain node last stood on (or bounced on) */
   cur: number;
   /** a gallery pad being visited (-1 none) and the galleries already done */
   detour: number;
   /** after a gallery: walk back to the chain node it hangs off before climbing on */
   back: boolean;
   done: Set<number>;
   /** the arena lantern last landed on (level 5), -1 before */
   lastArena: number;
   /** the frame length last seen (ms): ignored, kept for the Scene's call */
   frameMs: number;
   /** a hop in place is under way for this pad id, and whether the feet have left the pad yet */
   hopping: number;
   hopAir: boolean;
   /** run.hits last seen: a fall cancels a detour */
   hitsSeen: number;
   /** ledge pad id -> its orb index, gallery pad id -> its orb index */
   orbOf: Map<number, number>;
   /** gallery pad id -> the chain node it hangs off */
   nodeOf: Map<number, number>;
}

export function createBot(run: TempleRun, frameMs = 1000 / 60): Bot {
   const c = run.course;
   const orbOf = new Map<number, number>();
   const nodeOf = new Map<number, number>();
   c.orbs.forEach((o, i) => {
      let best = -1;
      let bestD = Infinity;
      for (const p of c.pads) {
         if (p.kind === "lantern" || p.kind === "express" || p.kind === "goal") continue;
         const d = Math.hypot(p.x - o.x, p.z - o.z) + Math.abs(p.y + 1.9 - o.y) * 0.5;
         if (d < bestD) {
            bestD = d;
            best = p.id;
         }
      }
      if (best >= 0) orbOf.set(best, i);
   });
   for (const b of c.braziers) {
      const g = c.pads[b.pad];
      let best = -1;
      let bestD = Infinity;
      for (let n = 1; n < c.chain.length - 1; n++) {
         const p = c.pads[c.chain[n]];
         if (p.kind === "lantern" || p.kind === "deck") continue;
         const a1 = Math.atan2(p.z, p.x);
         const a2 = Math.atan2(g.z, g.x);
         const da = Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2)));
         const d = da * 10 + Math.abs(p.y + 0.25 - g.y);
         if (d < bestD) {
            bestD = d;
            best = n;
         }
      }
      if (best >= 0) nodeOf.set(g.id, best);
   }
   return { cur: 0, detour: -1, back: false, done: new Set(), lastArena: -1, frameMs, hopping: -1, hopAir: false, hitsSeen: 0, orbOf, nodeOf };
}

/** The time (s) until the feet come back down to `top` from the hero's height and speed, or 0 when under it. */
function airTime(y: number, vy: number, top: number): number {
   const disc = vy * vy + 2 * GRAV * (y - top);
   if (disc < 0) return 0;
   return (vy + Math.sqrt(disc)) / GRAV;
}

/** The time (s) a jump from a ledge takes to land on a pad `rise` m higher. */
function jumpTime(rise: number): number {
   const disc = V_JUMP * V_JUMP - 2 * GRAV * rise;
   return disc < 0 ? V_JUMP / GRAV : (V_JUMP + Math.sqrt(disc)) / GRAV;
}

function target(bot: Bot, run: TempleRun): Pad {
   const c = run.course;
   if (bot.detour >= 0) return c.pads[bot.detour];
   if (bot.back) return c.pads[c.chain[bot.cur]];
   if (run.bossActive && run.boss && run.boss.step !== "done" && c.arena.length > 0 && run.hero.y >= c.pads[c.arena[0]].y - 3) {
      const b = run.boss;
      const n = c.arena.length;
      const next = (i: number) => c.pads[c.arena[((i % n) + n) % n]];
      if (b.phase === 0) return next(bot.lastArena + 1);
      if (b.phase === 1) {
         const j = run.diveTarget % n;
         if (b.step === "vulnerable") return c.pads[c.arena[j]];
         // keep bouncing on the other lanterns until her window opens
         const i = bot.lastArena === j ? j + 1 : bot.lastArena + 1;
         return next(i % n === j ? i + 1 : i);
      }
      return c.pads[c.arena[n - 1]];
   }
   return c.pads[c.chain[Math.min(c.chain.length - 1, bot.cur + 1)]];
}

/** Writes the bot's input for this frame. */
export function botInput(bot: Bot, run: TempleRun, input: StepInput): void {
   const c = run.course;
   const h = run.hero;
   input.moveX = 0;
   input.moveZ = 0;
   input.yaw = 0;
   input.jumpPressed = false;
   input.actionPressed = false;
   if (run.ended) return;
   if (run.hits !== bot.hitsSeen) {
      bot.hitsSeen = run.hits;
      if (bot.detour >= 0) bot.done.add(bot.detour);
      bot.detour = -1;
      bot.back = false;
      bot.hopping = -1;
   }
   if (bot.hopping >= 0) {
      if (!h.grounded) {
         bot.hopAir = true;
         return;
      }
      if (bot.hopAir) {
         bot.hopping = -1;
         bot.hopAir = false;
      }
   }
   const stand = h.standing >= 0 ? c.pads[h.standing] : null;
   if (stand) {
      if (stand.node >= 0) {
         bot.cur = stand.node;
         bot.back = false;
      }
      const arenaAt = c.arena.indexOf(stand.id);
      if (arenaAt >= 0) bot.lastArena = arenaAt;
      if (bot.detour === stand.id) {
         bot.done.add(stand.id);
         if (!run.orbTaken[bot.orbOf.get(stand.id) ?? -1] && h.grounded) {
            // the gallery's orb is over its centre: hop in place
            input.jumpPressed = true;
            bot.hopping = stand.id;
            bot.hopAir = false;
            return;
         }
         bot.detour = -1;
         bot.back = true;
      }
   }
   const bossMode = run.bossActive && run.boss !== null && run.boss.step !== "done" && c.arena.length > 0 && h.y >= c.pads[c.arena[0]].y - 3;

   // a ledge under an orb: hop in place once
   if (stand && h.grounded && !bossMode && stand.kind !== "lantern") {
      const orb = bot.orbOf.get(stand.id);
      if (orb !== undefined && !run.orbTaken[orb] && !c.orbs[orb].gallery) {
         const off = Math.hypot(h.x - stand.x, h.z - stand.z);
         if (off < 0.35) {
            input.jumpPressed = true;
            bot.hopping = stand.id;
            bot.hopAir = false;
         } else {
            input.moveX = (stand.x - h.x) / off;
            input.moveZ = (stand.z - h.z) / off;
         }
         return;
      }
      // a gallery for this node, with ember to spare: go and get its orb
      if (bot.detour < 0 && stand.node >= 0) {
         for (const b of c.braziers) {
            const g = c.pads[b.pad];
            if (bot.done.has(g.id) || bot.nodeOf.get(g.id) !== stand.node) continue;
            if (run.ember > Math.min(3500, run.course.cfg.emberMs * 0.6) && run.orbTaken[bot.orbOf.get(g.id) ?? -1] === false) bot.detour = g.id;
         }
      }
   }
   // the node he is walking back to after a gallery: stand on it again (cur is it)
   const t = target(bot, run);
   // lantern positions swing: aim where the pad will be when the feet arrive
   let tx = t.x;
   let tz = t.z;
   let ty = t.y;
   let dtLand = 0;
   if (!h.grounded) dtLand = airTime(h.y, h.vy, ty);
   else if (stand) dtLand = jumpTime(Math.max(0, ty - stand.y));
   if (t.swing) {
      tx = padX(t, run.simMs + dtLand * 1000);
      tz = padZ(t, run.simMs + dtLand * 1000);
   }
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   const slow = Math.min(1, d / 0.45);
   if (d > 1e-6) {
      input.moveX = (dx / d) * slow;
      input.moveZ = (dz / d) * slow;
   }
   // the boss: relight / bounce are lantern landings; the roof throw is a press at the apex
   if (bossMode && run.boss && run.boss.phase === 2 && !h.grounded && h.vy < 1 && run.ember >= THROW_COST_MS && overRoofBrazier(run)) {
      input.actionPressed = true;
   }
   // jump from a ledge when the flight reaches the target (the air steering then lands it)
   if (h.grounded && stand && stand.kind !== "lantern") {
      const reach = V_WALK * dtLand;
      const rise = ty - stand.y;
      const hop = bossMode && run.boss && run.boss.phase === 1 && run.boss.step !== "vulnerable";
      if (!hop && (rise > V_JUMP * V_JUMP / (2 * GRAV) - 0.15 || d <= reach + 0.1)) input.jumpPressed = true;
   }
}
