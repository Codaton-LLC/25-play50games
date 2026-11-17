// Palette, chase camera and per-level reef looks. Pure: no React.
// Each theme (levels.ts) gets its own sand / water / coral tone and apron scenery outside the play box.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type ReefTheme, type SubLevel } from "./levels";

export const COLORS = {
   sand: "#e7c98a",
   sandDeep: "#c4a15a",
   fog: "#0e7490",
   accent: "#22d3ee",
   accentDeep: "#0891b2",
   hull: "#e2e8f0",
   hullDark: "#334155",
   glass: "#67e8f9",
   prop: "#0f172a",
   coral: "#fb7185",
   coralDeep: "#9f1239",
   kelp: "#15803d",
   kelpDark: "#14532d",
   rock: "#78716c",
   rockDark: "#44403c",
   arch: "#57534e",
   wreck: "#44403c",
   wreckTrim: "#b45309",
   dock: "#0f766e",
   dockTrim: "#99f6e4",
   shell: "#f8fafc",
   pearl: "#fde68a",
   amphora: "#d6b48a",
   amphoraDark: "#92400e",
   chest: "#b45309",
   chestTrim: "#fbbf24",
   coin: "#fbbf24",
   jelly: "#e879f9",
   jellyCore: "#fbcfe8",
   anchor: "#1e293b",
   column: "#e7e5e4",
   columnBand: "#a8a29e",
   fish: "#fb923c",
   fishFin: "#0ea5e9",
   current: "#a5f3fc",
} as const;

/** Sand, rock and coral tones for one reef theme. Gameplay accents stay on COLORS. */
export interface ReefLook {
   sand: string;
   sandDeep: string;
   rock: string;
   rockDark: string;
   coral: string;
   coralDeep: string;
   kelp: string;
   /** apron set pieces outside the playable reef (Decor.tsx) */
   scenery: "sparse" | "garden" | "shipyard" | "cavern" | "temple";
}

export const LOOKS: Record<ReefTheme, ReefLook> = {
   // Shallow Reef: today's warm sand and pink coral under bright cyan water.
   shallow: {
      sand: COLORS.sand, sandDeep: COLORS.sandDeep, rock: COLORS.rock, rockDark: COLORS.rockDark,
      coral: COLORS.coral, coralDeep: COLORS.coralDeep, kelp: COLORS.kelp, scenery: "sparse",
   },
   // Coral Reef: richer teal sand wash, hotter coral, denser garden apron.
   coral: {
      sand: "#d4c48a", sandDeep: "#a8894a", rock: "#6b7280", rockDark: "#374151",
      coral: "#f43f5e", coralDeep: "#be123c", kelp: "#16a34a", scenery: "garden",
   },
   // Sunken Ship: rusty sand, amber dusk fog from levels.background, darker wreck-toned rock.
   wreck: {
      sand: "#c4a882", sandDeep: "#8b6914", rock: "#57534e", rockDark: "#292524",
      coral: "#ea580c", coralDeep: "#9a3412", kelp: "#4d7c0f", scenery: "shipyard",
   },
   // Deep Cave: cool blue-grey floor, muted coral, cave-wall apron on three sides.
   cave: {
      sand: "#94a3b8", sandDeep: "#475569", rock: "#334155", rockDark: "#0f172a",
      coral: "#818cf8", coralDeep: "#4338ca", kelp: "#0f766e", scenery: "cavern",
   },
   // Ancient Ruins: pale stone sand, soft coral, temple pillars on the apron.
   ruins: {
      sand: "#d6d3d1", sandDeep: "#a8a29e", rock: "#78716c", rockDark: "#44403c",
      coral: "#c084fc", coralDeep: "#6b21a8", kelp: "#365314", scenery: "temple",
   },
};

export const PITCH = (55 * Math.PI) / 180;
export const FOV = 46;
export const LOOK_AHEAD = 2.5;
export const FOLLOW = 1;
export const DAMPING = 5.5;
/** Floor extends past the playable reef so the chase view never shows a void. */
export const FLOOR_PAD = 48;
/** Apron decor stands at least this far past the playable reef edge. */
export const APRON_GAP = 2.4;

export function seaBounds(level: SubLevel): AABB {
   return {
      min: { x: -level.width / 2, y: 0, z: -level.depth / 2 },
      max: { x: level.width / 2, y: 3.2, z: level.depth / 2 },
   };
}

/** True when a point sits inside the playable reef (plus margin). Apron decor must stay outside. */
export function inPlayReef(level: SubLevel, x: number, z: number, margin = 0): boolean {
   const hx = level.width / 2 + margin;
   const hz = level.depth / 2 + margin;
   return Math.abs(x) <= hx && Math.abs(z) <= hz;
}

/** The floor is centered on the origin, so the look-at is the same on every level. */
export function lookAtFor(level: SubLevel): [number, number, number] {
   void level;
   return [0, 0.6, 0];
}

/**
 * The water: the level's background colour (so the floor's far edge melts into it, no horizon line),
 * clear for the camera's reach (about 14 m on a desktop, 25 m on a phone) and murky beyond it.
 */
export function fogOf(level: SubLevel): [string, number, number] {
   return [level.background, 14, level.fogFar * 1.15];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** A window around the sub, not the whole reef. Portrait uses the same yaw; shift clears the HUD. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = { min: { x: -5, y: 0, z: -5.2 }, max: { x: 5, y: 3.4, z: 5.2 } };
      view = {
         area,
         pitch: PITCH,
         yaws: [0],
         // the area is the window round the camera aim, which follows the sub: one focus, the rest position
         focus: [{ x: 0, y: 0.6, z: 0 }],
         margin: { top: 0.08, right: 0.03, bottom: 0.1, left: 0.03 },
         padding: 6,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
      void level;
   }
   return view;
}

// ---------- apron scenery (visual only; never inside the playable reef) ----------

export interface ReefDecor {
   rocks: InstanceSpot[];
   coral: InstanceSpot[];
   kelp: InstanceSpot[];
   arches: InstanceSpot[];
   wrecks: InstanceSpot[];
   columns: InstanceSpot[];
   anchors: InstanceSpot[];
}

function ring(level: SubLevel, out: number, step: number, fn: (x: number, z: number, side: "n" | "s" | "e" | "w") => void): void {
   const hx = level.width / 2 + out;
   const hz = level.depth / 2 + out;
   for (let x = -hx; x <= hx; x += step) {
      fn(x, hz, "n");
      fn(x, -hz, "s");
   }
   for (let z = -hz + step; z < hz; z += step) {
      fn(hx, z, "e");
      fn(-hx, z, "w");
   }
}

/** Seeded apron props for one level. Every spot is outside the playable reef by APRON_GAP. */
export function decorSpots(id: LevelId): ReefDecor {
   const level = LEVELS[id];
   const look = LOOKS[level.theme];
   const out: ReefDecor = { rocks: [], coral: [], kelp: [], arches: [], wrecks: [], columns: [], anchors: [] };
   const gap = APRON_GAP;
   const hx = level.width / 2;
   const hz = level.depth / 2;

   if (look.scenery === "sparse") {
      // a few rocks and kelp on the far apron so L1 is not a void, but still the open shallow reef
      for (const side of [-1, 1] as const) {
         out.rocks.push({ x: side * (hx + gap + 1.2), y: 0, z: hz * 0.2, rotY: side * 0.4, scale: 1.8 });
         out.kelp.push({ x: side * (hx + gap + 0.6), y: 0, z: -hz * 0.15, rotY: 0.5, scale: 1.4 });
      }
      out.coral.push({ x: 0, y: 0, z: hz + gap + 1.5, rotY: 0.2, scale: 1.5 });
      return out;
   }

   if (look.scenery === "garden") {
      // coral heads and kelp all round the apron — the "Coral Reef" reads from outside the play box
      ring(level, gap + 1.2, 4.2, (x, z, side) => {
         if (side === "s" && Math.abs(x) < 4) return; // leave the dock approach clear in the frame
         out.coral.push({ x, y: 0, z, rotY: x * 0.3 + z * 0.1, scale: 1.6 + ((Math.abs(x) + Math.abs(z)) % 5) * 0.08 });
         if ((Math.abs(x) + Math.abs(z)) % 8 < 3) {
            // offset further out (never toward the play box)
            const ox = side === "e" ? 1.1 : side === "w" ? -1.1 : 0;
            const oz = side === "n" ? 1.1 : side === "s" ? -1.1 : 0;
            out.kelp.push({ x: x + ox, y: 0, z: z + oz, rotY: z * 0.2, scale: 1.5 });
         }
      });
      out.arches.push({ x: -hx - gap - 1.5, y: 0, z: 2, rotY: Math.PI / 2, scale: 2.2 });
      out.arches.push({ x: hx + gap + 1.5, y: 0, z: -2, rotY: -Math.PI / 2, scale: 2.0 });
      return out;
   }

   if (look.scenery === "shipyard") {
      // broken hulls and anchors on the apron; the play wreck sits inside via rules landmarks
      out.wrecks.push({ x: -hx - gap - 2.5, y: 0, z: hz * 0.35, rotY: 0.35, sx: 5.2, sy: 1.4, sz: 2.4 });
      out.wrecks.push({ x: hx + gap + 2.2, y: 0, z: -hz * 0.1, rotY: -0.6, sx: 4.4, sy: 1.2, sz: 2.0 });
      out.anchors.push({ x: -hx - gap - 1.0, y: 0, z: 0, rotY: 0.4, scale: 1.6 });
      out.anchors.push({ x: hx + gap + 1.0, y: 0, z: hz * 0.5, rotY: -0.2, scale: 1.5 });
      out.rocks.push({ x: 0, y: 0, z: hz + gap + 2.0, rotY: 0.1, scale: 2.4 });
      out.kelp.push({ x: -hx - gap - 0.5, y: 0, z: -hz * 0.4, rotY: 1.1, scale: 1.6 });
      out.kelp.push({ x: hx + gap + 0.5, y: 0, z: hz * 0.15, rotY: 0.3, scale: 1.5 });
      return out;
   }

   if (look.scenery === "cavern") {
      // rock walls on north / east / west — the cave mouth frames the deep water
      for (let x = -hx - 1; x <= hx + 1; x += 2.8) {
         out.rocks.push({ x, y: 0, z: hz + gap + 1.2, rotY: x * 0.05, scale: 2.6 + (Math.abs(x) % 3) * 0.15 });
      }
      for (let z = -hz + 2; z <= hz - 2; z += 3.2) {
         out.rocks.push({ x: hx + gap + 1.4, y: 0, z, rotY: Math.PI / 2, scale: 2.5 });
         out.rocks.push({ x: -hx - gap - 1.4, y: 0, z, rotY: -Math.PI / 2, scale: 2.5 });
      }
      // arched cave mouth on the north apron
      out.arches.push({ x: -4.5, y: 0, z: hz + gap + 0.6, rotY: 0, scale: 2.4 });
      out.arches.push({ x: 4.5, y: 0, z: hz + gap + 0.6, rotY: 0, scale: 2.4 });
      out.kelp.push({ x: 0, y: 0, z: -hz - gap - 1.2, rotY: 0.5, scale: 1.3 });
      return out;
   }

   // temple: colonnade on the east and west aprons, a few fallen slabs north
   for (let z = -hz + 3; z <= hz - 3; z += 4.5) {
      out.columns.push({ x: -hx - gap - 1.2, y: 0.44, z, rotY: Math.PI / 2, scale: 1 });
      out.columns.push({ x: hx + gap + 1.2, y: 0.44, z, rotY: Math.PI / 2, scale: 1 });
   }
   out.wrecks.push({ x: -3.5, y: 0, z: hz + gap + 2.2, rotY: 0.2, sx: 4.8, sy: 1.1, sz: 2.0 });
   out.wrecks.push({ x: 4.0, y: 0, z: hz + gap + 1.8, rotY: -0.5, sx: 3.8, sy: 1.0, sz: 1.8 });
   out.coral.push({ x: 0, y: 0, z: -hz - gap - 1.5, rotY: 0.7, scale: 1.4 });
   out.anchors.push({ x: hx + gap + 2.5, y: 0, z: hz * 0.2, rotY: 0.9, scale: 1.4 });
   return out;
}
