/**
 * Optimized environment variable processing for the Game Launcher
 * Provides efficient environment merging and caching capabilities
 */

import type {
	EnvironmentProcessorOptions,
	ProcessedEnvironment,
} from "../@types/utils";

/**
 * Optimized environment variable processor with caching and validation
 */
export class EnvironmentProcessor {
	private static instance: EnvironmentProcessor | undefined;
	private baseEnvironmentCache: Record<string, string> | null = null;
	private baseEnvironmentCacheTime = 0;
	private mergedEnvironmentCache = new Map<
		string,
		{
			environment: Record<string, string>;
			timestamp: number;
		}
	>();
	private readonly options: Required<EnvironmentProcessorOptions>;

	constructor(options: EnvironmentProcessorOptions = {}) {
		this.options = {
			enableCaching: true,
			cacheTtl: 5 * 60 * 1000, // 5 minutes
			maxCacheSize: 100,
			...options,
		};
	}

	/**
	 * Get singleton instance with default options
	 */
	static getInstance(
		options?: EnvironmentProcessorOptions,
	): EnvironmentProcessor {
		if (!EnvironmentProcessor.instance) {
			EnvironmentProcessor.instance = new EnvironmentProcessor(options);
		}
		return EnvironmentProcessor.instance;
	}

	/**
	 * Process and merge environment variables efficiently
	 * @param base Base environment (defaults to process.env)
	 * @param override Override environment variables
	 * @returns Processed environment with metadata
	 */
	processEnvironment(
		base?: NodeJS.ProcessEnv,
		override?: Record<string, string>,
	): ProcessedEnvironment {
		const startTime = performance.now();

		// Use provided base or get cached/fresh process.env
		const baseEnv = base
			? this.sanitizeEnvironment(base)
			: this.getBaseEnvironment();

		// If no override, return base environment
		if (!override || Object.keys(override).length === 0) {
			return {
				environment: baseEnv,
				fromCache: base ? false : this.isBaseEnvironmentCached(),
				processingTime: performance.now() - startTime,
			};
		}

		// Check cache for merged environment
		const cacheKey = this.generateCacheKey(override);
		if (this.options.enableCaching) {
			const cached = this.getMergedFromCache(cacheKey);
			if (cached) {
				return {
					environment: cached,
					fromCache: true,
					processingTime: performance.now() - startTime,
				};
			}
		}

		// Merge environments efficiently
		const mergedEnvironment = this.mergeEnvironments(baseEnv, override);

		// Cache the result
		if (this.options.enableCaching) {
			this.cacheMergedEnvironment(cacheKey, mergedEnvironment);
		}

		return {
			environment: mergedEnvironment,
			fromCache: false,
			processingTime: performance.now() - startTime,
		};
	}

	/**
	 * Static convenience method for one-off processing
	 */
	static processEnvironment(
		base?: NodeJS.ProcessEnv,
		override?: Record<string, string>,
	): Record<string, string> {
		return EnvironmentProcessor.getInstance().processEnvironment(base, override)
			.environment;
	}

	/**
	 * Get base environment with caching
	 */
	private getBaseEnvironment(): Record<string, string> {
		if (this.options.enableCaching && this.isBaseEnvironmentCached()) {
			// We know this is not null due to the cache check
			return this.baseEnvironmentCache as Record<string, string>;
		}

		// Process base environment efficiently
		const cleanEnvironment = this.sanitizeEnvironment(process.env);

		// Cache the result
		if (this.options.enableCaching) {
			this.baseEnvironmentCache = cleanEnvironment;
			this.baseEnvironmentCacheTime = Date.now();
		}

		return cleanEnvironment;
	}

	/**
	 * Sanitize environment variables by removing undefined values
	 */
	private sanitizeEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
		const cleanEnvironment: Record<string, string> = {};
		for (const [key, value] of Object.entries(env)) {
			if (value !== undefined) {
				cleanEnvironment[key] = value;
			}
		}
		return cleanEnvironment;
	}

	/**
	 * Check if base environment cache is valid
	 */
	private isBaseEnvironmentCached(): boolean {
		return (
			this.baseEnvironmentCache !== null &&
			Date.now() - this.baseEnvironmentCacheTime < this.options.cacheTtl
		);
	}

	/**
	 * Merge environments efficiently using Object.assign for better performance
	 */
	private mergeEnvironments(
		base: Record<string, string>,
		override: Record<string, string>,
	): Record<string, string> {
		// Use Object.assign for optimal performance
		return Object.assign({}, base, override);
	}

	/**
	 * Generate cache key for merged environment
	 */
	private generateCacheKey(override: Record<string, string>): string {
		// Sort keys for consistent cache keys
		const sortedKeys = Object.keys(override).sort();
		return sortedKeys.map((key) => `${key}=${override[key]}`).join("|");
	}

	/**
	 * Get merged environment from cache
	 */
	private getMergedFromCache(cacheKey: string): Record<string, string> | null {
		const cached = this.mergedEnvironmentCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < this.options.cacheTtl) {
			return cached.environment;
		}
		return null;
	}

	/**
	 * Cache merged environment with size management
	 */
	private cacheMergedEnvironment(
		cacheKey: string,
		environment: Record<string, string>,
	): void {
		// Manage cache size
		if (this.mergedEnvironmentCache.size >= this.options.maxCacheSize) {
			// Remove oldest entry
			const oldestKey = this.mergedEnvironmentCache.keys().next().value;
			if (oldestKey) {
				this.mergedEnvironmentCache.delete(oldestKey);
			}
		}

		this.mergedEnvironmentCache.set(cacheKey, {
			environment,
			timestamp: Date.now(),
		});
	}

	/**
	 * Clear all caches
	 */
	clearCache(): void {
		this.baseEnvironmentCache = null;
		this.baseEnvironmentCacheTime = 0;
		this.mergedEnvironmentCache.clear();
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): {
		baseEnvironmentCached: boolean;
		mergedEnvironmentCacheSize: number;
		maxCacheSize: number;
		cacheTtl: number;
	} {
		return {
			baseEnvironmentCached: this.isBaseEnvironmentCached(),
			mergedEnvironmentCacheSize: this.mergedEnvironmentCache.size,
			maxCacheSize: this.options.maxCacheSize,
			cacheTtl: this.options.cacheTtl,
		};
	}

	/**
	 * Reset singleton instance (useful for testing)
	 */
	static resetInstance(): void {
		EnvironmentProcessor.instance = undefined;
	}
}

/**
 * Default export for convenience
 */
export default EnvironmentProcessor;
