"use client";

// The cave's light (no collision): the level's hemisphere / ambient / key from look.ts caveLight, the
// cart's own lantern (a warm point light that rides with the cart, so the rock round you is always lit),
// an ember glow from behind (Cindermaw's fire, brighter the closer she is), and the breath flash that
// lights the tunnel ahead for a moment (the card's Glow Tunnel: in level 3's dark the breath is the light).
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { PointLight } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { breathLight, caveLight, COLORS } from "./look";
import { BREATH, type CaveRun } from "./rules";
import { lanePoint } from "./track";

const P = { x: 0, y: 0, z: 0, h: 0 };

export default function World({ run }: { run: CaveRun }) {
   const time = useGameTime();
   const dark = run.course.config.dark;
   const light = caveLight(run.level, dark);
   const lantern = useRef<PointLight>(null);
   const ember = useRef<PointLight>(null);
   const flash = useRef<PointLight>(null);
   useFrame(() => {
      const c = run.course;
      const s = run.cart.s;
      if (lantern.current) {
         lanePoint(c, s + 3, run.cart.d, 3.2, P);
         lantern.current.position.set(P.x, P.y, P.z);
         lantern.current.intensity = (dark ? 26 : 18) * (0.94 + Math.sin(time.now * 9) * 0.03 + Math.sin(time.now * 23) * 0.03);
      }
      if (ember.current) {
         lanePoint(c, s - 10, 0, 2.5, P);
         ember.current.position.set(P.x, P.y, P.z);
         const near = run.awake ? Math.max(0, Math.min(1, 1 - (run.meter - 20) / 80)) : 0;
         ember.current.intensity = run.awake ? 10 + near * 30 + Math.sin(time.now * 7) * 3 : 0;
      }
      if (flash.current) {
         let k = 0;
         for (const b of run.breaths) k = Math.max(k, breathLight(run.ms - b.fireAt));
         // the telegraph: a glow rising from behind
         for (const b of run.breaths) {
            const t = b.fireAt - run.ms;
            if (t > 0 && t < BREATH.telegraphMs) k = Math.max(k, 0.3 * (1 - t / BREATH.telegraphMs));
         }
         lanePoint(c, s + 6, 0, 4, P);
         flash.current.position.set(P.x, P.y, P.z);
         flash.current.intensity = k * (dark ? 90 : 50);
      }
   });
   return (
      <>
         <hemisphereLight args={[dark ? "#5b4a8a" : "#ffd9b0", dark ? "#120a08" : "#3a2216", light.hemi]} />
         <ambientLight intensity={light.ambient} color={dark ? "#6d5ba8" : "#ffe4cc"} />
         <directionalLight position={[8, 30, 6]} intensity={light.key} color={dark ? "#a59ad8" : "#ffe0bf"} />
         <pointLight ref={lantern} color="#ffcf8a" distance={dark ? 26 : 32} decay={1.3} intensity={18} />
         <pointLight ref={ember} color={COLORS.ember} distance={34} decay={1.2} intensity={0} />
         <pointLight ref={flash} color={COLORS.breath} distance={60} decay={1} intensity={0} />
      </>
   );
}
