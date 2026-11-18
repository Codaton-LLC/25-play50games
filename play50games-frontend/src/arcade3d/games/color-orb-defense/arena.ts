// Color Orb Defense's arena and wave schedule: pure data from a fixed seed per level. A round arena with
// the core (the dome beacon) in the middle; portals on the rim send energy orbs straight down their lane
// to the core. Each lane has colour zones (the zone plates) at fixed radii, each a different colour of
// the level; standing on the zone of the orb's colour as it passes blocks it. Pillars stand between the
// lanes; one carries the hidden beacon. The schedule lists every orb of every wave (lane, colour, time,
// blink, pair); level 5 then hands over to the Orb Mortar.
import type { LevelId } from "@/arcade3d/types";
import { createRng } from "@/arcade3d/core/math";
import { LEVELS } from "./levels";

export const R_ARENA = 12;
export const R_PORTAL = 13.5;
export const R_CORE = 2.2;
export const ZONE_R = 1.3;
/** the zone radii along every lane, outermost first */
export const ZONE_RADII = [9.2, 6.5, 3.8] as const;
/** the drone sweeps the middle ring */
export const R_DRONE = 6.5;
export const ORB_Y = 1.0;
/** a portal lights up in the orb's colour this long before it launches it (ms): read it, run there */
export const TELEGRAPH_MS = 2000;
/** a pause after the last orb of a wave could have reached the core (ms) */
export const WAVE_GAP_MS = 1500;

export const PALETTE = [
   { id: "red", name: "Red", hex: "#EF4444", shape: "circle" },
   { id: "blue", name: "Blue", hex: "#3B82F6", shape: "triangle" },
   { id: "green", name: "Green", hex: "#22C55E", shape: "square" },
   { id: "yellow", name: "Yellow", hex: "#FACC15", shape: "diamond" },
   { id: "purple", name: "Purple", hex: "#A855F7", shape: "hexagon" },
] as const;

export interface Zone {
   lane: number;
   /** 0 the outermost */
   ring: number;
   x: number;
   z: number;
   /** the plate's radius */
   r: number;
   /** its distance from the core (the radius orbs cross it at) */
   d: number;
   color: number;
}

export interface Lane {
   angle: number;
   /** unit vector from the core out to the portal */
   dx: number;
   dz: number;
   zones: number[];
}

export interface Spawn {
   t: number;
   wave: number;
   lane: number;
   color: number;
   /** blink orbs: the other colour and the half period (ms; 0 = steady) */
   alt: number;
   periodMs: number;
}

export interface Arena {
   level: LevelId;
   colors: number;
   lanes: Lane[];
   zones: Zone[];
   spawns: Spawn[];
   waves: number;
   /** orbs per wave */
   waveSize: number[];
   /** the last spawn (ms) and when the waves are over (the boss starts on level 5) */
   lastSpawnMs: number;
   wavesEndMs: number;
   pillars: { x: number; z: number }[];
   /** the hidden beacon over one pillar (Nyla's double jump) */
   beacon: { x: number; y: number; z: number };
   boss: boolean;
}

/** Level 5's regular waves: the Orb Mortar's three phases are the last three of its twelve. */
export const BOSS_WAVES = 3;

function build(level: LevelId): Arena {
   const L = LEVELS[level];
   const rng = createRng(1000 + level * 77);
   const lanes: Lane[] = [];
   const zones: Zone[] = [];
   const ringCount = 3;
   for (let j = 0; j < L.lanes; j++) {
      const angle = Math.PI / 2 + (j * 2 * Math.PI) / L.lanes + (L.lanes % 2 ? 0 : Math.PI / L.lanes);
      const dx = Math.cos(angle);
      const dz = -Math.sin(angle);
      const lane: Lane = { angle, dx, dz, zones: [] };
      for (let k = 0; k < ringCount; k++) {
         const r = ZONE_RADII[k];
         lane.zones.push(zones.length);
         zones.push({ lane: j, ring: k, x: dx * r, z: dz * r, r: ZONE_R, d: r, color: (j + k) % L.colors });
      }
      lanes.push(lane);
   }
   const waves = L.boss ? L.waves - BOSS_WAVES : L.waves;
   const base = [0, 3, 3, 4, 4, 4][level];
   const travelMs = ((R_PORTAL - R_CORE) / L.orbSpeed) * 1000;
   const spawns: Spawn[] = [];
   const waveSize: number[] = [];
   let t = 4000;
   let lastSpawn = 0;
   for (let w = 0; w < waves; w++) {
      const n = base + w;
      let count = 0;
      for (let k = 0; k < n; k++) {
         const lane = Math.floor(rng() * L.lanes);
         const lz = lanes[lane].zones;
         const color = zones[lz[Math.floor(rng() * lz.length)]].color;
         const s: Spawn = { t, wave: w, lane, color, alt: color, periodMs: 0 };
         if (L.blink && k % 4 === 3) {
            const other = lz.map((zi) => zones[zi].color).filter((c) => c !== color);
            s.alt = other[Math.floor(rng() * other.length)] ?? color;
            s.periodMs = 900;
         }
         spawns.push(s);
         count++;
         if (L.pairs && k % 6 === 5) {
            const lane2 = (lane + 1 + Math.floor(rng() * (L.lanes - 1))) % L.lanes;
            const lz2 = lanes[lane2].zones;
            spawns.push({ t, wave: w, lane: lane2, color: zones[lz2[Math.floor(rng() * lz2.length)]].color, alt: 0, periodMs: 0 });
            spawns[spawns.length - 1].alt = spawns[spawns.length - 1].color;
            count++;
         }
         lastSpawn = t;
         t += L.intervalMs;
      }
      waveSize.push(count);
      t = lastSpawn + travelMs + WAVE_GAP_MS;
   }
   const pillars: { x: number; z: number }[] = [];
   for (let j = 0; j < L.lanes; j++) {
      const a = lanes[j].angle + Math.PI / L.lanes;
      pillars.push({ x: Math.cos(a) * 11.3, z: -Math.sin(a) * 11.3 });
   }
   const bp = pillars[0];
   return {
      level, colors: L.colors, lanes, zones, spawns, waves, waveSize, lastSpawnMs: lastSpawn, wavesEndMs: t,
      pillars, beacon: { x: bp.x * 0.93, y: 3.3, z: bp.z * 0.93 }, boss: L.boss,
   };
}

const ARENAS: Partial<Record<LevelId, Arena>> = {};

export function buildArena(level: LevelId): Arena {
   return (ARENAS[level] ??= build(level));
}

/** The colour an orb shows at rules time `ms` (blink orbs alternate from their spawn). */
export function orbColor(color: number, alt: number, periodMs: number, ageMs: number): number {
   if (!periodMs) return color;
   return Math.floor(ageMs / periodMs) % 2 === 0 ? color : alt;
}
