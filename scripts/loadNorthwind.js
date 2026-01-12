/**
 * Load Northwind SQL file into PostgreSQL
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function loadNorthwind() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('❌ DATABASE_URL is required');
        process.exit(1);
    }

    const sqlPath = path.join(__dirname, '..', '..', 'northwind.postgre.sql');

    if (!fs.existsSync(sqlPath)) {
        console.error(`❌ SQL file not found: ${sqlPath}`);
        process.exit(1);
    }

    console.log('🚀 Loading Northwind database...');
    console.log(`📄 SQL file: ${sqlPath}`);

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Read SQL file
        let sql = fs.readFileSync(sqlPath, 'utf8');

        // Filter out problematic lines for cloud PostgreSQL
        sql = sql.split('\n').filter(line => {
            const lower = line.toLowerCase();
            return !lower.includes('owner to postgres') &&
                !lower.includes('owner: postgres') &&
                !lower.includes('default_with_oids') &&
                !lower.includes('create extension') &&
                !lower.includes('comment on extension') &&
                !lower.includes('revoke all on schema') &&
                !lower.includes('grant all on schema');
        }).join('\n');

        // Drop existing tables first (to allow re-import)
        console.log('🗑️  Dropping existing tables...');
        const dropStatements = [
            'DROP TABLE IF EXISTS order_details CASCADE',
            'DROP TABLE IF EXISTS orders CASCADE',
            'DROP TABLE IF EXISTS products CASCADE',
            'DROP TABLE IF EXISTS suppliers CASCADE',
            'DROP TABLE IF EXISTS categories CASCADE',
            'DROP TABLE IF EXISTS customers CASCADE',
            'DROP TABLE IF EXISTS employees CASCADE',
            'DROP TABLE IF EXISTS employeeterritories CASCADE',
            'DROP TABLE IF EXISTS territories CASCADE',
            'DROP TABLE IF EXISTS region CASCADE',
            'DROP TABLE IF EXISTS shippers CASCADE',
            'DROP TABLE IF EXISTS shippers_tmp CASCADE',
            'DROP TABLE IF EXISTS customercustomerdemo CASCADE',
            'DROP TABLE IF EXISTS customerdemographics CASCADE',
            'DROP TABLE IF EXISTS usstates CASCADE'
        ];

        for (const stmt of dropStatements) {
            try {
                await pool.query(stmt);
            } catch (e) {
                // Ignore drop errors
            }
        }

        // Execute SQL file
        console.log('📦 Creating tables and inserting data...');
        await pool.query(sql);

        // Verify
        const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM categories) as categories,
        (SELECT COUNT(*) FROM customers) as customers,
        (SELECT COUNT(*) FROM employees) as employees,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COUNT(*) FROM products) as products
    `);

        const c = counts.rows[0];
        console.log('\n📊 Database loaded:');
        console.log(`   Categories: ${c.categories}`);
        console.log(`   Customers: ${c.customers}`);
        console.log(`   Employees: ${c.employees}`);
        console.log(`   Orders: ${c.orders}`);
        console.log(`   Products: ${c.products}`);

        console.log('\n✅ Northwind database loaded successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

loadNorthwind();
