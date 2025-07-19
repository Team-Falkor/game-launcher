import type {
	ExtendedProtonVersionInfo,
	ProtonVariant,
	ProtonVersionInfo,
	ProtonVersions,
} from "@/@types";
// Import types from @types folder
import type { GitHubRelease } from "../../@types/proton/version-fetcher";
import { PROTON_API_URLS } from "../config/constants";

/**
 * Fetches available Proton versions from various sources
 */
export class ProtonVersionFetcher {
	private readonly userAgent = "ProtonVersionFetcher/1.0";

	/**
	 * Checks if a version has beta indicators in version string, description, or release name
	 */
	private hasBetaIndicators(version: ExtendedProtonVersionInfo): boolean {
		const versionLower = version.version.toLowerCase();
		const descriptionLower = (version.description || "").toLowerCase();
		const releaseNameLower = (version.releaseName || "").toLowerCase();

		return (
			versionLower.includes("beta") ||
			versionLower.includes("rc") ||
			versionLower.includes("alpha") ||
			versionLower.includes("dev") ||
			descriptionLower.includes("(beta)") ||
			descriptionLower.includes("(rc)") ||
			descriptionLower.includes("(alpha)") ||
			descriptionLower.includes("beta") ||
			descriptionLower.includes(" rc ") ||
			descriptionLower.includes(" alpha ") ||
			releaseNameLower.includes("(beta)") ||
			releaseNameLower.includes("(rc)") ||
			releaseNameLower.includes("(alpha)") ||
			releaseNameLower.includes("beta") ||
			releaseNameLower.includes(" rc ") ||
			releaseNameLower.includes(" alpha ")
		);
	}

	/**
	 * Fetches all available Proton versions from various sources
	 */
	async fetchAllVersions(): Promise<ProtonVersions> {
		const [protonGE, wineGE, valveProton] = await Promise.allSettled([
			this.fetchProtonGEVersions(),
			this.fetchWineGEVersions(),
			this.fetchValveProtonVersions(),
		]);

		// Separate Valve Proton into stable and experimental
		const valveVersions =
			valveProton.status === "fulfilled" ? valveProton.value : [];

		// Sort by release date (newest first) to ensure proper ordering
		valveVersions.sort((a, b) => {
			const aTime = a.releaseDate?.getTime() ?? 0;
			const bTime = b.releaseDate?.getTime() ?? 0;
			return bTime - aTime;
		});

		const protonStable = valveVersions.filter(
			(v: ExtendedProtonVersionInfo) => {
				// A version is stable if:
				// 1. Not marked as prerelease by GitHub
				// 2. Doesn't contain beta, rc, alpha, or dev in version string, description, or release name
				return !v.isPrerelease && !this.hasBetaIndicators(v);
			},
		);

		const protonExperimental = valveVersions.filter(
			(v: ExtendedProtonVersionInfo) => {
				// A version is experimental if:
				// 1. Marked as prerelease by GitHub, OR
				// 2. Contains beta, rc, alpha, or dev in version string, description, or release name
				return v.isPrerelease || this.hasBetaIndicators(v);
			},
		);

		return {
			"proton-ge": protonGE.status === "fulfilled" ? protonGE.value : [],
			"proton-experimental": protonExperimental,
			"proton-stable": protonStable,
			"wine-ge": wineGE.status === "fulfilled" ? wineGE.value : [],
		};
	}

	/**
	 * Fetches Proton-GE versions from GitHub releases
	 */
	private async fetchProtonGEVersions(): Promise<ProtonVersionInfo[]> {
		try {
			const response = await fetch(PROTON_API_URLS.PROTON_GE, {
				headers: {
					"User-Agent": this.userAgent,
					Accept: "application/vnd.github.v3+json",
				},
			});

			if (!response.ok) {
				throw new Error(`GitHub API error: ${response.status}`);
			}

			const releases = (await response.json()) as GitHubRelease[];

			// Filter out draft releases
			const publishedReleases = releases.filter((release) => !release.draft);

			return publishedReleases.map((release) => {
				const asset = release.assets.find(
					(asset) =>
						asset.name.endsWith(".tar.gz") && asset.name.includes("GE"),
				);

				const versionInfo: ProtonVersionInfo = {
					version: release.tag_name,
					installed: false, // Will be updated by detection system
					releaseDate: new Date(release.published_at),
					description: release.body?.split("\n")[0] || release.name,
					isPrerelease: release.prerelease,
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
	 * Fetches official Valve Proton versions from GitHub releases
	 */
	private async fetchValveProtonVersions(): Promise<
		ExtendedProtonVersionInfo[]
	> {
		try {
			const response = await fetch(PROTON_API_URLS.VALVE_PROTON, {
				headers: {
					"User-Agent": this.userAgent,
					Accept: "application/vnd.github.v3+json",
				},
			});

			if (!response.ok) {
				throw new Error(`GitHub API error: ${response.status}`);
			}

			const releases = (await response.json()) as GitHubRelease[];

			// Filter out draft releases
			const publishedReleases = releases.filter((release) => !release.draft);

			return publishedReleases.map((release) => {
				// Valve Proton releases don't have binary assets, only source code
				// Look for binary assets first, fallback to tarball_url
				const asset = release.assets.find((asset) =>
					asset.name.endsWith(".tar.gz"),
				);

				const versionInfo: ProtonVersionInfo = {
					version: release.tag_name,
					installed: false,
					releaseDate: new Date(release.published_at),
					description: release.body?.split("\n")[0] || release.name,
					isPrerelease: release.prerelease,
				};

				// Store the release name for beta detection
				const extendedVersionInfo: ExtendedProtonVersionInfo = {
					...versionInfo,
					releaseName: release.name,
				};

				// Use binary asset if available, otherwise use source tarball
				if (asset?.browser_download_url) {
					extendedVersionInfo.downloadUrl = asset.browser_download_url;
					if (asset.size) {
						extendedVersionInfo.size = asset.size;
					}
				} else if (release.tarball_url) {
					// Use source tarball as fallback for Valve Proton
					extendedVersionInfo.downloadUrl = release.tarball_url;
				}

				return extendedVersionInfo;
			});
		} catch (error) {
			console.error("Failed to fetch Valve Proton versions:", error);
			return [];
		}
	}

	/**
	 * Fetches Wine-GE versions from GitHub releases
	 */
	private async fetchWineGEVersions(): Promise<ProtonVersionInfo[]> {
		try {
			const response = await fetch(PROTON_API_URLS.WINE_GE, {
				headers: {
					"User-Agent": this.userAgent,
					Accept: "application/vnd.github.v3+json",
				},
			});

			if (!response.ok) {
				throw new Error(`GitHub API error: ${response.status}`);
			}

			const releases = (await response.json()) as GitHubRelease[];

			// Filter out draft releases
			const publishedReleases = releases.filter((release) => !release.draft);

			return publishedReleases.map((release) => {
				const asset = release.assets.find(
					(asset) =>
						asset.name.endsWith(".tar.xz") && asset.name.includes("lutris"),
				);

				const versionInfo: ProtonVersionInfo = {
					version: release.tag_name,
					installed: false, // Will be updated by detection system
					releaseDate: new Date(release.published_at),
					description: release.body?.split("\n")[0] || release.name,
					isPrerelease: release.prerelease,
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
			console.error("Failed to fetch Wine-GE versions:", error);
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
			case "proton-experimental": {
				const valveVersions = await this.fetchValveProtonVersions();
				return valveVersions.filter(
					(v: ExtendedProtonVersionInfo) =>
						v.isPrerelease || this.hasBetaIndicators(v),
				);
			}
			case "proton-stable": {
				const valveVersions = await this.fetchValveProtonVersions();
				return valveVersions.filter(
					(v: ExtendedProtonVersionInfo) =>
						!v.isPrerelease && !this.hasBetaIndicators(v),
				);
			}
			case "wine-ge":
				return this.fetchWineGEVersions();
			default:
				throw new Error(`Unknown Proton variant: ${variant}`);
		}
	}
}
