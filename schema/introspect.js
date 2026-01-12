/**
 * Schema Introspection Module
 * Dynamically extracts database schema for SQLite, MySQL, and PostgreSQL
 */

/**
 * Get schema for SQLite database
 * @param {import('better-sqlite3').Database} db - SQLite database connection
 * @returns {Promise<Object>} Schema object with table names and columns
 */
async function getSQLiteSchema(db) {
  const schema = {};
  
  // Get all tables (excluding SQLite internal tables)
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  for (const table of tables) {
    const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all();
    schema[table.name] = {
      columns: columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: col.notnull === 0,
        primaryKey: col.pk === 1,
        defaultValue: col.dflt_value
      })),
      columnNames: columns.map(col => col.name)
    };
  }

  // Get foreign key relationships
  for (const tableName of Object.keys(schema)) {
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all();
    schema[tableName].foreignKeys = foreignKeys.map(fk => ({
      column: fk.from,
      referencesTable: fk.table,
      referencesColumn: fk.to
    }));
  }

  return schema;
}

/**
 * Get schema for MySQL database
 * @param {import('mysql2/promise').Pool} pool - MySQL connection pool
 * @param {string} database - Database name
 * @returns {Promise<Object>} Schema object with table names and columns
 */
async function getMySQLSchema(pool, database) {
  const schema = {};

  // Get all tables
  const [tables] = await pool.query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `, [database]);

  for (const table of tables) {
    const tableName = table.TABLE_NAME;
    
    // Get columns
    const [columns] = await pool.query(`
      SELECT 
        COLUMN_NAME, DATA_TYPE, IS_NULLABLE, 
        COLUMN_KEY, COLUMN_DEFAULT, EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [database, tableName]);

    schema[tableName] = {
      columns: columns.map(col => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        nullable: col.IS_NULLABLE === 'YES',
        primaryKey: col.COLUMN_KEY === 'PRI',
        defaultValue: col.COLUMN_DEFAULT
      })),
      columnNames: columns.map(col => col.COLUMN_NAME)
    };

    // Get foreign keys
    const [foreignKeys] = await pool.query(`
      SELECT 
        COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [database, tableName]);

    schema[tableName].foreignKeys = foreignKeys.map(fk => ({
      column: fk.COLUMN_NAME,
      referencesTable: fk.REFERENCED_TABLE_NAME,
      referencesColumn: fk.REFERENCED_COLUMN_NAME
    }));
  }

  return schema;
}

/**
 * Get schema for PostgreSQL database
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @param {string} schemaName - Schema name (default: 'public')
 * @returns {Promise<Object>} Schema object with table names and columns
 */
async function getPostgresSchema(pool, schemaName = 'public') {
  const schema = {};

  // Get all tables
  const tablesResult = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schemaName]);

  for (const table of tablesResult.rows) {
    const tableName = table.table_name;

    // Get columns
    const columnsResult = await pool.query(`
      SELECT 
        column_name, data_type, is_nullable, 
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [schemaName, tableName]);

    // Get primary keys
    const pkResult = await pool.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `, [`${schemaName}.${tableName}`]).catch(() => ({ rows: [] }));

    const primaryKeys = new Set(pkResult.rows.map(r => r.attname));

    schema[tableName] = {
      columns: columnsResult.rows.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        primaryKey: primaryKeys.has(col.column_name),
        defaultValue: col.column_default
      })),
      columnNames: columnsResult.rows.map(col => col.column_name)
    };

    // Get foreign keys
    const fkResult = await pool.query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
    `, [schemaName, tableName]);

    schema[tableName].foreignKeys = fkResult.rows.map(fk => ({
      column: fk.column_name,
      referencesTable: fk.referenced_table,
      referencesColumn: fk.referenced_column
    }));
  }

  return schema;
}

/**
 * Universal schema introspection function
 * @param {Object} db - Database connection
 * @param {string} dbType - Database type: 'sqlite', 'mysql', 'postgres'
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Schema object
 */
async function getSchema(db, dbType = 'sqlite', options = {}) {
  switch (dbType.toLowerCase()) {
    case 'sqlite':
      return getSQLiteSchema(db);
    
    case 'mysql':
      return getMySQLSchema(db, options.database);
    
    case 'postgres':
    case 'postgresql':
      return getPostgresSchema(db, options.schema || 'public');
    
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

/**
 * Format schema for human-readable display
 * @param {Object} schema - Schema object
 * @returns {string} Formatted schema string
 */
function formatSchemaForPrompt(schema) {
  const lines = [];
  
  for (const [tableName, tableInfo] of Object.entries(schema)) {
    const columns = tableInfo.columnNames || tableInfo.columns.map(c => c.name);
    lines.push(`- ${tableName}: ${columns.join(', ')}`);
    
    // Add foreign key hints
    if (tableInfo.foreignKeys && tableInfo.foreignKeys.length > 0) {
      for (const fk of tableInfo.foreignKeys) {
        lines.push(`  └─ ${fk.column} → ${fk.referencesTable}.${fk.referencesColumn}`);
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Get simplified schema (just table names and column names)
 * @param {Object} schema - Full schema object
 * @returns {Object} Simplified schema
 */
function getSimplifiedSchema(schema) {
  const simplified = {};
  for (const [tableName, tableInfo] of Object.entries(schema)) {
    simplified[tableName] = tableInfo.columnNames || tableInfo.columns.map(c => c.name);
  }
  return simplified;
}

module.exports = {
  getSchema,
  getSQLiteSchema,
  getMySQLSchema,
  getPostgresSchema,
  formatSchemaForPrompt,
  getSimplifiedSchema
};
