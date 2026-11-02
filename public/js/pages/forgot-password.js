export default {
  title: 'Forgot Password',
  show(app) {
    app.innerHTML = `
        <div class="account-wrapper">
        <h1>Reset Password</h1>
        <form id = "forgot-password-form">   
        <div class="input-field"><input type="email" name="email" id="email" placeholder="Email" required><i class='bx bxs-envelope'></i></div>
        <div class="confirmation-row">
            <div class="input-field"><input type="text" name="confirmationCode" placeholder="One Time Confirmation Code" required><i class='bx bxs-key'></i></div>
            <button class="button primary" type="button" id="getCode">Get Code</button>
        </div>
        <div class="input-field"><input type="password" name="password" id="password" placeholder="New Password" required><i class='bx bxs-lock-alt' ></i></div>
        <div class="input-field"><input type="password" name="confirmPassword" id="confirmPassword" placeholder="Confirm New Password" required><i class='bx bxs-lock-alt' ></i></div>
        <button class="button primary" type="submit">Reset Password</button>
        <div class="redirects">
        <a class = "button" href="#/login">Login</a>
        <a class = "button" href="#/register">Register Now</a>
        </div>
        <p id="error" style="color: red;"> </p>
        <p id="success" style="color: blue;"> </p>
        </form>
        </div>
    `;

    const form = document.getElementById('forgot-password-form');
    const error = document.getElementById('error');
    const success = document.getElementById('success');

    async function post(url, body){
      const res = await fetch(url, {
        method: 'POST',
        headers: {'Content-type': 'application/json'},
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error.');
      return data;
    }



    document.getElementById('getCode').addEventListener("click", async ()=>{
      error.textContent = '';
      success.textContent = '';
      const email = form.email.value.trim();
      if (!email){
        error.textContent = 'Enter an email.';
        return; 
      }
      try{
        const data = await post('/forgot-password/code', {email});
        success.textContent = `Your code is ${data.code}`;
      }
      catch (err){
        error.textContent = err.message;
      }
    });


    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        error.textContent = '';
        success.textContent = '';
        const formData = new FormData(form);
        const code = formData.get('confirmationCode').trim();
        const email = formData.get('email').trim();
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        if (!email || !password || !confirmPassword || !code){
          error.textContent = 'Fill in all fields.';
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
          await post('/forgot-password/reset', {email, code, password});
          success.textContent = 'Password reset!';
        }
        catch(err){
          error.textContent = err.message;
        }
    });
  },
};
