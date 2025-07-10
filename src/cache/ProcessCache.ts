/**
 * Process-specific caching implementation for the Game Launcher
 * Provides specialized caching for process information, status, and metadata
 */

import type {
	GameStatus,
	ProcessCacheEntry,
	ProcessCacheOptions,
} from "../@types";
import { CacheManager } from "./CacheManager";

/**
 * Specialized cache manager for process-related data
 */
export class ProcessCache {
	private processInfoCache: CacheManager<ProcessCacheEntry>;
	private processStatusCache: CacheManager<GameStatus>;
	private processMetricsCache: CacheManager<ProcessCacheEntry["metrics"]>;
	private readonly options: Required<ProcessCacheOptions>;

	constructor(options: ProcessCacheOptions = {}) {
		this.options = {
			ttl: 5 * 60 * 1000, // 5 minutes for general cache
			maxSize: 500,
			autoCleanup: true,
			cleanupInterval: 60 * 1000,
			enableStatusCache: true,
			enableMetricsCache: true,
			statusCacheTtl: 30 * 1000, // 30 seconds
			metricsCacheTtl: 10 * 1000, // 10 seconds
			...options,
		};

		// Initialize specialized caches
		this.processInfoCache = new CacheManager<ProcessCacheEntry>({
			ttl: this.options.ttl,
			maxSize: this.options.maxSize,
			autoCleanup: this.options.autoCleanup,
			cleanupInterval: this.options.cleanupInterval,
		});

		this.processStatusCache = new CacheManager<GameStatus>({
			ttl: this.options.statusCacheTtl,
			maxSize: this.options.maxSize,
			autoCleanup: this.options.autoCleanup,
			cleanupInterval: this.options.cleanupInterval,
		});

		this.processMetricsCache = new CacheManager<ProcessCacheEntry["metrics"]>({
			ttl: this.options.metricsCacheTtl,
			maxSize: this.options.maxSize,
			autoCleanup: this.options.autoCleanup,
			cleanupInterval: this.options.cleanupInterval,
		});
	}

	/**
	 * Cache process information
	 * @param gameId Game identifier
	 * @param entry Process cache entry
	 * @param ttl Optional TTL override
	 */
	cacheProcessInfo(
		gameId: string,
		entry: ProcessCacheEntry,
		ttl?: number,
	): void {
		this.processInfoCache.set(gameId, entry, ttl);
	}

	/**
	 * Get cached process information
	 * @param gameId Game identifier
	 * @returns Cached process entry or undefined
	 */
	getProcessInfo(gameId: string): ProcessCacheEntry | undefined {
		return this.processInfoCache.get(gameId);
	}

	/**
	 * Cache process status
	 * @param gameId Game identifier
	 * @param status Process status
	 * @param ttl Optional TTL override
	 */
	cacheProcessStatus(gameId: string, status: GameStatus, ttl?: number): void {
		if (!this.options.enableStatusCache) return;

		this.processStatusCache.set(
			gameId,
			status,
			ttl ?? this.options.statusCacheTtl,
		);
	}

	/**
	 * Get cached process status
	 * @param gameId Game identifier
	 * @returns Cached status or undefined
	 */
	getProcessStatus(gameId: string): GameStatus | undefined {
		if (!this.options.enableStatusCache) return undefined;

		return this.processStatusCache.get(gameId);
	}

	/**
	 * Cache process metrics
	 * @param gameId Game identifier
	 * @param metrics Process metrics
	 * @param ttl Optional TTL override
	 */
	cacheProcessMetrics(
		gameId: string,
		metrics: ProcessCacheEntry["metrics"],
		ttl?: number,
	): void {
		if (!this.options.enableMetricsCache) return;

		this.processMetricsCache.set(
			gameId,
			metrics,
			ttl ?? this.options.metricsCacheTtl,
		);
	}

	/**
	 * Get cached process metrics
	 * @param gameId Game identifier
	 * @returns Cached metrics or undefined
	 */
	getProcessMetrics(gameId: string): ProcessCacheEntry["metrics"] | undefined {
		if (!this.options.enableMetricsCache) return undefined;

		return this.processMetricsCache.get(gameId);
	}

	/**
	 * Update cached process status if it exists
	 * @param gameId Game identifier
	 * @param status New status
	 */
	updateProcessStatus(gameId: string, status: GameStatus): void {
		if (!this.options.enableStatusCache) return;

		// Only update if entry exists
		if (this.processStatusCache.has(gameId)) {
			this.processStatusCache.set(gameId, status, this.options.statusCacheTtl);
		}

		// Also update in process info cache if it exists
		const processInfo = this.processInfoCache.get(gameId);
		if (processInfo) {
			processInfo.status = status;
			this.processInfoCache.set(gameId, processInfo);
		}
	}

	/**
	 * Check if process information is cached
	 * @param gameId Game identifier
	 * @returns True if cached and valid
	 */
	hasProcessInfo(gameId: string): boolean {
		return this.processInfoCache.has(gameId);
	}

	/**
	 * Check if process status is cached
	 * @param gameId Game identifier
	 * @returns True if cached and valid
	 */
	hasProcessStatus(gameId: string): boolean {
		return (
			this.options.enableStatusCache && this.processStatusCache.has(gameId)
		);
	}

	/**
	 * Check if process metrics are cached
	 * @param gameId Game identifier
	 * @returns True if cached and valid
	 */
	hasProcessMetrics(gameId: string): boolean {
		return (
			this.options.enableMetricsCache && this.processMetricsCache.has(gameId)
		);
	}

	/**
	 * Remove all cached data for a specific process
	 * @param gameId Game identifier
	 */
	removeProcess(gameId: string): void {
		this.processInfoCache.delete(gameId);
		this.processStatusCache.delete(gameId);
		this.processMetricsCache.delete(gameId);
	}

	/**
	 * Get all cached process IDs
	 * @returns Array of game IDs with cached data
	 */
	getCachedProcessIds(): string[] {
		// Get unique IDs from all caches
		const allIds = new Set<string>();

		this.processInfoCache.keys().forEach((id) => allIds.add(id));
		this.processStatusCache.keys().forEach((id) => allIds.add(id));
		this.processMetricsCache.keys().forEach((id) => allIds.add(id));

		return Array.from(allIds);
	}

	/**
	 * Get comprehensive cache statistics
	 * @returns Combined cache statistics
	 */
	getCacheStats() {
		return {
			processInfo: this.processInfoCache.getStats(),
			processStatus: this.processStatusCache.getStats(),
			processMetrics: this.processMetricsCache.getStats(),
			totalEntries:
				this.processInfoCache.size() +
				this.processStatusCache.size() +
				this.processMetricsCache.size(),
			cachedProcesses: this.getCachedProcessIds().length,
		};
	}

	/**
	 * Clear all process caches
	 */
	clearAll(): void {
		this.processInfoCache.clear();
		this.processStatusCache.clear();
		this.processMetricsCache.clear();
	}

	/**
	 * Manually trigger cleanup of expired entries in all caches
	 * @returns Total number of entries cleaned up
	 */
	cleanupExpired(): number {
		return (
			this.processInfoCache.cleanupExpired() +
			this.processStatusCache.cleanupExpired() +
			this.processMetricsCache.cleanupExpired()
		);
	}

	/**
	 * Destroy all caches and cleanup resources
	 */
	destroy(): void {
		this.processInfoCache.destroy();
		this.processStatusCache.destroy();
		this.processMetricsCache.destroy();
	}

	/**
	 * Batch cache multiple process entries
	 * @param entries Map of gameId to ProcessCacheEntry
	 */
	batchCacheProcessInfo(entries: Map<string, ProcessCacheEntry>): void {
		for (const [gameId, entry] of entries) {
			this.cacheProcessInfo(gameId, entry);
		}
	}

	/**
	 * Batch update process statuses
	 * @param statuses Map of gameId to GameStatus
	 */
	batchUpdateStatuses(statuses: Map<string, GameStatus>): void {
		for (const [gameId, status] of statuses) {
			this.updateProcessStatus(gameId, status);
		}
	}

	/**
	 * Get cache configuration
	 * @returns Current cache options
	 */
	getCacheConfig(): Required<ProcessCacheOptions> {
		return { ...this.options };
	}
}

/**
 * Default export for convenience
 */
export default ProcessCache;
