/**
 * Example demonstrating Proton installation with build-from-source support
 *
 * This example shows how to:
 * - Install Proton from source code with custom build options
 * - Listen to build progress events
 * - Handle build failures and timeouts
 * - Configure build parameters like parallel jobs and custom arguments
 */

import type { ProtonBuildOptions, ProtonVariant } from "@/@types";
import { ProtonManager } from "../core/ProtonManager";

/**
 * Demonstrates installing Proton from source with build support
 */
export async function demonstrateSourceBuild(): Promise<void> {
	console.log("=== Proton Source Build Example ===");

	const protonManager = new ProtonManager();

	// Check if installation is supported (Linux only)
	if (!protonManager.isInstallationSupported()) {
		const platformInfo = protonManager.getPlatformInfo();
		console.log(
			`Proton installation not supported on ${platformInfo.platform}. Reason: ${platformInfo.reason}`,
		);
		return;
	}

	// Configure build options
	const buildOptions: ProtonBuildOptions = {
		enableBuild: true, // Enable building from source
		buildTimeout: 7200000, // 2 hours timeout
		makeJobs: 4, // Use 4 parallel jobs
		makeArgs: ["VERBOSE=1"], // Custom make arguments
	};

	// Set up event listeners for build progress
	protonManager.onBuildProgress((event) => {
		console.log(
			`[${event.step.toUpperCase()}] ${event.variant} ${event.version}: ${event.message}`,
		);
	});

	// Set up event listeners for download/install status
	protonManager.onInstallStatus((event) => {
		switch (event.status) {
			case "started":
				console.log(`📥 Starting download: ${event.variant} ${event.version}`);
				break;
			case "downloading":
				console.log(`⬇️ Downloading: ${event.message}`);
				break;
			case "extracting":
				console.log(`📦 Extracting archive...`);
				break;
			case "building":
				console.log(`🔨 Building from source...`);
				break;
			case "completed":
				console.log(`✅ Installation completed: ${event.message}`);
				break;
			case "failed":
				console.error(`❌ Installation failed: ${event.error}`);
				break;
		}
	});

	// Set up download progress tracking
	protonManager.onDownloadProgress((event) => {
		if (event.totalBytes > 0) {
			// Progress with known total size
			const progressBar = "=".repeat(Math.floor(event.percentage / 5));
			const emptyBar = " ".repeat(20 - progressBar.length);
			const speed = (event.speed / 1024 / 1024).toFixed(1); // MB/s
			const eta = Math.floor(event.estimatedTimeRemaining);

			console.log(
				`Progress: [${progressBar}${emptyBar}] ${event.percentage.toFixed(1)}% | ${speed} MB/s | ETA: ${eta}s`,
			);
		} else {
			// Progress without known total size (e.g., GitHub tarballs)
			const downloaded = (event.bytesDownloaded / 1024 / 1024).toFixed(1);
			const speed = (event.speed / 1024 / 1024).toFixed(1);
			console.log(`Downloaded: ${downloaded} MB | Speed: ${speed} MB/s`);
		}
	});

	try {
		// Example 1: Install Proton-GE from source
		console.log("\n--- Installing Proton-GE from source ---");
		const result = await protonManager.installProtonVersion({
			variant: "proton-stable",
			version: "proton-9.0-4", // Replace with actual version
			force: true, // Overwrite if exists
			buildOptions,
		});

		console.log(`📁 Installation path: ${result?.installPath}`);

		if (result.success) {
			console.log(
				`🎉 Successfully built and installed ${result.variant} ${result.version}`,
			);
		} else {
			console.error(`❌ Installation failed: ${result.error}`);
		}

		// Example 2: Install with minimal build options
		console.log("\n--- Installing with minimal build options ---");
		const minimalBuildOptions: ProtonBuildOptions = {
			enableBuild: true,
			buildTimeout: 3600000, // 1 hour
		};

		const result2 = await protonManager.installProtonVersion({
			variant: "wine-ge",
			version: "wine-ge-8-26", // Replace with actual version
			force: true,
			buildOptions: minimalBuildOptions,
		});

		if (result2.success) {
			console.log(
				`🎉 Successfully built and installed ${result2.variant} ${result2.version}`,
			);
			console.log(`📁 Installation path: ${result2.installPath}`);
		} else {
			console.error(`❌ Installation failed: ${result2.error}`);
		}

		// Example 3: Install without building (pre-built binaries)
		console.log("\n--- Installing pre-built binaries (no build) ---");
		const noBuildOptions: ProtonBuildOptions = {
			enableBuild: false, // Disable building
		};

		const result3 = await protonManager.installProtonVersion({
			variant: "proton-ge",
			version: "GE-Proton8-25", // Replace with actual version
			force: true,
			buildOptions: noBuildOptions,
		});

		if (result3.success) {
			console.log(
				`🎉 Successfully installed pre-built ${result3.variant} ${result3.version}`,
			);
			console.log(`📁 Installation path: ${result3.installPath}`);
		} else {
			console.error(`❌ Installation failed: ${result3.error}`);
		}
	} catch (error) {
		console.error("Unexpected error:", error);
	}
}

/**
 * Demonstrates advanced build configuration
 */
export async function demonstrateAdvancedBuild(): Promise<void> {
	console.log("\n=== Advanced Build Configuration Example ===");

	const protonManager = new ProtonManager();

	if (!protonManager.isInstallationSupported()) {
		console.log("Proton installation not supported on this platform.");
		return;
	}

	// Advanced build configuration
	const advancedBuildOptions: ProtonBuildOptions = {
		enableBuild: true,
		buildTimeout: 10800000, // 3 hours for complex builds
		makeJobs: 8, // Use all available CPU cores
		configureArgs: [
			"--enable-win64",
			"--enable-win32",
			"--with-vulkan",
			"--with-dxvk",
		],
		makeArgs: ["VERBOSE=1", "CCACHE_DISABLE=1", "OPTIMIZATION=-O2"],
	};

	// Enhanced build progress tracking
	protonManager.onBuildProgress((event) => {
		const timestamp = new Date().toISOString();
		console.log(
			`[${timestamp}] [${event.step.toUpperCase()}] ${event.message}`,
		);

		// Log specific build milestones
		if (event.message.includes("error") || event.message.includes("Error")) {
			console.error(`🚨 Build error detected: ${event.message}`);
		} else if (
			event.message.includes("warning") ||
			event.message.includes("Warning")
		) {
			console.warn(`⚠️ Build warning: ${event.message}`);
		} else if (
			event.message.includes("completed") ||
			event.message.includes("finished")
		) {
			console.log(`✅ Build milestone: ${event.message}`);
		}
	});

	try {
		const result = await protonManager.installProtonVersion({
			variant: "proton-ge",
			version: "GE-Proton8-27", // Replace with actual version
			force: true,
			buildOptions: advancedBuildOptions,
		});

		if (result.success) {
			console.log(
				`🎉 Advanced build completed successfully for ${result.variant} ${result.version}`,
			);
			console.log(`📁 Installation path: ${result.installPath}`);

			// Verify the installation
			const status = await protonManager.getInstallationStatus(
				result.variant as ProtonVariant,
				result.version,
			);
			console.log(`✅ Installation verified: ${status.installed}`);
		} else {
			console.error(`❌ Advanced build failed: ${result.error}`);
		}
	} catch (error) {
		console.error("Advanced build error:", error);
	}
}

// Run the examples if this file is executed directly
if (require.main === module) {
	(async () => {
		await demonstrateSourceBuild();
		await demonstrateAdvancedBuild();
	})().catch(console.error);
}
