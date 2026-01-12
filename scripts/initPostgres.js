/**
 * PostgreSQL Database Initialization Script
 * Creates the Northwind schema and sample data for production deployment
 */

const { Pool } = require('pg');

async function initPostgresDB() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('❌ DATABASE_URL environment variable is required');
        process.exit(1);
    }

    console.log('🚀 Initializing PostgreSQL database...\n');

    const pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Connected to PostgreSQL\n');

        // Create tables
        console.log('📦 Creating tables...');

        await pool.query(`
      CREATE TABLE IF NOT EXISTS Categories (
        CategoryID SERIAL PRIMARY KEY,
        CategoryName VARCHAR(100) NOT NULL,
        Description TEXT
      );

      CREATE TABLE IF NOT EXISTS Suppliers (
        SupplierID SERIAL PRIMARY KEY,
        CompanyName VARCHAR(100) NOT NULL,
        ContactName VARCHAR(100),
        ContactTitle VARCHAR(50),
        Address VARCHAR(200),
        City VARCHAR(50),
        Region VARCHAR(50),
        PostalCode VARCHAR(20),
        Country VARCHAR(50),
        Phone VARCHAR(30),
        Fax VARCHAR(30)
      );

      CREATE TABLE IF NOT EXISTS Products (
        ProductID SERIAL PRIMARY KEY,
        ProductName VARCHAR(100) NOT NULL,
        SupplierID INTEGER REFERENCES Suppliers(SupplierID),
        CategoryID INTEGER REFERENCES Categories(CategoryID),
        QuantityPerUnit VARCHAR(50),
        UnitPrice DECIMAL(10,2) DEFAULT 0,
        UnitsInStock INTEGER DEFAULT 0,
        UnitsOnOrder INTEGER DEFAULT 0,
        ReorderLevel INTEGER DEFAULT 0,
        Discontinued INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS Customers (
        CustomerID VARCHAR(10) PRIMARY KEY,
        CompanyName VARCHAR(100) NOT NULL,
        ContactName VARCHAR(100),
        ContactTitle VARCHAR(50),
        Address VARCHAR(200),
        City VARCHAR(50),
        Region VARCHAR(50),
        PostalCode VARCHAR(20),
        Country VARCHAR(50),
        Phone VARCHAR(30),
        Fax VARCHAR(30)
      );

      CREATE TABLE IF NOT EXISTS Employees (
        EmployeeID SERIAL PRIMARY KEY,
        LastName VARCHAR(50) NOT NULL,
        FirstName VARCHAR(50) NOT NULL,
        Title VARCHAR(50),
        TitleOfCourtesy VARCHAR(10),
        BirthDate DATE,
        HireDate DATE,
        Address VARCHAR(200),
        City VARCHAR(50),
        Region VARCHAR(50),
        PostalCode VARCHAR(20),
        Country VARCHAR(50),
        HomePhone VARCHAR(30),
        Extension VARCHAR(10),
        ReportsTo INTEGER REFERENCES Employees(EmployeeID)
      );

      CREATE TABLE IF NOT EXISTS Shippers (
        ShipperID SERIAL PRIMARY KEY,
        CompanyName VARCHAR(100) NOT NULL,
        Phone VARCHAR(30)
      );

      CREATE TABLE IF NOT EXISTS Orders (
        OrderID SERIAL PRIMARY KEY,
        CustomerID VARCHAR(10) REFERENCES Customers(CustomerID),
        EmployeeID INTEGER REFERENCES Employees(EmployeeID),
        OrderDate DATE,
        RequiredDate DATE,
        ShippedDate DATE,
        ShipVia INTEGER REFERENCES Shippers(ShipperID),
        Freight DECIMAL(10,2) DEFAULT 0,
        ShipName VARCHAR(100),
        ShipAddress VARCHAR(200),
        ShipCity VARCHAR(50),
        ShipRegion VARCHAR(50),
        ShipPostalCode VARCHAR(20),
        ShipCountry VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS OrderDetails (
        OrderID INTEGER REFERENCES Orders(OrderID),
        ProductID INTEGER REFERENCES Products(ProductID),
        UnitPrice DECIMAL(10,2) NOT NULL,
        Quantity INTEGER NOT NULL DEFAULT 1,
        Discount DECIMAL(5,2) NOT NULL DEFAULT 0,
        PRIMARY KEY (OrderID, ProductID)
      );
    `);

        console.log('✅ Tables created\n');

        // Check if data exists
        const categoryCount = await pool.query('SELECT COUNT(*) FROM Categories');
        if (parseInt(categoryCount.rows[0].count) > 0) {
            console.log('ℹ️  Data already exists, skipping seed...\n');
        } else {
            console.log('🌱 Seeding sample data...');

            await pool.query(`
        INSERT INTO Categories (CategoryName, Description) VALUES
        ('Beverages', 'Soft drinks, coffees, teas, beers, and ales'),
        ('Condiments', 'Sweet and savory sauces, relishes, spreads'),
        ('Confections', 'Desserts, candies, and sweet breads'),
        ('Dairy Products', 'Cheeses and milk products'),
        ('Grains/Cereals', 'Breads, crackers, pasta, and cereal'),
        ('Meat/Poultry', 'Prepared meats and poultry products'),
        ('Produce', 'Dried fruit and bean curd'),
        ('Seafood', 'Seaweed and fish products');
      `);

            await pool.query(`
        INSERT INTO Suppliers (CompanyName, ContactName, City, Country) VALUES
        ('Exotic Liquids', 'Charlotte Cooper', 'London', 'UK'),
        ('New Orleans Cajun', 'Shelley Burke', 'New Orleans', 'USA'),
        ('Tokyo Traders', 'Yoshi Nagase', 'Tokyo', 'Japan'),
        ('Pavlova Ltd.', 'Ian Devling', 'Melbourne', 'Australia');
      `);

            await pool.query(`
        INSERT INTO Products (ProductName, SupplierID, CategoryID, UnitPrice, UnitsInStock) VALUES
        ('Chai', 1, 1, 18.00, 39),
        ('Chang', 1, 1, 19.00, 17),
        ('Aniseed Syrup', 1, 2, 10.00, 13),
        ('Pavlova', 4, 3, 17.45, 29),
        ('Ikura', 3, 8, 31.00, 31),
        ('Mishi Kobe Niku', 3, 6, 97.00, 29),
        ('Tofu', 3, 7, 23.25, 35),
        ('Konbu', 3, 8, 6.00, 24);
      `);

            await pool.query(`
        INSERT INTO Customers (CustomerID, CompanyName, ContactName, City, Country) VALUES
        ('ALFKI', 'Alfreds Futterkiste', 'Maria Anders', 'Berlin', 'Germany'),
        ('ANATR', 'Ana Trujillo', 'Ana Trujillo', 'Mexico D.F.', 'Mexico'),
        ('ANTON', 'Antonio Moreno', 'Antonio Moreno', 'Mexico D.F.', 'Mexico'),
        ('AROUT', 'Around the Horn', 'Thomas Hardy', 'London', 'UK'),
        ('BERGS', 'Berglunds snabbkop', 'Christina Berglund', 'Lulea', 'Sweden');
      `);

            await pool.query(`
        INSERT INTO Employees (FirstName, LastName, Title, City, Country) VALUES
        ('Nancy', 'Davolio', 'Sales Representative', 'Seattle', 'USA'),
        ('Andrew', 'Fuller', 'Vice President Sales', 'Tacoma', 'USA'),
        ('Janet', 'Leverling', 'Sales Representative', 'Kirkland', 'USA');
      `);

            await pool.query(`
        INSERT INTO Shippers (CompanyName, Phone) VALUES
        ('Speedy Express', '(503) 555-9831'),
        ('United Package', '(503) 555-3199'),
        ('Federal Shipping', '(503) 555-9931');
      `);

            console.log('✅ Sample data inserted\n');
        }

        // Create indexes
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON Products(CategoryID);
      CREATE INDEX IF NOT EXISTS idx_products_supplier ON Products(SupplierID);
    `);

        console.log('✅ PostgreSQL database initialized successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

initPostgresDB();
