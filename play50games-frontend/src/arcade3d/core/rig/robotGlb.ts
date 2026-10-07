// The character GLBs for the rig tests (vitest only; the app never imports this file): a GLB under
// public/models/3d read and meshopt-decoded directly, without a loader. Every Rodin character is
// one node (translated so the feet are on y = 0) with one mesh of one primitive, float positions.
import { readFileSync } from "node:fs";
import path from "node:path";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

interface MeshoptView {
   byteOffset?: number;
   byteLength: number;
   byteStride: number;
   count: number;
   mode: string;
   filter?: string;
}

interface GltfJson {
   nodes: Array<{ mesh?: number; translation?: number[] }>;
   meshes: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number }> }>;
   accessors: Array<{ bufferView: number; byteOffset?: number; count: number; componentType: number }>;
   bufferViews: Array<{ byteOffset?: number; byteLength: number; byteStride?: number; extensions?: { EXT_meshopt_compression?: MeshoptView } }>;
}

export interface CharacterGlb {
   /** POSITION as stored (the mesh node's own space) */
   local: Float32Array;
   /** the mesh node's translation */
   node: number[];
   /** positions in the GLB root's space (node translation applied): what the landmarks are measured in */
   cloud: Float32Array;
   /** triangle list (3 vertex indices per triangle) */
   indices: Uint32Array;
   /** the POSITION accessor's component type (5126 = float) */
   positionType: number;
}

/** @deprecated name kept for robot.test.ts; every character reads as a CharacterGlb */
export type RobotGlb = CharacterGlb;

/**
 * Decodes a character GLB's mesh (one primitive: positions and triangle indices). `url` is the
 * asset's url (/models/3d/<slug>/<id>.glb), read from public/.
 */
export async function readCharacterGlb(url: string): Promise<CharacterGlb> {
   const glb = readFileSync(path.join(process.cwd(), "public", url));
   const jsonLength = glb.readUInt32LE(12);
   const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8")) as GltfJson;
   const binStart = 20 + jsonLength + 8;
   await MeshoptDecoder.ready;
   const viewBytes = (index: number): Uint8Array => {
      const view = json.bufferViews[index];
      const meshopt = view.extensions?.EXT_meshopt_compression;
      if (!meshopt) return new Uint8Array(glb.buffer, glb.byteOffset + binStart + (view.byteOffset ?? 0), view.byteLength).slice();
      const data = new Uint8Array(meshopt.count * meshopt.byteStride);
      const source = new Uint8Array(glb.buffer, glb.byteOffset + binStart + (meshopt.byteOffset ?? 0), meshopt.byteLength);
      MeshoptDecoder.decodeGltfBuffer(data, meshopt.count, meshopt.byteStride, source, meshopt.mode, meshopt.filter ?? "NONE");
      return data;
   };
   const node = json.nodes.find((n) => n.mesh === 0)!;
   const primitive = json.meshes[0].primitives[0];

   const accessor = json.accessors[primitive.attributes.POSITION];
   const view = json.bufferViews[accessor.bufferView];
   const data = viewBytes(accessor.bufferView);
   const stride = (view.byteStride ?? view.extensions?.EXT_meshopt_compression?.byteStride ?? 12) / 4;
   const floats = new Float32Array(data.buffer, data.byteOffset + (accessor.byteOffset ?? 0), (accessor.count - 1) * stride + 3);
   const local = new Float32Array(accessor.count * 3);
   for (let i = 0; i < accessor.count; i++) for (let a = 0; a < 3; a++) local[i * 3 + a] = floats[i * stride + a];

   const t = node.translation ?? [0, 0, 0];
   const cloud = Float32Array.from(local, (v, i) => v + t[i % 3]);

   const ia = json.accessors[primitive.indices!];
   const ib = viewBytes(ia.bufferView);
   const indices =
      ia.componentType === 5125
         ? Uint32Array.from(new Uint32Array(ib.buffer, ib.byteOffset + (ia.byteOffset ?? 0), ia.count))
         : Uint32Array.from(new Uint16Array(ib.buffer, ib.byteOffset + (ia.byteOffset ?? 0), ia.count));
   return { local, node: t, cloud, indices, positionType: accessor.componentType };
}

/** Decodes the shared robot.glb (public/models/3d/shared/robot.glb). */
export function readRobotGlb(): Promise<CharacterGlb> {
   return readCharacterGlb("/models/3d/shared/robot.glb");
}
