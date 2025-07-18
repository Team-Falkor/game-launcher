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
	 */
	async detectInstalledProtonBuilds(): Promise<DetectedProtonBuild[]> {
		if (!this.isLinux) {
			console.log(
				"Proton detection skipped: Proton is only available on Linux systems",
			);
			return [];
		}

		const builds: DetectedProtonBuild[] = [];

		try {
			// Detect Steam-installed Proton builds
			const steamBuilds = await this.detectSteamProtonBuilds();
			builds.push(...steamBuilds);

			// Detect manually installed Proton builds
			const manualBuilds = await this.detectManualProtonBuilds();
			builds.push(...manualBuilds);

			// Remove duplicates based on version and variant
			const uniqueBuilds = this.removeDuplicateBuilds(builds);

			return uniqueBuilds;
		} catch (error) {
			console.warn("Error detecting Proton builds:", error);
			return [];
		}
	}

	/**
	 * Detects Steam-installed Proton builds
	 * Returns empty array on non-Linux systems
	 */
	async detectSteamProtonBuilds(): Promise<DetectedProtonBuild[]> {
		if (!this.isLinux) {
			return [];
		}

		const builds: DetectedProtonBuild[] = [];

		for (const steamPath of this.steamPaths) {
			try {
				const steamAppsPath = path.join(steamPath, "steamapps", "common");
				const exists = await this.pathExists(steamAppsPath);

				if (!exists) continue;

				const entries = await fs.readdir(steamAppsPath, {
					withFileTypes: true,
				});

				for (const entry of entries) {
					if (
						entry.isDirectory() &&
						entry.name.toLowerCase().includes("proton")
					) {
						const protonPath = path.join(steamAppsPath, entry.name);
						const build = await this.analyzeProtonDirectory(
							protonPath,
							"steam",
						);

						if (build) {
							builds.push(build);
						}
					}
				}
			} catch (error) {
				console.warn(`Error scanning Steam path ${steamPath}:`, error);
			}
		}

		return builds;
	}

	/**
	 * Detects manually installed Proton builds
	 * Returns empty array on non-Linux systems
	 */
	async detectManualProtonBuilds(): Promise<DetectedProtonBuild[]> {
		if (!this.isLinux) {
			return [];
		}

		const builds: DetectedProtonBuild[] = [];

		for (const toolsPath of this.compatibilityToolsPaths) {
			try {
				console.log(`Scanning compatibility tools path: ${toolsPath}`);
				const exists = await this.pathExists(toolsPath);

				if (!exists) {
					console.log(`Path does not exist: ${toolsPath}`);
					continue;
				}

				const entries = await fs.readdir(toolsPath, { withFileTypes: true });
				console.log(
					`Found ${entries.length} entries in ${toolsPath}:`,
					entries.map((e) => e.name),
				);

				for (const entry of entries) {
					if (entry.isDirectory()) {
						const protonPath = path.join(toolsPath, entry.name);
						console.log(`Analyzing directory: ${entry.name} at ${protonPath}`);
						const build = await this.analyzeProtonDirectory(
							protonPath,
							"manual",
						);

						if (build) {
							console.log(`Found Proton build:`, {
								variant: build.variant,
								version: build.version,
								path: build.installPath,
							});
							builds.push(build);
						} else {
							console.log(`Not a valid Proton build: ${entry.name}`);
						}
					}
				}
			} catch (error) {
				console.warn(
					`Error scanning compatibility tools path ${toolsPath}:`,
					error,
				);
			}
		}

		return builds;
	}

	/**
	 * Analyzes a directory to determine if it's a Proton installation
	 */
	private async analyzeProtonDirectory(
		protonPath: string,
		installSource: InstallSource,
	): Promise<DetectedProtonBuild | null> {
		try {
			// Check for Proton executable or key files
			const protonExecutable = path.join(protonPath, "proton");
			const toolmanifest = path.join(protonPath, "toolmanifest.vdf");
			const compatmanifest = path.join(protonPath, "compatibilitytool.vdf");

			const hasProtonExe = await this.pathExists(protonExecutable);
			const hasToolManifest = await this.pathExists(toolmanifest);
			const hasCompatManifest = await this.pathExists(compatmanifest);

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
			const size = await this.getDirectorySize(protonPath);

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
	 * Gets the total size of a directory in bytes
	 */
	private async getDirectorySize(dirPath: string): Promise<number> {
		try {
			let totalSize = 0;
			const entries = await fs.readdir(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);

				if (entry.isDirectory()) {
					totalSize += await this.getDirectorySize(fullPath);
				} else {
					const stats = await fs.stat(fullPath);
					totalSize += stats.size;
				}
			}

			return totalSize;
		} catch {
			return 0;
		}
	}
}
