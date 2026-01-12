/**
 * Database Initialization Script
 * Creates a sample Northwind database for testing
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'northwind.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Remove existing database
if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('🗑️  Removed existing database');
}

// Create new database
const db = new Database(DB_PATH);

console.log('📦 Creating Northwind database...');

// Create tables
db.exec(`
  -- Categories table
  CREATE TABLE Categories (
    CategoryID INTEGER PRIMARY KEY AUTOINCREMENT,
    CategoryName TEXT NOT NULL,
    Description TEXT
  );

  -- Suppliers table
  CREATE TABLE Suppliers (
    SupplierID INTEGER PRIMARY KEY AUTOINCREMENT,
    CompanyName TEXT NOT NULL,
    ContactName TEXT,
    ContactTitle TEXT,
    Address TEXT,
    City TEXT,
    Region TEXT,
    PostalCode TEXT,
    Country TEXT,
    Phone TEXT,
    Fax TEXT
  );

  -- Products table
  CREATE TABLE Products (
    ProductID INTEGER PRIMARY KEY AUTOINCREMENT,
    ProductName TEXT NOT NULL,
    SupplierID INTEGER,
    CategoryID INTEGER,
    QuantityPerUnit TEXT,
    UnitPrice REAL DEFAULT 0,
    UnitsInStock INTEGER DEFAULT 0,
    UnitsOnOrder INTEGER DEFAULT 0,
    ReorderLevel INTEGER DEFAULT 0,
    Discontinued INTEGER DEFAULT 0,
    FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID)
  );

  -- Customers table
  CREATE TABLE Customers (
    CustomerID TEXT PRIMARY KEY,
    CompanyName TEXT NOT NULL,
    ContactName TEXT,
    ContactTitle TEXT,
    Address TEXT,
    City TEXT,
    Region TEXT,
    PostalCode TEXT,
    Country TEXT,
    Phone TEXT,
    Fax TEXT
  );

  -- Employees table
  CREATE TABLE Employees (
    EmployeeID INTEGER PRIMARY KEY AUTOINCREMENT,
    LastName TEXT NOT NULL,
    FirstName TEXT NOT NULL,
    Title TEXT,
    TitleOfCourtesy TEXT,
    BirthDate TEXT,
    HireDate TEXT,
    Address TEXT,
    City TEXT,
    Region TEXT,
    PostalCode TEXT,
    Country TEXT,
    HomePhone TEXT,
    Extension TEXT,
    ReportsTo INTEGER,
    FOREIGN KEY (ReportsTo) REFERENCES Employees(EmployeeID)
  );

  -- Shippers table
  CREATE TABLE Shippers (
    ShipperID INTEGER PRIMARY KEY AUTOINCREMENT,
    CompanyName TEXT NOT NULL,
    Phone TEXT
  );

  -- Orders table
  CREATE TABLE Orders (
    OrderID INTEGER PRIMARY KEY AUTOINCREMENT,
    CustomerID TEXT,
    EmployeeID INTEGER,
    OrderDate TEXT,
    RequiredDate TEXT,
    ShippedDate TEXT,
    ShipVia INTEGER,
    Freight REAL DEFAULT 0,
    ShipName TEXT,
    ShipAddress TEXT,
    ShipCity TEXT,
    ShipRegion TEXT,
    ShipPostalCode TEXT,
    ShipCountry TEXT,
    FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID),
    FOREIGN KEY (ShipVia) REFERENCES Shippers(ShipperID)
  );

  -- Order Details table
  CREATE TABLE OrderDetails (
    OrderID INTEGER,
    ProductID INTEGER,
    UnitPrice REAL NOT NULL,
    Quantity INTEGER NOT NULL DEFAULT 1,
    Discount REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (OrderID, ProductID),
    FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
    FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
  );

  -- Create indexes
  CREATE INDEX idx_products_category ON Products(CategoryID);
  CREATE INDEX idx_products_supplier ON Products(SupplierID);
  CREATE INDEX idx_orders_customer ON Orders(CustomerID);
  CREATE INDEX idx_orders_employee ON Orders(EmployeeID);
  CREATE INDEX idx_orderdetails_product ON OrderDetails(ProductID);
`);

console.log('✅ Tables created');

// Insert Categories
db.exec(`
  INSERT INTO Categories (CategoryName, Description) VALUES
  ('Beverages', 'Soft drinks, coffees, teas, beers, and ales'),
  ('Condiments', 'Sweet and savory sauces, relishes, spreads, and seasonings'),
  ('Confections', 'Desserts, candies, and sweet breads'),
  ('Dairy Products', 'Cheeses and milk products'),
  ('Grains/Cereals', 'Breads, crackers, pasta, and cereal'),
  ('Meat/Poultry', 'Prepared meats and poultry products'),
  ('Produce', 'Dried fruit and bean curd'),
  ('Seafood', 'Seaweed and fish products');
`);

// Insert Suppliers
db.exec(`
  INSERT INTO Suppliers (CompanyName, ContactName, ContactTitle, City, Country, Phone) VALUES
  ('Exotic Liquids', 'Charlotte Cooper', 'Purchasing Manager', 'London', 'UK', '(171) 555-2222'),
  ('New Orleans Cajun Delights', 'Shelley Burke', 'Order Administrator', 'New Orleans', 'USA', '(100) 555-4822'),
  ('Grandma Kelly''s Homestead', 'Regina Murphy', 'Sales Representative', 'Ann Arbor', 'USA', '(313) 555-5735'),
  ('Tokyo Traders', 'Yoshi Nagase', 'Marketing Manager', 'Tokyo', 'Japan', '(03) 3555-5011'),
  ('Cooperativa de Quesos', 'Antonio del Valle', 'Export Administrator', 'Oviedo', 'Spain', '(98) 598 76 54'),
  ('Mayumi''s', 'Mayumi Ohno', 'Marketing Representative', 'Osaka', 'Japan', '(06) 431-7877'),
  ('Pavlova Ltd.', 'Ian Devling', 'Marketing Manager', 'Melbourne', 'Australia', '(03) 444-2343'),
  ('Specialty Biscuits Ltd.', 'Peter Wilson', 'Sales Representative', 'Manchester', 'UK', '(161) 555-4448');
`);

// Insert Products
db.exec(`
  INSERT INTO Products (ProductName, SupplierID, CategoryID, UnitPrice, UnitsInStock, Discontinued) VALUES
  ('Chai', 1, 1, 18.00, 39, 0),
  ('Chang', 1, 1, 19.00, 17, 0),
  ('Aniseed Syrup', 1, 2, 10.00, 13, 0),
  ('Chef Anton''s Cajun Seasoning', 2, 2, 22.00, 53, 0),
  ('Chef Anton''s Gumbo Mix', 2, 2, 21.35, 0, 1),
  ('Grandma''s Boysenberry Spread', 3, 2, 25.00, 120, 0),
  ('Uncle Bob''s Organic Dried Pears', 3, 7, 30.00, 15, 0),
  ('Northwoods Cranberry Sauce', 3, 2, 40.00, 6, 0),
  ('Mishi Kobe Niku', 4, 6, 97.00, 29, 1),
  ('Ikura', 4, 8, 31.00, 31, 0),
  ('Queso Cabrales', 5, 4, 21.00, 22, 0),
  ('Queso Manchego La Pastora', 5, 4, 38.00, 86, 0),
  ('Konbu', 6, 8, 6.00, 24, 0),
  ('Tofu', 6, 7, 23.25, 35, 0),
  ('Genen Shouyu', 6, 2, 15.50, 39, 0),
  ('Pavlova', 7, 3, 17.45, 29, 0),
  ('Alice Mutton', 7, 6, 39.00, 0, 1),
  ('Carnarvon Tigers', 7, 8, 62.50, 42, 0),
  ('Teatime Chocolate Biscuits', 8, 3, 9.20, 25, 0),
  ('Sir Rodney''s Marmalade', 8, 3, 81.00, 40, 0);
`);

// Insert Customers
db.exec(`
  INSERT INTO Customers (CustomerID, CompanyName, ContactName, ContactTitle, City, Country, Phone) VALUES
  ('ALFKI', 'Alfreds Futterkiste', 'Maria Anders', 'Sales Representative', 'Berlin', 'Germany', '030-0074321'),
  ('ANATR', 'Ana Trujillo Emparedados', 'Ana Trujillo', 'Owner', 'México D.F.', 'Mexico', '(5) 555-4729'),
  ('ANTON', 'Antonio Moreno Taquería', 'Antonio Moreno', 'Owner', 'México D.F.', 'Mexico', '(5) 555-3932'),
  ('AROUT', 'Around the Horn', 'Thomas Hardy', 'Sales Representative', 'London', 'UK', '(171) 555-7788'),
  ('BERGS', 'Berglunds snabbköp', 'Christina Berglund', 'Order Administrator', 'Luleå', 'Sweden', '0921-12 34 65'),
  ('BLAUS', 'Blauer See Delikatessen', 'Hanna Moos', 'Sales Representative', 'Mannheim', 'Germany', '0621-08460'),
  ('BLONP', 'Blondesddsl père et fils', 'Frédérique Citeaux', 'Marketing Manager', 'Strasbourg', 'France', '88.60.15.31'),
  ('BOLID', 'Bólido Comidas preparadas', 'Martín Sommer', 'Owner', 'Madrid', 'Spain', '(91) 555 22 82'),
  ('BONAP', 'Bon app''', 'Laurence Lebihan', 'Owner', 'Marseille', 'France', '91.24.45.40'),
  ('BOTTM', 'Bottom-Dollar Markets', 'Elizabeth Lincoln', 'Accounting Manager', 'Tsawassen', 'Canada', '(604) 555-4729'),
  ('BSBEV', 'B''s Beverages', 'Victoria Ashworth', 'Sales Representative', 'London', 'UK', '(171) 555-1212'),
  ('CACTU', 'Cactus Comidas para llevar', 'Patricio Simpson', 'Sales Agent', 'Buenos Aires', 'Argentina', '(1) 135-5555'),
  ('CENTC', 'Centro comercial Moctezuma', 'Francisco Chang', 'Marketing Manager', 'México D.F.', 'Mexico', '(5) 555-3392'),
  ('CHOPS', 'Chop-suey Chinese', 'Yang Wang', 'Owner', 'Bern', 'Switzerland', '0452-076545'),
  ('COMMI', 'Comércio Mineiro', 'Pedro Afonso', 'Sales Associate', 'Sao Paulo', 'Brazil', '(11) 555-7647');
`);

// Insert Employees
db.exec(`
  INSERT INTO Employees (FirstName, LastName, Title, HireDate, City, Country, ReportsTo) VALUES
  ('Nancy', 'Davolio', 'Sales Representative', '1992-05-01', 'Seattle', 'USA', 2),
  ('Andrew', 'Fuller', 'Vice President Sales', '1992-08-14', 'Tacoma', 'USA', NULL),
  ('Janet', 'Leverling', 'Sales Representative', '1992-04-01', 'Kirkland', 'USA', 2),
  ('Margaret', 'Peacock', 'Sales Representative', '1993-05-03', 'Redmond', 'USA', 2),
  ('Steven', 'Buchanan', 'Sales Manager', '1993-10-17', 'London', 'UK', 2),
  ('Michael', 'Suyama', 'Sales Representative', '1993-10-17', 'London', 'UK', 5),
  ('Robert', 'King', 'Sales Representative', '1994-01-02', 'London', 'UK', 5),
  ('Laura', 'Callahan', 'Inside Sales Coordinator', '1994-03-05', 'Seattle', 'USA', 2),
  ('Anne', 'Dodsworth', 'Sales Representative', '1994-11-15', 'London', 'UK', 5);
`);

// Insert Shippers
db.exec(`
  INSERT INTO Shippers (CompanyName, Phone) VALUES
  ('Speedy Express', '(503) 555-9831'),
  ('United Package', '(503) 555-3199'),
  ('Federal Shipping', '(503) 555-9931');
`);

// Insert Orders
db.exec(`
  INSERT INTO Orders (CustomerID, EmployeeID, OrderDate, RequiredDate, ShippedDate, ShipVia, Freight, ShipCity, ShipCountry) VALUES
  ('ALFKI', 1, '2024-01-04', '2024-02-01', '2024-01-10', 1, 29.46, 'Berlin', 'Germany'),
  ('ANATR', 2, '2024-01-05', '2024-02-02', '2024-01-12', 2, 1.61, 'México D.F.', 'Mexico'),
  ('ANTON', 3, '2024-01-06', '2024-02-03', '2024-01-13', 1, 45.00, 'México D.F.', 'Mexico'),
  ('AROUT', 4, '2024-01-07', '2024-02-04', '2024-01-14', 3, 11.61, 'London', 'UK'),
  ('BERGS', 1, '2024-01-08', '2024-02-05', '2024-01-15', 2, 65.83, 'Luleå', 'Sweden'),
  ('BLAUS', 2, '2024-01-09', '2024-02-06', '2024-01-16', 1, 8.50, 'Mannheim', 'Germany'),
  ('BLONP', 3, '2024-01-10', '2024-02-07', '2024-01-17', 3, 22.98, 'Strasbourg', 'France'),
  ('BOLID', 4, '2024-01-11', '2024-02-08', '2024-01-18', 2, 13.97, 'Madrid', 'Spain'),
  ('BONAP', 1, '2024-01-12', '2024-02-09', '2024-01-19', 1, 25.22, 'Marseille', 'France'),
  ('BOTTM', 2, '2024-01-13', '2024-02-10', '2024-01-20', 3, 59.25, 'Tsawassen', 'Canada'),
  ('BSBEV', 3, '2024-01-14', '2024-02-11', '2024-01-21', 2, 48.29, 'London', 'UK'),
  ('CACTU', 4, '2024-01-15', '2024-02-12', '2024-01-22', 1, 17.68, 'Buenos Aires', 'Argentina'),
  ('CENTC', 1, '2024-01-16', '2024-02-13', '2024-01-23', 3, 81.91, 'México D.F.', 'Mexico'),
  ('CHOPS', 2, '2024-01-17', '2024-02-14', '2024-01-24', 2, 34.56, 'Bern', 'Switzerland'),
  ('COMMI', 3, '2024-01-18', '2024-02-15', '2024-01-25', 1, 18.44, 'Sao Paulo', 'Brazil'),
  ('ALFKI', 4, '2024-02-01', '2024-03-01', '2024-02-08', 2, 38.25, 'Berlin', 'Germany'),
  ('ANATR', 1, '2024-02-05', '2024-03-05', '2024-02-12', 1, 27.50, 'México D.F.', 'Mexico'),
  ('AROUT', 2, '2024-02-10', '2024-03-10', '2024-02-17', 3, 55.25, 'London', 'UK'),
  ('BERGS', 3, '2024-02-15', '2024-03-15', '2024-02-22', 2, 72.00, 'Luleå', 'Sweden'),
  ('BONAP', 4, '2024-02-20', '2024-03-20', '2024-02-27', 1, 33.75, 'Marseille', 'France');
`);

// Insert Order Details
db.exec(`
  INSERT INTO OrderDetails (OrderID, ProductID, UnitPrice, Quantity, Discount) VALUES
  (1, 1, 18.00, 12, 0),
  (1, 2, 19.00, 10, 0),
  (1, 3, 10.00, 5, 0),
  (2, 4, 22.00, 9, 0.15),
  (2, 5, 21.35, 40, 0.15),
  (3, 6, 25.00, 10, 0),
  (3, 7, 30.00, 35, 0),
  (4, 8, 40.00, 15, 0.05),
  (4, 9, 97.00, 6, 0.05),
  (5, 10, 31.00, 20, 0),
  (5, 11, 21.00, 42, 0.1),
  (6, 12, 38.00, 5, 0),
  (6, 13, 6.00, 24, 0),
  (7, 14, 23.25, 18, 0),
  (7, 15, 15.50, 20, 0),
  (8, 16, 17.45, 15, 0.05),
  (8, 17, 39.00, 21, 0),
  (9, 18, 62.50, 10, 0),
  (9, 19, 9.20, 30, 0.1),
  (10, 20, 81.00, 4, 0),
  (10, 1, 18.00, 10, 0),
  (11, 2, 19.00, 16, 0.05),
  (11, 3, 10.00, 12, 0),
  (12, 4, 22.00, 15, 0),
  (12, 5, 21.35, 6, 0.1),
  (13, 6, 25.00, 50, 0.15),
  (13, 7, 30.00, 10, 0),
  (14, 8, 40.00, 20, 0),
  (14, 9, 97.00, 2, 0.05),
  (15, 10, 31.00, 15, 0),
  (15, 11, 21.00, 25, 0),
  (16, 1, 18.00, 20, 0.1),
  (16, 12, 38.00, 8, 0),
  (17, 2, 19.00, 25, 0),
  (17, 14, 23.25, 10, 0.05),
  (18, 3, 10.00, 30, 0),
  (18, 16, 17.45, 12, 0),
  (19, 4, 22.00, 40, 0.1),
  (19, 18, 62.50, 5, 0),
  (20, 5, 21.35, 20, 0),
  (20, 20, 81.00, 3, 0.05);
`);

// Verify counts
const counts = {
    Categories: db.prepare('SELECT COUNT(*) as count FROM Categories').get().count,
    Suppliers: db.prepare('SELECT COUNT(*) as count FROM Suppliers').get().count,
    Products: db.prepare('SELECT COUNT(*) as count FROM Products').get().count,
    Customers: db.prepare('SELECT COUNT(*) as count FROM Customers').get().count,
    Employees: db.prepare('SELECT COUNT(*) as count FROM Employees').get().count,
    Shippers: db.prepare('SELECT COUNT(*) as count FROM Shippers').get().count,
    Orders: db.prepare('SELECT COUNT(*) as count FROM Orders').get().count,
    OrderDetails: db.prepare('SELECT COUNT(*) as count FROM OrderDetails').get().count
};

console.log('\n📊 Database populated:');
for (const [table, count] of Object.entries(counts)) {
    console.log(`   ${table}: ${count} rows`);
}

db.close();

console.log(`\n✅ Northwind database created at: ${DB_PATH}`);
console.log('🚀 Run "npm start" to start the server');
