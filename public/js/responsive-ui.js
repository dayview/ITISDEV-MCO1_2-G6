(function () {
  'use strict';

  const MOBILE_NAV_QUERY = '(max-width: 760px)';

  // Shared by every student and admin page - each one includes this script
  // and renders the same .catalog-account-link markup, so converting it here
  // once covers the desktop bar and the mobile drawer everywhere at once.
  function createSignOutMenuItem() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'topnav-account__item topnav-account__signout';
    button.setAttribute('role', 'menuitem');
    button.textContent = 'Sign Out';

    button.addEventListener('click', async function () {
      if (button.disabled) return;
      const originalLabel = button.textContent;
      button.disabled = true;
      button.removeAttribute('aria-label');
      button.textContent = 'Signing out...';

      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
        if (!response.ok) throw new Error(`Logout failed with HTTP ${response.status}`);
        window.location.href = '/login.html';
      } catch (_error) {
        button.disabled = false;
        button.textContent = originalLabel;
        button.setAttribute('aria-label', 'Sign out failed. Please try again.');
      }
    });

    return button;
  }

  // Converts the existing profile/avatar <a> into a "<button trigger> + <menu>"
  // account dropdown, reusing its classes, attributes, href, and inner markup
  // (including any id'd avatar span other scripts look up) so nothing else
  // that targets .catalog-account-link or #nav-user-avatar has to change.
  function buildAccountMenu(accountLink) {
    const wrapper = document.createElement('div');
    wrapper.className = 'topnav-account';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = accountLink.className + ' topnav-account__trigger';
    ['aria-label', 'aria-current', 'title'].forEach(function (attr) {
      if (accountLink.hasAttribute(attr)) trigger.setAttribute(attr, accountLink.getAttribute(attr));
    });
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = accountLink.innerHTML;

    const menu = document.createElement('div');
    menu.className = 'topnav-account__menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const profileLink = document.createElement('a');
    profileLink.className = 'topnav-account__item';
    profileLink.setAttribute('role', 'menuitem');
    profileLink.href = accountLink.getAttribute('href') || '#';
    profileLink.textContent = 'View Profile';

    const signOutItem = createSignOutMenuItem();

    menu.appendChild(profileLink);
    menu.appendChild(signOutItem);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);

    function closeMenu(restoreFocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    }

    function openMenu() {
      if (!menu.hidden) return;
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      profileLink.focus();
    }

    trigger.addEventListener('click', function () {
      if (menu.hidden) openMenu();
      else closeMenu(false);
    });

    profileLink.addEventListener('click', function () {
      closeMenu(false);
    });

    document.addEventListener('click', function (event) {
      if (menu.hidden || wrapper.contains(event.target)) return;
      closeMenu(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || menu.hidden) return;
      // Close just the dropdown on the first Escape rather than also
      // dropping through to the mobile drawer's own Escape handler below.
      event.stopImmediatePropagation();
      closeMenu(true);
    });

    wrapper.addEventListener('keydown', function (event) {
      if (menu.hidden || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
      event.preventDefault();
      const items = [profileLink, signOutItem];
      const currentIndex = items.indexOf(document.activeElement);
      const nextIndex = event.key === 'ArrowDown'
        ? (currentIndex + 1) % items.length
        : (currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
      items[nextIndex].focus();
    });

    return wrapper;
  }

  function initNavigation(nav, index) {
    if (nav.dataset.responsiveNav === 'ready') return;
    const links = nav.querySelector('.student-topnav__links');
    const brand = nav.querySelector('.student-topnav__brand');
    if (!links || !brand) return;

    const title = nav.getAttribute('aria-label') || 'Primary navigation';
    const drawerId = `responsive-nav-drawer-${index}`;
    links.id = links.id || drawerId;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-nav-toggle';
    toggle.setAttribute('aria-label', `Open ${title.toLowerCase()}`);
    toggle.setAttribute('aria-controls', links.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'mobile-nav-backdrop';
    backdrop.setAttribute('aria-label', `Close ${title.toLowerCase()}`);
    backdrop.hidden = true;

    brand.insertAdjacentElement('afterend', toggle);
    nav.insertAdjacentElement('afterend', backdrop);
    nav.dataset.responsiveNav = 'ready';

    if (!links.querySelector('.topnav-account')) {
      const accountLink = links.querySelector('.catalog-account-link');
      if (accountLink) accountLink.replaceWith(buildAccountMenu(accountLink));
    }

    let lastFocused = null;

    function closeDrawer(restoreFocus) {
      nav.classList.remove('is-nav-open');
      document.body.classList.remove('mobile-nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', `Open ${title.toLowerCase()}`);
      backdrop.hidden = true;
      if (restoreFocus && lastFocused) lastFocused.focus();
    }

    function openDrawer() {
      lastFocused = document.activeElement;
      nav.classList.add('is-nav-open');
      document.body.classList.add('mobile-nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', `Close ${title.toLowerCase()}`);
      backdrop.hidden = false;
      const current = links.querySelector('[aria-current="page"]') || links.querySelector('a, button');
      if (current) current.focus();
    }

    toggle.addEventListener('click', function () {
      if (nav.classList.contains('is-nav-open')) closeDrawer(true);
      else openDrawer();
    });
    backdrop.addEventListener('click', function () { closeDrawer(true); });
    links.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeDrawer(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-nav-open')) closeDrawer(true);
      if (event.key !== 'Tab' || !nav.classList.contains('is-nav-open')) return;
      const focusable = Array.from(links.querySelectorAll('a[href], button:not([disabled])'))
        .filter(function (el) { return !el.closest('[hidden]'); });
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    const media = window.matchMedia(MOBILE_NAV_QUERY);
    const resetAtDesktop = function (event) { if (!event.matches) closeDrawer(false); };
    if (media.addEventListener) media.addEventListener('change', resetAtDesktop);
    else media.addListener(resetAtDesktop);
  }

  // Nav links marked data-admin-role start hidden in markup (so a lower-privileged
  // admin never even sees a flash of them) and are revealed here once /api/me
  // confirms the signed-in user actually holds that role. The API route itself
  // stays the real access boundary; this only controls link visibility.
  function applyRoleGating() {
    const gated = document.querySelectorAll('[data-admin-role]');
    if (!gated.length) return;
    fetch('/api/me', { credentials: 'include' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (payload) {
        const role = payload && payload.user && payload.user.role;
        gated.forEach(function (el) {
          if (el.getAttribute('data-admin-role') === role) el.hidden = false;
        });
      })
      .catch(function () {});
  }

  function labelResponsiveTables() {
    document.querySelectorAll('table').forEach(function (table) {
      const labels = Array.from(table.querySelectorAll('thead th')).map(function (heading) {
        return heading.textContent.trim();
      });
      if (!labels.length) return;
      table.querySelectorAll('tbody tr').forEach(function (row) {
        Array.from(row.children).forEach(function (cell, index) {
          if (!cell.dataset.label && labels[index]) cell.dataset.label = labels[index];
        });
      });
    });
  }

  function init() {
    document.querySelectorAll('.student-topnav.catalog-nav').forEach(initNavigation);
    labelResponsiveTables();
    applyRoleGating();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
