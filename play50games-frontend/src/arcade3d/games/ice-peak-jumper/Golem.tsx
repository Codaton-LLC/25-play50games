"use client";

// The Frost Golem (level 5, m2FrostGolemBoss): 9 m of glacier at the arena's north side, turned to the
// hero. He rears up through a slam's telegraph and drops on the slam (a shake from the Scene); in the
// climb phase he hauls himself up beside the cairn. The target that charges a hit glows yellow in his
// own phase (his back core over the slam slope, his shoulder over the boulder steps, his head crystal at
// the top of the climb), bright while he is open. On his defeat he sinks and fades.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model } from "@/arcade3d/core/assets";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, GLB_SIZE, GOLEM_H } from "./assets";
import { COLORS } from "./look";
import { FROST_GOLEM } from "./progression";
import { bossVulnerable, type PeakRun } from "./rules";

export function Golem({ run }: { run: PeakRun }) {
   const time = useGameTime();
   const g = useRef<Group>(null);
   const core = useRef<Mesh>(null);
   const a = run.course.arena;
   useFrame((_s, delta) => {
      const node = g.current;
      const b = run.boss;
      if (!node || !a || !b) return;
      const now = time.now;
      const dt = Math.min(0.1, delta);
      // rear up through a telegraph, drop on the attack
      let lift = 0;
      if (b.step === "telegraph") lift = stepProgress(b, FROST_GOLEM) * 0.8;
      const climb = b.phase === 2 ? 3.5 : 0;
      const sink = b.defeatMs >= 0 ? Math.min(1, b.defeatMs / FROST_GOLEM.defeatMs) : 0;
      const want = a.golem.y + lift + climb - sink * 6;
      node.position.y += (want - node.position.y) * (1 - Math.exp(-6 * dt));
      node.position.x = a.golem.x + Math.sin(now * 0.7) * 0.15;
      node.position.z = a.golem.z;
      const face = Math.atan2(run.hero.x - a.golem.x, run.hero.z - a.golem.z);
      let dy = face - node.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      node.rotation.y += dy * (1 - Math.exp(-2 * dt));
      node.visible = b.step !== "done";
      const k = (GOLEM_H / GLB_SIZE.golem.y) * (b.flashMs > 0 ? 1.03 : 1);
      node.scale.setScalar(k);
      // the glowing target of this phase
      const c = core.current;
      if (c) {
         const t = run.course.plats[a.targets[Math.min(2, b.phase)]];
         const live = run.bossAwake && b.hp > 0 && b.step !== "defeat" && b.step !== "done";
         c.visible = live;
         c.position.set(t.x, t.y + 0.9, t.z);
         const open = bossVulnerable(run);
         const s = (open ? 1.4 : 0.9) + Math.sin(now * (open ? 10 : 4)) * 0.12;
         c.scale.setScalar(s);
         (c.material as MeshBasicMaterial).opacity = open ? 0.95 : run.pending > 0 ? 0.75 : 0.45;
      }
   });
   if (!a) return null;
   return (
      <>
         <group ref={g} position={[a.golem.x, a.golem.y, a.golem.z]}>
            <Model asset={ASSETS.golem} />
         </group>
         <mesh ref={core} visible={false}>
            <sphereGeometry args={[0.45, 18, 14]} />
            <meshBasicMaterial color={COLORS.core} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}
