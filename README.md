# OFS Organic Food Delivery

CS 160 Section 4, Team 1

A website where customers in downtown San Jose can order organic groceries and get them delivered by our delivery robot.

What we're using:

* Frontend: HTML, CSS, and JavaScript
* Backend: Node.js with Express
* Database: MySQL
* Logins: sessions with express-session, and passwords hashed with bcrypt
* Payments: Stripe test mode (not set up yet)
* Maps and routing: Google Maps API (not set up yet)

## How to run it

The commands are the same on Windows and Mac. The only differences are how you install things and how you open a terminal in the project folder.

### 1. Install Node.js

You need Node.js 20 or newer. To check what you have, run `node -v` in a terminal.

* Windows: download the LTS installer from https://nodejs.org and run it.
* Mac: download the LTS installer from https://nodejs.org, or if you use Homebrew, run `brew install node`.

### 2. Install MySQL

You need MySQL Server, and MySQL Workbench makes it easier to look at the data.

* Windows: download the MySQL Installer from https://dev.mysql.com/downloads/installer/ and install MySQL Server and MySQL Workbench.
* Mac: download MySQL Community Server and MySQL Workbench from https://dev.mysql.com/downloads/, or if you use Homebrew, run `brew install mysql`.

When it asks you to set a root password, write it down. You'll need it in step 6.

### 3. Get the code

Clone the repo with GitHub Desktop, or run this in a terminal:

    git clone https://github.com/SeanAminov/CS160-On-Demand-Food-Delivery-Service.git

### 4. Open a terminal in the project folder

* VS Code (Windows or Mac): open the project folder, then go to Terminal > New Terminal. It opens in the right folder.
* Windows without VS Code: open the folder in File Explorer, right click an empty spot, and choose Open in Terminal.
* Mac without VS Code: open the Terminal app, type `cd ` with a space after it, drag the project folder into the window, and press Return.

### 5. Create the database

In MySQL Workbench, click your local connection to connect, then go to File > Open SQL Script, pick `data/schema.sql`, and click the lightning bolt to run it. This creates the `food_delivery_db` database, all the tables, and the sample products.

It's safe to run again after someone changes the schema. It won't make duplicate products.

### 6. Make your .env file

Make a file named `.env` in the main project folder (next to `server.js`) with this in it:

    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=your MySQL root password
    DB_NAME=food_delivery_db
    DB_PORT=3306
    SESSION_SECRET=any long random text you make up

Git ignores `.env`, so it never gets uploaded. Everyone makes their own, and they don't need to match.

**What SESSION_SECRET is for:** when you log in, the server gives your browser a cookie with a session ID, and it signs that cookie using this secret. When the cookie comes back, the server checks the signature, so nobody can edit their cookie to pretend to be someone else. The secret has to stay private, which is why it goes in `.env` instead of the code. If it's missing, the server crashes the first time someone logs in. If you change it, everyone gets logged out.

Sessions are kept in the server's memory, so restarting the server also logs everyone out. That's normal.

### 7. Install and start

    npm install
    npm run dev

You only need `npm install` the first time, and again after pulling changes that add new packages.

Then go to http://localhost:3000

`npm run dev` restarts the server when you save a file. If you only changed something in the public folder, just refresh the page. If the page still looks old, press Ctrl and F5 (Command, Shift, and R on a Mac).

To stop the server, click in the terminal and press Control and C together. This is Control on a Mac too, not Command.

If you get an error saying port 3000 is already in use, the server is probably still running in another terminal. Stop that one first.

## Test accounts

Anyone who registers on the site is a customer. To test the employee and manager pages, register the accounts below with the password `12345678`, then run this in MySQL Workbench:

    UPDATE Users SET role = 'employee' WHERE email = 'employee1@gmail.com';
    UPDATE Users SET role = 'manager' WHERE email = 'manager1@gmail.com';

* `customer1@gmail.com` customer
* `employee1@gmail.com` employee
* `manager1@gmail.com` manager

Log out and back in after changing a role, since the role is saved when you log in.

## Folders

    server.js          the Express server
    db.js              the MySQL connection, using the settings in .env
    auth.js            password hashing and the login and role checks
    routes/            the API routes (users, cart, employee)
    data/schema.sql    creates the database, tables, and sample products
    public/index.html  the header, nav, and footer that every page shares
    public/css/        styles
    public/js/app.js   picks which page to show based on the URL
    public/js/pages/   one file per page

`data/products.js` is from before we had the database and isn't used anymore.

## Pages

Each page is its own file in `public/js/pages`. The part of the URL after the # decides which one shows up, so `#/cart` shows `cart.js`.

* `#/` home.js
* `#/login` login.js
* `#/register` register.js
* `#/catalog` catalog.js
* `#/cart` cart.js
* `#/checkout` checkout.js
* `#/orders` orders.js
* `#/employee` employee.js
* `#/manager` manager.js

Home, Log In, Register, Shop, and Cart work. The other pages say "Coming soon" and have TODO comments at the top listing what they need.

Pages starting with `#/employee` are only for employees and managers, and `#/manager` is only for managers. `app.js` checks this before showing the page. The server also checks the role before sending any employee data, and that's the check that actually protects it.

To work on a page, open its file and change what `show()` puts on the page. `catalog.js` shows how to get data from the server.

## API

* `GET /products` the products that are for sale
* `POST /register`, `POST /login`, `POST /logout` accounts
* `GET /profile` who is logged in
* `GET /cart` the logged in user's cart, with the subtotal, total weight, and delivery fee
* `POST /cart/items`, `PUT /cart/items/:id`, `DELETE /cart/items/:id` add, change, and remove cart items
* `GET /employee/orders` paid orders that need to be packed (employees and managers only)

The rest of the planned routes are in the API Design section of our Part 2 document.

## Next steps

The backlog in our Part 2 document says who is doing what.

1. Shop page: category filter.
2. Password reset.
3. Checkout: sales tax, delivery address, and Stripe test payments.
4. Orders: create the order after payment, move it through the statuses, and show it on the My Orders page.
5. Employee and manager dashboards, hooked up to real orders.
6. Delivery trips (up to 10 orders and 200 lbs) with routes from Google Maps.
7. Test everything using the test plan from Part 2.

Part III, the working site and our 12 minute presentation, is due 11/23.

## Working on the repo

Make a new branch for your task, push it, and open a pull request. Have someone on the team look it over before it gets merged into main.
