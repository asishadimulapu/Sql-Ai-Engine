/**
 * Universal SQL AI Engine
 * Main server entry point
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { initDatabase, closeDatabase } = require('./db/connection');
const apiRoutes = require('./routes/api');
const uploadRoutes = require('./routes/upload');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { createRateLimiter } = require('./middleware/rateLimit');
const { authMiddleware } = require('./middleware/auth');
const logger = require('./utils/logger');
const { requestLogger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Global rate limiting
app.use(createRateLimiter());

// Static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API routes
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
if (AUTH_ENABLED) {
    app.use('/api', authMiddleware, apiRoutes);
    app.use('/api/upload', authMiddleware, uploadRoutes);
} else {
    app.use('/api', apiRoutes);
    app.use('/api/upload', uploadRoutes);
}

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Database initialization and server start
async function startServer() {
    try {
        // Auto-detect database type: If DATABASE_URL is set (Railway/Heroku), use postgres
        const dbType = process.env.DATABASE_URL ? 'postgres' : (process.env.DB_TYPE || 'sqlite');

        logger.info(`🚀 Starting Universal SQL AI Engine...`);
        logger.info(`📦 Database type: ${dbType}`);

        // Initialize database
        const db = await initDatabase(dbType);

        // Store in app context
        app.set('db', db);
        app.set('dbType', dbType);

        // Start server
        const server = app.listen(PORT, () => {
            logger.info(`✅ Server running on http://localhost:${PORT}`);
            logger.info(`📊 API available at http://localhost:${PORT}/api`);
            logger.info(`🎨 Dashboard at http://localhost:${PORT}`);

            if (!process.env.GROQ_API_KEY) {
                logger.warn('⚠️  GROQ_API_KEY not set - AI features will not work');
            }
        });

        // Graceful shutdown
        const shutdown = async (signal) => {
            logger.info(`\n${signal} received. Shutting down gracefully...`);

            server.close(async () => {
                await closeDatabase(db, dbType);
                logger.info('👋 Server closed. Goodbye!');
                process.exit(0);
            });

            // Force exit if graceful shutdown takes too long
            setTimeout(() => {
                logger.error('Forced exit after timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;
