"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { HumanoidModel, createPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { BlobShadow } from "@/arcade3d/core/render/BlobShadow";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, TEAM } from "./assets";
import { Beanie, COLORS, KidStandIn, Scarf } from "./Primitives";
import { handBallRadius } from "./feedback";
import { kidPose, stepKidPhase, type KidLook } from "./poses";
import type { Kid, Run } from "./rules";

function lookOf(run: Run, kid: Kid): KidLook {
   if (run.endReason === "win" && kid.id === 0) return "cheer";
   if (kid.state === "stagger" || kid.state === "knockdown") return "flail";
   if (kid.throwAnim > 0 || kid.state === "windup") return "throw";
   if ((kid.id === 0 && run.scooping) || kid.state === "cover" || kid.state === "ready") return "crouch";
   return "walk";
}

function HandBall({ run }: { run: Run }) {
   const ball = useRef<Mesh>(null);
   useFrame(() => {
      const m = ball.current;
      if (!m) return;
      const r = run.endReason ? 0 : handBallRadius(run.scooping, run.scoopT, run.kids[0].ammo);
      m.visible = r > 0;
      m.scale.setScalar(Math.max(1e-3, r));
   });
   return (
      <mesh ref={ball} position={[0, -0.06, 0.04]} visible={false}>
         <sphereGeometry args={[1, 12, 10]} />
         <meshStandardMaterial color={COLORS.snow} roughness={0.45} emissive={COLORS.ice} emissiveIntensity={0.25} />
      </mesh>
   );
}

function KidView({ run, kid }: { run: Run; kid: Kid }) {
   const root = useRef<Group>(null);
   const phase = useRef(kid.id * 1.3);
   const scratch = useState(createPose)[0];
   const time = useGameTime();
   const color = TEAM[kid.id];
   const pose = useHumanoidPose((p) => {
      const playing = useArcadeStore.getState().phase === "playing";
      const speed = playing ? Math.hypot(kid.vx, kid.vz) : 0;
      phase.current = stepKidPhase(phase.current, speed, playing ? time.delta : 0);
      kidPose(phase.current, speed, lookOf(run, kid), time.now, p, scratch);
   });
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      g.visible = kid.present;
      g.position.set(kid.x, 0, kid.z);
      g.rotation.y = kid.yaw;
   });
   return (
      <group ref={root}>
         <HumanoidModel
            asset={ASSETS.kid}
            pose={pose}
            attach={kid.id === 0
               ? { head: <Beanie color={color} />, chest: <Scarf color={color} />, handR: <HandBall run={run} /> }
               : { head: <Beanie color={color} />, chest: <Scarf color={color} /> }}
            fallback={<KidStandIn color={color} />}
         />
         <BlobShadow radius={0.42} opacity={0.35} y={0.02} />
      </group>
   );
}

export default function Kids({ run }: { run: Run }) {
   return (
      <group>
         <KidView run={run} kid={run.kids[0]} />
         <KidView run={run} kid={run.kids[1]} />
         <KidView run={run} kid={run.kids[2]} />
         <KidView run={run} kid={run.kids[3]} />
      </group>
   );
}
