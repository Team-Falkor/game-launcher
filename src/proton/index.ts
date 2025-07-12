/**
 * Proton version management module
 *
 * This module provides functionality for:
 * - Fetching available Proton versions from various sources
 * - Managing Proton version information
 * - Caching version data to reduce API calls
 */

export { ProtonDetector } from "./ProtonDetector.js";
export { ProtonManager } from "./ProtonManager.js";
export { ProtonVersionFetcher } from "./ProtonVersionFetcher.js";
export type {
	DetectedProtonBuild,
	InstallSource,
	ProtonInstallOptions,
	ProtonInstallResult,
	ProtonRemoveOptions,
	ProtonRemoveResult,
	ProtonVariant,
	ProtonVersionInfo,
	ProtonVersions,
} from "./types.js";
