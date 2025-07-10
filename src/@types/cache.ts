/**
 * Cache-related type definitions for the Game Launcher
 */

export interface CacheOptions {
	/** Time to live in milliseconds (default: 5 minutes) */
	ttl?: number;
	/** Maximum cache size (default: 1000) */
	maxSize?: number;
	/** Enable automatic cleanup of expired entries (default: true) */
	autoCleanup?: boolean;
	/** Cleanup interval in milliseconds (default: 1 minute) */
	cleanupInterval?: number;
}

export interface CacheEntry<T> {
	/** The cached value */
	value: T;
	/** Timestamp when the entry was created */
	createdAt: number;
	/** Timestamp when the entry expires */
	expiresAt: number;
	/** Last access timestamp for LRU eviction */
	lastAccessed: number;
	/** Access count for statistics */
	accessCount: number;
}

export interface CacheStats {
	/** Current number of entries */
	size: number;
	/** Maximum cache size */
	maxSize: number;
	/** Total cache hits */
	hits: number;
	/** Total cache misses */
	misses: number;
	/** Hit ratio (0-1) */
	hitRatio: number;
	/** Number of expired entries cleaned up */
	expiredCleanups: number;
	/** Number of LRU evictions */
	lruEvictions: number;
}

export interface ProcessCacheEntry {
	/** Process information */
	info: import("./process").GameProcessInfo;
	/** Last known status */
	status: import("./events").GameStatus;
	/** Process metadata */
	metadata?: Record<string, unknown>;
	/** Performance metrics */
	metrics?: {
		/** Launch time in milliseconds */
		launchTime?: number;
		/** Memory usage in bytes */
		memoryUsage?: number;
		/** CPU usage percentage */
		cpuUsage?: number;
	};
}

export interface ProcessCacheOptions extends CacheOptions {
	/** Enable process status caching (default: true) */
	enableStatusCache?: boolean;
	/** Enable process metrics caching (default: true) */
	enableMetricsCache?: boolean;
	/** Status cache TTL in milliseconds (default: 30 seconds) */
	statusCacheTtl?: number;
	/** Metrics cache TTL in milliseconds (default: 10 seconds) */
	metricsCacheTtl?: number;
}

/**
 * Interface for caches that can be destroyed/cleaned up
 */
export interface DestroyableCache {
	destroy(): void;
}

/**
 * Interface for caches that provide statistics
 */
export interface StatsCache {
	getStats?(): CacheStats;
	getCacheStats?(): CacheStats;
}
