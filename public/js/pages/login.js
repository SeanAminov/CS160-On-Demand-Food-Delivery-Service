// TODO: login form with email and password
// TODO: register form
// TODO: forgot password
// TODO: after login, send customers to #/catalog, employees to #/employee, and managers to #/manager

export default {
  title: 'Log In',
  show(app) {
    app.innerHTML = `
      <h1>Log In</h1>
      <form id="login-form">
      <p>Email: <input type="email" name="email" id="email"></p>
      <p>Password: <input type="password" name="password" id="password"></p>
      <button type="submit">Log In</button>
      <a class = "button" href="#/register">Register</a>
      <p id="error" style="color: red;"> </p>
      </form>
      `;
    const form = document.getElementById('login-form');  
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
          switch (data.role){
            case "customer":
              window.location.hash = "#/customer";
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
