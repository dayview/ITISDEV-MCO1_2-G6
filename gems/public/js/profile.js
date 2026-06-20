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
      // Allows formats like +63 917 123 4567 or 9171234567
      validate: (val) => /^(\+?\d{1,3}[-\s]?)?\d{9,10}$/.test(val.trim()),
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
        label.style.borderColor = 'var(--color-success)';
        label.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
      }
    });
  });

  // Event Listener: Cancel Button
  btnCancel.addEventListener('click', () => {
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

})();