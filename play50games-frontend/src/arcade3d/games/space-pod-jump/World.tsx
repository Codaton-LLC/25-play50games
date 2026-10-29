"use client";

// The void round the system (no collision): a deep violet sky dome, a starfield (it streaks at speed),
// a faint neon grid far behind the play plane, the ringed planet (m2RingedPlanetBg) and the Hollow Prism
// watching from the sky (a code-built faceted octahedron of black glass with a glowing core, the card's
// cameo). Everything follows the view, so the backdrop never runs out.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, ShaderMaterial, type Group, type Mesh } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE } from "./assets";
import { LOOKS } from "./look";
import type { Course } from "./rules";

function skyMaterial(top: string, bottom: string): ShaderMaterial {
   return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new Color(top) }, bottom: { value: new Color(bottom) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float k = smoothstep(-0.6, 0.7, vP.y); gl_FragColor = vec4(mix(bottom, top, k), 1.0); }",
   });
}

const STARS = 900;

export default function World({ course, view, speed, outer = true }: { course: Course; view: { x: number; y: number }; speed?: { v: number }; outer?: boolean }) {
   const look = LOOKS[course.level];
   const time = useGameTime();
   const skyMat = useMemo(() => skyMaterial(look.skyTop, look.skyBottom), [look]);
   useEffect(() => () => skyMat.dispose(), [skyMat]);
   const stars = useMemo(() => {
      const g = new BufferGeometry();
      const pos = new Float32Array(STARS * 3);
      let s = 1234567;
      const rnd = () => {
         s = (s * 16807) % 2147483647;
         return s / 2147483647;
      };
      for (let i = 0; i < STARS; i++) {
         pos[i * 3] = (rnd() - 0.5) * 400;
         pos[i * 3 + 1] = (rnd() - 0.5) * 260;
         pos[i * 3 + 2] = -40 - rnd() * 120;
      }
      g.setAttribute("position", new BufferAttribute(pos, 3));
      return g;
   }, []);
   const starMat = useMemo(() => new PointsMaterial({ color: look.stars, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, blending: AdditiveBlending }), [look]);
   useEffect(
      () => () => {
         stars.dispose();
         starMat.dispose();
      },
      [stars, starMat],
   );
   const drawGrid = useMemo(
      () => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
         ctx.clearRect(0, 0, w, h);
         ctx.strokeStyle = look.grid;
         ctx.lineWidth = 2;
         for (let k = 0; k <= 16; k++) {
            const x = (k / 16) * w;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            const y = (k / 16) * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
         }
         ctx.globalAlpha = 1;
      },
      [look],
   );
   const gridTex = useCanvasTexture(256, 256, drawGrid);
   const sky = useRef<Mesh>(null);
   const starPts = useRef<Points>(null);
   const grid = useRef<Mesh>(null);
   const prism = useRef<Group>(null);
   useFrame(() => {
      sky.current?.position.set(view.x, view.y, 0);
      // the stars drift a little slower than the view (parallax) and stretch at speed
      const p = starPts.current;
      if (p) {
         p.position.set(view.x * 0.7, view.y * 0.7, 0);
         starMat.size = 0.9 + Math.max(0, (speed?.v ?? 0) - 7) * 0.12;
      }
      grid.current?.position.set(Math.round(view.x / 20) * 20, view.y - 34, -70);
      const g = prism.current;
      if (g) {
         g.position.set(view.x * 0.85 + 30, view.y * 0.6 + 34, -120);
         g.rotation.set(0.3, time.now * 0.12, 0.2);
      }
   });
   return (
      <>
         {outer ? (
            <mesh ref={sky} material={skyMat} renderOrder={-1}>
               <sphereGeometry args={[180, 32, 16]} />
            </mesh>
         ) : null}
         {outer ? <points ref={starPts} geometry={stars} material={starMat} /> : null}
         {outer ? (
            <mesh ref={grid} rotation-x={-Math.PI / 2.4}>
               <planeGeometry args={[400, 200]} />
               <meshBasicMaterial map={gridTex} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
            </mesh>
         ) : null}
         {outer ? (
            <DynamicInstancedModel
               asset={ASSETS.ringed}
               count={1}
               update={(_i, m) => {
                  const s = 46 / GLB_SIZE.ringed.x;
                  m.makeRotationZ(0.35);
                  m.scale({ x: s, y: s, z: s } as never);
                  m.setPosition(view.x * 0.9 - 40, view.y * 0.6 - 10 - (GLB_SIZE.ringed.y * s) / 2, -150);
               }}
            />
         ) : null}
         {outer ? (
            <group ref={prism}>
               <mesh>
                  <octahedronGeometry args={[7, 0]} />
                  <meshStandardMaterial color="#0c0814" roughness={0.15} metalness={0.9} transparent opacity={0.85} />
               </mesh>
               <mesh>
                  <octahedronGeometry args={[2.2, 0]} />
                  <meshBasicMaterial color="#b26bff" toneMapped={false} />
               </mesh>
            </group>
         ) : null}
      </>
   );
}
