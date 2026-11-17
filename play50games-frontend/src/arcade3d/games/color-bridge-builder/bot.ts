// The honest bot: inputs only (it never writes the world), for the proofs through the real store and
// the preview-only ?autoplay=1. Each level has a short plan (set a node's colour on its switch, turn a
// prism, walk to a cell, use a power, wait); walking takes the shortest path over the cells some hero
// can stand on right now, tags to the hero a bridge needs one step before it, and waits for an orange
// bridge's lit half-beat before stepping on.
import { M2_HERO_IDS, type M2HeroId } from "../../menu2/heroModels";
import { DC, DR, T, type Dir } from "./levels";
import { FLICKER_MS, HERO_MASK, KEEPER_WANTS, flickerOn, heroForMask, idleInput, tileAt, type StepInput, type Team, type World } from "./rules";
import { KEEPER } from "./progression";

type Ctx = { w: World; t: Team; out: StepInput; m: Mem };
type Step = (c: Ctx) => boolean;

interface Mem {
   /** a tag to make once the step under way has left its cell (a tag mid-bridge) */
   pendingTag: M2HeroId | null;
   step: number;
   t0: number;
   lastTag: number;
}
const memory = new WeakMap<Team, Mem>();
const mem = (t: Team): Mem => {
   let m = memory.get(t);
   if (!m) memory.set(t, (m = { pendingTag: null, step: 0, t0: 0, lastTag: -1e9 }));
   return m;
};

/** can some hero stand on (r, c) now? (and which one it must be: null = anyone) */
function enterable(w: World, r: number, c: number): { ok: boolean; hero: M2HeroId | null; orange: boolean } {
   const tile = tileAt(w, r, c);
   if (tile < 0 || tile === T.PRISM || tile === T.CRACKED || tile === T.PLATE) return { ok: false, hero: null, orange: false };
   if (tile === T.EXIT) return { ok: w.exitOpen, hero: null, orange: false };
   if (tile !== T.CHASM) return { ok: true, hero: null, orange: false };
   const m = w.bridge[r * w.map.w + c];
   if (!m) return { ok: false, hero: null, orange: false };
   if (m === 7) return { ok: true, hero: null, orange: false };
   if (m === 5) return { ok: true, hero: null, orange: true };
   return { ok: true, hero: heroForMask(m), orange: false };
}

/** the first step of a shortest path to (tr, tc) over enterable cells (or null) */
function nextStep(w: World, t: Team, tr: number, tc: number, avoid?: (r: number, c: number) => boolean): Dir | null {
   const W = w.map.w;
   const H = w.map.h;
   const prev = new Int32Array(W * H).fill(-1);
   const start = t.r * W + t.c;
   const goal = tr * W + tc;
   prev[start] = start;
   const q = [start];
   while (q.length) {
      const k = q.shift()!;
      if (k === goal) break;
      const r = Math.floor(k / W);
      const c = k % W;
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
         const nr = r + DR[d];
         const nc = c + DC[d];
         const nk = nr * W + nc;
         if (nr < 0 || nc < 0 || nr >= H || nc >= W || prev[nk] >= 0) continue;
         if (!enterable(w, nr, nc).ok && nk !== goal) continue;
         if (nk === goal && !enterable(w, nr, nc).ok) continue;
         if (avoid && avoid(nr, nc) && nk !== goal) continue;
         prev[nk] = k;
         q.push(nk);
      }
   }
   if (prev[goal] < 0) return null;
   let k = goal;
   while (prev[k] !== start) k = prev[k];
   const r = Math.floor(k / W);
   const c = k % W;
   return (r < t.r ? 0 : r > t.r ? 2 : c > t.c ? 1 : 3) as Dir;
}

/** press one step in a direction, tagging first if the cell needs another hero */
function stepToward(c: Ctx, d: Dir) {
   const { w, t, out, m } = c;
   const nr = t.r + DR[d];
   const nc = t.c + DC[d];
   const e = enterable(w, nr, nc);
   if (e.hero && e.hero !== t.heroId && tileAt(w, t.r, t.c) === T.CHASM) {
      // standing on a bridge only this hero walks: step first, tag on the way (mid-bridge)
      out.dr = DR[d];
      out.dc = DC[d];
      m.pendingTag = e.hero;
      return;
   }
   if (e.hero && e.hero !== t.heroId) {
      if (w.ms - m.lastTag > 200) {
         out.tag = M2_HERO_IDS.indexOf(e.hero) + 1;
         m.lastTag = w.ms;
      }
      return;
   }
   // the current cell is a bridge for this hero: keep him; an orange bridge: step on at the start of its lit beat
   const here = tileAt(w, t.r, t.c) === T.CHASM ? w.bridge[t.r * w.map.w + t.c] : 0;
   if (e.orange && here !== 5 && (!flickerOn(w.ms) || w.ms % FLICKER_MS > 120)) return;
   out.dr = DR[d];
   out.dc = DC[d];
}

const go =
   (r: number, cc: number): Step =>
   (c) => {
      const { w, t } = c;
      if (t.r === r && t.c === cc && !t.moving) return true;
      if (t.moving || t.fallMs > 0) return false;
      const d = nextStep(w, t, r, cc);
      if (d !== null) stepToward(c, d);
      return false;
   };

/** step on a node's switch until the node shines `color` */
const color =
   (node: number, want: number): Step =>
   (c) => {
      const { w, t } = c;
      if (w.nodeColor[node] === want) return true;
      if (t.moving || t.fallMs > 0) return false;
      const sw = w.map.switches.find((s) => s[2] === node)!;
      if (t.r === sw[0] && t.c === sw[1]) {
         // step off onto a rock neighbour, then back on
         for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
            const tile = tileAt(w, t.r + DR[d], t.c + DC[d]);
            if (tile === T.ROCK || tile === T.ANCHOR) {
               stepToward(c, d);
               return false;
            }
         }
         return false;
      }
      const d = nextStep(w, t, sw[0], sw[1]);
      if (d !== null) stepToward(c, d);
      return false;
   };

/** bump the prism at (r, c) from (fr, fc) until it reads `kind` (0 "/", 1 "\") */
const prism =
   (pr: number, pc: number, kind: number, fr: number, fc: number): Step =>
   (c) => {
      const { w, t, out } = c;
      const i = w.prismCell.indexOf(pr * w.map.w + pc);
      if (i < 0 || w.prismKind[i] === kind) return true;
      if (t.moving || t.fallMs > 0) return false;
      if (t.r !== fr || t.c !== fc) return go(fr, fc)(c), false;
      if (w.ms - c.m.lastTag < 450) return false;
      out.dr = Math.sign(pr - fr);
      out.dc = Math.sign(pc - fc);
      c.m.lastTag = w.ms;
      return false;
   };

const tag =
   (h: M2HeroId): Step =>
   (c) => {
      if (c.t.heroId === h) return true;
      if (c.w.ms - c.m.lastTag > 200) {
         c.out.tag = M2_HERO_IDS.indexOf(h) + 1;
         c.m.lastTag = c.w.ms;
      }
      return false;
   };

const face =
   (d: Dir): Step =>
   (c) => {
      if (c.t.facing === d) return true;
      // a press into a wall turns without moving; else wait for a free moment
      if (!c.t.moving) {
         c.out.dr = DR[d];
         c.out.dc = DC[d];
      }
      return c.t.facing === d;
   };

const power: Step = (c) => {
   if (c.t.moving || c.t.cooldown > 0) return false;
   c.out.action = true;
   return true;
};

const wait =
   (ms: number): Step =>
   (c) =>
      c.w.ms - c.m.t0 > ms;

/** L5: answer the Keeper's plate: switch the three nodes to the colours that make what it wants */
const keeper: Step = (c) => {
   const { w, t } = c;
   const k = w.keeper!;
   if (w.exitOpen) return go(w.map.exit[0], w.map.exit[1])(c);
   if (!k.active || t.moving || t.fallMs > 0) return false;
   // dodge the stomp: off the telegraphed row
   if ((k.state.step === "telegraph" || k.state.step === "attack") && t.r === k.stompRow) {
      for (const d of [0, 2] as Dir[]) {
         const nr = t.r + DR[d];
         if (enterable(w, nr, t.c).ok && tileAt(w, nr, t.c) !== T.SWITCH) {
            stepToward(c, d);
            return false;
         }
      }
   }
   const want = k.state.step === "vulnerable" ? k.wants : KEEPER_WANTS[KEEPER.maxHp - k.state.hp] ?? 7;
   // the middle node (2) feeds the plate and takes any primary; node 0 adds blue, node 1 yellow on the way
   const a = want & 1 ? 1 : want & 2 ? 2 : 4;
   const need = [want & 2 && a !== 2 ? 2 : 0, want & 4 && a !== 4 ? 4 : 0, a];
   for (const i of [2, 0, 1]) if (w.nodeColor[i] !== need[i]) return color(i, need[i])(c), false;
   // parked: off the switches, on a quiet rock
   if (tileAt(w, t.r, t.c) === T.SWITCH) return go(t.r + 1, t.c)(c), false;
   return false;
};

/** wait until drone i is at least `gap` cells from column / row `at` and heading away */
const droneClear =
   (i: number, axis: "c" | "r", at: number, gap: number): Step =>
   (c) => {
      const d = c.w.drones[i];
      const pos = axis === "c" ? d.c : d.r;
      const def = c.w.cfg.drones[i];
      const a = def.path[d.seg];
      const b = def.path[d.seg + d.dir] ?? a;
      const heading = Math.sign(axis === "c" ? b[1] - a[1] : b[0] - a[0]);
      return Math.abs(pos - at) >= gap && Math.sign(pos - at) === heading;
   };

const PLANS: Record<number, Step[]> = {
   1: [go(15, 8), go(11, 2), color(2, 2), go(6, 9), color(1, 1), go(0, 5)],
   2: [go(16, 10), prism(16, 5, 0, 16, 6), go(11, 5), color(2, 2), go(8, 10), go(6, 11), color(0, 1), go(0, 6)],
   3: [go(15, 8), go(11, 4), go(7, 6), go(6, 9), color(1, 2), go(3, 8), go(0, 5)],
   4: [go(15, 8), go(15, 2), droneClear(1, "c", 2, 2.2), go(11, 2), color(1, 1), go(6, 3), go(6, 8), go(6, 9), tag("riko"), face(1), power, wait(400), go(5, 6), droneClear(0, "c", 6, 3), go(1, 6), go(0, 6)],
   5: [go(14, 2), go(10, 5), keeper],
};

/** The bot's input for team k this frame. */
export function botInput(w: World, k = 0): StepInput {
   const out = idleInput();
   const t = w.teams[k];
   if (!t || t.ended) return out;
   const m = mem(t);
   if (m.pendingTag && t.moving && t.moveMs > 20) {
      out.tag = M2_HERO_IDS.indexOf(m.pendingTag) + 1;
      m.pendingTag = null;
      m.lastTag = w.ms;
      return out;
   }
   if (!t.moving) m.pendingTag = null;
   if (k > 0) {
      // a crew mate: the lead works the switches and prisms; the others follow it (never over a switch)
      const lead = w.teams[0];
      const [tr, tc] = lead.ended ? w.map.exit : [lead.safeR, lead.safeC];
      const onSwitch = tileAt(w, tr, tc) === T.SWITCH;
      const near = Math.abs(t.r - lead.r) + Math.abs(t.c - lead.c) <= 1;
      if (!t.moving && t.fallMs === 0 && !onSwitch && !(near && !lead.ended) && (t.r !== tr || t.c !== tc)) {
         const d = nextStep(w, t, tr, tc, (r, c) => tileAt(w, r, c) === T.SWITCH);
         if (d !== null) {
            const nr = t.r + DR[d];
            const nc = t.c + DC[d];
            if (tileAt(w, nr, nc) !== T.SWITCH) stepToward({ w, t, out, m }, d);
         }
      }
      return out;
   }
   const plan = PLANS[w.level];
   const s = plan[Math.min(m.step, plan.length - 1)];
   if (s && s({ w, t, out, m }) && m.step < plan.length - 1) {
      m.step++;
      m.t0 = w.ms;
   }
   void HERO_MASK;
   void face;
   void power;
   void wait;
   void prism;
   void tag;
   return out;
}
