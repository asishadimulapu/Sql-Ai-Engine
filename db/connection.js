/**
 * Universal Database Connection Factory
 * Supports SQLite, MySQL, and PostgreSQL
 */

let Database; // better-sqlite3
let mysqlPool; // mysql2
let pgPool; // pg

/**
 * Initialize database connection
 * @param {string} dbType - Database type: 'sqlite', 'mysql', 'postgres'
 * @param {Object} config - Database configuration
 * @returns {Promise<Object>} Database connection/pool
 */
async function initDatabase(dbType = 'sqlite', config = {}) {
    switch (dbType.toLowerCase()) {
        case 'sqlite':
            return initSQLite(config);
        case 'mysql':
            return initMySQL(config);
        case 'postgres':
        case 'postgresql':
            return initPostgres(config);
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

/**
 * Initialize SQLite database
 * @param {Object} config - Configuration
 * @returns {import('better-sqlite3').Database} SQLite database
 */
function initSQLite(config = {}) {
    try {
        if (!Database) {
            Database = require('better-sqlite3');
        }
    } catch (error) {
        throw new Error('SQLite (better-sqlite3) is not available. Use PostgreSQL in production: set DB_TYPE=postgres');
    }

    const dbPath = config.path || process.env.SQLITE_PATH || './data/northwind.db';

    const db = new Database(dbPath, {
        readonly: config.readonly !== false, // Default to readonly for safety
        fileMustExist: config.fileMustExist !== false
    });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Add async wrapper methods for consistency with other DBs
    db.asyncAll = (sql, params = []) => {
        return Promise.resolve(db.prepare(sql).all(...(Array.isArray(params) ? params : [params])));
    };

    db.asyncGet = (sql, params = []) => {
        return Promise.resolve(db.prepare(sql).get(...(Array.isArray(params) ? params : [params])));
    };

    db.asyncRun = (sql, params = []) => {
        return Promise.resolve(db.prepare(sql).run(...(Array.isArray(params) ? params : [params])));
    };

    // Health check method
    db.healthCheck = () => {
        try {
            db.prepare('SELECT 1').get();
            return { healthy: true, type: 'sqlite' };
        } catch (error) {
            return { healthy: false, type: 'sqlite', error: error.message };
        }
    };

    console.log(`✅ SQLite connected: ${dbPath}`);
    return db;
}

/**
 * Initialize MySQL connection pool
 * @param {Object} config - Configuration
 * @returns {Promise<import('mysql2/promise').Pool>} MySQL pool
 */
async function initMySQL(config = {}) {
    const mysql = require('mysql2/promise');

    mysqlPool = mysql.createPool({
        host: config.host || process.env.MYSQL_HOST || 'localhost',
        port: config.port || parseInt(process.env.MYSQL_PORT) || 3306,
        user: config.user || process.env.MYSQL_USER || 'root',
        password: config.password || process.env.MYSQL_PASSWORD || '',
        database: config.database || process.env.MYSQL_DATABASE || 'northwind',
        waitForConnections: true,
        connectionLimit: config.connectionLimit || 10,
        queueLimit: 0
    });

    // Add convenience methods
    mysqlPool.asyncAll = async (sql, params = []) => {
        const [rows] = await mysqlPool.query(sql, params);
        return rows;
    };

    mysqlPool.asyncGet = async (sql, params = []) => {
        const [rows] = await mysqlPool.query(sql, params);
        return rows[0];
    };

    // Health check
    mysqlPool.healthCheck = async () => {
        try {
            await mysqlPool.query('SELECT 1');
            return { healthy: true, type: 'mysql' };
        } catch (error) {
            return { healthy: false, type: 'mysql', error: error.message };
        }
    };

    // Test connection
    await mysqlPool.query('SELECT 1');
    console.log(`✅ MySQL connected: ${config.host || 'localhost'}:${config.port || 3306}`);

    return mysqlPool;
}

/**
 * Initialize PostgreSQL connection pool
 * @param {Object} config - Configuration
 * @returns {Promise<import('pg').Pool>} PostgreSQL pool
 */
async function initPostgres(config = {}) {
    const { Pool } = require('pg');

    // Support DATABASE_URL from Render/Railway/Heroku
    const connectionString = process.env.DATABASE_URL;

    let poolConfig;

    if (connectionString) {
        // Use connection string (Render, Railway, Heroku, Azure, etc.)
        console.log('Using DATABASE_URL connection string');
        poolConfig = {
            connectionString,
            ssl: {
                rejectUnauthorized: false
            },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        };
    } else {
        // Fallback to individual environment variables
        poolConfig = {
            host: config.host || process.env.PG_HOST || 'localhost',
            port: config.port || parseInt(process.env.PG_PORT) || 5432,
            user: config.user || process.env.PG_USER || 'postgres',
            password: config.password || process.env.PG_PASSWORD || '',
            database: config.database || process.env.PG_DATABASE || 'northwind',
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        };
    }

    pgPool = new Pool(poolConfig);

    // Add convenience methods
    pgPool.asyncAll = async (sql, params = []) => {
        const result = await pgPool.query(sql, params);
        return result.rows;
    };

    pgPool.asyncGet = async (sql, params = []) => {
        const result = await pgPool.query(sql, params);
        return result.rows[0];
    };

    // Health check
    pgPool.healthCheck = async () => {
        try {
            await pgPool.query('SELECT 1');
            return { healthy: true, type: 'postgres' };
        } catch (error) {
            return { healthy: false, type: 'postgres', error: error.message };
        }
    };

    // Test connection
    await pgPool.query('SELECT 1');
    console.log('✅ PostgreSQL connected successfully');

    return pgPool;
}

/**
 * Close database connections
 * @param {Object} db - Database connection to close
 * @param {string} dbType - Database type
 */
async function closeDatabase(db, dbType = 'sqlite') {
    if (!db) return;

    switch (dbType.toLowerCase()) {
        case 'sqlite':
            db.close();
            break;
        case 'mysql':
            await db.end();
            break;
        case 'postgres':
        case 'postgresql':
            await db.end();
            break;
    }

    console.log(`📴 Database connection closed (${dbType})`);
}

/**
 * Execute a query with timeout
 * @param {Object} db - Database connection
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Array>} Query results
 */
async function executeWithTimeout(db, sql, params = [], timeout = 30000) {
    return Promise.race([
        db.asyncAll(sql, params),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Query timed out after ${timeout}ms`)), timeout)
        )
    ]);
}

module.exports = {
    initDatabase,
    initSQLite,
    initMySQL,
    initPostgres,
    closeDatabase,
    executeWithTimeout
};
