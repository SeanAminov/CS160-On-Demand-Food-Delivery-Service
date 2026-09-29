# OFS Organic Food Delivery

CS 160 Section 4, Team 1

A website where customers in downtown San Jose can order organic groceries and get them delivered by our delivery robot.

What we're using:

* Frontend: HTML, CSS, and JavaScript
* Backend: Node.js with Express
* Database: MySQL (not set up yet)
* Payments: Stripe test mode (not set up yet)
* Maps and routing: Google Maps API (not set up yet)

## How to run it

You need Node.js 20 or newer.

    npm install
    npm run dev

Then go to http://localhost:3000

`npm run dev` restarts the server when you save a file. If you only changed something in the public folder, just refresh the page.

## Folders

    server.js          the Express server
    data/products.js   product format, empty until we have the database
    public/index.html  the header, nav, and footer that every page shares
    public/css/        styles
    public/js/app.js   picks which page to show based on the URL
    public/js/pages/   one file per page

## Pages

Each page is its own file in `public/js/pages`. The part of the URL after the # decides which one shows up, so `#/cart` shows `cart.js`.

* `#/` home.js
* `#/login` login.js
* `#/catalog` catalog.js
* `#/cart` cart.js
* `#/checkout` checkout.js
* `#/orders` orders.js
* `#/employee` employee.js
* `#/manager` manager.js

Only the home page has real content so far. The other pages say "Coming soon" and have TODO comments at the top listing what they need.

To work on a page, open its file and change what `show()` puts on the page. `catalog.js` shows how to get data from the server.

## API

`GET /products` returns the product list. It's empty until the database is set up. The format for a product is written at the top of `data/products.js`.

The rest of the routes are in the API Design section of our Part 2 document.

## Next steps

Rough order to build things in. The backlog in our Part 2 document says who is doing what.

1. Set up MySQL and create the tables from the Database Design section of Part 2. Add some real products to test with.
2. Connect Express to MySQL so `GET /products` reads from the database.
3. Accounts: register, log in, log out, and password reset, with each role sent to its own page.
4. Shop page: category filter and a working Add to Cart button.
5. Cart page: change quantities and show the subtotal, total weight, and delivery fee (free under 20 lbs, $10 at 20 lbs or more).
6. Checkout: sales tax, delivery address, and Stripe test payments.
7. Orders: create the order after payment, move it through the statuses, and show it on the My Orders page.
8. Employee and manager dashboards.
9. Delivery trips (up to 10 orders and 200 lbs) with routes from Google Maps.
10. Test everything using the test plan from Part 2.

Part III, the working site and our 12 minute presentation, is due 11/23.

## Working on the repo

Make a new branch for your task, push it, and open a pull request. Have someone on the team look it over before it gets merged into main.
