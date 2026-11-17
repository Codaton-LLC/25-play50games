"use client";

// The Bridge Keeper (L5): the m2BridgeKeeperBoss crane robot towering behind its plate at the far side of
// the arena. Reads rules.ts only: it winds up (telegraph) and the row it will stomp glows red across the
// arena; the stomp shakes it down; its arm laser greys a node (P2, a grey bar over that node); its chest
// shows the colour its plate wants while the window is open; hit flash; it topples when beaten.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { Model } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { ASSETS } from "./assets";
import { CELL } from "./levels";
import type { World } from "./rules";
import { MASK_COLOR } from "./look";
import { cellPos } from "./Board";

export function Keeper({ world }: { world: World }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const row = useRef<Mesh>(null);
   const chest = useRef<Mesh>(null);
   const grey = useRef<Mesh>(null);
   const time = useGameTime();
   const st = useRef({ fall: 0 });
   const plate = world.map.plate;
   useFrame((_, delta) => {
      const k = world.keeper;
      if (!k || !plate || !root.current || !body.current) return;
      const s = k.state;
      const t = time.now;
      root.current.visible = st.current.fall < 1;
      const lean = s.step === "telegraph" ? -0.1 + Math.sin(t * 22) * 0.02 : s.step === "attack" ? 0.15 : 0;
      body.current.rotation.x += (lean - body.current.rotation.x) * Math.min(1, delta * 6);
      body.current.position.y = s.step === "attack" ? -Math.abs(Math.sin(t * 18)) * 0.3 : 0;
      body.current.scale.setScalar(s.flashMs > 0 ? 1.05 : 1);
      if (s.step === "defeat" || s.step === "done" || world.exitOpen) st.current.fall = Math.min(1, st.current.fall + delta * 0.5);
      body.current.rotation.z = st.current.fall * 1.2;
      body.current.position.y -= st.current.fall * 4;
      if (row.current) {
         const show = k.active && (s.step === "telegraph" || s.step === "attack") && k.stompRow >= 0;
         row.current.visible = show;
         if (show) {
            row.current.position.set((world.map.w * CELL) / 2 - CELL / 2, 0.06, k.stompRow * CELL);
            (row.current.material as MeshBasicMaterial).opacity = s.step === "attack" ? 0.75 : 0.25 + Math.abs(Math.sin(t * 10)) * 0.35;
         }
      }
      if (chest.current) {
         chest.current.visible = k.active && s.step === "vulnerable";
         (chest.current.material as MeshBasicMaterial).color.set(MASK_COLOR[k.wants] ?? "#ffffff");
      }
      if (grey.current) {
         const on = k.greyNode >= 0 && world.ms < k.greyUntil;
         grey.current.visible = on;
         if (on) {
            const n = world.map.nodes[k.greyNode];
            const p = cellPos(n[0], n[1]);
            grey.current.position.set(p.x, 2.2, p.z);
         }
      }
   });
   if (!plate) return null;
   const p = cellPos(plate[0], plate[1]);
   return (
      <>
         <group ref={root} position={[p.x, 0, p.z - 5]}>
            <group ref={body}>
               <Model asset={ASSETS.keeper} />
               <mesh ref={chest} position={[0, 4.2, 1.6]} visible={false}>
                  <circleGeometry args={[0.9, 32]} />
                  <meshBasicMaterial transparent opacity={0.9} blending={AdditiveBlending} />
               </mesh>
            </group>
         </group>
         <mesh ref={row} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <planeGeometry args={[world.map.w * CELL, CELL * 0.9]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.4} depthWrite={false} />
         </mesh>
         <mesh ref={grey} visible={false}>
            <boxGeometry args={[1.6, 0.3, 1.6]} />
            <meshStandardMaterial color="#64748b" emissive="#334155" emissiveIntensity={0.6} />
         </mesh>
      </>
   );
}
