"use client";

// The Vault Core (level 5, m2VaultCoreBoss) at the far end of its arena: it hovers and turns, glows red
// through each telegraph, then sweeps a low beam across the whole arena towards you (jump it); while it
// is open it glows gold and the pylons light up (press E on one); a hit flashes it; on its defeat it
// drops and dims, and the exit beam goes dark. Drawn from the run alone.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model } from "@/arcade3d/core/assets";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, CORE_W, GLB_SIZE } from "./assets";
import { COLORS } from "./look";
import { HALF } from "./course";
import { VAULT_CORE } from "./progression";
import { bossOpen, coreSweepS, type LaserRun } from "./rules";

export function Core({ run }: { run: LaserRun }) {
   const time = useGameTime();
   const g = useRef<Group>(null);
   const aura = useRef<Mesh>(null);
   const sweep = useRef<Mesh>(null);
   const sweepGlow = useRef<Mesh>(null);
   const a = run.course.arena;
   useFrame(() => {
      const node = g.current;
      const b = run.boss;
      if (!node || !a || !b) return;
      const now = time.now;
      const fall = b.defeatMs >= 0 ? Math.min(1, b.defeatMs / VAULT_CORE.defeatMs) : 0;
      const lift = b.step === "telegraph" ? stepProgress(b, VAULT_CORE) * 0.6 : 0;
      node.position.set(Math.sin(now * 0.7) * 0.6, 2.6 + lift + Math.sin(now * 1.6) * 0.2 - fall * 2.4, -a.coreS);
      node.rotation.set(fall * 0.6, now * (b.step === "attack" ? 2.4 : 0.5), 0);
      node.scale.setScalar((CORE_W / GLB_SIZE.core.x) * (b.flashMs > 0 ? 1.06 : 1));
      const au = aura.current;
      if (au) {
         au.position.set(node.position.x, node.position.y + 1.4, node.position.z);
         const open = bossOpen(run);
         const tele = run.bossAwake && b.step === "telegraph";
         au.visible = run.bossAwake && b.step !== "done";
         const m = au.material as MeshBasicMaterial;
         m.color.set(open ? "#fde047" : tele ? "#ff2d55" : COLORS.core);
         m.opacity = (open ? 0.75 : tele ? 0.6 : 0.3) * (1 - fall);
         au.scale.setScalar(1 + Math.sin(now * (open ? 10 : 4)) * 0.08);
      }
      const cs = coreSweepS(run);
      for (const ref of [sweep, sweepGlow]) {
         const m = ref.current;
         if (!m) continue;
         m.visible = Number.isFinite(cs);
         if (Number.isFinite(cs)) m.position.set(0, 0.25, -cs);
      }
   });
   if (!a) return null;
   return (
      <>
         <group ref={g}>
            <Model asset={ASSETS.core} />
         </group>
         <mesh ref={aura}>
            <sphereGeometry args={[3.4, 24, 16]} />
            <meshBasicMaterial color={COLORS.core} transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={sweep} visible={false}>
            <boxGeometry args={[HALF * 2, 0.4, 0.08]} />
            <meshBasicMaterial color={COLORS.sweep} toneMapped={false} />
         </mesh>
         <mesh ref={sweepGlow} visible={false}>
            <boxGeometry args={[HALF * 2, 0.6, 0.4]} />
            <meshBasicMaterial color={COLORS.sweep} transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}
