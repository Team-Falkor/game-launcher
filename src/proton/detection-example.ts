import { ProtonDetector, ProtonManager } from "./index";

/**
 * Demonstrates the Proton detection system
 */
async function demonstrateProtonDetection() {
	console.log("🔍 Proton Detection System Demo");
	console.log("=".repeat(50));

	const protonManager = new ProtonManager();
	const protonDetector = new ProtonDetector();

	// Check platform support first
	const platformInfo = protonManager.getPlatformInfo();
	console.log(`\nPlatform: ${platformInfo.platform}`);
	console.log(`Proton Supported: ${platformInfo.protonSupported}`);
	if (platformInfo.reason) {
		console.log(`Reason: ${platformInfo.reason}`);
	}
	console.log();

	if (!protonManager.isProtonSupported()) {
		console.log('⚠️  Proton detection and management features are not available on this platform.');
		console.log('Proton is specifically designed for Linux systems to run Windows games.');
		console.log('\nHowever, you can still browse available Proton versions for reference:\n');
		
		// Show available versions even on non-Linux systems
		const availableVersions = await protonManager.listAvailableProtonVersions();
		let totalVersions = 0;
		
		for (const [variant, versions] of Object.entries(availableVersions)) {
			if (versions.length > 0) {
				console.log(`${variant}: ${versions.length} versions available`);
				totalVersions += versions.length;
			}
		}
		
		console.log(`\nTotal: ${totalVersions} Proton versions available for Linux systems`);
		return;
	}

	try {
		// Test direct detection
		console.log("\n📦 Detecting installed Proton builds...");
		const installedBuilds = await protonDetector.detectInstalledProtonBuilds();

		if (installedBuilds.length === 0) {
			console.log("❌ No Proton installations detected");
		} else {
			console.log(
				`✅ Found ${installedBuilds.length} installed Proton build(s):`,
			);

			for (const build of installedBuilds) {
				const sizeInMB = build.size
					? (build.size / (1024 * 1024)).toFixed(1)
					: "Unknown";
				const installDate = build.installDate
					? build.installDate.toLocaleDateString()
					: "Unknown";

				console.log(`\n   🔧 ${build.variant.toUpperCase()}:`);
				console.log(`      Version: ${build.version}`);
				console.log(`      Source: ${build.installSource}`);
				console.log(`      Path: ${build.installPath}`);
				console.log(`      Size: ${sizeInMB} MB`);
				console.log(`      Installed: ${installDate}`);
			}
		}

		// Test Steam-specific detection
		console.log("\n🎮 Detecting Steam Proton builds...");
		const steamBuilds = await protonDetector.detectSteamProtonBuilds();

		if (steamBuilds.length === 0) {
			console.log("❌ No Steam Proton installations detected");
		} else {
			console.log(`✅ Found ${steamBuilds.length} Steam Proton build(s)`);
		}

		// Test manual installation detection
		console.log("\n🛠️  Detecting manually installed Proton builds...");
		const manualBuilds = await protonDetector.detectManualProtonBuilds();

		if (manualBuilds.length === 0) {
			console.log("❌ No manually installed Proton builds detected");
		} else {
			console.log(
				`✅ Found ${manualBuilds.length} manually installed Proton build(s)`,
			);
		}

		// Test integrated version listing with installation status
		console.log("\n📋 Available versions with installation status...");
		const availableVersions = await protonManager.listAvailableProtonVersions();

		for (const [variant, versions] of Object.entries(availableVersions)) {
			if (versions.length === 0) continue;

			console.log(`\n🔧 ${variant.toUpperCase()}:`);

			const installedCount = versions.filter((v) => v.installed).length;
			const totalCount = versions.length;

			console.log(`   📊 Status: ${installedCount}/${totalCount} installed`);

			// Show first few versions with their installation status
			const displayVersions = versions.slice(0, 3);
			for (const version of displayVersions) {
				const status = version.installed ? "✅ Installed" : "⬇️  Available";
				const source = version.installSource
					? ` (${version.installSource})`
					: "";
				console.log(`   ${status} ${version.version}${source}`);
			}

			if (versions.length > 3) {
				console.log(`   ... and ${versions.length - 3} more versions`);
			}
		}

		// Test search functionality
		console.log('\n🔍 Search demonstration (looking for "GE-Proton"):');
		const searchResults = await protonManager.searchVersions("GE-Proton");

		if (searchResults.length === 0) {
			console.log("❌ No search results found");
		} else {
			console.log(`✅ Found ${searchResults.length} matching version(s)`);

			const installedResults = searchResults.filter((v) => v.installed);
			if (installedResults.length > 0) {
				console.log(`   📦 ${installedResults.length} of these are installed`);
			}
		}
	} catch (error) {
		console.error("❌ Error during detection:", error);
	}

	console.log(`\n${"=".repeat(50)}`);
	console.log("✅ Detection demonstration complete!");
}

// Run the demonstration if this file is executed directly
if (import.meta.main) {
	demonstrateProtonDetection().catch(console.error);
}

export { demonstrateProtonDetection };
