export default {
  title: 'Register',
  show(app) {
    app.innerHTML = `
        <h1>Register</h1>
        <form id = "register-form">   
        <p>Name: <input type="text" name="name" id="name"></p>
        <p>Email: <input type="email" name="email" id="email"></p>
        <p>Password: <input type="password" name="password" id="password"></p>
        <p>ConfirmPassword: <input type="password" name="confirmPassword" id="confirmPassword"></p>
        <button type="submit">Create Account</button>
        <a class = "button" href="#/login">Login</a>
        <p id="error" style="color: red;"> </p>
        <p id="success" style="color: blue;"> </p>
        </form>
    `;
    const form = document.getElementById('register-form');
    const error = document.getElementById('error');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        error.textContent = '';
        const formData = new FormData(form);
        const name = formData.get('name').trim();
        const email = formData.get('email').trim();
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        if (!name || !email || !password || !confirmPassword){
          error.textContent = 'Fill in all fields.';
          return;
        }
        if (name.length > 100){
          error.textContent = 'Name must be 100 characters or less.';
          return;
        } 
        if (email.length > 255){
          error.textContent = 'Email must be 255 characters or less.';
          return;
        }
        if (password != confirmPassword){
          error.textContent = 'Passwords do not match.';
          return;
        }
        if (password.length < 8){
          error.textContent = 'Password must be at least 8 characters';
          return;
        }
        try {
          const response = await fetch('/register' ,{
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, email, password})
          });
          const data = await response.json();
          if (!response.ok){
            error.textContent = data.error || 'Could Not Register.';
            return;
          }
          form.reset();
          success.textContent = 'Account created successfully.';
        }
        catch (err){
          error.textContent = 'Server Connection Failed';
        }
    });
  },
};
