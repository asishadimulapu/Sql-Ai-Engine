/**
 * SQL Service
 * Core service for generating and executing SQL queries
 */

const { getSchema, getSimplifiedSchema } = require('../schema/introspect');
const { buildSQLPrompt } = require('../prompts/sqlPrompt');
const { generateSQL: callGroqAI, explainResults: explainWithAI } = require('../ai/groq');
const { getSchemaFromCache, setSchemaInCache } = require('../utils/cache');
const { addToHistory } = require('../utils/queryHistory');
const { executeWithTimeout } = require('../db/connection');
const logger = require('../utils/logger');

/**
 * Dangerous SQL patterns that should be blocked
 */
const DANGEROUS_PATTERNS = [
    /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b/i,
    /\b(EXEC|EXECUTE|EVAL)\b/i,
    /\bINTO\s+OUTFILE\b/i,
    /\bINTO\s+DUMPFILE\b/i,
    /\bLOAD_FILE\b/i,
    /;\s*--/,  // Comment-based injection attempt
    /UNION\s+ALL\s+SELECT.*FROM\s+INFORMATION_SCHEMA/i, // Schema enumeration
];

/**
 * Validate SQL query for safety
 * @param {string} sql - SQL query to validate
 * @throws {Error} If query is unsafe
 */
function validateSQL(sql) {
    // Check for empty query
    if (!sql || sql.trim().length === 0) {
        throw new Error('Empty SQL query');
    }

    // Must start with SELECT or WITH (for CTEs)
    const trimmedSQL = sql.trim().toUpperCase();
    if (!trimmedSQL.startsWith('SELECT') && !trimmedSQL.startsWith('WITH')) {
        throw new Error('Only SELECT queries are allowed');
    }

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(sql)) {
            throw new Error('Query contains potentially dangerous operations');
        }
    }

    // Check for multiple statements
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) {
        throw new Error('Multiple SQL statements are not allowed');
    }

    return true;
}

/**
 * Clean SQL query
 * @param {string} sql - Raw SQL
 * @returns {string} Cleaned SQL
 */
function cleanSQL(sql) {
    let cleaned = sql.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```sql\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');

    // Remove leading/trailing quotes
    cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '');

    // Ensure ends with semicolon
    if (!cleaned.endsWith(';')) {
        cleaned += ';';
    }

    return cleaned;
}

/**
 * Generate SQL from natural language question
 * @param {string} question - User's question
 * @param {Object} db - Database connection
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Generated SQL and metadata
 */
async function generateSQL(question, db, options = {}) {
    const dbType = options.dbType || process.env.DB_TYPE || 'sqlite';
    const startTime = Date.now();

    logger.info(`Generating SQL for question: "${question}"`);

    try {
        // Get schema (from cache or fresh introspection)
        let schema;
        const cacheKey = `${dbType}:${options.database || 'default'}`;

        const cachedSchema = getSchemaFromCache(cacheKey);
        if (cachedSchema) {
            schema = cachedSchema;
            logger.debug('Using cached schema');
        } else {
            schema = await getSchema(db, dbType, {
                database: options.database || process.env.MYSQL_DATABASE || process.env.PG_DATABASE,
                schema: options.schema || 'public'
            });
            setSchemaInCache(cacheKey, schema);
            logger.debug('Schema introspected and cached');
        }

        // Build prompt with schema
        const prompt = buildSQLPrompt(schema, {
            additionalContext: options.context
        });

        // Generate SQL using AI
        const rawSQL = await callGroqAI(question, prompt, {
            apiKey: options.apiKey,
            model: options.model
        });

        // Clean and validate
        const sql = cleanSQL(rawSQL);
        validateSQL(sql);

        const generationTime = Date.now() - startTime;

        logger.info(`SQL generated in ${generationTime}ms: ${sql.substring(0, 100)}...`);

        return {
            success: true,
            sql,
            generationTimeMs: generationTime,
            schemaUsed: getSimplifiedSchema(schema)
        };

    } catch (error) {
        logger.error(`SQL generation failed: ${error.message}`);
        throw error;
    }
}

/**
 * Execute SQL query
 * @param {string} sql - SQL query
 * @param {Object} db - Database connection
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Query results
 */
async function executeSQL(sql, db, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeout || parseInt(process.env.QUERY_TIMEOUT_MS) || 30000;
    const maxRows = options.maxRows || parseInt(process.env.MAX_RESULT_ROWS) || 1000;

    try {
        // Validate before execution
        validateSQL(sql);

        // Add LIMIT if not present (safety measure)
        let limitedSQL = sql;
        if (!/\bLIMIT\s+\d+/i.test(sql)) {
            limitedSQL = sql.replace(/;?\s*$/, ` LIMIT ${maxRows};`);
        }

        // Execute with timeout
        const results = await executeWithTimeout(db, limitedSQL, [], timeout);

        const executionTime = Date.now() - startTime;

        return {
            success: true,
            results,
            rowCount: results.length,
            executionTimeMs: executionTime,
            limitApplied: limitedSQL !== sql
        };

    } catch (error) {
        logger.error(`SQL execution failed: ${error.message}`);
        throw error;
    }
}

/**
 * Generate and execute SQL in one step
 * @param {string} question - User's question
 * @param {Object} db - Database connection
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Complete query result
 */
async function queryFromQuestion(question, db, options = {}) {
    const requestId = options.requestId || Date.now().toString();
    const startTime = Date.now();

    try {
        // Generate SQL
        const generation = await generateSQL(question, db, options);

        // Execute SQL
        const execution = await executeSQL(generation.sql, db, options);

        // Get natural language explanation if requested
        let explanation = null;
        if (options.explain && execution.results.length > 0) {
            try {
                explanation = await explainWithAI(
                    question,
                    generation.sql,
                    execution.results,
                    { apiKey: options.apiKey, model: options.model }
                );
            } catch (err) {
                logger.warn(`Failed to generate explanation: ${err.message}`);
            }
        }

        const totalTime = Date.now() - startTime;

        // Record in history
        addToHistory({
            requestId,
            question,
            sql: generation.sql,
            success: true,
            rowCount: execution.rowCount,
            generationTimeMs: generation.generationTimeMs,
            executionTimeMs: execution.executionTimeMs,
            totalTimeMs: totalTime,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            question,
            sql: generation.sql,
            results: execution.results,
            rowCount: execution.rowCount,
            explanation,
            timing: {
                generation: generation.generationTimeMs,
                execution: execution.executionTimeMs,
                total: totalTime
            },
            metadata: {
                requestId,
                limitApplied: execution.limitApplied,
                schemaTablesUsed: Object.keys(generation.schemaUsed)
            }
        };

    } catch (error) {
        // Record failed attempt
        addToHistory({
            requestId,
            question,
            sql: null,
            success: false,
            error: error.message,
            totalTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

        throw error;
    }
}

/**
 * Get explain plan for a query
 * @param {string} sql - SQL query
 * @param {Object} db - Database connection
 * @param {string} dbType - Database type
 * @returns {Promise<Array>} Explain plan results
 */
async function getExplainPlan(sql, db, dbType = 'sqlite') {
    validateSQL(sql);

    let explainSQL;
    switch (dbType.toLowerCase()) {
        case 'sqlite':
            explainSQL = `EXPLAIN QUERY PLAN ${sql}`;
            break;
        case 'mysql':
            explainSQL = `EXPLAIN ${sql}`;
            break;
        case 'postgres':
        case 'postgresql':
            explainSQL = `EXPLAIN (FORMAT JSON) ${sql}`;
            break;
        default:
            throw new Error(`Explain not supported for ${dbType}`);
    }

    return db.asyncAll(explainSQL);
}

module.exports = {
    generateSQL,
    executeSQL,
    queryFromQuestion,
    validateSQL,
    cleanSQL,
    getExplainPlan
};
