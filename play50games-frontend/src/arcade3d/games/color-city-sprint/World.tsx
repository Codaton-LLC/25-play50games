"use client";

// Sky, fog fill and the pastel city backdrop. The playable streets are Course.tsx.
import { useMemo } from "react";
import { Color } from "three";
import { Model } from "@/arcade3d/core/assets";
import { ASSETS } from "./assets";
import { COLORS, isNightLevel } from "./look";
import type { Course } from "./city";

export function World({ course, levelId }: { course: Course; levelId: number }) {
   const night = isNightLevel(levelId);
   const hem = useMemo(() => new Color(night ? "#6366f1" : "#fff1e6"), [night]);
   const cx = (course.minX + course.maxX) / 2;
   const cz = course.maxZ + 6;
   return (
      <group>
         <hemisphereLight color={hem} groundColor={night ? "#1c1917" : "#94a3b8"} intensity={night ? 0.35 : 0.85} />
         <directionalLight position={[12, 22, 8]} intensity={night ? 0.35 : 1.15} color={night ? "#c4b5fd" : "#fff7ed"} />
         <directionalLight position={[-8, 6, -4]} intensity={night ? 0.5 : 0.25} color={night ? "#fb7185" : "#fdba74"} />
         <mesh position={[cx, -0.2, (course.minZ + course.maxZ) / 2]}>
            <boxGeometry args={[course.maxX - course.minX + 24, 0.3, course.maxZ - course.minZ + 24]} />
            <meshStandardMaterial color={night ? COLORS.nightStreet : "#2a2433"} />
         </mesh>
         <Model asset={ASSETS.city} position={[cx, 0, cz]} />
         <color attach="background" args={[night ? COLORS.nightSky : COLORS.background]} />
         <fog attach="fog" args={[night ? COLORS.nightFog : COLORS.fog, night ? 18 : 28, night ? 70 : 92]} />
      </group>
   );
}
