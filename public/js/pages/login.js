// TODO: login form with email and password
// TODO: register form
// TODO: forgot password
// TODO: after login, send customers to #/catalog, employees to #/employee, and managers to #/manager

export default {
  title: 'Log In',
  show(app) {
    app.innerHTML = `
      <div class="account-wrapper">
      <h1>Log In</h1>
      <form id="login-form">
      <div class="input-field"><input type="email" name="email" id="email" placeholder="Email" required></div>
      <div class="input-field"><input type="password" name="password" id="password" placeholder="Password" required></div>
      <button class="button primary" type="submit">Log In</button>
      <div class="redirects">
      <a class = "button">Forgot Password</a>
      <a class = "button" href="#/register">Register Now</a>
      </div>
      <p id="error" style="color: red;"> </p>
      </form>
      </div>
      `;
    const form = document.getElementById('login-form');  
    const error = document.getElementById('error');
    form.addEventListener('submit', async(event) =>{
      event.preventDefault();
      error.textContent = '';
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (!email || !password){
        error.textContent = 'Fill in all fields.';
        return;
      }
      try{
        const response = await fetch('/login',{
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email, password})
        });
        const data = await response.json();
        if (response.ok){
          localStorage.setItem('user', JSON.stringify({user_id: data.user_id, role: data.role}));
          switch (data.role){
            case "customer":
              window.location.hash = "#/catalog";
              break;
            case "employee":
              window.location.hash = "#/employee";
              break;
            case "manager":
              window.location.hash = "#/manager";
              break;
            default:
              console.log("Error", data.role);
          }
        }
        else {
          error.textContent = data.error || 'Login Failed.';
        }
      }
      catch (err){
        error.textContent = 'Cannot connect to server.';
      }
    });
  },
};
