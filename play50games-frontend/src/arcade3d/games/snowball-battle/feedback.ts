// What the player sees about the scoop and the throw (Scene, ScoopMeter, Aim). Pure and read-only:
// it reads the run and the rules' constants, never changes them, so rules, bots and proofs are as before.
import { GRAVITY, SCOOP, THROW, flightTime, type MissReason } from "./rules";
import type { SnowLevel } from "./levels";

export type ScoopZone = "short" | "ready" | "roller";

/** The meter's zone for a press held `t` s: grey under SCOOP.min, green up to SCOOP.max, red at it. */
export function scoopZone(t: number): ScoopZone {
   if (t >= SCOOP.max - 1e-4) return "roller";
   if (t >= SCOOP.min) return "ready";
   return "short";
}

/** How full the meter is (0..1); the green zone starts at SCOOP.min / SCOOP.max = 1/3. */
export function scoopFill(t: number): number {
   return Math.max(0, Math.min(1, t / SCOOP.max));
}

/** The meter's word under the ring. */
export function scoopLabel(zone: ScoopZone, ammo: number): string {
   if (zone === "roller") return "ROLLER!";
   if (zone === "ready") return ammo >= SCOOP.maxAmmo ? "HANDS FULL" : "LET GO!";
   return "HOLD…";
}

/** The player's snowball in the right hand: it grows while a scoop is held, then stays while a ball is packed. */
export function handBallRadius(scooping: boolean, scoopT: number, ammo: number): number {
   if (scooping) return 0.04 + 0.1 * scoopFill(scoopT);
   return ammo > 0 ? 0.12 : 0;
}

export type ScoopOutcome = "packed" | "roller" | "short" | "full" | null;

/**
 * What one frame of the scoop did, from the rules' state before and after it and this frame's scoop
 * event (`kind: "scoop"`, n 1 = a ball pocketed, n 2 = a roller, 0 = none). A release with no event
 * pocketed nothing: under SCOOP.min it was too short, otherwise the hands were full.
 */
export function scoopOutcome(wasScooping: boolean, heldT: number, ammoBefore: number, nowScooping: boolean, scoopEvent: number): ScoopOutcome {
   if (scoopEvent === 2) return "roller";
   if (scoopEvent === 1) return "packed";
   if (!wasScooping || nowScooping) return null;
   if (heldT < SCOOP.min) return "short";
   return ammoBefore >= SCOOP.maxAmmo ? "full" : null;
}

/** The pop text for a scoop outcome (null = no pop). */
export function scoopPop(outcome: ScoopOutcome, ammoAfter: number): { text: string; kind: "good" | "fail" | "info" } | null {
   if (outcome === "packed") return { text: "+1 snowball", kind: "good" };
   if (outcome === "roller") return { text: "Roller!", kind: "good" };
   if (outcome === "short") return { text: "Too short", kind: "fail" };
   if (outcome === "full") return { text: `Hands full (${ammoAfter})`, kind: "info" };
   return null;
}

/** The pop for a click / Space that did not throw (rules.missReason). */
export function missPop(reason: MissReason | null, touch: boolean): string | null {
   if (reason === "ammo") return touch ? "No snowball: hold Scoop" : "No snowball: hold E";
   if (reason === "blocked") return "Blocked by cover";
   if (reason === "none") return "No target in range";
   return null;
}

/**
 * The aim arc's points (n ≥ 2) into `out` (x, y, z triples): the rules' lob from the hand (y
 * THROW.launchY, THROW.launchForward ahead) to (tx, ty, tz) over the rules' flight time. The drawn
 * arc has no lead (the rules lead a moving rival), so it shows where the ball goes, not a promise.
 */
export function aimArc(px: number, pz: number, tx: number, ty: number, tz: number, level: SnowLevel, n: number, out: Float32Array): number {
   const dx = tx - px;
   const dz = tz - pz;
   const d = Math.hypot(dx, dz);
   const ux = d > 1e-6 ? dx / d : 0;
   const uz = d > 1e-6 ? dz / d : 1;
   const x0 = px + ux * THROW.launchForward;
   const z0 = pz + uz * THROW.launchForward;
   const y0 = THROW.launchY;
   const ft = flightTime(d, level);
   const vy = (ty - y0 + 0.5 * GRAVITY * ft * ft) / ft;
   for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const t = k * ft;
      out[i * 3] = x0 + (tx - x0) * k;
      out[i * 3 + 1] = y0 + vy * t - 0.5 * GRAVITY * t * t;
      out[i * 3 + 2] = z0 + (tz - z0) * k;
   }
   return ft;
}
