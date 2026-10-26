// Generated pillar courses for all five levels. Pure, no Math.random: the same level is the
// same race for every seed (a time leaderboard). A rising step stays under the jump apex.
// Flat steps are same-height landings (the plan's extra surfaces beyond the climb count).
import type { LavaLevel, LavaSpec } from "./levels";

export interface PillarMover {
   axis: "x" | "z";
   travel: number;
   periodMs: number;
   phase: number;
}

/** The pillar is absent while the cycle fraction is below `gone`. Checkpoints and the goal never vanish. */
export interface PillarVanish {
   periodMs: number;
   gone: number;
   phase: number;
}

export type PillarKind = "start" | "roof" | "moving" | "checkpoint" | "goal";

export interface PillarSupport {
   kind: PillarKind;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   top: number;
   mover: PillarMover | null;
   pad: boolean;
   vanish: PillarVanish | null;
   slippery: boolean;
   /** sinks out from under the hero after COLLAPSE_HOLD (rules.ts) */
   collapse: boolean;
}

export interface PillarOrb {
   x: number;
   y: number;
   z: number;
}

/** A falling rock over a pillar's rim. The centre stays outside `radius`. */
export interface RockStrike {
   support: number;
   ox: number;
   oz: number;
   radius: number;
   periodMs: number;
   /** live while the cycle fraction is below this */
   duty: number;
   phase: number;
}

export interface PillarDraft {
   supports: PillarSupport[];
   orbs: PillarOrb[];
   strikes: RockStrike[];
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


/** A cheap deterministic hash in [0, 1) (no Math.random: the course is the same race for everyone). */
function unit(i: number, salt: number): number {
   const v = Math.imul(i * 2 + salt, 2654435761) >>> 0;
   return (v % 10007) / 10007;
}

/**
 * Where pillar `i` stands: a long sweep across the cavern (+/-side, `wave` radians per pillar, a faster
 * swing of strength `harm` riding on it) while the route climbs toward -z. The zigzag of a rooftop row
 * has no place here: the lava chases you along an S-shaped ridge.
 */
export function pillarXZ(spec: LavaSpec, i: number): { x: number; z: number } {
   const a = i * spec.wave;
   const x = spec.side * (Math.sin(a) + spec.harm * Math.sin(a * 2.3 + 1.0));
   return { x: round2(i === 0 ? 0 : x), z: round2(-i * spec.gap) };
}

function sizeOf(spec: LavaSpec, kind: PillarKind, slippery: boolean): { w: number; d: number } {
   if (kind === "goal") return { w: 8, d: 7 };
   if (kind === "checkpoint") return { w: 5.6, d: 5.4 };
   if (slippery) return { w: Math.max(spec.width, 6.4), d: Math.max(spec.depth, 6.2) };
   return { w: spec.width, d: spec.depth };
}

export function buildPillars(level: LavaLevel): PillarDraft {
   const spec = level.spec;
   const steps = spec.surfaces - 1;
   const mask = riseMask(steps, spec.rises);
   const riseCount = mask.filter(Boolean).length;
   // uneven basalt: each rise is 0.7x to 1.3x the even share (the same total), none past the jump's room
   const shares: number[] = [0];
   for (let k = 1; k <= riseCount; k++) shares.push(spec.uneven ? 0.7 + 0.6 * unit(k, 17) : 1);
   const shareSum = shares.reduce((a, b) => a + b, 0);
   const heights: number[] = [0];
   for (let k = 1; k <= riseCount; k++) heights.push(heights[k - 1] + (shares[k] / shareSum) * spec.goalTop);
   const supports: PillarSupport[] = [{ kind: "start", cx: 0, cz: 0, hw: 3.6, hd: 3.4, top: 0, mover: null, pad: false, vanish: null, slippery: false, collapse: false }];
   const orbs: PillarOrb[] = [];
   const strikes: RockStrike[] = [];
   let y = 0;
   let risen = 0;
   for (let i = 1; i <= steps; i++) {
      if (mask[i - 1]) {
         risen += 1;
         y = i === steps ? spec.goalTop : round2(heights[risen]);
      }
      if (i === steps) y = spec.goalTop;
      const goal = i === steps;
      const checkpoint = !goal && i % spec.checkpointEvery === 0;
      const moving = !goal && !checkpoint && spec.moverEvery > 0 && i % spec.moverEvery === 0;
      const vanish = !goal && !checkpoint && !moving && spec.vanishEvery > 0 && i % spec.vanishEvery === 0;
      const slippery = !goal && !checkpoint && !moving && !vanish && spec.slipEvery > 0 && i % spec.slipEvery === 0;
      const collapse = !goal && !checkpoint && !moving && !vanish && !slippery && spec.collapseEvery > 0 && i % spec.collapseEvery === 0;
      const kind: PillarKind = goal ? "goal" : checkpoint ? "checkpoint" : moving ? "moving" : "roof";
      const base = sizeOf(spec, kind, slippery);
      const k = spec.uneven && kind === "roof" ? 0.85 + 0.3 * unit(i, 29) : 1;
      const w = base.w * k;
      const d = base.d * (spec.uneven && kind === "roof" ? 0.9 + 0.2 * unit(i, 41) : 1);
      const { x: cx, z: cz } = pillarXZ(spec, i);
      const mover: PillarMover | null = moving
         ? { axis: i % 6 === 0 ? "z" : "x", travel: spec.moverTravel, periodMs: spec.moverPeriod, phase: round2((i % 5) * 0.17) }
         : null;
      const blink: PillarVanish | null = vanish ? { periodMs: 2800, gone: 0.28, phase: (i % 2) * 0.5 } : null;
      supports.push({ kind, cx, cz, hw: w / 2, hd: d / 2, top: y, mover, pad: false, vanish: blink, slippery, collapse });
      if (i % spec.orbEvery === 0) {
         const prev = supports[i - 1];
         orbs.push({ x: (prev.cx + cx) / 2, y: Math.max(prev.top, y) + 1.2, z: (prev.cz + cz) / 2 });
      }
      if (spec.sparks && kind === "roof" && !vanish && !collapse && i % 5 === 1) {
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
