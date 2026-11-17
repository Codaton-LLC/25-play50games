// The honest bot: inputs only (it never writes the world), for the proofs through the real store and
// the preview-only ?autoplay=1. Whenever a new obstacle row comes into view it tries every plan for the
// next two rows (the hero's lane for each, and jump / slide / nothing at each) on a copy of the world,
// with the same controller it then plays, and keeps the plan that cracks least and takes most orbs
// (and hits the Sentinel's gem). The controller only presses left / right / jump / slide / action.
import { idleInput, stepWorld, type Pair, type StepInput, type World } from "./rules";

type Vert = 0 | 1 | 2; // nothing, jump, slide
interface Plan {
   lane1: number;
   /** hold the lane until just before row 1 (zones change on the way) */
   late: number;
   /** the reflection's lane for row 1, reached by pressing into the wall with the hero at an edge (or 9: any) */
   refl1: number;
   vert1: Vert;
   lane2: number;
   vert2: Vert;
   row1: number;
   row2: number;
}

interface Mem {
   plan: Plan | null;
   row1: number;
   lastPress: number;
   jumped: number;
   slid: number;
   cracks: number;
   shatters: number;
   cycles: number;
}
const memory = new WeakMap<Pair, Mem>();
const mem = (p: Pair): Mem => {
   let m = memory.get(p);
   if (!m) memory.set(p, (m = { plan: null, row1: -1, lastPress: -1e9, jumped: -1, slid: -1, cracks: 0, shatters: 0, cycles: -1 }));
   return m;
};

/** the next two rows ahead (course obstacles, the Sentinel's panes and its target) */
function rowsAhead(w: World, p: Pair): [number, number] {
   const out: number[] = [];
   const from = p.s - 0.6;
   const push = (s: number) => {
      if (s > from && !out.includes(s)) out.push(s);
   };
   for (const o of w.course.obstacles) if (o.s > from && o.s < from + 60) push(o.s);
   for (const o of w.course.orbs) if (o.s > from && o.s < from + 60) push(o.s);
   if (p.boss) {
      for (const pn of p.boss.panes) push(pn.s);
      if (p.boss.target && !p.boss.target.done) push(p.boss.target.s);
   }
   out.sort((a, b) => a - b);
   return [out[0] ?? Infinity, out[1] ?? Infinity];
}

/** The controller: steer the hero toward the plan's lane, jump / slide on time for the row. */
function control(w: World, p: Pair, plan: Plan, m: Mem, out: StepInput) {
   const second = p.s > plan.row1 + 0.6;
   const t1 = (plan.row1 - p.s) / Math.max(1, p.speed);
   const lane = second ? plan.lane2 : plan.late > 0 && t1 > plan.late ? p.bodies[0].lane : plan.lane1;
   const vert = second ? plan.vert2 : plan.vert1;
   const row = second ? plan.row2 : plan.row1;
   const h = p.bodies[0];
   const r = p.bodies[1];
   if (h.lane !== lane && w.ms - m.lastPress > 40) {
      if (lane < h.lane) out.left = true;
      else out.right = true;
      m.lastPress = w.ms;
   } else if (!second && plan.refl1 !== 9 && r.lane !== plan.refl1 && w.ms - m.lastPress > 40 && (p.zone === "mirror" || p.zone === "frost" || p.zone === "merge") && !(plan.late > 0 && t1 > plan.late)) {
      // the hero pinned at an edge: a press into the edge moves only the reflection
      const want = Math.sign(plan.refl1 - r.lane);
      const d = p.zone === "frost" ? want : -want;
      if (h.lane + d > 1 || h.lane + d < -1) {
         if (d < 0) out.left = true;
         else out.right = true;
         m.lastPress = w.ms;
      }
   }
   const dist = row - p.s;
   const t = dist / Math.max(1, p.speed);
   if (vert === 1 && m.jumped !== row && t < 0.27 && t > -0.05) {
      out.jump = true;
      m.jumped = row;
   }
   if (vert === 2 && m.slid !== row && t < 0.22 && t > -0.05) {
      out.slide = true;
      m.slid = row;
   }
}

function score(sim: World, p0: Pair): number {
   const p = sim.pairs[0];
   const g = p.boss;
   return p.shatters * 100000 + p.hits * 1000 - p.orbs * 40 - (g ? (5 - g.state.hp) * 3000 : 0) + (p.ended === "win" ? -5000 : 0);
}

function simulate(w: World, p: Pair, plan: Plan): number {
   // a copy of this pair only, on the shared (read-only) course
   const sp = structuredClone(p) as Pair;
   const sim: World = { ...w, pairs: [sp] };
   const sm: Mem = { plan, row1: plan.row1, lastPress: -1e9, jumped: -1, slid: -1, cracks: 0, shatters: 0, cycles: -1 };
   const v = Math.max(1, p.speed);
   const to1 = (plan.row1 - p.s) / v + 0.4;
   const to2 = plan.row2 === Infinity ? to1 : (plan.row2 - p.s) / v + 0.35;
   const horizon = Math.min(Math.max(to1, 3.2), Math.max(1.1, to2));
   for (let t = 0; t < horizon * 1000 && !sp.ended; t += 1000 / 60) {
      const input = idleInput();
      control(sim, sp, plan, sm, input);
      stepWorld(sim, 1000 / 60, [input]);
   }
   const lanes = Math.abs(plan.lane1 - p.bodies[0].lane) + Math.abs(plan.lane2 - plan.lane1);
   return score(sim, p) + lanes * 2 + (plan.vert1 ? 1 : 0) + (plan.vert2 ? 1 : 0);
}

/** jump / slide only matter at a row with a hurdle, a bar, an air orb or a Sentinel target */
function vertsAt(w: World, p: Pair, s: number): Vert[] {
   if (s === Infinity) return [0];
   if (p.boss && p.boss.target && p.boss.target.s === s) return [0, 1];
   let jump = false;
   let slide = false;
   for (const o of w.course.obstacles) {
      if (o.s !== s) continue;
      if (o.kind === "L") jump = true;
      if (o.kind === "H") slide = true;
   }
   for (const o of w.course.orbs) if (o.s === s && o.y > 1) jump = true;
   const out: Vert[] = [0];
   if (jump) out.push(1);
   if (slide) out.push(2);
   return out;
}

function choose(w: World, p: Pair, rows: [number, number]): Plan {
   let best: Plan | null = null;
   let bestScore = Infinity;
   const v1 = vertsAt(w, p, rows[0]);
   const v2 = vertsAt(w, p, rows[1]);
   for (const lane1 of [p.bodies[0].lane, -1, 0, 1].filter((v, i, a) => a.indexOf(v) === i))
      for (const late of lane1 === p.bodies[0].lane && lane1 === 0 ? [0] : [0, 0.45, 0.8])
      for (const refl1 of lane1 === 0 ? [9] : [9, -1, 0, 1])
      for (const vert1 of v1)
         for (const lane2 of [lane1, -1, 0, 1].filter((v, i, a) => a.indexOf(v) === i))
            for (const vert2 of v2) {
               const plan: Plan = { lane1, late, refl1, vert1, lane2, vert2, row1: rows[0], row2: rows[1] };
               const sc = simulate(w, p, plan);
               if (sc < bestScore) {
                  bestScore = sc;
                  best = plan;
               }
            }
   return best!;
}

/** The bot's input for pair k this frame. */
export function botInput(w: World, k = 0): StepInput {
   const out = idleInput();
   const p = w.pairs[k];
   if (!p || p.ended || p.freezeMs > 0) return out;
   const m = mem(p);
   const rows = rowsAhead(w, p);
   const cycles = p.boss ? p.boss.cycles + p.boss.panes.length * 100 : 0;
   if (!m.plan || rows[0] !== m.row1 || p.hits !== m.cracks || p.shatters !== m.shatters || cycles !== m.cycles) {
      m.row1 = rows[0];
      m.cracks = p.hits;
      m.shatters = p.shatters;
      m.cycles = cycles;
      m.plan = rows[0] === Infinity ? { lane1: 0, late: 0, refl1: 9, vert1: 0, lane2: 0, vert2: 0, row1: Infinity, row2: Infinity } : choose(w, p, rows);
   }
   control(w, p, m.plan, m, out);
   return out;
}
