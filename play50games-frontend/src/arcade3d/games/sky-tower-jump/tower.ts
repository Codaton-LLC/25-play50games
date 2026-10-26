// Generated courses for Sky Tower Jump levels 2-5. Pure, no Math.random: the same level is the
// same race for every seed (a time leaderboard). Level 1 stays the hand-built COURSE_ROWS.
// A normal step is about 2.2-2.4 m (under the jump apex). A bounce pad is landed on with a
// normal step; the following step is 2.8x (under the pad apex). rules.ts turns this into supports.
import type { SkyLevel, TowerSpec } from "./levels";

export interface TowerMover {
   axis: "x" | "z";
   travel: number;
   periodMs: number;
   phase: number;
}

export type TowerKind = "start" | "island" | "moving" | "checkpoint" | "goal";

export interface TowerSupport {
   kind: TowerKind;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   top: number;
   mover: TowerMover | null;
   pad: boolean;
}

export interface TowerOrb {
   x: number;
   y: number;
   z: number;
}

/** Lightning on a platform's rim. The centre stays outside `radius`. */
export interface TowerStrike {
   support: number;
   ox: number;
   oz: number;
   radius: number;
   periodMs: number;
   /** live while the cycle fraction is below this */
   duty: number;
   phase: number;
}

export interface TowerDraft {
   supports: TowerSupport[];
   orbs: TowerOrb[];
   strikes: TowerStrike[];
   wind: boolean;
   goalTop: number;
}

const PAD_SCALE = 2.8;
/** Stay under the jump and the bounce (H_JUMP − 0.65, H_BOUNCE − 0.65) so a step is always landable. */
const NORMAL_CAP = 2.6;
const TALL_CAP = 7.4;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * One rise per climb. A pad is a normal step to land on; the NEXT step is the bounce
 * (PAD_SCALE times a normal step). Checkpoints and the goal are never pads. Rounding is
 * spread so no step crosses its cap and the rises sum to the goal top.
 */
export function planRises(spec: TowerSpec): { rise: number; pad: boolean }[] {
   const isPad: boolean[] = [];
   for (let i = 1; i <= spec.climbs; i++) {
      const checkpoint = i < spec.climbs && i % spec.checkpointEvery === 0;
      isPad.push(i % spec.padEvery === 0 && i < spec.climbs && !checkpoint);
   }
   // the rise onto climb i is tall when the platform you leave (climb i-1) is a pad
   const fromPad = isPad.map((_, idx) => idx > 0 && isPad[idx - 1]);
   const tallCount = fromPad.filter(Boolean).length;
   const normal = spec.goalTop / (spec.climbs - tallCount + PAD_SCALE * tallCount);
   const out = isPad.map((pad, idx) => ({
      rise: round2(Math.min(fromPad[idx] ? TALL_CAP : NORMAL_CAP, fromPad[idx] ? normal * PAD_SCALE : normal)),
      pad,
   }));
   const cap = (i: number) => (fromPad[i] ? TALL_CAP : NORMAL_CAP);
   for (let guard = 0; guard < 20_000; guard++) {
      const sum = out.reduce((s, r) => s + r.rise, 0);
      const err = round2(spec.goalTop - sum);
      if (Math.abs(err) < 0.005) break;
      const up = err > 0;
      let best = -1;
      let room = -1;
      for (let i = 0; i < out.length; i++) {
         const left = up ? cap(i) - out[i].rise : out[i].rise - 0.8;
         if (left > room) {
            room = left;
            best = i;
         }
      }
      if (best < 0 || room < 0.01) break;
      out[best].rise = round2(out[best].rise + (up ? 0.01 : -0.01));
   }
   return out;
}

export function buildTower(level: SkyLevel): TowerDraft {
   const spec = level.tower;
   if (!spec) throw new Error("level 1 has no generated tower");
   const rises = planRises(spec);
   const supports: TowerSupport[] = [{ kind: "start", cx: 0, cz: 0, hw: 3.5, hd: 3.5, top: 0, mover: null, pad: false }];
   const orbs: TowerOrb[] = [];
   const strikes: TowerStrike[] = [];
   let y = 0;
   for (let i = 1; i <= spec.climbs; i++) {
      const step = rises[i - 1];
      y = i === spec.climbs ? spec.goalTop : y + step.rise;
      const goal = i === spec.climbs;
      const checkpoint = !goal && i % spec.checkpointEvery === 0;
      const pad = step.pad && !checkpoint && !goal;
      const moving = !goal && !checkpoint && !pad && spec.moverEvery > 0 && i % spec.moverEvery === 0;
      const kind: TowerKind = goal ? "goal" : checkpoint ? "checkpoint" : moving ? "moving" : "island";
      const w = goal ? 8 : checkpoint ? 5.2 : spec.width;
      const d = goal ? 7 : checkpoint ? 5.2 : spec.depth;
      const cx = i % 2 === 0 ? spec.side : -spec.side;
      const cz = round2(-i * spec.gap);
      const mover: TowerMover | null = moving
         ? { axis: i % 8 === 0 ? "z" : "x", travel: spec.moverTravel, periodMs: spec.moverPeriod, phase: round2((i % 7) * 0.13) }
         : null;
      supports.push({ kind, cx, cz, hw: w / 2, hd: d / 2, top: y, mover, pad });
      if (i % spec.orbEvery === 0) {
         const prev = supports[i - 1];
         orbs.push({ x: (prev.cx + cx) / 2, y: Math.max(prev.top, y) + 1.2, z: (prev.cz + cz) / 2 });
      }
      if (spec.lightning && kind === "island" && i % 6 === 0) {
         strikes.push({
            support: i,
            ox: (w / 2) * 0.92,
            oz: 0,
            radius: 0.28,
            periodMs: 4000,
            duty: 0.2,
            phase: round2((i % 5) * 0.13),
         });
      }
   }
   return { supports, orbs, strikes, wind: spec.wind, goalTop: spec.goalTop };
}
