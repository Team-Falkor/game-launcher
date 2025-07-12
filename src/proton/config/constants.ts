/**
 * Constants for Proton version management
 */

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