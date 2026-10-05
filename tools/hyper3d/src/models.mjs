import { readFile } from "node:fs/promises";
import { Document, NodeIO, Logger } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { center, cloneDocument, dedup, getBounds, inspect, prune, quantize, reorder, simplify, textureCompress, weld } from "@gltf-transform/functions";
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
   let json;
   try { json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonSize))); }
   catch { throw new Error("Invalid GLB JSON"); }
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
   let doc = await readGLB(io, bytes);
   const before = inspectModel(doc);
   const rigged = doc.getRoot().listSkins().length > 0 || asset.rigged === true;
   const limitTris = Math.min(asset.budget.tris, asset.kind === "character" ? 20000 : 5000);
   const limitBytes = Math.min(asset.budget.bytes, asset.kind === "character" ? 1500000 : 300000);
   let simplificationError = null;
   if (rigged && before.tris > limitTris) {
      throw new Error(`OVER BUDGET ${asset.id}: ${before.tris}/${limitTris} tris; rigged geometry cannot be decimated`);
   }
   await doc.transform(
      dedup(),
      textureCompress({ encoder: sharp, targetFormat: "webp", resize: [asset.textureSize, asset.textureSize] })
   );
   if (!rigged) {
      await doc.transform(weld());
      const sourceTris = inspectModel(doc).tris;
      if (sourceTris > limitTris) {
         // Restart from the same geometry at each tolerance; never compound loss.
         const source = doc;
         for (const error of [0.001, 0.005, 0.01, 0.02, 0.05]) {
            const candidate = cloneDocument(source);
            await candidate.transform(simplify({ simplifier: MeshoptSimplifier, ratio: limitTris / sourceTris, error }));
            doc = candidate;
            simplificationError = error;
            if (inspectModel(candidate).tris <= limitTris) { break; }
         }
         if (inspectModel(doc).tris > limitTris) {
            throw new Error(`OVER BUDGET ${asset.id}: ${inspectModel(doc).tris}/${limitTris} tris after simplify error=0.05`);
         }
      }
   }
   await doc.transform(prune(), center({ pivot: "below" }));
   // Position quantization compensates skinned meshes through inverse bind matrices.
   // Keep positions as floats so rest-pose bounds remain usable without re-centering.
   const otherAttributes = /^(?!POSITION$).*/;
   await doc.transform(
      reorder({ encoder: MeshoptEncoder, target: "size" }),
      quantize({ pattern: otherAttributes, patternTargets: otherAttributes })
   );
   // quantize() only declares KHR_mesh_quantization when POSITION is quantized. Positions stay float
   // here, so declare it ourselves whenever another attribute (NORMAL, TANGENT, TEXCOORD) was packed.
   const packed = doc.getRoot().listMeshes().some(mesh => mesh.listPrimitives().some(prim =>
      prim.listSemantics().some(semantic => semantic !== "POSITION" && !/^(JOINTS|WEIGHTS)_/.test(semantic)
         && prim.getAttribute(semantic).getComponentSize() < 4)));
   if (packed) {
      doc.createExtension(KHRMeshQuantization).setRequired(true);
   }
   doc.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
   const output = await io.writeBinary(doc);
   const decoded = await readGLB(io, output);
   const report = inspectModel(decoded);
   const textureSizes = await Promise.all(decoded.getRoot().listTextures().map(async texture => {
      const meta = await sharp(texture.getImage()).metadata();
      return { mime: texture.getMimeType(), width: meta.width, height: meta.height };
   }));
   const overTextures = textureSizes.some(t => t.mime !== "image/webp" || t.width > asset.textureSize || t.height > asset.textureSize);
   if (decoded.getRoot().listScenes().some(scene => Math.abs(getBounds(scene).min[1]) > 1e-6)) {
      throw new Error(`Floor assertion failed for ${asset.id}: min Y must equal 0 after compression`);
   }
   if (report.tris > limitTris || output.length > limitBytes || overTextures) {
      throw new Error(`OVER BUDGET ${asset.id}: ${report.tris}/${limitTris} tris, ${output.length}/${limitBytes} bytes, textures ${overTextures ? "FAIL" : "PASS"}`);
   }
   return { output, report: { ...report, bytes: output.length, textureSizes, beforeTris: before.tris, rigged, simplificationError } };
}

export async function validateFile(file) {
   const bytes = new Uint8Array(await readFile(file));
   inspectModel(await readGLB(await createIO(), bytes));
   return bytes;
}
