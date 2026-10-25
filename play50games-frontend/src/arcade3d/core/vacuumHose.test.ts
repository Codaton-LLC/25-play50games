import { describe, expect, it, vi } from "vitest";
import { BufferAttribute, Vector3 } from "three";
import { HOSE_DIRTY_EPS_SQ, createHoseKit, hoseShapeDirty, syncHose } from "@/arcade3d/games/ghost-vacuum/Vacuum";

describe("hoseShapeDirty", () => {
   it("ignores a nudge under 0.1 mm and accepts a real move", () => {
      const tip = new Vector3(0, 0, 0);
      const last = new Vector3(0, 0, 0);
      expect(hoseShapeDirty(tip, last)).toBe(false);
      tip.x = 1e-5;
      expect(tip.distanceToSquared(last)).toBeLessThan(HOSE_DIRTY_EPS_SQ);
      expect(hoseShapeDirty(tip, last)).toBe(false);
      tip.x = 1e-3;
      expect(hoseShapeDirty(tip, last)).toBe(true);
   });
});

describe("syncHose", () => {
   it("recomputes normals and the bounding sphere only when the tip moves", () => {
      const kit = createHoseKit();
      const normals = vi.spyOn(kit.hose, "computeVertexNormals");
      const bounds = vi.spyOn(kit.hose, "computeBoundingSphere");
      const getPoint = vi.spyOn(kit.curve, "getPoint");
      const attribute = kit.hose.getAttribute("position");
      if (!(attribute instanceof BufferAttribute)) throw new Error("hose position is not a BufferAttribute");
      const positions = attribute;
      const buffer = positions.array;

      kit.tip.set(-0.3, -0.2, 0.65);
      expect(syncHose(kit)).toBe(true);
      expect(normals).toHaveBeenCalledTimes(1);
      expect(bounds).toHaveBeenCalledTimes(1);
      const built = Float32Array.from(buffer as ArrayLike<number>);
      // needsUpdate is write-only (it bumps version); a still tip must not bump it
      const version = positions.version;

      expect(syncHose(kit)).toBe(false);
      kit.tip.x += 1e-5;
      expect(syncHose(kit)).toBe(false);
      expect(normals).toHaveBeenCalledTimes(1);
      expect(bounds).toHaveBeenCalledTimes(1);
      expect(positions.version).toBe(version);
      expect(positions.array).toBe(buffer);
      expect(Array.from(buffer as ArrayLike<number>)).toEqual(Array.from(built));

      kit.tip.set(2, 0.4, -1);
      expect(syncHose(kit)).toBe(true);
      expect(normals).toHaveBeenCalledTimes(2);
      expect(bounds).toHaveBeenCalledTimes(2);
      expect(positions.version).toBe(version + 1);
      expect(positions.array).toBe(buffer);
      expect(Array.from(buffer as ArrayLike<number>)).not.toEqual(Array.from(built));

      // every sample was written into a scratch vector, never Curve.getPoint's default allocation
      expect(getPoint).toHaveBeenCalled();
      for (const call of getPoint.mock.calls) expect(call[1]).toBeInstanceOf(Vector3);
      kit.hose.dispose();
   });
});
