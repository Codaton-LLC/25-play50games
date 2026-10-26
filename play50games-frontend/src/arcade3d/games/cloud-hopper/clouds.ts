// Cloud Hopper's courses: a rising helix of soft clouds. Pure, no Math.random: the same level is
// the same race for every seed (a time leaderboard). Bounce clouds launch you to the next one.
// A drift chain slides together along the helix tangent. A fade cloud disappears a moment after
// you land. Wind lanes between clouds push sideways. Not a straight stair and not a square shaft.
import type { CloudLevel, CloudSpec } from "./levels";

export interface CloudMover {
   axis: "tangent";
   travel: number;
   periodMs: number;
   phase: number;
   tx: number;
   tz: number;
}

/** A rim spark. The cloud's centre stays outside `radius`. */
export interface CloudStrike {
   support: number;
   ox: number;
   oz: number;
   radius: number;
   periodMs: number;
   duty: number;
   phase: number;
}

export type CloudKind = "start" | "roof" | "moving" | "checkpoint" | "goal";

export interface CloudSupport {
   kind: CloudKind;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   top: number;
   mover: CloudMover | null;
   /** landing near the centre launches at the bounce speed */
   pad: boolean;
   /** ms the cloud stays after you land; 0 = it never fades */
   fadeMs: number;
   slippery: boolean;
}

export interface CloudOrb {
   x: number;
   y: number;
   z: number;
}

/** A box of sideways push. The hero's speed is still capped, so a lane cannot beat the proof. */
export interface WindLane {
   x: number;
   z: number;
   y0: number;
   y1: number;
   hw: number;
   hd: number;
   ax: number;
   az: number;
}

export interface CloudDraft {
   supports: CloudSupport[];
   orbs: CloudOrb[];
   strikes: CloudStrike[];
   lanes: WindLane[];
   wind: boolean;
   goalTop: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Which of the `steps` intervals gain height. The last step always rises, and the count is `rises`. */
export function riseSteps(steps: number, rises: number): boolean[] {
   const rising = new Array<boolean>(steps).fill(false);
   const n = Math.max(1, Math.min(rises, steps));
   for (let k = 0; k < n; k++) rising[Math.round((k * (steps - 1)) / Math.max(1, n - 1))] = true;
   rising[steps - 1] = true;
   let count = rising.filter(Boolean).length;
   for (let i = 0; count < n && i < steps; i++) {
      if (!rising[i]) {
         rising[i] = true;
         count += 1;
      }
   }
   return rising;
}

/** Where cloud `i` sits. A helix around the origin that breathes with `wobble`: not a square ring. */
export function helixXZ(spec: CloudSpec, i: number): { x: number; z: number } {
   const theta = i * spec.turn;
   const radius = spec.radius + spec.wobble * Math.sin(i * 0.85);
   return { x: round2(radius * Math.cos(theta)), z: round2(radius * Math.sin(theta)) };
}

/** Total turning of the helix, in revolutions. */
export function helixTurns(spec: CloudSpec, count: number): number {
   if (count < 2) return 0;
   let turn = 0;
   let prev = Math.atan2(helixXZ(spec, 0).x, helixXZ(spec, 0).z);
   for (let i = 1; i < count; i++) {
      const p = helixXZ(spec, i);
      const a = Math.atan2(p.x, p.z);
      let d = a - prev;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      turn += d;
      prev = a;
   }
   return Math.abs(turn) / (2 * Math.PI);
}

interface Plan {
   kind: CloudKind;
   pad: boolean;
   drift: boolean;
   fade: boolean;
   chain: number;
}

export function buildClouds(level: CloudLevel): CloudDraft {
   const spec = level.spec;
   const steps = spec.surfaces - 1;
   const rising = riseSteps(steps, spec.rises);
   const xz = Array.from({ length: steps + 1 }, (_, i) => helixXZ(spec, i));
   const checkpoint = (i: number) => i > 0 && i < steps && i % spec.checkpointEvery === 0;

   const plans: Plan[] = [];
   for (let i = 0; i <= steps; i++) {
      const goal = i === steps;
      const cp = checkpoint(i);
      // a bounce only where this cloud and the next two steps all rise, so a launch cannot
      // skip a cloud: the cloud two ahead is above the bounce apex
      const pad = i > 0 && !goal && !cp && i < steps - 1 && spec.bounceEvery > 0 && i % spec.bounceEvery === 0 && rising[i] && rising[i + 1];
      const kind: CloudKind = i === 0 ? "start" : goal ? "goal" : cp ? "checkpoint" : "roof";
      plans.push({ kind, pad, drift: false, fade: false, chain: 0 });
   }

   // drift chains: consecutive still clouds that share a phase and a tangent, so they slide as one
   let chain = 0;
   if (spec.driftEvery > 0) {
      for (let i = 1; i < steps - 1; i += spec.driftEvery) {
         for (let k = i; k < Math.min(steps - 1, i + spec.driftEvery); k++) {
            const a = plans[k];
            const b = plans[k + 1];
            if (a.kind !== "roof" || b.kind !== "roof" || a.pad || b.pad || a.drift || b.drift) continue;
            chain += 1;
            for (const n of [k, k + 1]) {
               plans[n].drift = true;
               plans[n].chain = chain;
               plans[n].kind = "moving";
            }
            break;
         }
      }
   }

   if (spec.fadeEvery > 0) {
      for (let i = 1; i < steps; i++) {
         if (plans[i].pad || plans[i].drift || plans[i].kind !== "roof") continue;
         if (plans[i - 1].pad) continue;
         if (i % spec.fadeEvery === 0) plans[i].fade = true;
      }
   }

   const unit = (i: number) => (rising[i - 1] ? (plans[i - 1].pad ? spec.bounceRise : spec.normalRise) : 0);
   let raw = 0;
   for (let i = 1; i <= steps; i++) raw += unit(i);
   const scale = raw > 0 ? spec.goalTop / raw : 1;

   const supports: CloudSupport[] = [];
   let y = 0;
   for (let i = 0; i <= steps; i++) {
      if (i > 0) y = i === steps ? spec.goalTop : round2(y + unit(i) * scale);
      const plan = plans[i];
      const goal = plan.kind === "goal";
      const cp = plan.kind === "checkpoint";
      const w = goal ? 8 : cp ? 5.4 : i === 0 ? 7.2 : spec.width;
      const d = goal ? 7 : cp ? 5.0 : i === 0 ? 6.4 : spec.depth;
      let mover: CloudMover | null = null;
      if (plan.drift) {
         const group = plans.map((p, k) => (p.chain === plan.chain ? k : -1)).filter((k) => k >= 0);
         const a = xz[group[0]];
         const b = xz[group[group.length - 1]];
         const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
         mover = {
            axis: "tangent",
            travel: spec.driftTravel,
            periodMs: spec.driftPeriod,
            phase: round2(plan.chain * 0.17),
            tx: (b.x - a.x) / len,
            tz: (b.z - a.z) / len,
         };
      }
      supports.push({
         kind: plan.kind,
         cx: xz[i].x,
         cz: xz[i].z,
         hw: w / 2,
         hd: d / 2,
         top: y,
         mover,
         pad: plan.pad,
         fadeMs: plan.fade ? spec.fadeMs : 0,
         slippery: false,
      });
   }

   const orbs: CloudOrb[] = [];
   for (let i = 1; i <= steps; i++) {
      if (i % spec.orbEvery !== 0) continue;
      const prev = supports[i - 1];
      const here = supports[i];
      orbs.push({ x: round2((prev.cx + here.cx) / 2), y: round2(Math.max(prev.top, here.top) + 1.25), z: round2((prev.cz + here.cz) / 2) });
   }

   const strikes: CloudStrike[] = [];
   if (spec.sparks) {
      for (let i = 1; i < steps; i++) {
         if (supports[i].kind !== "roof" || supports[i].pad || i % 4 !== 2) continue;
         strikes.push({
            support: i,
            ox: round2(supports[i].hw * 0.92),
            oz: 0,
            radius: 0.22,
            periodMs: 3400,
            duty: 0.16,
            phase: round2((i % 5) * 0.13),
         });
      }
   }

   const lanes: WindLane[] = [];
   if (spec.wind) {
      for (let i = 1; i < steps; i += 3) {
         const a = supports[i];
         const b = supports[i + 1];
         const dx = b.cx - a.cx;
         const dz = b.cz - a.cz;
         const len = Math.hypot(dx, dz) || 1;
         const push = i % 2 === 0 ? 1 : -1;
         lanes.push({
            x: round2((a.cx + b.cx) / 2),
            z: round2((a.cz + b.cz) / 2),
            y0: Math.min(a.top, b.top) - 0.2,
            y1: Math.max(a.top, b.top) + 7,
            hw: 2.1,
            hd: 2.1,
            ax: round2((-dz / len) * spec.windAccel * push),
            az: round2((dx / len) * spec.windAccel * push),
         });
      }
   }

   return { supports, orbs, strikes, lanes, wind: spec.wind, goalTop: spec.goalTop };
}
