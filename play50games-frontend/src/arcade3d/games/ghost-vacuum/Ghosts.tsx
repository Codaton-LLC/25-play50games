"use client";
import { useEffect, useMemo, useState } from "react";
import { AdditiveBlending, Color, Matrix4, MeshBasicMaterial, SphereGeometry } from "three";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { hover } from "@/arcade3d/core/motion";
import { active, type Run } from "./rules";

const WHITE = new Color("#e0e7ff"), GOLD = new Color("#fde047"), MINT = new Color("#6ee7b7"), PURPLE = new Color("#a78bfa");
export default function Ghosts({ run }: { run: Run }) {
   const time = useGameTime(), quality = useQuality();
   const [motion] = useState(() => ({ y: 0, roll: 0, yaw: 0, squash: 1 }));
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const parts = useMemo<InstancePart[]>(() => [
      { geometry: new SphereGeometry(0.5, 12, 10), material: new MeshBasicMaterial({ color: "white", transparent: true, opacity: 0.78, blending: AdditiveBlending, depthWrite: false }), locals: [new Matrix4().makeTranslation(0, 0.5, 0)] },
   ], []);
   useEffect(() => () => { for (const p of parts) { p.geometry.dispose(); (p.material as MeshBasicMaterial).dispose(); } }, [parts]);
   const bob = (i: number) => {
      if (quality.tier === "low" || reduced) return 0;
      hover(time.now * Math.PI + i / 2, 0.08, motion); return motion.y;
   };
   return <group name="ghosts">
      <DynamicInstanced count={12} parts={parts} tinted update={(i, m, tint) => {
         const g = run.ghosts[i]; if (!active(g) || g.mode === "hidden") return false;
         const s = g.kind === "big" ? 1.2 : 1;
         m.makeScale(s, s, s).setPosition(g.x, 0.1 + bob(i), g.z);
         tint.copy(g.kind === "gold" ? GOLD : WHITE);
         if (g.mode === "stunned" || g.mode === "pulling") tint.multiplyScalar(1.6);
      }} />
      <DynamicInstanced count={24} update={(i, m) => {
         const g = run.ghosts[Math.floor(i / 2)]; if (!active(g) || g.mode === "hidden") return false;
         const s = g.kind === "big" ? 1.2 : 1;
         m.makeScale(1, 1.3, 0.6).setPosition(g.x + (i % 2 ? 0.14 : -0.14) * s, 0.72 * s + bob(g.id), g.z + 0.41 * s);
      }}><sphereGeometry args={[0.055, 8, 6]} /><meshBasicMaterial color="#1e1b4b" /></DynamicInstanced>
      <DynamicInstanced count={12} tinted update={(i, m, color) => {
         const g = run.ghosts[i]; if (!active(g) || g.mode === "hidden" || (!g.lit && g.mode !== "stunned" && g.mode !== "pulling")) return false;
         const s = g.kind === "big" ? 1.2 : 1;
         m.makeRotationX(-Math.PI / 2); m.elements[0] = s; m.elements[6] = -s; m.elements[9] = s;
         m.setPosition(g.x, s + 0.25 + bob(i), g.z);
         color.copy(g.mode === "pulling" || g.mode === "stunned" ? MINT : PURPLE);
      }}><ringGeometry args={[0.46, 0.51, 20]} /><meshBasicMaterial color="white" depthWrite={false} side={2} /></DynamicInstanced>
      <DynamicInstanced count={12} update={(i, m) => {
         const g = run.ghosts[i]; if (g.mode !== "pulling") return false;
         const s = Math.max(0.01, g.progress) * 0.4;
         m.makeScale(s, s, s).setPosition(g.x, (g.kind === "big" ? 1.2 : 1) + 0.4 + bob(i), g.z);
      }}><octahedronGeometry args={[1]} /><meshBasicMaterial color="#6ee7b7" depthWrite={false} /></DynamicInstanced>
   </group>;
}
