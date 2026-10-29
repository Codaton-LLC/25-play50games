"use client";

// Level 5's boss: Umbra (m2ShadowArmadillo, Shadow Plates' lieutenant). He runs the opposite wall tipped
// like the hero, glows violet in his telegraph and gold-green in his open window, throws a spinning shadow
// plate across in his attack, waits at a hall column in phase 2, climbs the shaft's far wall in phase 3;
// the top glyph glows above the last pad and the capstone drops on him at the finish. Visual only.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, UMBRA_LENGTH, fit } from "./assets";
import { COLORS } from "./look";
import type { WallRun } from "./rules";

export default function Umbra({ run }: { run: WallRun }) {
   const body = useRef<Group>(null);
   const tilt = useRef<Group>(null);
   const aura = useRef<Mesh>(null);
   const plate = useRef<Mesh>(null);
   const glyph = useRef<Mesh>(null);
   const cap = useRef<Group>(null);
   const time = useGameTime();
   const st = useMemo(() => ({ x: 0, y: 0, z: 0, placed: false, defeatAt: -1 }), []);
   const scale = fit(GLB_SIZE.umbra.z, UMBRA_LENGTH);
   const arena = run.course.arena;

   useFrame(() => {
      const b = run.boss;
      const u = run.umbra;
      const g = body.current;
      if (!b || !g) return;
      const now = time.now;
      const dt = Math.min(0.05, time.delta);
      // ease after the rules' point (he never snaps), a hop while he runs
      const k = st.placed ? Math.min(1, dt * 10) : 1;
      st.x += (u.x - st.x) * k;
      st.y += (u.y - st.y) * k;
      st.z += (u.z - st.z) * k;
      st.placed = true;
      const defeated = b.step === "defeat" || b.step === "done";
      if (defeated && st.defeatAt < 0) st.defeatAt = now;
      g.visible = u.visible && (st.defeatAt < 0 || now - st.defeatAt < 1.6);
      g.position.set(st.x, st.y + Math.abs(Math.sin(now * 9)) * 0.08, st.z);
      // face along the wall he runs (or toward the hero at a column)
      const h = run.hero;
      const w = u.wall >= 0 ? run.course.walls[u.wall] : null;
      if (w) {
         g.rotation.y = w.axis === "x" ? (h.vx >= 0 ? Math.PI / 2 : -Math.PI / 2) : h.vz >= 0 ? 0 : Math.PI;
         if (tilt.current) {
            const nx = w.axis === "x" ? 0 : w.n;
            const nz = w.axis === "x" ? w.n : 0;
            tilt.current.rotation.set(nz * 0.5, 0, -nx * 0.5);
         }
      } else {
         g.rotation.y = Math.atan2(h.x - st.x, h.z - st.z);
         if (tilt.current) tilt.current.rotation.set(0, 0, 0);
      }
      const a = aura.current;
      if (a) {
         const open = b.step === "vulnerable";
         const tele = b.step === "telegraph";
         a.visible = g.visible && (open || tele || b.flashMs > 0);
         const m = a.material as MeshStandardMaterial;
         m.color.set(b.flashMs > 0 ? "#ffffff" : open ? "#86efac" : COLORS.hazard);
         m.emissive.set(b.flashMs > 0 ? "#ffffff" : open ? "#86efac" : COLORS.hazard);
         a.scale.setScalar(open ? 1.25 + Math.sin(now * 6) * 0.08 : 1 + Math.sin(now * 20) * 0.1);
      }
      const p = plate.current;
      if (p) {
         p.visible = u.plateLive;
         p.position.set(u.px, u.py, u.pz);
         p.rotation.set(Math.PI / 2, 0, now * 18);
      }
      const gl = glyph.current;
      if (gl) {
         gl.rotation.z = now * 0.8;
         const m = gl.material as MeshStandardMaterial;
         m.emissiveIntensity = b.phase === 2 && b.step === "vulnerable" ? 1.6 + Math.sin(now * 8) * 0.4 : 0.5;
      }
      // the capstone drops on him at the finish
      const c = cap.current;
      if (c && arena) {
         const t = st.defeatAt < 0 ? -1 : now - st.defeatAt;
         c.visible = t >= 0;
         c.position.set(st.x, st.y + Math.max(0.6, 14 - t * t * 30), st.z);
      }
   });

   if (!run.course.boss) return null;
   const glyphAt = arena?.glyph;
   return (
      <>
         <group ref={body}>
            <group ref={tilt}>
               <group scale={scale}>
                  <Model asset={ASSETS.umbra} />
               </group>
            </group>
            <mesh ref={aura} position={[0, 0.8, 0]}>
               <sphereGeometry args={[1.25, 18, 12]} />
               <meshStandardMaterial color={COLORS.hazard} emissive={COLORS.hazard} emissiveIntensity={1.2} transparent opacity={0.28} depthWrite={false} />
            </mesh>
         </group>
         <mesh ref={plate}>
            <cylinderGeometry args={[0.55, 0.55, 0.08, 6]} />
            <meshStandardMaterial color={COLORS.plate} emissive={COLORS.hazard} emissiveIntensity={1.1} metalness={0.5} roughness={0.3} />
         </mesh>
         {glyphAt ? (
            <mesh ref={glyph} position={[glyphAt.x, glyphAt.y + 0.4, glyphAt.z]} rotation={[0, 0, 0]}>
               <torusGeometry args={[1.0, 0.16, 10, 6]} />
               <meshStandardMaterial color={COLORS.glyph} emissive={COLORS.glyph} emissiveIntensity={0.5} metalness={0.4} roughness={0.3} />
            </mesh>
         ) : null}
         <group ref={cap} visible={false}>
            <mesh>
               <boxGeometry args={[3.2, 1.2, 3.2]} />
               <meshStandardMaterial color="#c9a46e" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.65, 0]}>
               <boxGeometry args={[2.6, 0.2, 2.6]} />
               <meshStandardMaterial color={COLORS.jadeDark} roughness={0.6} />
            </mesh>
         </group>
      </>
   );
}
