// The Hall of Doors (pure data, no three.js): the lanes, the five door colours (each with its own
// shape and chime, the card's colour-blind fix), and each level's static course: the door walls
// (where, which rule, how many open doors, the specials: Riko's cracked fake door, Vexa's ghost door,
// Nami's upper door row, the sliding doors), the rule lamps (echo lamps hang two walls early), the
// colour orbs (main orbs in a slalom between walls; bonus orbs behind the hero gates), the floor bars
// and low beams, the speed pads, Kiro's flame vents, Zuno's hidden wall trails, Riko's side corridors
// and the secrets. Which colour each door gets, and so which door is true, is rolled per run
// (rules.ts rollWall): a run is seeded from a fixed pool, the course's geometry is not.
import type { LevelId } from "@/arcade3d/types";
import type { DoorLevel } from "./levels";

export const NONE = -1;
/** lane width (m): the lanes are centred on x = 0 */
export const LANE_W = 2.4;
/** the hall's side walls stand this far outside the outer lanes' edges (m) */
export const HALL_MARGIN = 0.6;
/** the door opening (m) and the wall's height */
export const DOOR = { w: 1.7, h: 2.7, wallH: 4.4, tallH: 6.2, thick: 0.5 } as const;
/** the upper door row of a tall wall: its sill over the floor (m) */
export const UPPER_SILL = 3.0;

export type RuleMode = "match" | "sound" | "not";
export type ShapeId = "circle" | "triangle" | "square" | "diamond" | "hex";

export interface DoorColor {
   id: string;
   name: string;
   hex: string;
   glow: string;
   shape: ShapeId;
   /** the chime's pitch (playSfx pitch) */
   chime: number;
}

/** The five door colours: the heroes' colours, each with a shape and its own chime. */
export const DOOR_COLORS: readonly DoorColor[] = [
   { id: "red", name: "Red", hex: "#ef4444", glow: "#fca5a5", shape: "circle", chime: 0.8 },
   { id: "blue", name: "Blue", hex: "#3b82f6", glow: "#93c5fd", shape: "triangle", chime: 1.0 },
   { id: "green", name: "Green", hex: "#22c55e", glow: "#86efac", shape: "square", chime: 1.2 },
   { id: "yellow", name: "Yellow", hex: "#facc15", glow: "#fde68a", shape: "diamond", chime: 1.42 },
   { id: "purple", name: "Purple", hex: "#a855f7", glow: "#d8b4fe", shape: "hex", chime: 1.68 },
];

export function laneX(lane: number, lanes: number): number {
   return (lane - (lanes - 1) / 2) * LANE_W;
}

export function hallHalf(lanes: number): number {
   return (lanes * LANE_W) / 2 + HALL_MARGIN;
}

export interface WallDef {
   index: number;
   z: number;
   mode: RuleMode;
   /** coloured doors (the rest are shut), not counting the specials */
   open: number;
   /** level 1's second beat: the lamp's colour is painted on the floor arrows too */
   floorArrows: boolean;
   /** the echo rule: this wall's lamp hangs before the wall before it (hold one rule in memory) */
   echo: boolean;
   /** the lamp dims (level 2's second half, the sound rule): hear the chime */
   dim: boolean;
   /** special lanes (NONE = none) */
   cracked: number;
   ghost: number;
   /** a tall wall's upper door over this lane (Nami's double jump) */
   upper: number;
   /** the doors slide one lane over during the approach */
   slide: boolean;
}

export interface LampDef {
   z: number;
   wall: number;
   echo: boolean;
}

export interface OrbDef {
   x: number;
   y: number;
   z: number;
   kind: "main" | "bonus";
   /** Zuno's wall trails: only with the magnet up */
   hidden: boolean;
}

export interface BarDef {
   z: number;
   /** "bar": jump over it; "beam": roll under it */
   kind: "bar" | "beam";
}

export interface PadDef {
   lane: number;
   z: number;
}

export interface VentDef {
   lane: number;
   z0: number;
   z1: number;
}

/** Riko's hidden side corridor behind a cracked fake door: it skips the next two walls. */
export interface SideDef {
   wall: number;
   /** -1 the left side (lane 0), +1 the right side */
   side: number;
   x: number;
   z0: number;
   z1: number;
   /** the outer lane it opens from and rejoins */
   lane: number;
}

export interface SecretSpot {
   x: number;
   y: number;
   z: number;
   /** what opens it: the side corridor, the upper row, a ghost door (that wall) */
   need: "side" | "upper" | "ghost";
   wall: number;
}

export interface HallDraft {
   lanes: number;
   walls: WallDef[];
   lamps: LampDef[];
   orbs: OrbDef[];
   bars: BarDef[];
   pads: PadDef[];
   vents: VentDef[];
   sides: SideDef[];
   secrets: Record<string, SecretSpot>;
   startZ: number;
   finishZ: number;
   /** level 5: Flicker rises once the hero passes this z (NaN without a boss) */
   bossStartZ: number;
}

/** Where the first wall stands, and how far the lamp hangs ahead of its wall. */
export const FIRST_WALL = 50;
export const LAMP_AHEAD = 15;
/** level 5's arena: the walls Flicker slams, this far apart; the static finish this far past the boss start */
export const ARENA = { lead: 45, spacing: 38, minLength: 760 } as const;
/** the finish line after the last wall */
export const FINISH_AFTER = 48;

interface WallSpec {
   mode?: RuleMode;
   open?: number;
   floor?: boolean;
   echo?: boolean;
   dim?: boolean;
   cracked?: number;
   ghost?: number;
   upper?: number;
   slide?: boolean;
}

/** Each level's walls (the card's beats and twists). */
function wallSpecs(id: LevelId, lanes: number): WallSpec[] {
   const R = lanes - 1;
   switch (id) {
      case 1:
         // beat 1: one door open, the other shut (a ghost door and a cracked door are the "shut" ones);
         // beat 2: two colours, the lamp's colour on the floor arrows too; beat 3: the lamp only
         return [
            { open: 1, ghost: 1 },
            { open: 1, cracked: 0 },
            { open: 2, floor: true },
            { open: 2, floor: true },
            { open: 2, floor: true },
            { open: 2 },
            { open: 2 },
            { open: 2 },
         ];
      case 2:
         // three lanes and the chimes; halfway the lamp dims (the sound rule): hear the chime
         return [
            { open: 2 },
            { open: 3 },
            { open: 2, cracked: 0 },
            { open: 3 },
            { open: 3 },
            { mode: "sound", dim: true, open: 3 },
            { mode: "sound", dim: true, open: 2, ghost: R },
            { mode: "sound", dim: true, open: 3 },
            { mode: "sound", dim: true, open: 3 },
            { mode: "sound", dim: true, open: 3 },
         ];
      case 3:
         // sliding doors, cracked fake doors, the NOT rule; Nami's upper doors over the tall walls
         return [
            { open: 3 },
            { open: 3 },
            { open: 3, slide: true },
            { open: 2, cracked: R },
            { open: 3, upper: 1 },
            { open: 3, slide: true },
            { mode: "not", open: 3 },
            { mode: "not", open: 2, ghost: 0 },
            { open: 3, upper: 1, slide: true },
            { mode: "not", open: 2, cracked: 0 },
            { mode: "sound", dim: true, open: 3, slide: true },
            { mode: "not", open: 3 },
         ];
      case 4:
         // the echo rule (hold one wall in memory), 4 to 5 lanes, 16 m/s
         return [
            { open: 4 },
            { open: 5 },
            { open: 4, slide: true },
            { open: 4, cracked: 0 },
            { open: 5, echo: true },
            { open: 4, echo: true },
            { mode: "not", open: 4, echo: true, upper: 2 },
            { open: 5, echo: true },
            { open: 4, echo: true, ghost: R },
            { mode: "not", open: 4, cracked: R },
            { open: 5, echo: true },
            { mode: "not", open: 5, echo: true, upper: 2 },
            { open: 4, echo: true, slide: true },
            { open: 5, echo: true },
         ];
      case 5:
         // the warm-up: every rule once, then Flicker's arena (rules.ts)
         return [
            { open: 3 },
            { mode: "sound", dim: true, open: 4, upper: 1 },
            { mode: "not", open: 3, slide: true },
            { open: 3, echo: true, cracked: 0 },
            { open: 3, ghost: R },
         ];
   }
}

/** The gap lengths between walls: 35 to 45 m (a fixed pattern per level). */
export function gapLength(id: LevelId, i: number): number {
   return 35 + ((i * 7 + id * 3) % 11);
}

/** Builds a level's course (pure, deterministic: no rng; the doors' colours are rolled per run). */
export function buildHall(level: DoorLevel): HallDraft {
   const id = level.id;
   const lanes = level.lanes;
   const half = hallHalf(lanes);
   const specs = wallSpecs(id, lanes);
   const walls: WallDef[] = [];
   let z = -FIRST_WALL;
   for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      if (i > 0) z -= gapLength(id, i);
      walls.push({
         index: i,
         z,
         mode: s.mode ?? "match",
         open: s.open ?? lanes,
         floorArrows: s.floor ?? false,
         echo: s.echo ?? false,
         dim: s.dim ?? false,
         cracked: s.cracked ?? NONE,
         ghost: s.ghost ?? NONE,
         upper: s.upper ?? NONE,
         slide: s.slide ?? false,
      });
   }
   const lastZ = walls[walls.length - 1].z;
   const bossStartZ = level.boss ? lastZ - ARENA.lead + 20 : Number.NaN;
   const finishZ = level.boss ? bossStartZ - ARENA.minLength : lastZ - FINISH_AFTER;

   // the lamps: a wall's lamp hangs LAMP_AHEAD before it; an echo wall's lamp hangs before the wall before it
   const lamps: LampDef[] = [];
   for (const w of walls) {
      if (w.echo && w.index > 0) lamps.push({ z: walls[w.index - 1].z + LAMP_AHEAD + 5, wall: w.index, echo: true });
      else lamps.push({ z: w.z + LAMP_AHEAD, wall: w.index, echo: false });
   }

   const orbs: OrbDef[] = [];
   const bars: BarDef[] = [];
   const pads: PadDef[] = [];
   const vents: VentDef[] = [];
   const sides: SideDef[] = [];
   const secrets: Record<string, SecretSpot> = {};
   const orbY = 0.75;

   // the gaps: g = 0 from the start to wall 0, g = k from wall k-1 to wall k
   for (let g = 0; g < walls.length; g++) {
      const z0 = g === 0 ? 0 : walls[g - 1].z;
      const z1 = walls[g].z;
      const len = z0 - z1;
      const fz = (f: number) => z0 - len * f;
      // Kiro's flame vent on an outer lane in some gaps (its bonus orbs inside)
      const ventGap = g >= 1 && g % 4 === 1;
      const ventLane = ventGap ? (g % 2 === 0 ? 0 : lanes - 1) : NONE;
      if (ventLane !== NONE) {
         vents.push({ lane: ventLane, z0: fz(0.3), z1: fz(0.52) });
         for (let k = 0; k < 3; k++) orbs.push({ x: laneX(ventLane, lanes), y: orbY, z: fz(0.34 + k * 0.07), kind: "bonus", hidden: false });
      }
      // main orbs, clear of the lock zone: on 2-3 lanes a slalom across the lanes; on 4-5 lanes a line of
      // three in one of the middle lanes (never more than two lanes from any door, so every one is reachable)
      const count = g === 0 ? 2 : 3;
      const wide = lanes >= 4;
      for (let k = 0; k < count; k++) {
         let lane = wide ? 1 + ((g + k * 0) % (lanes - 2)) : (g * 2 + k) % lanes;
         if (lane === ventLane) lane = wide ? lanes - 1 - lane : (lane + 1) % lanes;
         if (lane === ventLane) lane = (lane + 1) % lanes;
         orbs.push({ x: laneX(lane, lanes), y: orbY, z: fz(g === 0 ? 0.35 + k * 0.15 : wide ? 0.3 + k * 0.07 : 0.22 + k * 0.12), kind: "main", hidden: false });
      }
      // floor bars and low beams (from L1's last beat), Nami's high orbs over the bars
      const obstacle = id === 1 ? (g === 6 ? "bar" : g === 7 ? "beam" : null) : g >= 1 && g % (id >= 3 ? 1 : 2) === 0 ? (g % 4 === 0 || (id >= 3 && g % 3 === 1) ? "beam" : "bar") : null;
      if (obstacle) {
         const bz = fz(0.7);
         bars.push({ z: bz, kind: obstacle });
         if (obstacle === "bar") {
            const lane = Math.floor(lanes / 2);
            if (g % 2 === 0 || id <= 2) orbs.push({ x: laneX(lane, lanes), y: 3.0, z: bz - 0.4, kind: "bonus", hidden: false });
         }
      }
      // Zuno's hidden trails in the corridor walls
      if (g >= 1 && g % 3 === 1) {
         const side = g % 2 === 1 ? 1 : -1;
         for (let k = 0; k < 3; k++) orbs.push({ x: side * (half - 0.35), y: 1.35, z: fz(0.2 + k * 0.1), kind: "bonus", hidden: true });
      }
      // speed pads: one lane in some gaps (a risk: it may be the wrong side for the next door)
      if (id >= 2 && g >= 2 && g % 3 === 0) pads.push({ lane: (g + 1) % lanes, z: fz(0.12) });
   }
   // level 1's third beat ends on a speed pad in every lane after the last wall; the others get one too
   for (let lane = 0; lane < lanes; lane++) pads.push({ lane, z: lastZ - 14 });

   // Riko's side corridors (from each cracked door, skipping the next two walls)
   for (const w of walls) {
      if (w.cracked === NONE) continue;
      const side = w.cracked === 0 ? -1 : 1;
      const exitWall = walls[Math.min(walls.length - 1, w.index + 2)];
      const z1 = (w.index + 2 < walls.length ? exitWall.z : w.z - 60) - 6;
      const x = side * (half + 1.3);
      sides.push({ wall: w.index, side, x, z0: w.z, z1, lane: w.cracked });
      for (let k = 0; k < 3; k++) orbs.push({ x, y: orbY, z: w.z - 10 - k * ((w.z - z1 - 22) / 2), kind: "bonus", hidden: false });
      if (!secrets.side) secrets.side = { x, y: 0.8, z: z1 + 4, need: "side", wall: w.index };
   }
   // Nami's upper door rows: a bonus orb lane just past the tall wall, the sticker in the first one
   for (const w of walls) {
      if (w.upper === NONE) continue;
      const x = laneX(w.upper, lanes);
      for (let k = 0; k < 3; k++) orbs.push({ x, y: 2.6 - k * 0.55, z: w.z - 2 - k * 2, kind: "bonus", hidden: false });
      if (!secrets.upper) secrets.upper = { x, y: UPPER_SILL + 0.2, z: w.z - 1.2, need: "upper", wall: w.index };
   }
   // Vexa's ghost door: the colour shard right behind it
   for (const w of walls) {
      if (w.ghost === NONE) continue;
      if (!secrets.ghost) secrets.ghost = { x: laneX(w.ghost, lanes), y: 0.8, z: w.z - 3, need: "ghost", wall: w.index };
   }
   return { lanes, walls, lamps, orbs, bars, pads, vents, sides, secrets, startZ: 0, finishZ, bossStartZ };
}
