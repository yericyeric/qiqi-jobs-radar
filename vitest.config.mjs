import { defineConfig } from "vitest/config";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// In-process TypeScript transform works in restricted environments without spawning esbuild.
export default defineConfig({
  esbuild: false,
  resolve: {
    preserveSymlinks: true,
    alias: { "@prisma/client": require.resolve("@prisma/client") },
  },
  plugins: [
    {
      name: "typescript-in-process",
      enforce: "pre",
      transform(code, id) {
        if (/\.[cm]?tsx?$/.test(id) && !id.includes("node_modules"))
          return {
            code: ts.transpileModule(code, {
              compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ESNext,
                jsx: ts.JsxEmit.ReactJSX,
                sourceMap: true,
              },
            }).outputText,
            map: null,
          };
      },
    },
  ],
  test: {
    environment: "node",
    pool: "threads",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
  },
});
