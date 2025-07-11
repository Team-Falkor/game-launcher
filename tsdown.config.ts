import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	platform: "node", 
	target: "es2020",
	format: ["esm", "cjs"],
	outDir: "./dist",
	dts: true,
	skipNodeModulesBundle: true,
	clean: true,
	shims: true,
	sourcemap: true, 
	alias: {
		"@": "./src",
	}, 
	external: [
		"node:events",
		"node:child_process",
		"node:fs",
		"node:fs/promises",
		"node:path",
		"node:os",
	],
});
