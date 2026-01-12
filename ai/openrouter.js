/**
 * OpenRouter AI Integration
 * Handles communication with OpenRouter API for SQL generation
 */

const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Call OpenRouter API
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Additional options
 * @returns {Promise<string>} AI response text
 */
async function callOpenRouter(prompt, options = {}) {
    const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
    const model = options.model || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free';

    if (!apiKey) {
        throw new Error('OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable.');
    }

    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || parseInt(process.env.QUERY_TIMEOUT_MS) || 30000;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.post(
                OPENROUTER_API_URL,
                {
                    model: model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: options.temperature || 0.1, // Low temperature for consistent SQL
                    max_tokens: options.maxTokens || 2000,
                    top_p: 0.9
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': options.referer || 'http://localhost:3000',
                        'X-Title': options.title || 'Universal SQL AI Engine'
                    },
                    timeout: timeout
                }
            );

            const content = response.data?.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('No content in AI response');
            }

            return content.trim();

        } catch (error) {
            lastError = error;

            // Check if we should retry
            const isRetryable =
                error.code === 'ECONNRESET' ||
                error.code === 'ETIMEDOUT' ||
                error.response?.status === 429 || // Rate limited
                error.response?.status >= 500;    // Server error

            if (isRetryable && attempt < maxRetries) {
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`⚠️ Retry ${attempt}/${maxRetries} after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            break;
        }
    }

    // Format error message
    if (lastError.response) {
        const status = lastError.response.status;
        const message = lastError.response.data?.error?.message || lastError.message;
        throw new Error(`OpenRouter API error (${status}): ${message}`);
    } else if (lastError.code === 'ETIMEDOUT') {
        throw new Error(`Request timed out after ${timeout}ms`);
    } else {
        throw new Error(`API request failed: ${lastError.message}`);
    }
}

/**
 * Generate SQL from natural language question
 * @param {string} systemPrompt - System prompt with schema
 * @param {string} question - User's question
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated SQL
 */
async function generateSQLFromAI(systemPrompt, question, options = {}) {
    const fullPrompt = `${systemPrompt}\n\nQuestion: ${question}`;

    const response = await callOpenRouter(fullPrompt, {
        ...options,
        temperature: 0.1 // Very low for consistent SQL generation
    });

    return cleanSQLResponse(response);
}

/**
 * Clean SQL response from AI
 * @param {string} response - Raw AI response
 * @returns {string} Cleaned SQL
 */
function cleanSQLResponse(response) {
    let sql = response.trim();

    // Remove markdown code blocks
    sql = sql.replace(/^```sql\s*/i, '');
    sql = sql.replace(/^```\s*/i, '');
    sql = sql.replace(/\s*```$/i, '');

    // Remove any leading/trailing quotes
    sql = sql.replace(/^["'`]+|["'`]+$/g, '');

    // Remove any explanatory text before/after SQL
    // Look for SELECT as the start of the actual query
    const selectMatch = sql.match(/\b(SELECT|WITH)\s+/i);
    if (selectMatch) {
        const startIndex = sql.indexOf(selectMatch[0]);
        sql = sql.substring(startIndex);
    }

    // Ensure it ends with semicolon
    sql = sql.trim();
    if (!sql.endsWith(';')) {
        sql += ';';
    }

    return sql;
}

/**
 * Get natural language explanation of results
 * @param {string} question - Original question
 * @param {string} sql - Generated SQL
 * @param {Array} results - Query results
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Natural language explanation
 */
async function explainResults(question, sql, results, options = {}) {
    const resultSample = results.slice(0, 15);

    const prompt = `You are a senior data analyst presenting findings to a business team. Based on the question and query results below, provide a professional analysis.

USER QUESTION: "${question}"

SQL QUERY EXECUTED:
${sql}

RESULTS (${results.length} total rows${results.length > 15 ? ', showing top 15' : ''}):
${JSON.stringify(resultSample, null, 2)}

Provide your analysis in this format:

📊 **Key Findings:**
- Summarize the main results in 2-3 bullet points

💡 **Insights:**
- What patterns or notable information stands out?
- Any surprising or significant data points?

📈 **Business Context:**
- What does this data mean for the business?
- Any recommendations based on these findings?

Keep your response concise but insightful, like a data analyst presenting to stakeholders.`;

    return callOpenRouter(prompt, {
        ...options,
        temperature: 0.4
    });
}

module.exports = {
    callOpenRouter,
    generateSQLFromAI,
    cleanSQLResponse,
    explainResults
};
