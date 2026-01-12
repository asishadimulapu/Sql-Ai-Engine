/**
 * File Upload Service
 * Handles parsing of CSV, Excel, and JSON files
 */

const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const xlsx = require('xlsx');

// Supported file types
const SUPPORTED_TYPES = {
    'text/csv': 'csv',
    'application/vnd.ms-excel': 'csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/json': 'json'
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 10000;

/**
 * Parse uploaded file based on type
 * @param {Object} file - Multer file object
 * @returns {Promise<{data: Array, columns: Array, tableName: string}>}
 */
async function parseFile(file) {
    const ext = path.extname(file.originalname).toLowerCase();

    let data;

    switch (ext) {
        case '.csv':
            data = await parseCSV(file.path);
            break;
        case '.xlsx':
        case '.xls':
            data = parseExcel(file.path);
            break;
        case '.json':
            data = parseJSON(file.path);
            break;
        default:
            throw new Error(`Unsupported file type: ${ext}. Supported: CSV, Excel, JSON`);
    }

    if (data.length === 0) {
        throw new Error('File is empty or has no valid data');
    }

    if (data.length > MAX_ROWS) {
        throw new Error(`File exceeds maximum of ${MAX_ROWS} rows. Your file has ${data.length} rows.`);
    }

    // Get column names from first row
    const columns = Object.keys(data[0]);

    // Generate table name from filename
    const baseName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase()
        .substring(0, 50);
    const tableName = `upload_${baseName}_${Date.now().toString(36)}`;

    return {
        data,
        columns,
        tableName,
        rowCount: data.length,
        originalName: file.originalname
    };
}

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row) => {
                results.push(row);
            })
            .on('error', (error) => {
                reject(new Error(`CSV parsing error: ${error.message}`));
            })
            .on('end', () => {
                resolve(results);
            });
    });
}

/**
 * Parse Excel file
 */
function parseExcel(filePath) {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const data = xlsx.utils.sheet_to_json(worksheet, { defval: null });
        return data;
    } catch (error) {
        throw new Error(`Excel parsing error: ${error.message}`);
    }
}

/**
 * Parse JSON file
 */
function parseJSON(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);

        // Handle array or object with data array
        if (Array.isArray(parsed)) {
            return parsed;
        } else if (parsed.data && Array.isArray(parsed.data)) {
            return parsed.data;
        } else if (typeof parsed === 'object') {
            // Single object - wrap in array
            return [parsed];
        }

        throw new Error('JSON must be an array of objects or {data: [...]}');
    } catch (error) {
        throw new Error(`JSON parsing error: ${error.message}`);
    }
}

/**
 * Infer SQL column type from value
 */
function inferColumnType(value) {
    if (value === null || value === undefined || value === '') {
        return 'TEXT';
    }

    const strValue = String(value).trim();

    // Check for integer
    if (/^-?\d+$/.test(strValue) && !isNaN(parseInt(strValue))) {
        const num = parseInt(strValue);
        if (num >= -2147483648 && num <= 2147483647) {
            return 'INTEGER';
        }
        return 'BIGINT';
    }

    // Check for float/decimal
    if (/^-?\d+\.?\d*$/.test(strValue) && !isNaN(parseFloat(strValue))) {
        return 'NUMERIC';
    }

    // Check for boolean
    if (['true', 'false', 'yes', 'no', '1', '0'].includes(strValue.toLowerCase())) {
        return 'BOOLEAN';
    }

    // Check for date
    const dateFormats = [
        /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
        /^\d{2}-\d{2}-\d{4}$/   // DD-MM-YYYY
    ];
    if (dateFormats.some(fmt => fmt.test(strValue))) {
        return 'DATE';
    }

    // Default to TEXT
    return 'TEXT';
}

/**
 * Infer column types from data sample
 */
function inferSchema(data, columns) {
    const schema = {};

    // Sample first 100 rows
    const sample = data.slice(0, 100);

    for (const col of columns) {
        const values = sample.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');

        if (values.length === 0) {
            schema[col] = 'TEXT';
        } else {
            // Get type of first non-null value
            schema[col] = inferColumnType(values[0]);
        }
    }

    return schema;
}

/**
 * Create table from parsed data
 */
async function createTableFromData(db, tableName, data, columns) {
    const schema = inferSchema(data, columns);

    // Sanitize column names for SQL
    const sanitizedColumns = columns.map(col => {
        return col.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    });

    // Create column definitions
    const columnDefs = sanitizedColumns.map((col, i) => {
        const originalCol = columns[i];
        const type = schema[originalCol];
        return `"${col}" ${type}`;
    }).join(', ');

    // Drop existing table if exists
    await db.asyncAll(`DROP TABLE IF EXISTS ${tableName}`);

    // Create table
    const createSQL = `CREATE TABLE ${tableName} (${columnDefs})`;
    await db.asyncAll(createSQL);

    // Insert data in batches
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        for (const row of batch) {
            const values = sanitizedColumns.map((col, idx) => {
                const originalCol = columns[idx];
                const val = row[originalCol];
                if (val === null || val === undefined || val === '') {
                    return 'NULL';
                }
                // Escape single quotes
                const escaped = String(val).replace(/'/g, "''");
                return `'${escaped}'`;
            });

            const insertSQL = `INSERT INTO ${tableName} (${sanitizedColumns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')})`;
            await db.asyncAll(insertSQL);
        }
    }

    return {
        tableName,
        columns: sanitizedColumns,
        rowCount: data.length,
        schema
    };
}

/**
 * Delete uploaded table
 */
async function deleteUploadedTable(db, tableName) {
    // Only allow deleting upload_ prefixed tables for safety
    if (!tableName.startsWith('upload_')) {
        throw new Error('Can only delete uploaded tables');
    }

    await db.asyncAll(`DROP TABLE IF EXISTS ${tableName}`);
    return true;
}

/**
 * List all uploaded tables
 */
async function listUploadedTables(db, dbType) {
    let query;

    switch (dbType) {
        case 'sqlite':
            query = `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'upload_%'`;
            break;
        case 'postgres':
        case 'postgresql':
            query = `SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'upload_%'`;
            break;
        case 'mysql':
            query = `SHOW TABLES LIKE 'upload_%'`;
            break;
        default:
            return [];
    }

    const results = await db.asyncAll(query);
    return results.map(r => r.name || Object.values(r)[0]);
}

module.exports = {
    parseFile,
    createTableFromData,
    deleteUploadedTable,
    listUploadedTables,
    SUPPORTED_TYPES,
    MAX_FILE_SIZE,
    MAX_ROWS
};
