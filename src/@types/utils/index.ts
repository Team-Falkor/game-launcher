/**
 * Utility-related type definitions for the Game Launcher
 */

/**
 * Platform type definition
 */
export type Platform = "win32" | "darwin" | "linux" | "other";

/**
 * Environment processor options
 */
export interface EnvironmentProcessorOptions {
	/** Enable caching of base environment (default: true) */
	enableCaching?: boolean;
	/** Cache TTL in milliseconds (default: 5 minutes) */
	cacheTtl?: number;
	/** Maximum cache size (default: 100) */
	maxCacheSize?: number;
}

/**
 * Processed environment result
 */
export interface ProcessedEnvironment {
	/** The final merged environment */
	environment: Record<string, string>;
	/** Whether the result was served from cache */
	fromCache: boolean;
	/** Processing time in milliseconds */
	processingTime: number;
}