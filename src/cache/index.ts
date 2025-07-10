/**
 * Cache module exports for the Game Launcher
 * Provides intelligent caching capabilities with TTL, LRU eviction, and specialized process caching
 */

import { CacheManager } from "./CacheManager";
import { ProcessCache } from "./ProcessCache";

// Re-export default exports for convenience
export {
	type CacheEntry,
	CacheManager,
	type CacheOptions,
	type CacheStats,
	default as DefaultCacheManager,
} from "./CacheManager";
export {
	default as DefaultProcessCache,
	ProcessCache,
	type ProcessCacheEntry,
	type ProcessCacheOptions,
} from "./ProcessCache";

/**
 * Cache factory for creating pre-configured cache instances
 */
export namespace CacheFactory {
	/**
	 * Create a general-purpose cache manager
	 * @param options Cache configuration options
	 * @returns Configured CacheManager instance
	 */
	export function createCacheManager<T = unknown>(
		options?: import("./CacheManager").CacheOptions,
	): import("./CacheManager").CacheManager<T> {
		return new CacheManager<T>(options);
	}

	/**
	 * Create a process-specific cache
	 * @param options Process cache configuration options
	 * @returns Configured ProcessCache instance
	 */
	export function createProcessCache(
		options?: import("./ProcessCache").ProcessCacheOptions,
	): import("./ProcessCache").ProcessCache {
		return new ProcessCache(options);
	}

	/**
	 * Create a high-performance cache for frequent access
	 * @param maxSize Maximum cache size (default: 2000)
	 * @returns High-performance CacheManager instance
	 */
	export function createHighPerformanceCache<T = unknown>(
		maxSize = 2000,
	): import("./CacheManager").CacheManager<T> {
		return new CacheManager<T>({
			ttl: 10 * 60 * 1000, // 10 minutes
			maxSize,
			autoCleanup: true,
			cleanupInterval: 30 * 1000, // 30 seconds
		});
	}

	/**
	 * Create a short-lived cache for temporary data
	 * @param ttl Time to live in milliseconds (default: 30 seconds)
	 * @returns Short-lived CacheManager instance
	 */
	export function createShortLivedCache<T = unknown>(
		ttl = 30 * 1000,
	): import("./CacheManager").CacheManager<T> {
		return new CacheManager<T>({
			ttl,
			maxSize: 500,
			autoCleanup: true,
			cleanupInterval: 10 * 1000, // 10 seconds
		});
	}

	/**
	 * Create a memory-efficient cache with aggressive cleanup
	 * @param maxSize Maximum cache size (default: 100)
	 * @returns Memory-efficient CacheManager instance
	 */
	export function createMemoryEfficientCache<T = unknown>(
		maxSize = 100,
	): import("./CacheManager").CacheManager<T> {
		return new CacheManager<T>({
			ttl: 2 * 60 * 1000, // 2 minutes
			maxSize,
			autoCleanup: true,
			cleanupInterval: 15 * 1000, // 15 seconds
		});
	}

	/**
	 * Create a process cache optimized for real-time monitoring
	 * @returns Real-time optimized ProcessCache instance
	 */
	export function createRealTimeProcessCache(): import("./ProcessCache").ProcessCache {
		return new ProcessCache({
			ttl: 2 * 60 * 1000, // 2 minutes for general data
			statusCacheTtl: 5 * 1000, // 5 seconds for status
			metricsCacheTtl: 3 * 1000, // 3 seconds for metrics
			maxSize: 200,
			autoCleanup: true,
			cleanupInterval: 10 * 1000, // 10 seconds
			enableStatusCache: true,
			enableMetricsCache: true,
		});
	}
}

/**
 * Interface for cache instances with destroy method
 */
interface DestroyableCache {
	destroy(): void;
}

/**
 * Interface for cache instances with stats methods
 */
interface StatsCache {
	getStats?(): unknown;
	getCacheStats?(): unknown;
}

/**
 * Global cache instances for common use cases
 */
export namespace GlobalCaches {
	const instances = new Map<string, unknown>();

	/**
	 * Get or create a global cache instance
	 * @param name Cache instance name
	 * @param factory Factory function to create the cache
	 * @returns Cache instance
	 */
	export function getInstance<T>(name: string, factory: () => T): T {
		if (!instances.has(name)) {
			instances.set(name, factory());
		}
		return instances.get(name) as T;
	}

	/**
	 * Get the global process cache instance
	 * @returns Global ProcessCache instance
	 */
	export function getProcessCache(): import("./ProcessCache").ProcessCache {
		return getInstance("processCache", () => CacheFactory.createProcessCache());
	}

	/**
	 * Get the global general cache instance
	 * @returns Global CacheManager instance
	 */
	export function getGeneralCache<
		T = unknown,
	>(): import("./CacheManager").CacheManager<T> {
		return getInstance("generalCache", () =>
			CacheFactory.createCacheManager<T>(),
		);
	}

	/**
	 * Get the global high-performance cache instance
	 * @returns Global high-performance CacheManager instance
	 */
	export function getHighPerformanceCache<
		T = unknown,
	>(): import("./CacheManager").CacheManager<T> {
		return getInstance("highPerformanceCache", () =>
			CacheFactory.createHighPerformanceCache<T>(),
		);
	}

	/**
	 * Clear a specific global cache instance
	 * @param name Cache instance name
	 */
	export function clearInstance(name: string): void {
		const instance = instances.get(name) as DestroyableCache | undefined;
		if (instance && typeof instance.destroy === "function") {
			instance.destroy();
		}
		instances.delete(name);
	}

	/**
	 * Clear all global cache instances
	 */
	export function clearAllInstances(): void {
		for (const [name] of instances) {
			clearInstance(name);
		}
	}

	/**
	 * Get statistics for all global cache instances
	 * @returns Map of cache names to their statistics
	 */
	export function getAllStats(): Map<string, unknown> {
		const stats = new Map<string, unknown>();

		for (const [name, instance] of instances) {
			const statsInstance = instance as StatsCache;
			if (statsInstance && typeof statsInstance.getStats === "function") {
				stats.set(name, statsInstance.getStats());
			} else if (
				statsInstance &&
				typeof statsInstance.getCacheStats === "function"
			) {
				stats.set(name, statsInstance.getCacheStats());
			}
		}

		return stats;
	}
}
