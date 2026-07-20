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
    const degreePrograms = {
      BAGCED: [
        'Bachelor of Early Childhood Education',
        'Bachelor of Secondary Education major in English',
        'Bachelor of Secondary Education major in Filipino',
        'Bachelor of Secondary Education major in Mathematics',
        'Bachelor of Secondary Education major in Science'
      ],
      CCS: [
        'BS Computer Science major in Computer Systems Engineering',
        'BS Computer Science major in Network and Information Security',
        'BS Computer Science major in Software Technology',
        'BS Information Systems',
        'BS Information Technology'
      ],
      CLA: [
        'AB Behavioral Sciences',
        'AB Communication Arts',
        'AB Development Studies',
        'AB History',
        'AB International Studies',
        'AB Literature',
        'AB Organizational Communication',
        'AB Philosophy',
        'AB Political Science',
        'AB Psychology',
        'AB Sports Studies'
      ],
      COS: [
        'BS Biochemistry',
        'BS Biology',
        'BS Chemistry',
        'BS Human Biology',
        'BS Mathematics with specialization in Business Applications',
        'BS Physics'
      ],
      GCOE: [
        'BS Chemical Engineering',
        'BS Civil Engineering',
        'BS Computer Engineering',
        'BS Electrical Engineering',
        'BS Electronics Engineering',
        'BS Industrial Engineering',
        'BS Manufacturing Engineering and Management',
        'BS Mechanical Engineering'
      ],
      RVRCOB: [
        'BS Accountancy',
        'BS Advertising Management',
        'BS Applied Corporate Management',
        'BS Business Management',
        'BS Entrepreneurship',
        'BS Financial Institutions',
        'BS Interdisciplinary Business Studies',
        'BS Legal Management',
        'BS Marketing Management'
      ],
      SOE: [
        'AB Economics',
        'BS Applied Economics',
        'BS Applied Economics major in Financial Economics',
        'BS Applied Economics major in Industrial Economics'
      ]
    };
    const collegeSelect = document.getElementById('register-college');
    const majorSelect = document.getElementById('register-major');

    function updateDegreePrograms() {
      const programs = degreePrograms[collegeSelect.value] || [];
      majorSelect.replaceChildren();
      const prompt = document.createElement('option');
      prompt.value = '';
      prompt.disabled = true;
      prompt.selected = true;
      prompt.textContent = programs.length ? 'Select Degree Program' : 'Select a college first';
      majorSelect.appendChild(prompt);
      programs.forEach(program => {
        const option = document.createElement('option');
        option.value = program;
        option.textContent = program;
        majorSelect.appendChild(option);
      });
      majorSelect.disabled = programs.length === 0;
    }

    collegeSelect.addEventListener('change', updateDegreePrograms);
    updateDegreePrograms();

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
      window.location.href = '/api/auth/google';
    });
  }

  const GOOGLE_ERROR_MESSAGES = {
    google_not_configured: 'Google sign-in is not configured. Please use your DLSU email and password.',
    google_auth_failed: 'Google sign-in failed. Please try again or use your DLSU email and password.',
    google_email_unverified: 'Your Google account email is not verified.',
    google_wrong_domain: 'Please use a DLSU Google account (@dlsu.edu.ph) to continue.'
  };

  const loginMessage = document.getElementById('login-message');
  const error = new URLSearchParams(window.location.search).get('error');
  if (error && loginMessage) {
    showMessage(loginMessage, GOOGLE_ERROR_MESSAGES[error] || 'Google sign-in failed. Please try again.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
})();
