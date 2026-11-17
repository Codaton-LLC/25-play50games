"use client";

// Around the street (no collision): a smoked-grey sky dome in the level's mood, Greytown's ground beyond
// the kerbs, the Prism Fortress floating far ahead (a crystal citadel of grey glass: skyFortressGate,
// scaled up, on faceted code crystals), and the lights: a cool key light and a soft fill; at night a
// warm pool of light under every street lamp near the roller (the only place a lock shows its colour).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, CanvasTexture, SRGBColorSpace, Vector3, type Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE } from "./assets";
import { LAMP_LIGHT } from "./course";
import { COLORS, levelLook } from "./look";
import type { DashRun } from "./rules";

function skyTexture(top: string, bottom: string): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 4;
   c.height = 256;
   const g = c.getContext("2d")!;
   const grad = g.createLinearGradient(0, 0, 0, 256);
   grad.addColorStop(0, top);
   grad.addColorStop(0.62, bottom);
   grad.addColorStop(1, top);
   g.fillStyle = grad;
   g.fillRect(0, 0, 4, 256);
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

export default function World({ run }: { run: DashRun }) {
   const look = levelLook(run.level);
   const sky = useMemo(() => skyTexture(look.skyTop, look.skyBottom), [look.skyTop, look.skyBottom]);
   useEffect(() => () => sky.dispose(), [sky]);
   const follow = useRef<Group>(null);
   const fortress = useRef<Group>(null);
   const night = run.course.cfg.night;
   useFrame(() => {
      const z = -run.hero.d;
      if (follow.current) follow.current.position.z = z;
      // the fortress keeps its distance until the last stretch, then the gate is the real one
      if (fortress.current) fortress.current.position.z = z - 260;
   });
   return (
      <>
         <group ref={follow}>
            <mesh scale={300} renderOrder={-10}>
               <sphereGeometry args={[1, 24, 16]} />
               <meshBasicMaterial map={sky} side={BackSide} depthWrite={false} fog={false} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, -80]}>
               <planeGeometry args={[220, 420]} />
               <meshStandardMaterial color={COLORS.graphite} roughness={1} />
            </mesh>
         </group>
         <hemisphereLight args={[look.skyBottom, COLORS.graphite, night ? 0.35 : 0.8]} />
         <directionalLight position={[-12, 24, 10]} intensity={night ? 0.35 : 1.1} color={look.lighting === "sunset" ? "#ffd7b0" : night ? "#9fb2ff" : "#ffffff"} />
         <group ref={fortress}>
            <group position={[0, 18, 0]}>
               <Model asset={ASSETS.gate} scale={34 / GLB_SIZE.gate.x} />
            </group>
            {[-26, -12, 12, 26].map((x, i) => (
               <mesh key={x} position={[x, 22 + (i % 2) * 8, -14]}>
                  <octahedronGeometry args={[7 + (i % 2) * 3]} />
                  <meshStandardMaterial color={COLORS.slate} roughness={0.25} metalness={0.4} transparent opacity={0.85} />
               </mesh>
            ))}
         </group>
         {night && <LampPools run={run} />}
      </>
   );
}

const POOL_SCALE = new Vector3(LAMP_LIGHT, LAMP_LIGHT * 0.45, 1);

/** Level 4: a warm pool of light under each street lamp near the roller (where locks read). */
function LampPools({ run }: { run: DashRun }) {
   const lamps = run.course.lamps;
   return (
      <DynamicInstanced
         count={8}
         name="lamp-pools"
         update={(i, m) => {
            const h = run.hero;
            let n = 0;
            for (const x of lamps) {
               if (x < h.d - 15) continue;
               if (x > h.d + 150) break;
               if (n++ !== i) continue;
               m.makeRotationX(-Math.PI / 2);
               m.scale(POOL_SCALE);
               m.setPosition(0, 0.02, -x);
               return;
            }
            return false;
         }}
      >
         <circleGeometry args={[1, 32]} />
         <meshBasicMaterial color="#fde68a" transparent opacity={0.18} depthWrite={false} toneMapped={false} />
      </DynamicInstanced>
   );
}
