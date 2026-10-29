"use client";

// Rockjaw, the Tunnel Beetle (L5): the drained giant cave beetle (grey tint), three cells wide, two tall.
// Reads rules.ts only: charging (P1), the dust telegraph and the eruption through the floor (P2),
// flipped on its back with the legs flailing (P3), the hit flash, the slow-motion defeat.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { Model } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { bossTimeScale } from "../../menu2/boss/boss";
import { useJuice, createJuiceEmitter } from "../../menu2/juice";
import { ASSETS } from "./assets";
import { ROCKJAW } from "./progression";
import type { World } from "./rules";
import { CELL, cellX, cellY, floorY } from "./space";

export function Boss({ world }: { world: World }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const dust = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const time = useGameTime();
   const juice = useJuice();
   const fx = useMemo(() => ({ dust: createJuiceEmitter(), at: { x: 0, y: 0, z: 0 } }), []);
   const st = useRef({ x: 0, defeat: 0, fall: 0 });
   const a = world.map.arena;
   useFrame(() => {
      const b = world.boss;
      const g = root.current;
      if (!b || !a || !g || !body.current) return;
      const s = b.state;
      g.visible = b.active && s.step !== "done" && !b.buried;
      const x = cellX(world.w, b.x);
      st.current.x += (x - st.current.x) * 0.25;
      const t = time.now;
      // telegraph: it rears; attack: lunges; flipped: belly up, legs kicking
      const rear = s.step === "telegraph" ? Math.sin(t * 22) * 0.04 + 0.12 : 0;
      g.position.set(st.current.x, floorY(a.floor), 0.15);
      const face = b.target >= b.x ? 1 : -1;
      if (b.flipped) {
         body.current.rotation.set(0, face > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI);
         body.current.position.y = 2 * CELL * 0.98 + Math.abs(Math.sin(t * (s.step === "attack" ? 18 : 6))) * 0.06;
      } else {
         body.current.rotation.set(-rear, face > 0 ? Math.PI / 2 : -Math.PI / 2, s.step === "attack" ? Math.sin(t * 16) * 0.05 : 0);
         body.current.position.y = s.step === "attack" && s.phase === 1 ? Math.max(0, 0.6 - (t % 0.6)) * 2 : 0;
      }
      const flash = s.flashMs > 0;
      body.current.scale.setScalar(flash ? 1.08 : 1);
      if (ring.current) {
         ring.current.visible = s.step === "vulnerable" && !b.buried;
         ring.current.rotation.z = t * 2;
         ring.current.position.set(0, b.flipped ? 2 * CELL + 0.4 : CELL * 1.5, 1.6);
      }
      // P2's dust telegraph: a boiling patch on the floor (and grit streaming up through the gallery)
      if (dust.current) {
         const show = b.buried && s.step === "telegraph";
         dust.current.visible = show;
         if (show) {
            dust.current.position.set(cellX(world.w, b.dustCol), floorY(a.floor) + 0.05, 0.4);
            (dust.current.material as MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 20) * 0.15;
            fx.at.x = cellX(world.w, b.dustCol);
            fx.at.y = cellY(a.gallery) - CELL / 2;
            juice.stream("dust", fx.at, 30, fx.dust, { color: "#b8a28c" });
         }
      }
      // the defeat: slow-motion collapse
      if (s.hp === 0) {
         st.current.defeat += time.delta * 1000;
         const scale = bossTimeScale({ ...s, defeatMs: st.current.defeat }, ROCKJAW);
         st.current.fall = Math.min(1, st.current.fall + time.delta * scale * 0.8);
         body.current.scale.set(1, 1 - st.current.fall * 0.4, 1);
         body.current.rotation.z += st.current.fall * 0.05;
      }
   });
   if (!a) return null;
   return (
      <>
         <group ref={root} visible={false}>
            <group ref={body}>
               <Model asset={ASSETS.boss} tint="#a3a3a3" />
            </group>
            <mesh ref={ring}>
               <torusGeometry args={[0.9, 0.08, 8, 32]} />
               <meshBasicMaterial color="#fb923c" toneMapped={false} />
            </mesh>
         </group>
         <mesh ref={dust} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <circleGeometry args={[2.2, 32]} />
            <meshBasicMaterial color="#d6b98c" transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} />
         </mesh>
      </>
   );
}
