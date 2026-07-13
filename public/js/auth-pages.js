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
      const fieldMessages = result.errors ? Object.values(result.errors).join(' ') : '';
      throw new Error(fieldMessages || result.error || `HTTP ${response.status}`);
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
          college: document.getElementById('register-college').value,
          phone: document.getElementById('register-phone').value,
          gender: document.getElementById('register-gender').value,
          birthdate: document.getElementById('register-birthdate').value,
          enrollmentStatus: document.getElementById('register-enrollment-status').value,
          graduatingTerm: document.getElementById('register-grad-term').value
        });
        window.location.href = result.redirectTo || '/dashboard.html';
      } catch (error) {
        showMessage(message, error.message);
      }
    });
  }

  const forgotPasswordForm = document.getElementById('forgot-password-form');
  if (forgotPasswordForm) {
    const message = document.getElementById('forgot-password-message');
    forgotPasswordForm.addEventListener('submit', event => {
      event.preventDefault();
      showMessage(message, 'Password reset email delivery is not configured yet. Please contact an administrator.');
    });
  }

  const googleLogin = document.getElementById('google-login');
  if (googleLogin) {
    googleLogin.addEventListener('click', () => {
      showMessage(
        document.getElementById('login-message'),
        'Google sign-in is not configured. Please use your DLSU email and password.'
      );
    });
  }
})();
