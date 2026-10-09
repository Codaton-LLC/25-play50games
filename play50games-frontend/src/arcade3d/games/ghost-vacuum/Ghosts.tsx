"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, Color, ConeGeometry, CylinderGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry, TorusGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { active, type Run } from "./rules";

const WHITE = new Color("#e0e7ff"), GOLD = new Color("#fde047");
export const GHOST_WIDTH = 1, GHOST_HEIGHT = 1.35;
// Features share one instanced additive mesh: sheet, tail, crown, double outline,
// stun outline and the actual angular progress ring. Eyes/smile share a dark draw.
function feature(g: BufferGeometry, kind: number, angular = false): BufferGeometry {
   const pos = g.getAttribute("position"), f = new Float32Array(pos.count), a = new Float32Array(pos.count);
   f.fill(kind);
   for (let i = 0; i < pos.count; i++) a[i] = angular ? (Math.atan2(pos.getY(i), pos.getX(i)) + Math.PI * 2) % (Math.PI * 2) : 0;
   g.setAttribute("feature", new BufferAttribute(f, 1));
   g.setAttribute("arc", new BufferAttribute(a, 1));
   return g;
}
export default function Ghosts({ run }: { run: Run }) {
   const time = useGameTime(), quality = useQuality(), mesh = useRef<InstancedMesh>(null);
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const resources = useMemo(() => {
      const pieces = [
         feature(new SphereGeometry(0.5, 12, 10).scale(1, 0.95, 1).translate(0, 0.875, 0), 0),
         feature(new CylinderGeometry(0.42, 0.38, 0.6, 12).translate(0, 0.3, 0), 0),
         ...[-0.23, 0, 0.23].map((x) => feature(new ConeGeometry(0.12, 0.24, 4).translate(x, 1.4, 0), 1)),
         feature(new TorusGeometry(0.54, 0.018, 4, 32).scale(1, 1.1, 1).translate(0, 0.8, 0), 2),
         feature(new TorusGeometry(0.59, 0.018, 4, 32).scale(1, 1.1, 1).translate(0, 0.8, 0), 3),
         feature(new TorusGeometry(0.57, 0.04, 4, 48), 4, true).translate(0, 0.8, 0.05),
      ];
      const geometry = mergeGeometries(pieces)!;
      for (const g of pieces) g.dispose();
      const params = new InstancedBufferAttribute(new Float32Array(12 * 3), 3);
      geometry.setAttribute("ghostParams", params);
      const material = new MeshBasicMaterial({ color: "white", transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false });
      material.onBeforeCompile = (shader) => {
         shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
attribute float feature; attribute float arc; attribute vec3 ghostParams; varying float vFeature; varying float vArc; varying vec3 vGhost;`);
         shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
vFeature = feature; vArc = arc; vGhost = ghostParams;`);
         shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
varying float vFeature; varying float vArc; varying vec3 vGhost;`);
         shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
            if (vFeature > 0.5 && vFeature < 1.5 && abs(vGhost.x - 1.0) > 0.1) discard;
            if (vFeature > 1.5 && vFeature < 2.5 && vGhost.z < 0.5 && vGhost.x < 1.5) discard;
            if (vFeature > 2.5 && vFeature < 3.5 && vGhost.x < 1.5) discard;
            if (vFeature > 3.5) {
               if (vGhost.y <= 0.0 || vArc > vGhost.y * 6.2831853) discard;
               diffuseColor.rgb = vec3(0.3, 1.0, 0.65);
            }`);
      };
      return { geometry, material, params, matrix: new Matrix4(), tint: new Color() };
   }, []);
   useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose(); }, [resources]);
   const bob = (i: number) => quality.tier === "low" || reduced ? 0 : Math.sin(time.now * Math.PI * 2 + i / 2) * 0.08;
   useFrame(() => {
      if (!mesh.current) return;
      const { matrix, params, tint } = resources;
      for (const g of run.ghosts) {
         const shown = active(g) && g.mode !== "hidden", s = shown ? g.kind === "big" ? 1.2 : 1 : 0;
         matrix.makeScale(s, s, s).setPosition(g.x, 0.1 + bob(g.id), g.z);
         mesh.current.setMatrixAt(g.id, matrix);
         tint.copy(g.kind === "gold" ? GOLD : WHITE);
         if (g.mode === "stunned" || g.mode === "pulling") tint.multiplyScalar(1.3);
         mesh.current.setColorAt(g.id, tint);
         params.setXYZ(g.id, g.kind === "gold" ? 1 : g.kind === "big" ? 2 : 0, g.mode === "pulling" ? g.progress : 0, g.lit || g.mode === "stunned" || g.mode === "pulling" ? 1 : 0);
      }
      mesh.current.instanceMatrix.needsUpdate = true;
      if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
      params.needsUpdate = true;
   });
   const face = useMemo(() => {
      const pieces = [
         ...[-0.14, 0.14].map((x) => new SphereGeometry(0.055, 8, 6).scale(1, 1.3, 0.6).translate(x, 0.96, 0.47)),
         new TorusGeometry(0.13, 0.018, 4, 12, Math.PI).rotateZ(Math.PI).translate(0, 0.81, 0.49),
      ];
      const geometry = mergeGeometries(pieces)!;
      for (const g of pieces) g.dispose();
      return [{ geometry, material: new MeshBasicMaterial({ color: "#302348" }) }];
   }, []);
   useEffect(() => () => { face[0].geometry.dispose(); face[0].material.dispose(); }, [face]);
   return <group name="ghosts">
      <instancedMesh ref={mesh} args={[resources.geometry, resources.material, 12]} frustumCulled={false} />
      <DynamicInstanced count={12} parts={face} update={(i, m) => {
         const g = run.ghosts[i]; if (!active(g) || g.mode === "hidden") return false;
         const s = g.kind === "big" ? 1.2 : 1;
         m.makeScale(s, s, s).setPosition(g.x, 0.1 + bob(i), g.z);
      }} />
   </group>;
}
