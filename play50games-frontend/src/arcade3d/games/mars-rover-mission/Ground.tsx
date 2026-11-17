"use client";

// The Mars ground: one mesh from the run's height field (terrain.ts): dunes on the plain, terraced cliffs
// beyond it, the far plateau melting into the haze. A regolith canvas tile gives the grain; vertex colours
// shade the dune crests, the cliff faces and the strata.
import { useEffect, useMemo } from "react";
import { BufferGeometry, Color, Float32BufferAttribute, RepeatWrapping, Vector3 } from "three";
import { useCanvasTexture } from "@/arcade3d/core/render";
import type { MarsLevel } from "./levels";
import { COLORS } from "./looks";
import type { HeightFn } from "./terrain";

/** Grid lines along one axis: 1.25 m over the plain and its cliffs, 4 m out on the plateau. */
export function terrainAxis(half: number, inner = 18, outer = 110): number[] {
   const out: number[] = [];
   const a = half + inner;
   const b = half + outer;
   for (let v = -b; v < -a; v += 4) out.push(v);
   for (let v = -a; v < a; v += 1.25) out.push(v);
   for (let v = a; v <= b; v += 4) out.push(v);
   return out;
}

const C_GROUND = new Color();
const C_CREST = new Color();
const C_CLIFF = new Color();
const C_STRATA = new Color();
const C = new Color();
const N = new Vector3();

/** The terrain geometry (positions, normals, world uvs of a 16 m tile, vertex colours). */
export function buildTerrain(level: MarsLevel, height: HeightFn): BufferGeometry {
   const xs = terrainAxis(level.width / 2);
   const zs = terrainAxis(level.depth / 2);
   const nx = xs.length;
   const nz = zs.length;
   const pos = new Float32Array(nx * nz * 3);
   const uv = new Float32Array(nx * nz * 2);
   const col = new Float32Array(nx * nz * 3);
   for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
         const k = j * nx + i;
         const x = xs[i];
         const z = zs[j];
         pos[3 * k] = x;
         pos[3 * k + 1] = height(x, z);
         pos[3 * k + 2] = z;
         uv[2 * k] = x / 16;
         uv[2 * k + 1] = -z / 16;
      }
   }
   const index: number[] = [];
   for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
         const a = j * nx + i;
         const b = a + 1;
         const c = a + nx;
         const d = c + 1;
         index.push(a, c, b, b, c, d);
      }
   }
   const geo = new BufferGeometry();
   geo.setIndex(index);
   geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
   geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
   geo.computeVertexNormals();
   const normals = geo.getAttribute("normal");
   C_GROUND.set("#ffffff");
   C_CREST.set("#ffe2c4");
   C_CLIFF.set("#b9775a");
   C_STRATA.set("#f2c29a");
   for (let k = 0; k < nx * nz; k++) {
      N.set(normals.getX(k), normals.getY(k), normals.getZ(k));
      const h = pos[3 * k + 1];
      const slope = Math.min(1, Math.max(0, (1 - N.y) * 3.2));
      C.copy(C_GROUND);
      // dune crests catch dust, troughs hold shadow
      if (h > 0) C.lerp(C_CREST, Math.min(1, h * 0.9));
      else C.multiplyScalar(1 + Math.max(-0.18, h * 0.35));
      // cliff faces darker and redder, ledges banded with pale strata
      C.lerp(C_CLIFF, slope * 0.85);
      if (h > 1.2) C.lerp(C_STRATA, 0.25 * (0.5 + 0.5 * Math.sin(h * 2.4)) * (1 - slope));
      col[3 * k] = C.r;
      col[3 * k + 1] = C.g;
      col[3 * k + 2] = C.b;
   }
   geo.setAttribute("color", new Float32BufferAttribute(col, 3));
   geo.computeBoundingSphere();
   return geo;
}

/** Regolith: a rust / ochre ground with soft dunes, dust grain, pebbles and a few small rimmed craters. */
function drawRegolith(ctx: CanvasRenderingContext2D, w: number, h: number) {
   let seed = 7;
   const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
   ctx.fillStyle = COLORS.ground;
   ctx.fillRect(0, 0, w, h);
   for (let i = 0; i < 26; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 60 + rnd() * 140;
      const light = i % 2 === 0;
      for (const dx of [-w, 0, w]) {
         for (const dy of [-h, 0, h]) {
            const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
            g.addColorStop(0, light ? "rgba(214, 146, 92, 0.24)" : "rgba(120, 50, 24, 0.2)");
            g.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = g;
            ctx.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
         }
      }
   }
   // wind ripples
   ctx.globalAlpha = 0.07;
   ctx.strokeStyle = COLORS.groundDark;
   ctx.lineWidth = 2;
   for (let i = 0; i < 70; i++) {
      const y = rnd() * h;
      const x = rnd() * w;
      ctx.beginPath();
      ctx.moveTo(x - 60, y);
      ctx.quadraticCurveTo(x, y - 6 - rnd() * 6, x + 60, y);
      ctx.stroke();
   }
   for (let i = 0; i < 9000; i++) {
      ctx.globalAlpha = 0.06 + rnd() * 0.1;
      ctx.fillStyle = rnd() < 0.5 ? COLORS.groundLight : COLORS.groundDark;
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
   }
   for (let i = 0; i < 260; i++) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = COLORS.groundDark;
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 1.2 + rnd() * 2.2, 0, Math.PI * 2);
      ctx.fill();
   }
   for (let i = 0; i < 9; i++) {
      const x = 40 + rnd() * (w - 80);
      const y = 40 + rnd() * (h - 80);
      const r = 8 + rnd() * 22;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = COLORS.groundDark;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = COLORS.groundDust;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
   }
   ctx.globalAlpha = 1;
}

export function Terrain({ level, height }: { level: MarsLevel; height: HeightFn }) {
   const geo = useMemo(() => buildTerrain(level, height), [level, height]);
   useEffect(() => () => geo.dispose(), [geo]);
   const regolith = useCanvasTexture(1024, 1024, drawRegolith);
   useMemo(() => {
      regolith.wrapS = RepeatWrapping;
      regolith.wrapT = RepeatWrapping;
      regolith.anisotropy = 4;
      regolith.needsUpdate = true;
   }, [regolith]);
   return (
      <mesh geometry={geo} name="terrain">
         <meshStandardMaterial map={regolith} vertexColors roughness={0.95} metalness={0} />
      </mesh>
   );
}
