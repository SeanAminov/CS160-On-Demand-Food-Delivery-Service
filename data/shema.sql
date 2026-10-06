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

INSERT INTO Products
    (name, category, description, price, weight, active)
VALUES
    ('Organic Fuji Apples', 'Fruits',
     'Crisp, sweet apples sold by the pound.', 3.49, 1.00, TRUE),
    ('Bananas', 'Fruits',
     'Fresh bananas sold by the pound.', 1.29, 1.00, TRUE),
    ('Whole Milk', 'Dairy',
     'One gallon of whole milk.', 4.99, 8.60, TRUE);

INSERT INTO Inventory (product_id, quantity, reorder_level)
SELECT product_id, 120, 20
FROM Products
WHERE name = 'Organic Fuji Apples'
  AND NOT EXISTS (
      SELECT 1 FROM Inventory i WHERE i.product_id = Products.product_id
  );

INSERT INTO Inventory (product_id, quantity, reorder_level)
SELECT product_id, 80, 15
FROM Products
WHERE name = 'Bananas'
  AND NOT EXISTS (
      SELECT 1 FROM Inventory i WHERE i.product_id = Products.product_id
  );

INSERT INTO Inventory (product_id, quantity, reorder_level)
SELECT product_id, 40, 10
FROM Products
WHERE name = 'Whole Milk'
  AND NOT EXISTS (
      SELECT 1 FROM Inventory i WHERE i.product_id = Products.product_id
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
