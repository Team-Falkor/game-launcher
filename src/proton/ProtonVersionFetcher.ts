import type { ProtonVariant, ProtonVersionInfo, ProtonVersions } from "./types";

/**
 * GitHub API response types
 */
interface GitHubAsset {
	name: string;
	browser_download_url: string;
	size: number;
}

interface GitHubRelease {
	tag_name: string;
	name: string;
	body: string;
	published_at: string;
	assets: GitHubAsset[];
}

/**
 * Fetches available Proton versions from various sources
 */
export class ProtonVersionFetcher {
	private readonly userAgent = "GameLauncher/1.0.0";

	/**
	 * Fetches all available Proton versions from various sources
	 */
	async fetchAvailableVersions(): Promise<ProtonVersions> {
		const [protonGE, protonExperimental, protonStable, protonTKG] =
			await Promise.allSettled([
				this.fetchProtonGEVersions(),
				this.fetchProtonExperimentalVersions(),
				this.fetchProtonStableVersions(),
				this.fetchProtonTKGVersions(),
			]);

		return {
			"proton-ge": protonGE.status === "fulfilled" ? protonGE.value : [],
			"proton-experimental":
				protonExperimental.status === "fulfilled"
					? protonExperimental.value
					: [],
			"proton-stable":
				protonStable.status === "fulfilled" ? protonStable.value : [],
			"proton-tkg": protonTKG.status === "fulfilled" ? protonTKG.value : [],
		};
	}

	/**
	 * Fetches Proton-GE versions from GitHub releases
	 */
	private async fetchProtonGEVersions(): Promise<ProtonVersionInfo[]> {
		try {
			const response = await fetch(
				"https://api.github.com/repos/GloriousEggroll/proton-ge-custom/releases",
				{
					headers: {
						"User-Agent": this.userAgent,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);

			if (!response.ok) {
				throw new Error(`GitHub API error: ${response.status}`);
			}

			const releases = (await response.json()) as GitHubRelease[];

			return releases.map((release) => {
				const asset = release.assets.find(
					(asset) =>
						asset.name.endsWith(".tar.gz") && asset.name.includes("GE"),
				);

				const versionInfo: ProtonVersionInfo = {
				version: release.tag_name,
				installed: false, // Will be updated by detection system
				releaseDate: new Date(release.published_at),
				description: release.body?.split("\n")[0] || release.name,
			};

				if (asset?.browser_download_url) {
					versionInfo.downloadUrl = asset.browser_download_url;
				}
				if (asset?.size) {
					versionInfo.size = asset.size;
				}

				return versionInfo;
			});
		} catch (error) {
			console.error("Failed to fetch Proton-GE versions:", error);
			return [];
		}
	}

	/**
	 * Fetches Proton Experimental versions
	 * Currently not implemented - no reliable source available
	 */
	private async fetchProtonExperimentalVersions(): Promise<
		ProtonVersionInfo[]
	> {
		// TODO: Implement when a reliable source for Proton Experimental versions is found
		return [];
	}

	/**
	 * Fetches Proton Stable versions
	 * Currently not implemented - no reliable source available
	 */
	private async fetchProtonStableVersions(): Promise<ProtonVersionInfo[]> {
		// TODO: Implement when a reliable source for Proton Stable versions is found
		return [];
	}

	/**
	 * Fetches Proton-TKG versions from GitHub releases
	 */
	private async fetchProtonTKGVersions(): Promise<ProtonVersionInfo[]> {
		try {
			const response = await fetch(
				"https://api.github.com/repos/Frogging-Family/wine-tkg-git/releases",
				{
					headers: {
						"User-Agent": this.userAgent,
						Accept: "application/vnd.github.v3+json",
					},
				},
			);

			if (!response.ok) {
				throw new Error(`GitHub API error: ${response.status}`);
			}

			const releases = (await response.json()) as GitHubRelease[];

			// Filter for Proton-TKG releases
			const protonReleases = releases.filter(
				(release) =>
					release.tag_name.toLowerCase().includes("proton") ||
					release.name.toLowerCase().includes("proton"),
			);

			return protonReleases.map((release) => {
				const asset = release.assets.find(
					(asset) =>
						asset.name.endsWith(".tar.gz") || asset.name.endsWith(".tar.xz"),
				);

				const versionInfo: ProtonVersionInfo = {
				version: release.tag_name,
				installed: false, // Will be updated by detection system
				releaseDate: new Date(release.published_at),
				description: release.body?.split("\n")[0] || release.name,
			};

				if (asset?.browser_download_url) {
					versionInfo.downloadUrl = asset.browser_download_url;
				}
				if (asset?.size) {
					versionInfo.size = asset.size;
				}

				return versionInfo;
			});
		} catch (error) {
			console.error("Failed to fetch Proton-TKG versions:", error);
			return [];
		}
	}

	/**
	 * Fetches versions for a specific Proton variant
	 */
	async fetchVersionsForVariant(
		variant: ProtonVariant,
	): Promise<ProtonVersionInfo[]> {
		switch (variant) {
			case "proton-ge":
				return this.fetchProtonGEVersions();
			case "proton-experimental":
				return this.fetchProtonExperimentalVersions();
			case "proton-stable":
				return this.fetchProtonStableVersions();
			case "proton-tkg":
				return this.fetchProtonTKGVersions();
			default:
				throw new Error(`Unknown Proton variant: ${variant}`);
		}
	}
}
