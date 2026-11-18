"use client";

// Menu 2 "Color Roll Heroes" prop: ArchCorridor.
// Five ArchWall arches in a row, 3 m apart, joined by one floor strip. Built from ONE shared arch
// geometry (ArchWall's stone + trim builders, merged and vertex-coloured) drawn as a single InstancedMesh,
// so five arches cost one draw call; the floor strip is a second. Two draw calls total for the corridor.
//
// Real-world size (metres): each arch is ARCH_WALL_SIZE (4.0 wide x 3.0 tall x 0.5 thick); the centres are
// 3 m apart along z, so the row spans 12 m centre-to-centre. The floor strip is 3.8 wide, 0.2 thick, and
// 14.5 long (each end runs 1.0 m past the outer arches' outer faces). Arch feet and the floor top sit on
// y = 0; the whole corridor is centred on x and z.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
   BufferAttribute,
   BoxGeometry,
   Color,
   InstancedMesh,
   Matrix4,
   Vector3,
   Quaternion,
   type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ARCH_WALL_SIZE, buildArchStoneGeometry, buildArchTrimGeometry } from "./ArchWall";

/** Corridor size in metres: 5 arches, 3 m apart, one 3.8 x 14.5 floor strip. */
export const ARCH_CORRIDOR_SIZE = {
   arches: 5,
   spacing: 3.0,
   span: 14.5,
   floorW: 3.8,
   floorT: 0.2,
   h: ARCH_WALL_SIZE.h,
} as const;

/** Default tones: warm white stone, terracotta trim, cool stone floor. */
const DEFAULT_COLOR = "#efeae0";
const DEFAULT_ACCENT = "#c0503c";
const FLOOR_COLOR = "#d3cec2";

/** Each arch centre's z offset (the row is centred on z = 0). Pure. */
export function corridorArchOffsets(): number[] {
   const offsets: number[] = [];
   for (let i = 0; i < ARCH_CORRIDOR_SIZE.arches; i++) {
      offsets.push((i - (ARCH_CORRIDOR_SIZE.arches - 1) / 2) * ARCH_CORRIDOR_SIZE.spacing);
   }
   return offsets;
}

/**
 * The one shared arch geometry: ArchWall's stone and trim merged into a single vertex-coloured geometry so
 * an InstancedMesh can draw all five arches in one call. Pure; `stone` and `trim` are hex tones baked into
 * the vertex colours (the trim stays readable as the accent under one material).
 */
export function buildCorridorArchGeometry(stone: string, trim: string): BufferGeometry {
   const painted = [
      paint(buildArchStoneGeometry(), stone),
      paint(buildArchTrimGeometry(), trim),
   ];
   const merged = mergeGeometries(painted);
   painted.forEach((geometry) => geometry.dispose());
   if (!merged) throw new Error("arch corridor: the arch did not merge");
   return merged;
}

/** The floor strip under the row: a flat slab, top on y = 0, centred on x/z. Pure. */
export function buildCorridorFloorGeometry(): BufferGeometry {
   const floor = new BoxGeometry(ARCH_CORRIDOR_SIZE.floorW, ARCH_CORRIDOR_SIZE.floorT, ARCH_CORRIDOR_SIZE.span);
   floor.translate(0, -ARCH_CORRIDOR_SIZE.floorT / 2, 0);
   return floor;
}

/** Paint a geometry with a flat vertex colour (de-indexed so parts merge cleanly), freeing the input. */
function paint(geometry: BufferGeometry, hex: string): BufferGeometry {
   const color = new Color(hex);
   const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
   const count = nonIndexed.getAttribute("position").count;
   const colors = new Float32Array(count * 3);
   for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
   }
   nonIndexed.setAttribute("color", new BufferAttribute(colors, 3));
   if (nonIndexed !== geometry) geometry.dispose();
   return nonIndexed;
}

export interface ArchCorridorProps {
   /** Stone tone (arch walls). Default warm white. */
   color?: string;
   /** Trim tone round each arch. Default terracotta. */
   accent?: string;
}

/** The corridor: one InstancedMesh of arches + one floor mesh = two draw calls (a ~0.4k-tri arch instanced 5x + a 12-tri floor, ~1.9k drawn). */
export function ArchCorridor({ color = DEFAULT_COLOR, accent = DEFAULT_ACCENT }: ArchCorridorProps) {
   const built = useMemo(() => {
      const arch = buildCorridorArchGeometry(color, accent);
      const floor = buildCorridorFloorGeometry();
      const offsets = corridorArchOffsets();
      const matrices = offsets.map(
         (z) => new Matrix4().compose(new Vector3(0, 0, z), new Quaternion(), new Vector3(1, 1, 1))
      );
      return { arch, floor, matrices };
   }, [color, accent]);

   const instances = useRef<InstancedMesh>(null);
   useLayoutEffect(() => {
      const mesh = instances.current;
      if (!mesh) return;
      built.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
   }, [built]);

   useEffect(
      () => () => {
         built.arch.dispose();
         built.floor.dispose();
      },
      [built]
   );

   return (
      <group name="arch-corridor">
         <instancedMesh
            ref={instances}
            args={[built.arch, undefined, built.matrices.length]}
            castShadow
            receiveShadow
         >
            <meshStandardMaterial vertexColors roughness={0.72} metalness={0.02} />
         </instancedMesh>
         <mesh geometry={built.floor} receiveShadow>
            <meshStandardMaterial color={FLOOR_COLOR} roughness={0.8} metalness={0.02} />
         </mesh>
      </group>
   );
}
