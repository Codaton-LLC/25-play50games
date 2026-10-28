"use client";

// The sky the docks hang in: a gradient dome that follows the camera, cloud banks under the run,
// and the airship sitting past the landing pad. Playable islands are Course.tsx.
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Color, type Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { AIRSHIP_WIDTH, ASSETS, GLB_SIZE, fit } from "./assets";
import { COLORS } from "./look";
import type { Course } from "./course";

export const FOG = { color: COLORS.fog, near: 42, far: 170 } as const;

export default function World({ course }: { course: Course }) {
   const sky = useRef<Group>(null);
   const camera = useThree((s) => s.camera);
   const pad = course.islands[course.finish];
   useFrame(() => {
      sky.current?.position.copy(camera.position);
   });
   return (
      <group>
         <group ref={sky}>
            <mesh>
               <sphereGeometry args={[240, 24, 16]} />
               <meshBasicMaterial color={COLORS.skyMid} side={BackSide} />
            </mesh>
            <hemisphereLight args={[COLORS.sun, new Color(COLORS.water), 0.85]} />
            <directionalLight position={[30, 40, 12]} intensity={1.15} color={COLORS.sun} />
         </group>
         <Model
            asset={ASSETS.bank}
            position={[pad.x * 0.45, -6, -18]}
            scale={8}
         />
         <Model
            asset={ASSETS.bank}
            position={[pad.x * 0.7, -8, 16]}
            scale={6}
         />
         <Model
            asset={ASSETS.airship}
            position={[pad.x + 18, pad.y + 8, -6]}
            scale={fit(GLB_SIZE.airship.x, AIRSHIP_WIDTH)}
         />
      </group>
   );
}
