/**
 * Query History Tracker
 * Tracks all queries for analytics and debugging
 */

// In-memory storage (can be upgraded to database storage)
const history = [];
const MAX_HISTORY_SIZE = 1000;

/**
 * Add a query to history
 * @param {Object} entry - History entry
 */
function addToHistory(entry) {
    history.unshift({
        id: history.length + 1,
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
    });

    // Trim if exceeds max size
    if (history.length > MAX_HISTORY_SIZE) {
        history.pop();
    }
}

/**
 * Get query history
 * @param {Object} options - Filter options
 * @returns {Array} History entries
 */
function getHistory(options = {}) {
    let filtered = [...history];

    // Filter by success status
    if (typeof options.success === 'boolean') {
        filtered = filtered.filter(h => h.success === options.success);
    }

    // Filter by date range
    if (options.since) {
        const since = new Date(options.since);
        filtered = filtered.filter(h => new Date(h.timestamp) >= since);
    }

    if (options.until) {
        const until = new Date(options.until);
        filtered = filtered.filter(h => new Date(h.timestamp) <= until);
    }

    // Apply limit
    const limit = options.limit || 100;
    return filtered.slice(0, limit);
}

/**
 * Get history statistics
 * @returns {Object} Stats
 */
function getHistoryStats() {
    const total = history.length;
    const successful = history.filter(h => h.success).length;
    const failed = total - successful;

    const avgGenerationTime = history
        .filter(h => h.generationTimeMs)
        .reduce((sum, h) => sum + h.generationTimeMs, 0) / (successful || 1);

    const avgExecutionTime = history
        .filter(h => h.executionTimeMs)
        .reduce((sum, h) => sum + h.executionTimeMs, 0) / (successful || 1);

    return {
        total,
        successful,
        failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : '0%',
        avgGenerationTimeMs: Math.round(avgGenerationTime),
        avgExecutionTimeMs: Math.round(avgExecutionTime)
    };
}

/**
 * Clear history
 */
function clearHistory() {
    history.length = 0;
}

/**
 * Get a specific history entry by ID
 * @param {number} id - Entry ID
 * @returns {Object|undefined} History entry
 */
function getHistoryById(id) {
    return history.find(h => h.id === id);
}

module.exports = {
    addToHistory,
    getHistory,
    getHistoryStats,
    clearHistory,
    getHistoryById
};
