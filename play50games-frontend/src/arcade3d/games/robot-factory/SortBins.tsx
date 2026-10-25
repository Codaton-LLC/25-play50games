"use client";

// The four sorter bins (levels 4-5). Code stand-ins: a dark steel body, a colour core and a light
// lip, plus a plate that shows the same colour, the part's icon and the digit 1-4. Keyboard and
// touch read that one plate. Built once; nothing here runs per frame.
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { COLORS } from "./looks";
import { SORTER, SORT_BINS, sortBinCenter, sorterLabelEnds } from "./rules";

function tone(geometry: BufferGeometry, color: string): BufferGeometry {
   const flat = geometry.index ? geometry.toNonIndexed() : geometry;
   if (flat !== geometry) geometry.dispose();
   const c = new Color(color);
   const n = flat.getAttribute("position").count;
   const colors = new Float32Array(n * 3);
   for (let i = 0; i < n; i++) c.toArray(colors, i * 3);
   flat.setAttribute("color", new BufferAttribute(colors, 3));
   return flat;
}

function rounded(w: number, h: number, d: number, x: number, y: number, z: number, color: string): BufferGeometry {
   const radius = Math.min(w, h, d) * 0.12;
   const g = new RoundedBoxGeometry(w, h, d, 2, radius);
   return tone(g.translate(x, y, z), color);
}

function buildBody(): BufferGeometry {
   const parts: BufferGeometry[] = [];
   const h = SORTER.BIN_H;
   const w = SORTER.BIN_W;
   const d = SORTER.BIN_D;
   for (let i = 0; i < SORTER.BINS; i++) {
      const c = sortBinCenter(i);
      const colour = COLORS.parts[SORT_BINS[i].colour];
      parts.push(rounded(w, h * 0.88, d, c.x, h * 0.44, SORTER.BIN_Z, COLORS.steelDark));
      parts.push(rounded(w * 0.72, h * 0.48, d * 0.62, c.x, h * 0.58, SORTER.BIN_Z, colour));
      parts.push(rounded(w * 0.92, 0.06, d * 0.92, c.x, h * 0.9, SORTER.BIN_Z, COLORS.steel));
      parts.push(rounded(w * 0.5, 0.045, d * 0.42, c.x, h * 0.95, SORTER.BIN_Z, COLORS.frame));
   }
   const merged = mergeGeometries(parts, false)!;
   for (const g of parts) g.dispose();
   return merged;
}

function buildLabel(): BufferGeometry {
   const positions: number[] = [];
   const uvs: number[] = [];
   const bottom = { x: 0, y: 0, z: 0 };
   const top = { x: 0, y: 0, z: 0 };
   const hw = SORTER.LABEL_W / 2;
   for (let i = 0; i < SORTER.BINS; i++) {
      sorterLabelEnds(i, bottom, top);
      const u0 = i / SORTER.BINS;
      const u1 = (i + 1) / SORTER.BINS;
      const quad = [
         [bottom.x - hw, bottom.y, bottom.z, u0, 0],
         [bottom.x + hw, bottom.y, bottom.z, u1, 0],
         [top.x + hw, top.y, top.z, u1, 1],
         [bottom.x - hw, bottom.y, bottom.z, u0, 0],
         [top.x + hw, top.y, top.z, u1, 1],
         [top.x - hw, top.y, top.z, u0, 1],
      ];
      for (const corner of quad) {
         positions.push(corner[0], corner[1], corner[2]);
         uvs.push(corner[3], corner[4]);
      }
   }
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
   geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
   geometry.computeVertexNormals();
   return geometry;
}

function icon(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, s: number): void {
   ctx.beginPath();
   if (kind === 0) {
      ctx.ellipse(x, y, s * 0.55, s * 0.85, 0, 0, Math.PI * 2);
   } else if (kind === 1) {
      ctx.roundRect(x - s * 0.45, y - s * 0.7, s * 0.9, s * 1.35, s * 0.15);
      ctx.moveTo(x - s * 0.2, y - s * 0.7);
      ctx.lineTo(x - s * 0.2, y - s * 0.95);
      ctx.lineTo(x + s * 0.2, y - s * 0.95);
      ctx.lineTo(x + s * 0.2, y - s * 0.7);
   } else if (kind === 2) {
      ctx.arc(x, y + s * 0.15, s * 0.7, Math.PI, 0);
      ctx.lineTo(x + s * 0.7, y + s * 0.45);
      ctx.lineTo(x - s * 0.7, y + s * 0.45);
   } else {
      ctx.moveTo(x - s * 0.7, y - s * 0.2);
      ctx.lineTo(x - s * 0.1, y + s * 0.7);
      ctx.lineTo(x + s * 0.15, y + s * 0.15);
      ctx.lineTo(x + s * 0.7, y + s * 0.55);
      ctx.lineTo(x + s * 0.15, y - s * 0.15);
      ctx.lineTo(x - s * 0.15, y - s * 0.7);
   }
   ctx.closePath();
   ctx.fill();
}

function drawBinAtlas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
   const cell = width / SORTER.BINS;
   for (let i = 0; i < SORTER.BINS; i++) {
      const bin = SORT_BINS[i];
      const x = i * cell;
      ctx.fillStyle = COLORS.parts[bin.colour];
      ctx.fillRect(x, 0, cell, height);
      ctx.fillStyle = COLORS.frame;
      ctx.fillRect(x + 10, 10, cell - 20, height - 20);
      ctx.fillStyle = COLORS.white;
      icon(ctx, bin.kind, x + cell * 0.5, height * 0.36, cell * 0.22);
      ctx.fillStyle = COLORS.white;
      ctx.font = "700 72px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x + cell * 0.5, height * 0.78);
   }
}

export function SortBins() {
   const body = useMemo(buildBody, []);
   const label = useMemo(buildLabel, []);
   const map = useCanvasTexture(512, 160, drawBinAtlas);
   useEffect(() => () => {
      body.dispose();
      label.dispose();
   }, [body, label]);
   return (
      <group>
         <mesh geometry={body}>
            <meshStandardMaterial vertexColors roughness={0.4} metalness={0.06} />
         </mesh>
         <mesh geometry={label}>
            <meshBasicMaterial map={map} toneMapped={false} side={DoubleSide} />
         </mesh>
      </group>
   );
}
