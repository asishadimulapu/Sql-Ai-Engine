/**
 * Generates AI prompts with injected database schema
 */

/**
 * Build the system prompt for SQL generation
 * @param {Object} schema - Database schema object
 * @param {Object} options - Additional options
 * @returns {string} System prompt
 */
function buildSQLPrompt(schema, options = {}) {
    const { formatSchemaForPrompt } = require('./schemaFormatter');
    const schemaText = formatSchemaForPrompt(schema);

    return `You are an expert SQL analyst and database engineer.

TASK: Convert natural language questions into precise, safe SQL queries.

CRITICAL RULES:
1. Output ONLY raw SQL - no explanations, comments, or markdown
2. Use ONLY SELECT statements - no INSERT, UPDATE, DELETE, DROP, or any modifying operations
3. Never guess column or table names - only use what's in the schema
4. Use proper JOINs based on foreign key relationships
5. Always use GROUP BY with aggregate functions (COUNT, SUM, AVG, MIN, MAX)
6. Use LIMIT for "top N" or "bottom N" queries
7. Use ORDER BY for sorting requests
8. Handle NULL values appropriately with COALESCE or IS NULL checks
9. Use table aliases for clarity in multi-table queries
10. If the question cannot be answered with the schema, return: SELECT 'Query not possible with available schema' AS error

UPLOADED FILE HANDLING:
- Tables starting with "upload_" are USER-UPLOADED files
- If the user mentions "uploaded", "my file", "uploaded file", "csv", "excel", "the file I uploaded", or similar, use ONLY the upload_ prefixed tables
- Do NOT mix uploaded tables with other database tables unless explicitly asked
- Look for the most recently uploaded table (highest suffix number) if multiple upload_ tables exist

SQL BEST PRACTICES:
- Prefer explicit column names over SELECT *
- Use meaningful aliases for calculated fields
- Use DISTINCT when duplicates should be eliminated
- Use CASE WHEN for conditional logic
- Use subqueries or CTEs for complex logic
- IMPORTANT: Use the EXACT column names from the schema (case-sensitive)
- For PostgreSQL with mixed-case column names, wrap them in double quotes like "ProductID", "OrderDate"

DATABASE SCHEMA:
${schemaText}

${options.additionalContext ? `ADDITIONAL CONTEXT:\n${options.additionalContext}\n` : ''}
Remember: Output ONLY the raw SQL query, nothing else.`;
}

/**
 * Build prompt for explaining a query
 * @param {string} sql - SQL query to explain
 * @returns {string} Explanation prompt
 */
function buildExplainPrompt(sql) {
    return `Explain this SQL query in simple, non-technical terms. 
Describe what data it retrieves and how it works step by step.

SQL Query:
${sql}

Provide a clear, concise explanation suitable for a business user.`;
}

/**
 * Build prompt for suggesting query improvements
 * @param {string} sql - SQL query to improve
 * @param {Object} schema - Database schema
 * @returns {string} Improvement prompt
 */
function buildImprovementPrompt(sql, schema) {
    const { formatSchemaForPrompt } = require('./schemaFormatter');
    const schemaText = formatSchemaForPrompt(schema);

    return `Analyze this SQL query and suggest optimizations.
Consider: indexing opportunities, query structure, JOINs efficiency, and readability.

DATABASE SCHEMA:
${schemaText}

SQL Query:
${sql}

Provide specific, actionable improvement suggestions.`;
}

/**
 * Build prompt for natural language response
 * @param {string} question - Original user question
 * @param {Array} results - Query results
 * @returns {string} Response prompt
 */
function buildResponsePrompt(question, results) {
    const resultSample = results.slice(0, 10);
    const resultText = JSON.stringify(resultSample, null, 2);

    return `Based on the user's question and the query results below, provide a natural language answer.
Be concise and directly address the question.

User Question: ${question}

Query Results (showing first ${resultSample.length} of ${results.length} rows):
${resultText}

Provide a clear, helpful response that answers the user's original question.`;
}

module.exports = {
    buildSQLPrompt,
    buildExplainPrompt,
    buildImprovementPrompt,
    buildResponsePrompt
};
