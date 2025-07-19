import { build } from "bun";

const isProduction = Bun.env.NODE_ENV === "production";

async function runBuild() {
	const result = await build({
		entrypoints: ["./src/index.ts"],
		outdir: "./dist",
		target: "node",
		minify: isProduction,
		sourcemap: isProduction ? "none" : "external",
		splitting: false,
		define: {
			"process.env.NODE_ENV": JSON.stringify(Bun.env.NODE_ENV),
		},
	});

	if (!result.success) {
		console.error("Build failed:", result.logs);
		process.exit(1);
	}

	console.log("Bun build completed successfully.");
}

runBuild();
