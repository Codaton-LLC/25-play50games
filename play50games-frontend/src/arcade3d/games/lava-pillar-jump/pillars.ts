// Generated pillar courses for all five levels. Pure, no Math.random: the same level is the
// same race for every seed (a time leaderboard). A plain rising step stays under the jump apex; a
// vent step (VentSpec.rise) is taller than any jump and only the vent's launch makes it.
// Level 5 appends the arena: a ring of vent pillars round Kalder and his three hit zones.
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

/** A geyser vent in the middle of a pillar's top. */
export interface PillarVent {
   /** fires on every `every`-th heartbeat (the ring vents: on Kalder's slams) */
   every: number;
   /** the next step up needs this vent (a rise taller than a jump) */
   lift: boolean;
}

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
   /** the top heats while stood on and crumbles (rules.ts HEAT); start, checkpoints, goal and vents never do */
   heat: boolean;
   /** heat per ms stood on (2 under a magma slug) */
   heatRate: number;
   vent: PillarVent | null;
   /** an arena ring pillar (level 5) */
   ring: boolean;
   /** Kalder's hit zone for boss phase zone - 1 (1, 2, 3), 0 = not a zone */
   zone: number;
}

export interface PillarOrb {
   x: number;
   y: number;
   z: number;
}

/** A rock shaken loose over a pillar's rim by the heartbeat. The centre stays outside `radius`. */
export interface RockStrike {
   support: number;
   ox: number;
   oz: number;
   radius: number;
   periodMs: number;
   /** live while the cycle fraction is below this */
   duty: number;
   phase: number;
   /** never live before this rules ms (the first heartbeat) */
   fromMs: number;
}

export interface PillarArena {
   /** the golem's centre (the ring's centre) */
   cx: number;
   cz: number;
   /** the ring pillars' top */
   top: number;
   /** support indices of the ring pillars (the entry first) */
   ring: number[];
   /** support indices of the three hit zones, by phase */
   zones: [number, number, number];
   radius: number;
}

export interface PillarDraft {
   supports: PillarSupport[];
   orbs: PillarOrb[];
   strikes: RockStrike[];
   wind: boolean;
   goalTop: number;
   /** the route pillars are supports[0 .. route) */
   route: number;
   arena: PillarArena | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The zones over the golem (m above the ring top) and their half sizes. */
export const ZONES = [
   { lift: 4.4, half: 2.0 },
   { lift: 2.0, half: 2.4 },
   { lift: 4.8, half: 1.8 },
] as const;

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

/** riseMask with every vent step forced up; the count stays `rises` (a plain rise moves aside). */
export function ventRiseMask(spec: LavaSpec, steps: number): boolean[] {
   const mask = riseMask(steps, spec.rises);
   const forced = new Set(spec.vents.filter((v) => v.rise > 0 && v.at > 0 && v.at < steps).map((v) => v.at));
   for (const at of forced) {
      if (mask[at]) continue;
      mask[at] = true;
      for (let i = 0; i < steps; i++) {
         if (mask[i] && !forced.has(i) && i !== steps - 1) {
            mask[i] = false;
            break;
         }
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

function sizeOf(spec: LavaSpec, kind: PillarKind, slippery: boolean, vent: boolean): { w: number; d: number } {
   if (kind === "goal") return { w: 8, d: 7 };
   if (kind === "checkpoint") return { w: 5.6, d: 5.4 };
   if (slippery) return { w: Math.max(spec.width, 6.4), d: Math.max(spec.depth, 6.2) };
   if (vent) return { w: Math.max(spec.width, 5.0), d: Math.max(spec.depth, 4.6) };
   return { w: spec.width, d: spec.depth };
}

const plain = (): Omit<PillarSupport, "kind" | "cx" | "cz" | "hw" | "hd" | "top"> => ({
   mover: null,
   pad: false,
   vanish: null,
   slippery: false,
   collapse: false,
   heat: false,
   heatRate: 1,
   vent: null,
   ring: false,
   zone: 0,
});

export function buildPillars(level: LavaLevel): PillarDraft {
   const spec = level.spec;
   const steps = spec.surfaces - 1;
   const mask = ventRiseMask(spec, steps);
   const ventAt = new Map(spec.vents.filter((v) => v.at > 0 && v.at < steps).map((v) => [v.at, v]));
   // step i (pillar i-1 -> i) is mask[i - 1]; a vent at pillar a with a rise lifts step a + 1
   const ventRise = (i: number) => {
      const v = ventAt.get(i - 1);
      return v && v.rise > 0 ? v.rise : 0;
   };
   let plainRises = 0;
   let fixed = 0;
   for (let i = 1; i <= steps; i++) {
      if (!mask[i - 1]) continue;
      if (ventRise(i) > 0) fixed += ventRise(i);
      else plainRises += 1;
   }
   // uneven basalt: each plain rise is 0.7x to 1.3x the even share of what the vents leave
   const shares: number[] = [];
   for (let k = 1; k <= plainRises; k++) shares.push(spec.uneven ? 0.7 + 0.6 * unit(k, 17) : 1);
   const shareSum = shares.reduce((a, b) => a + b, 0);
   const plainTotal = spec.goalTop - fixed;
   const supports: PillarSupport[] = [{ kind: "start", cx: 0, cz: 0, hw: 3.6, hd: 3.4, top: 0, ...plain() }];
   const orbs: PillarOrb[] = [];
   const strikes: RockStrike[] = [];
   const period = spec.moverPeriod > 0 ? spec.moverPeriod : 2 * spec.beatMs;
   let y = 0;
   let plainK = 0;
   let rockK = 0;
   for (let i = 1; i <= steps; i++) {
      if (mask[i - 1]) {
         const vr = ventRise(i);
         if (vr > 0) y += vr;
         else y += (shares[plainK++] / shareSum) * plainTotal;
         y = round2(y);
      }
      if (i === steps) y = spec.goalTop;
      const last = i === steps;
      const arenaEntry = last && spec.arena !== null;
      const goal = last && !arenaEntry;
      const vspec = ventAt.get(i);
      const vent = !last && !!vspec;
      const checkpoint = arenaEntry || (!last && !vent && i % spec.checkpointEvery === 0);
      const free = !last && !checkpoint && !vent;
      const moving = free && spec.moverEvery > 0 && i % spec.moverEvery === 0;
      const vanish = free && !moving && spec.vanishEvery > 0 && i % spec.vanishEvery === 0;
      const slippery = free && !moving && !vanish && spec.slipEvery > 0 && i % spec.slipEvery === 0;
      const collapse = free && !moving && !vanish && !slippery && spec.collapseEvery > 0 && i % spec.collapseEvery === 0;
      const slug = free && !moving && !vanish && !slippery && !collapse && spec.slugEvery > 0 && i % spec.slugEvery === 0;
      const kind: PillarKind = goal ? "goal" : checkpoint ? "checkpoint" : moving ? "moving" : "roof";
      const base = sizeOf(spec, kind, slippery, vent);
      const k = spec.uneven && kind === "roof" && !vent ? 0.85 + 0.3 * unit(i, 29) : 1;
      const w = base.w * k;
      const d = base.d * (spec.uneven && kind === "roof" && !vent ? 0.9 + 0.2 * unit(i, 41) : 1);
      const { x: cx, z: cz } = pillarXZ(spec, i);
      const mover: PillarMover | null = moving
         ? spec.moverPeriod > 0
            ? { axis: i % 6 === 0 ? "z" : "x", travel: spec.moverTravel, periodMs: period, phase: round2((i % 5) * 0.17) }
            : // a bridge that slides on the heartbeat: one leg per beat, starting on the beat
              { axis: "x", travel: spec.moverTravel, periodMs: period, phase: 0 }
         : null;
      const blink: PillarVanish | null = vanish ? { periodMs: 2800, gone: 0.28, phase: (i % 2) * 0.5 } : null;
      supports.push({
         ...plain(),
         kind,
         cx,
         cz,
         hw: w / 2,
         hd: d / 2,
         top: y,
         mover,
         vanish: blink,
         slippery,
         collapse,
         heat: (kind === "roof" || kind === "moving") && !vent,
         heatRate: slug ? 2 : 1,
         vent: vent && vspec ? { every: vspec.every, lift: vspec.rise > 0 } : null,
      });
      if (i % spec.orbEvery === 0) {
         const prev = supports[i - 1];
         orbs.push({ x: (prev.cx + cx) / 2, y: Math.max(prev.top, y) + 1.2, z: (prev.cz + cz) / 2 });
      }
      if (spec.sparks && kind === "roof" && !vent && !vanish && !collapse && i % 5 === 1) {
         // shaken loose by the heartbeat: live from 350-590 ms after each beat for 14 % of it
         const delay = 350 + 120 * (rockK++ % 3);
         strikes.push({
            support: i,
            ox: (w / 2) * 0.9,
            oz: 0,
            radius: 0.26,
            periodMs: spec.beatMs,
            duty: 0.14,
            phase: round2(1 - delay / spec.beatMs),
            fromMs: spec.beatMs,
         });
      }
   }
   const route = supports.length;
   let arena: PillarArena | null = null;
   if (spec.arena) {
      const a = spec.arena;
      const entry = supports[route - 1];
      const ccx = entry.cx;
      const ccz = round2(entry.cz - a.radius);
      const ring = [route - 1];
      for (let k = 1; k < a.ring; k++) {
         const ang = (k * 2 * Math.PI) / a.ring;
         supports.push({
            ...plain(),
            kind: "roof",
            cx: round2(ccx + a.radius * Math.sin(ang)),
            cz: round2(ccz + a.radius * Math.cos(ang)),
            hw: a.half,
            hd: a.half,
            top: spec.goalTop,
            vent: { every: 1, lift: false },
            ring: true,
         });
         ring.push(supports.length - 1);
      }
      supports[route - 1].ring = true;
      const zones: number[] = [];
      ZONES.forEach((z, p) => {
         supports.push({ ...plain(), kind: "roof", cx: ccx, cz: ccz, hw: z.half, hd: z.half, top: spec.goalTop + z.lift, zone: p + 1 });
         zones.push(supports.length - 1);
      });
      arena = { cx: ccx, cz: ccz, top: spec.goalTop, ring, zones: zones as [number, number, number], radius: a.radius };
   }
   return { supports, orbs, strikes, wind: spec.wind, goalTop: spec.goalTop, route, arena };
}
