// Roll Cannon Jump's shows: the five big-top layouts (the design card, world-1 "43 Roll Cannon
// Jump"). Pure data plus a tiny builder; no Math.random: the same level is the same show for every
// seed (a time leaderboard). Each level teaches its twist in its first beats.
//
// Coordinates: 1 unit = 1 m, the show runs towards -z, up is +y. The ring floor is y = 0 and the
// safety net hangs just above it. A cannon's (x, y, z) is its mouth: where the hero sits, curled, and
// where a shot starts. A platform's or trampoline's y is its top. Yaw follows the orbit camera: yaw 0
// faces -z and the forward direction is (-sin yaw, -cos yaw), so a camera at the same yaw sits behind.
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { LEVELS, type CannonLevel } from "./levels";

export const DEG = Math.PI / 180;

export type CannonKind = "aim" | "fixed" | "wheel" | "auto";

/** A rail ride: the cannon slides along (ax, ay, az) by +-travel on a smooth back-and-forth. */
export interface Rail {
   ax: number;
   ay: number;
   az: number;
   travel: number;
   periodMs: number;
   phase: number;
}

export interface CannonDef {
   x: number;
   y: number;
   z: number;
   /**
    * aim: the stick turns the barrel (yaw +-60 deg round `yaw`, pitch 20-70 deg) and the power ring
    * pulses; fixed: aim and power locked (L1's first "just press fire"); wheel: the barrel sweeps
    * its yaw on its own and the power is fixed (fire on timing); auto: aim and power locked, it fires
    * on its own after 1.5 s (Jump fires it early).
    */
   kind: CannonKind;
   /** the base yaw (aim: the centre of the +-60 deg range and the barrel's start) */
   yaw: number;
   /** the start pitch (locked for fixed, wheel and auto) */
   pitch: number;
   /** the locked power for fixed, wheel and auto (0.6..1) */
   power: number;
   rail: Rail | null;
   /** wheel: the yaw sweep amplitude (rad), its period and phase */
   sweep: number;
   sweepMs: number;
   sweepPhase: number;
   /** the cracked target board hiding this cannon until Riko's dash smashes it, or -1 */
   board: number;
   /** level 5: a stage cannon (Ashbag's paint bombs jam these) */
   stage: boolean;
}

export interface PlatformDef {
   x: number;
   y: number;
   z: number;
   hw: number;
   hd: number;
   /** a round stand (radius hw) instead of a box */
   round: boolean;
}

export interface TrampDef {
   x: number;
   y: number;
   z: number;
   r: number;
}

export interface BalloonDef {
   x: number;
   y: number;
   z: number;
   r: number;
}

/** A ring the hero flies through: a fire hoop (bonus line) or the finish ring. Its plane faces `yaw`. */
export interface RingDef {
   x: number;
   y: number;
   z: number;
   r: number;
   yaw: number;
}

/** A cracked target board (an axis-aligned slab): Riko's dash smashes it, anyone else bounces off. */
export interface BoardDef {
   x: number;
   y: number;
   z: number;
   hx: number;
   hy: number;
   hz: number;
}

/** A tent pole: a solid upright cylinder. A ghost pole lets Vexa's phase through. */
export interface PoleDef {
   x: number;
   z: number;
   r: number;
   y0: number;
   y1: number;
   ghost: boolean;
}

/** A grey smoke jet: an upright column that knocks a flier off its arc while it blows (Kiro's shield passes). */
export interface JetDef {
   x: number;
   z: number;
   r: number;
   y0: number;
   y1: number;
   periodMs: number;
   /** the share of the period it blows (1 = always) */
   duty: number;
   phase: number;
}

/** A solid box: a tent wall to lob over, or a trapeze bar to fly under. */
export interface WallDef {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
   kind: "wall" | "trapeze";
}

export interface OrbDef {
   x: number;
   y: number;
   z: number;
   /** "main" orbs count for the all-orbs star; "bonus" orbs sit on a hero-gated line */
   kind: "main" | "bonus";
   /** the hero whose line it is (bonus orbs) */
   hero: HeroId | null;
   /** only Zuno's magnet pulls it out of the tent canvas */
   hidden: boolean;
   /** level 5: rained by Ashbag's smoke pod k when it pops (-1 = always there) */
   pod: number;
}

export interface SpotDef {
   x: number;
   y: number;
   z: number;
}

/** Level 5's ring: the stage under the circling blimp. */
export interface ArenaDef {
   /** the stage centre (top y) and radius; the stage is platform `platform` */
   x: number;
   y: number;
   z: number;
   r: number;
   platform: number;
   /** the stage cannons (paint bombs jam them, in turn) */
   cannons: number[];
   /** the stage trampolines (P2 bounces) */
   tramps: number[];
   /** P1 hover spots, cycled: the blimp's centre while a pod window is open */
   podSpots: SpotDef[];
   /** P3: the blimp's centre at the tent top while the valve is open */
   topSpot: SpotDef;
   /** the P3 auto-cannon chain, bottom to top */
   chain: number[];
   /** the circling radius and height between windows (visual) */
   circleR: number;
   circleY: number;
}

/** One stop of the honest bot's route (bot.ts): reach `to`, taking `orbs` on the way. */
export interface Leg {
   to: "cannon" | "platform" | "balloon" | "finish" | "boss";
   i: number;
}

export interface Course {
   level: LevelId;
   durationMs: number;
   /** a hero whose centre drops under this is in the safety net: lost, back in the last cannon */
   killY: number;
   cannons: CannonDef[];
   platforms: PlatformDef[];
   tramps: TrampDef[];
   balloons: BalloonDef[];
   hoops: RingDef[];
   boards: BoardDef[];
   poles: PoleDef[];
   jets: JetDef[];
   walls: WallDef[];
   orbs: OrbDef[];
   /** orbs that count for the all-orbs star (rained orbs included) */
   mainOrbs: number;
   secrets: SpotDef[];
   finish: RingDef | null;
   arena: ArenaDef | null;
   /** the stands where the crowd silhouettes sit, as z bands (they turn red as you pass) */
   crowd: { z0: number; z1: number; side: 1 | -1 }[];
   /** the honest bot's route */
   route: Leg[];
}

/** The barrel's forward for a yaw (orbit-camera convention). */
export function forwardX(yaw: number): number {
   return -Math.sin(yaw);
}

export function forwardZ(yaw: number): number {
   return -Math.cos(yaw);
}

/** The yaw that faces from (x0, z0) towards (x1, z1). */
export function yawTowards(x0: number, z0: number, x1: number, z1: number): number {
   return Math.atan2(-(x1 - x0), -(z1 - z0));
}

// ---------- the builder ----------

const r2 = (n: number) => Math.round(n * 1000) / 1000;

export interface CannonOpts {
   kind?: CannonKind;
   /** aim the barrel at a point (sets yaw), or give the yaw */
   at?: [number, number];
   yaw?: number;
   pitch?: number;
   power?: number;
   rail?: Rail;
   sweep?: number;
   sweepMs?: number;
   sweepPhase?: number;
   board?: number;
   stage?: boolean;
}

export class ShowBuilder {
   readonly d: Course;

   constructor(level: CannonLevel) {
      this.d = {
         level: level.id,
         durationMs: level.durationMs,
         killY: 1.4,
         cannons: [],
         platforms: [],
         tramps: [],
         balloons: [],
         hoops: [],
         boards: [],
         poles: [],
         jets: [],
         walls: [],
         orbs: [],
         mainOrbs: 0,
         secrets: [],
         finish: null,
         arena: null,
         crowd: [],
         route: [],
      };
   }

   cannon(x: number, y: number, z: number, o: CannonOpts = {}): number {
      const yaw = o.at ? yawTowards(x, z, o.at[0], o.at[1]) : (o.yaw ?? 0);
      this.d.cannons.push({
         x: r2(x),
         y: r2(y),
         z: r2(z),
         kind: o.kind ?? "aim",
         yaw: r2(yaw),
         pitch: r2(o.pitch ?? 45 * DEG),
         power: o.power ?? 0.8,
         rail: o.rail ?? null,
         sweep: o.sweep ?? 0,
         sweepMs: o.sweepMs ?? 0,
         sweepPhase: o.sweepPhase ?? 0,
         board: o.board ?? -1,
         stage: o.stage ?? false,
      });
      return this.d.cannons.length - 1;
   }

   platform(x: number, y: number, z: number, hw: number, hd: number, round = false): number {
      this.d.platforms.push({ x: r2(x), y: r2(y), z: r2(z), hw: r2(hw), hd: r2(round ? hw : hd), round });
      return this.d.platforms.length - 1;
   }

   tramp(x: number, y: number, z: number, r = 1.3): number {
      this.d.tramps.push({ x: r2(x), y: r2(y), z: r2(z), r: r2(r) });
      return this.d.tramps.length - 1;
   }

   balloon(x: number, y: number, z: number, r = 1.1): number {
      this.d.balloons.push({ x: r2(x), y: r2(y), z: r2(z), r: r2(r) });
      return this.d.balloons.length - 1;
   }

   /** A fire hoop with a bonus orb in its middle (fly through: an orb and a flow link). */
   hoop(x: number, y: number, z: number, yaw = 0, r = 1.5): number {
      this.d.hoops.push({ x: r2(x), y: r2(y), z: r2(z), r: r2(r), yaw: r2(yaw) });
      this.orb(x, y, z, { bonus: true });
      return this.d.hoops.length - 1;
   }

   board(x: number, y: number, z: number, hx: number, hy: number, hz: number): number {
      this.d.boards.push({ x: r2(x), y: r2(y), z: r2(z), hx: r2(hx), hy: r2(hy), hz: r2(hz) });
      return this.d.boards.length - 1;
   }

   pole(x: number, z: number, y0: number, y1: number, ghost: boolean, r = 0.35): number {
      this.d.poles.push({ x: r2(x), z: r2(z), r: r2(r), y0: r2(y0), y1: r2(y1), ghost });
      return this.d.poles.length - 1;
   }

   jet(x: number, z: number, y0: number, y1: number, periodMs: number, duty: number, phase = 0, r = 0.8): number {
      this.d.jets.push({ x: r2(x), z: r2(z), r: r2(r), y0: r2(y0), y1: r2(y1), periodMs, duty, phase });
      return this.d.jets.length - 1;
   }

   wall(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number, kind: "wall" | "trapeze" = "wall"): number {
      this.d.walls.push({ minX: r2(minX), maxX: r2(maxX), minY: r2(minY), maxY: r2(maxY), minZ: r2(minZ), maxZ: r2(maxZ), kind });
      return this.d.walls.length - 1;
   }

   orb(x: number, y: number, z: number, o: { hero?: HeroId; hidden?: boolean; pod?: number; bonus?: boolean } = {}): number {
      const kind = o.hero || o.bonus ? "bonus" : "main";
      this.d.orbs.push({ x: r2(x), y: r2(y), z: r2(z), kind, hero: o.hero ?? null, hidden: o.hidden ?? false, pod: o.pod ?? -1 });
      if (kind === "main") this.d.mainOrbs += 1;
      return this.d.orbs.length - 1;
   }

   /** Orbs along the straight line a -> b (n of them, ends excluded). */
   orbLine(a: [number, number, number], b: [number, number, number], n: number, o: { hero?: HeroId; hidden?: boolean } = {}): void {
      for (let k = 1; k <= n; k++) {
         const t = k / (n + 1);
         this.orb(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, o);
      }
   }

   secret(x: number, y: number, z: number): void {
      this.d.secrets.push({ x: r2(x), y: r2(y), z: r2(z) });
   }

   finish(x: number, y: number, z: number, yaw = 0, r = 1.8): void {
      this.d.finish = { x: r2(x), y: r2(y), z: r2(z), r: r2(r), yaw: r2(yaw) };
   }

   crowd(z0: number, z1: number, side: 1 | -1): void {
      this.d.crowd.push({ z0, z1, side });
   }

   leg(to: Leg["to"], i = -1): void {
      this.d.route.push({ to, i });
   }
}

export type ShowFn = (b: ShowBuilder) => void;

/** Builds a show from its layout function (layouts.ts holds the five). */
export function buildShow(level: CannonLevel, fn: ShowFn): Course {
   const b = new ShowBuilder(level);
   fn(b);
   return b.d;
}

export { LEVELS };
