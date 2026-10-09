"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Color, DoubleSide, ConeGeometry, CylinderGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, ShaderMaterial, SphereGeometry, TorusGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { active, type Run } from "./rules";
import { ASSETS } from "./assets";
import { createSuckLook, FLOAT, suckIn, suckLook, suckMatrix, SUCK, type SuckShared } from "./suck";

// Per-copy tints multiply the GLB texture (pale lilac): gold is pushed past 1 so it reads gold, not olive.
const WHITE = new Color("#e0e7ff"), GOLD = new Color(1.6, 1.1, 0.12), CROWN = new Color("#fde047");
export const GHOST_WIDTH = 1, GHOST_HEIGHT = 1.35;
// The body is the Hyper3D ghost GLB as one instanced pool (<DynamicInstancedModel>, per-copy
// tint: lilac-white, gold, brighter when stunned or pulled); the old procedural sheet + face
// are its stand-in parts. Crown, exposure outline and big double outline share one instanced
// additive mesh over either body. Ghosts float (FLOAT) over one instanced soft shadow pool.
// The pull progress ring is its own
// camera-facing instanced draw (only while a pull runs or a capture pops), drawn over
// everything so it reads on any floor.
function feature(g: BufferGeometry, kind: number): BufferGeometry {
   const pos = g.getAttribute("position"), f = new Float32Array(pos.count);
   f.fill(kind);
   g.setAttribute("feature", new BufferAttribute(f, 1));
   return g;
}
// Ring bands (metres at ghost scale 1): 0 soft outer glow, 1 dark outline track, 2 the
// progress arc (mint with a white core). `arc` runs 0..1 clockwise from the top.
export const RING_BANDS = [[0.64, 0.84, 0], [0.42, 0.72, 1], [0.47, 0.67, 2]] as const;
const RING_SEGMENTS = 64;
function ringGeometry(): BufferGeometry {
   const verts = RING_BANDS.length * (RING_SEGMENTS + 1) * 2;
   const position = new Float32Array(verts * 3), arc = new Float32Array(verts), radial = new Float32Array(verts), band = new Float32Array(verts), index: number[] = [];
   let v = 0;
   for (const [inner, outer, kind] of RING_BANDS) {
      const start = v;
      for (let i = 0; i <= RING_SEGMENTS; i++) {
         const t = i / RING_SEGMENTS, a = t * Math.PI * 2;
         for (let j = 0; j < 2; j++) {
            const r = j ? outer : inner;
            position[v * 3] = Math.sin(a) * r; position[v * 3 + 1] = Math.cos(a) * r; position[v * 3 + 2] = 0;
            arc[v] = t; radial[v] = j; band[v] = kind; v++;
         }
         if (i) { const b = start + (i - 1) * 2; index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
   }
   const g = new BufferGeometry();
   g.setAttribute("position", new BufferAttribute(position, 3));
   g.setAttribute("arc", new BufferAttribute(arc, 1));
   g.setAttribute("radial", new BufferAttribute(radial, 1));
   g.setAttribute("band", new BufferAttribute(band, 1));
   g.setIndex(index);
   return g;
}
const POP_SECONDS = 0.28;
export default function Ghosts({ run, shared }: { run: Run; shared: SuckShared }) {
   const time = useGameTime(), quality = useQuality(), mesh = useRef<InstancedMesh>(null), rings = useRef<InstancedMesh>(null);
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const resources = useMemo(() => {
      const pieces = [
         ...[-0.23, 0, 0.23].map((x) => feature(new ConeGeometry(0.12, 0.24, 4).translate(x, 1.56, 0), 1)),
         feature(new TorusGeometry(0.54, 0.018, 4, 32).scale(1, 1.1, 1).translate(0, 0.8, 0), 2),
         feature(new TorusGeometry(0.59, 0.018, 4, 32).scale(1, 1.1, 1).translate(0, 0.8, 0), 3),
      ];
      const geometry = mergeGeometries(pieces)!;
      for (const g of pieces) g.dispose();
      const params = new InstancedBufferAttribute(new Float32Array(12 * 3), 3);
      geometry.setAttribute("ghostParams", params);
      const material = new MeshBasicMaterial({ color: "white", transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false });
      material.onBeforeCompile = (shader) => {
         shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
attribute float feature; attribute vec3 ghostParams; varying float vFeature; varying vec3 vGhost;`);
         shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
vFeature = feature; vGhost = ghostParams;`);
         shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
varying float vFeature; varying vec3 vGhost;`);
         shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
            if (vFeature > 0.5 && vFeature < 1.5 && abs(vGhost.x - 1.0) > 0.1) discard;
            if (vFeature > 1.5 && vFeature < 2.5 && vGhost.z < 0.5 && vGhost.x < 1.5) discard;
            if (vFeature > 2.5 && vGhost.x < 1.5) discard;`);
      };
      const ring = ringGeometry(), ringParams = new InstancedBufferAttribute(new Float32Array(12 * 2), 2);
      ring.setAttribute("ringParams", ringParams);
      const ringMaterial = new ShaderMaterial({
         transparent: true, depthTest: false, depthWrite: false, side: DoubleSide,
         vertexShader: `attribute float arc; attribute float radial; attribute float band; attribute vec2 ringParams;
varying float vArc; varying float vRadial; varying float vBand; varying vec2 vRing;
void main() {
   vArc = arc; vRadial = radial; vBand = band; vRing = ringParams;
   gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,
         fragmentShader: `varying float vArc; varying float vRadial; varying float vBand; varying vec2 vRing;
void main() {
   vec3 mint = vec3(0.43, 1.0, 0.76);
   float fade = vRing.y, done = step(vArc, vRing.x);
   if (vBand < 0.5) { if (done < 0.5) discard; gl_FragColor = vec4(mint, (1.0 - vRadial) * 0.55 * fade); return; }
   if (vBand < 1.5) { gl_FragColor = vec4(0.07, 0.04, 0.18, 0.78 * fade); return; }
   float core = 1.0 - abs(vRadial * 2.0 - 1.0);
   gl_FragColor = done > 0.5 ? vec4(mix(mint, vec3(1.0), core * core), fade) : vec4(mint * 0.8, 0.25 * fade);
}`,
      });
      return {
         geometry, material, params, ring, ringMaterial, ringParams, matrix: new Matrix4(), tint: new Color(),
         looks: Array.from({ length: 12 }, () => new Matrix4()), shown: new Array<boolean>(12).fill(false), look: createSuckLook(), cells: new Array<number>(16).fill(0),
         was: new Array<string>(12).fill(""), popAt: new Array<number>(12).fill(-1),
         pop: Array.from({ length: 12 }, () => new Vector3()), centre: Array.from({ length: 12 }, () => new Vector3()),
         ringPos: new Vector3(), ringScale: new Vector3(), tints: Array.from({ length: 12 }, () => new Color()), scales: new Array<number>(12).fill(1),
      };
   }, []);
   useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose(); resources.ring.dispose(); resources.ringMaterial.dispose(); }, [resources]);
   const bob = (i: number) => quality.tier === "low" || reduced ? 0 : Math.sin(time.now * Math.PI * 1.4 + i / 2) * FLOAT.bob;
   // After the camera (-0.25) and Hunter's nozzle mouth (-0.05); before every visuals frame,
   // so the face pool (visuals) copies this frame's matrices.
   useFrame(({ camera }) => {
      const r = resources;
      let best = -1;
      shared.active = false;
      for (const g of run.ghosts) {
         const shown = active(g) && g.mode !== "hidden", ks = g.kind === "big" ? 1.2 : 1, i = g.id;
         r.shown[i] = shown;
         if (g.mode === "caught" && r.was[i] === "pulling") { r.popAt[i] = time.now; r.pop[i].copy(r.centre[i]); }
         r.was[i] = g.mode;
         if (!shown) { r.looks[i].makeScale(0, 0, 0); continue; }
         const base = FLOAT.hover + bob(i), restY = base + SUCK.centreY * ks;
         if (g.mode === "pulling") {
            suckLook(g.progress, g.x, g.z, ks, restY, run.hunter.x, run.hunter.z, shared.mouth, r.look);
            r.looks[i].fromArray(suckMatrix(r.look, r.cells));
            r.centre[i].set(r.look.x, r.look.y, r.look.z); r.scales[i] = r.look.scale;
            if (best < 0 || g.progress > run.ghosts[best].progress) {
               best = i; shared.active = true; shared.p = g.progress; shared.cx = r.look.x; shared.cy = r.look.y; shared.cz = r.look.z; shared.scale = r.look.scale;
            }
         } else {
            r.looks[i].makeScale(ks, ks, ks).setPosition(g.x, base, g.z);
            r.centre[i].set(g.x, restY, g.z); r.scales[i] = ks;
         }
      }
      const body = mesh.current, ringMesh = rings.current;
      if (body) {
         for (const g of run.ghosts) {
            body.setMatrixAt(g.id, r.looks[g.id]);
            const tint = r.tints[g.id].copy(g.kind === "gold" ? GOLD : WHITE);
            if (g.mode === "stunned" || g.mode === "pulling") tint.multiplyScalar(1.3);
            // The additive crown/outlines keep the plain gold (a tint past 1 would burn them white).
            body.setColorAt(g.id, g.kind === "gold" ? r.tint.copy(CROWN).multiplyScalar(g.mode === "stunned" || g.mode === "pulling" ? 1.3 : 1) : tint);
            r.params.setXYZ(g.id, g.kind === "gold" ? 1 : g.kind === "big" ? 2 : 0, 0, g.lit || g.mode === "stunned" || g.mode === "pulling" ? 1 : 0);
         }
         body.instanceMatrix.needsUpdate = true;
         if (body.instanceColor) body.instanceColor.needsUpdate = true;
         r.params.needsUpdate = true;
      }
      if (ringMesh) {
         let n = 0;
         for (const g of run.ghosts) {
            const i = g.id, ks = g.kind === "big" ? 1.2 : 1;
            let progress: number, fade: number, size: number;
            if (g.mode === "pulling" && r.shown[i]) { progress = g.progress; fade = 1; size = ks * (1 - 0.15 * suckIn(g.progress)); r.ringPos.copy(r.centre[i]); }
            else if (r.popAt[i] >= 0 && time.now - r.popAt[i] < POP_SECONDS) {
               // Capture pop: the full ring flashes outwards and fades (steady under reduced motion).
               const t = reduced ? 0 : (time.now - r.popAt[i]) / POP_SECONDS;
               progress = 1; fade = 1 - t; size = ks * (0.85 + 0.75 * t); r.ringPos.copy(r.pop[i]);
            } else continue;
            r.ringScale.set(size, size, size);
            r.matrix.compose(r.ringPos, camera.quaternion, r.ringScale);
            ringMesh.setMatrixAt(n, r.matrix);
            r.ringParams.setXY(n, progress, fade);
            n++;
         }
         ringMesh.count = n; ringMesh.visible = n > 0;
         ringMesh.instanceMatrix.needsUpdate = true; r.ringParams.needsUpdate = true;
      }
   }, -0.02);
   // Stand-in while the GLB is missing or broken: the old procedural sheet and its face.
   const sheet = useMemo<InstancePart[]>(() => {
      const bodyPieces = [new SphereGeometry(0.5, 12, 10).scale(1, 0.95, 1).translate(0, 0.875, 0), new CylinderGeometry(0.42, 0.38, 0.6, 12).translate(0, 0.3, 0)];
      const facePieces = [
         ...[-0.14, 0.14].map((x) => new SphereGeometry(0.055, 8, 6).scale(1, 1.3, 0.6).translate(x, 0.96, 0.47)),
         new TorusGeometry(0.13, 0.018, 4, 12, Math.PI).rotateZ(Math.PI).translate(0, 0.81, 0.49),
      ];
      const body = mergeGeometries(bodyPieces)!, face = mergeGeometries(facePieces)!;
      for (const g of [...bodyPieces, ...facePieces]) g.dispose();
      return [
         { geometry: body, material: new MeshBasicMaterial({ color: "white", transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }) },
         { geometry: face, material: new MeshBasicMaterial({ color: "#302348" }) },
      ];
   }, []);
   useEffect(() => () => { for (const part of sheet) { part.geometry.dispose(); (part.material as MeshBasicMaterial).dispose(); } }, [sheet]);
   const shadow = useMemo(() => ({ geometry: new CircleGeometry(0.42, 20).rotateX(-Math.PI / 2), material: new MeshBasicMaterial({ color: "#0b0618", transparent: true, opacity: 0.32, depthWrite: false }) }), []);
   useEffect(() => () => { shadow.geometry.dispose(); shadow.material.dispose(); }, [shadow]);
   return <group name="ghosts">
      <instancedMesh ref={mesh} args={[resources.geometry, resources.material, 12]} frustumCulled={false} />
      <DynamicInstancedModel asset={ASSETS.ghost} count={12} fallbackParts={sheet} tinted update={(i, m, color) => {
         if (!resources.shown[i]) return false;
         m.copy(resources.looks[i]);
         color.copy(resources.tints[i]);
      }} />
      <DynamicInstanced count={12} update={(i, m) => {
         // Soft ground shadow under the floating ghost (smaller as it rises or shrinks).
         if (!resources.shown[i]) return false;
         const c = resources.centre[i], size = resources.scales[i] * (1 - 0.35 * Math.min(1, Math.max(0, c.y - SUCK.centreY) / 1.2));
         m.makeScale(size, 1, size).setPosition(c.x, 0.025, c.z);
      }}><primitive object={shadow.geometry} attach="geometry" /><primitive object={shadow.material} attach="material" /></DynamicInstanced>
      <instancedMesh ref={rings} args={[resources.ring, resources.ringMaterial, 12]} frustumCulled={false} renderOrder={20} visible={false} />
   </group>;
}
