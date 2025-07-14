/**
 * Example demonstrating comprehensive error handling for Proton build-from-source
 *
 * This example shows how to:
 * - Handle various build errors and timeouts
 * - Implement retry logic for failed builds
 * - Capture and analyze build output for debugging
 * - Provide detailed error reporting and troubleshooting guidance
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ProtonBuildOptions } from "@/@types";
import { ProtonManager } from "../core/ProtonManager";

/**
 * Demonstrates comprehensive error handling for build processes
 */
export async function demonstrateBuildErrorHandling(): Promise<void> {
	console.log("=== Proton Build Error Handling Example ===");

	const protonManager = new ProtonManager();

	// Check if installation is supported
	if (!protonManager.isInstallationSupported()) {
		const platformInfo = protonManager.getPlatformInfo();
		console.log(
			`Proton installation not supported on ${platformInfo.platform}. Reason: ${platformInfo.reason}`,
		);
		return;
	}

	// Create a log file for detailed debugging
	const logFile = path.join(process.cwd(), `proton-build-${Date.now()}.log`);
	const logStream = await fs.open(logFile, "w");

	console.log(`📝 Build log will be saved to: ${logFile}`);

	// Enhanced build options with error handling
	const buildOptions: ProtonBuildOptions = {
		enableBuild: true,
		buildTimeout: 1800000, // 30 minutes - shorter for testing
		makeJobs: 2, // Reduced to avoid overwhelming system
		configureArgs: ["--enable-win64"],
		makeArgs: ["VERBOSE=1"], // Enable verbose output for debugging
	};

	// Set up comprehensive event listeners
	let buildStepStartTime = Date.now();
	let currentStep = "";
	const errorMessages: string[] = [];
	const warningMessages: string[] = [];

	// Build progress tracking with error detection
	protonManager.onBuildProgress((event) => {
		const timestamp = new Date().toISOString();
		const logMessage = `[${timestamp}] [${event.step.toUpperCase()}] ${event.message}`;

		// Log to file
		logStream.write(`${logMessage}\n`);

		// Track step changes
		if (event.step !== currentStep) {
			if (currentStep) {
				const stepDuration = Date.now() - buildStepStartTime;
				console.log(`⏱️ Step '${currentStep}' took ${stepDuration}ms`);
			}
			currentStep = event.step;
			buildStepStartTime = Date.now();
			console.log(`🔄 Starting step: ${event.step}`);
		}

		// Detect and categorize errors/warnings
		const message = event.message.toLowerCase();
		if (message.includes("error") || message.includes("failed")) {
			errorMessages.push(event.message);
			console.error(`🚨 ERROR: ${event.message}`);
		} else if (message.includes("warning") || message.includes("warn")) {
			warningMessages.push(event.message);
			console.warn(`⚠️ WARNING: ${event.message}`);
		} else if (message.includes("stuck") || message.includes("timeout")) {
			console.warn(`⏰ TIMEOUT WARNING: ${event.message}`);
		} else {
			// Regular progress - only show important messages
			if (
				message.includes("completed") ||
				message.includes("starting") ||
				message.includes("configure") ||
				message.includes("make")
			) {
				console.log(`📋 ${event.message}`);
			}
		}
	});

	// Installation status tracking
	protonManager.onInstallStatus((event) => {
		const timestamp = new Date().toISOString();
		const logMessage = `[${timestamp}] [STATUS] ${event.status}: ${event.message || event.error || ""}`;
		logStream.write(`${logMessage}\n`);

		switch (event.status) {
			case "started":
				console.log(
					`🚀 Starting installation: ${event.variant} ${event.version}`,
				);
				break;
			case "downloading":
				console.log(`⬇️ ${event.message}`);
				break;
			case "extracting":
				console.log(`📦 Extracting archive...`);
				break;
			case "building":
				console.log(`🔨 Building from source...`);
				break;
			case "completed":
				console.log(`✅ Installation completed successfully!`);
				break;
			case "failed":
				console.error(`❌ Installation failed: ${event.error}`);
				break;
		}
	});

	// Download progress with stall detection
	let lastProgressTime = Date.now();
	let lastBytesDownloaded = 0;

	protonManager.onDownloadProgress((event) => {
		const now = Date.now();
		const timeSinceLastProgress = now - lastProgressTime;

		// Detect stalled downloads
		if (
			timeSinceLastProgress > 30000 &&
			event.bytesDownloaded === lastBytesDownloaded
		) {
			console.warn(`⚠️ Download appears stalled (no progress for 30s)`);
		}

		lastProgressTime = now;
		lastBytesDownloaded = event.bytesDownloaded;

		if (event.totalBytes > 0) {
			const progressBar = "=".repeat(Math.floor(event.percentage / 5));
			const emptyBar = " ".repeat(20 - progressBar.length);
			const speed = (event.speed / 1024 / 1024).toFixed(1);
			const eta = Math.floor(event.estimatedTimeRemaining);

			process.stdout.write(
				`\r📥 Progress: [${progressBar}${emptyBar}] ${event.percentage.toFixed(1)}% | ${speed} MB/s | ETA: ${eta}s`,
			);
		}
	});

	try {
		// Attempt installation with error handling
		console.log("\n--- Attempting Proton-GE installation with build ---");

		const result = await protonManager.installProtonVersion({
			variant: "proton-ge",
			version: "GE-Proton8-26", // Use a known version
			force: true,
			buildOptions,
		});

		if (result.success) {
			console.log(`\n🎉 Build completed successfully!`);
			console.log(`📁 Installation path: ${result.installPath}`);

			// Verify installation
			if (result.installPath) {
				await verifyInstallation(result.installPath);
			}
		} else {
			console.error(`\n❌ Build failed: ${result.error}`);
			await analyzeBuildFailure(
				result.error || "Unknown error",
				errorMessages,
				warningMessages,
				logFile,
			);
		}
	} catch (error) {
		console.error(`\n💥 Unexpected error during build:`);
		console.error(error);

		await analyzeBuildFailure(
			error instanceof Error ? error.message : String(error),
			errorMessages,
			warningMessages,
			logFile,
		);
	} finally {
		// Close log file
		await logStream.close();

		// Print summary
		console.log(`\n📊 Build Summary:`);
		console.log(`   Errors detected: ${errorMessages.length}`);
		console.log(`   Warnings detected: ${warningMessages.length}`);
		console.log(`   Log file: ${logFile}`);
	}
}

/**
 * Verifies that the installation was successful
 */
async function verifyInstallation(installPath: string): Promise<void> {
	console.log(`\n🔍 Verifying installation at ${installPath}`);

	try {
		// Check for essential files
		const essentialFiles = ["proton", "user_settings.py", "toolmanifest.vdf"];
		const missingFiles: string[] = [];

		for (const file of essentialFiles) {
			const filePath = path.join(installPath, file);
			try {
				await fs.access(filePath);
				console.log(`✅ Found: ${file}`);
			} catch {
				missingFiles.push(file);
				console.warn(`❌ Missing: ${file}`);
			}
		}

		if (missingFiles.length > 0) {
			console.warn(
				`⚠️ Installation may be incomplete. Missing files: ${missingFiles.join(", ")}`,
			);
		} else {
			console.log(`✅ Installation verification passed!`);
		}

		// Check directory size
		const entries = await fs.readdir(installPath);
		console.log(`📁 Installation contains ${entries.length} files/directories`);
	} catch (error) {
		console.error(`❌ Verification failed: ${error}`);
	}
}

/**
 * Analyzes build failure and provides troubleshooting guidance
 */
async function analyzeBuildFailure(
	errorMessage: string,
	errorMessages: string[],
	warningMessages: string[],
	logFile: string,
): Promise<void> {
	console.log(`\n🔍 Analyzing build failure...`);

	// Common error patterns and solutions
	const errorPatterns = [
		{
			pattern: /no makefile|makefile.*not found/i,
			solution:
				"Configure step likely failed. Check if configure script exists and ran successfully.",
		},
		{
			pattern: /permission denied|cannot create/i,
			solution:
				"Permission issue. Check write permissions to installation directory.",
		},
		{
			pattern: /no space left|disk full/i,
			solution: "Insufficient disk space. Free up space and try again.",
		},
		{
			pattern: /timeout|timed out/i,
			solution: "Build timed out. Increase buildTimeout or reduce makeJobs.",
		},
		{
			pattern: /gcc.*not found|compiler.*not found/i,
			solution:
				"Missing compiler. Install build-essential package (Ubuntu/Debian) or equivalent.",
		},
		{
			pattern: /make.*not found/i,
			solution:
				"Missing make utility. Install build tools for your distribution.",
		},
	];

	// Analyze main error
	console.log(`❌ Main error: ${errorMessage}`);

	for (const { pattern, solution } of errorPatterns) {
		if (pattern.test(errorMessage)) {
			console.log(`💡 Suggested solution: ${solution}`);
			break;
		}
	}

	// Analyze collected errors
	if (errorMessages.length > 0) {
		console.log(`\n🚨 Detected ${errorMessages.length} error(s) during build:`);
		errorMessages.slice(0, 5).forEach((msg, i) => {
			console.log(`   ${i + 1}. ${msg}`);
		});
		if (errorMessages.length > 5) {
			console.log(`   ... and ${errorMessages.length - 5} more (see log file)`);
		}
	}

	// Analyze warnings
	if (warningMessages.length > 0) {
		console.log(`\n⚠️ Detected ${warningMessages.length} warning(s):`);
		warningMessages.slice(0, 3).forEach((msg, i) => {
			console.log(`   ${i + 1}. ${msg}`);
		});
		if (warningMessages.length > 3) {
			console.log(
				`   ... and ${warningMessages.length - 3} more (see log file)`,
			);
		}
	}

	// General troubleshooting tips
	console.log(`\n🛠️ General troubleshooting tips:`);
	console.log(`   1. Check the full log file: ${logFile}`);
	console.log(`   2. Ensure all build dependencies are installed`);
	console.log(`   3. Try reducing parallel jobs: buildOptions.makeJobs = 1`);
	console.log(
		`   4. Increase timeout: buildOptions.buildTimeout = 7200000 (2 hours)`,
	);
	console.log(`   5. Check available disk space (builds need 5-15 GB)`);
	console.log(`   6. Try a different Proton version`);
	console.log(`   7. Consider using pre-built binaries instead`);
}

/**
 * Demonstrates retry logic for failed builds
 */
export async function demonstrateBuildRetry(): Promise<void> {
	console.log(`\n=== Build Retry Logic Example ===`);

	const protonManager = new ProtonManager();

	if (!protonManager.isInstallationSupported()) {
		console.log("Proton installation not supported on this platform.");
		return;
	}

	const maxRetries = 3;
	let attempt = 0;

	while (attempt < maxRetries) {
		attempt++;
		console.log(`\n🔄 Build attempt ${attempt}/${maxRetries}`);

		// Adjust build options based on attempt
		const buildOptions: ProtonBuildOptions = {
			enableBuild: true,
			buildTimeout: 1800000 * attempt, // Increase timeout each attempt
			makeJobs: Math.max(1, 4 - attempt), // Reduce parallelism each attempt
			configureArgs: ["--enable-win64"],
			makeArgs: attempt === 1 ? ["VERBOSE=1"] : [], // Only verbose on first attempt
		};

		try {
			const result = await protonManager.installProtonVersion({
				variant: "proton-ge",
				version: "GE-Proton8-26",
				force: true,
				buildOptions,
			});

			if (result.success) {
				console.log(`✅ Build succeeded on attempt ${attempt}!`);
				return;
			} else {
				console.error(`❌ Attempt ${attempt} failed: ${result.error}`);
			}
		} catch (error) {
			console.error(`💥 Attempt ${attempt} crashed: ${error}`);
		}

		if (attempt < maxRetries) {
			const waitTime = 5000 * attempt; // Exponential backoff
			console.log(`⏳ Waiting ${waitTime}ms before retry...`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}
	}

	console.log(`❌ All ${maxRetries} build attempts failed.`);
}

// Run the examples
if (require.main === module) {
	demonstrateBuildErrorHandling()
		.then(() => demonstrateBuildRetry())
		.catch(console.error);
}
