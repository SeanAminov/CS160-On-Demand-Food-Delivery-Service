CREATE DATABASE IF NOT EXISTS food_delivery_db;
USE food_delivery_db;

CREATE TABLE IF NOT EXISTS Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'employee', 'manager') NOT NULL DEFAULT 'customer',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stripe_customer_id VARCHAR(255) UNIQUE NULL
);

CREATE TABLE IF NOT EXISTS Products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Other',
    description TEXT NULL,
    price DECIMAL(10,2) NOT NULL,
    weight DECIMAL(8,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL UNIQUE,
    quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 10,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    total_weight DECIMAL(8,2) NOT NULL,
    delivery_fee DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    delivery_address VARCHAR(255) NOT NULL,
    delivery_lat DECIMAL(9,6) NOT NULL,
    delivery_lng DECIMAL(9,6) NOT NULL,
    status ENUM(
        'Pending', 'Preparing', 'Staged', 'Out for Delivery',
        'Delivered', 'Failed', 'Cancelled'
    ) NOT NULL DEFAULT 'Pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE IF NOT EXISTS OrderItems (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    unit_weight DECIMAL(8,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id)
        ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);

CREATE TABLE IF NOT EXISTS Deliveries (
    delivery_id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_status ENUM(
        'Planned', 'Out for Delivery', 'Completed', 'Failed'
    ) NOT NULL DEFAULT 'Planned',
    route_information TEXT NULL,
    total_weight DECIMAL(8,2) NOT NULL,
    order_count INT NOT NULL,
    estimated_duration INT NULL,
    total_distance DECIMAL(10,2) NULL,
    departure_time DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NULL,
    stripe_transaction_id VARCHAR(255) NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(50) NOT NULL,
    transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS DeliveryOrders (
    delivery_order_id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_id INT NOT NULL,
    order_id INT NOT NULL UNIQUE,
    stop_sequence INT NULL,
    estimated_arrival DATETIME NULL,
    FOREIGN KEY (delivery_id) REFERENCES Deliveries(delivery_id)
        ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id INT NULL,
    message VARCHAR(255) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Carts (
    cart_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CartItems (
    cart_item_id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    FOREIGN KEY (cart_id) REFERENCES Carts(cart_id)
        ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(product_id),
    UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS PasswordResetTokens (
    token_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE
);

-- Seed products. Each statement is guarded so this file can be run more than once
-- without creating duplicate products.
INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Organic Fuji Apples', 'Fruits',
       'Crisp, sweet apples sold by the pound.', 3.49, 1.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Organic Fuji Apples');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Bananas', 'Fruits',
       'Fresh bananas sold by the pound.', 1.29, 1.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Bananas');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Whole Milk', 'Dairy',
       'One gallon of whole milk.', 4.99, 8.60, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Whole Milk');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Large Brown Eggs', 'Dairy',
       'One dozen large brown eggs.', 4.49, 1.50, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Large Brown Eggs');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Cheddar Cheese', 'Dairy',
       'Sharp cheddar cheese block.', 5.99, 0.50, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Cheddar Cheese');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Chicken Breast', 'Meat',
       'Boneless, skinless chicken breast.', 8.99, 2.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Chicken Breast');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Ground Beef', 'Meat',
       'Fresh ground beef for burgers and meals.', 7.99, 1.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Ground Beef');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Brown Rice', 'Pantry',
       'Long-grain brown rice.', 5.49, 2.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Brown Rice');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Spaghetti Pasta', 'Pantry',
       'Classic dried spaghetti pasta.', 2.49, 1.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Spaghetti Pasta');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Tomato Pasta Sauce', 'Pantry',
       'Traditional tomato sauce for pasta.', 3.29, 1.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Tomato Pasta Sauce');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Potato Chips', 'Snacks',
       'Crispy salted potato chips.', 3.99, 0.75, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Potato Chips');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Granola Bars', 'Snacks',
       'Chewy oat and honey granola bars.', 4.99, 0.75, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Granola Bars');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Orange Juice', 'Beverages',
       '100% orange juice.', 5.99, 6.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Orange Juice');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Bottled Water', 'Beverages',
       'Pack of purified bottled water.', 4.49, 12.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Bottled Water');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Frozen Cheese Pizza', 'Frozen Foods',
       'Four-cheese pizza ready to bake.', 6.99, 1.50, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Frozen Cheese Pizza');

INSERT INTO Products (name, category, description, price, weight, active)
SELECT 'Frozen Mixed Vegetables', 'Frozen Foods',
       'Frozen mix of peas, carrots, corn, and green beans.', 3.49, 1.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Products WHERE name = 'Frozen Mixed Vegetables');

-- Add one inventory row for every seeded product.
INSERT INTO Inventory (product_id, quantity, reorder_level)
SELECT p.product_id,
       CASE p.name
           WHEN 'Organic Fuji Apples' THEN 120
           WHEN 'Bananas' THEN 80
           WHEN 'Whole Milk' THEN 40
           WHEN 'Large Brown Eggs' THEN 60
           WHEN 'Cheddar Cheese' THEN 35
           WHEN 'Chicken Breast' THEN 50
           WHEN 'Ground Beef' THEN 45
           WHEN 'Brown Rice' THEN 70
           WHEN 'Spaghetti Pasta' THEN 90
           WHEN 'Tomato Pasta Sauce' THEN 65
           WHEN 'Potato Chips' THEN 55
           WHEN 'Granola Bars' THEN 75
           WHEN 'Orange Juice' THEN 40
           WHEN 'Bottled Water' THEN 100
           WHEN 'Frozen Cheese Pizza' THEN 30
           WHEN 'Frozen Mixed Vegetables' THEN 45
       END AS quantity,
       CASE p.name
           WHEN 'Organic Fuji Apples' THEN 20
           WHEN 'Bananas' THEN 15
           WHEN 'Whole Milk' THEN 10
           ELSE 10
       END AS reorder_level
FROM Products p
LEFT JOIN Inventory i ON i.product_id = p.product_id
WHERE i.product_id IS NULL
  AND p.name IN (
      'Organic Fuji Apples', 'Bananas', 'Whole Milk', 'Large Brown Eggs',
      'Cheddar Cheese', 'Chicken Breast', 'Ground Beef', 'Brown Rice',
      'Spaghetti Pasta', 'Tomato Pasta Sauce', 'Potato Chips', 'Granola Bars',
      'Orange Juice', 'Bottled Water', 'Frozen Cheese Pizza',
      'Frozen Mixed Vegetables'
  );

SELECT
    p.product_id,
    p.name,
    p.category,
    p.description,
    p.price,
    p.weight,
    i.quantity,
    p.active
FROM Products p
JOIN Inventory i ON p.product_id = i.product_id;
