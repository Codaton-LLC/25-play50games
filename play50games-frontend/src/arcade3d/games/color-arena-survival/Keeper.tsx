"use client";

// Level 5's Prism Keeper (m2PrismArenaBoss) hovering off the arena's north edge, facing the floor. It
// rises in through its intro, sways while it calls, lunges as the floor drops (its attack), glows cyan
// with an open ring while its window is open (the beacon's beam can hit it), flashes white on a hit,
// and spins down into the pit on its defeat. Visual only: the rules (menu2/boss through rules.ts) decide.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, GLB_SIZE, KEEPER_W } from "./assets";
import { COLORS } from "./look";
import { KEEPER, type Arena } from "./rules";

/** Where the Keeper hovers (m): low off the floor's north-west corner (clear of the HUD's top centre), facing the middle. */
export function keeperHome(a: Arena): { x: number; y: number; z: number } {
   return { x: -a.half - 2.5, y: 0.8, z: -a.half - 2.5 };
}

export default function Keeper({ arena }: { arena: Arena }) {
   const root = useRef<Group>(null);
   const glow = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const time = useGameTime();
   const s = KEEPER_W / GLB_SIZE.keeper.x;
   useFrame(() => {
      const b = arena.boss;
      const g = root.current;
      if (!b || !g) return;
      const home = keeperHome(arena);
      const now = time.now;
      let y = home.y + Math.sin(now * 1.3) * 0.35;
      let z = home.z;
      let x = home.x;
      let spin = Math.sin(now * 0.7) * 0.12;
      let scale = 1;
      const k = stepProgress(b, KEEPER);
      if (b.step === "intro") y = home.y - 14 * (1 - k) * (1 - k);
      else if (b.step === "attack") {
         // a lunge towards the middle
         const l = Math.sin(k * Math.PI) * 2.2;
         z += l * 0.7;
         x += l * 0.7;
      }
      else if (b.step === "transition") spin += k * Math.PI * 2;
      else if (b.step === "defeat" || b.step === "done") {
         const d = b.step === "done" ? 1 : k;
         y -= d * d * 30;
         spin += d * 9;
         scale = Math.max(0.05, 1 - d * 0.7);
      }
      g.position.set(x, y, z);
      g.rotation.y = Math.atan2(-home.x, -home.z) + spin;
      g.scale.setScalar(scale);
      g.visible = b.step !== "done";
      const gl = glow.current;
      if (gl) {
         const mat = gl.material as MeshBasicMaterial;
         const flash = b.flashMs > 0;
         const tele = b.step === "telegraph" ? 0.25 + 0.2 * Math.sin(now * 8) : 0;
         mat.color.set(flash ? "#ffffff" : b.step === "vulnerable" ? COLORS.keeperGlow : COLORS.keeper);
         mat.opacity = flash ? 0.9 : b.step === "vulnerable" ? 0.5 : 0.15 + tele;
      }
      if (ring.current) {
         ring.current.visible = b.step === "vulnerable";
         ring.current.rotation.z = now * 2;
      }
   });
   if (!arena.boss) return null;
   return (
      <group ref={root}>
         <Model asset={ASSETS.keeper} scale={s} fallback={null} />
         <mesh ref={glow} position-y={GLB_SIZE.keeper.y * s * 0.5}>
            <sphereGeometry args={[KEEPER_W * 0.5, 24, 16]} />
            <meshBasicMaterial color={COLORS.keeper} transparent opacity={0.15} blending={AdditiveBlending} depthWrite={false} />
         </mesh>
         <mesh ref={ring} position-y={GLB_SIZE.keeper.y * s * 0.5} visible={false}>
            <torusGeometry args={[KEEPER_W * 0.62, 0.12, 8, 48]} />
            <meshBasicMaterial color={COLORS.keeperGlow} toneMapped={false} />
         </mesh>
      </group>
   );
}
