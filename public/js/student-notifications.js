(function() {
  const trigger = document.querySelector('.catalog-notification');
  if (!trigger) return;

  let notifications = [];
  let panel;
  let list;
  let status;
  let markAll;

  function formatDeadline(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Deadline unavailable';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  }

  function timingLabel(days) {
    if (days === 0) return 'Due today';
    if (days === 1) return '1 day remaining';
    if (days > 1) return `${days} days remaining`;
    return 'Deadline passed';
  }

  function updateBadge(unread) {
    const badge = trigger.querySelector('.catalog-notification__badge');
    if (!badge) return;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.hidden = unread === 0;
    trigger.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
  }

  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('section');
    panel.className = 'notification-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Deadline reminders');

    const header = document.createElement('div');
    header.className = 'notification-panel__header';
    const heading = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'notification-panel__eyebrow';
    eyebrow.textContent = 'Deadlines';
    const title = document.createElement('h2');
    title.textContent = 'Reminders';
    heading.append(eyebrow, title);
    markAll = document.createElement('button');
    markAll.type = 'button';
    markAll.className = 'notification-panel__mark-all';
    markAll.textContent = 'Mark all as read';
    markAll.addEventListener('click', markAllRead);
    header.append(heading, markAll);

    status = document.createElement('div');
    status.className = 'notification-panel__status';
    status.setAttribute('role', 'status');
    list = document.createElement('div');
    list.className = 'notification-panel__list';
    panel.append(header, status, list);
    document.body.appendChild(panel);
  }

  function showState(message, retry) {
    status.hidden = false;
    status.replaceChildren();
    const text = document.createElement('p');
    text.textContent = message;
    status.appendChild(text);
    if (retry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--secondary';
      button.textContent = 'Retry';
      button.addEventListener('click', loadNotifications);
      status.appendChild(button);
    }
    list.replaceChildren();
  }

  function render() {
    status.hidden = true;
    status.replaceChildren();
    list.replaceChildren();
    markAll.hidden = !notifications.some(item => !item.isRead);
    if (!notifications.length) {
      showState('You have no reminders right now.');
      return;
    }
    notifications.forEach(notification => {
      const item = document.createElement('article');
      item.className = `notification-item${notification.isRead ? '' : ' notification-item--unread'}`;
      const marker = document.createElement('span');
      marker.className = 'notification-item__marker';
      marker.setAttribute('aria-hidden', 'true');
      const content = document.createElement('div');
      content.className = 'notification-item__content';
      const title = document.createElement('h3');
      title.textContent = notification.title;
      const context = document.createElement('p');
      context.className = 'notification-item__context';
      context.textContent = `${notification.requirementLabel} · ${notification.opportunityName}`;
      const message = document.createElement('p');
      message.textContent = notification.message;
      const meta = document.createElement('p');
      meta.className = 'notification-item__meta';
      meta.textContent = `${formatDeadline(notification.deadline)} · ${timingLabel(notification.daysRemaining)}`;
      const actions = document.createElement('div');
      actions.className = 'notification-item__actions';
      const documentsLink = document.createElement('a');
      documentsLink.href = '/documents.html';
      documentsLink.textContent = 'Open documents';
      documentsLink.addEventListener('click', () => markRead(notification.id));
      const applicationLink = document.createElement('a');
      applicationLink.href = '/applications.html';
      applicationLink.textContent = 'View application';
      applicationLink.addEventListener('click', () => markRead(notification.id));
      actions.append(documentsLink, applicationLink);
      if (!notification.isRead) {
        const readButton = document.createElement('button');
        readButton.type = 'button';
        readButton.textContent = 'Mark read';
        readButton.addEventListener('click', () => markRead(notification.id, true));
        actions.appendChild(readButton);
      }
      content.append(title, context, message, meta, actions);
      item.append(marker, content);
      list.appendChild(item);
    });
  }

  async function loadNotifications() {
    showState('Loading reminders...');
    markAll.hidden = true;
    try {
      const response = await fetch('/api/notifications?pageSize=20');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
      notifications = result.data || [];
      updateBadge(result.meta?.unread || 0);
      render();
    } catch (error) {
      console.error('Unable to load reminders:', error);
      updateBadge(0);
      showState('We could not load your reminders.', true);
    }
  }

  async function markRead(id, rerender) {
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
      notifications = notifications.map(item => item.id === id ? { ...item, isRead: true } : item);
      updateBadge(notifications.filter(item => !item.isRead).length);
      if (rerender) render();
    } catch (error) {
      if (rerender) showState('We could not update this reminder.', true);
    }
  }

  async function markAllRead() {
    markAll.disabled = true;
    try {
      const response = await fetch('/api/notifications/read-all', { method: 'PATCH' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
      notifications = notifications.map(item => ({ ...item, isRead: true }));
      updateBadge(0);
      render();
    } catch (error) {
      showState('We could not update your reminders.', true);
    } finally {
      markAll.disabled = false;
    }
  }

  ensurePanel();
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', event => {
    event.stopPropagation();
    panel.hidden = !panel.hidden;
    trigger.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) loadNotifications();
  });
  panel.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', () => {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }
  });
  loadNotifications();
})();
