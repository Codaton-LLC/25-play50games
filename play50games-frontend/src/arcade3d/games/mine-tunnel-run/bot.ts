// The honest bot: it only produces inputs (never touches the world), for the proofs through the real
// store and for the preview-only ?autoplay=1. A Dijkstra planner over the cells (gravity, digs, steps,
// danger under loose boulders and around beetles) plus a script for Rockjaw's three phases.
import { CELL, DIG_MS, HOP, T, WALK, bossCell, digMsOf, enterable, idleInput, inside, isDiggable, isOpen, tileAt, type Hero, type StepInput, type World } from "./rules";

const WALK_MS = (CELL / WALK) * 1000;

interface Plan {
   first: number;
   cost: number;
}

/** Cells a hero must not stand in now: under loose or falling boulders, on and next to beetles, the rubble line. */
export function dangerMap(w: World): Uint8Array {
   const d = new Uint8Array(w.w * w.h);
   const mark = (c: number, r: number) => {
      if (inside(w, c, r)) d[r * w.w + c] = 1;
   };
   for (const b of w.boulders) {
      if (!b.alive || b.state === "rest") continue;
      const top = b.state === "fall" ? Math.floor(b.y) : b.row;
      for (let r = top; r < w.h; r++) {
         mark(b.col, r);
         if (r > top && !isOpen(tileAt(w, b.col, r)) && !bossCell(w, b.col, r)) break;
      }
   }
   for (const b of w.beetles) {
      if (!b.alive) continue;
      mark(b.col, b.row);
      mark(b.fc, b.fr);
      mark(b.col + b.dir, b.row);
   }
   for (let r = 0; r <= w.rockRow + 2 && r < w.h; r++) for (let c = 0; c < w.w; c++) mark(c, r);
   return d;
}

function supportedAt(w: World, h: Hero, c: number, r: number): boolean {
   const t = tileAt(w, c, r + 1);
   if (!isOpen(t)) return !(t === T.GHOST && h.heroId === "vexa" && h.powerMs > 0);
   return bossCell(w, c, r + 1);
}

// a small binary heap of (cost, node)
class Heap {
   k: number[] = [];
   v: number[] = [];
   push(cost: number, node: number) {
      const k = this.k;
      const v = this.v;
      k.push(cost);
      v.push(node);
      let i = k.length - 1;
      while (i > 0) {
         const p = (i - 1) >> 1;
         if (k[p] <= k[i]) break;
         [k[p], k[i]] = [k[i], k[p]];
         [v[p], v[i]] = [v[i], v[p]];
         i = p;
      }
   }
   pop(): number {
      const k = this.k;
      const v = this.v;
      const top = v[0];
      const lk = k.pop()!;
      const lv = v.pop()!;
      if (k.length) {
         k[0] = lk;
         v[0] = lv;
         let i = 0;
         for (;;) {
            const a = 2 * i + 1;
            const b = a + 1;
            let m = i;
            if (a < k.length && k[a] < k[m]) m = a;
            if (b < k.length && k[b] < k[m]) m = b;
            if (m === i) break;
            [k[m], k[i]] = [k[i], k[m]];
            [v[m], v[i]] = [v[i], v[m]];
            i = m;
         }
      }
      return top;
   }
   get size() {
      return this.k.length;
   }
}

/**
 * The cheapest route from the hero to any goal cell; returns the first cell to move to (-1 = none).
 * `avoidDig(c, r)` forbids digging a cell (arena plugs).
 */
export function plan(w: World, h: Hero, goal: (c: number, r: number) => boolean, danger: Uint8Array, avoidDig?: (c: number, r: number) => boolean): Plan {
   const n = w.w * w.h;
   const dist = new Float64Array(n).fill(Infinity);
   const first = new Int32Array(n).fill(-1);
   const start = h.row * w.w + h.col;
   dist[start] = 0;
   const heap = new Heap();
   heap.push(0, start);
   const kiro = h.heroId === "kiro";
   while (heap.size) {
      const i = heap.pop();
      const c = i % w.w;
      const r = Math.floor(i / w.w);
      const base = dist[i];
      if (goal(c, r) && supportedAt(w, h, c, r)) return { first: first[i], cost: base };
      const relax = (cc: number, rr: number, cost: number) => {
         if (!inside(w, cc, rr)) return;
         const j = rr * w.w + cc;
         if (danger[j] && j !== start) cost += 4000;
         const nd = base + cost;
         if (nd < dist[j]) {
            dist[j] = nd;
            first[j] = i === start ? j : first[i];
            heap.push(nd, j);
         }
      };
      if (!supportedAt(w, h, c, r)) {
         // falling: straight down only
         if (enterable(w, c, r + 1, h)) relax(c, r + 1, 90);
         continue;
      }
      for (const d of [-1, 1]) {
         const cc = c + d;
         const t = tileAt(w, cc, r);
         if (enterable(w, cc, r, h)) relax(cc, r, t === T.WATER ? WALK_MS * 1.8 : WALK_MS);
         else if (isDiggable(t) && !bossCell(w, cc, r) && !(avoidDig && avoidDig(cc, r))) {
            let cost = digMsOf(t) + WALK_MS;
            if (t === T.GAS && !(kiro && h.cooldown === 0)) cost += 3000;
            if (tileAt(w, cc, r - 1) === T.BOULDER) cost += 900;
            relax(cc, r, cost);
         } else if (enterable(w, c, r - 1, h) && enterable(w, cc, r - 1, h)) relax(cc, r - 1, 260);
      }
      const below = tileAt(w, c, r + 1);
      if (isDiggable(below) && !(avoidDig && avoidDig(c, r + 1)) && !(c === w.map.lift.col && r + 1 === w.map.lift.row)) {
         let cost = digMsOf(below) + 120;
         if (below === T.GAS && !kiro) cost += 3000;
         if (tileAt(w, c, r - 1) === T.BOULDER) cost += 900;
         relax(c, r + 1, cost);
      }
   }
   return { first: -1, cost: Infinity };
}

/** One step's input from a planned next cell. */
function toward(h: Hero, next: number, w: World, out: StepInput): StepInput {
   if (next < 0) return out;
   const c = next % w.w;
   const r = Math.floor(next / w.w);
   if (c < h.col) out.x = -1;
   else if (c > h.col) out.x = 1;
   else if (r > h.row) out.y = 1;
   return out;
}

export interface BotMemory {
   climb: number;
   lastPlanMs: number;
   /** the way a hop was aimed: held through the rise, the hang and the drift */
   hopDir: number;
   hopDown: boolean;
}
const memory = new WeakMap<Hero, BotMemory>();
const mem = (h: Hero) => {
   let m = memory.get(h);
   if (!m) memory.set(h, (m = { climb: 0, lastPlanMs: -1, hopDir: 0, hopDown: false }));
   return m;
};

/** The bot's input for hero `k` this frame (honest: reads the world, never writes it). */
export function botInput(w: World, k = 0): StepInput {
   const out = idleInput();
   const h = w.heroes[k];
   if (!h || h.ended || h.act === "dead") return out;
   const m = mem(h);
   const airborne = h.act === "rise" || h.act === "hang" || (h.act !== "idle" && h.act !== "dig" && h.airMoves > 0) || (h.act === "idle" && !supportedAt(w, h, h.col, h.row));
   if (m.hopDir !== 0 && airborne) {
      out.x = m.hopDir;
      if (m.hopDown) out.y = 1;
      if (!(w.boss && w.map.arena && h.row >= w.map.arena.gallery - 1 && !w.liftOpen)) return out;
   } else if (!airborne) {
      m.hopDir = 0;
      m.hopDown = false;
   }
   const busy = h.act !== "idle" && h.act !== "hang" && h.act !== "rise";
   const danger = dangerMap(w);
   const here = h.row * w.w + h.col;
   if (busy) return out;

   const a = w.map.arena;
   const b = w.boss;
   if (a && b && h.row >= a.gallery - 1 && !w.liftOpen) return bossInput(w, h, danger, out);
   if (h.act === "hang" || h.act === "rise") return out;

   // a beetle right ahead: hop over it when there is headroom, else wait
   const lift = w.map.lift;
   // the lift, or (L5, while it is shut) the arena gallery
   const goal = w.liftOpen ? (c: number, r: number) => c === lift.col && r === lift.row : (_c: number, r: number) => r === a!.gallery;
   const p = plan(w, h, goal, danger);
   if (p.first < 0) {
      // boxed in or no route yet: try digging down, else wait
      out.y = 1;
      return out;
   }
   const nc = p.first % w.w;
   const nr = Math.floor(p.first / w.w);
   if (danger[p.first] && !danger[here]) {
      const beetle = w.beetles.find((be) => be.alive && Math.abs(be.col - nc) <= 1 && be.row === nr);
      if (beetle && nr === h.row && enterable(w, h.col, h.row - 1, h) && enterable(w, nc, h.row - 1, h)) {
         out.jump = true;
         out.x = nc > h.col ? 1 : -1;
         m.hopDir = out.x;
         return out;
      }
      return out; // wait for the danger to pass
   }
   // Kiro raises the shield before digging into gas
   if (h.heroId === "kiro" && tileAt(w, nc, nr) === T.GAS && h.cooldown === 0 && h.powerMs === 0) out.power = true;
   return toward(h, p.first, w, out);
}

function bossInput(w: World, h: Hero, danger: Uint8Array, out: StepInput): StepInput {
   const a = w.map.arena!;
   const b = w.boss!;
   const s = b.state;
   const G = a.gallery;
   const F = a.floor;
   const plugs = a.plugs;
   const bx = Math.round(b.x);
   const loaded = (p: number) => tileAt(w, p, G) === T.SOFT && tileAt(w, p, G - 1) === T.BOULDER;
   const here = h.row * w.w + h.col;
   const safeStep = (pl: Plan) => pl.first >= 0 && !(danger[pl.first] && !danger[here]);

   // ---- in the chamber
   if (h.row > G + 1) {
      if (s.phase === 2) {
         const side = h.col <= bx ? -1 : 1;
         const spot = Math.max(a.x0, Math.min(a.x1, bx + side * 2));
         if (h.act === "hang" || h.act === "rise") {
            // drift onto the belly, Down held: the roll-drop
            out.x = -side;
            out.y = 1;
            return out;
         }
         if (s.step === "vulnerable") {
            if (h.col === spot && h.row === F) {
               out.jump = true;
               out.x = -side;
               out.y = 1;
               const mm = mem(h);
               mm.hopDir = -side;
               mm.hopDown = true;
               return out;
            }
            const pl = plan(w, h, (c, r) => c === spot && r === F, danger);
            return safeStep(pl) ? toward(h, pl.first, w, out) : out;
         }
         // its legs flail: keep three cells clear
         if (Math.abs(h.col - bx) <= 3) {
            const away = Math.max(a.x0, Math.min(a.x1, bx + side * 4));
            const pl = plan(w, h, (c, r) => c === away && r === F, danger);
            return safeStep(pl) ? toward(h, pl.first, w, out) : out;
         }
         return out;
      }
      // fell in early: climb the ledge shaft at the chamber's left end back to the gallery
      if (h.act === "hang") {
         out.x = h.row <= G ? 1 : -1;
         return out;
      }
      const ledge = a.x0 - 1;
      if (h.col === ledge && h.row === F - 2) {
         out.jump = true;
         return out;
      }
      if (h.row === F && h.col === a.x0) {
         out.jump = true;
         return out;
      }
      const pl = plan(w, h, (c, r) => c === a.x0 && r === F, danger);
      return safeStep(pl) ? toward(h, pl.first, w, out) : out;
   }
   if (h.act === "hang") {
      out.x = 1;
      return out;
   }
   // ---- in the gallery
   if (s.phase === 2) {
      // the chutes stand open: drop into the chamber
      const pl = plan(w, h, (_c, r) => r === F, danger);
      return safeStep(pl) ? toward(h, pl.first, w, out) : out;
   }
   const segment = (c: number) => {
      // the gallery cells between the plugs either side of column c
      let l = a.x0;
      let r = a.x1;
      for (const p of plugs) {
         if (p < c) l = Math.max(l, p + 1);
         if (p > c) r = Math.min(r, p - 1);
      }
      return { l, r };
   };
   const seg = segment(h.col);
   const go = (c: number): StepInput => {
      const t = Math.max(seg.l, Math.min(seg.r, c));
      if (h.col === t) return out;
      out.x = t > h.col ? 1 : -1;
      return out;
   };
   const digPlug = (p: number): StepInput => {
      const side = p < h.col ? p + 1 : p - 1;
      if (h.col !== side) return go(side);
      if (tileAt(w, p, G) === T.SOFT) out.x = p > h.col ? 1 : -1;
      return out;
   };
   const myPlugs = plugs.filter((p) => p === seg.l - 1 || p === seg.r + 1);
   if (s.phase === 0) {
      if (s.step === "vulnerable" && myPlugs.includes(bx) && loaded(bx)) return digPlug(bx);
      return out;
   }
   // phase 2 (burrow): dodge the dust, then drop the boulder on it
   if (s.step === "telegraph" || s.step === "attack") {
      const t = b.target;
      if (Math.abs(h.col - t) <= 1) return go(h.col >= t ? t + 2 : t - 2);
      return out;
   }
   if (s.step === "vulnerable" && !b.buried) {
      const p = myPlugs.find((q) => Math.abs(q - bx) <= 1 && loaded(q));
      if (p !== undefined) return digPlug(p);
   }
   // lure: wait beside a loaded plug of this segment
   const p = myPlugs.find(loaded);
   if (p !== undefined) return go(p < h.col ? p + 1 : p - 1);
   return out;
}

export { DIG_MS, HOP };
