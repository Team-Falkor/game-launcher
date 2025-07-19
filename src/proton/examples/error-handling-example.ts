/**
 * Example demonstrating improved error handling for Proton installation
 *
 * This example shows how the enhanced error handling works:
 * - Download retry logic with exponential backoff
 * - File integrity validation
 * - Corrupted archive detection
 * - Comprehensive error reporting
 */

import type {
	DownloadProgressEvent,
	DownloadStatusEvent,
	ExtractionProgressEvent,
} from "@/@types";
import { ProtonManager } from "../core/ProtonManager";

export async function demonstrateErrorHandling(): Promise<void> {
	console.log("=== Proton Error Handling Example ===");

	const protonManager = new ProtonManager();

	// Check if installation is supported
	if (!protonManager.isInstallationSupported()) {
		console.log("❌ Proton installation is not supported on this platform");
		return;
	}

	// Set up comprehensive event listeners for error tracking
	protonManager.onInstallStatus((event: DownloadStatusEvent) => {
		switch (event.status) {
			case "started":
				console.log(
					`🚀 Starting installation of ${event.variant} ${event.version}`,
				);
				break;
			case "downloading":
				console.log(`📥 ${event.message}`);
				break;
			case "retrying":
				console.log(`🔄 ${event.message}`);
				break;
			case "validating":
				console.log(`🔍 ${event.message}`);
				break;
			case "extracting":
				console.log(`📦 ${event.message}`);
				break;
			case "completed":
				console.log(`✅ ${event.message}`);
				break;
			case "failed":
				console.log(`❌ Installation failed: ${event.error}`);
				break;
		}
	});

	// Track download progress with error detection
	protonManager.onDownloadProgress((event: DownloadProgressEvent) => {
		const progress = event.percentage.toFixed(1);
		const speed = (event.speed / 1024 / 1024).toFixed(2); // MB/s
		const eta =
			event.estimatedTimeRemaining > 0
				? `${Math.round(event.estimatedTimeRemaining)}s`
				: "unknown";

		process.stdout.write(
			`\r📥 Download: ${progress}% | ${speed} MB/s | ETA: ${eta}     `,
		);
	});

	// Track extraction progress with file-level details
	protonManager.onExtractionProgress((event: ExtractionProgressEvent) => {
		const progress = event.percentage.toFixed(1);
		const fileName =
			event.currentFile.length > 50
				? `...${event.currentFile.slice(-47)}`
				: event.currentFile;

		process.stdout.write(`\r📦 Extracting: ${progress}% | ${fileName}     `);
	});

	// Handle installation completion
	protonManager.onInstallComplete((event) => {
		console.log(
			`\n✅ Successfully installed ${event.variant} ${event.version}`,
		);
		console.log(`📁 Installation path: ${event.installPath}`);
	});

	// Handle installation errors with detailed reporting
	protonManager.onInstallError((event) => {
		console.log(
			`\n❌ Installation failed for ${event.variant} ${event.version}`,
		);
		console.log(`🔍 Error details: ${event.error}`);

		// Provide specific guidance based on error type
		if (
			event.error.includes("corrupted") ||
			event.error.includes("unexpected end of file")
		) {
			console.log(
				"💡 Suggestion: The download may have been interrupted. Try again.",
			);
		} else if (event.error.includes("Download failed after")) {
			console.log(
				"💡 Suggestion: Check your internet connection and try again later.",
			);
		} else if (event.error.includes("not supported")) {
			console.log(
				"💡 Suggestion: This feature is only available on Linux systems.",
			);
		}
	});

	try {
		// Attempt to install a Proton version
		// This will demonstrate the retry logic and error handling
		console.log("\n🎯 Attempting to install Proton-GE (latest version)...");

		const availableVersions = await protonManager.listAvailableProtonVersions();
		const protonGEVersions = availableVersions["proton-ge"];

		if (!protonGEVersions || protonGEVersions.length === 0) {
			console.log("❌ No Proton-GE versions available");
			return;
		}

		// Get the latest version
		const latestVersion = protonGEVersions[0];
		if (!latestVersion) {
			console.log("❌ No latest version found");
			return;
		}
		console.log(`📋 Latest version: ${latestVersion.version}`);

		// Install with error handling
		const result = await protonManager.installProtonVersion({
			variant: "proton-ge",
			version: latestVersion.version,
			force: false, // Don't overwrite existing installations
		});

		if (result.success) {
			console.log(`\n🎉 Installation completed successfully!`);
			console.log(`📁 Installed to: ${result.installPath}`);
		} else {
			console.log(`\n💥 Installation failed: ${result.error}`);
		}
	} catch (error) {
		console.error("\n💥 Unexpected error:", error);
	} finally {
		// Clean up event listeners
		protonManager.removeAllInstallListeners();
		console.log("\n🧹 Cleaned up event listeners");
	}
}

// Run the example if this file is executed directly
if (require.main === module) {
	demonstrateErrorHandling().catch(console.error);
}
