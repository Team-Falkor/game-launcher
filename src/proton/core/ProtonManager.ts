import os from "node:os";
import type {
	DetectedProtonBuild,
	ProtonInstallOptions,
	ProtonInstallResult,
	ProtonRemoveOptions,
	ProtonRemoveResult,
	ProtonVariant,
	ProtonVersionInfo,
	ProtonVersions,
} from "@/@types";
import { ProtonDetector } from "./ProtonDetector";
import { ProtonInstaller } from "./ProtonInstaller";
import { ProtonVersionFetcher } from "./ProtonVersionFetcher";

/**
 * Main class for managing Proton versions
 * Note: Proton is a Linux-only compatibility layer for running Windows games
 * Detection and installation features are only available on Linux systems
 */
export class ProtonManager {
	private versionFetcher: ProtonVersionFetcher;
	private protonDetector: ProtonDetector;
	private protonInstaller: ProtonInstaller;
	private cachedVersions: ProtonVersions | null = null;
	private cachedInstalledBuilds: DetectedProtonBuild[] | null = null;
	private cacheTimestamp: number = 0;
	private installedCacheTimestamp: number = 0;
	private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
	private readonly isLinux: boolean;

	constructor() {
		this.isLinux = os.platform() === "linux";
		this.versionFetcher = new ProtonVersionFetcher();
		this.protonDetector = new ProtonDetector();
		this.protonInstaller = new ProtonInstaller();
	}

	/**
	 * Lists all available Proton versions from various sources with installation status
	 * Results are cached for 5 minutes to avoid excessive API calls
	 */
	async listAvailableProtonVersions(): Promise<ProtonVersions> {
		const now = Date.now();

		// Return cached results if still valid
		if (this.cachedVersions && now - this.cacheTimestamp < this.cacheTimeout) {
			return this.cachedVersions;
		}

		console.log("Fetching available Proton versions...");
		const versions = await this.versionFetcher.fetchAllVersions();

		// Get installed builds and update installation status
		const installedBuilds = await this.getInstalledProtonBuilds();
		const versionsWithStatus = this.mergeInstallationStatus(
			versions,
			installedBuilds,
		);

		// Cache the results
		this.cachedVersions = versionsWithStatus;
		this.cacheTimestamp = now;

		return versionsWithStatus;
	}

	/**
	 * Gets available versions for a specific Proton variant
	 */
	async getVersionsForVariant(
		variant: ProtonVariant,
	): Promise<ProtonVersionInfo[]> {
		const allVersions = await this.listAvailableProtonVersions();
		return allVersions[variant] || [];
	}

	/**
	 * Gets the latest version for a specific variant
	 */
	async getLatestVersion(
		variant: ProtonVariant,
	): Promise<ProtonVersionInfo | null> {
		const versions = await this.getVersionsForVariant(variant);

		if (versions.length === 0) {
			return null;
		}

		// Sort by release date if available, otherwise return first
		const sortedVersions = versions.sort((a, b) => {
			if (a.releaseDate && b.releaseDate) {
				return b.releaseDate.getTime() - a.releaseDate.getTime();
			}
			return 0;
		});

		return sortedVersions[0] || null;
	}

	/**
	 * Searches for versions matching a query string
	 */
	async searchVersions(query: string): Promise<ProtonVersionInfo[]> {
		const allVersions = await this.listAvailableProtonVersions();
		const results: ProtonVersionInfo[] = [];

		const searchTerm = query.toLowerCase();

		for (const [variant, versions] of Object.entries(allVersions)) {
			const matchingVersions = versions.filter(
				(version) =>
					version.version.toLowerCase().includes(searchTerm) ||
					version.description?.toLowerCase().includes(searchTerm) ||
					variant.toLowerCase().includes(searchTerm),
			);
			results.push(...matchingVersions);
		}

		return results;
	}

	/**
	 * Gets summary statistics about available versions
	 */
	async getVersionStats(): Promise<{
		totalVersions: number;
		variantCounts: Record<string, number>;
		latestVersions: Record<string, string>;
	}> {
		const allVersions = await this.listAvailableProtonVersions();

		const variantCounts: Record<string, number> = {};
		const latestVersions: Record<string, string> = {};
		let totalVersions = 0;

		for (const [variant, versions] of Object.entries(allVersions)) {
			variantCounts[variant] = versions.length;
			totalVersions += versions.length;

			// Get latest version for this variant
			const latest = await this.getLatestVersion(variant as ProtonVariant);
			if (latest) {
				latestVersions[variant] = latest.version;
			}
		}

		return {
			totalVersions,
			variantCounts,
			latestVersions,
		};
	}

	/**
	 * Gets all installed Proton builds from the system
	 * Returns empty array on non-Linux systems since Proton is Linux-only
	 */
	async getInstalledProtonBuilds(): Promise<DetectedProtonBuild[]> {
		if (!this.isLinux) {
			return [];
		}

		const now = Date.now();

		// Return cached results if still valid
		if (
			this.cachedInstalledBuilds &&
			now - this.installedCacheTimestamp < this.cacheTimeout
		) {
			return this.cachedInstalledBuilds;
		}

		console.log("Detecting installed Proton builds...");
		const installedBuilds =
			await this.protonDetector.detectInstalledProtonBuilds();

		// Cache the results
		this.cachedInstalledBuilds = installedBuilds;
		this.installedCacheTimestamp = now;

		return installedBuilds;
	}

	/**
	 * Detects Steam-installed Proton builds
	 * Returns empty array on non-Linux systems
	 */
	async detectSteamProtonBuilds(): Promise<DetectedProtonBuild[]> {
		return this.protonDetector.detectSteamProtonBuilds();
	}

	/**
	 * Detects manually installed Proton builds
	 * Returns empty array on non-Linux systems
	 */
	async detectManualProtonBuilds(): Promise<DetectedProtonBuild[]> {
		return this.protonDetector.detectManualProtonBuilds();
	}

	/**
	 * Gets the currently active Proton version in Steam
	 * Returns null on non-Linux systems
	 */
	async getActiveSteamProtonBuild(): Promise<DetectedProtonBuild | null> {
		return this.protonDetector.getActiveSteamProtonBuild();
	}

	/**
	 * Checks if the current system supports Proton
	 * Proton is only available on Linux systems
	 */
	isProtonSupported(): boolean {
		return this.isLinux;
	}

	/**
	 * Gets platform-specific information about Proton support
	 */
	getPlatformInfo(): {
		platform: string;
		protonSupported: boolean;
		reason?: string;
	} {
		const platform = os.platform();

		if (this.isLinux) {
			return {
				platform,
				protonSupported: true,
			};
		}

		return {
			platform,
			protonSupported: false,
			reason:
				"Proton is a Linux-only compatibility layer for running Windows games. Windows and macOS can run Windows games natively.",
		};
	}

	/**
	 * Merges installation status from detected builds into available versions
	 */
	private mergeInstallationStatus(
		availableVersions: ProtonVersions,
		installedBuilds: DetectedProtonBuild[],
	): ProtonVersions {
		const result: ProtonVersions = {
			"proton-ge": [],
			"proton-experimental": [],
			"proton-stable": [],
			"wine-ge": [],
		};

		// Create a map of installed builds for quick lookup
		const installedMap = new Map<string, DetectedProtonBuild>();
		for (const build of installedBuilds) {
			const key = `${build.variant}-${build.version}`;
			installedMap.set(key, build);
		}

		// Update installation status for each variant
		for (const [variant, versions] of Object.entries(availableVersions)) {
			result[variant] = versions.map((version) => {
				const key = `${variant}-${version.version}`;
				const installedBuild = installedMap.get(key);

				if (installedBuild) {
					return {
						...version,
						installed: true,
						installSource: installedBuild.installSource,
						installPath: installedBuild.installPath,
					};
				}

				return {
					...version,
					installed: false,
				};
			});
		}

		return result;
	}

	/**
	 * Clears all caches, forcing a fresh fetch on next request
	 */
	clearCache(): void {
		this.cachedVersions = null;
		this.cachedInstalledBuilds = null;
		this.cacheTimestamp = 0;
		this.installedCacheTimestamp = 0;
	}

	/**
	 * Refreshes all caches
	 */
	async refreshVersions(): Promise<ProtonVersions> {
		this.clearCache();
		return this.listAvailableProtonVersions();
	}

	/**
	 * Installs a Proton version
	 * Returns error on non-Linux systems since Proton is Linux-only
	 */
	async installProtonVersion(
		options: ProtonInstallOptions,
	): Promise<ProtonInstallResult> {
		const result = await this.protonInstaller.installProtonVersion(options);

		// Clear caches to reflect the new installation
		if (result.success) {
			this.cachedInstalledBuilds = null;
			this.installedCacheTimestamp = 0;
			this.cachedVersions = null;
			this.cacheTimestamp = 0;
		}

		return result;
	}

	/**
	 * Removes a Proton version
	 * Returns error on non-Linux systems since Proton is Linux-only
	 */
	async removeProtonVersion(
		options: ProtonRemoveOptions,
	): Promise<ProtonRemoveResult> {
		const result = await this.protonInstaller.removeProtonVersion(options);

		// Clear caches to reflect the removal
		if (result.success) {
			this.cachedInstalledBuilds = null;
			this.installedCacheTimestamp = 0;
			this.cachedVersions = null;
			this.cacheTimestamp = 0;
		}

		return result;
	}

	/**
	 * Checks if Proton installation is supported on this system
	 */
	isInstallationSupported(): boolean {
		return this.protonInstaller.isInstallationSupported();
	}

	/**
	 * Gets the compatibility tools directory path
	 */
	getCompatibilityToolsDirectory(): string {
		return this.protonInstaller.getCompatibilityToolsDirectory();
	}

	/**
	 * Installs the latest version of a specific Proton variant
	 */
	async installLatestVersion(
		variant: ProtonVariant,
		force = false,
	): Promise<ProtonInstallResult> {
		const latest = await this.getLatestVersion(variant);

		if (!latest) {
			return {
				success: false,
				version: "unknown",
				variant,
				installPath: "",
				error: `No versions found for ${variant}`,
			};
		}

		return this.installProtonVersion({
			version: latest.version,
			variant,
			force,
		});
	}

	/**
	 * Gets installation status for a specific version
	 */
	async getInstallationStatus(
		variant: ProtonVariant,
		version: string,
	): Promise<{
		installed: boolean;
		installPath?: string;
		installSource?: string;
	}> {
		const installedBuilds = await this.getInstalledProtonBuilds();
		const build = installedBuilds.find(
			(b) => b.variant === variant && b.version === version,
		);

		if (build) {
			return {
				installed: true,
				installPath: build.installPath,
				installSource: build.installSource,
			};
		}

		return { installed: false };
	}

	/**
	 * Subscribe to installation events
	 * Returns the ProtonInstaller instance for event listening
	 */
	getInstaller() {
		return this.protonInstaller;
	}

	/**
	 * Convenience method to add event listeners for download progress
	 */
	onDownloadProgress(
		listener: (
			event: import("./ProtonInstaller").DownloadProgressEvent,
		) => void,
	): void {
		this.protonInstaller.on("download-progress", listener);
	}

	/**
	 * Convenience method to add event listeners for installation status changes
	 */
	onInstallStatus(
		listener: (event: import("./ProtonInstaller").DownloadStatusEvent) => void,
	): void {
		this.protonInstaller.on("download-status", listener);
	}

	/**
	 * Convenience method to add event listeners for build progress
	 */
	onBuildProgress(
		listener: (event: import("./ProtonInstaller").BuildProgressEvent) => void,
	): void {
		this.protonInstaller.on("build-progress", listener);
	}

	/**
	 * Convenience method to add event listeners for extraction progress
	 */
	onExtractionProgress(
		listener: (event: import("../../@types").ExtractionProgressEvent) => void,
	): void {
		this.protonInstaller.on("extraction-progress", listener);
	}

	/**
	 * Convenience method to add event listeners for installation completion
	 */
	onInstallComplete(
		listener: (event: {
			variant: ProtonVariant;
			version: string;
			installPath: string;
		}) => void,
	): void {
		this.protonInstaller.on("install-complete", listener);
	}

	/**
	 * Convenience method to add event listeners for installation errors
	 */
	onInstallError(
		listener: (event: {
			variant: ProtonVariant;
			version: string;
			error: string;
		}) => void,
	): void {
		this.protonInstaller.on("install-error", listener);
	}

	/**
	 * Remove all event listeners from the installer
	 */
	removeAllInstallListeners(): void {
		this.protonInstaller.removeAllListeners();
	}
}
