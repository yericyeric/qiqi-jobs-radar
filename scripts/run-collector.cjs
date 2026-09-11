/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS bootstrap for TypeScript's in-process compiler. */
// Compile TypeScript in-process so the collector also runs in restricted desktops.
const ts = require("typescript");
const fs = require("node:fs");
require.extensions[".ts"] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(code, filename);
};
require("./collect.ts");
