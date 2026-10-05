import { readFile } from "node:fs/promises";
import { Document, NodeIO, Logger } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { center, dedup, getBounds, inspect, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

export async function createIO() {
   await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
   return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder
   });
}

export async function fixturePNG() {
   // A patterned texture survives solid-color pruning, exercising WebP output.
   const pixels = Buffer.alloc(4 * 4 * 4);
   for (let i = 0; i < 16; i++) {
      pixels.set(i % 2 ? [220, 90, 40, 255] : [20, 190, 160, 255], i * 4);
   }
   return sharp(pixels, { raw: { width: 4, height: 4, channels: 4 } }).png().toBuffer();
}

export async function fixtureGLB() {
   const doc = new Document();
   const buffer = doc.createBuffer();
   const positions = doc.createAccessor().setType("VEC3").setArray(new Float32Array([2, 3, 4, 4, 3, 4, 3, 5, 4, 3, 4, 6])).setBuffer(buffer);
   const indices = doc.createAccessor().setType("SCALAR").setArray(new Uint16Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3])).setBuffer(buffer);
   const uv = doc.createAccessor().setType("VEC2").setArray(new Float32Array([0, 0, 1, 0, 0.5, 1, 0.5, 0.5])).setBuffer(buffer);
   const texture = doc.createTexture("mock-texture").setImage(await fixturePNG()).setMimeType("image/png");
   const material = doc.createMaterial("mock-pbr").setBaseColorTexture(texture).setMetallicFactor(0).setRoughnessFactor(0.8);
   const primitive = doc.createPrimitive().setAttribute("POSITION", positions).setAttribute("TEXCOORD_0", uv).setIndices(indices).setMaterial(material);
   const mesh = doc.createMesh("mock-tetrahedron").addPrimitive(primitive);
   doc.createScene("mock-scene").addChild(doc.createNode("mock-model").setMesh(mesh));
   return (await createIO()).writeBinary(doc);
}

export async function readGLB(io, bytes) {
   if (bytes.length < 20 || Buffer.from(bytes.subarray(0, 4)).toString() !== "glTF") { throw new Error("Input is not a GLB"); }
   const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
   if (view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length || view.getUint32(16, true) !== 0x4e4f534a) {
      throw new Error("Invalid GLB header");
   }
   const jsonSize = view.getUint32(12, true);
   const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonSize)));
   if ([...(json.buffers ?? []), ...(json.images ?? [])].some(item => item.uri)) {
      throw new Error("GLB must embed all buffers and textures; external resources are forbidden");
   }
   const doc = await io.readBinary(bytes);
   doc.setLogger(new Logger(Logger.Verbosity.SILENT));
   return doc;
}

export function inspectModel(doc) {
   const scenes = doc.getRoot().listScenes();
   if (!scenes.length) { throw new Error("Model has no scene"); }
   let tris = 0;
   for (const mesh of doc.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
         if (primitive.getMode() !== 4) { throw new Error("Only triangle primitives are supported"); }
         const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0;
         if (count % 3 !== 0) { throw new Error("Malformed triangle primitive"); }
         tris += count / 3;
      }
   }
   if (!tris) { throw new Error("Model has no triangle geometry"); }
   const bounds = getBounds(scenes[0]);
   if (![...bounds.min, ...bounds.max].every(Number.isFinite)) { throw new Error("Invalid model bounds"); }
   return { tris, bounds, inspection: inspect(doc) };
}

export async function optimizeGLB(bytes, asset) {
   const io = await createIO();
   const doc = await readGLB(io, bytes);
   const before = inspectModel(doc);
   await doc.transform(
      dedup(), weld(),
      textureCompress({ encoder: sharp, targetFormat: "webp", resize: [asset.textureSize, asset.textureSize] }),
      simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, asset.budget.tris / before.tris), error: 0.001 }),
      prune(), center({ pivot: "below" }),
      meshopt({ encoder: MeshoptEncoder, level: "medium", quantizePosition: 16 }),
      center({ pivot: "below" })
   );
   const output = await io.writeBinary(doc);
   const decoded = await readGLB(io, output);
   const report = inspectModel(decoded);
   const textureSizes = await Promise.all(decoded.getRoot().listTextures().map(async texture => {
      const meta = await sharp(texture.getImage()).metadata();
      return { mime: texture.getMimeType(), width: meta.width, height: meta.height };
   }));
   const overTextures = textureSizes.some(t => t.mime !== "image/webp" || t.width > asset.textureSize || t.height > asset.textureSize);
   const limitTris = Math.min(asset.budget.tris, asset.kind === "character" ? 20000 : 5000);
   const limitBytes = Math.min(asset.budget.bytes, asset.kind === "character" ? 1500000 : 300000);
   if (report.tris > limitTris || output.length > limitBytes || overTextures) {
      throw new Error(`OVER BUDGET ${asset.id}: ${report.tris}/${limitTris} tris, ${output.length}/${limitBytes} bytes, textures ${overTextures ? "FAIL" : "PASS"}`);
   }
   return { output, report: { ...report, bytes: output.length, textureSizes, beforeTris: before.tris } };
}

export async function validateFile(file) {
   const bytes = new Uint8Array(await readFile(file));
   inspectModel(await readGLB(await createIO(), bytes));
   return bytes;
}
