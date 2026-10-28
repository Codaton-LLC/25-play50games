"use client";

// The Hall of Doors round the run (no collision): the ember sky dome, the hall's stone floor (a tiled
// canvas texture with the lane lines, one plane that travels with the hero), the side walls (the stone
// slabs m2ArchWallV2 in a row, opened where Riko's side corridors run), the galleries beyond them (the
// stone arcade m2ArchCorridorBgV2, high and far), lanterns on the walls (m2MineLanternPost) and the
// side corridors' own floor and outer wall. Everything is recycled round the view's z, so level 5's
// arena runs on for as long as Flicker is up.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, Object3D, RepeatWrapping, ShaderMaterial, type Mesh } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS, GLB_SIZE, SLAB } from "./assets";
import { LANE_W, laneX } from "./halls";
import { LOOKS } from "./look";
import type { Course } from "./rules";

const DUMMY = new Object3D();
/** The floor's texture repeats every TILE m along the hall. */
const TILE = 6;
const FLOOR_AHEAD = 190;
const FLOOR_BEHIND = 40;
/** the side walls, lanterns and galleries are drawn this far ahead / behind the view */
const WALL_AHEAD = 120;
const WALL_BEHIND = 20;

function skyMaterial(top: string, bottom: string): ShaderMaterial {
   return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new Color(top) }, bottom: { value: new Color(bottom) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
         "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float k = smoothstep(-0.05, 0.55, vP.y); vec3 c = mix(bottom, top, k); float glow = pow(max(0.0, 1.0 - abs(vP.y - 0.04) * 6.0), 3.0); c += vec3(1.0,0.45,0.15) * glow * 0.35; gl_FragColor = vec4(c, 1.0); }",
   });
}

/** Is z inside one of the course's side corridors (the hall's wall is open there)? */
function inSide(course: Course, side: number, z: number): boolean {
   for (const s of course.sides) if (s.side === side && z <= s.z0 + 2 && z >= s.z1 - 2) return true;
   return false;
}

export default function World({ course, view, offsetX = 0, outer = true }: { course: Course; view: { z: number }; offsetX?: number; outer?: boolean }) {
   const quality = useQuality();
   const look = LOOKS[course.level];
   const lanes = course.lanes;
   const half = course.half;
   const width = half * 2 + 0.2;
   const drawFloor = useMemo(
      () => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
         // stone flags, a darker joint grid, the lane lines and a warm runner down each lane
         ctx.fillStyle = look.floor;
         ctx.fillRect(0, 0, w, h);
         const px = w / width;
         const rows = 4;
         for (let r = 0; r < rows; r++) {
            for (let cx = 0; cx < w; cx += px * 1.2) {
               const shade = ((r * 7 + Math.floor(cx / (px * 1.2)) * 3) % 5) / 40;
               ctx.fillStyle = `rgba(0,0,0,${0.06 + shade})`;
               ctx.fillRect(cx + 2, (r * h) / rows + 2, px * 1.2 - 4, h / rows - 4);
            }
         }
         for (let l = 0; l < lanes; l++) {
            const x = (laneX(l, lanes) + half) * px;
            ctx.fillStyle = "rgba(127,29,29,0.28)";
            ctx.fillRect(x - px * 0.55, 0, px * 1.1, h);
         }
         ctx.strokeStyle = look.floorLine;
         ctx.globalAlpha = 0.55;
         ctx.lineWidth = Math.max(2, px * 0.05);
         for (let l = 0; l <= lanes; l++) {
            const x = (laneX(l, lanes) - LANE_W / 2 + half) * px;
            ctx.setLineDash([h / 8, h / 8]);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
         }
         ctx.globalAlpha = 1;
      },
      [look, lanes, half, width],
   );
   const floorTex = useCanvasTexture(512, 256, drawFloor);
   useEffect(() => {
      floorTex.wrapS = RepeatWrapping;
      floorTex.wrapT = RepeatWrapping;
      floorTex.repeat.set(1, (FLOOR_AHEAD + FLOOR_BEHIND) / TILE);
      floorTex.needsUpdate = true;
   }, [floorTex]);
   const skyMat = useMemo(() => skyMaterial(look.skyTop, look.skyBottom), [look]);
   useEffect(() => () => skyMat.dispose(), [skyMat]);
   const floor = useRef<Mesh>(null);
   const skyMesh = useRef<Mesh>(null);
   const sideFloor = useRef<Mesh>(null);
   useFrame(() => {
      const z = Math.round(view.z / TILE) * TILE;
      const len = FLOOR_AHEAD + FLOOR_BEHIND;
      floor.current?.position.set(offsetX, 0, z - FLOOR_AHEAD + len / 2);
      skyMesh.current?.position.set(offsetX, 0, view.z);
   });

   // the side walls: a slab every SLAB.w m on both sides, recycled round the view
   const slabSx = SLAB.w / GLB_SIZE.archWall.x;
   const slabSy = SLAB.h / GLB_SIZE.archWall.y;
   const slabCount = Math.ceil((WALL_AHEAD + WALL_BEHIND) / SLAB.w) * 2;
   const lanternStep = 20;
   const lanternCount = Math.ceil((WALL_AHEAD + WALL_BEHIND) / lanternStep) * 2;
   const arcadeLen = 24;
   const arcadeCount = quality.decor < 0.7 ? 0 : Math.ceil((WALL_AHEAD + WALL_BEHIND + 40) / arcadeLen) * 2;
   const arcadeS = arcadeLen / GLB_SIZE.arcade.x;

   return (
      <>
         {outer ? (
            <mesh ref={skyMesh} material={skyMat} renderOrder={-1}>
               <sphereGeometry args={[400, 24, 12]} />
            </mesh>
         ) : null}
         <mesh ref={floor} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[width, FLOOR_AHEAD + FLOOR_BEHIND]} />
            <meshStandardMaterial map={floorTex} roughness={0.55} metalness={0.05} />
         </mesh>
         {/* the outside: a dark plaza beyond the walls so no void shows under the galleries */}
         {outer ? (
            <mesh rotation-x={-Math.PI / 2} position={[offsetX, -0.05, 0]} ref={sideFloor}>
               <planeGeometry args={[width + 160, 8000]} />
               <meshStandardMaterial color={look.floor} roughness={0.9} />
            </mesh>
         ) : null}
         <DynamicInstancedModel
            asset={ASSETS.archWall}
            count={slabCount}
            update={(i, m) => {
               const side = i % 2 === 0 ? -1 : 1;
               const k = Math.floor(i / 2);
               const base = Math.floor((view.z + WALL_BEHIND) / SLAB.w) * SLAB.w;
               const z = base - k * SLAB.w;
               if (inSide(course, side, z)) return false;
               DUMMY.position.set(offsetX + side * (half + 0.1), 0, z);
               DUMMY.rotation.set(0, (side * Math.PI) / 2, 0);
               DUMMY.scale.set(slabSx * 1.04, slabSy, 2.4);
               DUMMY.updateMatrix();
               m.copy(DUMMY.matrix);
            }}
         />
         {/* the side corridors' outer walls (beyond the passage) */}
         {course.sides.length > 0 ? (
            <DynamicInstancedModel
               asset={ASSETS.archWall}
               count={Math.ceil((WALL_AHEAD + WALL_BEHIND) / SLAB.w)}
               update={(i, m) => {
                  const base = Math.floor((view.z + WALL_BEHIND) / SLAB.w) * SLAB.w;
                  const z = base - i * SLAB.w;
                  const s = course.sides.find((q) => z <= q.z0 + 2 && z >= q.z1 - 2);
                  if (!s) return false;
                  DUMMY.position.set(offsetX + s.x + s.side * 1.6, 0, z);
                  DUMMY.rotation.set(0, (s.side * Math.PI) / 2, 0);
                  DUMMY.scale.set(slabSx * 1.04, slabSy * 0.8, 2.4);
                  DUMMY.updateMatrix();
                  m.copy(DUMMY.matrix);
               }}
            />
         ) : null}
         <DynamicInstancedModel
            asset={ASSETS.lantern}
            count={lanternCount}
            update={(i, m) => {
               const side = i % 2 === 0 ? -1 : 1;
               const k = Math.floor(i / 2);
               const base = Math.floor((view.z + WALL_BEHIND) / lanternStep) * lanternStep;
               const z = base - k * lanternStep + (side > 0 ? lanternStep / 2 : 0);
               if (inSide(course, side, z)) return false;
               const s = 0.75 / GLB_SIZE.lantern.y;
               DUMMY.position.set(offsetX + side * (half - 0.25), 2.5, z);
               DUMMY.rotation.set(0, (-side * Math.PI) / 2, 0);
               DUMMY.scale.setScalar(s);
               DUMMY.updateMatrix();
               m.copy(DUMMY.matrix);
            }}
         />
         {arcadeCount > 0 ? (
            <DynamicInstancedModel
               asset={ASSETS.arcade}
               count={arcadeCount}
               update={(i, m) => {
                  const side = i % 2 === 0 ? -1 : 1;
                  const k = Math.floor(i / 2);
                  const base = Math.floor((view.z + WALL_BEHIND + 40) / arcadeLen) * arcadeLen;
                  const z = base - k * arcadeLen;
                  DUMMY.position.set(offsetX + side * (half + 9), 0, z);
                  DUMMY.rotation.set(0, (side * Math.PI) / 2, 0);
                  DUMMY.scale.set(arcadeS, arcadeS * 1.25, arcadeS * 0.9);
                  DUMMY.updateMatrix();
                  m.copy(DUMMY.matrix);
               }}
            />
         ) : null}
      </>
   );
}
