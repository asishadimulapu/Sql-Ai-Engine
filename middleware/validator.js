/**
 * Input Validation Middleware
 */

const MAX_QUESTION_LENGTH = 1000;
const VALID_DB_TYPES = ['sqlite', 'mysql', 'postgres', 'postgresql'];

// Suspicious patterns that might indicate injection attempts
const SUSPICIOUS_PATTERNS = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,  // Event handlers
    /\x00/,        // Null bytes
];

/**
 * Validate query request
 */
function validateQueryRequest(req, res, next) {
    const { question, dbType } = req.body;

    // Check question exists
    if (!question || typeof question !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Question is required and must be a string'
        });
    }

    // Check question length
    if (question.length > MAX_QUESTION_LENGTH) {
        return res.status(400).json({
            success: false,
            error: `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters`
        });
    }

    // Check for suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(question)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid characters detected in question'
            });
        }
    }

    // Validate dbType if provided
    if (dbType && !VALID_DB_TYPES.includes(dbType.toLowerCase())) {
        return res.status(400).json({
            success: false,
            error: `Invalid database type. Must be one of: ${VALID_DB_TYPES.join(', ')}`
        });
    }

    // Trim and sanitize
    req.body.question = question.trim();

    next();
}

/**
 * Validate SQL parameter
 */
function validateSQLRequest(req, res, next) {
    const { sql } = req.body;

    if (!sql || typeof sql !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'SQL query is required and must be a string'
        });
    }

    if (sql.length > 10000) {
        return res.status(400).json({
            success: false,
            error: 'SQL query exceeds maximum length'
        });
    }

    req.body.sql = sql.trim();

    next();
}

/**
 * Sanitize output to prevent XSS
 */
function sanitizeOutput(data) {
    if (typeof data === 'string') {
        return data
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }
    if (Array.isArray(data)) {
        return data.map(sanitizeOutput);
    }
    if (data && typeof data === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = sanitizeOutput(value);
        }
        return sanitized;
    }
    return data;
}

module.exports = {
    validateQueryRequest,
    validateSQLRequest,
    sanitizeOutput
};
