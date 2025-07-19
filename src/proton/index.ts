/**
 * Proton version management module
 *
 * This module provides functionality for:
 * - Fetching available Proton versions from various sources
 * - Managing Proton version information
 * - Caching version data to reduce API calls
 */

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
} from "../@types/proton";
export * from "./config";
export * from "./core";
export type {
	DownloadProgressEvent,
	DownloadStatusEvent,
	ExtractionProgressEvent,
} from "./core/ProtonInstaller";
