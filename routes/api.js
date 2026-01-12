/**
 * API Routes
 * All REST API endpoints for the SQL AI Engine
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { queryFromQuestion, generateSQL, executeSQL, getExplainPlan } = require('../services/sqlService');
const { getSchema, formatSchemaForPrompt } = require('../schema/introspect');
const { formatSchemaDetailed, formatSchemaAsJSON } = require('../prompts/schemaFormatter');
const { getHistory, getHistoryStats, clearHistory } = require('../utils/queryHistory');
const { getCacheStats, clearAllCache, clearCacheKey } = require('../utils/cache');
const { validateQueryRequest, validateSQLRequest } = require('../middleware/validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAIRateLimiter } = require('../middleware/rateLimit');
const { generateToken } = require('../middleware/auth');

// Apply stricter rate limiting to AI endpoints
const aiRateLimiter = createAIRateLimiter();

/**
 * @route   POST /api/query
 * @desc    Generate and execute SQL from natural language
 * @access  Public (or Protected if AUTH_ENABLED)
 */
router.post('/query', aiRateLimiter, validateQueryRequest, asyncHandler(async (req, res) => {
    const { question, explain } = req.body;
    const requestId = uuidv4();

    // Get database from app context
    const db = req.app.get('db');
    const dbType = req.app.get('dbType');

    const result = await queryFromQuestion(question, db, {
        requestId,
        dbType,
        explain: explain === true
    });

    res.json(result);
}));

/**
 * @route   POST /api/generate
 * @desc    Generate SQL without executing
 * @access  Public
 */
router.post('/generate', aiRateLimiter, validateQueryRequest, asyncHandler(async (req, res) => {
    const { question } = req.body;

    const db = req.app.get('db');
    const dbType = req.app.get('dbType');

    const result = await generateSQL(question, db, { dbType });

    res.json({
        success: true,
        question,
        sql: result.sql,
        generationTimeMs: result.generationTimeMs
    });
}));

/**
 * @route   POST /api/execute
 * @desc    Execute provided SQL
 * @access  Public
 */
router.post('/execute', validateSQLRequest, asyncHandler(async (req, res) => {
    const { sql } = req.body;

    const db = req.app.get('db');

    const result = await executeSQL(sql, db);

    res.json({
        success: true,
        sql,
        results: result.results,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs
    });
}));

/**
 * @route   POST /api/explain
 * @desc    Get query explain plan
 * @access  Public
 */
router.post('/explain', validateSQLRequest, asyncHandler(async (req, res) => {
    const { sql } = req.body;

    const db = req.app.get('db');
    const dbType = req.app.get('dbType');

    const plan = await getExplainPlan(sql, db, dbType);

    res.json({
        success: true,
        sql,
        explainPlan: plan
    });
}));

/**
 * @route   GET /api/schema
 * @desc    Get database schema
 * @access  Public
 */
router.get('/schema', asyncHandler(async (req, res) => {
    const db = req.app.get('db');
    const dbType = req.app.get('dbType');
    const format = req.query.format || 'json'; // json, text, detailed

    const schema = await getSchema(db, dbType, {
        database: process.env.MYSQL_DATABASE || process.env.PG_DATABASE,
        schema: 'public'
    });

    let formattedSchema;
    switch (format) {
        case 'text':
            formattedSchema = formatSchemaForPrompt(schema);
            res.type('text/plain').send(formattedSchema);
            return;
        case 'detailed':
            formattedSchema = formatSchemaDetailed(schema);
            res.type('text/plain').send(formattedSchema);
            return;
        default:
            formattedSchema = formatSchemaAsJSON(schema);
    }

    res.json({
        success: true,
        schema: formattedSchema,
        tableCount: Object.keys(schema).length
    });
}));

/**
 * @route   GET /api/history
 * @desc    Get query history
 * @access  Public
 */
router.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const success = req.query.success !== undefined ? req.query.success === 'true' : undefined;

    const history = getHistory({ limit, success });
    const stats = getHistoryStats();

    res.json({
        success: true,
        history,
        stats
    });
});

/**
 * @route   DELETE /api/history
 * @desc    Clear query history
 * @access  Public
 */
router.delete('/history', (req, res) => {
    clearHistory();
    res.json({
        success: true,
        message: 'History cleared'
    });
});

/**
 * @route   GET /api/cache
 * @desc    Get cache statistics
 * @access  Public
 */
router.get('/cache', (req, res) => {
    const stats = getCacheStats();
    res.json({
        success: true,
        cache: stats
    });
});

/**
 * @route   POST /api/cache/clear
 * @desc    Clear schema cache
 * @access  Public
 */
router.post('/cache/clear', (req, res) => {
    const { key } = req.body;

    if (key) {
        clearCacheKey(key);
        res.json({
            success: true,
            message: `Cache key '${key}' cleared`
        });
    } else {
        clearAllCache();
        res.json({
            success: true,
            message: 'All cache cleared'
        });
    }
});

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', asyncHandler(async (req, res) => {
    const db = req.app.get('db');
    const dbType = req.app.get('dbType');

    let dbHealth = { healthy: false, type: dbType };

    try {
        if (db && db.healthCheck) {
            dbHealth = await db.healthCheck();
        }
    } catch (error) {
        dbHealth.error = error.message;
    }

    const health = {
        success: true,
        status: dbHealth.healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: dbHealth,
        uptime: process.uptime()
    };

    res.status(dbHealth.healthy ? 200 : 503).json(health);
}));

/**
 * @route   POST /api/auth/token
 * @desc    Generate API token (for demo purposes)
 * @access  Public
 */
router.post('/auth/token', (req, res) => {
    const { userId, role } = req.body;

    const token = generateToken({
        id: userId || 'demo-user',
        role: role || 'user'
    });

    res.json({
        success: true,
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
});

/**
 * @route   GET /api/stats
 * @desc    Get overall statistics
 * @access  Public
 */
router.get('/stats', (req, res) => {
    const historyStats = getHistoryStats();
    const cacheStats = getCacheStats();

    res.json({
        success: true,
        queries: historyStats,
        cache: cacheStats,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

module.exports = router;
