/**
 * Global Error Handler Middleware
 */

const logger = require('../utils/logger');

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
    // Log the error
    logger.error('Request error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Determine status code
    let statusCode = err.statusCode || err.status || 500;

    // Map known error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
    } else if (err.message?.includes('not allowed')) {
        statusCode = 403;
    }

    // Prepare response
    const response = {
        success: false,
        error: err.message || 'Internal server error'
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    // Add request ID if available
    if (req.requestId) {
        response.requestId = req.requestId;
    }

    res.status(statusCode).json(response);
}

/**
 * Not found handler
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.path}`
    });
}

/**
 * Async handler wrapper
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
};
