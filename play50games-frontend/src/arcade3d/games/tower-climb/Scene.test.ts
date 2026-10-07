import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";

describe("tower-climb scene/core contract", () => {
   it("uses the default result delay, shared auto-rig and exactly the declared fixed pools", () => {
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      const definition = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
      expect(definition).not.toMatch(/resultDelayMs|finalScore|PlaceholderScene/);
      expect(definition).toContain('touchControls: ["joystick", "jump"]');
      expect(definition).toContain('hudStats: [{ key: "height", label: "Height" }]');
      // the shared runner through the documented auto-rig path only (scale in assets.ts, no core-only rig APIs)
      expect(scene).toContain("<HumanoidModel asset={ASSETS.runner}");
      expect(scene).toContain("useHumanoidPose(");
      for (const text of [scene, readFileSync(new URL("./Primitives.tsx", import.meta.url), "utf8")]) {
         expect(text).not.toMatch(/useHumanoidRig|buildHumanoidTemplate|cloneHumanoid|applyHumanoidPose|disposeHumanoid|Box3/);
      }
      expect(scene).toContain("readStepInput(input.current, controls)");
      expect(scene).toContain("store.setStat(\"height\", 0)");
      expect(scene).toContain("count={POOLS.slabs}"); expect(scene).toContain("count={POOLS.spurs}");
      expect(scene).not.toMatch(/input\.current\.swipe|clock\.elapsedTime|localStorage|setTimeout|performance\.now|Date\.now/);
   });

   it("simulation, visual and pose callbacks allocate no objects/arrays/closures and never call React setters", () => {
      const text = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      const source = ts.createSourceFile("Scene.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let frames = 0;
      const inspect = (node: ts.Node): void => {
         if (ts.isNewExpression(node) || ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)
            || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isTemplateExpression(node)
            || ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) throw new Error("Allocation in a frame callback");
         if (ts.isCallExpression(node)) {
            const call = node.expression.getText(source);
            if (/setState|set[A-Z].*\.call|\.(map|filter|slice|clone|bind|toFixed)\b/.test(call)) throw new Error(`Allocating frame call: ${call}`);
         }
         ts.forEachChild(node, inspect);
      };
      const find = (node: ts.Node): void => {
         if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
            && ["useFrame", "useRunFrame", "useHumanoidPose", "useCallback"].includes(node.expression.text)) {
            const callback = node.arguments[0];
            if (callback && ts.isArrowFunction(callback)) { frames++; inspect(callback.body); }
         }
         ts.forEachChild(node, find);
      };
      find(source); expect(frames).toBeGreaterThanOrEqual(10);
   });
});
