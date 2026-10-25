import type { BufferGeometry } from "three";
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE, PROP_BUDGET, ROCKET_FEET_GLB } from "@/arcade3d/core/sharedAssets";

export const ROCKET_SCALE = 2.2 / EXPANSION_GLB_SIZE.rocket.height;

/**
 * The landing pad GLB measured on the real mesh (assets.test.ts decodes it): the slab stands on
 * y = 0 and its deck tops out at deckTop (GLB units). The GLB mesh originally included a central
 * beacon cone poking up through the touchdown zone; flattenLandingPadCone flattens that cone down
 * to deckTop so the landing surface stays completely flat and level at +0.2 above the group origin,
 * matching the physics surface (WORLD.padY = 2) with yOffset -0.2. Small beacon lights on the pad
 * rim mark the landing zone boundaries without obstructing touchdown. The runtime group scale.x =
 * PLANETS[p].width stretches the drawn width as before, so x stays the authored 1.
 */
export const LANDING_PAD_GLB = { width: 1.8948084, deckTop: 0.2786218, height: 0.8244281, depth: 1.9048288 };
export const LANDING_PAD_NODE_Y = 0.4109845757484436;
const LANDING_PAD_SCALE = 0.4 / LANDING_PAD_GLB.deckTop;

/**
 * Flattens any vertex of the landing pad mesh that rises above the deck slab surface
 * (the central beacon cone that would otherwise poke through the landing rocket) down to the
 * deck level, ensuring the entire top surface matches the physics landing surface (padY = 2).
 */
export function flattenLandingPadCone(geometry: BufferGeometry, nodeY = LANDING_PAD_NODE_Y): void {
   const position = geometry.getAttribute("position");
   if (!position) return;
   const effectiveNodeY = nodeY !== 0 ? nodeY : LANDING_PAD_NODE_Y;
   const deckThreshold = LANDING_PAD_GLB.deckTop - effectiveNodeY;
   for (let i = 0; i < position.count; i++) {
      if (position.getY(i) > deckThreshold) {
         position.setY(i, deckThreshold);
      }
   }
   position.needsUpdate = true;
}

/**
 * Small beacon lights placed on the rim corners of the pad to mark the landing zone boundaries.
 * Placed outside the touchdown footprint so they never intersect the landing surface or the rocket feet.
 * Scaled with pad.scale.x at runtime so they always stay on the outer rim on every planet.
 */
export const BEACON_LIGHTS = [
   { x: -0.48, y: 0.22, z: -0.92 },
   { x: 0.48, y: 0.22, z: -0.92 },
   { x: -0.48, y: 0.22, z: 0.92 },
   { x: 0.48, y: 0.22, z: 0.92 },
] as const;

/**
 * The rocket touchdown footprint on the pad's top surface (local coordinates).
 * The deck sits at y = 0.2, extending horizontally where the rocket touches down.
 * Beacon geometry must not intersect this surface area.
 */
export const PAD_DECK_FOOTPRINT = {
   minX: -0.42,
   maxX: 0.42,
   minZ: -0.85,
   maxZ: 0.85,
   y: 0.2,
} as const;

export const ASSETS = {
   rocket: { ...EXPANSION_ASSETS.rocket, scale: ROCKET_SCALE },
   landingPad: {
      id: "landingPad",
      url: "/models/3d/rocket-landing/landingPad.glb",
      scale: LANDING_PAD_SCALE,
      stretch: [
         1 / (LANDING_PAD_GLB.width * LANDING_PAD_SCALE),
         1,
         2 / (LANDING_PAD_GLB.depth * LANDING_PAD_SCALE),
      ] as const,
      yOffset: -0.2,
      fallback: "box",
      fallbackColor: "#334155",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
export const BELL = { x: EXPANSION_GLB_POINTS.rocketBell.x * ROCKET_SCALE, y: EXPANSION_GLB_POINTS.rocketBell.y * ROCKET_SCALE, z: EXPANSION_GLB_POINTS.rocketBell.z * ROCKET_SCALE };
export const FEET_3D = ROCKET_FEET_GLB.map((p) => ({ x: p.x * ROCKET_SCALE, y: p.y * ROCKET_SCALE, z: p.z * ROCKET_SCALE }));
export const SUPPORT = [[-0.64138, 0.0005], [0.66023, 0.00989]] as const;
export const HULL_SKIN = 0.012;
// Full counter-clockwise convex hull decoded from all 4,877 fitted mesh vertices.
export const MESH_HULL = [
   [-0.75547, 0.42181], [-0.74458, 0.34241], [-0.73514, 0.29466], [-0.64138, 0.0005],
   [-0.55202, 0.00001], [0.04659, 0], [0.55311, 0], [0.57046, 0.00013],
   [0.65539, 0.00146], [0.66023, 0.00989], [0.74559, 0.33762], [0.75547, 0.45364],
   [0.74283, 0.52723], [0.72965, 0.59397], [0.45731, 1.59772], [0.40644, 1.73089],
   [0.40336, 1.7388], [0.35908, 1.83953], [0.29565, 1.94939], [0.20006, 2.07154],
   [0.07714, 2.18545], [0.05111, 2.19454], [-0.02036, 2.20005], [-0.03095, 2.19594],
   [-0.11446, 2.14901], [-0.22185, 2.02712], [-0.2958, 1.91694], [-0.34618, 1.83198],
   [-0.40852, 1.68597], [-0.42703, 1.63583], [-0.7148, 0.63074], [-0.73604, 0.55634],
] as const;
// Intersections of adjacent outward-offset halfplanes. Made once, never in a frame.
export const HULL = MESH_HULL.map((p, i, a) => {
   const prev = a[(i + a.length - 1) % a.length], next = a[(i + 1) % a.length];
   const ax = p[0] - prev[0], ay = p[1] - prev[1], bx = next[0] - p[0], by = next[1] - p[1];
   const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
   const nx = ay / al, ny = -ax / al, mx = by / bl, my = -bx / bl;
   const d = nx * my - ny * mx;
   return [p[0] + HULL_SKIN * (my - ny) / d, p[1] + HULL_SKIN * (nx - mx) / d] as const;
});
