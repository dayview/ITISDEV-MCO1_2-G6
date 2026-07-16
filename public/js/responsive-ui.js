(function () {
  'use strict';

  const MOBILE_NAV_QUERY = '(max-width: 760px)';

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

    if (document.body.classList.contains('admin-page') && !links.querySelector('.mobile-admin-logout')) {
      const logout = document.createElement('button');
      logout.type = 'button';
      logout.className = 'student-topnav__link mobile-admin-logout';
      logout.innerHTML = '<span class="student-topnav__link-icon" aria-hidden="true">&#8594;</span><span class="student-topnav__link-label">Log out</span>';
      logout.addEventListener('click', async function () {
        logout.disabled = true;
        try {
          const response = await fetch('/api/auth/logout', { method: 'POST' });
          if (!response.ok) throw new Error('Logout failed');
          window.location.href = '/login.html';
        } catch (_error) {
          logout.disabled = false;
          logout.setAttribute('aria-label', 'Log out failed. Try again');
        }
      });
      links.appendChild(logout);
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
      const focusable = Array.from(links.querySelectorAll('a[href], button:not([disabled])'));
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
