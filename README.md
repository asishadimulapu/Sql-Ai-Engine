# Universal SQL AI Engine

> 🚀 Production-ready AI-powered SQL query generator with dynamic schema introspection

Transform natural language questions into safe, optimized SQL queries. Works with **any database** - SQLite, MySQL, or PostgreSQL.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🧠 **Dynamic Schema** | Auto-introspects database schema - no hardcoding |
| 🔒 **Safe Queries** | Only SELECT queries allowed - SQL injection protected |
| 🎯 **Multi-Database** | SQLite, MySQL, PostgreSQL support |
| ⚡ **Fast** | LRU schema caching for performance |
| 🔐 **Secure** | JWT auth, rate limiting, input validation |
| 📊 **Analytics** | Query history and execution stats |
| 🎨 **Modern UI** | Premium glassmorphism dashboard |

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd c:\Asish-Projects\sql-ai
npm install
```

### 2. Initialize Sample Database
```bash
npm run init-db
```

### 3. Configure Environment
Edit `.env` and add your Groq API key:
```env
GROQ_API_KEY=your-groq-api-key-here
```
Get your free API key at https://console.groq.com/keys

### 4. Start Server
```bash
npm start
```

### 5. Open Dashboard
Navigate to `http://localhost:3000`

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/query` | POST | Generate & execute SQL from question |
| `/api/generate` | POST | Generate SQL only (no execution) |
| `/api/execute` | POST | Execute provided SQL |
| `/api/schema` | GET | Get database schema |
| `/api/explain` | POST | Get query explain plan |
| `/api/history` | GET | Get query history |
| `/api/health` | GET | Health check |

### Example Request
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Show top 5 products by price"}'
```

### Example Response
```json
{
  "success": true,
  "sql": "SELECT ProductName, UnitPrice FROM Products ORDER BY UnitPrice DESC LIMIT 5;",
  "results": [...],
  "rowCount": 5,
  "timing": {
    "generation": 1234,
    "execution": 5,
    "total": 1239
  }
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `DB_TYPE` | sqlite | Database type (sqlite, mysql, postgres) |
| `DATABASE_URL` | - | PostgreSQL connection string (Azure, Neon, etc.) |
| `SQLITE_PATH` | ./data/northwind.db | SQLite database path |
| `GROQ_API_KEY` | - | Groq AI API key |
| `AUTH_ENABLED` | false | Enable JWT auth |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per minute |

### Using Different Databases

**MySQL:**
```env
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=secret
MYSQL_DATABASE=mydb
```

**PostgreSQL (Recommended):**
```env
DB_TYPE=postgres
# Option 1: Connection String (works with Azure, Neon, Render, etc.)
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require

# Option 2: Individual settings (legacy)
# PG_HOST=localhost
# PG_PORT=5432
# PG_USER=postgres
# PG_PASSWORD=secret
# PG_DATABASE=mydb
```

**Azure Database for PostgreSQL:**
```env
DB_TYPE=postgres
# Format: postgresql://username%40servername:password@servername.database.windows.net:5432/database?sslmode=require
DATABASE_URL=postgresql://admin%40myserver:MyP@ssw0rd@myserver.database.windows.net:5432/mydb?sslmode=require
```
Note: `%40` is the URL-encoded `@` in the username.

## 🏗️ Architecture

```
sql-ai/
├── server.js           # Express server entry
├── schema/
│   └── introspect.js   # Schema introspection (multi-DB)
├── prompts/
│   └── sqlPrompt.js    # Dynamic AI prompt builder
├── ai/
│   └── openrouter.js   # OpenRouter API client
├── services/
│   └── sqlService.js   # Core SQL generation & execution
├── middleware/
│   ├── auth.js         # JWT authentication
│   ├── rateLimit.js    # Rate limiting
│   └── validator.js    # Input validation
├── routes/
│   └── api.js          # REST API endpoints
├── utils/
│   ├── cache.js        # LRU schema cache
│   └── logger.js       # Winston logging
└── public/             # Frontend dashboard
```

## 🔒 Security

- **SQL Injection Protection**: All queries validated before execution
- **SELECT Only**: Only read operations allowed
- **Rate Limiting**: Configurable request limits
- **JWT Authentication**: Optional token-based auth
- **Input Validation**: Strict validation on all inputs
- **XSS Prevention**: Output sanitization

## 📜 License

MIT
