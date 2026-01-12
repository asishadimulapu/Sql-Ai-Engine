/**
 * Schema Formatter
 * Formats schema objects for display and prompt injection
 */

/**
 * Format schema for AI prompt injection
 * @param {Object} schema - Schema object from introspection
 * @returns {string} Formatted schema string
 */
function formatSchemaForPrompt(schema) {
    const lines = [];

    for (const [tableName, tableInfo] of Object.entries(schema)) {
        // Handle both full schema and simplified schema formats
        let columns;
        if (Array.isArray(tableInfo)) {
            columns = tableInfo;
        } else if (tableInfo.columnNames) {
            columns = tableInfo.columnNames;
        } else if (tableInfo.columns) {
            columns = tableInfo.columns.map(c => c.name);
        } else {
            columns = [];
        }

        lines.push(`- ${tableName}: ${columns.join(', ')}`);

        // Add foreign key hints if available
        if (tableInfo.foreignKeys && tableInfo.foreignKeys.length > 0) {
            for (const fk of tableInfo.foreignKeys) {
                lines.push(`  └─ ${fk.column} → ${fk.referencesTable}.${fk.referencesColumn}`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * Format schema for detailed display (with types)
 * @param {Object} schema - Schema object from introspection
 * @returns {string} Detailed formatted schema
 */
function formatSchemaDetailed(schema) {
    const lines = [];

    for (const [tableName, tableInfo] of Object.entries(schema)) {
        lines.push(`\n📊 ${tableName}`);
        lines.push('─'.repeat(40));

        const columns = tableInfo.columns || [];
        for (const col of columns) {
            const pk = col.primaryKey ? '🔑 ' : '   ';
            const nullable = col.nullable ? '' : ' NOT NULL';
            lines.push(`${pk}${col.name} (${col.type}${nullable})`);
        }

        if (tableInfo.foreignKeys && tableInfo.foreignKeys.length > 0) {
            lines.push('\n  Foreign Keys:');
            for (const fk of tableInfo.foreignKeys) {
                lines.push(`    ${fk.column} → ${fk.referencesTable}.${fk.referencesColumn}`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * Format schema as JSON-friendly object
 * @param {Object} schema - Schema object from introspection
 * @returns {Object} Clean JSON-friendly schema
 */
function formatSchemaAsJSON(schema) {
    const result = {};

    for (const [tableName, tableInfo] of Object.entries(schema)) {
        result[tableName] = {
            columns: tableInfo.columns || tableInfo.columnNames?.map(name => ({ name })) || [],
            foreignKeys: tableInfo.foreignKeys || []
        };
    }

    return result;
}

module.exports = {
    formatSchemaForPrompt,
    formatSchemaDetailed,
    formatSchemaAsJSON
};
