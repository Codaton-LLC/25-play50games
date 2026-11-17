import { describe, expect, it } from "vitest";
import { Mesh, MeshStandardMaterial, BoxGeometry, Group } from "three";
import { FLAP_HZ, FLAP_SWING, WING_ROOT, flapOffset, patchWings } from "./wings";

describe("bee wing flap (visual only)", () => {
   it("the body stays still and the wing tips swing up and down, more the further out", () => {
      for (const t of [0, 0.013, 0.05, 0.4]) expect(Math.abs(flapOffset(WING_ROOT * 0.9, t))).toBe(0);
      const quarter = 1 / (4 * FLAP_HZ);
      expect(flapOffset(0.9, quarter)).toBeCloseTo(FLAP_SWING * (0.9 - WING_ROOT), 9);
      expect(flapOffset(-0.9, quarter)).toBeCloseTo(flapOffset(0.9, quarter), 9);
      expect(flapOffset(0.9, 3 * quarter)).toBeCloseTo(-flapOffset(0.9, quarter), 9);
      expect(Math.abs(flapOffset(0.9, quarter))).toBeGreaterThan(Math.abs(flapOffset(0.5, quarter)));
   });
   it("patches each material once and its shader carries the flap", () => {
      const mat = new MeshStandardMaterial();
      const root = new Group();
      root.add(new Mesh(new BoxGeometry(), mat));
      patchWings(root);
      const hook = mat.onBeforeCompile;
      patchWings(root);
      expect(mat.onBeforeCompile).toBe(hook);
      const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: "#include <common> #include <begin_vertex>" };
      (mat.onBeforeCompile as unknown as (s: typeof shader) => void)(shader);
      expect(shader.uniforms.uFlapT).toBeDefined();
      expect(shader.vertexShader).toContain("transformed.y +=");
   });
});
