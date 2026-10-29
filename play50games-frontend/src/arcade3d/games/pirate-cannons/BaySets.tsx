"use client";

// The level's weather and background ships (looks.ts BAY_THEMES): ships moored off the far shore,
// a sailing fleet on the horizon, the captain's flagship lying beyond the far lane, and the storm's
// rain and lightning. All behind the play sea (z <= -70) or overhead; looks only.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Matrix4, type AmbientLight } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { createRng } from "@/arcade3d/core/math";
import { ASSETS } from "./assets";
import type { BayTheme } from "./looks";

/** Background ships per theme: x, z, turn and size (1 = the 6 m play ship). Spots sit at z <= -70. */
export const BACKGROUND_SHIPS: Record<BayTheme["ships"], ReadonlyArray<{ x: number; y: number; z: number; rotY: number; scale: number }>> = {
   none: [],
   moored: [
      { x: -34, y: 0, z: -78, rotY: 0.3, scale: 1 },
      { x: -22, y: 0, z: -82, rotY: -0.2, scale: 0.9 },
      { x: 30, y: 0, z: -80, rotY: 2.9, scale: 1 },
   ],
   fleet: [
      { x: -60, y: 0, z: -125, rotY: -Math.PI / 2, scale: 1.2 },
      { x: -25, y: 0, z: -135, rotY: -Math.PI / 2, scale: 1.1 },
      { x: 15, y: 0, z: -128, rotY: -Math.PI / 2, scale: 1.2 },
      { x: 50, y: 0, z: -140, rotY: -Math.PI / 2, scale: 1 },
   ],
   flagship: [{ x: 2, y: 0, z: -79, rotY: -Math.PI / 2 + 0.2, scale: 2.2 }],
};

const RAIN = { count: 420, x: 45, yTop: 26, z0: -4, z1: -80, speed: 22 } as const;

/** Storm rain: thin streaks falling through a box over the sea; one draw call. */
function Rain() {
   const mesh = useRef<InstancedMesh>(null);
   const time = useGameTime();
   const drops = useMemo(() => {
      const rng = createRng(17);
      return Array.from({ length: RAIN.count }, () => ({ x: (rng() * 2 - 1) * RAIN.x, y: rng() * RAIN.yTop, z: RAIN.z0 + rng() * (RAIN.z1 - RAIN.z0) }));
   }, []);
   const m = useMemo(() => new Matrix4(), []);
   useFrame(() => {
      const im = mesh.current;
      if (!im) return;
      const fall = time.now * RAIN.speed;
      for (let i = 0; i < drops.length; i++) {
         const d = drops[i];
         const y = (((d.y - fall) % RAIN.yTop) + RAIN.yTop) % RAIN.yTop;
         m.makeTranslation(d.x + 0.2 * y * 0.05, y, d.z);
         im.setMatrixAt(i, m);
      }
      im.instanceMatrix.needsUpdate = true;
   });
   return (
      <instancedMesh ref={mesh} args={[undefined, undefined, RAIN.count]} frustumCulled={false} name="storm-rain">
         <boxGeometry args={[0.03, 0.9, 0.03]} />
         <meshBasicMaterial color="#cbd5e1" transparent opacity={0.45} depthWrite={false} />
      </instancedMesh>
   );
}

/** Lightning: a bright flash of the whole bay every few seconds (twice, quickly), then dark. */
function Lightning() {
   const light = useRef<AmbientLight>(null);
   const time = useGameTime();
   useFrame(() => {
      const l = light.current;
      if (!l) return;
      const t = time.now % 6.5;
      const flash = (t > 5.6 && t < 5.7) || (t > 5.85 && t < 5.92) ? 1 : 0;
      l.intensity = flash * 2.4;
   });
   return <ambientLight ref={light} color="#e0e7ff" intensity={0} />;
}

export function BaySets({ theme }: { theme: BayTheme }) {
   const ships = BACKGROUND_SHIPS[theme.ships];
   return (
      <group name="bay-sets">
         {ships.length > 0 && <InstancedModel asset={ASSETS.ship} spots={ships} fallback={null} />}
         {theme.rain && <Rain />}
         {theme.lightning && <Lightning />}
      </group>
   );
}
