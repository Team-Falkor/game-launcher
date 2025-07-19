/**
 * Proton version fetcher-related type definitions
 */

/**
 * GitHub API response types
 */
export interface GitHubAsset {
	name: string;
	browser_download_url: string;
	size: number;
}

export interface GitHubRelease {
	tag_name: string;
	name: string;
	body: string;
	published_at: string;
	prerelease: boolean;
	draft: boolean;
	assets: GitHubAsset[];
	tarball_url?: string;
	zipball_url?: string;
}
