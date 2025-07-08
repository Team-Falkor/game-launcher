import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	platform: "node", // Changed to 'node' for proper Node.js module resolution
	target: "es2020", // Match tsconfig.json target
	format: ["esm", "cjs"],
	outDir: "./dist",
	dts: true,
	skipNodeModulesBundle: true,
	clean: true,
	shims: true,
	sourcemap: true, // Generate source maps for debugging
	// External dependencies (Node.js built-ins)
	external: [
		"node:events",
		"node:child_process",
		"node:fs/promises",
		"node:path",
		"node:os",
	],
});
