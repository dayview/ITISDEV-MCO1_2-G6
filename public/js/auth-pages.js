(function() {
  function showMessage(element, message) {
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
  }

  async function submitJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    return result;
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    const message = document.getElementById('login-message');
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      message.hidden = true;
      try {
        const result = await submitJson('/api/auth/login', {
          email: document.getElementById('login-email').value,
          password: document.getElementById('login-password').value
        });
        window.location.href = result.redirectTo || '/dashboard.html';
      } catch (error) {
        showMessage(message, error.message);
      }
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const message = document.getElementById('register-message');
    registerForm.addEventListener('submit', async event => {
      event.preventDefault();
      message.hidden = true;
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;
      if (password !== confirmPassword) {
        showMessage(message, 'Passwords do not match.');
        return;
      }
      try {
        const result = await submitJson('/api/auth/register', {
          email: document.getElementById('register-email').value,
          password,
          name: document.getElementById('register-name').value,
          studentId: document.getElementById('register-student-id').value,
          major: document.getElementById('register-major').value,
          college: 'CCS'
        });
        window.location.href = result.redirectTo || '/dashboard.html';
      } catch (error) {
        showMessage(message, error.message);
      }
    });
  }
})();
