/**
 * Proton downloader-related type definitions
 */

/**
 * Version information interface
 */
export interface VersionInfo {
	version: string;
	type: string;
	date: string;
	download?: string;
	downsize?: number;
	disksize?: number;
	checksum?: string;
	installDir?: string;
	isLatestVersion?: boolean;
}

/**
 * Wine manager status interface
 */
export interface WineManagerStatus {
	status: "idle" | "downloading" | "unzipping";
	percentage?: number;
	eta?: number;
	avgSpeed?: number;
}

/**
 * Repository enumeration
 */
export enum Repositorys {
	WINEGE = "WINEGE",
	PROTONGE = "PROTONGE",
	PROTON = "PROTON",
	WINELUTRIS = "WINELUTRIS",
	WINECROSSOVER = "WINECROSSOVER",
	WINESTAGINGMACOS = "WINESTAGINGMACOS",
	GPTK = "GPTK",
}

/**
 * Fetch properties interface
 */
export interface FetchProps {
	url: string;
	type: string;
	count: number;
}

/**
 * Get versions properties interface
 */
export interface GetVersionsProps {
	repositorys?: Repositorys[];
	count?: number;
}

/**
 * Install properties interface
 */
export interface InstallProps {
	versionInfo: VersionInfo;
	installDir: string;
	overwrite?: boolean;
	onProgress?: (state: WineManagerStatus) => void;
	abortSignal?: AbortSignal;
}

/**
 * Unzip properties interface
 */
export interface UnzipProps {
	filePath: string;
	unzipDir: string;
	overwrite?: boolean;
	onProgress: (state: WineManagerStatus) => void;
	abortSignal?: AbortSignal | undefined;
}

/**
 * GitHub release interface
 */
export interface GitHubRelease {
	tag_name: string;
	published_at: string;
	assets: Array<{
		name: string;
		browser_download_url: string;
		size: number;
	}>;
}
