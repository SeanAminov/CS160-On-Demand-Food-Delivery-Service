import home from './pages/home.js';
import login from './pages/login.js';
import catalog from './pages/catalog.js';
import cart from './pages/cart.js';
import checkout from './pages/checkout.js';
import orders from './pages/orders.js';
import employee from './pages/employee.js';
import manager from './pages/manager.js';
import register from './pages/register.js';


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

function showPage() {
  const path = window.location.hash.slice(1) || '/';
  const page = pages[path] || home;
  document.title = page.title + ' | OFS';
  page.show(document.getElementById('app'));
  loginUpdate();
}
let loggedIn = false;
async function loginUpdate(){
  const welcome = document.getElementById('welcome');
  const login = document.getElementById('login');
  try{
    const response = await fetch('/profile');
    if (!response.ok){
      loggedIn = false;
      welcome.hidden = true;
      login.textContent = 'Log In';
      return;
    }
    const user = await response.json();
    loggedIn = true;
    welcome.textContent =  `Welcome ${user.role}: ${user.name}`;
    welcome.hidden = false;
    login.textContent = 'Log Out';
  }
  catch (error){
    console.error('Can not access info', error);
    welcome.hidden = true;
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
  if(window.location.hash === '#login')
  {
  showPage();
  } 
  else{
    window.location.hash = '#/login';
  }

});



window.addEventListener('hashchange', showPage);
showPage();
