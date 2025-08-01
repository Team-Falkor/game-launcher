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
	DownloadProgressEvent,
	DownloadStatusEvent,
	ExtractionProgressEvent,
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
