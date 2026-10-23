"use client";

// The suitcase pool (one tinted mesh), one billboard tag atlas, and a gold VIP rim.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { FLIGHTS, POOL, TAG_M, VIP_RIM, type RunState } from "./rules";

const ALONG = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
const ACROSS = new Quaternion().setFromEuler(new Euler(Math.PI / 2, Math.PI / 2, 0, "YXZ"));
/** Gold border around the 0.45 m tag. The old 1.28× quad left about 1 px of rim on a phone. */
const RIM_M = 0.96;

const ATLAS_MAP = /* glsl */ `
#ifdef USE_MAP
   float cell = floor(vCell + 0.5);
   vec4 sampledDiffuseColor = texture2D(map, vec2((vMapUv.x + cell) * 0.25, vMapUv.y));
   diffuseColor *= sampledDiffuseColor;
#endif
`;

/** Black circle, square, triangle, star on the flight colours. One texture, one draw call. */
const drawTagAtlas: CanvasDraw = (ctx, width, height) => {
   const cell = width / 4;
   FLIGHTS.forEach((flight, i) => {
      ctx.fillStyle = flight.color;
      ctx.fillRect(i * cell, 0, cell, height);
      ctx.fillStyle = "#0f172a";
      const cx = i * cell + cell / 2;
      const cy = height / 2;
      const r = cell * 0.3;
      ctx.beginPath();
      if (flight.symbol === "circle") ctx.arc(cx, cy, r, 0, Math.PI * 2);
      else if (flight.symbol === "square") ctx.rect(cx - r, cy - r, r * 2, r * 2);
      else if (flight.symbol === "triangle") {
         ctx.moveTo(cx, cy - r);
         ctx.lineTo(cx - r, cy + r * 0.8);
         ctx.lineTo(cx + r, cy + r * 0.8);
      } else {
         for (let p = 0; p < 10; p++) {
            const rad = p % 2 === 0 ? r : r * 0.42;
            const a = -Math.PI / 2 + (p * Math.PI) / 5;
            const x = cx + Math.cos(a) * rad;
            const y = cy + Math.sin(a) * rad;
            if (p === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
         }
      }
      ctx.closePath();
      ctx.fill();
   });
};

function bindAtlas(material: MeshBasicMaterial | null) {
   if (!material || material.userData.cellAtlas) return;
   material.userData.cellAtlas = 1;
   material.customProgramCacheKey = () => "luggage-tag-atlas";
   material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
         .replace("#include <common>", "#include <common>\nattribute float cell;\nvarying float vCell;")
         .replace("#include <uv_vertex>", "#include <uv_vertex>\nvCell = cell;");
      shader.fragmentShader = shader.fragmentShader
         .replace("#include <common>", "#include <common>\nvarying float vCell;")
         .replace("#include <map_fragment>", ATLAS_MAP);
   };
   material.needsUpdate = true;
}

export function Bags({ run }: { run: RunState }) {
   const camera = useThree((state) => state.camera);
   const [scratch] = useState(() => ({
      m: new Matrix4(),
      q: new Quaternion(),
      p: new Vector3(),
      s: new Vector3(1, 1, 1),
      tag: new Vector3(TAG_M, TAG_M, 1),
      rim: new Vector3(RIM_M, RIM_M, 1),
      spin: new Quaternion(),
      colors: FLIGHTS.map((flight) => new Color(flight.color)),
   }));

   const place = useCallback(
      (index: number, matrix: Matrix4, color: Color): boolean | void => {
         const bag = run.bags[index];
         if (!bag.alive && !(bag.tumble > 0)) return false;
         const { p, q, spin } = scratch;
         const chute = bag.segment === 2 || bag.segment === 3 || bag.segment === 5 || bag.segment === 7;
         q.copy(chute ? ACROSS : ALONG);
         if (bag.tumble > 0) {
            spin.setFromAxisAngle(p.set(1, 0.2, 0.4).normalize(), bag.tumble * 14);
            q.multiply(spin);
         }
         p.set(bag.x, bag.y + 0.14, bag.z);
         matrix.compose(p, q, scratch.s);
         color.copy(scratch.colors[bag.flight] ?? scratch.colors[0]);
      },
      [run, scratch]
   );

   const rim = useCallback(
      (index: number, matrix: Matrix4): boolean | void => {
         const bag = run.bags[index];
         if (!bag.alive || !bag.vip) return false;
         const { p, q } = scratch;
         q.copy(camera.quaternion);
         p.set(bag.x, bag.y + 0.6, bag.z);
         matrix.compose(p, q, scratch.rim);
      },
      [camera, run, scratch]
   );

   return (
      <group name="bags">
         <DynamicInstancedModel asset={ASSETS.suitcase} count={POOL} update={place} tinted name="suitcases" />
         <DynamicInstanced count={POOL} update={rim} name="vip-rim">
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={VIP_RIM} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
         </DynamicInstanced>
         <TagAtlas run={run} scratch={scratch} camera={camera} />
      </group>
   );
}

function TagAtlas({
   run,
   scratch,
   camera,
}: {
   run: RunState;
   scratch: { m: Matrix4; q: Quaternion; p: Vector3; tag: Vector3 };
   camera: { quaternion: Quaternion };
}) {
   const mesh = useRef<InstancedMesh>(null);
   const atlas = useCanvasTexture(512, 128, drawTagAtlas);
   const cell = useMemo(() => new InstancedBufferAttribute(new Float32Array(POOL), 1), []);
   useLayoutEffect(() => {
      const inst = mesh.current;
      if (!inst) return;
      inst.geometry.setAttribute("cell", cell);
      inst.count = 0;
   }, [cell]);
   useFrame(() => {
      const inst = mesh.current;
      if (!inst) return;
      const { m, q, p } = scratch;
      let shown = 0;
      for (let i = 0; i < POOL; i++) {
         const bag = run.bags[i];
         if (!bag.alive) continue;
         q.copy(camera.quaternion);
         p.set(bag.x, bag.y + 0.62, bag.z);
         m.compose(p, q, scratch.tag);
         inst.setMatrixAt(shown, m);
         cell.setX(shown, bag.flight);
         shown++;
      }
      inst.count = shown;
      inst.instanceMatrix.needsUpdate = true;
      cell.needsUpdate = true;
   });
   return (
      <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false} name="tags">
         <planeGeometry args={[1, 1]} />
         <meshBasicMaterial
            ref={bindAtlas}
            map={atlas}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
         />
      </instancedMesh>
   );
}
