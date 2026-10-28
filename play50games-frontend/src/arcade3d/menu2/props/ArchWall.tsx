"use client";

// Menu 2 "Color Roll Heroes" prop: ArchWall.
// A white-stone wall segment with an open arched doorway and a coloured trim moulding round the arch.
// Built in code (Hyper3D made these wrong) so the bevel, the opening and the trim read clean from the
// high third-person camera. Two meshes = two draw calls: the bevelled stone wall (ExtrudeGeometry with a
// bevelled hole for the arch) and the rounded trim moulding (a half torus crown over two tube jambs).
// Both geometries are colour-agnostic and pure, so ArchCorridor reuses them for its five instanced arches.
//
// Real-world size (metres): wall 4.0 wide x 3.0 tall x 0.5 thick, centred on x, standing on y = 0, front
// face at z = 0.5. The doorway opening is 1.6 wide x 2.3 tall at its tightest (a semicircular arch: 0.8
// radius springing at y = 1.5), chamfered ~4 cm wider at the faces. The trim is a 7 cm-thick rounded
// moulding centred on radius 0.9 that stands ~4 cm proud of the front face (union depth ~0.54).
import { useEffect, useMemo } from "react";
import { CylinderGeometry, ExtrudeGeometry, Path, Shape, TorusGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Wall segment size in metres: 4 wide, 3 tall, 0.5 thick, with a 1.6 x 2.3 arched doorway. */
export const ARCH_WALL_SIZE = {
   w: 4.0,
   h: 3.0,
   d: 0.5,
   openW: 1.6,
   openH: 2.3,
} as const;

/** Default tones: warm white stone, terracotta trim. */
const DEFAULT_COLOR = "#efeae0";
const DEFAULT_ACCENT = "#c0503c";

const STONE_BEVEL = 0.04; // edge chamfer on the wall, metres
const STONE_BEVEL_T = 0.04;
const TRIM_TUBE = 0.07; // trim moulding thickness (tube radius), metres
const TRIM_R = ARCH_WALL_SIZE.openW / 2 + 0.02 + TRIM_TUBE; // moulding centreline radius: 0.9
const TRIM_SPRING = ARCH_WALL_SIZE.openH - ARCH_WALL_SIZE.openW / 2; // arch spring height: 1.5
const TRIM_Z = ARCH_WALL_SIZE.d - 0.03; // moulding centre depth: stands ~4 cm proud of the front face

/**
 * The bevelled stone wall with the arched doorway cut through it, front face at z = d, standing on y = 0,
 * centred on x. Pure and colour-agnostic: the material supplies the stone tone. ExtrudeGeometry draws the
 * bevel's small end as the profile and expands the core by bevelSize, so the outline is inset by the bevel
 * (outer by -bevelSize, the hole by +bevelSize) to land the outer box at w x h x d and the tightest
 * opening at openW x openH (the bevel chamfers the doorway ~4 cm wider at the two faces).
 */
export function buildArchStoneGeometry(): BufferGeometry {
   const B = STONE_BEVEL;
   const BT = STONE_BEVEL_T;
   const hw = ARCH_WALL_SIZE.w / 2 - B;
   const bottom = B;
   const top = ARCH_WALL_SIZE.h - B;
   const shape = new Shape();
   shape.moveTo(-hw, bottom);
   shape.lineTo(hw, bottom);
   shape.lineTo(hw, top);
   shape.lineTo(-hw, top);
   shape.closePath();

   // The arch hole, grown by the bevel so the tightest opening lands on openW x openH.
   const r = ARCH_WALL_SIZE.openW / 2 + B;
   const apex = ARCH_WALL_SIZE.openH + B;
   const spring = apex - r;
   const hole = new Path();
   hole.moveTo(-r, bottom);
   hole.lineTo(-r, spring);
   hole.absarc(0, spring, r, Math.PI, 0, true);
   hole.lineTo(r, bottom);
   hole.closePath();
   shape.holes.push(hole);

   const geometry = new ExtrudeGeometry(shape, {
      depth: ARCH_WALL_SIZE.d - 2 * BT,
      bevelEnabled: true,
      bevelThickness: BT,
      bevelSize: B,
      bevelSegments: 1,
      curveSegments: 10,
      steps: 1,
   });
   geometry.translate(0, 0, BT);
   return geometry;
}

/**
 * The coloured trim moulding: a rounded band that follows the arch - a half-torus crown over the doorway
 * and two tube jambs down its sides - merged into one geometry standing proud on the wall's front face.
 * Pure and colour-agnostic: the material supplies the trim tone. The moulding's inner edge (0.83) sits
 * just outside the tightest opening (0.8), so it frames the arch without narrowing it.
 */
export function buildArchTrimGeometry(): BufferGeometry {
   const crown = new TorusGeometry(TRIM_R, TRIM_TUBE, 8, 8, Math.PI);
   crown.translate(0, TRIM_SPRING, TRIM_Z);
   const jambs: BufferGeometry[] = [];
   for (const side of [-1, 1]) {
      const jamb = new CylinderGeometry(TRIM_TUBE, TRIM_TUBE, TRIM_SPRING, 8, 1, true);
      jamb.translate(side * TRIM_R, TRIM_SPRING / 2, TRIM_Z);
      jambs.push(jamb);
   }
   const merged = mergeGeometries([crown, ...jambs]);
   crown.dispose();
   jambs.forEach((geometry) => geometry.dispose());
   if (!merged) throw new Error("arch wall: the trim did not merge");
   return merged;
}

export interface ArchWallProps {
   /** Stone tone (the wall). Default warm white. */
   color?: string;
   /** Trim tone round the arch. Default terracotta. */
   accent?: string;
}

/** The wall segment: two meshes (stone wall + trim), two draw calls, ~0.4k triangles. */
export function ArchWall({ color = DEFAULT_COLOR, accent = DEFAULT_ACCENT }: ArchWallProps) {
   const built = useMemo(() => {
      const stone = buildArchStoneGeometry();
      const trim = buildArchTrimGeometry();
      return { stone, trim };
   }, []);

   useEffect(
      () => () => {
         built.stone.dispose();
         built.trim.dispose();
      },
      [built]
   );

   return (
      <group name="arch-wall">
         <mesh geometry={built.stone} castShadow receiveShadow>
            <meshStandardMaterial color={color} roughness={0.72} metalness={0.02} />
         </mesh>
         <mesh geometry={built.trim} castShadow>
            <meshStandardMaterial color={accent} roughness={0.6} metalness={0.04} />
         </mesh>
      </group>
   );
}
