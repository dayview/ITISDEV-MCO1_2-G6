/* To use login modal:
  <button type="button" class="btn btn-primary" onclick="openAuthModal()">Login</button>
  <script src="../../public/js/modal.js"></script>
*/

function applyModalVariant(page) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  const container = modal.querySelector('.auth-container');
  const card = modal.querySelector('.card');

  if (!container || !card) return;

  if (page === 'register.html') {
    container.classList.add('auth-container--wide');
    card.classList.add('card--scrollable');
  } else {
    container.classList.remove('auth-container--wide');
    card.classList.remove('card--scrollable');
  }
}

function ensureAuthStylesheet(page) {
  const cssPath = page === 'register.html'
    ? '../../public/css/register.css'
    : '../../public/css/login.css';

  let link = document.querySelector('link[data-auth-stylesheet="true"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute('data-auth-stylesheet', 'true');
    document.head.appendChild(link);
  }

  link.href = cssPath;
}

window.closeAuthModal = function(event, force = false) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  if (force || event.target === modal) {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
};

window.loadAuthContent = async function(page) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  ensureAuthStylesheet(page);

  try {
    const pageUrl = new URL(page, window.location.href);
    const response = await fetch(pageUrl);
    if (!response.ok) throw new Error(`Failed to load ${page}`);

    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const fetchedModal = doc.getElementById('auth-modal');

    if (!fetchedModal) {
      throw new Error(`Could not find #auth-modal in ${page}`);
    }

    const importedModal = document.importNode(fetchedModal, true);
    modal.replaceWith(importedModal);
    applyModalVariant(page);

    requestAnimationFrame(() => {
      const updatedModal = document.getElementById('auth-modal');
      if (updatedModal) {
        updatedModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  } catch (error) {
    console.error(error);
  }
};

window.openAuthModal = function() {
  const existingModal = document.getElementById('auth-modal');

  if (existingModal) {
    existingModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'login-bg';
  modal.onclick = (event) => window.closeAuthModal(event);
  document.body.appendChild(modal);

  window.loadAuthContent('login.html');
};
