// Airport Luggage Rush look and palette. Pure data: palette, play bounds, decor spots,
// and geometry builders for airport surroundings and conveyor frames.
// No React or three.js state — uploaded once by the scene components.

export const COLORS = {
   // Baggage hall floor & outdoor apron
   floor: "#e2e8f0",
   floorTile: "#f1f5f9",
   floorGrout: "#cbd5e1",
   floorBorder: "#94a3b8",
   tarmac: "#334155",
   tarmacLine: "#facc15",
   tarmacStripe: "#ffffff",
   tarmacGrass: "#475569",

   // Terminal walls & architecture
   wall: "#f8fafc",
   wallBase: "#94a3b8",
   wallAccent: "#0284c7",
   windowFrame: "#475569",
   pillar: "#e2e8f0",
   pillarTrim: "#64748b",

   // Steel conveyors & chutes
   steelFrame: "#64748b",
   steelLeg: "#475569",
   steelDark: "#334155",
   rubberBumper: "#475569", // Lighter slate rubber (not near-black against beltSlat #334155)
   beltSlat: "#334155",
   chuteMetal: "#475569",
   chuteTrim: "#94a3b8",

   // Diverter switches
   diverterBase: "#64748b", // Distinct steel tone with high contrast against #334155 belt
   diverterPuck: "#94a3b8", // Light metallic accent
   diverterArrow: "#f8fafc",
   diverterGlow: "#38bdf8",

   // Luggage carts & equipment
   cartBody: "#0284c7",
   cartFrame: "#64748b",
   cartWheel: "#1e293b",
   cartBumper: "#f59e0b",
   cargoBox: "#cbd5e1",
   cargoTrim: "#64748b",

   // Signage & lights
   signBg: "#0f172a",
   signYellow: "#facc15",
   signText: "#f8fafc",
   runwayLight: "#38bdf8",
   runwayPost: "#64748b",

   // Sky & atmosphere
   skyTop: "#38bdf8",
   skyBottom: "#e0f2fe",
   fog: "#e2e8f0",

   // Stand-in fallbacks (2-3 tones each)
   suitcase: {
      body: "#f8fafc",
      trim: "#334155",
      latch: "#cbd5e1",
   },
   plane: {
      body: "#ffffff",
      stripe: "#2563eb",
      wing: "#cbd5e1",
      cockpit: "#0f172a",
   },
   handler: {
      vest: "#f97316",
      stripe: "#f8fafc",
      pants: "#1e293b",
      boots: "#0f172a",
   },

   // Flight colours (matched to rules.FLIGHTS)
   flights: {
      red: "#f87171",
      blue: "#60a5fa",
      green: "#34d399",
      yellow: "#fbbf24",
      vipRim: "#fde68a",
   },
} as const;

export interface BeltMarker {
   flight: number;
   color: string;
   symbol: "circle" | "square" | "triangle" | "star";
   x: number;
   y: number;
   z: number;
   size: number;
}

/**
 * World size of destination markers on chute belts.
 * Projects to >= 40 px across 390x844, 844x390, and 1280x800.
 */
export const BELT_MARKER_SIZE = 1.35;

/**
 * Bright, high-contrast destination markers positioned on the chute belts facing the camera.
 * Each marker matches its destination flight color and tag symbol.
 */
export const BELT_MARKERS: readonly BeltMarker[] = [
   { flight: 0, color: COLORS.flights.red, symbol: "circle", x: 6.4, y: 0.82, z: 4.4, size: BELT_MARKER_SIZE },
   { flight: 1, color: COLORS.flights.blue, symbol: "square", x: 6.4, y: 0.82, z: 8.0, size: BELT_MARKER_SIZE },
   { flight: 2, color: COLORS.flights.green, symbol: "triangle", x: 6.4, y: 0.82, z: 11.2, size: BELT_MARKER_SIZE },
   { flight: 3, color: COLORS.flights.yellow, symbol: "star", x: 6.4, y: 0.82, z: 14.2, size: BELT_MARKER_SIZE },
] as const;

/**
 * Playable area bounding box: belts, diverters, chutes, and bags move here.
 * Decor instances MUST stay outside this box.
 */
export const PLAY_AREA = {
   minX: 0.4,
   maxX: 8.2,
   minY: 0,
   maxY: 1.6,
   minZ: -0.6,
   maxZ: 14.8,
} as const;

/**
 * Returns true if the coordinate is inside or touches the play area box.
 */
export function inPlayArea(x: number, z: number, margin = 0): boolean {
   return (
      x >= PLAY_AREA.minX - margin &&
      x <= PLAY_AREA.maxX + margin &&
      z >= PLAY_AREA.minZ - margin &&
      z <= PLAY_AREA.maxZ + margin
   );
}

/** Floor bounds (covers the entire view frustum on y=0 at 1280x800, 390x844, and 844x390). */
export const FLOOR = {
   width: 70,
   depth: 70,
   centerX: 5.0,
   centerZ: 5.0,
} as const;

/** Linear fog: starts past the far play boundary (36 m), so belts remain crisp and vibrant. */
export const FOG_RANGE = { near: 36, far: 75 } as const;

export interface DecorSpot {
   kind: "cart" | "cargo" | "light" | "pillar";
   x: number;
   y: number;
   z: number;
   rotY: number;
   scale?: number;
}

/**
 * Static decor instances strictly placed outside the play area.
 * Placed in background areas (North tarmac behind windows, West terminal wall, East apron).
 */
export const DECOR_SPOTS: readonly DecorSpot[] = [
   // Luggage carts parked along west terminal wall (outside x < 0.4)
   { kind: "cart", x: -1.2, y: 0, z: 2.5, rotY: 0.1 },
   { kind: "cart", x: -1.2, y: 0, z: 6.8, rotY: -0.05 },
   { kind: "cart", x: -1.2, y: 0, z: 11.0, rotY: 0.15 },
   // Luggage carts parked on the far east side (outside x > 8.2)
   { kind: "cart", x: 10.6, y: 0, z: 3.2, rotY: -1.4 },
   { kind: "cart", x: 10.6, y: 0, z: 9.6, rotY: 1.6 },

   // Air cargo containers (LD3) on the tarmac outside the north window (z < -0.6)
   { kind: "cargo", x: 2.0, y: 0, z: -3.8, rotY: 0.3 },
   { kind: "cargo", x: 4.2, y: 0, z: -4.2, rotY: -0.2 },
   { kind: "cargo", x: 13.5, y: 0, z: -4.0, rotY: 0.1 },

   // Runway / apron edge lights along north tarmac border
   { kind: "light", x: -6.0, y: 0, z: -2.8, rotY: 0 },
   { kind: "light", x: -1.5, y: 0, z: -2.8, rotY: 0 },
   { kind: "light", x: 3.0, y: 0, z: -2.8, rotY: 0 },
   { kind: "light", x: 7.5, y: 0, z: -2.8, rotY: 0 },
   { kind: "light", x: 12.0, y: 0, z: -2.8, rotY: 0 },
   { kind: "light", x: 16.5, y: 0, z: -2.8, rotY: 0 },

   // Terminal architectural columns outside play area (along North and West background walls)
   { kind: "pillar", x: -1.8, y: 0, z: -2.2, rotY: 0 },
   { kind: "pillar", x: -1.8, y: 0, z: 5.5, rotY: 0 },
   { kind: "pillar", x: -1.8, y: 0, z: 12.8, rotY: 0 },
   { kind: "pillar", x: 4.2, y: 0, z: -2.4, rotY: 0 },
   { kind: "pillar", x: 9.6, y: 0, z: -2.4, rotY: 0 },
] as const;
