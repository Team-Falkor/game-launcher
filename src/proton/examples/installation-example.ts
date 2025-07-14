/**
 * Example demonstrating Proton installation and removal functionality
 *
 * This example shows how to:
 * - Check if Proton installation is supported
 * - Install a specific Proton version with progress tracking
 * - Listen to download events and progress updates
 * - Check installation status
 * - Remove a Proton version
 * - Install the latest version of a variant
 */

import type { ProtonVariant } from "../../@types";
import { ProtonManager } from "../core";
import type { DownloadProgressEvent, DownloadStatusEvent } from "../core/ProtonInstaller";

/**
 * Example usage of Proton installation features
 */
export async function demonstrateProtonInstallation(): Promise<void> {
	const protonManager = new ProtonManager();

	// Check if installation is supported (Linux only)
	if (!protonManager.isInstallationSupported()) {
		console.log(
			"❌ Proton installation is not supported on this system (Linux only)",
		);
		return;
	}

	console.log("✅ Proton installation is supported");
	console.log(
		`📁 Compatibility tools directory: ${protonManager.getCompatibilityToolsDirectory()}`,
	);

	// Example 1: Install a specific Proton version with progress tracking
	console.log("\n🔄 Installing Proton GE 8-32 with progress tracking...");
	
	// Set up event listeners for download progress using convenience methods
	protonManager.onInstallStatus((event: DownloadStatusEvent) => {
		switch (event.status) {
			case 'started':
				console.log(`🚀 Download started for ${event.variant} ${event.version}`);
				break;
			case 'downloading':
				console.log(`📥 ${event.message}`);
				break;
			case 'extracting':
				console.log(`📦 Extracting ${event.variant} ${event.version}...`);
				break;
			case 'completed':
				console.log(`✅ ${event.message}`);
				break;
			case 'failed':
				console.log(`❌ Download failed: ${event.error}`);
				break;
		}
	});
	
	protonManager.onDownloadProgress((event: DownloadProgressEvent) => {
		const progressBar = '█'.repeat(Math.floor(event.percentage / 5)) + '░'.repeat(20 - Math.floor(event.percentage / 5));
		const speedMB = (event.speed / 1024 / 1024).toFixed(1);
		const etaMin = Math.floor(event.estimatedTimeRemaining / 60);
		const etaSec = Math.floor(event.estimatedTimeRemaining % 60);
		
		process.stdout.write(`\r📊 [${progressBar}] ${event.percentage.toFixed(1)}% | ${speedMB} MB/s | ETA: ${etaMin}:${etaSec.toString().padStart(2, '0')}`);
	});
	
	protonManager.onInstallComplete((event) => {
		console.log(`\n🎉 Installation completed: ${event.variant} ${event.version}`);
	});
	
	protonManager.onInstallError((event) => {
		console.log(`\n💥 Installation error: ${event.error}`);
	});
	
	const installResult = await protonManager.installProtonVersion({
		variant: "proton-ge",
		version: "GE-Proton8-32",
		force: false, // Don't reinstall if already exists
	});

	if (installResult.success) {
		console.log(
			`\n✅ Successfully installed ${installResult.variant} ${installResult.version}`,
		);
		console.log(`📁 Install path: ${installResult.installPath}`);
	} else {
		console.log(`\n❌ Installation failed: ${installResult.error}`);
	}

	// Example 2: Check installation status
	console.log("\n🔍 Checking installation status...");
	const status = await protonManager.getInstallationStatus(
		"proton-ge",
		"GE-Proton8-32",
	);
	if (status.installed) {
		console.log(`✅ Proton GE 8-32 is installed at: ${status.installPath}`);
		console.log(`📦 Install source: ${status.installSource}`);
	} else {
		console.log("❌ Proton GE 8-32 is not installed");
	}

	// Example 3: Install latest version of a variant
	console.log("\n🔄 Installing latest Proton GE version...");
	const latestResult = await protonManager.installLatestVersion("proton-ge");
	if (latestResult.success) {
		console.log(
			`✅ Successfully installed latest ${latestResult.variant}: ${latestResult.version}`,
		);
		console.log(`📁 Installation path: ${latestResult.installPath}`);
	} else {
		console.log(`❌ Failed to install latest version: ${latestResult.error}`);
	}

	// Example 4: List all installed builds
	console.log("\n📋 Listing all installed Proton builds...");
	const installedBuilds = await protonManager.getInstalledProtonBuilds();
	console.log(`Found ${installedBuilds.length} installed Proton builds:`);
	for (const build of installedBuilds) {
		console.log(
			`  - ${build.variant} ${build.version} (${build.installSource})`,
		);
		console.log(`    📁 ${build.installPath}`);
	}

	// Example 5: Remove a Proton version (commented out for safety)
	/*
	console.log("\n🗑️ Removing Proton GE 8-32...");
	const removeResult = await protonManager.removeProtonVersion({
		variant: "proton-ge",
		version: "GE-Proton8-32",
	});

	if (removeResult.success) {
		console.log(`✅ Successfully removed ${removeResult.variant} ${removeResult.version}`);
	} else {
		console.log(`❌ Removal failed: ${removeResult.error}`);
	}
	*/
}

/**
 * Example of batch installation
 */
export async function batchInstallExample(): Promise<void> {
	const protonManager = new ProtonManager();

	if (!protonManager.isInstallationSupported()) {
		console.log("❌ Proton installation not supported on this system");
		return;
	}

	const versionsToInstall: Array<{ variant: ProtonVariant; version: string }> =
		[
			{ variant: "proton-ge", version: "GE-Proton8-32" },
			{ variant: "proton-ge", version: "GE-Proton9-1" },
			{ variant: "proton-experimental", version: "bleeding-edge" },
		];

	console.log(`🔄 Installing ${versionsToInstall.length} Proton versions...`);

	for (const { variant, version } of versionsToInstall) {
		console.log(`\n📦 Installing ${variant} ${version}...`);
		const result = await protonManager.installProtonVersion({
			variant,
			version,
			force: false,
		});

		if (result.success) {
			console.log(`✅ ${variant} ${version} installed successfully`);
			console.log(`📁 Installation path: ${result.installPath}`);
		} else {
			console.log(
				`❌ ${variant} ${version} installation failed: ${result.error}`,
			);
		}
	}

	console.log("\n🎉 Batch installation complete!");
}

// Run the example if this file is executed directly
if (require.main === module) {
	demonstrateProtonInstallation()
		.then(() => {
			console.log("\n✨ Example completed successfully");
		})
		.catch((error) => {
			console.error("❌ Example failed:", error);
			process.exit(1);
		});
}
