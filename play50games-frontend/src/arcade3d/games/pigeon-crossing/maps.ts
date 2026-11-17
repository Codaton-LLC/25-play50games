// Hand-authored district maps for Pigeon Crossing's five levels (pure data, no React).
// Level 1 (MAP_1: Quiet Street) keeps today's clean street and palette unchanged.
// Levels 2-5 give each street its own district architecture, roadside props, set pieces,
// surface palette, and traffic/median twist while keeping every prop outside the playable
// width (|x| - halfX >= COVER_INNER_X = 6.0 > PLAY_HALF_WIDTH = 5.6) and on or above the
// 1.8 m side-cover terrace (y >= 1.8), so vehicle births/deaths stay 100% occluded.
import type { LevelId } from "@/arcade3d/types";

export type DistrictTheme = "quiet-street" | "main-road" | "city-crossing" | "night-traffic" | "rush-hour";

export type ParkedPattern = "none" | "alternating-curb" | "dual-curb" | "night-chicane" | "rush-pinch";

export type PropKind =
   | "townhouse"
   | "shop"
   | "busStop"
   | "tree"
   | "pine"
   | "cone"
   | "bench"
   | "bin"
   | "trafficLight"
   | "brickApartment"
   | "glassOffice"
   | "tallTower"
   | "officeBlock"
   | "lamp"
   | "barrier";

export type SetPieceKind =
   | "bus-layby"
   | "crosswalk-beacon"
   | "signal-cantilever"
   | "pocket-plaza"
   | "neon-pylon"
   | "sound-wall"
   | "rush-gantry"
   | "work-barricade";

export interface DistrictPalette {
   background: string;
   road: string;
   grass: string;
   curb: string;
   markings: string;
   grassMarks: string;
   cover: string;
   coverTrim: string;
   terrace: string;
   accent: string;
}

export interface DistrictProp {
   kind: PropKind;
   /** World x centre (m); must satisfy |x| - halfX >= 6.0. */
   x: number;
   /** Elevation (m); sits on the 1.8 m side cover terrace. */
   y: number;
   /** Local row index (0..19) within the 20-row street block. */
   row: number;
   /** Local z coordinate (-row * 1.8) within the 20-row street block. */
   z: number;
   /** Half-width along x (m) for play-area clearance checks. */
   halfX: number;
   /** Half-depth along z (m). */
   halfZ: number;
   /** Drawn height (m). */
   height: number;
   /** Rotation around +y (rad). */
   yaw: number;
}

export interface DistrictSetPiece {
   kind: SetPieceKind;
   x: number;
   y: number;
   row: number;
   z: number;
   halfX: number;
   halfZ: number;
   height: number;
   yaw: number;
}

export interface DistrictMap {
   id: LevelId;
   name: string;
   theme: DistrictTheme;
   hint: string;
   palette: DistrictPalette;
   props: readonly DistrictProp[];
   setPieces: readonly DistrictSetPiece[];
}

const ROW_PITCH = 1.8;
const TERRACE_Y = 1.8;

function prop(
   kind: PropKind,
   x: number,
   row: number,
   halfX: number,
   halfZ: number,
   height: number,
   yaw = x < 0 ? Math.PI / 2 : -Math.PI / 2,
   y = TERRACE_Y,
): DistrictProp {
   return { kind, x, y, row, z: -row * ROW_PITCH, halfX, halfZ, height, yaw };
}

function setPiece(
   kind: SetPieceKind,
   x: number,
   row: number,
   halfX: number,
   halfZ: number,
   height: number,
   yaw = x < 0 ? Math.PI / 2 : -Math.PI / 2,
   y = TERRACE_Y,
): DistrictSetPiece {
   return { kind, x, y, row, z: -row * ROW_PITCH, halfX, halfZ, height, yaw };
}

// ---------- Level 1: Quiet Street (today's live game, unchanged) ----------

export const MAP_1: DistrictMap = {
   id: 1,
   name: "Quiet Street",
   theme: "quiet-street",
   hint: "Get ready to hop. Grass is safe.",
   palette: {
      background: "#bfd6d5",
      road: "#526579",
      grass: "#85ae78",
      curb: "#cbd5c4",
      markings: "#f5e7b7",
      grassMarks: "#a5c38a",
      cover: "#a5bdb3",
      coverTrim: "#a5bdb3",
      terrace: "#a5bdb3",
      accent: "#a78bfa",
   },
   props: [],
   setPieces: [],
};

// ---------- Level 2: Main Road (suburban commercial avenue with bus lay-bys & shops) ----------

export const MAP_2: DistrictMap = {
   id: 2,
   name: "Main Road",
   theme: "main-road",
   hint: "Parked vans alternate curbs on Main Road. Wait in the middle.",
   palette: {
      background: "#c8e3d4",
      road: "#46586c",
      grass: "#6ea862",
      curb: "#dce3d5",
      markings: "#fff1b8",
      grassMarks: "#94c97e",
      cover: "#8fa998",
      coverTrim: "#5c8758",
      terrace: "#b5c9b8",
      accent: "#f97316",
   },
   props: [
      // Left boulevard terrace: townhouses, corner shop, bus stop, leafy trees, benches, cones
      prop("tree", -7.2, 0.5, 0.9, 0.9, 3.2, 0.2),
      prop("townhouse", -9.2, 2.0, 1.8, 1.8, 4.4, Math.PI / 2),
      prop("busStop", -7.4, 3.0, 1.0, 1.4, 2.6, Math.PI / 2),
      prop("bench", -7.2, 4.5, 0.6, 1.0, 0.9, Math.PI / 2),
      prop("tree", -7.3, 6.0, 0.9, 0.9, 3.4, 1.1),
      prop("shop", -9.0, 8.0, 1.9, 1.9, 3.6, Math.PI / 2),
      prop("cone", -6.5, 9.0, 0.35, 0.35, 0.75, 0),
      prop("townhouse", -9.2, 11.2, 1.8, 1.8, 4.5, Math.PI / 2),
      prop("busStop", -7.4, 12.5, 1.0, 1.4, 2.6, Math.PI / 2),
      prop("tree", -7.2, 15.0, 0.9, 0.9, 3.3, 2.0),
      prop("shop", -9.0, 17.5, 1.9, 1.9, 3.6, Math.PI / 2),
      prop("tree", -7.2, 19.2, 0.9, 0.9, 3.1, 0.6),
      // Right boulevard terrace: shops, townhouses, trees, benches, cones
      prop("shop", 9.0, 1.2, 1.9, 1.9, 3.6, -Math.PI / 2),
      prop("tree", 7.2, 3.0, 0.9, 0.9, 3.3, 0.8),
      prop("townhouse", 9.2, 5.2, 1.8, 1.8, 4.4, -Math.PI / 2),
      prop("cone", 6.5, 6.0, 0.35, 0.35, 0.75, 0),
      prop("busStop", 7.4, 8.8, 1.0, 1.4, 2.6, -Math.PI / 2),
      prop("bench", 7.2, 10.2, 0.6, 1.0, 0.9, -Math.PI / 2),
      prop("tree", 7.3, 12.0, 0.9, 0.9, 3.5, 1.7),
      prop("townhouse", 9.2, 14.2, 1.8, 1.8, 4.6, -Math.PI / 2),
      prop("cone", 6.5, 15.0, 0.35, 0.35, 0.75, 0),
      prop("shop", 9.0, 17.0, 1.9, 1.9, 3.6, -Math.PI / 2),
      prop("tree", 7.2, 19.0, 0.9, 0.9, 3.2, 2.5),
   ],
   setPieces: [
      setPiece("bus-layby", -7.6, 3.0, 1.3, 2.2, 2.8, Math.PI / 2),
      setPiece("crosswalk-beacon", -6.45, 6.0, 0.35, 0.35, 2.9, Math.PI / 2),
      setPiece("crosswalk-beacon", 6.45, 6.0, 0.35, 0.35, 2.9, -Math.PI / 2),
      setPiece("bus-layby", 7.6, 9.0, 1.3, 2.2, 2.8, -Math.PI / 2),
      setPiece("bus-layby", -7.6, 12.0, 1.3, 2.2, 2.8, Math.PI / 2),
      setPiece("crosswalk-beacon", -6.45, 15.0, 0.35, 0.35, 2.9, Math.PI / 2),
      setPiece("crosswalk-beacon", 6.45, 15.0, 0.35, 0.35, 2.9, -Math.PI / 2),
   ],
};

// ---------- Level 3: City Crossing (golden-hour midtown with signal cantilevers & taxi surge) ----------

export const MAP_3: DistrictMap = {
   id: 3,
   name: "City Crossing",
   theme: "city-crossing",
   hint: "Downtown taxis surge and vans block both curbs. Aim for the centre.",
   palette: {
      background: "#e9bd99",
      road: "#434957",
      grass: "#75947a",
      curb: "#d8cfc2",
      markings: "#fde68a",
      grassMarks: "#b7c9b0",
      cover: "#9b8270",
      coverTrim: "#d97706",
      terrace: "#bda693",
      accent: "#eab308",
   },
   props: [
      // Left midtown terrace: brick apartments, glass offices, traffic lights, bins, benches
      prop("trafficLight", -6.5, 0.4, 0.4, 0.4, 3.0, Math.PI / 2),
      prop("brickApartment", -9.6, 1.8, 2.1, 2.1, 7.2, Math.PI / 2),
      prop("bin", -6.8, 3.2, 0.4, 0.4, 0.95, 0),
      prop("glassOffice", -9.8, 5.2, 2.1, 2.1, 9.4, Math.PI / 2),
      prop("bench", -7.2, 6.2, 0.6, 1.0, 0.9, Math.PI / 2),
      prop("tree", -7.3, 7.5, 0.9, 0.9, 3.2, 0.4),
      prop("trafficLight", -6.5, 9.0, 0.4, 0.4, 3.0, Math.PI / 2),
      prop("brickApartment", -9.6, 10.8, 2.1, 2.1, 7.6, Math.PI / 2),
      prop("bench", -7.2, 12.2, 0.6, 1.0, 0.9, Math.PI / 2),
      prop("glassOffice", -9.8, 14.5, 2.1, 2.1, 9.8, Math.PI / 2),
      prop("trafficLight", -6.5, 15.2, 0.4, 0.4, 3.0, Math.PI / 2),
      prop("shop", -9.0, 17.8, 1.9, 1.9, 3.8, Math.PI / 2),
      prop("bin", -6.8, 18.4, 0.4, 0.4, 0.95, 0),
      // Right midtown terrace: glass offices, brick apartments, traffic lights, trees
      prop("glassOffice", 9.8, 1.5, 2.1, 2.1, 9.2, -Math.PI / 2),
      prop("trafficLight", 6.5, 3.0, 0.4, 0.4, 3.0, -Math.PI / 2),
      prop("brickApartment", 9.6, 4.8, 2.1, 2.1, 7.4, -Math.PI / 2),
      prop("bench", 7.2, 6.2, 0.6, 1.0, 0.9, -Math.PI / 2),
      prop("tree", 7.3, 8.2, 0.9, 0.9, 3.2, 1.9),
      prop("glassOffice", 9.8, 10.5, 2.1, 2.1, 9.6, -Math.PI / 2),
      prop("trafficLight", 6.5, 12.0, 0.4, 0.4, 3.0, -Math.PI / 2),
      prop("bin", 6.8, 12.8, 0.4, 0.4, 0.95, 0),
      prop("brickApartment", 9.6, 15.0, 2.1, 2.1, 7.5, -Math.PI / 2),
      prop("trafficLight", 6.5, 18.0, 0.4, 0.4, 3.0, -Math.PI / 2),
      prop("glassOffice", 9.8, 18.6, 2.1, 2.1, 9.0, -Math.PI / 2),
   ],
   setPieces: [
      setPiece("signal-cantilever", -6.6, 3.0, 0.5, 0.5, 4.2, Math.PI / 2),
      setPiece("signal-cantilever", 6.6, 3.0, 0.5, 0.5, 4.2, -Math.PI / 2),
      setPiece("pocket-plaza", -7.8, 6.0, 1.4, 2.0, 2.4, Math.PI / 2),
      setPiece("pocket-plaza", 7.8, 6.0, 1.4, 2.0, 2.4, -Math.PI / 2),
      setPiece("signal-cantilever", -6.6, 9.0, 0.5, 0.5, 4.2, Math.PI / 2),
      setPiece("signal-cantilever", 6.6, 9.0, 0.5, 0.5, 4.2, -Math.PI / 2),
      setPiece("pocket-plaza", -7.8, 12.0, 1.4, 2.0, 2.4, Math.PI / 2),
      setPiece("pocket-plaza", 7.8, 12.0, 1.4, 2.0, 2.4, -Math.PI / 2),
      setPiece("signal-cantilever", -6.6, 15.0, 0.5, 0.5, 4.2, Math.PI / 2),
      setPiece("signal-cantilever", 6.6, 15.0, 0.5, 0.5, 4.2, -Math.PI / 2),
   ],
};

// ---------- Level 4: Night Traffic (nocturnal expressway with neon pylons & acoustic walls) ----------

export const MAP_4: DistrictMap = {
   id: 4,
   name: "Night Traffic",
   theme: "night-traffic",
   hint: "Three-road night spans and staggered median vans. Follow the centre glow.",
   palette: {
      background: "#17243b",
      road: "#253042",
      grass: "#2f5249",
      curb: "#64748b",
      markings: "#facc15",
      grassMarks: "#38bdf8",
      cover: "#1e293b",
      coverTrim: "#38bdf8",
      terrace: "#283548",
      accent: "#38bdf8",
   },
   props: [
      // Left nocturnal expressway wall: street lamps every 4 rows, tall skyscrapers, barriers
      prop("lamp", -6.5, 0.5, 0.35, 0.35, 3.2, Math.PI / 2),
      prop("tallTower", -10.2, 2.2, 2.3, 2.3, 10.8, Math.PI / 2),
      prop("barrier", -6.7, 4.0, 0.5, 0.9, 1.0, Math.PI / 2),
      prop("lamp", -6.5, 4.5, 0.35, 0.35, 3.2, Math.PI / 2),
      prop("officeBlock", -10.4, 6.8, 2.5, 2.5, 7.8, Math.PI / 2),
      prop("lamp", -6.5, 8.5, 0.35, 0.35, 3.2, Math.PI / 2),
      prop("barrier", -6.7, 10.0, 0.5, 0.9, 1.0, Math.PI / 2),
      prop("tallTower", -10.2, 11.5, 2.3, 2.3, 11.2, Math.PI / 2),
      prop("lamp", -6.5, 12.5, 0.35, 0.35, 3.2, Math.PI / 2),
      prop("officeBlock", -10.4, 15.2, 2.5, 2.5, 8.0, Math.PI / 2),
      prop("lamp", -6.5, 16.5, 0.35, 0.35, 3.2, Math.PI / 2),
      prop("tallTower", -10.2, 18.8, 2.3, 2.3, 10.5, Math.PI / 2),
      // Right nocturnal expressway wall: street lamps, towers, barriers, pine silhouettes
      prop("officeBlock", 10.4, 1.5, 2.5, 2.5, 7.6, -Math.PI / 2),
      prop("lamp", 6.5, 2.5, 0.35, 0.35, 3.2, -Math.PI / 2),
      prop("tallTower", 10.2, 5.0, 2.3, 2.3, 11.0, -Math.PI / 2),
      prop("lamp", 6.5, 6.5, 0.35, 0.35, 3.2, -Math.PI / 2),
      prop("barrier", 6.7, 8.0, 0.5, 0.9, 1.0, -Math.PI / 2),
      prop("officeBlock", 10.4, 9.8, 2.5, 2.5, 8.2, -Math.PI / 2),
      prop("lamp", 6.5, 10.5, 0.35, 0.35, 3.2, -Math.PI / 2),
      prop("tallTower", 10.2, 13.8, 2.3, 2.3, 11.4, -Math.PI / 2),
      prop("lamp", 6.5, 14.5, 0.35, 0.35, 3.2, -Math.PI / 2),
      prop("barrier", 6.7, 16.0, 0.5, 0.9, 1.0, -Math.PI / 2),
      prop("officeBlock", 10.4, 17.8, 2.5, 2.5, 7.8, -Math.PI / 2),
      prop("lamp", 6.5, 18.5, 0.35, 0.35, 3.2, -Math.PI / 2),
   ],
   setPieces: [
      setPiece("sound-wall", -8.0, 2.0, 0.6, 2.2, 3.2, Math.PI / 2),
      setPiece("sound-wall", 8.0, 2.0, 0.6, 2.2, 3.2, -Math.PI / 2),
      setPiece("neon-pylon", -6.6, 4.0, 0.5, 0.5, 4.6, Math.PI / 2),
      setPiece("neon-pylon", 6.6, 4.0, 0.5, 0.5, 4.6, -Math.PI / 2),
      setPiece("neon-pylon", -6.6, 8.0, 0.5, 0.5, 4.6, Math.PI / 2),
      setPiece("neon-pylon", 6.6, 8.0, 0.5, 0.5, 4.6, -Math.PI / 2),
      setPiece("sound-wall", -8.0, 10.0, 0.6, 2.2, 3.2, Math.PI / 2),
      setPiece("sound-wall", 8.0, 10.0, 0.6, 2.2, 3.2, -Math.PI / 2),
      setPiece("neon-pylon", -6.6, 12.0, 0.5, 0.5, 4.6, Math.PI / 2),
      setPiece("neon-pylon", 6.6, 12.0, 0.5, 0.5, 4.6, -Math.PI / 2),
      setPiece("neon-pylon", -6.6, 16.0, 0.5, 0.5, 4.6, Math.PI / 2),
      setPiece("neon-pylon", 6.6, 16.0, 0.5, 0.5, 4.6, -Math.PI / 2),
   ],
};

// ---------- Level 5: Rush Hour (crimson-dusk metropolitan artery with gantries & barricades) ----------

export const MAP_5: DistrictMap = {
   id: 5,
   name: "Rush Hour",
   theme: "rush-hour",
   hint: "Four-road Rush Hour spans and pinched medians. Commit through the centre.",
   palette: {
      background: "#c18070",
      road: "#3b3342",
      grass: "#5e7a52",
      curb: "#e2c6b6",
      markings: "#fbbf24",
      grassMarks: "#fb923c",
      cover: "#7c5856",
      coverTrim: "#f97316",
      terrace: "#946d69",
      accent: "#ef4444",
   },
   props: [
      // Left metropolitan arterial canyon
      prop("trafficLight", -6.5, 0.5, 0.4, 0.4, 3.1, Math.PI / 2),
      prop("tallTower", -10.2, 1.5, 2.3, 2.3, 11.6, Math.PI / 2),
      prop("barrier", -6.7, 2.5, 0.5, 0.9, 1.0, Math.PI / 2),
      prop("cone", -6.5, 3.5, 0.35, 0.35, 0.8, 0),
      prop("glassOffice", -9.8, 4.5, 2.1, 2.1, 10.0, Math.PI / 2),
      prop("lamp", -6.5, 5.5, 0.35, 0.35, 3.2, Math.PI / 2),
      prop("brickApartment", -9.6, 7.2, 2.1, 2.1, 8.0, Math.PI / 2),
      prop("barrier", -6.7, 8.2, 0.5, 0.9, 1.0, Math.PI / 2),
      prop("officeBlock", -10.4, 9.8, 2.5, 2.5, 8.6, Math.PI / 2),
      prop("trafficLight", -6.5, 10.5, 0.4, 0.4, 3.1, Math.PI / 2),
      prop("tallTower", -10.2, 12.5, 2.3, 2.3, 12.0, Math.PI / 2),
      prop("cone", -6.5, 13.5, 0.35, 0.35, 0.8, 0),
      prop("glassOffice", -9.8, 15.2, 2.1, 2.1, 10.2, Math.PI / 2),
      prop("lamp", -6.5, 15.8, 0.35, 0.35, 3.2, Math.PI / 2),
      prop("barrier", -6.7, 17.2, 0.5, 0.9, 1.0, Math.PI / 2),
      prop("brickApartment", -9.6, 18.5, 2.1, 2.1, 8.2, Math.PI / 2),
      // Right metropolitan arterial canyon
      prop("glassOffice", 9.8, 1.2, 2.1, 2.1, 10.0, -Math.PI / 2),
      prop("barrier", 6.7, 2.2, 0.5, 0.9, 1.0, -Math.PI / 2),
      prop("tallTower", 10.2, 3.8, 2.3, 2.3, 11.8, -Math.PI / 2),
      prop("trafficLight", 6.5, 5.0, 0.4, 0.4, 3.1, -Math.PI / 2),
      prop("officeBlock", 10.4, 6.8, 2.5, 2.5, 8.4, -Math.PI / 2),
      prop("cone", 6.5, 7.8, 0.35, 0.35, 0.8, 0),
      prop("glassOffice", 9.8, 9.5, 2.1, 2.1, 10.4, -Math.PI / 2),
      prop("lamp", 6.5, 10.2, 0.35, 0.35, 3.2, -Math.PI / 2),
      prop("brickApartment", 9.6, 12.0, 2.1, 2.1, 8.2, -Math.PI / 2),
      prop("barrier", 6.7, 13.0, 0.5, 0.9, 1.0, -Math.PI / 2),
      prop("tallTower", 10.2, 14.8, 2.3, 2.3, 12.2, -Math.PI / 2),
      prop("trafficLight", 6.5, 15.2, 0.4, 0.4, 3.1, -Math.PI / 2),
      prop("cone", 6.5, 16.8, 0.35, 0.35, 0.8, 0),
      prop("officeBlock", 10.4, 18.2, 2.5, 2.5, 8.6, -Math.PI / 2),
   ],
   setPieces: [
      setPiece("work-barricade", -6.8, 2.0, 0.6, 1.5, 1.8, Math.PI / 2),
      setPiece("work-barricade", 6.8, 2.0, 0.6, 1.5, 1.8, -Math.PI / 2),
      setPiece("rush-gantry", -6.7, 5.0, 0.6, 0.6, 5.0, Math.PI / 2),
      setPiece("rush-gantry", 6.7, 5.0, 0.6, 0.6, 5.0, -Math.PI / 2),
      setPiece("work-barricade", -6.8, 7.5, 0.6, 1.5, 1.8, Math.PI / 2),
      setPiece("work-barricade", 6.8, 7.5, 0.6, 1.5, 1.8, -Math.PI / 2),
      setPiece("rush-gantry", -6.7, 10.0, 0.6, 0.6, 5.0, Math.PI / 2),
      setPiece("rush-gantry", 6.7, 10.0, 0.6, 0.6, 5.0, -Math.PI / 2),
      setPiece("work-barricade", -6.8, 12.5, 0.6, 1.5, 1.8, Math.PI / 2),
      setPiece("work-barricade", 6.8, 12.5, 0.6, 1.5, 1.8, -Math.PI / 2),
      setPiece("rush-gantry", -6.7, 15.0, 0.6, 0.6, 5.0, Math.PI / 2),
      setPiece("rush-gantry", 6.7, 15.0, 0.6, 0.6, 5.0, -Math.PI / 2),
   ],
};

export const MAPS: Record<LevelId, DistrictMap> = {
   1: MAP_1,
   2: MAP_2,
   3: MAP_3,
   4: MAP_4,
   5: MAP_5,
};
