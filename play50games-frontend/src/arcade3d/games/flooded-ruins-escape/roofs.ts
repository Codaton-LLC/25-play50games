// Generated rooftop courses for all five levels. Pure, no Math.random: the same level is the
// same race for every seed (a time leaderboard). A rising step stays under the jump apex.
// Flat steps are same-height landings (the plan's extra surfaces beyond the climb count).
import type { RoofLevel, RoofSpec } from "./levels";

export interface RoofMover {
   axis: "x" | "z";
   travel: number;
   periodMs: number;
   phase: number;
}

/** The roof is absent while the cycle fraction is below `gone`. Checkpoints and the goal never vanish. */
export interface RoofVanish {
   periodMs: number;
   gone: number;
   phase: number;
}

export type RoofKind = "start" | "roof" | "moving" | "checkpoint" | "goal";

export interface RoofSupport {
   kind: RoofKind;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   top: number;
   mover: RoofMover | null;
   pad: boolean;
   vanish: RoofVanish | null;
   slippery: boolean;
}

export interface RoofOrb {
   x: number;
   y: number;
   z: number;
}

/** An antenna arc on a roof's rim. The centre stays outside `radius`. */
export interface RoofStrike {
   support: number;
   ox: number;
   oz: number;
   radius: number;
   periodMs: number;
   /** live while the cycle fraction is below this */
   duty: number;
   phase: number;
}

export interface RoofDraft {
   supports: RoofSupport[];
   orbs: RoofOrb[];
   strikes: RoofStrike[];
   wind: boolean;
   goalTop: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Which of the `steps` intervals gain height. The last step always rises, and the count is `rises`. */
export function riseMask(steps: number, rises: number): boolean[] {
   const mask = new Array<boolean>(steps).fill(false);
   const n = Math.max(1, Math.min(rises, steps));
   for (let k = 0; k < n; k++) mask[Math.round((k * (steps - 1)) / Math.max(1, n - 1))] = true;
   mask[steps - 1] = true;
   let count = mask.filter(Boolean).length;
   for (let i = 0; count < n && i < steps; i++) {
      if (!mask[i]) {
         mask[i] = true;
         count += 1;
      }
   }
   return mask;
}

function sizeOf(spec: RoofSpec, kind: RoofKind, slippery: boolean): { w: number; d: number } {
   if (kind === "goal") return { w: 8, d: 7 };
   if (kind === "checkpoint") return { w: 5.6, d: 5.4 };
   if (slippery) return { w: Math.max(spec.width, 6.4), d: Math.max(spec.depth, 6.2) };
   return { w: spec.width, d: spec.depth };
}

export function buildRoofs(level: RoofLevel): RoofDraft {
   const spec = level.spec;
   const steps = spec.surfaces - 1;
   const mask = riseMask(steps, spec.rises);
   const riseCount = mask.filter(Boolean).length;
   const each = spec.goalTop / riseCount;
   const supports: RoofSupport[] = [{ kind: "start", cx: 0, cz: 0, hw: 3.6, hd: 3.4, top: 0, mover: null, pad: false, vanish: null, slippery: false }];
   const orbs: RoofOrb[] = [];
   const strikes: RoofStrike[] = [];
   let y = 0;
   let risen = 0;
   for (let i = 1; i <= steps; i++) {
      if (mask[i - 1]) {
         risen += 1;
         y = i === steps ? spec.goalTop : round2(each * risen);
      }
      if (i === steps) y = spec.goalTop;
      const goal = i === steps;
      const checkpoint = !goal && i % spec.checkpointEvery === 0;
      const moving = !goal && !checkpoint && spec.moverEvery > 0 && i % spec.moverEvery === 0;
      const vanish = !goal && !checkpoint && !moving && spec.vanishEvery > 0 && i % spec.vanishEvery === 0;
      const slippery = !goal && !checkpoint && !moving && !vanish && spec.slipEvery > 0 && i % spec.slipEvery === 0;
      const kind: RoofKind = goal ? "goal" : checkpoint ? "checkpoint" : moving ? "moving" : "roof";
      const { w, d } = sizeOf(spec, kind, slippery);
      const cx = i % 2 === 0 ? spec.side : -spec.side;
      const cz = round2(-i * spec.gap);
      const mover: RoofMover | null = moving
         ? { axis: i % 6 === 0 ? "z" : "x", travel: spec.moverTravel, periodMs: spec.moverPeriod, phase: round2((i % 5) * 0.17) }
         : null;
      const blink: RoofVanish | null = vanish ? { periodMs: 2800, gone: 0.28, phase: (i % 2) * 0.5 } : null;
      supports.push({ kind, cx, cz, hw: w / 2, hd: d / 2, top: y, mover, pad: false, vanish: blink, slippery });
      if (i % spec.orbEvery === 0) {
         const prev = supports[i - 1];
         orbs.push({ x: (prev.cx + cx) / 2, y: Math.max(prev.top, y) + 1.2, z: (prev.cz + cz) / 2 });
      }
      if (spec.sparks && kind === "roof" && i % 5 === 0) {
         strikes.push({
            support: i,
            ox: (w / 2) * 0.9,
            oz: 0,
            radius: 0.26,
            periodMs: 3600,
            duty: 0.18,
            phase: round2((i % 5) * 0.13),
         });
      }
   }
   return { supports, orbs, strikes, wind: spec.wind, goalTop: spec.goalTop };
}
