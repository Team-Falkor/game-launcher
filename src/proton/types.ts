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
}

export interface ProtonVersions {
	"proton-ge": ProtonVersionInfo[];
	"proton-experimental": ProtonVersionInfo[];
	"proton-stable": ProtonVersionInfo[];
	"proton-tkg": ProtonVersionInfo[];
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
		| "proton-tkg"
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
	| "proton-tkg";
export type InstallSource =
	| "steam"
	| "manual"
	| "launcher"
	| "system"
	| "flatpak"
	| "lutris";
