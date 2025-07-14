/**
 * Advanced example demonstrating download and extraction progress tracking with event handling
 *
 * This example shows different approaches to:
 * - Real-time progress bars with detailed statistics for downloads and extraction
 * - Event-driven installation workflows with file-by-file extraction tracking
 * - Error handling and retry mechanisms
 * - Batch installations with progress aggregation
 */

import type { ExtractionProgressEvent, ProtonVariant } from "../../@types";
import { ProtonManager } from "../core";
import type {
	DownloadProgressEvent,
	DownloadStatusEvent,
} from "../core/ProtonInstaller";

/**
 * Progress tracker class for managing installation progress
 */
class InstallationProgressTracker {
	private startTime: number = 0;
	private currentInstallation: string = "";
	private totalInstallations: number = 0;
	private completedInstallations: number = 0;

	constructor(private protonManager: ProtonManager) {
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		this.protonManager.onInstallStatus((event: DownloadStatusEvent) => {
			this.handleStatusChange(event);
		});

		this.protonManager.onDownloadProgress((event: DownloadProgressEvent) => {
			this.handleProgress(event);
		});

		this.protonManager.onExtractionProgress(
			(event: ExtractionProgressEvent) => {
				this.handleExtractionProgress(event);
			},
		);

		this.protonManager.onInstallComplete((event) => {
			this.handleComplete(event);
		});

		this.protonManager.onInstallError((event) => {
			this.handleError(event);
		});
	}

	private handleStatusChange(event: DownloadStatusEvent): void {
		const timestamp = new Date().toLocaleTimeString();

		switch (event.status) {
			case "started":
				this.startTime = Date.now();
				this.currentInstallation = `${event.variant} ${event.version}`;
				console.log(
					`\n[${timestamp}] 🚀 Starting installation: ${this.currentInstallation}`,
				);
				break;

			case "downloading":
				console.log(`[${timestamp}] 📥 ${event.message}`);
				break;

			case "extracting":
				console.log(
					`\n[${timestamp}] 📦 Extracting ${this.currentInstallation}...`,
				);
				break;

			case "completed": {
				const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
				console.log(
					`\n[${timestamp}] ✅ Installation completed in ${duration}s`,
				);
				break;
			}

			case "failed":
				console.log(`\n[${timestamp}] ❌ Installation failed: ${event.error}`);
				break;
		}
	}

	private handleProgress(event: DownloadProgressEvent): void {
		// Create a detailed progress bar
		const barLength = 30;
		const filledLength = Math.floor((event.percentage / 100) * barLength);
		const progressBar =
			"█".repeat(filledLength) + "░".repeat(barLength - filledLength);

		// Format file sizes
		const downloadedMB = (event.bytesDownloaded / 1024 / 1024).toFixed(1);
		const totalMB = (event.totalBytes / 1024 / 1024).toFixed(1);

		// Format speed
		const speedMB = (event.speed / 1024 / 1024).toFixed(1);

		// Format ETA
		const etaMin = Math.floor(event.estimatedTimeRemaining / 60);
		const etaSec = Math.floor(event.estimatedTimeRemaining % 60);
		const etaStr = `${etaMin}:${etaSec.toString().padStart(2, "0")}`;

		// Batch progress if applicable
		const batchProgress =
			this.totalInstallations > 1
				? ` | Batch: ${this.completedInstallations + 1}/${this.totalInstallations}`
				: "";

		process.stdout.write(
			`\r📊 [${progressBar}] ${event.percentage.toFixed(1)}% | ${downloadedMB}/${totalMB} MB | ${speedMB} MB/s | ETA: ${etaStr}${batchProgress}`,
		);
	}

	private handleExtractionProgress(event: ExtractionProgressEvent): void {
		// Create a detailed progress bar for extraction
		const barLength = 30;
		const filledLength = Math.floor((event.percentage / 100) * barLength);
		const progressBar =
			"█".repeat(filledLength) + "░".repeat(barLength - filledLength);

		// Truncate filename if too long
		const fileName =
			event.currentFile.length > 35
				? `...${event.currentFile.slice(-32)}`
				: event.currentFile;

		// Batch progress if applicable
		const batchProgress =
			this.totalInstallations > 1
				? ` | Batch: ${this.completedInstallations + 1}/${this.totalInstallations}`
				: "";

		process.stdout.write(
			`\r📦 [${progressBar}] ${event.percentage.toFixed(1)}% | ${event.entriesProcessed}/${event.totalEntries} files | ${fileName}${batchProgress}`,
		);
	}

	private handleComplete(event: {
		variant: ProtonVariant;
		version: string;
		installPath: string;
	}): void {
		this.completedInstallations++;
		const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
		console.log(
			`\n🎉 ${event.variant} ${event.version} installed successfully in ${duration}s`,
		);
		console.log(`📁 Location: ${event.installPath}`);

		if (
			this.completedInstallations === this.totalInstallations &&
			this.totalInstallations > 1
		) {
			console.log(
				`\n🏆 All ${this.totalInstallations} installations completed!`,
			);
		}
	}

	private handleError(event: {
		variant: ProtonVariant;
		version: string;
		error: string;
	}): void {
		console.log(
			`\n💥 Failed to install ${event.variant} ${event.version}: ${event.error}`,
		);
	}

	setBatchInfo(total: number): void {
		this.totalInstallations = total;
		this.completedInstallations = 0;
	}

	cleanup(): void {
		this.protonManager.removeAllInstallListeners();
	}
}

/**
 * Example 1: Single installation with detailed progress tracking
 */
export async function singleInstallationWithProgress(): Promise<void> {
	const protonManager = new ProtonManager();

	if (!protonManager.isInstallationSupported()) {
		console.log("❌ Proton installation not supported on this system");
		return;
	}

	console.log("🔧 Single Installation with Detailed Progress Tracking");
	console.log("=".repeat(60));

	const tracker = new InstallationProgressTracker(protonManager);

	try {
		const result = await protonManager.installProtonVersion({
			variant: "proton-ge",
			version: "GE-Proton8-32",
			force: false,
		});

		if (result.success) {
			console.log(`\n✅ Installation completed successfully`);
			console.log(`📁 Installation path: ${result.installPath}`);
		} else {
			console.log(`\n❌ Installation failed: ${result.error}`);
		}
	} finally {
		tracker.cleanup();
	}
}

/**
 * Example 2: Batch installation with aggregated progress
 */
export async function batchInstallationWithProgress(): Promise<void> {
	const protonManager = new ProtonManager();

	if (!protonManager.isInstallationSupported()) {
		console.log("❌ Proton installation not supported on this system");
		return;
	}

	const versionsToInstall = [
		{ variant: "proton-ge", version: "GE-Proton8-32" },
		{ variant: "proton-ge", version: "GE-Proton9-1" },
		{
			variant: "proton-experimental" as ProtonVariant,
			version: "bleeding-edge",
		},
	];

	console.log("\n🔧 Batch Installation with Progress Tracking");
	console.log("=".repeat(60));
	console.log(`Installing ${versionsToInstall.length} Proton versions...\n`);

	const tracker = new InstallationProgressTracker(protonManager);
	tracker.setBatchInfo(versionsToInstall.length);

	try {
		for (let i = 0; i < versionsToInstall.length; i++) {
			const versionInfo = versionsToInstall[i];
			if (!versionInfo) {
				console.log(`\n Skipping undefined version at index ${i}`);
				continue;
			}
			const { variant, version } = versionInfo;

			console.log(
				`\n📦 [${i + 1}/${versionsToInstall.length}] Installing ${variant} ${version}`,
			);

			const result = await protonManager.installProtonVersion({
				variant,
				version,
				force: false,
			});

			if (!result.success) {
				console.log(
					`\n❌ Failed to install ${variant} ${version}: ${result.error}`,
				);
				continue;
			}

			// Small delay between installations
			if (i < versionsToInstall.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	} finally {
		tracker.cleanup();
	}
}

/**
 * Example 3: Installation with retry mechanism
 */
export async function installationWithRetry(): Promise<void> {
	const protonManager = new ProtonManager();

	if (!protonManager.isInstallationSupported()) {
		console.log("❌ Proton installation not supported on this system");
		return;
	}

	console.log("\n🔧 Installation with Retry Mechanism");
	console.log("=".repeat(60));

	const maxRetries = 3;
	const variant: ProtonVariant = "proton-ge";
	const version = "GE-Proton8-32";

	const tracker = new InstallationProgressTracker(protonManager);

	try {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			console.log(
				`\n🔄 Attempt ${attempt}/${maxRetries} to install ${variant} ${version}`,
			);

			const result = await protonManager.installProtonVersion({
				variant,
				version,
				force: attempt > 1, // Force reinstall on retry
			});

			if (result.success) {
				console.log(`\n✅ Installation successful on attempt ${attempt}`);
				console.log(`📁 Installation path: ${result.installPath}`);
				break;
			} else {
				console.log(`\n❌ Attempt ${attempt} failed: ${result.error}`);

				if (attempt < maxRetries) {
					console.log(`⏳ Waiting 5 seconds before retry...`);
					await new Promise((resolve) => setTimeout(resolve, 5000));
				} else {
					console.log(`💀 All ${maxRetries} attempts failed. Giving up.`);
				}
			}
		}
	} finally {
		tracker.cleanup();
	}
}

/**
 * Example 4: Custom progress display with statistics
 */
export async function customProgressDisplay(): Promise<void> {
	const protonManager = new ProtonManager();

	if (!protonManager.isInstallationSupported()) {
		console.log("❌ Proton installation not supported on this system");
		return;
	}

	console.log("\n🔧 Custom Progress Display with Statistics");
	console.log("=".repeat(60));

	const downloadStats = {
		peakSpeed: 0,
		averageSpeed: 0,
		speedSamples: [] as number[],
		startTime: 0,
	};

	// Custom progress handler with statistics
	protonManager.onDownloadProgress((event: DownloadProgressEvent) => {
		// Track speed statistics
		downloadStats.speedSamples.push(event.speed);
		downloadStats.peakSpeed = Math.max(downloadStats.peakSpeed, event.speed);
		downloadStats.averageSpeed =
			downloadStats.speedSamples.reduce((a, b) => a + b, 0) /
			downloadStats.speedSamples.length;

		// Create visual progress bar with colors (using Unicode)
		const barLength = 25;
		const filledLength = Math.floor((event.percentage / 100) * barLength);
		const progressBar =
			"🟩".repeat(filledLength) + "⬜".repeat(barLength - filledLength);

		// Format speeds
		const currentSpeedMB = (event.speed / 1024 / 1024).toFixed(1);
		const peakSpeedMB = (downloadStats.peakSpeed / 1024 / 1024).toFixed(1);
		const avgSpeedMB = (downloadStats.averageSpeed / 1024 / 1024).toFixed(1);

		// Format file sizes
		const downloadedMB = (event.bytesDownloaded / 1024 / 1024).toFixed(1);
		const totalMB = (event.totalBytes / 1024 / 1024).toFixed(1);

		// Clear previous lines and display new progress
		process.stdout.write("\r\x1b[K"); // Clear current line
		process.stdout.write(`📊 ${progressBar} ${event.percentage.toFixed(1)}%\n`);
		process.stdout.write(
			`📥 ${downloadedMB}/${totalMB} MB | Current: ${currentSpeedMB} MB/s | Peak: ${peakSpeedMB} MB/s | Avg: ${avgSpeedMB} MB/s`,
		);
		process.stdout.write("\r\x1b[1A"); // Move cursor up one line
	});

	protonManager.onInstallStatus((event: DownloadStatusEvent) => {
		if (event.status === "started") {
			downloadStats.startTime = Date.now();
			downloadStats.speedSamples = [];
			downloadStats.peakSpeed = 0;
			downloadStats.averageSpeed = 0;
		}

		if (event.status === "completed") {
			const totalTime = ((Date.now() - downloadStats.startTime) / 1000).toFixed(
				1,
			);
			console.log(`\n\n📈 Download Statistics:`);
			console.log(`   ⏱️  Total time: ${totalTime}s`);
			console.log(
				`   🚀 Peak speed: ${(downloadStats.peakSpeed / 1024 / 1024).toFixed(1)} MB/s`,
			);
			console.log(
				`   📊 Average speed: ${(downloadStats.averageSpeed / 1024 / 1024).toFixed(1)} MB/s`,
			);
		}
	});

	try {
		const result = await protonManager.installProtonVersion({
			variant: "proton-ge",
			version: "GE-Proton8-32",
			force: false,
		});

		if (!result.success) {
			console.log(`\n❌ Installation failed: ${result.error}`);
		}
	} finally {
		protonManager.removeAllInstallListeners();
	}
}

// Run examples if this file is executed directly
if (require.main === module) {
	(async () => {
		try {
			await singleInstallationWithProgress();
			await new Promise((resolve) => setTimeout(resolve, 2000));

			await customProgressDisplay();
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Uncomment to run other examples
			// await batchInstallationWithProgress();
			// await installationWithRetry();

			console.log("\n✨ All examples completed successfully");
		} catch (error) {
			console.error("❌ Example failed:", error);
			process.exit(1);
		}
	})();
}
