// An honest controller for the proofs and `?autoplay=1` previews: it reads the live run and writes only
// the inputs a player has (stick, Jump held/pressed, Power, a tag), through the same step().
import { DIRS, GREY, ICE, type Cell } from "./course";
import { CLIMB, HOP_MS, LONG_MS, TAG_MS, cellAlive, cellFrom, cellHeight, colourAt, idleInput, sunkRows, type CmjRun, type StepInput } from "./rules";

interface Mem {
   holdUntil: number;
   tagAt: number;
   tagTo: number;
   doubleAt: number;
}
const MEM = new WeakMap<CmjRun, Mem>();

function stick(out: StepInput, dir: number, yaw: number): void {
   const c = Math.cos(yaw);
   const s = Math.sin(yaw);
   const x = DIRS[dir].x;
   const z = DIRS[dir].z;
   out.moveX = c * x - s * z;
   out.moveY = s * x + c * z;
}

/** A hex the bot may land on (no feature hexes, nothing dropping or about to sink). */
function safe(r: CmjRun, c: Cell, landAt: number, goalId: number): boolean {
   if (c.id === goalId) return cellAlive(r, c, landAt + 200) && colourAt(r, c, landAt - 70) === colourAt(r, c, landAt + 70);
   if (c.ghost || c.curtain || c.tall || c.island || c.crown || c.stomp) return false;
   if (r.crackAt[c.id] >= 0 || !cellAlive(r, c, landAt + 900)) return false;
   if (c.id === r.boulderCell) return false;
   if (!r.config.boss && c.row < sunkRows({ config: r.config, simMs: landAt + 2500 }) + 1) return false;
   // a hex whose colour flips around the touchdown is not worth the risk
   if (colourAt(r, c, landAt - 70) !== colourAt(r, c, landAt + 70)) return false;
   return true;
}

interface Edge { dir: number; cells: number; to: number }

function edges(r: CmjRun, from: Cell, landAt: number, goalId: number): Edge[] {
   const out: Edge[] = [];
   const h0 = cellHeight(r, from, landAt);
   for (const cells of [1, 2]) {
      for (const dir of [1, 2, 0, 3, 5, 4]) {
         const c = cellFrom(r, from.x, from.z, dir, cells);
         if (!c || !safe(r, c, landAt, goalId)) continue;
         if (cellHeight(r, c, landAt) - h0 > CLIMB - 0.05) continue;
         if (cells === 2) {
            const mid = cellFrom(r, from.x, from.z, dir, 1);
            if (mid && cellAlive(r, mid) && (mid.ghost || mid.curtain)) continue;
         }
         out.push({ dir, cells, to: c.id });
      }
   }
   return out;
}

/** The first hop of a shortest route (in hops) to a hex the goal accepts. */
function route(r: CmjRun, goal: (c: Cell, landAt: number) => boolean, goalId = -1): Edge | null {
   const start = r.course.cells[r.cell];
   const first = new Map<number, Edge>();
   const seen = new Set<number>([start.id]);
   let frontier: number[] = [start.id];
   for (let depth = 0; depth < 14 && frontier.length; depth++) {
      const next: number[] = [];
      const landAt = r.simMs + (depth + 1) * HOP_MS + 40;
      for (const id of frontier) {
         for (const e of edges(r, r.course.cells[id], landAt, goalId)) {
            if (seen.has(e.to)) continue;
            seen.add(e.to);
            const head = depth === 0 ? e : first.get(id)!;
            first.set(e.to, head);
            if (goal(r.course.cells[e.to], landAt)) return head;
            next.push(e.to);
         }
      }
      frontier = next;
   }
   return null;
}

export function botInput(r: CmjRun, out: StepInput = idleInput()): StepInput {
   const yaw = out.yaw;
   Object.assign(out, idleInput());
   out.yaw = yaw;
   if (r.ended || r.fallUntil >= 0) return out;
   let m = MEM.get(r);
   if (!m) {
      m = { holdUntil: 0, tagAt: -1, tagTo: -1, doubleAt: -1 };
      MEM.set(r, m);
   }
   const t = r.simMs;
   const b = r.boss;
   if (r.hop) {
      out.jumpHeld = t < m.holdUntil;
      if (m.doubleAt >= 0 && t >= m.doubleAt && !r.hop.doubled) {
         out.jumpPressed = true;
         m.doubleAt = -1;
      }
      if (m.tagTo >= 0 && t >= m.tagAt && t >= r.tagReadyAt) {
         if (r.active !== m.tagTo) out.tag = m.tagTo;
         m.tagTo = -1;
      }
      return out;
   }
   if (r.cell < 0 || t < r.skidUntil) return out;
   const here = r.course.cells[r.cell];

   // L5 P2: from the stomp hex, Nami jumps at the golem, double-jumps, and tags into the plate colour
   if (b && b.phase === 1 && b.step !== "transition") {
      if (here.stomp) {
         if (r.active !== 1) {
            if (t >= r.tagReadyAt) out.tag = 1;
            return out;
         }
         if (b.step !== "vulnerable" || b.stepMs > 1500) return out;
         let dir = 0;
         let bd = -Infinity;
         for (let i = 0; i < 6; i++) {
            const d = -(DIRS[i].x * here.x + DIRS[i].z * here.z);
            if (d > bd) {
               bd = d;
               dir = i;
            }
         }
         stick(out, dir, yaw);
         out.jumpPressed = true;
         m.doubleAt = t + 60;
         m.tagTo = r.plate;
         m.tagAt = t + TAG_MS;
         return out;
      }
   }

   const goal = goalFor(r);
   const e = route(r, goal.test, goal.id) ?? route(r, () => true);
   if (!e) return out;
   const target = r.course.cells[e.to];
   const landAt = t + (e.cells === 2 ? LONG_MS : HOP_MS);
   const col = colourAt(r, target, landAt);
   if (col !== GREY && col !== ICE && col !== r.active) {
      // be the landing colour before takeoff (the tag cooldown is shorter than a hop)
      if (t < r.tagReadyAt) return out;
      out.tag = col;
   }
   stick(out, e.dir, yaw);
   out.jumpPressed = true;
   out.jumpHeld = e.cells === 2;
   m.holdUntil = e.cells === 2 ? t + 220 : 0;
   return out;
}

function goalFor(r: CmjRun): { test: (c: Cell, landAt: number) => boolean; id: number } {
   const b = r.boss;
   if (b) {
      if (b.phase === 0 && r.coreTarget < 3) {
         if (r.codeStep === r.code.length - 1) {
            const core = r.course.cores[r.coreTarget];
            return { test: (c) => c.id === core, id: core };
         }
         const want = r.code[r.codeStep];
         return { test: (c, at) => c.core < 0 && c.id !== r.lastCodeCell && colourAt(r, c, at) === want, id: -1 };
      }
      if (b.phase === 1) return { test: (c) => c.stomp, id: r.course.stomp };
      if (r.shardCell >= 0) {
         const s = r.shardCell;
         return { test: (c) => c.id === s, id: s };
      }
      return { test: (c) => c.id === r.cell, id: -1 };
   }
   if (r.codes >= r.config.codes) return { test: (c) => c.crown, id: r.course.crown };
   const want = r.code[r.codeStep];
   const sunk = sunkRows(r);
   return { test: (c, at) => c.id !== r.lastCodeCell && c.row >= sunk + 2 && colourAt(r, c, at) === want, id: -1 };
}
