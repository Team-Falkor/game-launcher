/**
 * Types for Proton version management
 */

export interface ProtonVersionInfo {
	version: string;
	installed: boolean;
	installSource?:
		| "steam"
		| "manual"
		| "launcher"
		| "system"
		| "flatpak"
		| "lutris";
	installPath?: string;
	downloadUrl?: string;
	size?: number; // Size in bytes if known
	releaseDate?: Date;
	description?: string;
	isPrerelease?: boolean; // Whether this is a prerelease/experimental version
	releaseName?: string; // GitHub release name for beta detection
	isLatestVersion?: boolean; // Whether this is the latest version for its variant
}

// Re-export types from downloader (excluding GitHubRelease to avoid conflict)
export type {
	FetchProps,
	GetVersionsProps,
	InstallProps,
	UnzipProps,
	VersionInfo,
	WineManagerStatus,
} from "./downloader";
export { Repositorys } from "./downloader";

// Re-export types from installer
export * from "./installer";

// Re-export types from version-fetcher (GitHubRelease from here takes precedence)
export * from "./version-fetcher";

/**
 * Extended version info used internally for filtering and processing
 */
export interface ExtendedProtonVersionInfo extends ProtonVersionInfo {
	releaseName: string;
}

export interface ProtonVersions {
	"proton-ge": ProtonVersionInfo[];
	"proton-experimental": ProtonVersionInfo[];
	"proton-stable": ProtonVersionInfo[];
	"wine-ge": ProtonVersionInfo[];
	[key: string]: ProtonVersionInfo[]; // Allow for additional proton variants
}

export interface DetectedProtonBuild {
	version: string;
	variant: string;
	installPath: string;
	installSource:
		| "steam"
		| "manual"
		| "launcher"
		| "system"
		| "flatpak"
		| "lutris";
	installDate?: Date;
	size?: number; // Size in bytes
	isActive?: boolean; // Currently selected in Steam
}

export interface ProtonInstallOptions {
	version: string;
	variant:
		| "proton-ge"
		| "proton-experimental"
		| "proton-stable"
		| "wine-ge"
		| string;
	installPath?: string;
	force?: boolean; // Overwrite existing installation
}

export interface ProtonInstallResult {
	success: boolean;
	version: string;
	variant: string;
	installPath: string;
	error?: string;
}

export interface ProtonRemoveOptions {
	version: string;
	variant: string;
}

export interface ProtonRemoveResult {
	success: boolean;
	version: string;
	variant: string;
	error?: string;
}

export type ProtonVariant =
	| "proton-ge"
	| "proton-experimental"
	| "proton-stable"
	| "wine-ge";
export type InstallSource =
	| "steam"
	| "manual"
	| "launcher"
	| "system"
	| "flatpak"
	| "lutris";
