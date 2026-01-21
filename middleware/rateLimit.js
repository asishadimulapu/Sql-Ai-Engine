/**
 * Rate Limiting
 */

const rateLimit = require('express-rate-limit');

/**
 * Create rate limiter with configuration
 * @param {Object} options - Rate limit options
 * @returns {Function} Rate limiter middleware
 */
function createRateLimiter(options = {}) {
    const windowMs = options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000; // 1 minute
    const max = options.max || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            error: 'Too many requests, please try again later',
            retryAfter: Math.ceil(windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use X-Forwarded-For if behind proxy, otherwise use IP
            return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                req.ip ||
                req.socket.remoteAddress;
        },
        skip: (req) => {
            // Skip rate limiting for health checks
            return req.path === '/api/health';
        }
    });
}

/**
 * Stricter rate limiter for AI endpoints
 */
function createAIRateLimiter() {
    return createRateLimiter({
        windowMs: 60000, // 1 minute
        max: 20 // 20 AI requests per minute
    });
}

/**
 * Very strict limiter for auth endpoints
 */
function createAuthRateLimiter() {
    return createRateLimiter({
        windowMs: 900000, // 15 minutes
        max: 5 // 5 attempts per 15 minutes
    });
}

module.exports = {
    createRateLimiter,
    createAIRateLimiter,
    createAuthRateLimiter
};
