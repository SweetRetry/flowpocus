import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  // ESM-only "type": "module" package: keep dist/index.js as the bin path.
  fixedExtension: false,
  dts: false,
  deps: { alwaysBundle: ["@workspace/commands"] },
})
