/**
 * Query History Tracker
 * Stores history in PostgreSQL for persistence
 */

let db = null;
let historyTableCreated = false;

/**
 * Initialize history with database connection
 * @param {Object} database - Database connection
 */
async function initHistory(database) {
    db = database;

    if (!historyTableCreated && db) {
        try {
            await db.asyncAll(`
                CREATE TABLE IF NOT EXISTS query_history (
                    id SERIAL PRIMARY KEY,
                    question TEXT,
                    sql TEXT,
                    success BOOLEAN DEFAULT true,
                    row_count INTEGER DEFAULT 0,
                    generation_time_ms INTEGER,
                    execution_time_ms INTEGER,
                    error TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            historyTableCreated = true;
            console.log('✅ Query history table ready');
        } catch (error) {
            console.log('⚠️ Could not create history table:', error.message);
        }
    }
}

/**
 * Add a query to history
 * @param {Object} entry - History entry
 */
async function addToHistory(entry) {
    if (!db || !historyTableCreated) {
        return; // Silently skip if no DB
    }

    try {
        await db.asyncAll(`
            INSERT INTO query_history (question, sql, success, row_count, generation_time_ms, execution_time_ms, error)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            entry.question || '',
            entry.sql || '',
            entry.success !== false,
            entry.rowCount || 0,
            entry.generationTimeMs || 0,
            entry.executionTimeMs || 0,
            entry.error || null
        ]);
    } catch (error) {
        console.log('⚠️ Could not save to history:', error.message);
    }
}

/**
 * Get query history
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} History entries
 */
async function getHistory(options = {}) {
    if (!db || !historyTableCreated) {
        return [];
    }

    try {
        const limit = options.limit || 100;
        let query = `
            SELECT id, question, sql, success, row_count as "rowCount", 
                   generation_time_ms as "generationTimeMs", 
                   execution_time_ms as "executionTimeMs",
                   error, timestamp
            FROM query_history
        `;

        const conditions = [];
        const params = [];

        if (typeof options.success === 'boolean') {
            params.push(options.success);
            conditions.push(`success = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY timestamp DESC LIMIT ${limit}`;

        return await db.asyncAll(query, params);
    } catch (error) {
        console.log('⚠️ Could not fetch history:', error.message);
        return [];
    }
}

/**
 * Get history statistics
 * @returns {Promise<Object>} Stats
 */
async function getHistoryStats() {
    if (!db || !historyTableCreated) {
        return { total: 0, successful: 0, failed: 0, successRate: '0%' };
    }

    try {
        const result = await db.asyncGet(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
                AVG(generation_time_ms) as avg_gen,
                AVG(execution_time_ms) as avg_exec
            FROM query_history
        `);

        const total = parseInt(result.total) || 0;
        const successful = parseInt(result.successful) || 0;

        return {
            total,
            successful,
            failed: parseInt(result.failed) || 0,
            successRate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : '0%',
            avgGenerationTimeMs: Math.round(result.avg_gen || 0),
            avgExecutionTimeMs: Math.round(result.avg_exec || 0)
        };
    } catch (error) {
        return { total: 0, successful: 0, failed: 0, successRate: '0%' };
    }
}

/**
 * Clear history
 */
async function clearHistory() {
    if (!db || !historyTableCreated) return;

    try {
        await db.asyncAll('DELETE FROM query_history');
    } catch (error) {
        console.log('⚠️ Could not clear history:', error.message);
    }
}

/**
 * Get a specific history entry by ID
 * @param {number} id - Entry ID
 * @returns {Promise<Object|undefined>} History entry
 */
async function getHistoryById(id) {
    if (!db || !historyTableCreated) return undefined;

    try {
        return await db.asyncGet('SELECT * FROM query_history WHERE id = $1', [id]);
    } catch (error) {
        return undefined;
    }
}

module.exports = {
    initHistory,
    addToHistory,
    getHistory,
    getHistoryStats,
    clearHistory,
    getHistoryById
};
