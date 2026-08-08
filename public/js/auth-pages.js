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
        if (result.requires2fa) {
          if (result.email) sessionStorage.setItem('gems_otp_email', result.email);
          window.location.href = '/verify-otp.html';
          return;
        }
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
    const studentIdInput = document.getElementById('register-student-id');
    const studentIdError = 'Student ID number must contain exactly 8 digits.';

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

    studentIdInput.addEventListener('input', () => {
      const value = studentIdInput.value.trim();
      studentIdInput.setCustomValidity(value && !/^\d{8}$/.test(value) ? studentIdError : '');
    });

    studentIdInput.addEventListener('invalid', () => {
      if (studentIdInput.validity.valueMissing) {
        studentIdInput.setCustomValidity('Please enter your student ID number.');
      } else if (studentIdInput.validity.patternMismatch || studentIdInput.validity.tooShort) {
        studentIdInput.setCustomValidity(studentIdError);
      }
    });

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
          studentId: studentIdInput.value.trim(),
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

  const otpForm = document.getElementById('otp-form');
  if (otpForm) {
    const message = document.getElementById('otp-message');
    const codeInput = document.getElementById('otp-code');
    const submitBtn = document.getElementById('otp-submit');
    const resendBtn = document.getElementById('otp-resend');
    const emailLabel = document.getElementById('otp-email');

    const storedEmail = sessionStorage.getItem('gems_otp_email');
    if (emailLabel && storedEmail) {
      emailLabel.textContent = storedEmail;
    }

    if (codeInput) {
      codeInput.addEventListener('input', () => {
        codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
      });
    }

    const RESEND_COOLDOWN_SECONDS = 60;
    let cooldownRemaining = 0;
    let cooldownTimer = null;

    function updateResendLabel() {
      if (!resendBtn) return;
      resendBtn.disabled = cooldownRemaining > 0;
      resendBtn.textContent = cooldownRemaining > 0
        ? `Resend code (${cooldownRemaining}s)`
        : 'Resend code';
    }

    function startCooldown(seconds) {
      cooldownRemaining = seconds;
      updateResendLabel();
      clearInterval(cooldownTimer);
      cooldownTimer = setInterval(() => {
        cooldownRemaining -= 1;
        if (cooldownRemaining <= 0) {
          clearInterval(cooldownTimer);
          cooldownRemaining = 0;
        }
        updateResendLabel();
      }, 1000);
    }

    // A code is always freshly emailed right before this page loads (from the
    // login 2FA branch or the Google OAuth pending-2FA redirect), so the server's
    // 60s per-send cooldown is already in effect. Mirror it immediately instead of
    // letting the user hit resend and get bounced with a 429.
    startCooldown(RESEND_COOLDOWN_SECONDS);

    otpForm.addEventListener('submit', async event => {
      event.preventDefault();
      message.hidden = true;
      message.classList.remove('auth-message--success');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const result = await submitJson('/api/auth/verify-otp', { code: codeInput.value });
        sessionStorage.removeItem('gems_otp_email');
        window.location.href = result.redirectTo || '/dashboard.html';
      } catch (error) {
        showMessage(message, error.message);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        message.hidden = true;
        message.classList.remove('auth-message--success');
        try {
          const result = await submitJson('/api/auth/resend-otp', {});
          showMessage(message, result.message || 'A new verification code has been sent.');
          message.classList.add('auth-message--success');
        } catch (error) {
          showMessage(message, error.message);
        } finally {
          // Whether the resend succeeded or hit the server's own cooldown/rate-limit,
          // re-arm the client-side cooldown so the button can't be hammered.
          startCooldown(RESEND_COOLDOWN_SECONDS);
        }
      });
    }
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
