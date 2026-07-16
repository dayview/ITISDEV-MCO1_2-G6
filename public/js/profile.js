(function() {
  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || '';
  }

  function initials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('') || 'AD';
  }

  function roleLabel(role) {
    return ({ OVPERI_Admin: 'OVPERI Administrator', System_Admin: 'System Administrator' })[role] || role || '';
  }

  async function loadIdentity() {
    const response = await fetch('/api/me');
    const result = await response.json();
    if (!response.ok || !result.success || !result.user) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    const user = result.user;
    setValue('fullname', user.name);
    setValue('email', user.email);
    setValue('admin-role', roleLabel(user.role));
    const loginEmail = document.getElementById('admin-login-email');
    if (loginEmail) loginEmail.textContent = user.email || 'Not available';
    const avatar = document.querySelector('.catalog-account-link .user-avatar');
    if (avatar) avatar.textContent = initials(user.name);
    const status = document.getElementById('admin-session-status');
    if (status) status.textContent = 'Authenticated';
  }

  async function init() {
    try {
      await loadIdentity();
    } catch (error) {
      console.error('Unable to load admin profile:', error);
      const status = document.getElementById('admin-session-status');
      if (status) status.textContent = 'Unable to load';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
