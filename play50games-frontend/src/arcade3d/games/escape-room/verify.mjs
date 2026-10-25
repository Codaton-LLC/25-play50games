// Sandbox-only runner: the normal CLI's esbuild config loader cannot read a parent
// directory in the managed Windows sandbox. Same Vitest tests, TypeScript transpiler.
// Run from play50games-frontend: node src/arcade3d/games/escape-room/verify.mjs [test-name]
import { startVitest } from "vitest/node";
import ts from "typescript";
import path from "node:path";

const context = await startVitest("test", ["src/arcade3d/games/escape-room"], {
   config: false,
   reporters: ["verbose"],
   watch: false,
   maxWorkers: 1,
   minWorkers: 1,
   ...(process.argv[2] ? { testNamePattern: process.argv[2] } : {}),
}, {
   esbuild: false,
   resolve: { alias: { "@": path.resolve("src") } },
   plugins: [{
      name: "sandbox-typescript",
      enforce: "pre",
      transform(code, id) {
         if (!/\.[cm]?tsx?$/.test(id)) return;
         return {
            code: ts.transpileModule(code, {
               compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
               fileName: id,
            }).outputText,
            map: null,
         };
      },
   }],
});
await context?.close();
