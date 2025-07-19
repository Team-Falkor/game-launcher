import { GameLauncher } from '../src/index';
import type { ProtonVariant, ProtonVersions, ExtractionProgressEvent } from '../src/@types';
import type { DownloadProgressEvent, DownloadStatusEvent } from '../src/proton/core/ProtonInstaller';

/**
 * Example demonstrating Proton integration with GameLauncher
 * This example shows how to configure and use Proton for Windows game compatibility on Linux
 */

async function protonIntegrationExample() {
	console.log("=== Proton Integration Example ===");

	// Create GameLauncher with Proton configuration
	const launcher = new GameLauncher({
		maxConcurrentGames: 5,
		logging: {
			enabled: true,
			config: {
				level: 1, // INFO level
				enableConsole: true,
			},
		},
		// Proton configuration (Linux only)
		proton: {
			enabled: true,
			autoDetect: true,
			preferredVariant: "proton-ge" as ProtonVariant,
			// installPath: "/custom/proton/path", // Optional custom path
			// defaultVersion: "8.0-5", // Optional default version
		},
	});

	// Check if Proton is available
	if (launcher.isProtonAvailable()) {
		console.log("✅ Proton is available and enabled");

		// Get ProtonManager instance
		const protonManager = launcher.getProtonManager();
		if (protonManager) {
			try {
				// List available Proton versions
				console.log("\n📋 Listing available Proton versions...");
				const versions = await protonManager.listAvailableProtonVersions();

				for (const [variant, versionList] of Object.entries(versions as ProtonVersions)) {
					console.log(`\n${variant}:`);
					if (Array.isArray(versionList)) {
						versionList.slice(0, 3).forEach((version) => {
							console.log(
								`  ${version.version} - ${version.installed ? "✅ Installed" : "❌ Not installed"}`,
							);
						});
						if (versionList.length > 3) {
							console.log(`  ... and ${versionList.length - 3} more`);
						}
					}
				}

				// Example 1: Launch a Windows game with default Proton settings
				console.log("\n🎮 Example 1: Launching game with default Proton settings");
				try {
					const game1 = await launcher.launchGame({
						gameId: "example-windows-game-1",
						executable: "/path/to/windows/game.exe",
						args: ["-windowed", "-nosound"],
						proton: {
							enabled: true,
							// Will use preferred variant and auto-select version
						},
					});
					console.log(`✅ Game launched with ID: ${game1.id}`);

					// Close the game after a short delay
					setTimeout(async () => {
						await launcher.closeGame("example-windows-game-1");
						console.log("🔴 Game 1 closed");
					}, 2000);
				} catch (error) {
					console.error("❌ Failed to launch game 1:", error);
				}

				// Example 2: Launch with specific Proton variant and version
				console.log("\n🎮 Example 2: Launching game with specific Proton configuration");
				try {
					const game2 = await launcher.launchGame({
						gameId: "example-windows-game-2",
						executable: "/path/to/another/windows/game.exe",
						args: ["-fullscreen"],
						proton: {
							enabled: true,
							variant: "proton-experimental" as ProtonVariant,
							// version: "bleeding-edge", // Uncomment to specify version
							customArgs: ["-force-d3d11"],
							winePrefix: "/home/user/.wine-prefixes/game2",
						},
						environment: {
							DXVK_HUD: "fps",
							PROTON_LOG: "1",
						},
					});
					console.log(`✅ Game 2 launched with ID: ${game2.id}`);

					// Close the game after a short delay
					setTimeout(async () => {
						await launcher.closeGame("example-windows-game-2");
						console.log("🔴 Game 2 closed");
					}, 2000);
				} catch (error) {
					console.error("❌ Failed to launch game 2:", error);
				}

				// Example 3: Install a new Proton version with progress tracking
				console.log("\n📦 Example 3: Installing a new Proton version with progress tracking");
				
				// Set up progress event listeners
				protonManager.onDownloadProgress((progress) => {
					console.log(`📥 Download: ${progress.percentage.toFixed(1)}% (${progress.bytesDownloaded}/${progress.totalBytes} bytes)`);
				});
				
				protonManager.onExtractionProgress((progress) => {
					console.log(`📦 Extraction: ${progress.percentage.toFixed(1)}% (${progress.entriesProcessed}/${progress.totalEntries} files)`);
					if (progress.currentFile) {
						console.log(`   Current: ${progress.currentFile}`);
					}
				});
				
				protonManager.onInstallComplete((result) => {
					console.log(`✅ Installation completed: ${result.variant} ${result.version}`);
				});
				
				protonManager.onInstallError((error) => {
					console.error(`❌ Installation failed: ${error.error}`);
				});
				
				try {
					const installResult = await protonManager.installProtonVersion({
						variant: "proton-ge",
						version: "8.0-5", // Example version
						force: false, // Don't overwrite if already installed
					});

					if (installResult.success) {
						console.log(`✅ Successfully installed ${installResult.variant} ${installResult.version}`);
						console.log(`📁 Installed to: ${installResult.installPath}`);
					} else {
						console.log(`❌ Installation failed: ${installResult.error}`);
					}
				} catch (error) {
					console.error("❌ Installation error:", error);
				}

				// Example 4: Monitor running games
				console.log("\n👀 Example 4: Monitoring running games");
				setInterval(() => {
					const runningGames = launcher.getRunningGames();
					if (runningGames.length > 0) {
						console.log(`🎮 Currently running games: ${runningGames.join(", ")}`);
						runningGames.forEach((gameId) => {
							const info = launcher.getGameInfo(gameId);
							if (info?.metadata) {
								console.log(
									`  ${gameId}: Proton ${info.metadata.protonVariant} ${info.metadata.protonVersion}`,
								);
							}
						});
					} else {
						console.log("💤 No games currently running");
					}
				}, 5000);
			} catch (error) {
				console.error("❌ Error working with ProtonManager:", error);
			}
		}
	} else {
		console.log("❌ Proton is not available (not on Linux or not enabled)");
		console.log("ℹ️  This example is designed for Linux systems with Proton support");

		// Example of regular game launch without Proton
		console.log("\n🎮 Launching a regular game without Proton...");
		try {
			const game = await launcher.launchGame({
				gameId: "regular-game",
				executable: "/usr/bin/echo", // Simple command for demo
				args: ["Hello from regular game launch!"],
			});
			console.log(`✅ Regular game launched with ID: ${game.id}`);

			setTimeout(async () => {
				await launcher.closeGame("regular-game");
				console.log("🔴 Regular game closed");
			}, 1000);
		} catch (error) {
			console.error("❌ Failed to launch regular game:", error);
		}
	}

	// Event handling example
	launcher.on("launched", (data) => {
		console.log(`🚀 Game started: ${data.gameId} (PID: ${data.pid})`);
	});

	launcher.on("closed", (data) => {
		console.log(`🏁 Game exited: ${data.gameId} (exit code: ${data.exitCode})`);
	});

	launcher.on("error", (data) => {
		console.error(`💥 Game error: ${data.gameId} - ${data.error.message}`);
	});

	// Cleanup after 30 seconds
	setTimeout(async () => {
		console.log("\n🧹 Cleaning up...");
		await launcher.destroy();
		console.log("✅ GameLauncher destroyed");
		process.exit(0);
	}, 30000);
}

// Run the example
if (require.main === module) {
	protonIntegrationExample().catch((error) => {
		console.error("❌ Example failed:", error);
		process.exit(1);
	});
}

export { protonIntegrationExample };