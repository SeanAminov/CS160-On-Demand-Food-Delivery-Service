export default {
  title: 'Register',
  show(app) {
    app.innerHTML = `
        <div class="account-wrapper register">
        <h1>Register</h1>
        <form id = "register-form">   
        <div class="input-field"><input type="text" name="name" id="name" placeholder="Name" required><i class='bx bxs-user' ></i></div>
        <div class="input-field"><input type="email" name="email" id="email" placeholder="Email" required><i class='bx bxs-envelope'></i></div>
        <div class="input-field"><input type="password" name="password" id="password" placeholder="Password" required><i class='bx bxs-lock-alt' ></i></div>
        <div class="input-field"><input type="password" name="confirmPassword" id="confirmPassword" placeholder="Confirm Password" required><i class='bx bxs-lock-alt' ></i></div>
        <button class="button primary" type="submit">Create Account</button>
        <div class="redirects">
        <label for="login"> Already have an account?</label>
        <a class = "button" id="login" href="#/login">Login</a>
        </div>
        <p id="error" style="color: red;"> </p>
        <p id="success" style="color: blue;"> </p>
        </form>
        </div>
    `;
    const form = document.getElementById('register-form');
    const error = document.getElementById('error');
    const success = document.getElementById('success');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        error.textContent = '';
        const formData = new FormData(form);
        const name = formData.get('name').trim();
        const email = formData.get('email').trim();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
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
        if (!emailRegex.test(email)){
          error.textContent = 'Invalid email format.';
          return;
        }
        if (password != confirmPassword){
          error.textContent = 'Passwords do not match.';
          return;
        }
        if (password.length < 8){
          error.textContent = 'Password must be at least 8 characters.';
          return;
        }
        if (password.length > 72){
          error.textContent = 'Password must be 72 characters or less.';
          return;
        }
        try {
          const response = await fetch('/register' ,{
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, email, password, confirmPassword})
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
