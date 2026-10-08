/**
 * TaskFlow Dashboard & Productivity Controller
 * Handles Stats, Charts, Smart Focus "Focus Today", and Reminders
 */

const dashboard = {
  async loadStats() {
    try {
      const data = await api.get('/tasks/stats');
      if (data && data.stats) {
        this.renderStats(data.stats);
        this.renderCharts(data.stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  },

  renderStats(stats) {
    const totalEl = document.getElementById('stat-total');
    const pendingEl = document.getElementById('stat-pending');
    const inProgressEl = document.getElementById('stat-in-progress');
    const completedEl = document.getElementById('stat-completed');
    const overdueEl = document.getElementById('stat-overdue');
    const highPriorityEl = document.getElementById('stat-high');

    if (totalEl) totalEl.textContent = stats.total || 0;
    if (pendingEl) pendingEl.textContent = stats.pending || 0;
    if (inProgressEl) inProgressEl.textContent = stats.inProgress || 0;
    if (completedEl) completedEl.textContent = stats.completed || 0;
    if (overdueEl) overdueEl.textContent = stats.overdue || 0;
    if (highPriorityEl) highPriorityEl.textContent = stats.highPriority || 0;

    // Sidebar counters
    const navAll = document.getElementById('counter-all');
    const navPending = document.getElementById('counter-pending');
    const navCompleted = document.getElementById('counter-completed');

    if (navAll) navAll.textContent = stats.total || 0;
    if (navPending) navPending.textContent = (stats.pending || 0) + (stats.inProgress || 0);
    if (navCompleted) navCompleted.textContent = stats.completed || 0;
  },

  renderCharts(stats) {
    // 1. Circular Completion Chart
    const circle = document.getElementById('chart-circle-progress');
    const percentEl = document.getElementById('chart-percentage-text');
    const rate = stats.completionRate || 0;

    if (percentEl) percentEl.textContent = `${rate}%`;
    if (circle) {
      // Stroke dasharray format: [value, 100]
      circle.setAttribute('stroke-dasharray', `${rate}, 100`);
    }

    // 2. Category Distribution Bars
    const catContainer = document.getElementById('category-distribution-bars');
    if (!catContainer) return;

    catContainer.innerHTML = '';
    const categoryStats = stats.categoryStats || {};
    const total = stats.total || 1;

    const categories = Object.keys(categoryStats);
    if (categories.length === 0) {
      catContainer.innerHTML = '<p class="text-muted" style="font-size:0.8rem;">No categorized tasks yet.</p>';
      return;
    }

    categories.forEach((cat) => {
      const count = categoryStats[cat];
      const percent = Math.round((count / total) * 100);

      const row = document.createElement('div');
      row.className = 'category-bar-row';
      row.innerHTML = `
        <div class="category-bar-label">
          <span>${cat}</span>
          <span>${count} (${percent}%)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${percent}%;"></div>
        </div>
      `;
      catContainer.appendChild(row);
    });
  },

  async loadFocusTasks() {
    const listEl = document.getElementById('focus-tasks-list');
    if (!listEl) return;

    try {
      const data = await api.get('/tasks/focus');
      const tasks = data.tasks || [];

      listEl.innerHTML = '';

      if (tasks.length === 0) {
        listEl.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
            🎯 All caught up! No urgent tasks requiring immediate focus.
          </div>
        `;
        return;
      }

      tasks.forEach((task) => {
        const item = document.createElement('div');
        item.className = 'focus-item';

        const dueFormatted = task.dueDate
          ? new Date(task.dueDate).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : 'No due date';

        item.innerHTML = `
          <div class="focus-item-left">
            <span class="focus-score-badge">Focus: ${task.focusScore}</span>
            <div class="focus-info">
              <h4>${escapeHtml(task.title)}</h4>
              <div class="focus-meta">
                <span class="badge badge-${task.priority.toLowerCase()}">${task.priority} Priority</span>
                <span>📅 Due: ${dueFormatted}</span>
                <span>🏷️ ${task.category}</span>
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn-secondary btn-sm" onclick="taskManager.quickCompleteFocus('${task._id}', event)">
              ✓ Done
            </button>
          </div>
        `;

        // Click to view details
        item.addEventListener('click', (e) => {
          if (e.target.tagName !== 'BUTTON') {
            taskManager.openTaskDetail(task._id);
          }
        });

        listEl.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load focus tasks:', err);
    }
  },

  async checkRemindersAndNotifications() {
    try {
      const data = await api.get('/tasks', { status: 'Pending' });
      const tasks = data.tasks || [];
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const overdueOrUpcoming = [];

      tasks.forEach((t) => {
        if (!t.dueDate) return;
        const due = new Date(t.dueDate);
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
        const diffDays = Math.round((dueDay - todayDate) / 86400000);

        if (diffDays < 0) {
          overdueOrUpcoming.push({
            task: t,
            type: 'overdue',
            msg: `⚠️ Overdue: "${t.title}" was due on ${due.toLocaleDateString()}`,
          });
        } else if (diffDays === 0) {
          overdueOrUpcoming.push({
            task: t,
            type: 'today',
            msg: `⏰ Due Today: "${t.title}" is due before midnight!`,
          });
        } else if (diffDays === 1) {
          overdueOrUpcoming.push({
            task: t,
            type: 'tomorrow',
            msg: `⚠️ Due Tomorrow: "${t.title}" is due tomorrow!`,
          });
        }
      });

      // Update badge
      const badgeEl = document.getElementById('notification-badge');
      const listEl = document.getElementById('notif-list');

      if (badgeEl) {
        if (overdueOrUpcoming.length > 0) {
          badgeEl.textContent = overdueOrUpcoming.length;
          badgeEl.style.display = 'flex';
        } else {
          badgeEl.style.display = 'none';
        }
      }

      if (listEl) {
        listEl.innerHTML = '';
        if (overdueOrUpcoming.length === 0) {
          listEl.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:0.85rem;">No new notifications. You are all set!</div>';
        } else {
          overdueOrUpcoming.forEach((item) => {
            const notifItem = document.createElement('div');
            notifItem.className = 'notif-item';
            notifItem.innerHTML = `<div>${item.msg}</div>`;
            notifItem.addEventListener('click', () => {
              taskManager.openTaskDetail(item.task._id);
              document.getElementById('notification-menu')?.classList.remove('show');
            });
            listEl.appendChild(notifItem);
          });
        }
      }

      // Check browser notification permission
      if (overdueOrUpcoming.length > 0 && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('TaskFlow Reminder', {
            body: overdueOrUpcoming[0].msg,
            icon: '/favicon.ico',
          });
        }
      }
    } catch (err) {
      console.error('Failed to check reminders:', err);
    }
  },

  updateGreeting() {
    const greetingEl = document.getElementById('greeting-heading');
    const user = api.getUser();
    const name = user ? user.name.split(' ')[0] : 'there';

    const hour = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
    else if (hour >= 17) timeGreeting = 'Good evening';

    if (greetingEl) {
      greetingEl.textContent = `${timeGreeting}, ${name}! 👋`;
    }
  },
};

// Notification Dropdown Toggle
document.addEventListener('DOMContentLoaded', () => {
  const bellBtn = document.getElementById('notification-bell-btn');
  const notifMenu = document.getElementById('notification-menu');

  if (bellBtn && notifMenu) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifMenu.classList.toggle('show');

      // Request browser notification permission once clicked if not decided
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    });

    document.addEventListener('click', () => {
      notifMenu.classList.remove('show');
    });
  }
});

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
