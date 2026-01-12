/**
 * SQL AI Engine - Frontend Application
 */

// API Configuration
const API_BASE = '/api';

// DOM Elements
const elements = {
    // Navigation
    navBtns: document.querySelectorAll('.nav-btn'),
    views: document.querySelectorAll('.view'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),

    // Query View
    questionInput: document.getElementById('questionInput'),
    queryBtn: document.getElementById('queryBtn'),
    explainToggle: document.getElementById('explainToggle'),
    exampleChips: document.querySelectorAll('.example-chip'),

    // Results
    resultsSection: document.getElementById('resultsSection'),
    sqlCard: document.getElementById('sqlCard'),
    sqlOutput: document.getElementById('sqlOutput'),
    copySqlBtn: document.getElementById('copySqlBtn'),
    explainSqlBtn: document.getElementById('explainSqlBtn'),
    statsBar: document.getElementById('statsBar'),
    rowCount: document.getElementById('rowCount'),
    genTime: document.getElementById('genTime'),
    execTime: document.getElementById('execTime'),
    totalTime: document.getElementById('totalTime'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    exportBtn: document.getElementById('exportBtn'),
    explanationCard: document.getElementById('explanationCard'),
    explanationContent: document.getElementById('explanationContent'),

    // Loading & Error
    loadingOverlay: document.getElementById('loadingOverlay'),
    errorBanner: document.getElementById('errorBanner'),
    errorMessage: document.getElementById('errorMessage'),
    errorClose: document.getElementById('errorClose'),

    // Schema View
    schemaContainer: document.getElementById('schemaContainer'),

    // History View
    historyStats: document.getElementById('historyStats'),
    historyList: document.getElementById('historyList'),
    refreshHistoryBtn: document.getElementById('refreshHistoryBtn'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),

    // Upload Modal
    uploadBtn: document.getElementById('uploadBtn'),
    uploadModal: document.getElementById('uploadModal'),
    uploadModalClose: document.getElementById('uploadModalClose'),
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadProgress: document.getElementById('uploadProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    uploadedTables: document.getElementById('uploadedTables')
};

// State
let currentResults = [];
let currentSQL = '';

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initQueryForm();
    initExamples();
    initResultActions();
    initHistoryActions();
    initUpload();
    checkHealth();
});

// ============================================
// Navigation
// ============================================
function initNavigation() {
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;

            // Update active button
            elements.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Switch view
            elements.views.forEach(v => v.classList.remove('active'));
            document.getElementById(`${view}View`).classList.add('active');

            // Load view data
            if (view === 'schema') loadSchema();
            if (view === 'history') loadHistory();
        });
    });
}

// ============================================
// Query Form
// ============================================
function initQueryForm() {
    elements.queryBtn.addEventListener('click', handleQuery);

    elements.questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleQuery();
        }
    });

    elements.errorClose.addEventListener('click', () => {
        elements.errorBanner.classList.remove('show');
    });
}

function initExamples() {
    elements.exampleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.questionInput.value = chip.dataset.query;
            elements.questionInput.focus();
        });
    });
}

async function handleQuery() {
    const question = elements.questionInput.value.trim();

    if (!question) {
        showToast('Please enter a question', 'error');
        return;
    }

    showLoading(true);
    hideError();

    try {
        const response = await fetch(`${API_BASE}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                explain: elements.explainToggle.checked
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Query failed');
        }

        displayResults(data);
        showToast('Query executed successfully', 'success');

    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// ============================================
// Results Display
// ============================================
function displayResults(data) {
    currentSQL = data.sql;
    currentResults = data.results || [];

    // Show results section
    elements.resultsSection.classList.add('show');

    // Display SQL
    elements.sqlOutput.textContent = data.sql;

    // Display stats
    elements.rowCount.textContent = data.rowCount || 0;
    elements.genTime.textContent = `${data.timing?.generation || 0}ms`;
    elements.execTime.textContent = `${data.timing?.execution || 0}ms`;
    elements.totalTime.textContent = `${data.timing?.total || 0}ms`;

    // Display table
    displayTable(data.results || []);

    // Display explanation if available
    if (data.explanation) {
        elements.explanationCard.style.display = 'block';
        // Parse basic markdown formatting
        let formatted = escapeHtml(data.explanation);
        // Bold: **text**
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Bullet points: - text
        formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        // Emojis and line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        elements.explanationContent.innerHTML = formatted;
    } else {
        elements.explanationCard.style.display = 'none';
    }

    // Scroll to results
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function displayTable(results) {
    if (!results.length) {
        elements.tableHead.innerHTML = '';
        elements.tableBody.innerHTML = '<tr><td colspan="100" style="text-align: center; color: var(--text-muted);">No results</td></tr>';
        return;
    }

    // Headers
    const columns = Object.keys(results[0]);
    elements.tableHead.innerHTML = `
    <tr>
      ${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
    </tr>
  `;

    // Rows
    elements.tableBody.innerHTML = results.map(row => `
    <tr>
      ${columns.map(col => {
        const value = row[col];
        const displayValue = value === null ? 'NULL' : escapeHtml(String(value));
        const nullClass = value === null ? 'null' : '';
        return `<td class="${nullClass}">${displayValue}</td>`;
    }).join('')}
    </tr>
  `).join('');
}

// ============================================
// Result Actions
// ============================================
function initResultActions() {
    elements.copySqlBtn.addEventListener('click', () => {
        if (currentSQL) {
            navigator.clipboard.writeText(currentSQL);
            showToast('SQL copied to clipboard', 'success');
        }
    });

    elements.explainSqlBtn.addEventListener('click', async () => {
        if (!currentSQL) return;

        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: currentSQL })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Explain plan: ' + JSON.stringify(data.explainPlan).slice(0, 100) + '...', 'info');
            }
        } catch (error) {
            showToast('Failed to get explain plan', 'error');
        } finally {
            showLoading(false);
        }
    });

    elements.exportBtn.addEventListener('click', () => {
        if (!currentResults.length) return;

        const csv = convertToCSV(currentResults);
        downloadCSV(csv, 'query-results.csv');
        showToast('Results exported to CSV', 'success');
    });
}

function convertToCSV(data) {
    if (!data.length) return '';

    const columns = Object.keys(data[0]);
    const header = columns.map(c => `"${c}"`).join(',');
    const rows = data.map(row =>
        columns.map(col => {
            const val = row[col];
            if (val === null) return '';
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
    );

    return [header, ...rows].join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// ============================================
// Schema View
// ============================================
async function loadSchema() {
    elements.schemaContainer.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const response = await fetch(`${API_BASE}/schema`);
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        displaySchema(data.schema);

    } catch (error) {
        elements.schemaContainer.innerHTML = `<p style="color: var(--error)">Failed to load schema: ${error.message}</p>`;
    }
}

function displaySchema(schema) {
    const tables = Object.entries(schema);

    if (!tables.length) {
        elements.schemaContainer.innerHTML = '<p style="color: var(--text-muted)">No tables found</p>';
        return;
    }

    elements.schemaContainer.innerHTML = tables.map(([tableName, tableInfo]) => {
        const columns = tableInfo.columns || [];

        return `
      <div class="schema-table">
        <div class="schema-table-header">
          <span class="schema-table-icon">📊</span>
          <span class="schema-table-name">${escapeHtml(tableName)}</span>
        </div>
        <div class="schema-columns">
          ${columns.map(col => `
            <div class="schema-column">
              ${col.primaryKey ? '<span class="column-pk">🔑</span>' : ''}
              <span class="column-name">${escapeHtml(col.name)}</span>
              <span class="column-type">${escapeHtml(col.type || 'unknown')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }).join('');
}

// ============================================
// History View
// ============================================
function initHistoryActions() {
    elements.refreshHistoryBtn.addEventListener('click', loadHistory);
    elements.clearHistoryBtn.addEventListener('click', async () => {
        if (!confirm('Clear all query history?')) return;

        try {
            await fetch(`${API_BASE}/history`, { method: 'DELETE' });
            loadHistory();
            showToast('History cleared', 'success');
        } catch (error) {
            showToast('Failed to clear history', 'error');
        }
    });
}

async function loadHistory() {
    elements.historyList.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const response = await fetch(`${API_BASE}/history?limit=50`);
        const data = await response.json();

        displayHistoryStats(data.stats);
        displayHistory(data.history);

    } catch (error) {
        elements.historyList.innerHTML = `<p style="color: var(--error)">Failed to load history: ${error.message}</p>`;
    }
}

function displayHistoryStats(stats) {
    elements.historyStats.innerHTML = `
    <div class="stat">
      <span class="stat-label">Total Queries</span>
      <span class="stat-value">${stats.total || 0}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Success Rate</span>
      <span class="stat-value">${stats.successRate || '0%'}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Avg. Gen Time</span>
      <span class="stat-value">${stats.avgGenerationTimeMs || 0}ms</span>
    </div>
    <div class="stat">
      <span class="stat-label">Avg. Exec Time</span>
      <span class="stat-value">${stats.avgExecutionTimeMs || 0}ms</span>
    </div>
  `;
}

function displayHistory(history) {
    if (!history.length) {
        elements.historyList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No query history yet</p>';
        return;
    }

    elements.historyList.innerHTML = history.map(item => `
    <div class="history-item ${item.success ? 'success' : 'failed'}" onclick="useHistoryQuery('${escapeHtml(item.question)}')">
      <div class="history-question">${escapeHtml(item.question)}</div>
      <div class="history-meta">
        <span>${item.success ? '✅ Success' : '❌ Failed'}</span>
        <span>${item.rowCount !== undefined ? `${item.rowCount} rows` : ''}</span>
        <span>${item.totalTimeMs || 0}ms</span>
        <span>${formatTime(item.timestamp)}</span>
      </div>
      ${item.sql ? `<div class="history-sql">${escapeHtml(item.sql)}</div>` : ''}
      ${item.error ? `<div class="history-sql" style="color: var(--error)">${escapeHtml(item.error)}</div>` : ''}
    </div>
  `).join('');
}

function useHistoryQuery(question) {
    elements.questionInput.value = question;
    document.querySelector('[data-view="query"]').click();
    elements.questionInput.focus();
}

// ============================================
// Health Check
// ============================================
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();

        if (data.database?.healthy) {
            elements.statusIndicator.classList.add('connected');
            elements.statusIndicator.classList.remove('error');
            elements.statusText.textContent = `Connected (${data.database.type})`;
        } else {
            throw new Error('Database not healthy');
        }
    } catch (error) {
        elements.statusIndicator.classList.add('error');
        elements.statusIndicator.classList.remove('connected');
        elements.statusText.textContent = 'Disconnected';
    }
}

// ============================================
// Utility Functions
// ============================================
function showLoading(show) {
    if (show) {
        elements.loadingOverlay.classList.add('show');
    } else {
        elements.loadingOverlay.classList.remove('show');
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorBanner.classList.add('show');
}

function hideError() {
    elements.errorBanner.classList.remove('show');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}

// Make global for onclick handlers
window.useHistoryQuery = useHistoryQuery;
window.deleteUploadedTable = deleteUploadedTable;

// ============================================
// File Upload
// ============================================
function initUpload() {
    // Open modal
    elements.uploadBtn.addEventListener('click', () => {
        elements.uploadModal.classList.add('show');
        loadUploadedTables();
    });

    // Close modal
    elements.uploadModalClose.addEventListener('click', closeUploadModal);
    elements.uploadModal.addEventListener('click', (e) => {
        if (e.target === elements.uploadModal) closeUploadModal();
    });

    // Click to upload
    elements.uploadZone.addEventListener('click', () => {
        elements.fileInput.click();
    });

    // File selected
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    });

    // Drag and drop
    elements.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.add('drag-over');
    });

    elements.uploadZone.addEventListener('dragleave', () => {
        elements.uploadZone.classList.remove('drag-over');
    });

    elements.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            uploadFile(e.dataTransfer.files[0]);
        }
    });
}

function closeUploadModal() {
    elements.uploadModal.classList.remove('show');
    elements.uploadProgress.style.display = 'none';
    elements.fileInput.value = '';
}

async function uploadFile(file) {
    // Show progress
    elements.uploadProgress.style.display = 'block';
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = `Uploading ${file.name}...`;

    const formData = new FormData();
    formData.append('file', file);

    try {
        // Simulate progress
        elements.progressFill.style.width = '30%';
        elements.progressText.textContent = 'Parsing file...';

        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        elements.progressFill.style.width = '70%';
        elements.progressText.textContent = 'Creating table...';

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }

        elements.progressFill.style.width = '100%';
        elements.progressText.textContent = '✓ Upload complete!';

        showToast(`File uploaded! Table "${data.table.name}" created with ${data.table.rowCount} rows`, 'success');

        // Reload uploaded tables list
        loadUploadedTables();

        // Clear cache to show new table in schema
        await fetch(`${API_BASE}/cache/clear`, { method: 'POST' });

        // Reset progress after delay
        setTimeout(() => {
            elements.uploadProgress.style.display = 'none';
            elements.progressFill.style.width = '0%';
        }, 2000);

    } catch (error) {
        elements.progressFill.style.width = '0%';
        elements.progressText.textContent = '✗ Upload failed';
        showToast(error.message, 'error');

        setTimeout(() => {
            elements.uploadProgress.style.display = 'none';
        }, 3000);
    }

    elements.fileInput.value = '';
}

async function loadUploadedTables() {
    try {
        const response = await fetch(`${API_BASE}/upload`);
        const data = await response.json();

        if (!data.success) return;

        if (data.uploadedTables.length === 0) {
            elements.uploadedTables.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No uploaded files yet</p>';
            return;
        }

        elements.uploadedTables.innerHTML = `
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: var(--space-sm);">Uploaded Tables:</p>
            ${data.uploadedTables.map(table => `
                <div class="uploaded-table-item">
                    <span class="uploaded-table-name">${escapeHtml(table)}</span>
                    <button class="delete-table-btn" onclick="deleteUploadedTable('${escapeHtml(table)}')">Delete</button>
                </div>
            `).join('')}
        `;

    } catch (error) {
        console.error('Failed to load uploaded tables:', error);
    }
}

async function deleteUploadedTable(tableName) {
    if (!confirm(`Delete table "${tableName}"?`)) return;

    try {
        const response = await fetch(`${API_BASE}/upload/${encodeURIComponent(tableName)}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Delete failed');
        }

        showToast(`Table "${tableName}" deleted`, 'success');
        loadUploadedTables();

    } catch (error) {
        showToast(error.message, 'error');
    }
}
