// The ninja's eye mask, fitted to the hero mesh in code (QA: the m2Hero GLB has no mask; the plan's
// heroes wear a coloured one). Pure: no three.js. Scene.tsx (Hero) builds a band geometry from
// fitMaskBand(): for every height row and angle around the head, the mesh's outermost vertex near it
// plus a small gap, so the band hugs this head and never sinks into it. Eye holes are cut by the
// band's texture (maskTexture in Hero.tsx) at EYES.
//
// Measured on m2Hero.glb (GLB units, before HERO_SCALE): the head sits on x = 0 around z ≈ 0.12,
// from the neck (y ≈ 1.45) to the crown (1.92); the eyes bulge at about ±45° from the front at
// y ≈ 1.78-1.84 (mask.test.ts checks the fit on the real mesh).

export interface MaskSpec {
   /** band bottom and top (GLB y) */
   yBottom: number;
   yTop: number;
   /** the head's centre line (GLB z, x = 0) the angles are measured around */
   cz: number;
   rows: number;
   segments: number;
   /** gap between the head and the band (GLB units) */
   gap: number;
   /** vertices further out than this are not head (the shell straps behind the shoulders) */
   maxR: number;
}

export const MASK: MaskSpec = { yBottom: 1.725, yTop: 1.855, cz: 0.12, rows: 4, segments: 32, gap: 0.016, maxR: 0.34 };

/** The eye holes: angle from the front (+z, rad, positive towards +x), height (GLB y), radius (GLB units). */
export const EYES = { angle: 0.8, y: 1.8, radius: 0.058 } as const;

/** The angle (rad, 0..2π) of a point around the head's centre line, 0 at the front (+z), growing towards +x. */
export function headAngle(x: number, z: number, cz: number): number {
   const a = Math.atan2(x, z - cz);
   return a < 0 ? a + Math.PI * 2 : a;
}

/**
 * The band's radius per row and segment (rows × segments, row-major, bottom row first), from the
 * mesh's positions (x, y, z triples in GLB units). Empty cells take their neighbours' value; the
 * result is smoothed around the ring (never inwards), then grown by `gap`.
 */
export function fitMaskBand(positions: ArrayLike<number>, spec: MaskSpec = MASK): Float32Array {
   const { rows, segments } = spec;
   const radii = new Float32Array(rows * segments);
   const rowH = (spec.yTop - spec.yBottom) / (rows - 1);
   const halfBand = rowH * 0.75;
   const step = (Math.PI * 2) / segments;
   for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      if (y < spec.yBottom - halfBand || y > spec.yTop + halfBand) continue;
      const dz = z - spec.cz;
      const r = Math.sqrt(x * x + dz * dz);
      if (r > spec.maxR) continue;
      const a = headAngle(x, z, spec.cz);
      const seg = Math.round(a / step) % segments;
      for (let row = 0; row < rows; row++) {
         const ry = spec.yBottom + row * rowH;
         if (Math.abs(y - ry) > halfBand) continue;
         // this vertex and the two neighbouring angles (the band spans between them)
         for (let k = -1; k <= 1; k++) {
            const s = (seg + k + segments) % segments;
            const cell = row * segments + s;
            if (r > radii[cell]) radii[cell] = r;
         }
      }
   }
   // fill holes from the ring
   for (let row = 0; row < rows; row++) {
      for (let pass = 0; pass < segments; pass++) {
         let empty = 0;
         for (let s = 0; s < segments; s++) {
            const cell = row * segments + s;
            if (radii[cell] > 0) continue;
            const l = radii[row * segments + ((s + segments - 1) % segments)];
            const r = radii[row * segments + ((s + 1) % segments)];
            if (l > 0 || r > 0) radii[cell] = Math.max(l, r);
            else empty++;
         }
         if (empty === 0) break;
      }
   }
   // a row with nothing at all copies the nearest row
   for (let row = 0; row < rows; row++) {
      if (radii[row * segments] > 0) continue;
      const from = row > 0 ? row - 1 : row + 1;
      for (let s = 0; s < segments; s++) radii[row * segments + s] = radii[from * segments + s];
   }
   // smooth: the max of a cell and the mean of its neighbours (never inwards), then the gap
   const out = new Float32Array(rows * segments);
   for (let row = 0; row < rows; row++) {
      for (let s = 0; s < segments; s++) {
         const c = radii[row * segments + s];
         const l = radii[row * segments + ((s + segments - 1) % segments)];
         const r = radii[row * segments + ((s + 1) % segments)];
         out[row * segments + s] = Math.max(c, (l + 2 * c + r) / 4) + spec.gap;
      }
   }
   return out;
}

/**
 * The band as plain arrays: (rows × (segments + 1)) vertices (the seam duplicated for the uv),
 * positions in GLB units, uv u = angle / 2π (0 = front), v = 0 bottom .. 1 top, and the triangle
 * indices. Hero.tsx turns them into a BufferGeometry.
 */
export function maskBandMesh(radii: Float32Array, spec: MaskSpec = MASK): { positions: Float32Array; uvs: Float32Array; indices: Uint16Array } {
   const { rows, segments } = spec;
   const cols = segments + 1;
   const positions = new Float32Array(rows * cols * 3);
   const uvs = new Float32Array(rows * cols * 2);
   const rowH = (spec.yTop - spec.yBottom) / (rows - 1);
   for (let row = 0; row < rows; row++) {
      for (let c = 0; c < cols; c++) {
         const s = c % segments;
         const a = (c / segments) * Math.PI * 2;
         const r = radii[row * segments + s];
         const v = row * cols + c;
         positions[v * 3] = Math.sin(a) * r;
         positions[v * 3 + 1] = spec.yBottom + row * rowH;
         positions[v * 3 + 2] = spec.cz + Math.cos(a) * r;
         uvs[v * 2] = c / segments;
         uvs[v * 2 + 1] = row / (rows - 1);
      }
   }
   const indices = new Uint16Array((rows - 1) * segments * 6);
   let k = 0;
   for (let row = 0; row < rows - 1; row++) {
      for (let c = 0; c < segments; c++) {
         const a = row * cols + c;
         const b = a + 1;
         const d = a + cols;
         const e = d + 1;
         indices[k++] = a;
         indices[k++] = d;
         indices[k++] = b;
         indices[k++] = b;
         indices[k++] = d;
         indices[k++] = e;
      }
   }
   return { positions, uvs, indices };
}

/** The back of the band (angle π) at the eye line: where the knot sits and the tails start (GLB units). */
export function knotPoint(radii: Float32Array, spec: MaskSpec = MASK): { y: number; z: number } {
   const s = Math.round(spec.segments / 2);
   const row = Math.floor((spec.rows - 1) / 2);
   return { y: spec.yBottom + ((spec.yTop - spec.yBottom) * row) / (spec.rows - 1), z: spec.cz - radii[row * spec.segments + s] };
}
