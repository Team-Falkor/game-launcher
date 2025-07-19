import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
	DetectedProtonBuild,
	InstallSource,
	ProtonVariant,
} from "@/@types";

/**
 * Detects installed Proton builds from various sources
 * Note: Proton is a Linux-only compatibility layer for running Windows games on Linux
 */
export class ProtonDetector {
	private readonly steamPaths: string[];
	private readonly compatibilityToolsPaths: string[];
	private readonly isLinux: boolean;

	constructor() {
		this.isLinux = os.platform() === "linux";
		this.steamPaths = this.getSteamPaths();
		this.compatibilityToolsPaths = this.getCompatibilityToolsPaths();
	}

	/**
	 * Gets potential Steam installation paths for Linux
	 * Proton is only available on Linux as it's a compatibility layer for Windows games
	 */
	private getSteamPaths(): string[] {
		if (!this.isLinux) {
			return [];
		}

		const homeDir = os.homedir();
		return [
			path.join(homeDir, ".steam", "steam"),
			path.join(homeDir, ".local", "share", "Steam"),
			"/usr/share/steam",
			"/opt/steam",
		];
	}

	/**
	 * Gets potential compatibility tools paths for Linux
	 * Proton compatibility tools are only relevant on Linux
	 */
	private getCompatibilityToolsPaths(): string[] {
		if (!this.isLinux) {
			return [];
		}

		const homeDir = os.homedir();
		return [
			path.join(homeDir, ".steam", "compatibilitytools.d"),
			path.join(homeDir, ".local", "share", "Steam", "compatibilitytools.d"),
		];
	}

	/**
	 * Detects all installed Proton builds from various sources
	 * Returns empty array on non-Linux systems since Proton is Linux-only
	 * @param quickScan - If true, skips expensive size calculations for faster detection
	 */
	async detectInstalledProtonBuilds(
		quickScan = true,
	): Promise<DetectedProtonBuild[]> {
		if (!this.isLinux) {
			console.log(
				"Proton detection skipped: Proton is only available on Linux systems",
			);
			return [];
		}

		try {
			// Detect Steam and manual builds in parallel for better performance
			const [steamBuilds, manualBuilds] = await Promise.all([
				this.detectSteamProtonBuilds(quickScan),
				this.detectManualProtonBuilds(quickScan),
			]);

			// Combine and remove duplicates based on version and variant
			const allBuilds = [...steamBuilds, ...manualBuilds];
			const uniqueBuilds = this.removeDuplicateBuilds(allBuilds);

			return uniqueBuilds;
		} catch (error) {
			console.warn("Error detecting Proton builds:", error);
			return [];
		}
	}

	/**
	 * Gets detailed information for Proton builds including accurate size calculations
	 * This is slower but provides complete information
	 */
	async getDetailedProtonBuilds(): Promise<DetectedProtonBuild[]> {
		return this.detectInstalledProtonBuilds(false);
	}

	/**
	 * Detects Steam-installed Proton builds
	 * Returns empty array on non-Linux systems
	 */
	async detectSteamProtonBuilds(
		quickScan = true,
	): Promise<DetectedProtonBuild[]> {
		if (!this.isLinux) {
			return [];
		}

		// Process all Steam paths in parallel
		const pathPromises = this.steamPaths.map(async (steamPath) => {
			try {
				const steamAppsPath = path.join(steamPath, "steamapps", "common");
				const exists = await this.pathExists(steamAppsPath);

				if (!exists) return [];

				const entries = await fs.readdir(steamAppsPath, {
					withFileTypes: true,
				});

				// Filter Proton directories and process in parallel
				const protonEntries = entries.filter(
					(entry) =>
						entry.isDirectory() && entry.name.toLowerCase().includes("proton"),
				);

				const buildPromises = protonEntries.map(async (entry) => {
					const protonPath = path.join(steamAppsPath, entry.name);
					return this.analyzeProtonDirectory(protonPath, "steam", quickScan);
				});

				const builds = await Promise.all(buildPromises);
				return builds.filter((build) => build !== null);
			} catch (error) {
				console.warn(`Error scanning Steam path ${steamPath}:`, error);
				return [];
			}
		});

		// Wait for all paths to be processed and flatten results
		const allPathResults = await Promise.all(pathPromises);
		return allPathResults.flat();
	}

	/**
	 * Detects manually installed Proton builds in compatibility tools directories
	 * Returns empty array on non-Linux systems
	 */
	async detectManualProtonBuilds(
		quickScan = true,
	): Promise<DetectedProtonBuild[]> {
		if (!this.isLinux) {
			return [];
		}

		const builds: DetectedProtonBuild[] = [];

		// Process all compatibility tools paths in parallel
		const pathPromises = this.compatibilityToolsPaths.map(async (toolsPath) => {
			try {
				console.log(`Scanning compatibility tools path: ${toolsPath}`);
				const exists = await this.pathExists(toolsPath);

				if (!exists) {
					console.log(`Path does not exist: ${toolsPath}`);
					return [];
				}

				const entries = await fs.readdir(toolsPath, { withFileTypes: true });
				console.log(
					`Found ${entries.length} entries in ${toolsPath}:`,
					entries.map((e) => e.name),
				);

				// Process directories in parallel batches for better performance
				const directoryEntries = entries.filter((entry) => entry.isDirectory());
				const batchSize = 5; // Process 5 directories at a time
				const pathBuilds: DetectedProtonBuild[] = [];

				for (let i = 0; i < directoryEntries.length; i += batchSize) {
					const batch = directoryEntries.slice(i, i + batchSize);
					const batchPromises = batch.map(async (entry) => {
						const protonPath = path.join(toolsPath, entry.name);
						console.log(`Analyzing directory: ${entry.name} at ${protonPath}`);

						const build = await this.analyzeProtonDirectory(
							protonPath,
							"manual",
							quickScan,
						);

						if (build) {
							console.log(`Found Proton build:`, {
								variant: build.variant,
								version: build.version,
								path: build.installPath,
							});
							return build;
						} else {
							console.log(`Not a valid Proton build: ${entry.name}`);
							return null;
						}
					});

					const batchResults = await Promise.all(batchPromises);
					pathBuilds.push(...batchResults.filter((build) => build !== null));
				}

				return pathBuilds;
			} catch (error) {
				console.warn(
					`Error scanning compatibility tools path ${toolsPath}:`,
					error,
				);
				return [];
			}
		});

		// Wait for all paths to be processed and flatten results
		const allPathResults = await Promise.all(pathPromises);
		builds.push(...allPathResults.flat());

		return builds;
	}

	/**
	 * Analyzes a directory to determine if it's a Proton installation
	 */
	private async analyzeProtonDirectory(
		protonPath: string,
		installSource: InstallSource,
		quickScan = false,
	): Promise<DetectedProtonBuild | null> {
		try {
			// Check for Proton executable or key files in parallel
			const protonExecutable = path.join(protonPath, "proton");
			const toolmanifest = path.join(protonPath, "toolmanifest.vdf");
			const compatmanifest = path.join(protonPath, "compatibilitytool.vdf");

			const [hasProtonExe, hasToolManifest, hasCompatManifest] =
				await Promise.all([
					this.pathExists(protonExecutable),
					this.pathExists(toolmanifest),
					this.pathExists(compatmanifest),
				]);

			if (!hasProtonExe && !hasToolManifest && !hasCompatManifest) {
				return null;
			}

			// Extract version and variant information
			const dirName = path.basename(protonPath);
			const { version, variant } = this.parseProtonVersion(dirName);
			console.log(
				`Parsed directory '${dirName}' as variant: ${variant}, version: ${version}`,
			);

			// Get directory stats
			const stats = await fs.stat(protonPath);

			// Skip expensive size calculation for quick scans
			const size = quickScan
				? 0
				: await this.getDirectorySizeOptimized(protonPath);

			return {
				version,
				variant,
				installPath: protonPath,
				installSource,
				installDate: stats.birthtime || stats.mtime,
				size,
			};
		} catch (error) {
			console.warn(`Error analyzing Proton directory ${protonPath}:`, error);
			return null;
		}
	}

	/**
	 * Parses version and variant from directory name
	 */
	private parseProtonVersion(dirName: string): {
		version: string;
		variant: ProtonVariant;
	} {
		const name = dirName.toLowerCase();

		// Proton-GE patterns - preserve full version name to match API
		if (name.includes("ge-proton") || name.includes("proton-ge")) {
			// Keep the full directory name as version for GE-Proton builds
			// This ensures compatibility with API version names like "GE-Proton10-9"
			return { version: dirName, variant: "proton-ge" };
		}

		// Wine-GE patterns
		if (name.includes("wine-ge") || name.toLowerCase().includes("wine-ge")) {
			// Keep the full directory name for Wine-GE builds too
			return { version: dirName, variant: "wine-ge" };
		}

		// Steam Proton patterns
		if (name.includes("experimental")) {
			return { version: "bleeding-edge", variant: "proton-experimental" };
		}

		// Default stable Proton - preserve full directory name for consistency
		// This handles official Valve Proton builds like "Proton-8.0", "Proton 9.0", etc.
		return { version: dirName, variant: "proton-stable" };
	}

	/**
	 * Gets the currently active Proton version in Steam
	 * Returns null on non-Linux systems since Proton is Linux-only
	 */
	async getActiveSteamProtonBuild(): Promise<DetectedProtonBuild | null> {
		if (!this.isLinux) {
			return null;
		}

		// This would require parsing Steam's configuration files
		// Implementation depends on Steam's config format
		// For now, return null as this is complex to implement
		return null;
	}

	/**
	 * Removes duplicate builds based on version and variant
	 */
	private removeDuplicateBuilds(
		builds: DetectedProtonBuild[],
	): DetectedProtonBuild[] {
		const seen = new Set<string>();
		return builds.filter((build) => {
			const key = `${build.variant}-${build.version}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}

	/**
	 * Checks if a path exists
	 */
	private async pathExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Optimized directory size calculation with depth limit and timeout
	 */
	private async getDirectorySizeOptimized(
		dirPath: string,
		maxDepth = 2,
	): Promise<number> {
		try {
			// Use a timeout to prevent hanging on large directories
			const timeoutPromise = new Promise<number>((_, reject) =>
				setTimeout(() => reject(new Error("Size calculation timeout")), 5000),
			);

			const sizePromise = this.getDirectorySizeLimited(dirPath, maxDepth, 0);

			return await Promise.race([sizePromise, timeoutPromise]);
		} catch {
			// Fallback: estimate size based on directory entry count
			return this.estimateDirectorySize(dirPath);
		}
	}

	/**
	 * Calculate directory size with depth limit
	 */
	private async getDirectorySizeLimited(
		dirPath: string,
		maxDepth: number,
		currentDepth: number,
	): Promise<number> {
		if (currentDepth >= maxDepth) {
			return 0;
		}

		try {
			let totalSize = 0;
			const entries = await fs.readdir(dirPath, { withFileTypes: true });

			// Process files and directories in parallel batches
			const batchSize = 10;
			for (let i = 0; i < entries.length; i += batchSize) {
				const batch = entries.slice(i, i + batchSize);
				const batchPromises = batch.map(async (entry) => {
					const fullPath = path.join(dirPath, entry.name);

					if (entry.isDirectory()) {
						return this.getDirectorySizeLimited(
							fullPath,
							maxDepth,
							currentDepth + 1,
						);
					} else {
						try {
							const stats = await fs.stat(fullPath);
							return stats.size;
						} catch {
							return 0;
						}
					}
				});

				const batchSizes = await Promise.all(batchPromises);
				totalSize += batchSizes.reduce((sum, size) => sum + size, 0);
			}

			return totalSize;
		} catch {
			return 0;
		}
	}

	/**
	 * Estimate directory size based on entry count (fallback method)
	 */
	private async estimateDirectorySize(dirPath: string): Promise<number> {
		try {
			const entries = await fs.readdir(dirPath);
			// Rough estimate: 100MB per 1000 entries for Proton installations
			return entries.length * 100000;
		} catch {
			return 0;
		}
	}
}
