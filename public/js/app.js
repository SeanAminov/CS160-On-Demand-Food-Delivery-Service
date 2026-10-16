import home from './pages/home.js';
import login from './pages/login.js';
import catalog from './pages/catalog.js';
import cart from './pages/cart.js';
import checkout from './pages/checkout.js';
import orders from './pages/orders.js';
import employee from './pages/employee.js';
import manager from './pages/manager.js';
import register from './pages/register.js';
import { getUser } from './user.js';


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
  '/register': register,
};

// Pages only some roles can open. Any page starting with /employee is covered,
// so new employee pages are locked automatically.
function allowedRoles(path) {
  if (path.startsWith('/employee')) return ['employee', 'manager'];
  if (path.startsWith('/manager')) return ['manager'];
  return null;
}

async function showPage() {
  const path = window.location.hash.slice(1) || '/';
  const page = pages[path] || home;
  const app = document.getElementById('app');
  document.title = page.title + ' | OFS';
  loginUpdate();

  // This keeps people off pages that aren't theirs. The server still checks the data itself.
  const roles = allowedRoles(path);
  if (roles) {
    const user = await getUser();
    if (!user) {
      window.location.hash = '#/login';
      return;
    }
    if (!roles.includes(user.role)) {
      app.innerHTML = '<h1>Not Allowed</h1><p class="muted">Your account does not have access to this page.</p>';
      return;
    }
  }

  page.show(app);
}
let loggedIn = false;
async function loginUpdate(){
  const welcome = document.getElementById('welcome');
  const login = document.getElementById('login');
  const empLink = document.getElementById('emp-link');
  try{
    const response = await fetch('/profile');
    if (!response.ok){
      loggedIn = false;
      welcome.hidden = true;
      if (empLink) empLink.hidden = true;
      login.textContent = 'Log In';
      return;
    }
    const user = await response.json();
    loggedIn = true;
    welcome.textContent =  `Welcome ${user.role}: ${user.name}`;
    welcome.hidden = false;
    if (empLink) empLink.hidden = !(user.role === 'employee' || user.role === 'manager');
    login.textContent = 'Log Out';
  }
  catch (error){
    console.error('Can not access info', error);
    welcome.hidden = true;
    if (empLink) empLink.hidden = true;
  }
}
document.getElementById('login').addEventListener('click', async (e) =>{
  if (!loggedIn) return;
  e.preventDefault();
  try{
    const response = await fetch('/logout', {method: 'POST'});
    if (!response.ok) throw new Error('Logout failed');
  }
  catch (error){
    console.error(error);
    return;
  }
  loggedIn = false;
  if(window.location.hash === '#/login')
  {
  showPage();
  } 
  else{
    window.location.hash = '#/login';
  }

});



window.addEventListener('hashchange', showPage);
showPage();
