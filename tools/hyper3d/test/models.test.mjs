import test from "node:test";
import assert from "node:assert/strict";
import { Document } from "@gltf-transform/core";
import { createIO, fixtureGLB, inspectModel, optimizeGLB, readGLB } from "../src/models.mjs";

const asset = { id: "model", kind: "prop", textureSize: 512, budget: { tris: 5000, bytes: 300000 } };

async function skinnedFixture() {
   const io = await createIO();
   const doc = await readGLB(io, await fixtureGLB());
   const buffer = doc.getRoot().listBuffers()[0];
   const joint = doc.createNode("joint");
   doc.getRoot().listScenes()[0].addChild(joint);
   const matrix = doc.createAccessor().setBuffer(buffer).setType("MAT4")
      .setArray(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
   const skin = doc.createSkin("rig").addJoint(joint).setInverseBindMatrices(matrix);
   const meshNode = doc.getRoot().listNodes().find(node => node.getMesh());
   meshNode.setSkin(skin);
   const primitive = meshNode.getMesh().listPrimitives()[0];
   // Deliberate duplicate vertex: welding a rig would remove this authored seam.
   primitive.getAttribute("POSITION").setArray(new Float32Array([...primitive.getAttribute("POSITION").getArray(), 2, 3, 4]));
   primitive.getAttribute("TEXCOORD_0").setArray(new Float32Array([...primitive.getAttribute("TEXCOORD_0").getArray(), 0, 0]));
   primitive.getIndices().getArray()[0] = 4;
   primitive.setAttribute("JOINTS_0", doc.createAccessor().setBuffer(buffer).setType("VEC4").setArray(new Uint16Array(20)));
   primitive.setAttribute("WEIGHTS_0", doc.createAccessor().setBuffer(buffer).setType("VEC4")
      .setArray(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])));
   return io.writeBinary(doc);
}

async function sphereFixture() {
   const doc = new Document();
   const buffer = doc.createBuffer();
   const vertices = [], indices = [];
   const rows = 20, columns = 40;
   for (let y = 0; y <= rows; y++) {
      const latitude = Math.PI * y / rows;
      for (let x = 0; x <= columns; x++) {
         const longitude = 2 * Math.PI * x / columns;
         vertices.push(2 + Math.sin(latitude) * Math.cos(longitude), 3 + Math.cos(latitude), 4 + Math.sin(latitude) * Math.sin(longitude));
      }
   }
   for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
         const a = y * (columns + 1) + x, b = a + columns + 1;
         if (y > 0) { indices.push(a, b, a + 1); }
         if (y < rows - 1) { indices.push(a + 1, b, b + 1); }
      }
   }
   const primitive = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setBuffer(buffer).setType("VEC3").setArray(new Float32Array(vertices)))
      .setIndices(doc.createAccessor().setBuffer(buffer).setType("SCALAR").setArray(new Uint16Array(indices)));
   doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(primitive)));
   return (await createIO()).writeBinary(doc);
}

test("rigged optimization preserves skin, weights and one floor pivot without decimation", async () => {
   const bytes = await skinnedFixture();
   const { output, report } = await optimizeGLB(bytes, asset);
   const doc = await readGLB(await createIO(), output);
   assert.equal(report.rigged, true);
   assert.equal(report.simplificationError, null);
   assert.equal(report.tris, 4);
   assert.ok(Math.abs(report.bounds.min[1]) <= 1e-6);
   assert.equal(doc.getRoot().listNodes().filter(node => node.getName() === "Pivot").length, 1);
   assert.equal(doc.getRoot().listSkins().length, 1);
   assert.equal(doc.getRoot().listSkins()[0].listJoints()[0].getName(), "joint");
   const primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
   assert.equal(primitive.getAttribute("POSITION").getCount(), 5);
   const jointMatrix = doc.getRoot().listSkins()[0].listJoints()[0].getWorldMatrix();
   const positions = primitive.getAttribute("POSITION");
   const skinnedY = [];
   for (let i = 0; i < 5; i++) {
      assert.deepEqual(primitive.getAttribute("WEIGHTS_0").getElement(i, []), [1, 0, 0, 0]);
      const [x, y, z] = positions.getElement(i, []);
      skinnedY.push(jointMatrix[1] * x + jointMatrix[5] * y + jointMatrix[9] * z + jointMatrix[13]);
   }
   assert.ok(Math.abs(Math.min(...skinnedY)) <= 1e-6);
   for (const input of [bytes, await fixtureGLB()]) {
      await assert.rejects(optimizeGLB(input, { ...asset, rigged: true, budget: { ...asset.budget, tris: 3 } }), /OVER BUDGET.*rigged/);
   }
});

test("declared rigged meshes skip welding even without a skin", async () => {
   const io = await createIO();
   const doc = await readGLB(io, await skinnedFixture());
   doc.getRoot().listNodes().find(node => node.getMesh()).setSkin(null);
   doc.getRoot().listSkins()[0].dispose();
   const { output, report } = await optimizeGLB(await io.writeBinary(doc), { ...asset, rigged: true });
   assert.equal(report.rigged, true);
   assert.equal(report.simplificationError, null);
   assert.equal((await readGLB(io, output)).getRoot().listMeshes()[0].listPrimitives()[0].getAttribute("POSITION").getCount(), 5);
});

test("packed normals declare KHR_mesh_quantization so the GLB stays valid glTF", async () => {
   const io = await createIO();
   const doc = await readGLB(io, await sphereFixture());
   const primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
   const positions = primitive.getAttribute("POSITION");
   const normals = new Float32Array(positions.getCount() * 3);
   for (let i = 0; i < positions.getCount(); i++) {
      const [x, y, z] = positions.getElement(i, []);
      const dx = x - 2, dy = y - 3, dz = z - 4, len = Math.hypot(dx, dy, dz) || 1;
      normals.set([dx / len, dy / len, dz / len], i * 3);
   }
   primitive.setAttribute("NORMAL", doc.createAccessor().setBuffer(doc.getRoot().listBuffers()[0]).setType("VEC3").setArray(normals));
   const { output } = await optimizeGLB(await io.writeBinary(doc), asset);
   const decoded = await readGLB(io, output);
   const normal = decoded.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute("NORMAL");
   const required = decoded.getRoot().listExtensionsRequired().map(ext => ext.extensionName);
   assert.ok(normal.getComponentSize() < 4, "normals are packed");
   assert.ok(required.includes("KHR_mesh_quantization"));
   assert.ok(required.includes("EXT_meshopt_compression"));
});

test("simplification increases error to reach a real curved mesh budget and reports it", async () => {
   const bytes = await sphereFixture();
   assert.ok(inspectModel(await readGLB(await createIO(), bytes)).tris > 1000);
   const { report } = await optimizeGLB(bytes, { ...asset, budget: { ...asset.budget, tris: 300 } });
   assert.ok(report.tris <= 300);
   assert.ok(report.simplificationError > 0.001);
   assert.ok([0.005, 0.01, 0.02, 0.05].includes(report.simplificationError));
   assert.ok(Math.abs(report.bounds.min[1]) <= 1e-6);
   await assert.rejects(optimizeGLB(await fixtureGLB(), { ...asset, budget: { ...asset.budget, tris: 1 } }), /OVER BUDGET.*0.05/);
});
