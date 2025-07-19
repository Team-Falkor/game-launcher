/**
 * Constants for Proton version management
 */

/// Url to Wine GE github release page
export const WINEGE_URL =
	"https://api.github.com/repos/GloriousEggroll/wine-ge-custom/releases";

/// Url to Proton GE github release page
export const PROTONGE_URL =
	"https://api.github.com/repos/GloriousEggroll/proton-ge-custom/releases";

/// Url to Proton github release page
export const PROTON_URL =
	"https://api.github.com/repos/ValveSoftware/Proton/releases";

/// Url to Wine Lutris github release page
export const WINELUTRIS_URL =
	"https://api.github.com/repos/lutris/wine/releases";

/// Url to Wine Crossover github release page
export const WINECROSSOVER_URL =
	"https://api.github.com/repos/Gcenx/winecx/releases";

/// Url to Wine Staging for macOS github release page
export const WINESTAGINGMACOS_URL =
	"https://api.github.com/repos/Gcenx/macOS_Wine_builds/releases";

/// Url to Game Porting Toolkit from Gcenx github release page
export const GPTK_URL =
	"https://api.github.com/repos/Gcenx/game-porting-toolkit/releases";

/**
 * API URLs for different Proton variants
 */
export const PROTON_API_URLS = {
	/** Official Valve Proton releases */
	VALVE_PROTON: "https://api.github.com/repos/ValveSoftware/Proton/releases",

	/** GloriousEggroll's Proton-GE (Gaming Edition) releases */
	PROTON_GE:
		"https://api.github.com/repos/GloriousEggroll/proton-ge-custom/releases",

	/** GloriousEggroll's Wine-GE releases */
	WINE_GE:
		"https://api.github.com/repos/GloriousEggroll/wine-ge-custom/releases",
} as const;

// Proton configuration constants
export const PROTON_CONFIG = {
	// Default Proton installation paths
	INSTALL_PATHS: [
		"~/.steam/root/compatibilitytools.d",
		"~/.steam/steam/steamapps/common",
		"~/.local/share/lutris/runners/wine",
		"/usr/share/steam",
	],

	// File extensions
	ARCHIVE_EXTENSIONS: [".tar.gz", ".tar.xz", ".zip"],

	// Default timeout for downloads (in milliseconds)
	DOWNLOAD_TIMEOUT: 300000, // 5 minutes

	// Maximum concurrent downloads
	MAX_CONCURRENT_DOWNLOADS: 3,
} as const;

/**
 * Cache configuration constants
 */
export const CACHE_CONFIG = {
	/** Default cache timeout in milliseconds (5 minutes) */
	DEFAULT_TIMEOUT: 5 * 60 * 1000,

	/** Maximum number of cached versions per variant */
	MAX_CACHED_VERSIONS: 100,
} as const;

/**
 * Proton detection constants
 */
export const DETECTION_CONFIG = {
	/** Common Proton directory names to search for */
	PROTON_DIR_PATTERNS: [
		"Proton*",
		"proton*",
		"GE-Proton*",
		"Proton-GE*",
		"wine-ge*",
		"Wine-GE*",
	],

	/** Steam compatibility tools subdirectory */
	STEAM_COMPAT_TOOLS_DIR: "compatibilitytools.d",

	/** Default Steam installation paths on Linux */
	DEFAULT_STEAM_PATHS: [
		"~/.steam/steam",
		"~/.local/share/Steam",
		"/usr/share/steam",
	],
} as const;

/**
 * Supported Proton variants
 */
export const PROTON_VARIANTS = [
	"proton-ge",
	"proton-experimental",
	"proton-stable",
	"wine-ge",
] as const;

/**
 * Installation source types
 */
export const INSTALL_SOURCES = [
	"steam",
	"manual",
	"launcher",
	"system",
	"flatpak",
	"lutris",
] as const;
