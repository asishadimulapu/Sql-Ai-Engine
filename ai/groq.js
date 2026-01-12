/**
 * Groq AI Integration
 * Handles communication with Groq API for SQL generation
 */

const Groq = require('groq-sdk');

/**
 * Call Groq API
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Additional options
 * @returns {Promise<string>} AI response text
 */
async function callGroq(prompt, options = {}) {
    const apiKey = options.apiKey || process.env.GROQ_API_KEY;
    const model = options.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey) {
        throw new Error('Groq API key is required. Set GROQ_API_KEY environment variable.');
    }

    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || parseInt(process.env.QUERY_TIMEOUT_MS) || 30000;

    const groq = new Groq({
        apiKey: apiKey,
        timeout: timeout
    });

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const completion = await groq.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: options.maxTokens || 2000,
                top_p: 1,
                stream: false
            });

            if (!completion.choices || completion.choices.length === 0) {
                throw new Error('No response from Groq API');
            }

            const response = completion.choices[0].message.content;

            if (!response) {
                throw new Error('Empty response from Groq API');
            }

            return response.trim();

        } catch (error) {
            lastError = error;

            // Log the attempt
            console.error(`Groq API attempt ${attempt}/${maxRetries} failed:`, error.message);

            // If it's a rate limit error and we have retries left, wait and retry
            if (error.status === 429 && attempt < maxRetries) {
                const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
                console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            // If it's not a retryable error or we're out of retries, throw
            if (attempt === maxRetries || ![429, 500, 502, 503, 504].includes(error.status)) {
                throw error;
            }
        }
    }

    throw lastError;
}

/**
 * Generate SQL from natural language question
 * @param {string} question - Natural language question
 * @param {string} systemPrompt - System prompt with schema
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated SQL
 */
async function generateSQL(question, systemPrompt, options = {}) {
    const fullPrompt = `${systemPrompt}\n\nUser Question: ${question}`;
    return await callGroq(fullPrompt, options);
}

/**
 * Explain query results in natural language
 * @param {string} question - Original question
 * @param {string} sql - Generated SQL
 * @param {Array} results - Query results
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Natural language explanation
 */
async function explainResults(question, sql, results, options = {}) {
    const resultSample = results.slice(0, 10);

    const prompt = `You are a data analyst providing insights from query results.

Original Question: ${question}

SQL Query: ${sql}

Results (showing first ${resultSample.length} of ${results.length} rows):
${JSON.stringify(resultSample, null, 2)}

Provide a clear, analyst-style explanation with:
- **Key Findings**: What the data shows
- **Insights**: Notable patterns or trends
- **Business Context**: What this means practically

Keep it concise and professional.`;

    return await callGroq(prompt, {
        ...options,
        maxTokens: 1000
    });
}

module.exports = {
    callGroq,
    generateSQL,
    explainResults
};
