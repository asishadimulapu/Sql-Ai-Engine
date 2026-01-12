/**
 * LRU Schema Cache
 * Caches database schemas to avoid repeated introspection
 */

const { LRUCache } = require('lru-cache');

// Initialize cache with configuration from environment
const cache = new LRUCache({
    max: parseInt(process.env.SCHEMA_CACHE_MAX_SIZE) || 50,
    ttl: parseInt(process.env.SCHEMA_CACHE_TTL_MS) || 300000, // 5 minutes default
    updateAgeOnGet: true,
    updateAgeOnHas: true
});

/**
 * Get schema from cache
 * @param {string} key - Cache key (usually dbType:database)
 * @returns {Object|undefined} Cached schema or undefined
 */
function getSchemaFromCache(key) {
    return cache.get(key);
}

/**
 * Set schema in cache
 * @param {string} key - Cache key
 * @param {Object} schema - Schema object
 * @param {Object} options - Cache options
 */
function setSchemaInCache(key, schema, options = {}) {
    cache.set(key, schema, {
        ttl: options.ttl
    });
}

/**
 * Clear specific key from cache
 * @param {string} key - Cache key to clear
 */
function clearCacheKey(key) {
    cache.delete(key);
}

/**
 * Clear all cached schemas
 */
function clearAllCache() {
    cache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
function getCacheStats() {
    return {
        size: cache.size,
        maxSize: cache.max,
        keys: [...cache.keys()]
    };
}

/**
 * Check if key exists in cache
 * @param {string} key - Cache key
 * @returns {boolean} Whether key exists
 */
function hasInCache(key) {
    return cache.has(key);
}

module.exports = {
    getSchemaFromCache,
    setSchemaInCache,
    clearCacheKey,
    clearAllCache,
    getCacheStats,
    hasInCache
};
