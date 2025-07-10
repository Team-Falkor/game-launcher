/**
 * Intelligent caching system for the Game Launcher
 * Provides flexible caching with TTL, LRU eviction, and type safety
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

/**
 * Intelligent cache manager with TTL, LRU eviction, and automatic cleanup
 */
export class CacheManager<T = unknown> {
	private cache = new Map<string, CacheEntry<T>>();
	private readonly options: Required<CacheOptions>;
	private cleanupTimer: NodeJS.Timeout | undefined;
	private stats = {
		hits: 0,
		misses: 0,
		expiredCleanups: 0,
		lruEvictions: 0,
	};

	constructor(options: CacheOptions = {}) {
		this.options = {
			ttl: 5 * 60 * 1000, // 5 minutes
			maxSize: 1000,
			autoCleanup: true,
			cleanupInterval: 60 * 1000, // 1 minute
			...options,
		};

		if (this.options.autoCleanup) {
			this.startAutoCleanup();
		}
	}

	/**
	 * Get a value from the cache
	 * @param key Cache key
	 * @returns Cached value or undefined if not found/expired
	 */
	get(key: string): T | undefined {
		const entry = this.cache.get(key);

		if (!entry) {
			this.stats.misses++;
			return undefined;
		}

		// Check if entry has expired
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this.stats.misses++;
			this.stats.expiredCleanups++;
			return undefined;
		}

		// Update access statistics
		entry.lastAccessed = Date.now();
		entry.accessCount++;
		this.stats.hits++;

		return entry.value;
	}

	/**
	 * Set a value in the cache
	 * @param key Cache key
	 * @param value Value to cache
	 * @param ttl Optional TTL override in milliseconds
	 */
	set(key: string, value: T, ttl?: number): void {
		const now = Date.now();
		const effectiveTtl = ttl ?? this.options.ttl;

		const entry: CacheEntry<T> = {
			value,
			createdAt: now,
			expiresAt: now + effectiveTtl,
			lastAccessed: now,
			accessCount: 0,
		};

		// Check if we need to evict entries
		if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
			this.evictLRU();
		}

		this.cache.set(key, entry);
	}

	/**
	 * Check if a key exists and is not expired
	 * @param key Cache key
	 * @returns True if key exists and is valid
	 */
	has(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) {
			return false;
		}

		// Check expiration
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this.stats.expiredCleanups++;
			return false;
		}

		return true;
	}

	/**
	 * Delete a specific key from the cache
	 * @param key Cache key to delete
	 * @returns True if the key existed and was deleted
	 */
	delete(key: string): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Clear all entries from the cache
	 */
	clear(): void {
		this.cache.clear();
		this.resetStats();
	}

	/**
	 * Get cache statistics
	 * @returns Current cache statistics
	 */
	getStats(): CacheStats {
		const totalRequests = this.stats.hits + this.stats.misses;
		return {
			size: this.cache.size,
			maxSize: this.options.maxSize,
			hits: this.stats.hits,
			misses: this.stats.misses,
			hitRatio: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
			expiredCleanups: this.stats.expiredCleanups,
			lruEvictions: this.stats.lruEvictions,
		};
	}

	/**
	 * Get all cache keys (non-expired only)
	 * @returns Array of valid cache keys
	 */
	keys(): string[] {
		const validKeys: string[] = [];
		const now = Date.now();

		for (const [key, entry] of this.cache.entries()) {
			if (now <= entry.expiresAt) {
				validKeys.push(key);
			} else {
				// Clean up expired entry
				this.cache.delete(key);
				this.stats.expiredCleanups++;
			}
		}

		return validKeys;
	}

	/**
	 * Get cache size (number of entries)
	 * @returns Current cache size
	 */
	size(): number {
		return this.cache.size;
	}

	/**
	 * Manually trigger cleanup of expired entries
	 * @returns Number of entries cleaned up
	 */
	cleanupExpired(): number {
		const now = Date.now();
		let cleanedCount = 0;

		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
				cleanedCount++;
			}
		}

		this.stats.expiredCleanups += cleanedCount;
		return cleanedCount;
	}

	/**
	 * Destroy the cache manager and cleanup resources
	 */
	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = undefined;
		}
		this.clear();
	}

	/**
	 * Evict the least recently used entry
	 */
	private evictLRU(): void {
		let oldestKey: string | undefined;
		let oldestTime = Number.MAX_SAFE_INTEGER;

		for (const [key, entry] of this.cache.entries()) {
			if (entry.lastAccessed < oldestTime) {
				oldestTime = entry.lastAccessed;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
			this.stats.lruEvictions++;
		}
	}

	/**
	 * Start automatic cleanup of expired entries
	 */
	private startAutoCleanup(): void {
		this.cleanupTimer = setInterval(() => {
			this.cleanupExpired();
		}, this.options.cleanupInterval);

		// Prevent the timer from keeping the process alive
		if (this.cleanupTimer.unref) {
			this.cleanupTimer.unref();
		}
	}

	/**
	 * Reset statistics
	 */
	private resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			expiredCleanups: 0,
			lruEvictions: 0,
		};
	}
}

/**
 * Default export for convenience
 */
export default CacheManager;
