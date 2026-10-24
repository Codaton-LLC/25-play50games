// The cave kitchen: floor, the serving-hatch wall (one extruded shape with two openings), the counter
// under the wheel, the stove drum under the cauldron, a shelf of instanced labelled jars and the
// shared mushroom decor. Static set dressing: everything is placed once; the jars' and mushrooms'
// counts follow useQuality().decor. The shared layout constants below are the single source the
// Monsters read for where to stand.
import { useEffect, useMemo } from "react";
import { CanvasTexture, ExtrudeGeometry, Shape, SRGBColorSpace } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced } from "@/arcade3d/core/render";
import { useQuality, scaledCount } from "@/arcade3d/core/quality";
import { ASSETS } from "./assets";

/** The counter top (m), also the stove drum's top and the wheel's height (rules.WHEEL.y). */
export const COUNTER_TOP = 0.9;
/** The serving hatch: wall plane and the two window slots (x) the monsters stand behind. */
export const HATCH_Z = -1.7;
export const HATCH_X = [-0.8, 0.8] as const;
/** Where the ordering monsters stand (z, on the floor behind the hatch). */
export const MONSTER_Z = -2.32;
/** The dimmed queue monster, further back. */
export const QUEUE_Z = -2.72;
/** The hatch opening: width and y band (m). */
const OPENING = { w: 1.35, y0: 0.7, y1: 2.3 };

const FLOOR = "#292524";
const WALL = "#44403c";
const TRIM = "#57534e";
const COUNTER = "#78350f";
const STOVE = "#292524";
const ROCK = "#1c1917";
/** The shelf over the left hatch: in front of the wall face (HATCH_Z), its top at SHELF.top. */
const SHELF = { x: -2.35, z: HATCH_Z + 0.13, depth: 0.26, top: 2.47 };
const JAR_H = 0.22;

export function Kitchen() {
   const quality = useQuality();

   // the hatch wall: one extruded shape (two openings), one draw call
   const wall = useMemo(() => {
      const shape = new Shape();
      shape.moveTo(-3.2, 0);
      shape.lineTo(1.75, 0);
      shape.lineTo(1.75, 2.9);
      shape.lineTo(-3.2, 2.9);
      shape.closePath();
      for (const x of HATCH_X) {
         const hole = new Shape();
         hole.moveTo(x - OPENING.w / 2, OPENING.y0);
         hole.lineTo(x + OPENING.w / 2, OPENING.y0);
         hole.lineTo(x + OPENING.w / 2, OPENING.y1);
         hole.lineTo(x - OPENING.w / 2, OPENING.y1);
         hole.closePath();
         shape.holes.push(hole);
      }
      const geometry = new ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
      geometry.translate(0, 0, -0.14);
      return geometry;
   }, []);
   useEffect(() => () => wall.dispose(), [wall]);

   // one paper-label texture shared by every jar
   const jarTexture = useMemo(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#a16207";
      ctx.fillRect(0, 0, 64, 32);
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(4, 6, 56, 20);
      ctx.fillStyle = "#78350f";
      ctx.fillRect(10, 11, 26, 3);
      ctx.fillRect(10, 17, 40, 3);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      return texture;
   }, []);
   useEffect(() => () => jarTexture.dispose(), [jarTexture]);

   const jarSpots = useMemo(() => {
      const count = scaledCount(8, quality.tier === "low" ? 0.5 : 1);
      const spots = [];
      for (let i = 0; i < count; i++) {
         const scale = 0.9 + (i % 3) * 0.12;
         // standing on the shelf, in front of the wall face
         spots.push({ x: -3.05 + i * 0.22, y: SHELF.top + (JAR_H / 2) * scale, z: HATCH_Z + 0.12, scale });
      }
      return spots;
   }, [quality.tier]);

   const mushroomSpots = useMemo(() => {
      const count = scaledCount(5, quality.decor);
      const base = [
         { x: 1.15, z: -1.25, scale: 0.55, rotY: 0.4 },
         { x: 1.5, z: -1.0, scale: 0.4, rotY: 2.1 },
         { x: 0.95, z: -0.85, scale: 0.32, rotY: 4.0 },
         { x: -2.75, z: -1.15, scale: 0.45, rotY: 1.2 },
         { x: -3.0, z: -0.85, scale: 0.3, rotY: 5.3 },
      ];
      return base.slice(0, count).map((s) => ({ ...s, y: 0 }));
   }, [quality.decor]);

   return (
      <group name="kitchen">
         {/* floor: the fog swallows the edges */}
         <mesh rotation-x={-Math.PI / 2} position={[-0.5, 0, -2]}>
            <planeGeometry args={[26, 26]} />
            <meshStandardMaterial color={FLOOR} roughness={0.95} />
         </mesh>
         {/* the hatch wall (front face at HATCH_Z) */}
         <mesh geometry={wall} position-z={HATCH_Z}>
            <meshStandardMaterial color={WALL} roughness={0.9} />
         </mesh>
         {/* the cave behind: a dark rock backdrop past the queue, and a rock band over the wall top, so
             no flat background shows above the wall or through the hatch */}
         <mesh position={[-0.7, 3.2, -3.4]}>
            <planeGeometry args={[18, 6.4]} />
            <meshStandardMaterial color={ROCK} roughness={1} />
         </mesh>
         <mesh position={[-0.72, 3.75, HATCH_Z - 0.09]}>
            <boxGeometry args={[6.2, 1.7, 0.22]} />
            <meshStandardMaterial color={ROCK} roughness={1} />
         </mesh>
         {/* wall trim line along the top */}
         <mesh position={[-0.72, 2.92, HATCH_Z - 0.07]}>
            <boxGeometry args={[4.97, 0.08, 0.18]} />
            <meshStandardMaterial color={TRIM} roughness={0.85} />
         </mesh>
         {/* the counter under the wheel */}
         <mesh position={[-2, COUNTER_TOP / 2, 0.05]}>
            <boxGeometry args={[2.1, COUNTER_TOP, 1.05]} />
            <meshStandardMaterial color={COUNTER} roughness={0.7} />
         </mesh>
         {/* the stove drum under the cauldron */}
         <mesh position={[0, COUNTER_TOP / 2, -0.1]}>
            <cylinderGeometry args={[0.58, 0.62, COUNTER_TOP, 22]} />
            <meshStandardMaterial color={STOVE} roughness={0.8} />
         </mesh>
         {/* the fire glow in the stove's mouth (the warm key from the stove side) */}
         <mesh position={[0, 0.3, 0.49]}>
            <circleGeometry args={[0.16, 16]} />
            <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={1.6} roughness={1} />
         </mesh>
         {/* the shelf over the left hatch */}
         <mesh position={[SHELF.x, SHELF.top - 0.03, SHELF.z]}>
            <boxGeometry args={[1.7, 0.06, SHELF.depth]} />
            <meshStandardMaterial color={COUNTER} roughness={0.7} />
         </mesh>
         {/* the jars, instanced, one label texture */}
         <Instanced spots={jarSpots} name="jars">
            <cylinderGeometry args={[0.07, 0.075, JAR_H, 12]} />
            <meshStandardMaterial map={jarTexture} roughness={0.5} />
         </Instanced>
         {/* mushroom decor (shared GLB, instanced; primitive spots while it is missing) */}
         <InstancedModel
            asset={ASSETS.mushroom}
            spots={mushroomSpots}
            fallback={
               <Instanced
                  spots={mushroomSpots}
                  name="mushroom-standins"
               >
                  <sphereGeometry args={[0.2, 12, 10]} />
                  <meshStandardMaterial color="#dc2626" roughness={0.6} />
               </Instanced>
            }
         />
      </group>
   );
}
