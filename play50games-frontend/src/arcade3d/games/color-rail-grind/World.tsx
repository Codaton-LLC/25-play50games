"use client";

// The workshop's snowy valley round the line (no collision): the sky dome, the snowfield under the rails
// (a canvas texture with drifts and sleeper shadows; one plane that travels with the hero), the snow
// pines in rows beyond the grid (m2SnowPine), the village cabins (m2SnowCabinBg), the elevated rail
// viaducts far off (m2ElevatedRailBg), and the rail lanterns on their posts: grey ahead of the hero,
// relit gold behind it (the World 4 restore). Everything is recycled round the view's z, so level 5's
// arena runs on for as long as the Express is up.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, BoxGeometry, Color, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D, RepeatWrapping, ShaderMaterial, SphereGeometry, type InstancedMesh, type Mesh } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS, GLB_SIZE, RAIL_LIFT } from "./assets";
import { HALF } from "./network";
import { LOOKS } from "./look";
import type { Course } from "./rules";

const DUMMY = new Object3D();
const TILE = 8;
const FLOOR_AHEAD = 200;
const FLOOR_BEHIND = 40;
const DECOR_AHEAD = 150;
const DECOR_BEHIND = 25;
const PINE_STEP = 9;
const LAMP_STEP = 16;
const CABIN_STEP = 60;
const VIADUCT_STEP = 44;

function skyMaterial(top: string, bottom: string, glow: string): ShaderMaterial {
   return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new Color(top) }, bottom: { value: new Color(bottom) }, glow: { value: new Color(glow) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
         "uniform vec3 top; uniform vec3 bottom; uniform vec3 glow; varying vec3 vP; void main(){ float k = smoothstep(-0.05, 0.6, vP.y); vec3 c = mix(bottom, top, k); float h = pow(max(0.0, 1.0 - abs(vP.y - 0.05) * 5.0), 3.0); c += glow * h * 0.25; gl_FragColor = vec4(c, 1.0); }",
   });
}

export default function World({ course, view, offsetX = 0, outer = true }: { course: Course; view: { z: number }; offsetX?: number; outer?: boolean }) {
   const quality = useQuality();
   const look = LOOKS[course.level];
   const width = HALF * 2 + 24;
   const drawSnow = useMemo(
      () => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
         ctx.fillStyle = look.snow;
         ctx.fillRect(0, 0, w, h);
         // soft drifts and a few sparkles
         for (let i = 0; i < 70; i++) {
            const x = (i * 97) % w;
            const y = (i * 53) % h;
            const r = 10 + ((i * 31) % 26);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, look.snowShade);
            g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
         }
         ctx.globalAlpha = 0.9;
         ctx.fillStyle = "#ffffff";
         for (let i = 0; i < 120; i++) ctx.fillRect((i * 151) % w, (i * 89) % h, 2, 2);
         ctx.globalAlpha = 1;
      },
      [look],
   );
   const snowTex = useCanvasTexture(256, 256, drawSnow);
   useEffect(() => {
      snowTex.wrapS = RepeatWrapping;
      snowTex.wrapT = RepeatWrapping;
      snowTex.repeat.set(width / TILE, (FLOOR_AHEAD + FLOOR_BEHIND) / TILE);
      snowTex.needsUpdate = true;
   }, [snowTex, width]);
   const skyMat = useMemo(() => skyMaterial(look.skyTop, look.skyBottom, look.glow), [look]);
   useEffect(() => () => skyMat.dispose(), [skyMat]);
   const floor = useRef<Mesh>(null);
   const skyMesh = useRef<Mesh>(null);
   useFrame(() => {
      const z = Math.round(view.z / TILE) * TILE;
      floor.current?.position.set(offsetX, -RAIL_LIFT, z - FLOOR_AHEAD + (FLOOR_AHEAD + FLOOR_BEHIND) / 2);
      skyMesh.current?.position.set(offsetX, 0, view.z);
   });

   const pineRows = quality.decor < 0.7 ? 1 : 2;
   const pines = Math.ceil((DECOR_AHEAD + DECOR_BEHIND) / PINE_STEP) * 2 * pineRows;
   const lamps = Math.ceil((DECOR_AHEAD + DECOR_BEHIND) / LAMP_STEP) * 2;
   const pineS = 6 / GLB_SIZE.pine.y;

   return (
      <>
         {outer ? (
            <mesh ref={skyMesh} material={skyMat} renderOrder={-1}>
               <sphereGeometry args={[170, 40, 20]} />
            </mesh>
         ) : null}
         <mesh ref={floor} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[width, FLOOR_AHEAD + FLOOR_BEHIND]} />
            <meshStandardMaterial map={snowTex} roughness={0.9} />
         </mesh>
         {outer ? (
            <mesh rotation-x={-Math.PI / 2} position={[offsetX, -RAIL_LIFT - 0.05, 0]}>
               <planeGeometry args={[width + 300, 8000]} />
               <meshStandardMaterial color={look.snowShade} roughness={1} />
            </mesh>
         ) : null}
         <DynamicInstancedModel
            asset={ASSETS.pine}
            count={pines}
            update={(i, m) => {
               const side = i % 2 === 0 ? -1 : 1;
               const j = Math.floor(i / 2);
               const row = j % pineRows;
               const k = Math.floor(j / pineRows);
               const base = Math.floor((view.z + DECOR_BEHIND) / PINE_STEP) * PINE_STEP;
               const z = base - k * PINE_STEP + (row ? PINE_STEP / 2 : 0);
               const h = Math.abs(Math.sin(z * 0.31 + side * 1.7 + row));
               const s = pineS * (0.8 + h * 0.5);
               DUMMY.position.set(offsetX + side * (HALF + 5 + row * 7 + h * 3), -RAIL_LIFT, z);
               DUMMY.rotation.set(0, z * 0.7, 0);
               DUMMY.scale.setScalar(s);
               DUMMY.updateMatrix();
               m.copy(DUMMY.matrix);
            }}
         />
         {outer ? (
            <>
               <DynamicInstancedModel
                  asset={ASSETS.cabin}
                  count={6}
                  update={(i, m) => {
                     const side = i % 2 === 0 ? 1 : -1;
                     const k = Math.floor(i / 2);
                     const base = Math.floor((view.z + 40) / CABIN_STEP) * CABIN_STEP;
                     const z = base - k * CABIN_STEP - (side > 0 ? 0 : CABIN_STEP / 2);
                     const s = 9 / GLB_SIZE.cabin.x;
                     DUMMY.position.set(offsetX + side * (HALF + 26 + (k % 2) * 8), -RAIL_LIFT, z);
                     DUMMY.rotation.set(0, (-side * Math.PI) / 2 + k * 0.3, 0);
                     DUMMY.scale.setScalar(s);
                     DUMMY.updateMatrix();
                     m.copy(DUMMY.matrix);
                  }}
               />
               <DynamicInstancedModel
                  asset={ASSETS.viaduct}
                  count={quality.decor < 0.7 ? 3 : 6}
                  update={(i, m) => {
                     const base = Math.floor((view.z + 40) / VIADUCT_STEP) * VIADUCT_STEP;
                     const z = base - i * VIADUCT_STEP;
                     const s = 16 / GLB_SIZE.viaduct.y;
                     DUMMY.position.set(offsetX - (HALF + 46), -RAIL_LIFT, z);
                     DUMMY.rotation.set(0, 0, 0);
                     DUMMY.scale.set(s, s, VIADUCT_STEP / GLB_SIZE.viaduct.z);
                     DUMMY.updateMatrix();
                     m.copy(DUMMY.matrix);
                  }}
               />
            </>
         ) : null}
         <Lamps view={view} offsetX={offsetX} count={lamps} off={look.lampOff} on={look.lampOn} />
      </>
   );
}

/** The rail lanterns beside the grid: grey ahead of the hero, relit gold behind it (and warmer the nearer). */
function Lamps({ view, offsetX, count, off, on }: { view: { z: number }; offsetX: number; count: number; off: string; on: string }) {
   const posts = useRef<InstancedMesh>(null);
   const heads = useRef<InstancedMesh>(null);
   const postGeo = useMemo(() => new CylinderGeometry(0.07, 0.09, 1, 6), []);
   const headGeo = useMemo(() => new SphereGeometry(0.22, 10, 8), []);
   const capGeo = useMemo(() => new BoxGeometry(0.4, 0.08, 0.4), []);
   const postMat = useMemo(() => new MeshStandardMaterial({ color: "#3f3a36", roughness: 0.6, metalness: 0.5 }), []);
   const headMat = useMemo(() => new MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
   useEffect(
      () => () => {
         postGeo.dispose();
         headGeo.dispose();
         capGeo.dispose();
         postMat.dispose();
         headMat.dispose();
      },
      [postGeo, headGeo, capGeo, postMat, headMat],
   );
   const cOff = useMemo(() => new Color(off), [off]);
   const cOn = useMemo(() => new Color(on), [on]);
   const tmp = useMemo(() => new Color(), []);
   useFrame(() => {
      const p = posts.current;
      const hd = heads.current;
      if (!p || !hd) return;
      const base = Math.floor((view.z + DECOR_BEHIND) / LAMP_STEP) * LAMP_STEP;
      for (let i = 0; i < count; i++) {
         const side = i % 2 === 0 ? -1 : 1;
         const k = Math.floor(i / 2);
         const z = base - k * LAMP_STEP + (side > 0 ? LAMP_STEP / 2 : 0);
         const x = offsetX + side * (HALF - 0.2);
         DUMMY.position.set(x, -RAIL_LIFT + 1.6, z);
         DUMMY.rotation.set(0, 0, 0);
         DUMMY.scale.set(1, 3.2, 1);
         DUMMY.updateMatrix();
         p.setMatrixAt(i, DUMMY.matrix);
         DUMMY.position.set(x, -RAIL_LIFT + 3.35, z);
         DUMMY.scale.setScalar(1);
         DUMMY.updateMatrix();
         hd.setMatrixAt(i, DUMMY.matrix);
         // relit behind the hero: gold, fading in over the 4 m it has just passed
         const k2 = Math.max(0, Math.min(1, (z - view.z) / 4));
         tmp.copy(cOff).lerp(cOn, k2);
         hd.setColorAt(i, tmp);
      }
      p.instanceMatrix.needsUpdate = true;
      hd.instanceMatrix.needsUpdate = true;
      if (hd.instanceColor) hd.instanceColor.needsUpdate = true;
   });
   return (
      <>
         <instancedMesh ref={posts} args={[postGeo, postMat, count]} frustumCulled={false} />
         <instancedMesh ref={heads} args={[headGeo, headMat, count]} frustumCulled={false} />
      </>
   );
}
