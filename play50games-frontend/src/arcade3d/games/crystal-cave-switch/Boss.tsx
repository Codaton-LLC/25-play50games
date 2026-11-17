"use client";

// The Hollow Prism (level 5): the black-glass octahedron (m2HollowPrismBoss) hovering over the arena.
// Its tell paints the beam's lane on the floor (toward where you stood) and the beam burns down it; while
// its core is open it shows its colour code as glyphs over it (struck ones bright). A hit flashes it;
// the defeat cracks it apart, spinning, into the mist.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, PRISM_SCALE } from "./assets";
import { COLORS, GLYPH_SIDES, GLYPH_TURN } from "./look";
import type { ColorId } from "./course";
import type { CaveRun } from "./rules";

const MAX_CODE = 3;

export function Prism({ run }: { run: CaveRun }) {
   const time = useGameTime();
   const body = useRef<Group>(null);
   const aura = useRef<Mesh>(null);
   const lane = useRef<Group>(null);
   const laneMat = useRef<MeshBasicMaterial>(null);
   const marks = useRef<(Mesh | null)[][]>([]);
   const spec = run.course.boss;
   useFrame(() => {
      const b = run.boss;
      const g = body.current;
      if (!b || !spec || !g) return;
      const now = time.now;
      const awake = run.bossAwake;
      let y = spec.y + Math.sin(now * 1.1) * 0.4 + (awake ? 0 : 6);
      if (b.step === "telegraph") y += Math.min(1, b.stepMs / 600) * 0.8;
      if (b.defeatMs >= 0) y -= (b.defeatMs / 1000) ** 2 * 3;
      g.position.set(spec.x, y, spec.z);
      g.rotation.y = now * (b.step === "vulnerable" ? 0.3 : 0.8) + (b.defeatMs >= 0 ? b.defeatMs / 120 : 0);
      g.visible = b.step !== "done";
      const a = aura.current;
      if (a) {
         a.visible = b.flashMs > 0 || b.step === "vulnerable";
         a.position.set(spec.x, y + 3, spec.z);
         a.scale.setScalar(b.flashMs > 0 ? 5 : 4 + Math.sin(now * 6) * 0.15);
      }
      const l = lane.current;
      if (l) {
         const on = awake && (b.step === "telegraph" || b.step === "attack");
         l.visible = on;
         if (on) {
            l.position.set(spec.x + Math.sin(run.lane) * 12, 0.06, spec.z + Math.cos(run.lane) * 12);
            l.rotation.y = run.lane;
            if (laneMat.current) laneMat.current.opacity = b.step === "attack" ? 0.85 : 0.3 + 0.2 * Math.sin(now * 16);
         }
      }
      // the colour code over it while the core is open
      for (let k = 0; k < MAX_CODE; k++) {
         for (let c = 0; c < 4; c++) {
            const m = marks.current[k]?.[c];
            if (!m) continue;
            const show = b.step === "vulnerable" && k < run.code.length && run.code[k] === c;
            m.visible = show;
            if (!show) continue;
            const n = run.code.length;
            m.position.set(spec.x + (k - (n - 1) / 2) * 1.6, y + 8, spec.z + 2);
            (m.material as MeshBasicMaterial).opacity = k < run.codeAt ? 1 : 0.45 + 0.3 * Math.sin(now * 6);
         }
      }
   });
   if (!spec || !run.boss) return null;
   return (
      <>
         <group ref={body}>
            <Model asset={ASSETS.prism} scale={PRISM_SCALE} />
         </group>
         <mesh ref={aura} visible={false}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshBasicMaterial color="#f0abfc" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
         </mesh>
         <group ref={lane} visible={false}>
            <mesh rotation-x={-Math.PI / 2}>
               <planeGeometry args={[2.6, 24]} />
               <meshBasicMaterial ref={laneMat} color={COLORS.lane} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
            </mesh>
         </group>
         {Array.from({ length: MAX_CODE }, (_k, k) =>
            ([0, 1, 2, 3] as ColorId[]).map((c) => (
               <mesh
                  key={`${k}-${c}`}
                  ref={(m) => {
                     (marks.current[k] ??= [])[c] = m;
                  }}
                  visible={false}
                  rotation-z={GLYPH_TURN[c]}
                  scale-y={c === 2 ? 1.25 : 1}
               >
                  <circleGeometry args={[0.6, GLYPH_SIDES[c]]} />
                  <meshBasicMaterial color={COLORS.gem[c]} transparent opacity={0.6} side={2} toneMapped={false} />
               </mesh>
            )),
         )}
      </>
   );
}
