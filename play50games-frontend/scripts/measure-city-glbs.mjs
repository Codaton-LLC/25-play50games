import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const dir = path.resolve("public/models/3d/color-city-sprint");
await MeshoptDecoder.ready;

function boundsOf(file) {
   const glb = readFileSync(file);
   const jsonLength = glb.readUInt32LE(12);
   const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
   const binStart = 20 + jsonLength + 8;
   const viewBytes = (index) => {
      const view = json.bufferViews[index];
      const meshopt = view.extensions?.EXT_meshopt_compression;
      if (!meshopt) return new Uint8Array(glb.buffer, glb.byteOffset + binStart + (view.byteOffset ?? 0), view.byteLength).slice();
      const data = new Uint8Array(meshopt.count * meshopt.byteStride);
      const source = new Uint8Array(glb.buffer, glb.byteOffset + binStart + (meshopt.byteOffset ?? 0), meshopt.byteLength);
      MeshoptDecoder.decodeGltfBuffer(data, meshopt.count, meshopt.byteStride, source, meshopt.mode, meshopt.filter ?? "NONE");
      return data;
   };
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   let tris = 0;
   const nodes = json.nodes ?? [];
   for (const node of nodes) {
      if (node.mesh === undefined) continue;
      const t = node.translation ?? [0, 0, 0];
      const mesh = json.meshes[node.mesh];
      for (const primitive of mesh.primitives) {
         const accessor = json.accessors[primitive.attributes.POSITION];
         const view = json.bufferViews[accessor.bufferView];
         const data = viewBytes(accessor.bufferView);
         const stride = (view.byteStride ?? view.extensions?.EXT_meshopt_compression?.byteStride ?? 12) / 4;
         const floats = new Float32Array(data.buffer, data.byteOffset + (accessor.byteOffset ?? 0), (accessor.count - 1) * stride + 3);
         for (let i = 0; i < accessor.count; i++) {
            for (let a = 0; a < 3; a++) {
               const v = floats[i * stride + a] + t[a];
               if (v < min[a]) min[a] = v;
               if (v > max[a]) max[a] = v;
            }
         }
         if (primitive.indices !== undefined) {
            const ia = json.accessors[primitive.indices];
            tris += ia.count / 3;
         }
      }
   }
   const size = max.map((v, k) => v - min[k]);
   return { file: path.basename(file), size, min, max, tris: Math.round(tris), meshes: (json.meshes ?? []).length };
}

for (const name of readdirSync(dir).filter((n) => n.endsWith(".glb"))) {
   const b = boundsOf(path.join(dir, name));
   console.log(JSON.stringify(b));
}
