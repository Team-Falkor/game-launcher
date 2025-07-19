import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { GameLauncher } from "./src/index";

// Example demonstrating the new Game class feature
async function demonstrateGameClassLaunch() {
	const launcher = new GameLauncher({
		maxConcurrentGames: 5,
		enableProcessMonitoring: true,
		logging: {
			enabled: false,
		},
	});

	// Set up global event listeners (still works as before)
	launcher.on("launched", (event) => {
		console.log(`[Global] Game launched: ${event.gameId} (PID: ${event.pid})`);
	});

	launcher.on("error", (event) => {
		console.error(`[Global] Error in ${event.phase}: ${event.error.message}`);
	});

	try {
		// Example 1: Regular game launch - now returns a Game instance!
		console.log("Launching regular game...");
		const regularGame = await launcher.launchGame({
			gameId: "notepad-regular",
			executable: "C:\\Windows\\System32\\notepad.exe",
			args: [],
			metadata: {
				name: "Notepad (Regular)",
				privileges: "user",
			},
		});

		// Set up game-specific event listeners
		regularGame.on("launched", (event) => {
			console.log(`[${regularGame.id}] Game launched: PID ${event.pid}`);
		});

		regularGame.on("closed", (event) => {
			console.log(
				`[${regularGame.id}] Game closed with exit code: ${event.exitCode}`,
			);
		});

		regularGame.on("error", (event) => {
			console.error(`[${regularGame.id}] Game error: ${event.error.message}`);
		});

		regularGame.on("output", (event) => {
			console.log(
				`[${regularGame.id}] Output (${event.type}): ${event.data.trim()}`,
			);
		});

		// Example 2: Admin game launch
		console.log("Launching game with admin privileges...");
		const adminGame = await launcher.launchGame({
			gameId: "notepad-admin",
			executable: "C:\\Windows\\System32\\notepad.exe",
			args: [],
			runAsAdmin: true, // This will prompt for admin privileges
			metadata: {
				name: "Notepad (Admin)",
				privileges: "administrator",
				requiresElevation: true,
			},
		});

		// Set up different event listeners for the admin game
		adminGame.on("launched", (event) => {
			console.log(`[${adminGame.id}] Admin game launched: PID ${event.pid}`);
		});

		adminGame.on("output", (event) => {
			console.log(
				`[${adminGame.id}] Output (${event.type}): ${event.data.trim()}`,
			);
		});

		adminGame.on("statusChange", (event) => {
			console.log(
				`[${adminGame.id}] Status: ${event.previousStatus} → ${event.currentStatus}`,
			);
		});

		console.log("Both games launched successfully!");
		console.log(`Regular game ID: ${regularGame.id}`);
		console.log(`Admin game ID: ${adminGame.id}`);

		// Check running games using the Game instances
		console.log(`Regular game running: ${regularGame.isRunning()}`);
		console.log(`Admin game running: ${adminGame.isRunning()}`);

		// Get detailed info for each game using the Game instances
		const regularInfo = regularGame.getInfo();
		const adminInfo = adminGame.getInfo();

		if (regularInfo) {
			console.log(`Regular game info:`, {
				pid: regularInfo.pid,
				status: regularInfo.status,
				metadata: regularInfo.metadata,
			});
		}

		if (adminInfo) {
			console.log(`Admin game info:`, {
				pid: adminInfo.pid,
				status: adminInfo.status,
				metadata: adminInfo.metadata,
			});
		}

		// Wait a bit then close games using the Game instances
		setTimeout(async () => {
			console.log("Closing games...");
			await regularGame.close();
			await adminGame.close();
			launcher.destroy();
		}, 5000);
	} catch (error) {
		console.error("Failed to launch game:", error);
		launcher.destroy();
	}
}

// Run the demonstration
if (import.meta.main) {
	demonstrateGameClassLaunch().catch(console.error);
}

import { getPlatform } from "./src/utils/platform";

// Helper function to find executable path
function findExecutable(command: string): string | null {
	try {
		const platform = getPlatform();

		if (platform === "win32") {
			// On Windows, use 'where' command
			const result = execSync(`where ${command}`, { encoding: "utf8" });
			return result.trim().split("\n")[0];
		} else {
			// On Unix-like systems, use 'which' command
			const result = execSync(`which ${command}`, { encoding: "utf8" });
			return result.trim();
		}
	} catch (_error) {
		return null;
	}
}

// Helper function to get a test executable based on platform
function getTestExecutable(): { executable: string; args: string[] } {
	const platform = getPlatform();

	switch (platform) {
		case "win32": {
			// Try different Windows executables
			const windowsExes = [
				"C:\\Windows\\System32\\notepad.exe",
				"C:\\Windows\\System32\\calc.exe",
				"C:\\Windows\\System32\\ping.exe",
			];

			for (const exe of windowsExes) {
				if (existsSync(exe)) {
					if (exe.includes("ping.exe")) {
						return { executable: exe, args: ["127.0.0.1", "-n", "3"] };
					}
					return { executable: exe, args: [] };
				}
			}

			// Fallback to searching PATH
			const notepadPath = findExecutable("notepad.exe");
			if (notepadPath) {
				return { executable: notepadPath, args: [] };
			}

			throw new Error("No suitable Windows executable found");
		}

		case "darwin": {
			// macOS executables
			const macExes = ["/bin/echo", "/usr/bin/say", "/bin/ls"];

			for (const exe of macExes) {
				if (existsSync(exe)) {
					if (exe.includes("say")) {
						return { executable: exe, args: ["Hello from game launcher!"] };
					}
					if (exe.includes("echo")) {
						return { executable: exe, args: ["Hello World from macOS!"] };
					}
					if (exe.includes("ls")) {
						return { executable: exe, args: ["-la", "/tmp"] };
					}
				}
			}

			throw new Error("No suitable macOS executable found");
		}

		case "linux": {
			// Linux executables
			const linuxExes = [
				"/bin/echo",
				"/usr/bin/echo",
				"/bin/ls",
				"/usr/bin/ls",
				"/bin/date",
				"/usr/bin/date",
			];

			for (const exe of linuxExes) {
				if (existsSync(exe)) {
					if (exe.includes("echo")) {
						return { executable: exe, args: ["Hello World from Linux!"] };
					}
					if (exe.includes("ls")) {
						return { executable: exe, args: ["-la", "/tmp"] };
					}
					if (exe.includes("date")) {
						return { executable: exe, args: [] };
					}
				}
			}

			throw new Error("No suitable Linux executable found");
		}

		default:
			// Generic Unix
			if (existsSync("/bin/echo")) {
				return { executable: "/bin/echo", args: ["Hello World!"] };
			}

			throw new Error("No suitable executable found");
	}
}

async function runExample() {
	console.log("🎮 Game Launcher Example");
	console.log("========================");
	console.log(`Platform: ${getPlatform()}`);
	console.log(`Node.js: ${process.execPath}`);
	console.log(`Working Directory: ${process.cwd()}`);

	// Playtime tracking
	const playtimeTracker = new Map<
		string,
		{ startTime: Date; endTime?: Date; duration?: number }
	>();

	// Create launcher instance
	const launcher = new GameLauncher({
		maxConcurrentGames: 3,
		enableProcessMonitoring: true,
		monitoringInterval: 1000,
		defaultWorkingDirectory: process.cwd(),
		defaultEnvironment: {
			GAME_MODE: "test",
			DEBUG: "true",
		},
		logging: {
			enabled: false,
		},
	});

	// Set up event listeners
	console.log("\n📡 Setting up event listeners...");

	launcher.on("launched", (data) => {
		console.log(`✅ Game launched: ${data.gameId} (PID: ${data.pid})`);
		console.log(`   Command: ${data.command}`);
		console.log(`   Args: ${data.args.join(" ")}`);
		console.log(`   Start time: ${data.startTime.toISOString()}`);

		// Track playtime start
		playtimeTracker.set(data.gameId, {
			startTime: data.startTime,
		});
		console.log(`⏱️  Playtime tracking started for ${data.gameId}`);
	});

	launcher.on("closed", (data) => {
		console.log(`❌ Game closed: ${data.gameId}`);
		console.log(`   Exit code: ${data.exitCode}`);
		console.log(`   Signal: ${data.signal}`);
		console.log(`   Duration: ${data.duration}ms`);

		// Update playtime tracking
		const playtime = playtimeTracker.get(data.gameId);
		if (playtime) {
			playtime.endTime = data.endTime;
			playtime.duration = data.duration;

			// Format playtime for display
			const seconds = Math.floor(data.duration / 1000);
			const minutes = Math.floor(seconds / 60);
			const remainingSeconds = seconds % 60;

			let playtimeDisplay = "";
			if (minutes > 0) {
				playtimeDisplay = `${minutes}m ${remainingSeconds}s`;
			} else {
				playtimeDisplay = `${remainingSeconds}s`;
			}

			console.log(`⏱️  Total playtime: ${playtimeDisplay} (${data.duration}ms)`);
			playtimeTracker.delete(data.gameId); // Clean up
		}
	});

	launcher.on("error", (data) => {
		console.log(`💥 Game error: ${data.gameId}`);
		console.log(`   Phase: ${data.phase}`);
		console.log(`   Error: ${data.error.message}`);
	});

	launcher.on("output", (data) => {
		const output = data.data.trim();
		if (output) {
			console.log(`📝 Output from ${data.gameId} (${data.type}): ${output}`);
		}
	});

	launcher.on("statusChange", (data) => {
		console.log(
			`🔄 Status change: ${data.gameId} (${data.previousStatus} → ${data.currentStatus})`,
		);
	});

	try {
		// Test 1: Launch a simple game
		console.log("\n🚀 Test 1: Launching a simple game...");
		try {
			const testApp = getTestExecutable();
			console.log(`   Using executable: ${testApp.executable}`);
			console.log(`   With args: ${testApp.args.join(" ")}`);

			const testGame = await launcher.launchGame({
				gameId: "test-game-1",
				executable: testApp.executable,
				args: testApp.args,
				captureOutput: true,
				metadata: {
					name: "Test Game 1",
					version: "1.0.0",
					type: "system-command",
				},
			});

			// Set up game-specific event listeners for the test game
			testGame.on("launched", (event) => {
				console.log(`[${testGame.id}] Test game launched successfully!`, event);
			});

			testGame.on("output", (event) => {
				console.log(`[${testGame.id}] ${event.type}: ${event.data.trim()}`);
			});

			testGame.on("closed", (event) => {
				console.log(
					`[${testGame.id}] Test game finished with exit code: ${event.exitCode}`,
				);
			});

			// Wait for the game to close naturally
			console.log("\n⏳ Waiting for game to close...");
			await new Promise<void>((resolve) => {
				const onClosed = () => {
					launcher.off("closed", onClosed);
					resolve();
				};
				launcher.on("closed", onClosed);
			});

			console.log("\n✅ Test completed successfully!");
		} catch (error) {
			console.log(
				`   Failed to launch system executable: ${(error as Error).message}`,
			);
		}
	} catch (error) {
		console.error("❌ Example failed:", error);
	} finally {
		// Display playtime summary
		console.log("\n📊 Playtime Summary");
		console.log("==================");

		if (playtimeTracker.size === 0) {
			console.log("✅ All games completed successfully!");
		} else {
			console.log("⚠️  Some games may still be running:");
			playtimeTracker.forEach((playtime, gameId) => {
				const currentDuration = Date.now() - playtime.startTime.getTime();
				const seconds = Math.floor(currentDuration / 1000);
				const minutes = Math.floor(seconds / 60);
				const remainingSeconds = seconds % 60;

				let currentPlaytime = "";
				if (minutes > 0) {
					currentPlaytime = `${minutes}m ${remainingSeconds}s`;
				} else {
					currentPlaytime = `${remainingSeconds}s`;
				}

				console.log(`   ${gameId}: ${currentPlaytime} (still running)`);
			});
		}

		// Cleanup
		console.log("\n🧹 Cleaning up...");
		launcher.destroy();
		console.log("✅ Cleanup complete");
	}
}

// Handle process termination
process.on("SIGINT", () => {
	console.log("\n🛑 Received SIGINT, shutting down gracefully...");
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
	process.exit(0);
});

// Run the example
if (require.main === module) {
	runExample().catch(console.error);
}
