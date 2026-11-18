"use client";

// The world round the tunnel (no collision): a storm sky that travels with the camera (it brightens with
// the storm's lightning), the wind tube's great rings framing each room (m2WindTubeBg), fan towers
// standing outside the walls (m2WindFanTower), and the lights. Levels 4 and 5 turn to storm dusk. The
// playable tunnel is Course.tsx.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, ShaderMaterial, type Group, type PointLight } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { createRng } from "@/arcade3d/core/math";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, DUSK, isDusk, lightningFlash } from "./look";
import type { Course } from "./rules";

const SKY_VERT = /* glsl */ `
   varying vec3 vPos;
   void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }
`;
const SKY_FRAG = /* glsl */ `
   varying vec3 vPos;
   uniform vec3 uTop;
   uniform vec3 uMid;
   uniform vec3 uBottom;
   uniform float uFlash;
   uniform float uTime;
   void main() {
      vec3 d = normalize(vPos);
      float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uBottom, uMid, smoothstep(0.1, 0.5, h));
      c = mix(c, uTop, smoothstep(0.5, 1.0, h));
      // slow storm bands across the upper sky
      float bands = sin(d.x * 7.0 + d.z * 3.0 + uTime * 0.05) * sin(d.z * 5.0 - uTime * 0.07);
      c += vec3(0.05, 0.06, 0.1) * smoothstep(0.2, 1.0, bands) * smoothstep(0.45, 0.8, h);
      c += vec3(0.55, 0.5, 0.85) * uFlash * smoothstep(0.35, 0.9, h) * 0.35;
      gl_FragColor = vec4(c, 1.0);
   }
`;

function SkyDome({ dusk }: { dusk: boolean }) {
   const time = useGameTime();
   const ref = useRef<Group>(null);
   const material = useMemo(() => {
      const src = dusk ? DUSK : COLORS;
      return new ShaderMaterial({
         uniforms: {
            uTop: { value: new Color(src.skyTop) },
            uMid: { value: new Color(src.skyMid) },
            uBottom: { value: new Color(src.skyBottom) },
            uFlash: { value: 0 },
            uTime: { value: 0 },
         },
         vertexShader: SKY_VERT,
         fragmentShader: SKY_FRAG,
         depthWrite: false,
         toneMapped: false,
         side: BackSide,
         fog: false,
      });
   }, [dusk]);
   useEffect(() => () => material.dispose(), [material]);
   useFrame((state) => {
      if (ref.current) ref.current.position.copy(state.camera.position);
      material.uniforms.uFlash.value = lightningFlash(time.now) * (dusk ? 1 : 0.6);
      material.uniforms.uTime.value = time.now;
   });
   return (
      <group ref={ref}>
         <mesh material={material} frustumCulled={false} renderOrder={-20}>
            <sphereGeometry args={[240, 24, 16]} />
         </mesh>
      </group>
   );
}

/** A storm light that flickers with the lightning (one point light high over the camera). */
function StormLight({ dusk }: { dusk: boolean }) {
   const ref = useRef<PointLight>(null);
   const time = useGameTime();
   useFrame((state) => {
      const l = ref.current;
      if (!l) return;
      l.position.set(state.camera.position.x + 6, state.camera.position.y + 18, state.camera.position.z - 10);
      l.intensity = lightningFlash(time.now) * (dusk ? 60 : 30);
   });
   return <pointLight ref={ref} color="#d8ccff" distance={70} decay={1.2} intensity={0} />;
}

export default function World({ course, levelId }: { course: Course; levelId: number }) {
   const dusk = isDusk(levelId);
   // the tube's rings round each room, their axis along the tunnel; fan towers outside the walls
   const { rings, towers } = useMemo(() => {
      const rnd = createRng(0x77e1 + levelId);
      const r: InstanceSpot[] = [];
      const t: InstanceSpot[] = [];
      // great wind tubes running alongside the tunnel, well outside its walls (seen over them), and
      // fan towers farther out; nothing inside the playable tunnel
      let side = 1;
      for (const room of course.rooms) {
         const len = room.z0 - room.z1;
         const d = 9 + rnd() * 4;
         r.push({ x: side * (22 + rnd() * 6), y: room.floor - 9 - rnd() * 3, z: (room.z0 + room.z1) / 2, sx: Math.max(8, len) / GLB_SIZE.tube.x, sy: d / GLB_SIZE.tube.y, sz: d / GLB_SIZE.tube.z, rotY: Math.PI / 2 });
         side = -side;
         if (rnd() < 0.7) {
            const h = 16 + rnd() * 10;
            t.push({ x: -side * (30 + rnd() * 10), y: room.floor - 10, z: room.z0 - rnd() * len, scale: h / GLB_SIZE.tower.y, rotY: rnd() * 6.28 });
         }
      }
      return { rings: r, towers: t };
   }, [course, levelId]);
   return (
      <>
         <SkyDome dusk={dusk} />
         <InstancedModel asset={ASSETS.tube} spots={rings} fallback={null} />
         <InstancedModel asset={ASSETS.tower} spots={towers} fallback={null} />
         <hemisphereLight args={[dusk ? "#c9b8ff" : "#cfe6ff", dusk ? "#2a1d48" : "#25374f", dusk ? 0.75 : 0.85]} />
         <ambientLight intensity={dusk ? 0.38 : 0.4} />
         <directionalLight position={[10, 30, 14]} intensity={dusk ? 0.85 : 1.15} color={dusk ? "#e4dbff" : "#fff6e8"} />
         <StormLight dusk={dusk} />
      </>
   );
}
