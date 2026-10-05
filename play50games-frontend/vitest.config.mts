import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
   resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
   },
   // .tsx modules under test (core/assets.tsx) use the automatic runtime, like Next
   esbuild: { jsx: "automatic" },
   test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
   },
});
