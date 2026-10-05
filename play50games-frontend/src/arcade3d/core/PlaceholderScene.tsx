"use client";

// Temporary scene for games that are not built yet: a floor and a spinning cube.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

export function PlaceholderScene() {
   const cube = useRef<Mesh>(null);

   useFrame((_state, dt) => {
      if (cube.current) cube.current.rotation.y += dt;
   });

   return (
      <>
         <ambientLight intensity={0.6} />
         <directionalLight position={[4, 8, 4]} intensity={1.2} />
         <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#1e293b" />
         </mesh>
         <mesh ref={cube} position={[0, 1, 0]}>
            <boxGeometry args={[1.5, 1.5, 1.5]} />
            <meshStandardMaterial color="#7dd3fc" />
         </mesh>
      </>
   );
}
