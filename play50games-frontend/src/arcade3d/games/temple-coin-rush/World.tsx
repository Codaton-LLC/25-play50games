"use client";

// The collapsing temple round the run (no collision): the sky dome, the sandstone floor (a tiled canvas
// texture with the jade lane lines; one plane that travels with the hero), the side walls (carved
// sandstone blocks with a jade band and moss, a textured slab per side that travels too, with a cap
// ledge), the stone braziers burning on the wall tops (m2StoneBrazier), the jungle canopy beyond the
// walls (code-built, grey at the start: the World 3 restore paints it green as the gates are cleared),
// and the step pyramids and temple towers rising out of it (m2StepPyramidBg, m2TempleTowerBg). Everything
// is recycled round the view's z, so level 5's arena runs on for as long as Coilstone is up.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, IcosahedronGeometry, MeshStandardMaterial, Object3D, RepeatWrapping, ShaderMaterial, type InstancedMesh, type Mesh } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { useQuality } from "@/arcade3d/core/quality";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE } from "./assets";
import { LANES, LANE_W, laneX } from "./temples";
import { LOOKS } from "./look";
import type { Course } from "./rules";

const DUMMY = new Object3D();
/** The floor's texture repeats every TILE m along the hall. */
const TILE = 6;
const FLOOR_AHEAD = 190;
const FLOOR_BEHIND = 40;
/** the walls' texture repeats every WALL_TILE m */
const WALL_TILE = 8;
export const WALL_H = 4.5;
/** the braziers, canopy and background are drawn this far ahead / behind the view */
const DECOR_AHEAD = 130;
const DECOR_BEHIND = 20;
const BRAZIER_STEP = 18;
const CANOPY_STEP = 7;
const BG_STEP = 70;

function skyMaterial(top: string, bottom: string, glow: string): ShaderMaterial {
   return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new Color(top) }, bottom: { value: new Color(bottom) }, glow: { value: new Color(glow) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
         "uniform vec3 top; uniform vec3 bottom; uniform vec3 glow; varying vec3 vP; void main(){ float k = smoothstep(-0.05, 0.6, vP.y); vec3 c = mix(bottom, top, k); float h = pow(max(0.0, 1.0 - abs(vP.y - 0.06) * 5.0), 3.0); c += glow * h * 0.3; gl_FragColor = vec4(c, 1.0); }",
   });
}

/** The colour that has come back (0 grey .. 1 full green): the World 3 restore, set by the Scene each frame. */
export interface RestoreRef {
   amount: number;
}

export default function World({ course, view, restore, offsetX = 0, outer = true, canopy: drawCanopy = true }: { course: Course; view: { z: number }; restore?: RestoreRef; offsetX?: number; outer?: boolean; canopy?: boolean }) {
   const quality = useQuality();
   const look = LOOKS[course.level];
   const half = course.half;
   const width = half * 2 + 0.2;
   const drawFloor = useMemo(
      () => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
         // sandstone flags with dark joints, a worn runner down each lane, jade-inlaid lane lines
         ctx.fillStyle = look.floor;
         ctx.fillRect(0, 0, w, h);
         const px = w / width;
         const rows = 4;
         for (let r = 0; r < rows; r++) {
            const off = r % 2 ? px * 0.6 : 0;
            for (let cx = -px; cx < w; cx += px * 1.2) {
               const shade = ((r * 7 + Math.floor(cx / (px * 1.2)) * 3) % 5) / 36;
               ctx.fillStyle = `rgba(40,25,10,${0.08 + shade})`;
               ctx.fillRect(cx + off + 2, (r * h) / rows + 2, px * 1.2 - 4, h / rows - 4);
               ctx.fillStyle = "rgba(255,240,210,0.05)";
               ctx.fillRect(cx + off + 4, (r * h) / rows + 4, px * 1.2 - 8, 3);
            }
         }
         for (let l = 0; l < LANES; l++) {
            const x = (laneX(l) + half) * px;
            ctx.fillStyle = "rgba(255,230,180,0.07)";
            ctx.fillRect(x - px * 0.5, 0, px, h);
         }
         ctx.strokeStyle = look.floorLine;
         ctx.globalAlpha = 0.6;
         ctx.lineWidth = Math.max(2, px * 0.06);
         for (let l = 0; l <= LANES; l++) {
            const x = (laneX(l) - LANE_W / 2 + half) * px;
            ctx.setLineDash([h / 10, h / 14]);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
         }
         ctx.globalAlpha = 1;
      },
      [look, half, width],
   );
   const drawWall = useMemo(
      () => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
         // carved sandstone courses, a jade band with glyph notches, moss in the joints near the foot
         ctx.fillStyle = look.stone;
         ctx.fillRect(0, 0, w, h);
         const rows = 6;
         const rh = h / rows;
         for (let r = 0; r < rows; r++) {
            const bw = w / (r % 3 === 1 ? 3 : 4);
            const off = r % 2 ? bw / 2 : 0;
            for (let x = -bw; x < w; x += bw) {
               const k = ((r * 5 + Math.round(x / bw) * 7) % 6) / 30;
               ctx.fillStyle = `rgba(30,20,10,${0.1 + k})`;
               ctx.fillRect(x + off + 3, r * rh + 3, bw - 6, rh - 6);
               ctx.fillStyle = "rgba(255,245,220,0.08)";
               ctx.fillRect(x + off + 5, r * rh + 5, bw - 10, 4);
            }
         }
         // the jade band (row 2 from the top) and its glyphs
         const by = rh * 1.15;
         ctx.fillStyle = look.jade;
         ctx.fillRect(0, by, w, rh * 0.45);
         ctx.fillStyle = "rgba(0,0,0,0.28)";
         for (let x = w / 16; x < w; x += w / 8) {
            ctx.fillRect(x - 6, by + rh * 0.1, 12, rh * 0.25);
            ctx.fillRect(x - 14, by + rh * 0.18, 28, 5);
         }
         // moss at the foot
         ctx.fillStyle = look.moss;
         for (let x = 0; x < w; x += 9) {
            const mh = 8 + ((x * 13) % 23);
            ctx.globalAlpha = 0.55;
            ctx.fillRect(x, h - mh, 7, mh);
         }
         ctx.globalAlpha = 1;
      },
      [look],
   );
   const floorTex = useCanvasTexture(512, 256, drawFloor);
   const wallTex = useCanvasTexture(512, 256, drawWall);
   useEffect(() => {
      floorTex.wrapS = RepeatWrapping;
      floorTex.wrapT = RepeatWrapping;
      floorTex.repeat.set(1, (FLOOR_AHEAD + FLOOR_BEHIND) / TILE);
      floorTex.needsUpdate = true;
      wallTex.wrapS = RepeatWrapping;
      wallTex.wrapT = RepeatWrapping;
      wallTex.repeat.set((FLOOR_AHEAD + FLOOR_BEHIND) / WALL_TILE, 1);
      wallTex.needsUpdate = true;
   }, [floorTex, wallTex]);
   const skyMat = useMemo(() => skyMaterial(look.skyTop, look.skyBottom, look.glow), [look]);
   useEffect(() => () => skyMat.dispose(), [skyMat]);
   const canopyGeo = useMemo(() => new IcosahedronGeometry(1, 1), []);
   const canopyMat = useMemo(() => new MeshStandardMaterial({ color: look.canopyGrey, roughness: 0.95, flatShading: true }), [look]);
   useEffect(
      () => () => {
         canopyGeo.dispose();
         canopyMat.dispose();
      },
      [canopyGeo, canopyMat],
   );
   const greyC = useMemo(() => new Color(look.canopyGrey), [look]);
   const greenC = useMemo(() => new Color(look.canopy), [look]);
   const floor = useRef<Mesh>(null);
   const skyMesh = useRef<Mesh>(null);
   const walls = useRef<Mesh[]>([]);
   const caps = useRef<Mesh[]>([]);
   const canopy = useRef<InstancedMesh>(null);
   const canopyRows = quality.decor < 0.7 ? 1 : 2;
   const canopyCount = Math.ceil((DECOR_AHEAD + DECOR_BEHIND) / CANOPY_STEP) * 2 * canopyRows;
   useFrame(() => {
      const z = Math.round(view.z / TILE) * TILE;
      const len = FLOOR_AHEAD + FLOOR_BEHIND;
      floor.current?.position.set(offsetX, 0, z - FLOOR_AHEAD + len / 2);
      skyMesh.current?.position.set(offsetX, 0, view.z);
      const wz = Math.round(view.z / WALL_TILE) * WALL_TILE - FLOOR_AHEAD + len / 2;
      for (let s = 0; s < 2; s++) {
         const side = s === 0 ? -1 : 1;
         walls.current[s]?.position.set(offsetX + side * (half + 0.3), WALL_H / 2, wz);
         caps.current[s]?.position.set(offsetX + side * (half + 0.35), WALL_H + 0.18, wz);
      }
      // the canopy: grey moss and leaves turning green as the colour comes back
      const k = restore ? restore.amount : 1;
      canopyMat.color.copy(greyC).lerp(greenC, k);
      const inst = canopy.current;
      if (inst) {
         const base = Math.floor((view.z + DECOR_BEHIND) / CANOPY_STEP) * CANOPY_STEP;
         for (let i = 0; i < canopyCount; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const j = Math.floor(i / 2);
            const row = j % canopyRows;
            const kz = Math.floor(j / canopyRows);
            const cz = base - kz * CANOPY_STEP;
            const h = Math.abs(Math.sin(cz * 0.37 + side + row * 2.1));
            const r = 2.6 + h * 1.6 + row * 0.8;
            DUMMY.position.set(offsetX + side * (half + 3.5 + row * 4.5 + h * 1.5), 2.6 + h * 2.2 + row * 1.2, cz + (row ? CANOPY_STEP / 2 : 0));
            DUMMY.rotation.set(h, cz * 0.1, 0);
            DUMMY.scale.set(r, r * 0.8, r);
            DUMMY.updateMatrix();
            inst.setMatrixAt(i, DUMMY.matrix);
         }
         inst.instanceMatrix.needsUpdate = true;
      }
   });

   const braziers = Math.ceil((DECOR_AHEAD + DECOR_BEHIND) / BRAZIER_STEP) * 2;
   const brazierS = 1.0 / GLB_SIZE.brazier.x;
   const bgCount = quality.decor < 0.7 ? 4 : 8;

   return (
      <>
         {outer ? (
            <mesh ref={skyMesh} material={skyMat} renderOrder={-1}>
               <sphereGeometry args={[170, 40, 20]} />
            </mesh>
         ) : null}
         <mesh ref={floor} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[width, FLOOR_AHEAD + FLOOR_BEHIND]} />
            <meshStandardMaterial map={floorTex} roughness={0.75} metalness={0.02} />
         </mesh>
         {outer ? (
            <mesh rotation-x={-Math.PI / 2} position={[offsetX, -0.05, 0]}>
               <planeGeometry args={[width + 200, 8000]} />
               <meshStandardMaterial color={look.ground} roughness={0.95} />
            </mesh>
         ) : null}
         {[0, 1].map((s) => (
            <group key={s}>
               <mesh
                  ref={(m) => {
                     if (m) walls.current[s] = m;
                  }}
                  rotation-y={s === 0 ? Math.PI / 2 : -Math.PI / 2}
               >
                  <planeGeometry args={[FLOOR_AHEAD + FLOOR_BEHIND, WALL_H]} />
                  <meshStandardMaterial map={wallTex} roughness={0.85} />
               </mesh>
               <mesh
                  ref={(m) => {
                     if (m) caps.current[s] = m;
                  }}
               >
                  <boxGeometry args={[0.9, 0.36, FLOOR_AHEAD + FLOOR_BEHIND]} />
                  <meshStandardMaterial color={look.trim} roughness={0.7} />
               </mesh>
            </group>
         ))}
         {outer && drawCanopy ? <instancedMesh ref={canopy} args={[canopyGeo, canopyMat, canopyCount]} frustumCulled={false} /> : null}
         <DynamicInstancedModel
            asset={ASSETS.brazier}
            count={braziers}
            update={(i, m) => {
               const side = i % 2 === 0 ? -1 : 1;
               const k = Math.floor(i / 2);
               const base = Math.floor((view.z + DECOR_BEHIND) / BRAZIER_STEP) * BRAZIER_STEP;
               const z = base - k * BRAZIER_STEP + (side > 0 ? BRAZIER_STEP / 2 : 0);
               DUMMY.position.set(offsetX + side * (half + 0.35), WALL_H + 0.36, z);
               DUMMY.rotation.set(0, 0, 0);
               DUMMY.scale.setScalar(brazierS);
               DUMMY.updateMatrix();
               m.copy(DUMMY.matrix);
            }}
         />
         <BrazierFlames view={view} half={half} offsetX={offsetX} count={braziers} color={look.flame} />
         {outer ? (
            <>
               <DynamicInstancedModel
                  asset={ASSETS.pyramid}
                  count={bgCount}
                  update={(i, m) => {
                     const side = i % 2 === 0 ? -1 : 1;
                     const k = Math.floor(i / 2);
                     const base = Math.floor((view.z + 40) / BG_STEP) * BG_STEP;
                     const z = base - k * BG_STEP - (side > 0 ? BG_STEP / 2 : 0);
                     const s = 34 / GLB_SIZE.pyramid.x;
                     DUMMY.position.set(offsetX + side * (half + 42 + (k % 2) * 18), -1, z);
                     DUMMY.rotation.set(0, k * 0.7, 0);
                     DUMMY.scale.set(s, s * 0.9, s);
                     DUMMY.updateMatrix();
                     m.copy(DUMMY.matrix);
                  }}
               />
               <DynamicInstancedModel
                  asset={ASSETS.tower}
                  count={bgCount}
                  update={(i, m) => {
                     const side = i % 2 === 0 ? 1 : -1;
                     const k = Math.floor(i / 2);
                     const base = Math.floor((view.z + 40) / BG_STEP) * BG_STEP;
                     const z = base - k * BG_STEP - (side > 0 ? 0 : BG_STEP / 2) - 20;
                     const s = 16 / GLB_SIZE.tower.y;
                     DUMMY.position.set(offsetX + side * (half + 24 + (k % 3) * 6), 0, z);
                     DUMMY.rotation.set(0, (side * Math.PI) / 2 + k, 0);
                     DUMMY.scale.setScalar(s);
                     DUMMY.updateMatrix();
                     m.copy(DUMMY.matrix);
                  }}
               />
            </>
         ) : null}
      </>
   );
}

/** The braziers' fires: a flickering emissive cone in each bowl (code: a moving, glowing part). */
function BrazierFlames({ view, half, offsetX, count, color }: { view: { z: number }; half: number; offsetX: number; count: number; color: string }) {
   const ref = useRef<InstancedMesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const inst = ref.current;
      if (!inst) return;
      const t = time.now;
      const base = Math.floor((view.z + DECOR_BEHIND) / BRAZIER_STEP) * BRAZIER_STEP;
      for (let i = 0; i < count; i++) {
         const side = i % 2 === 0 ? -1 : 1;
         const k = Math.floor(i / 2);
         const z = base - k * BRAZIER_STEP + (side > 0 ? BRAZIER_STEP / 2 : 0);
         const f = 0.85 + Math.sin(t * 11 + i * 1.7) * 0.12 + Math.sin(t * 17 + i) * 0.06;
         DUMMY.position.set(offsetX + side * (half + 0.35), WALL_H + 0.36 + 0.5 + 0.28 * f, z);
         DUMMY.rotation.set(0, t * 2 + i, 0);
         DUMMY.scale.set(0.32, 0.6 * f, 0.32);
         DUMMY.updateMatrix();
         inst.setMatrixAt(i, DUMMY.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
         <coneGeometry args={[1, 1, 7]} />
         <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
      </instancedMesh>
   );
}
