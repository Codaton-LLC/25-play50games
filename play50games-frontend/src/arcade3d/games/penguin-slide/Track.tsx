"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color, Matrix4, Quaternion, Vector3, type Group } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { usePropParts } from "./Primitives";
import { CLOCK, corridorAt, chunkAt, safeCentre, sampleTrack, widthAt, worldAt, type Chunk, type Run } from "./rules";

const ROWS = 121;
const COLS = 8;
const ICE = new Color("#8de0ee"), SNOW = new Color("#f0fbff");

function drawIce(ctx: CanvasRenderingContext2D, width: number, height: number) {
   ctx.fillStyle = "#cffafe"; ctx.fillRect(0, 0, width, height);
   ctx.strokeStyle = "#a5edf5"; ctx.lineWidth = 2;
   for (let i = 0; i < 18; i++) {
      const x = (i * 53) % width, y = (i * 97) % height;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 24, y + 35); ctx.lineTo(x + 15, y + 70); ctx.stroke();
   }
}

function trackGeometry(): BufferGeometry {
   const g = new BufferGeometry();
   g.setAttribute("position", new BufferAttribute(new Float32Array(ROWS * COLS * 3), 3));
   g.setAttribute("normal", new BufferAttribute(new Float32Array(ROWS * COLS * 3), 3));
   g.setAttribute("color", new BufferAttribute(new Float32Array(ROWS * COLS * 3), 3));
   const uv = new Float32Array(ROWS * COLS * 2);
   const indices = new Uint16Array((ROWS - 1) * (COLS - 1) * 6);
   let k = 0;
   for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      uv[(row * COLS + col) * 2] = col / (COLS - 1);
      uv[(row * COLS + col) * 2 + 1] = row / 12;
      if (row < ROWS - 1 && col < COLS - 1) {
         const a = row * COLS + col, b = a + 1, c = a + COLS, d = c + 1;
         indices[k++] = a; indices[k++] = b; indices[k++] = c;
         indices[k++] = b; indices[k++] = d; indices[k++] = c;
      }
   }
   g.setAttribute("uv", new BufferAttribute(uv, 2)); g.setIndex(new BufferAttribute(indices, 1));
   return g;
}

function fillTrack(g: BufferGeometry, c: Chunk, p: Vector3, t: Vector3, columns: Float64Array) {
   const pos = g.getAttribute("position"), normal = g.getAttribute("normal"), color = g.getAttribute("color");
   for (let row = 0; row < ROWS; row++) {
      const s = 60 * row / (ROWS - 1);
      const w = widthAt(c, s), island = c.form === "split" ? Math.max(0, Math.abs(safeCentre(c, s, 1) - corridorAt(c, s)) - 1.25) : 0;
      columns[0] = -w - 1.4; columns[1] = -w; columns[2] = -w + 0.2; columns[3] = -island;
      columns[4] = island; columns[5] = w - 0.2; columns[6] = w; columns[7] = w + 1.4;
      for (let col = 0; col < COLS; col++) {
         const d = columns[col] + corridorAt(c, s), i = row * COLS + col;
         sampleTrack(c, s, d, p, t);
         const snowy = col <= 1 || col >= 6 || (island > 0 && (col === 3 || col === 4));
         const lift = col === 0 || col === 7 ? 0.7 : snowy ? 0.08 : 0;
         pos.setXYZ(i, p.x, p.y + lift, -p.z);
         normal.setXYZ(i, 0, 1, 0);
         const tint = snowy ? SNOW : ICE;
         color.setXYZ(i, tint.r, tint.g, tint.b);
      }
   }
   pos.needsUpdate = normal.needsUpdate = color.needsUpdate = true;
}

export default function Track({ run }: { run: Run }) {
   const root = useRef<Group>(null);
   const texture = useCanvasTexture(256, 256, drawIce);
   const { decor } = useQuality();
   const treeCount = scaledCount(10, decor);
   const geometries = useMemo(() => [trackGeometry(), trackGeometry(), trackGeometry()], []);
   const [scratch] = useState(() => ({ p: new Vector3(), tangent: new Vector3(), at: new Vector3(), q: new Quaternion(), scale: new Vector3(1, 1, 1), up: new Vector3(0, 1, 0), columns: new Float64Array(COLS), indices: [-999, -999, -999] }));
   const fishParts = usePropParts("fish"), pineParts = usePropParts("pine"), flagParts = usePropParts("flag");
   const iceParts = usePropParts("ice"), snowmanParts = usePropParts("snowman"), crackParts = usePropParts("crack"), rampParts = usePropParts("ramp");
   useEffect(() => () => { for (const g of geometries) g.dispose(); }, [geometries]);

   useFrame(() => {
      const c = chunkAt(run, run.s);
      sampleTrack(c, run.s - c.index * 60, 0, scratch.p, scratch.tangent, run.branch);
      const yaw = Math.atan2(scratch.tangent.x, scratch.tangent.z), cos = Math.cos(yaw), sin = Math.sin(yaw);
      if (root.current) {
         root.current.rotation.y = yaw;
         root.current.position.set(-cos * scratch.p.x + sin * scratch.p.z, -scratch.p.y, sin * scratch.p.x + cos * scratch.p.z);
      }
      for (let i = 0; i < 3; i++) {
         const chunk = run.chunks[i];
         if (scratch.indices[i] !== chunk.index) {
            fillTrack(geometries[i], chunk, scratch.p, scratch.tangent, scratch.columns);
            scratch.indices[i] = chunk.index;
         }
      }
   });

   const place = (s: number, d: number, matrix: Matrix4, lift = 0, size = 1) => {
      worldAt(run, s, d, scratch.at);
      const c = chunkAt(run, s);
      sampleTrack(c, s - c.index * 60, d, scratch.p, scratch.tangent);
      const here = chunkAt(run, run.s);
      const otherYaw = Math.atan2(scratch.tangent.x, scratch.tangent.z);
      sampleTrack(here, run.s - here.index * 60, 0, scratch.p, scratch.tangent, run.branch);
      const yaw = Math.atan2(scratch.tangent.x, scratch.tangent.z) - otherYaw;
      scratch.q.setFromAxisAngle(scratch.up, yaw);
      scratch.at.y += lift;
      matrix.compose(scratch.at, scratch.q, scratch.scale.setScalar(size));
   };
   const fish = (i: number, m: Matrix4) => {
      const c = run.chunks[Math.floor(i / 12)], f = c.fish[i % 12];
      if (!f || f.used || f.s < run.s - 2) return false;
      place(f.s, f.d, m, 0.3);
   };
   const tree = (i: number, m: Matrix4) => {
      const c = run.chunks[Math.floor(i / 10)], slot = i % 10;
      if (slot >= treeCount) return false;
      const s = c.index * 60 + 3 + Math.floor(slot / 2) * 12;
      place(s, corridorAt(c, s - c.index * 60) + (slot % 2 ? 1 : -1) * 5.2, m, 0, 0.8 + (slot % 3) * 0.2);
   };
   const obstacle = (kind: "ice" | "snowman" | "crack", i: number, m: Matrix4) => {
      const o = run.chunks[Math.floor(i / 5)].obstacles[i % 5];
      if (!o || o.kind !== kind || o.s < run.s - 5) return false;
      place(o.s, o.d, m);
   };
   const ramp = (i: number, m: Matrix4) => {
      const r = run.chunks[i].ramp;
      if (!r || r.s < run.s - 5) return false;
      place(r.s, r.d, m);
   };
   const flag = (i: number, m: Matrix4) => {
      const gate = Math.floor(i / 4), branch = i % 4 < 2 ? -1 : 1, side = i % 2 ? 1 : -1;
      let s = run.gateS;
      for (let j = 0; j < gate; j++) s += CLOCK.gateSpacing + CLOCK.gateGrowth * Math.min((run.gateIndex + j) / CLOCK.gateGrowthCount, 1);
      if (s > (run.chunks[2].index + 1) * 60) return false;
      const c = chunkAt(run, s);
      if (c.form !== "split" && branch === 1) return false;
      if (c === run.chunks[1] && run.branch && branch !== run.branch) return false;
      place(s, safeCentre(c, s - c.index * 60, branch) + side, m);
   };
   const gatePost = (i: number, m: Matrix4) => {
      if (flag(i, m) === false) return false;
      m.scale(scratch.scale.set(0.08, 2.4, 0.08));
   };

   return <group name="glacier">
      <group ref={root}>
         {geometries.map((geometry, i) => <mesh key={i} geometry={geometry} frustumCulled={false}>
            <meshStandardMaterial color="#ffffff" vertexColors map={texture} roughness={0.48} metalness={0.05} />
         </mesh>)}
      </group>
      <DynamicInstancedModel name="fish-trails" asset={ASSETS.fish} count={36} update={fish} fallbackParts={fishParts} />
      <DynamicInstancedModel name="pine-banks" asset={ASSETS.pine} count={30} update={tree} fallbackParts={pineParts} />
      <DynamicInstancedModel name="time-flags" asset={ASSETS.flag} count={12} update={flag} fallbackParts={flagParts} />
      <DynamicInstanced count={15} update={(i, m) => obstacle("ice", i, m)} parts={iceParts} name="ice-blocks" />
      <DynamicInstanced count={15} update={(i, m) => obstacle("snowman", i, m)} parts={snowmanParts} name="snowmen" />
      <DynamicInstanced count={15} update={(i, m) => obstacle("crack", i, m)} parts={crackParts} name="cracks" />
      <DynamicInstanced count={3} update={ramp} parts={rampParts} name="spin-ramps" />
      <DynamicInstanced count={12} update={gatePost} name="gate-posts"><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={0.3} /></DynamicInstanced>
   </group>;
}
