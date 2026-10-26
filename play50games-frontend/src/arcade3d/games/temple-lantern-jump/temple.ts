// Generated temple courses for all five levels. Pure, no Math.random: the same level is the
// same race for every seed (a time leaderboard). A rising step stays under the jump apex.
// Flat steps are same-height landings (the plan's extra surfaces beyond the climb count).
import type { TempleLevel, TempleSpec } from "./levels";

export interface TempleMover {
   axis: "x" | "z";
   travel: number;
   periodMs: number;
   phase: number;
}

/** The roof is absent while the cycle fraction is below `gone`. Checkpoints and the goal never vanish. */
export interface TempleVanish {
   periodMs: number;
   gone: number;
   phase: number;
}

export type TempleKind = "start" | "roof" | "moving" | "checkpoint" | "goal";

export interface TempleSupport {
   kind: TempleKind;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   top: number;
   mover: TempleMover | null;
   pad: boolean;
   vanish: TempleVanish | null;
   slippery: boolean;
}

export interface TempleOrb {
   x: number;
   y: number;
   z: number;
}

/** An antenna arc on a roof's rim. The centre stays outside `radius`. */
export interface TempleStrike {
   support: number;
   ox: number;
   oz: number;
   radius: number;
   periodMs: number;
   /** live while the cycle fraction is below this */
   duty: number;
   phase: number;
}

export interface TempleDraft {
   supports: TempleSupport[];
   orbs: TempleOrb[];
   strikes: TempleStrike[];
   wind: boolean;
   goalTop: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What node `i` (1-based, after the start) is in the courtyard climb, in groups of three:
 * lantern (a bounce pad on one side) -> landing (the other side, a pad's throw higher) -> middle balcony.
 * A lantern needs a balcony after it, so a lantern in the last position becomes a plain balcony.
 */
export type NodeRole = "lantern" | "landing" | "middle";

export function nodeRole(i: number, steps: number): NodeRole {
   const phase = (i - 1) % 3;
   if (phase === 0) return i + 1 <= steps ? "lantern" : "middle";
   if (phase === 1) return "landing";
   return "middle";
}

/** The courtyard side (+1 / -1) of the lantern in group `g` (0-based): they alternate. */
const lanternSide = (g: number) => (g % 2 === 0 ? -1 : 1);

function sizeOf(spec: TempleSpec, kind: TempleKind, slippery: boolean, lantern: boolean): { w: number; d: number } {
   if (kind === "goal") return { w: 8, d: 6 };
   if (lantern) return { w: 2.8, d: 2.8 };
   if (kind === "checkpoint") return { w: 5.4, d: 4.2 };
   if (slippery) return { w: Math.max(spec.width, 5.4), d: Math.max(spec.depth, 4.0) };
   return { w: spec.width, d: spec.depth };
}

export function buildTemple(level: TempleLevel): TempleDraft {
   const spec = level.spec;
   const steps = spec.surfaces - 1;
   const roles: NodeRole[] = [];
   for (let i = 1; i <= steps; i++) roles.push(nodeRole(i, steps));
   const landings = roles.filter((r) => r === "landing").length;
   const hops = steps - landings;
   const hop = round2((spec.goalTop - landings * spec.padRise) / hops);
   const supports: TempleSupport[] = [{ kind: "start", cx: 0, cz: 0, hw: 3.4, hd: 2.8, top: 0, mover: null, pad: false, vanish: null, slippery: false }];
   const orbs: TempleOrb[] = [];
   const strikes: TempleStrike[] = [];
   let y = 0;
   let plainIndex = 0;
   for (let i = 1; i <= steps; i++) {
      const role = roles[i - 1];
      const group = Math.floor((i - 1) / 3);
      const goal = i === steps;
      y = round2(y + (role === "landing" ? spec.padRise : hop));
      if (goal) y = spec.goalTop;
      const lantern = role === "lantern" && !goal;
      const checkpoint = !goal && role === "middle" && group % spec.checkpointEvery === spec.checkpointEvery - 1;
      // the hazards sit on the plain middle balconies only (counted in order): a lantern's landing stays still and dry
      const plain = !goal && !lantern && !checkpoint && role === "middle";
      if (plain) plainIndex += 1;
      const moving = plain && spec.moverEvery > 0 && plainIndex % spec.moverEvery === 0;
      const vanish = plain && !moving && spec.vanishEvery > 0 && plainIndex % spec.vanishEvery === 0;
      const slippery = plain && !moving && !vanish && spec.slipEvery > 0 && plainIndex % spec.slipEvery === 0;
      const kind: TempleKind = goal ? "goal" : checkpoint ? "checkpoint" : moving ? "moving" : "roof";
      const { w, d } = sizeOf(spec, kind, slippery, lantern);
      let cx = 0;
      if (role === "lantern") cx = lanternSide(group) * spec.side;
      else if (role === "landing") cx = -lanternSide(group) * spec.side;
      const cz = round2(-i * spec.gap);
      const mover: TempleMover | null = moving ? { axis: "x", travel: spec.moverTravel, periodMs: spec.moverPeriod, phase: round2((i % 5) * 0.17) } : null;
      const blink: TempleVanish | null = vanish ? { periodMs: 3600, gone: 0.22, phase: (i % 2) * 0.5 } : null;
      supports.push({ kind, cx, cz, hw: w / 2, hd: d / 2, top: y, mover, pad: lantern, vanish: blink, slippery });
      if (i % spec.orbEvery === 0) {
         const prev = supports[i - 1];
         orbs.push({ x: (prev.cx + cx) / 2, y: Math.max(prev.top, y) + (role === "landing" ? 3.4 : 1.2), z: (prev.cz + cz) / 2 });
      }
      if (spec.sparks && plain && !moving && !vanish) {
         strikes.push({ support: i, ox: (w / 2) * 0.9, oz: 0, radius: 0.26, periodMs: 3600, duty: 0.18, phase: round2((i % 5) * 0.13) });
      }
   }
   return { supports, orbs, strikes, wind: spec.wind, goalTop: spec.goalTop };
}
