import home from './pages/home.js';
import login from './pages/login.js';
import catalog from './pages/catalog.js';
import cart from './pages/cart.js';
import checkout from './pages/checkout.js';
import orders from './pages/orders.js';
import employee from './pages/employee.js';
import manager from './pages/manager.js';

// the part of the URL after # decides which page to show
const pages = {
  '/': home,
  '/login': login,
  '/catalog': catalog,
  '/cart': cart,
  '/checkout': checkout,
  '/orders': orders,
  '/employee': employee,
  '/manager': manager,
};

function showPage() {
  const path = window.location.hash.slice(1) || '/';
  const page = pages[path] || home;

  document.title = page.title + ' | OFS';
  page.show(document.getElementById('app'));
}

window.addEventListener('hashchange', showPage);
showPage();
