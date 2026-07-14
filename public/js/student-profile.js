(function () {
  const loadingEl = document.getElementById('profile-loading');
  const errorEl = document.getElementById('profile-error');
  const errorMessageEl = document.getElementById('profile-error-message');
  const retryButton = document.getElementById('profile-retry');
  const form = document.getElementById('profile-form');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  const btnCancel = document.getElementById('btn-cancel');
  const navAvatar = document.getElementById('nav-user-avatar');

  if (!form || !loadingEl) return;

  const fields = {
    fullname: document.getElementById('fullname'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    gender: document.getElementById('gender'),
    birthdate: document.getElementById('birthdate'),
    'student-id': document.getElementById('student-id'),
    major: document.getElementById('major'),
    'enrollment-status': document.getElementById('enrollment-status'),
    'grad-term': document.getElementById('grad-term')
  };

  let currentProfile = null;

  // Validation Rules — only applied to editable fields; disabled inputs are skipped.
  const rules = {
    fullname: {
      validate: (val) => val.trim().length >= 3,
      message: 'Name must be at least 3 characters long'
    },
    phone: {
      validate: (val) => {
        if (!val.trim()) return true;
        const digits = val.replace(/\D/g, '');
        return /^\+?[\d\s-]+$/.test(val.trim()) && digits.length >= 10 && digits.length <= 13;
      },
      message: 'Please enter a valid phone number (e.g., +63 917 123 4567)'
    }
  };

  function initials(name) {
    const value = String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return value || '?';
  }

  function setValidationState(input, isValid, message) {
    const errorMsg = input.parentElement.querySelector('.error-message');
    if (isValid) {
      input.classList.remove('error');
      input.classList.add('valid');
      if (errorMsg) errorMsg.classList.remove('visible');
    } else {
      input.classList.remove('valid');
      input.classList.add('error');
      if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.classList.add('visible');
      }
    }
  }

  function clearValidationState(input) {
    input.classList.remove('valid', 'error');
    const errorMsg = input.parentElement.querySelector('.error-message');
    if (errorMsg) errorMsg.classList.remove('visible');
  }

  function validateField(fieldname, value) {
    const rule = rules[fieldname];
    if (!rule) return true;
    return rule.validate(value);
  }

  function showToast(message, isError) {
    if (!toast) return;
    if (toastMessage) toastMessage.textContent = message;
    toast.classList.toggle('toast--error', Boolean(isError));
    toast.classList.add('show');
    window.clearTimeout(toast._hideTimer);
    toast._hideTimer = window.setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function populateForm(profile) {
    fields.fullname.value = profile.name || '';
    fields.email.value = profile.email || '';
    fields.phone.value = profile.phone || '';
    fields.gender.value = profile.gender || '';
    fields.birthdate.value = profile.birthdate || '';
    fields['student-id'].value = profile.studentId || '';
    fields.major.value = profile.major || '';
    fields['enrollment-status'].value = profile.enrollmentStatus || '';
    fields['grad-term'].value = profile.graduatingTerm || '';

    Object.values(fields).forEach(clearValidationState);
    if (navAvatar) navAvatar.textContent = initials(profile.name);
  }

  function buildUpdatePayload() {
    return {
      name: fields.fullname.value.trim(),
      phone: fields.phone.value.trim(),
      gender: fields.gender.value,
      birthdate: fields.birthdate.value,
      major: fields.major.value,
      enrollmentStatus: fields['enrollment-status'].value,
      graduatingTerm: fields['grad-term'].value
    };
  }

  function applyServerErrors(errors) {
    if (!errors) return;
    const fieldIdByName = { name: 'fullname', enrollmentStatus: 'enrollment-status', graduatingTerm: 'grad-term' };
    Object.entries(errors).forEach(([key, message]) => {
      const fieldId = fieldIdByName[key] || key;
      const input = fields[fieldId];
      if (input) setValidationState(input, false, message);
    });
  }

  async function loadProfile() {
    loadingEl.hidden = false;
    errorEl.hidden = true;
    form.hidden = true;

    let response;
    try {
      response = await fetch('/api/profile');
    } catch (error) {
      loadingEl.hidden = true;
      errorMessageEl.textContent = 'Please check your connection and try again.';
      errorEl.hidden = false;
      return;
    }

    if (response.status === 401 || response.status === 403) {
      loadingEl.hidden = true;
      errorMessageEl.textContent = 'Your session has expired. Please sign in again.';
      errorEl.hidden = false;
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      loadingEl.hidden = true;
      errorMessageEl.textContent = 'Unexpected response from the server.';
      errorEl.hidden = false;
      return;
    }

    if (!response.ok || !result.success) {
      loadingEl.hidden = true;
      errorMessageEl.textContent = result.error || `HTTP ${response.status}`;
      errorEl.hidden = false;
      return;
    }

    currentProfile = result.data;
    populateForm(currentProfile);
    loadingEl.hidden = true;
    errorEl.hidden = true;
    form.hidden = false;
  }

  // Event Listener: Input Blur & Change for Validation
  Object.values(fields).forEach(input => {
    if (!input || input.disabled) return;
    const fieldname = input.name;
    const handleInput = () => {
      const isValid = validateField(fieldname, input.value);
      const message = rules[fieldname] ? rules[fieldname].message : '';
      setValidationState(input, isValid, message);
    };
    input.addEventListener('blur', handleInput);
    input.addEventListener('input', handleInput);
  });

  // Event Listener: File Upload Visual Update
  document.querySelectorAll('input[type="file"]').forEach(fileInput => {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        const label = fileInput.closest('label');
        const uploadText = label.querySelector('.upload-text');
        const subText = label.querySelector('.upload-subtext');
        uploadText.textContent = fileInput.files[0].name;
        subText.textContent = 'Ready to upload';
        label.classList.add('profile-upload--ready');
      }
    });
  });

  // Event Listener: Cancel Button — revert to the last loaded profile, not a blank form.
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      if (!currentProfile) return;
      if (confirm('Are you sure? Any unsaved changes will be lost.')) {
        populateForm(currentProfile);
      }
    });
  }

  // Event Listener: Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let hasErrors = false;
    Object.values(fields).forEach(input => {
      if (!input || input.disabled) return;
      const isValid = validateField(input.name, input.value);
      const message = rules[input.name] ? rules[input.name].message : '';
      setValidationState(input, isValid, message);
      if (!isValid) hasErrors = true;
    });

    if (hasErrors) {
      const firstError = form.querySelector('.error');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    let response;
    try {
      response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildUpdatePayload())
      });
    } catch (error) {
      showToast('Unable to save changes. Please check your connection and try again.', true);
      if (submitButton) submitButton.disabled = false;
      return;
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      showToast('Unexpected response from the server.', true);
      if (submitButton) submitButton.disabled = false;
      return;
    }

    if (submitButton) submitButton.disabled = false;

    if (response.status === 401 || response.status === 403) {
      showToast('Your session has expired. Please sign in again.', true);
      return;
    }

    if (!response.ok || !result.success) {
      applyServerErrors(result.errors);
      showToast(result.error || 'Unable to save changes.', true);
      return;
    }

    currentProfile = result.data;
    populateForm(currentProfile);
    showToast('Profile successfully updated!', false);
  });

  if (retryButton) retryButton.addEventListener('click', loadProfile);

  loadProfile();
})();
