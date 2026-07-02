/* =========================================
   JAVASCRIPT: VALIDATION & STATE MANAGEMENT
   ========================================= */

(function() {
  // DOM Elements
  const form = document.getElementById('profile-form');
  const toast = document.getElementById('toast');
  const btnCancel = document.getElementById('btn-cancel');
  const navLinks = document.querySelectorAll('.nav-item a');
  const sections = document.querySelectorAll('.section-card');

  function setValue(id, value) {
    const input = document.getElementById(id);
    if (input && value != null) input.value = value;
  }

  async function hydrateProfile() {
    try {
      const isAdmin = document.body.classList.contains('admin-page');
      const response = await fetch(isAdmin ? '/api/admin/summary' : '/api/student/summary');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);

      if (isAdmin) {
        const { admin, programs, applicants } = result.data;
        setValue('fullname', admin.name);
        setValue('email', admin.email);
        const summaryValues = document.querySelectorAll('.admin-profile-summary-card__value');
        if (summaryValues[0]) summaryValues[0].textContent = programs.total;
        if (summaryValues[1]) summaryValues[1].textContent = applicants.total;
        if (summaryValues[2]) summaryValues[2].textContent = applicants.reviewed;
        if (summaryValues[3]) summaryValues[3].textContent = programs.recent.length ? 'Today' : 'None';
      } else {
        const { student, documents } = result.data;
        setValue('fullname', student.name);
        setValue('email', student.email);
        setValue('student-id', student.studentId);
        setValue('major', student.major);
        setValue('grad-term', student.graduatingTerm);
        const avatar = document.querySelector('.user-avatar');
        if (avatar && student.name) avatar.textContent = student.name.split(' ').map(part => part[0]).slice(0, 2).join('');
        const pendingBadge = document.querySelector('#section-documents .status-badge');
        if (pendingBadge) pendingBadge.textContent = `${documents.length} Uploaded`;
      }
    } catch (error) {
      console.warn('Unable to hydrate profile from backend.', error);
    }
  }

  // Validation Rules
  const rules = {
    fullname: {
      validate: (val) => val.trim().length >= 3,
      message: 'Name must be at least 3 characters long'
    },
    email: {
      validate: (val) => /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(val),
      message: 'Please enter a valid email address'
    },
    phone: {
      validate: (val) => {
        const digits = val.replace(/\D/g, '');
        return /^\+?[\d\s-]+$/.test(val.trim()) && digits.length >= 10 && digits.length <= 13;
      },
      message: 'Please enter a valid phone number (e.g., +63 917 123 4567)'
    },
    gender: {
      validate: (val) => val !== '',
      message: 'Please select a gender'
    },
    birthdate: {
      validate: (val) => val !== '',
      message: 'Please select your date of birth'
    }
  };

  // Helper: Set Validation State
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

  // Helper: Validate Single Field
  function validateField(fieldname, value) {
    const rule = rules[fieldname];
    if (!rule) return true; // No rule defined, auto-pass
    return rule.validate(value);
  }

  // Event Listener: Input Blur & Change for Validation
  document.querySelectorAll('input, select').forEach(input => {
    // Skip disabled inputs
    if (input.disabled) return;

    const handleInput = () => {
      const fieldname = input.name;
      const value = input.value;
      const isValid = validateField(fieldname, value);
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
        // Find the label (upload-zone) and update text
        const label = fileInput.closest('label');
        const uploadText = label.querySelector('.upload-text');
        const subText = label.querySelector('.upload-subtext');
        uploadText.textContent = fileInput.files[0].name;
        subText.textContent = 'Ready to upload';
        label.classList.add('profile-upload--ready');
      }
    });
  });

  // Event Listener: Cancel Button
  if (btnCancel) btnCancel.addEventListener('click', () => {
    if (confirm('Are you sure? Any unsaved changes will be lost.')) {
      form.reset();
      // Reset validation styles
      document.querySelectorAll('input.valid, select.valid').forEach(el => el.classList.remove('valid'));
      document.querySelectorAll('input.error, select.error').forEach(el => el.classList.remove('error'));
      document.querySelectorAll('.error-message').forEach(el => el.classList.remove('visible'));
    }
  });

  // Event Listener: Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let hasErrors = false;
    const inputs = form.querySelectorAll('input, select');

    // Validate all fields
    inputs.forEach(input => {
      if (input.disabled) return;
      const fieldname = input.name;
      const value = input.value;
      const isValid = validateField(fieldname, value);
      const message = rules[fieldname] ? rules[fieldname].message : '';
      setValidationState(input, isValid, message);
      if (!isValid) hasErrors = true;
    });

    if (hasErrors) {
      // Scroll to first error
      const firstError = form.querySelector('.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Success: Show Toast
    toast.classList.add('show');
    
    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  });

  // Navigation: Smooth Scroll & Active State
  function updateActiveNav() {
    let currentSection = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
      if (window.scrollY >= sectionTop) {
        currentSection = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href').includes(currentSection)) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav);

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      
      targetSection.scrollIntoView({ behavior: 'smooth' });
      
      // Update active state immediately
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  hydrateProfile();

})();
