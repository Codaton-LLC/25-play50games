"use client";

// Mother Snapper (level 5): the shared m2SnapperPlant at 5x, rooted in the courtyard centre, her stalk
// wrapped in Shadow Plates' dark plates. She sways, snaps shut on the telegraph, and gapes while she is
// open: a glowing maw in phase 1, the seed pods on four vines behind her in phase 2 (pods glow when a
// banked disc may pop them), her crown in phase 3 (weak only to a disc that has banked twice) with the
// thorn volley's lane burning red on the floor before it fires. A hit flashes her white; the defeat
// lets her sink back into a bed of green flowers. Visual only: rules.ts decides every hit.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, SNAPPER_H, SNAPPER_SCALE } from "./assets";
import { COLORS } from "./look";
import { POD, type DiscRun } from "./rules";

export function Snapper({ run }: { run: DiscRun }) {
   const time = useGameTime();
   const body = useRef<Group>(null);
   const maw = useRef<Mesh>(null);
   const crown = useRef<Mesh>(null);
   const lane = useRef<Group>(null);
   const laneMat = useRef<MeshBasicMaterial>(null);
   const flash = useRef<Mesh>(null);
   const pods = useRef<(Mesh | null)[]>([]);
   const boss = run.course.boss;
   const plates = useMemo<InstanceSpot[]>(() => {
      if (!boss) return [];
      const out: InstanceSpot[] = [];
      for (let i = 0; i < 10; i++) {
         const a = (i / 10) * Math.PI * 2;
         out.push({ x: boss.x + Math.cos(a) * 0.95, y: 1.2 + (i % 3) * 1.1, z: boss.z + Math.sin(a) * 0.95, rotY: -a, sx: 0.7, sy: 0.9, sz: 0.18 });
      }
      return out;
   }, [boss]);
   const vines = useMemo<InstanceSpot[]>(() => {
      if (!boss) return [];
      return boss.pods.map((p) => {
         const dx = p.x - boss.x;
         const dz = p.z - boss.z;
         const len = Math.hypot(dx, dz);
         return { x: (p.x + boss.x) / 2, y: 0.35, z: (p.z + boss.z) / 2, rotY: Math.atan2(dx, dz), sx: 0.22, sy: 0.22, sz: len };
      });
   }, [boss]);
   useFrame(() => {
      const b = run.boss;
      if (!boss || !b) return;
      const now = time.now;
      const open = b.step === "vulnerable";
      const defeated = b.step === "defeat" || b.step === "done";
      const g = body.current;
      if (g) {
         const sink = defeated ? Math.min(1, b.defeatMs / 2000) : 0;
         const intro = b.step === "intro" ? 1 - Math.min(1, b.stepMs / 2000) : 0;
         const snap = b.step === "telegraph" ? 0.06 * Math.sin(b.stepMs / 40) : 0;
         g.position.set(boss.x, -SNAPPER_H * (0.85 * sink + 0.9 * intro), boss.z);
         g.rotation.y = Math.atan2(run.hero.x - boss.x, run.hero.z - boss.z) + Math.sin(now * 0.8) * 0.12 + snap;
         g.rotation.z = Math.sin(now * 0.6) * 0.04;
         const s = SNAPPER_SCALE * (open && b.phase === 0 ? 1.06 : 1);
         g.scale.set(s, s * (open && b.phase === 0 ? 1.04 : 1), s);
      }
      const m = maw.current;
      if (m) {
         m.visible = open && b.phase === 0;
         m.position.set(boss.x, 1.1, boss.z);
         m.scale.setScalar(1.5 + 0.15 * Math.sin(now * 12));
      }
      const c = crown.current;
      if (c) {
         c.visible = b.phase === 2 && !defeated;
         c.position.set(boss.x, SNAPPER_H * 0.92, boss.z);
         (c.material as MeshStandardMaterial).emissiveIntensity = open ? 1.4 + 0.4 * Math.sin(now * 10) : 0.2;
      }
      const l = lane.current;
      if (l) {
         const on = b.phase === 2 && (b.step === "telegraph" || b.step === "attack");
         l.visible = on;
         if (on) {
            l.position.set(boss.x + Math.sin(run.lane) * 9, 0.05, boss.z + Math.cos(run.lane) * 9);
            l.rotation.y = run.lane;
            if (laneMat.current) laneMat.current.opacity = b.step === "attack" ? 0.85 : 0.35 + 0.25 * Math.sin(now * 18);
         }
      }
      const f = flash.current;
      if (f) {
         f.visible = b.flashMs > 0;
         f.position.set(boss.x, SNAPPER_H * 0.55, boss.z);
      }
      boss.pods.forEach((p, i) => {
         const pm = pods.current[i];
         if (!pm) return;
         pm.visible = b.phase === 1 && !run.podGone[i] && !defeated;
         pm.position.set(p.x, 0.9 + 0.08 * Math.sin(now * 3 + i), p.z);
         pm.scale.setScalar(POD.r * (open ? 1.15 + 0.08 * Math.sin(now * 10) : 1));
         (pm.material as MeshStandardMaterial).emissiveIntensity = open ? 1.2 : 0.25;
      });
   });
   if (!boss) return null;
   return (
      <group name="mother-snapper">
         <group ref={body}>
            <Model asset={ASSETS.snapper} />
         </group>
         <Instanced spots={plates}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.plate} metalness={0.6} roughness={0.35} />
         </Instanced>
         <Instanced spots={vines}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#3f6b2a" roughness={0.9} />
         </Instanced>
         {boss.pods.map((_p, i) => (
            <mesh
               key={i}
               ref={(m) => {
                  pods.current[i] = m;
               }}
            >
               <sphereGeometry args={[1, 14, 10]} />
               <meshStandardMaterial color="#c2d93a" emissive="#e8ff6a" emissiveIntensity={0.25} roughness={0.5} />
            </mesh>
         ))}
         <mesh ref={maw}>
            <sphereGeometry args={[1, 18, 12]} />
            <meshBasicMaterial color="#ff4d6d" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={crown}>
            <torusGeometry args={[1.4, 0.28, 8, 24]} />
            <meshStandardMaterial color={COLORS.plate} emissive="#a3e635" emissiveIntensity={0.2} metalness={0.5} roughness={0.4} />
         </mesh>
         <group ref={lane}>
            <mesh rotation-x={-Math.PI / 2}>
               <planeGeometry args={[2, 18]} />
               <meshBasicMaterial ref={laneMat} color="#ef4444" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
            </mesh>
         </group>
         <mesh ref={flash}>
            <sphereGeometry args={[3.2, 16, 12]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}
