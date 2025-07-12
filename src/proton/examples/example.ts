import type { ProtonVariant } from "@/@types";
import { ProtonManager } from "../core/ProtonManager";

/**
 * Example usage of ProtonManager for listing available Proton versions
 */
async function demonstrateProtonListing() {
	const protonManager = new ProtonManager();

	console.log("🚀 Starting Proton version demonstration...");
	console.log("=".repeat(50));

	try {
		// Get all available versions
		console.log("\n📋 Fetching all available Proton versions...");
		const allVersions = await protonManager.listAvailableProtonVersions();

		// Display summary
		const stats = await protonManager.getVersionStats();
		console.log(`\n📊 Summary: ${stats.totalVersions} total versions found`);

		for (const [variant, count] of Object.entries(stats.variantCounts)) {
			const latest = stats.latestVersions[variant] || "Unknown";
			console.log(`  • ${variant}: ${count} versions (latest: ${latest})`);
		}

		// Display detailed information for each variant
		console.log(`\n${"=".repeat(50)}`);
		console.log("📦 Detailed Version Information:");

		for (const [variant, versions] of Object.entries(allVersions)) {
			console.log(`\n🔧 ${variant.toUpperCase()}:`);

			if (versions.length === 0) {
				console.log("  No versions available");
				continue;
			}

			// Show first 5 versions to avoid overwhelming output
			const displayVersions = versions.slice(0, 5);

			for (const version of displayVersions) {
				const sizeInfo = version.size
					? ` (${(version.size / 1024 / 1024).toFixed(1)} MB)`
					: "";
				const dateInfo = version.releaseDate
					? ` - ${version.releaseDate.toLocaleDateString()}`
					: "";
				const installStatus = version.installed
					? " ✅ INSTALLED"
					: " ⬇️  Available";

				console.log(
					`  ${installStatus} ${version.version}${sizeInfo}${dateInfo}`,
				);

				if (version.description) {
					console.log(
						`    📝 ${version.description.substring(0, 80)}${version.description.length > 80 ? "..." : ""}`,
					);
				}
			}

			if (versions.length > 5) {
				console.log(`  ... and ${versions.length - 5} more versions`);
			}
		}

		// Demonstrate searching
		console.log(`\n${"=".repeat(50)}`);
		console.log("🔍 Search demonstration:");

		const searchResults = await protonManager.searchVersions("8.2");
		console.log(`\nSearch results for "8.2": ${searchResults.length} matches`);

		for (const result of searchResults.slice(0, 3)) {
			console.log(
				`  • ${result.version} - ${result.description || "No description"}`,
			);
		}

		// Demonstrate getting latest versions
		console.log(`\n${"=".repeat(50)}`);
		console.log("🆕 Latest versions by variant:");

		const variants: ProtonVariant[] = [
			"proton-ge",
			"proton-experimental",
			"proton-stable",
			"wine-ge",
		];

		for (const variant of variants) {
			const latest = await protonManager.getLatestVersion(variant);
			if (latest) {
				const dateInfo = latest.releaseDate
					? ` (${latest.releaseDate.toLocaleDateString()})`
					: "";
				console.log(`  • ${variant}: ${latest.version}${dateInfo}`);
			} else {
				console.log(`  • ${variant}: No versions available`);
			}
		}
	} catch (error) {
		console.error("❌ Error during demonstration:", error);
	}

	console.log(`\n${"=".repeat(50)}`);
	console.log("✅ Demonstration complete!");
}

// Run the demonstration if this file is executed directly
if (import.meta.main) {
	demonstrateProtonListing().catch(console.error);
}

export { demonstrateProtonListing };
