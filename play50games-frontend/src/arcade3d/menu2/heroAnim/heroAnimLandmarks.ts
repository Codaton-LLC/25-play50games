// Each hero's animation landmarks, measured once on its real GLB (heroAnim.glb.test.ts re-measures
// them): where the curled body sits and how big it is, so the shell of the ball-roll closes round it,
// plus the ball's colours from the hero's own palette. The rig's joints are heroModels.ts
// HERO_LANDMARKS; these sit on top of them.
import { HERO_SCALE, HERO_SOLE_Z, type M2HeroId } from "@/arcade3d/menu2/heroModels";
import type { HeroBallFit } from "./heroBody";

/**
 * The curled body (curlPose(1), lifted clear of the floor) on each mesh, GLB units in the rig's own
 * frame (feet on y = 0, facing +z): its bounding box's centre (y, z) and the radius round that centre
 * holding 98 % of its vertices (the tail tip and the snout poke out past it, hidden by the shell).
 * Measured 2026-10-27 (heroAnim.glb.test.ts).
 */
export const HERO_CURL: Record<M2HeroId, { centerY: number; centerZ: number; radius: number }> = {
   riko: { centerY: 0.8166, centerZ: 0.5615, radius: 0.8239 },
   nami: { centerY: 0.8106, centerZ: 0.4901, radius: 0.8389 },
   kiro: { centerY: 0.8798, centerZ: 0.5503, radius: 0.9449 },
   zuno: { centerY: 0.816, centerZ: 0.4863, radius: 0.829 },
   vexa: { centerY: 0.7781, centerZ: 0.4969, radius: 0.8342 },
};

/** The ball's radius (m) unless a game asks for another: the Sky Tower rules' rolled hero. */
export const HERO_BALL_RADIUS = 0.5;

/** The curled body fills this share of the shell's radius (it shrinks into the shell as it closes). */
export const CURL_FILL = 0.92;

/**
 * One hero's ball in metres as <AnimatedHero> draws it (the model shifted back by its sole, scaled
 * by HERO_SCALE): the curl's centre over the feet point, and the body's scale inside a shell of
 * `radius` m.
 */
export function heroBallFit(id: M2HeroId, radius = HERO_BALL_RADIUS): HeroBallFit {
   const c = HERO_CURL[id];
   const s = HERO_SCALE[id];
   return {
      radius,
      curlCenterY: c.centerY * s,
      curlCenterZ: (c.centerZ - HERO_SOLE_Z[id]) * s,
      bodyScale: Math.min(1, (CURL_FILL * radius) / (c.radius * s)),
   };
}

/** The ball's plates, their darker overlaps and the glowing seams, from each hero's own colours. */
export interface HeroBallLook {
   plate: string;
   plateDark: string;
   glow: string;
}

export const HERO_LOOK: Record<M2HeroId, HeroBallLook> = {
   riko: { plate: "#ef4444", plateDark: "#9f1d1d", glow: "#ff7a3c" },
   nami: { plate: "#2563eb", plateDark: "#1e3a8a", glow: "#60c8ff" },
   kiro: { plate: "#22c55e", plateDark: "#166534", glow: "#a3ff6b" },
   zuno: { plate: "#facc15", plateDark: "#a16207", glow: "#fff1a1" },
   vexa: { plate: "#8b5cf6", plateDark: "#4c1d95", glow: "#e0b3ff" },
};

/** The hero's accent (particles, the aura): its glow colour. */
export function heroAccent(id: M2HeroId): string {
   return HERO_LOOK[id].glow;
}
