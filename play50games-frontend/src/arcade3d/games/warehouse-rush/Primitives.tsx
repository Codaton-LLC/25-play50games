"use client";

// Warehouse Rush look: the floor with the painted zone tiles (one canvas texture per run, because
// the zone colours move per seed), the walls, the rack and pallet stand-ins (instanced parts until
// their GLBs exist), the robot stand-in, the box materials (the shared crate recoloured per colour)
// and the small drawn textures (lid letters, score popups). Decoration for this game only: a new
// game copies the patterns from Scene.tsx, not these shapes.
import { memo, useEffect, useMemo } from "react";
import {
   BoxGeometry,
   MeshBasicMaterial,
   MeshStandardMaterial,
   PlaneGeometry,
   type CanvasTexture,
   type Material,
   type Mesh,
   type Object3D,
} from "three";
import { InstancedModel, useModel } from "@/arcade3d/core/assets";
import { Instanced, useCanvasTexture, type CanvasDraw, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, BOX } from "./assets";
import {
   ARENA,
   COLOURS,
   CORNER_COUNT,
   PALLET_HALF,
   PALLET_HEIGHT,
   PALLET_SLOTS,
   RACK,
   ROBOT_START,
   WALL,
   ZONE,
   cornerSignX,
   cornerSignZ,
   type Layout,
} from "./rules";

// ---------- palette ----------

export const COLORS = {
   floor: "#8a8379",
   floorJoint: "rgba(20, 16, 12, 0.16)",
   lane: "#facc15",
   bay: "rgba(241, 245, 249, 0.75)",
   plinth: "#1b2538",
   wall: "#a8a29e",
   trim: "#44403c",
   rackUpright: "#fb923c",
   rackShelf: "#94a3b8",
   carton: "#b07a4a",
   palletTop: "#d6a46b",
   palletRunner: "#a8743f",
   robot: "#2dd4bf",
   robotHead: "#f1f5f9",
   robotDark: "#0f172a",
   robotEye: "#67e8f9",
   hazard: "#111827",
} as const;

// ---------- the warehouse (static) ----------

/** A fixed -1..1 value per index (deterministic: the stand-ins never change their look). */
export function jitter(i: number): number {
   const h = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
   return (h - Math.floor(h)) * 2 - 1;
}

const WALL_SPOTS: InstanceSpot[] = (() => {
   const t = WALL.thickness;
   const longX = ARENA.halfX * 2 + t * 2;
   const longZ = ARENA.halfZ * 2;
   const y = WALL.height / 2;
   return [
      { x: 0, y, z: -(ARENA.halfZ + t / 2), sx: longX, sy: WALL.height, sz: t },
      { x: 0, y, z: ARENA.halfZ + t / 2, sx: longX, sy: WALL.height, sz: t },
      { x: -(ARENA.halfX + t / 2), y, z: 0, sx: t, sy: WALL.height, sz: longZ },
      { x: ARENA.halfX + t / 2, y, z: 0, sx: t, sy: WALL.height, sz: longZ },
   ];
})();
const TRIM_SPOTS: InstanceSpot[] = WALL_SPOTS.map((spot) => ({
   ...spot,
   y: WALL.height + 0.03,
   sx: (spot.sx ?? 1) + 0.04,
   sy: 0.06,
   sz: (spot.sz ?? 1) + 0.04,
}));

/** Rack centres (the GLB's feet once it exists): 3.6 long in x, 0.9 deep, 1.1 high. */
const RACK_CENTRE_X = (RACK.innerX + RACK.outerX) / 2;
const RACK_LENGTH = RACK.outerX - RACK.innerX;
const RACK_DEPTH = RACK.halfZ * 2;
const RACK_SPOTS: InstanceSpot[] = [
   { x: -RACK_CENTRE_X, y: 0, z: 0 },
   { x: RACK_CENTRE_X, y: 0, z: 0 },
];
/** The rack GLB is one 1.8 m bay pair (assets.ts): two copies side by side make each 3.6 m rack. */
const RACK_MODEL_SPOTS: InstanceSpot[] = RACK_SPOTS.flatMap((r) => [-1, 1].map((side) => ({ x: r.x + side * (RACK_LENGTH / 4), y: 0, z: 0 })));

/** One piece of a stand-in, relative to its prop's feet. */
interface Piece {
   x: number;
   y: number;
   z: number;
   sx: number;
   sy: number;
   sz: number;
   rotY?: number;
}

const UPRIGHT = 0.08;
const SHELF = 0.06;
/** shelf centres: the top shelf's top is the rack height (1.1) */
const SHELF_Y = [0.1, 0.56, RACK.height - SHELF / 2];
const UPRIGHT_X = [-1.76, -0.587, 0.587, 1.76];
const RACK_UPRIGHTS: Piece[] = UPRIGHT_X.flatMap((x) =>
   [-1, 1].map((side) => ({ x, y: RACK.height / 2, z: side * (RACK.halfZ - UPRIGHT / 2), sx: UPRIGHT, sy: RACK.height, sz: UPRIGHT }))
);
const RACK_SHELVES: Piece[] = SHELF_Y.map((y) => ({ x: 0, y, z: 0, sx: RACK_LENGTH, sy: SHELF, sz: RACK_DEPTH }));
/** plain brown cartons on the two lower shelves (never coloured like the pickups) */
const CARTON_TABLE: Array<[level: number, x: number, w: number, h: number, d: number]> = [
   [0, -1.42, 0.45, 0.32, 0.6],
   [0, -0.93, 0.42, 0.26, 0.56],
   [0, 0.04, 0.8, 0.36, 0.7],
   [0, 0.93, 0.5, 0.3, 0.62],
   [0, 1.42, 0.44, 0.34, 0.6],
   [1, -1.2, 0.7, 0.34, 0.66],
   [1, -0.22, 0.42, 0.28, 0.55],
   [1, 0.25, 0.44, 0.32, 0.58],
   [1, 1.15, 0.62, 0.38, 0.7],
];
const rackPieces = (pieces: Piece[], mirror: boolean, seed: number): Piece[] =>
   pieces.map((p, i) => ({ ...p, x: mirror ? -p.x : p.x, rotY: (p.rotY ?? 0) + (seed ? jitter(seed + i) * 0.08 : 0) }));
const CARTONS: Piece[] = CARTON_TABLE.map(([level, x, w, h, d]) => ({
   x,
   y: SHELF_Y[level] + SHELF / 2 + h / 2,
   z: 0,
   sx: w,
   sy: h,
   sz: d,
}));

/** Every piece of every prop as an instance spot (piece offsets turned with the prop's rotY). */
function spotsOf(props: readonly InstanceSpot[], pieces: (prop: number) => readonly Piece[]): InstanceSpot[] {
   return props.flatMap((prop, k) => {
      const turn = prop.rotY ?? 0;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      return pieces(k).map((p) => ({
         x: prop.x + c * p.x + s * p.z,
         y: prop.y + p.y,
         z: prop.z - s * p.x + c * p.z,
         rotY: turn + (p.rotY ?? 0),
         sx: p.sx,
         sy: p.sy,
         sz: p.sz,
      }));
   });
}

const RACK_UPRIGHT_SPOTS = spotsOf(RACK_SPOTS, () => RACK_UPRIGHTS);
const RACK_SHELF_SPOTS = spotsOf(RACK_SPOTS, () => RACK_SHELVES);
const RACK_CARTON_SPOTS = spotsOf(RACK_SPOTS, (k) => rackPieces(CARTONS, k === 1, 31 + k * 17));

/** Stand-in racks: orange uprights, grey shelves, brown cartons (three InstancedMeshes for both racks). */
function RackStandIns() {
   return (
      <>
         <Instanced spots={RACK_UPRIGHT_SPOTS} name="rack-uprights">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.rackUpright} roughness={0.55} />
         </Instanced>
         <Instanced spots={RACK_SHELF_SPOTS} name="rack-shelves">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.rackShelf} roughness={0.5} metalness={0.25} />
         </Instanced>
         <Instanced spots={RACK_CARTON_SPOTS} name="rack-cartons">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.carton} roughness={0.85} />
         </Instanced>
      </>
   );
}

/** Pallet stand-in: 3 top slats on 3 runners, 1.2 x 1.2 x 0.18 (rules PALLET_HALF, PALLET_HEIGHT). */
const SLAT_H = 0.05;
const RUNNER_H = PALLET_HEIGHT - SLAT_H;
const PALLET_SLATS: Piece[] = [-0.43, 0, 0.43].map((z) => ({
   x: 0,
   y: PALLET_HEIGHT - SLAT_H / 2,
   z,
   sx: PALLET_HALF * 2,
   sy: SLAT_H,
   sz: 0.34,
}));
const PALLET_RUNNERS: Piece[] = [-0.5, 0, 0.5].map((x) => ({ x, y: RUNNER_H / 2, z: 0, sx: 0.2, sy: RUNNER_H, sz: PALLET_HALF * 2 }));

/** Where this run's pallets stand (the 4 slots of the layout). */
export function palletSpots(layout: Layout): InstanceSpot[] {
   return layout.slots.map((slot) => ({ x: PALLET_SLOTS[slot].x, y: 0, z: PALLET_SLOTS[slot].z }));
}

function PalletStandIns({ spots }: { spots: readonly InstanceSpot[] }) {
   const slats = useMemo(() => spotsOf(spots, () => PALLET_SLATS), [spots]);
   const runners = useMemo(() => spotsOf(spots, () => PALLET_RUNNERS), [spots]);
   return (
      <>
         <Instanced spots={slats} name="pallet-slats">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.palletTop} roughness={0.8} />
         </Instanced>
         <Instanced spots={runners} name="pallet-runners">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.palletRunner} roughness={0.85} />
         </Instanced>
      </>
   );
}

// ---------- the floor ----------

/** Floor texture resolution: 48 px per metre (960 x 576, inside the 1024 px budget). */
const FLOOR_PX_PER_M = 48;
export const FLOOR_TEXTURE = { width: ARENA.halfX * 2 * FLOOR_PX_PER_M, height: ARENA.halfZ * 2 * FLOOR_PX_PER_M } as const;
/** Zone letters: 2.2 m tall, painted at the tile centres (clear of the near wall's 0.61 m shadow). */
export const ZONE_LETTER_M = 2.2;
/** Width of the hazard-striped border of a zone tile, m. */
const ZONE_BORDER_M = 0.28;
const LETTER_FONT = '900 100px system-ui, "Segoe UI", Roboto, Arial, sans-serif';

/** Centre of zone `corner` on the floor. */
export const zoneCentreX = (corner: number) => cornerSignX(corner) * (ZONE.innerX + ARENA.halfX) / 2;
export const zoneCentreZ = (corner: number) => cornerSignZ(corner) * (ZONE.innerZ + ARENA.halfZ) / 2;

/** A capital letter of cap height `capPx`, centred on (0, 0) of the current transform. */
function drawLetter(ctx: CanvasRenderingContext2D, letter: string, capPx: number, fill: string, stroke: string, strokePx: number) {
   ctx.font = LETTER_FONT;
   ctx.textAlign = "left";
   ctx.textBaseline = "alphabetic";
   // the glyph's own box (relative to the alignment point), so the letter is centred by its ink
   const m = ctx.measureText(letter);
   const ascent = m.actualBoundingBoxAscent || 72;
   const descent = m.actualBoundingBoxDescent || 0;
   const left = m.actualBoundingBoxLeft || 0;
   const right = m.actualBoundingBoxRight || m.width;
   const scale = capPx / (ascent + descent);
   const x = -(right - left) / 2;
   const y = (ascent - descent) / 2;
   ctx.save();
   ctx.scale(scale, scale);
   ctx.lineJoin = "round";
   ctx.lineWidth = strokePx / scale;
   ctx.strokeStyle = stroke;
   ctx.strokeText(letter, x, y);
   ctx.fillStyle = fill;
   ctx.fillText(letter, x, y);
   ctx.restore();
}

/**
 * The floor of one run: concrete with slab joints and stains, contact shadows under the racks and
 * this run's pallets, the pallet bays, the aisle lines, the start pad and the four zone tiles
 * (colour fill, hazard-striped border, big letter). The letters are turned to read upright from the
 * camera's yaw. Canvas top-left = world (-10, -6); a texel row is a line of constant z.
 */
export function floorDrawer(layout: Layout, yaw: number): CanvasDraw {
   return (ctx, w) => {
      const s = w / (ARENA.halfX * 2);
      const u = (x: number) => (x + ARENA.halfX) * s;
      const v = (z: number) => (z + ARENA.halfZ) * s;
      const h = ARENA.halfZ * 2 * s;

      ctx.fillStyle = COLORS.floor;
      ctx.fillRect(0, 0, w, h);

      // soft stains (fixed, so every run's concrete looks the same)
      for (let i = 0; i < 18; i++) {
         const x = jitter(i * 3 + 1) * ARENA.halfX;
         const z = jitter(i * 3 + 2) * ARENA.halfZ;
         const r = (0.6 + 0.6 * Math.abs(jitter(i * 3 + 3))) * s;
         const g = ctx.createRadialGradient(u(x), v(z), 0, u(x), v(z), r);
         const dark = i % 3 !== 0;
         g.addColorStop(0, dark ? "rgba(30, 24, 18, 0.08)" : "rgba(255, 250, 240, 0.06)");
         g.addColorStop(1, "rgba(0, 0, 0, 0)");
         ctx.fillStyle = g;
         ctx.fillRect(u(x) - r, v(z) - r, r * 2, r * 2);
      }

      // 2 m slab joints
      ctx.strokeStyle = COLORS.floorJoint;
      ctx.lineWidth = 2;
      for (let x = -ARENA.halfX + 2; x < ARENA.halfX; x += 2) {
         ctx.beginPath();
         ctx.moveTo(u(x), 0);
         ctx.lineTo(u(x), h);
         ctx.stroke();
      }
      for (let z = -ARENA.halfZ + 2; z < ARENA.halfZ; z += 2) {
         ctx.beginPath();
         ctx.moveTo(0, v(z));
         ctx.lineTo(w, v(z));
         ctx.stroke();
      }

      // contact shadows under the racks and this run's pallets (they never move during a run)
      ctx.fillStyle = "rgba(10, 8, 6, 0.13)";
      const shadow = (cx: number, cz: number, hx: number, hz: number) => {
         for (const grow of [0.36, 0.22, 0.1]) {
            ctx.fillRect(u(cx - hx - grow), v(cz - hz - grow), (hx + grow) * 2 * s, (hz + grow) * 2 * s);
         }
      };
      for (const rack of RACK_SPOTS) shadow(rack.x, rack.z, RACK_LENGTH / 2, RACK.halfZ);
      for (const slot of layout.slots) shadow(PALLET_SLOTS[slot].x, PALLET_SLOTS[slot].z, PALLET_HALF, PALLET_HALF);

      // aisle lines between the racks and the pallet rows
      ctx.strokeStyle = COLORS.lane;
      ctx.lineWidth = 0.1 * s;
      for (const z of [-2.2, 2.2]) {
         ctx.beginPath();
         ctx.moveTo(u(-ZONE.innerX + 0.3), v(z));
         ctx.lineTo(u(ZONE.innerX - 0.3), v(z));
         ctx.stroke();
      }

      // pallet bays: white corner marks 0.25 m outside each pallet of this run
      ctx.strokeStyle = COLORS.bay;
      ctx.lineWidth = 0.07 * s;
      const half = PALLET_HALF + 0.25;
      const arm = 0.35;
      for (const slot of layout.slots) {
         const { x, z } = PALLET_SLOTS[slot];
         for (const [dx, dz] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
         ]) {
            const cx = x + dx * half;
            const cz = z + dz * half;
            ctx.beginPath();
            ctx.moveTo(u(cx - dx * arm), v(cz));
            ctx.lineTo(u(cx), v(cz));
            ctx.lineTo(u(cx), v(cz - dz * arm));
            ctx.stroke();
         }
      }

      // start pad between the racks
      ctx.strokeStyle = COLORS.robot;
      ctx.lineWidth = 0.08 * s;
      ctx.beginPath();
      ctx.arc(u(ROBOT_START.x), v(ROBOT_START.z), 0.75 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(45, 212, 191, 0.16)";
      ctx.fill();

      // the zones: colour fill, hazard-striped border, the big letter
      const border = ZONE_BORDER_M * s;
      for (let c = 0; c < CORNER_COUNT; c++) {
         const colour = COLOURS[layout.zoneColours[c]];
         const x0 = Math.min(cornerSignX(c) * ZONE.innerX, cornerSignX(c) * ARENA.halfX);
         const z0 = Math.min(cornerSignZ(c) * ZONE.innerZ, cornerSignZ(c) * ARENA.halfZ);
         const left = u(x0);
         const top = v(z0);
         const size = ZONE.size * s;
         const height = (ARENA.halfZ - ZONE.innerZ) * s;

         ctx.globalAlpha = 0.86;
         ctx.fillStyle = colour.hex;
         ctx.fillRect(left, top, size, height);
         ctx.globalAlpha = 1;

         ctx.save();
         ctx.beginPath();
         ctx.rect(left, top, size, height);
         ctx.rect(left + border, top + border, size - border * 2, height - border * 2);
         ctx.clip("evenodd");
         ctx.fillStyle = COLORS.hazard;
         ctx.fillRect(left, top, size, height);
         ctx.fillStyle = colour.hex;
         const stripe = 0.32 * s;
         for (let k = -height; k < size + height; k += stripe * 2) {
            ctx.beginPath();
            ctx.moveTo(left + k, top + height);
            ctx.lineTo(left + k + stripe, top + height);
            ctx.lineTo(left + k + stripe + height, top);
            ctx.lineTo(left + k + height, top);
            ctx.closePath();
            ctx.fill();
         }
         ctx.restore();

         ctx.save();
         ctx.translate(left + size / 2, top + height / 2);
         // upright for the camera: canvas up is world -z, the camera's screen up is turned by its yaw
         ctx.rotate(-yaw);
         ctx.globalAlpha = 0.95;
         drawLetter(ctx, colour.zone, ZONE_LETTER_M * s, "#ffffff", "rgba(15, 23, 42, 0.85)", 0.12 * s);
         ctx.restore();
      }
   };
}

/** Floor, slab, walls, racks and this run's pallets: everything that never moves during a run. */
export const Warehouse = memo(function Warehouse({ layout, yaw }: { layout: Layout; yaw: number }) {
   const draw = useMemo(() => floorDrawer(layout, yaw), [layout, yaw]);
   const floor = useCanvasTexture(FLOOR_TEXTURE.width, FLOOR_TEXTURE.height, draw);
   const pallets = useMemo(() => palletSpots(layout), [layout]);

   return (
      <group name="warehouse">
         <mesh rotation-x={-Math.PI / 2} name="floor">
            <planeGeometry args={[ARENA.halfX * 2, ARENA.halfZ * 2]} />
            <meshStandardMaterial map={floor} roughness={0.92} />
         </mesh>
         {/* the slab the diorama stands on */}
         <mesh position-y={-0.26}>
            <boxGeometry args={[(ARENA.halfX + WALL.thickness) * 2 + 0.3, 0.5, (ARENA.halfZ + WALL.thickness) * 2 + 0.3]} />
            <meshStandardMaterial color={COLORS.plinth} roughness={0.9} />
         </mesh>
         <Instanced spots={WALL_SPOTS} name="walls">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.wall} roughness={0.75} />
         </Instanced>
         <Instanced spots={TRIM_SPOTS} name="wall-trim">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.trim} roughness={0.6} />
         </Instanced>
         <InstancedModel asset={ASSETS.shelfRack} spots={RACK_MODEL_SPOTS} fallback={<RackStandIns />} />
         <InstancedModel asset={ASSETS.pallet} spots={pallets} fallback={<PalletStandIns spots={pallets} />} />
      </group>
   );
});

// ---------- the robot ----------

/** Stand-in robot while robot.glb is missing: teal capsule, white head, dark visor with two eyes. 1.2 tall. */
export function RobotPrimitive() {
   return (
      <group>
         {[-0.34, 0.34].map((x) => (
            <mesh key={x} position={[x, 0.16, 0]} rotation-z={Math.PI / 2}>
               <cylinderGeometry args={[0.16, 0.16, 0.13, 16]} />
               <meshStandardMaterial color={COLORS.robotDark} roughness={0.7} />
            </mesh>
         ))}
         <mesh position-y={0.55}>
            <capsuleGeometry args={[0.32, 0.26, 6, 16]} />
            <meshStandardMaterial color={COLORS.robot} roughness={0.4} />
         </mesh>
         <mesh position-y={0.98} scale={[1.15, 0.86, 1]}>
            <sphereGeometry args={[0.27, 20, 14]} />
            <meshStandardMaterial color={COLORS.robotHead} roughness={0.35} />
         </mesh>
         <mesh position={[0, 0.99, 0.13]} scale={[1.1, 0.58, 0.62]}>
            <sphereGeometry args={[0.22, 20, 12]} />
            <meshStandardMaterial color={COLORS.robotDark} roughness={0.2} />
         </mesh>
         {[-0.09, 0.09].map((x) => (
            <mesh key={x} position={[x, 1.0, 0.27]}>
               <sphereGeometry args={[0.05, 12, 8]} />
               <meshStandardMaterial color={COLORS.robotEye} emissive={COLORS.robotEye} emissiveIntensity={2.2} />
            </mesh>
         ))}
         <mesh position-y={1.18}>
            <cylinderGeometry args={[0.02, 0.02, 0.06, 8]} />
            <meshStandardMaterial color={COLORS.robotDark} />
         </mesh>
      </group>
   );
}

// ---------- boxes ----------

/** Height of the lid letter above the box's feet (just above the crate's 0.708 m lid). */
export const LID_Y = BOX.height + 0.012;

function drawLidLetter(ctx: CanvasRenderingContext2D, w: number, h: number, letter: string) {
   ctx.clearRect(0, 0, w, h);
   ctx.translate(w / 2, h / 2);
   drawLetter(ctx, letter, h * 0.62, "#ffffff", "rgba(15, 23, 42, 0.9)", h * 0.1);
}

/** One draw function per colour (module level, so the textures are drawn once). */
const LID_DRAWS: CanvasDraw[] = COLOURS.map((colour) => (ctx, w, h) => drawLidLetter(ctx, w, h, colour.zone));

/** Neutral planks for the stand-in box: the material colour paints it (white x colour = colour). */
function drawPlanks(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#f8fafc";
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = "rgba(15, 23, 42, 0.16)";
   for (let y = h / 4; y < h; y += h / 4) ctx.fillRect(0, y - 2, w, 4);
   ctx.strokeStyle = "rgba(15, 23, 42, 0.28)";
   ctx.lineWidth = w * 0.1;
   ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
}

/** The first mesh of a model clone (the crate GLB is one mesh with one material). */
export function firstMesh(root: Object3D | null): Mesh | null {
   let found: Mesh | null = null;
   root?.traverse((object) => {
      if (!found && (object as Mesh).isMesh) found = object as Mesh;
   });
   return found;
}

export interface BoxLook {
   /** the crate GLB is drawn (false: the stand-in box) */
   glb: boolean;
   /** per colour id: the box body material */
   bodies: Material[];
   /** per colour id: the lid letter */
   letters: MeshBasicMaterial[];
   /** the lid letter plane */
   decal: PlaneGeometry;
   /** the stand-in box (feet at y = 0) while the crate GLB is missing or broken */
   standIn: BoxGeometry;
}

/**
 * The box materials of one run, made before the first render (so no needsUpdate): with the crate
 * GLB, 4 clones of its material with the albedo map dropped (`map = null`), the normal and
 * metal/roughness maps kept and `color` = the colour itself (README "Colour, not tint"); without
 * it, a plank texture painted in the colour. The game disposes of what it made; the GLB's
 * geometry and textures belong to the loader cache. Suspends while the crate GLB loads.
 */
export function useBoxLook(): BoxLook {
   const { scene, failed } = useModel(ASSETS.crate);
   const planks = useCanvasTexture(128, 128, drawPlanks);
   const letterMaps: CanvasTexture[] = [
      useCanvasTexture(128, 128, LID_DRAWS[0]),
      useCanvasTexture(128, 128, LID_DRAWS[1]),
      useCanvasTexture(128, 128, LID_DRAWS[2]),
      useCanvasTexture(128, 128, LID_DRAWS[3]),
   ];
   const [m0, m1, m2, m3] = letterMaps;
   const look = useMemo<BoxLook>(() => {
      const source = failed ? null : firstMesh(scene)?.material ?? null;
      const base = source && !Array.isArray(source) && source instanceof MeshStandardMaterial ? source : null;
      const bodies = COLOURS.map((colour) => {
         if (base) {
            const material = base.clone();
            material.map = null;
            material.color.set(colour.hex);
            material.emissive.set(0x000000);
            material.name = `box-${colour.name.toLowerCase()}`;
            return material;
         }
         return new MeshStandardMaterial({ color: colour.hex, map: planks, roughness: 0.75, name: `box-${colour.name.toLowerCase()}` });
      });
      const letters = [m0, m1, m2, m3].map(
         (map) => new MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
      );
      const standIn = new BoxGeometry(BOX.width, BOX.height, BOX.depth).translate(0, BOX.height / 2, 0);
      return { glb: !!base, bodies, letters, decal: new PlaneGeometry(0.56, 0.56), standIn };
   }, [scene, failed, planks, m0, m1, m2, m3]);
   useEffect(
      () => () => {
         look.bodies.forEach((material) => material.dispose());
         look.letters.forEach((material) => material.dispose());
         look.decal.dispose();
         look.standIn.dispose();
      },
      [look]
   );
   return look;
}

// ---------- popups ----------

/** The score popups: +50, -20, -10 (the floor cut the penalty) and ✗ (nothing left to take). */
export const POPUP_TEXT = ["+50", "−20", "−10", "✗"] as const;

function drawPopup(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, good: boolean) {
   ctx.clearRect(0, 0, w, h);
   ctx.font = '900 84px system-ui, "Segoe UI", Roboto, Arial, sans-serif';
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.lineJoin = "round";
   ctx.lineWidth = 14;
   ctx.strokeStyle = "rgba(15, 23, 42, 0.92)";
   ctx.strokeText(text, w / 2, h / 2 + 4);
   ctx.fillStyle = good ? "#4ade80" : "#f87171";
   ctx.fillText(text, w / 2, h / 2 + 4);
}

export const POPUP_DRAWS: CanvasDraw[] = POPUP_TEXT.map((text, i) => (ctx, w, h) => drawPopup(ctx, w, h, text, i === 0));

/** Popup texture index for a real change of the score. */
export function popupKind(delta: number): number {
   if (delta > 0) return 0;
   if (delta <= -20) return 1;
   if (delta < 0) return 2;
   return 3;
}
