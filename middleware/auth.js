/**
 * JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

/**
 * Authentication middleware
 */
function authMiddleware(req, res, next) {
    // Skip auth if disabled
    if (!AUTH_ENABLED) {
        req.user = { id: 'anonymous', role: 'user' };
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: 'Authorization header required'
        });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            error: 'Invalid authorization format. Use: Bearer <token>'
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired'
            });
        }
        return res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
}

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {Object} options - Token options
 * @returns {string} JWT token
 */
function generateToken(payload, options = {}) {
    const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '24h';
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Optional auth - doesn't fail if no token, but adds user if present
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        req.user = null;
        return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
        try {
            req.user = jwt.verify(parts[1], JWT_SECRET);
        } catch {
            req.user = null;
        }
    }

    next();
}

module.exports = {
    authMiddleware,
    generateToken,
    optionalAuth
};
