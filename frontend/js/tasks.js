/**
 * TaskFlow Tasks Controller
 * CRUD Operations, Real-Time Filters, Search, Sort, Categories, and Modal Dialogs
 */

const taskManager = {
  currentFilters: {
    search: '',
    status: '',
    priority: '',
    category: '',
    dateFilter: '',
    sort: 'newest',
  },

  editingTaskId: null,
  activeCategories: ['Work', 'Personal', 'Study', 'Shopping', 'Projects'],

  async init() {
    await this.loadCategories();
    await this.loadTasks();
    this.setupListeners();
  },

  async loadCategories() {
    try {
      const data = await api.get('/categories');
      if (data && data.categories) {
        this.activeCategories = data.categories;
        this.renderCategorySidebar();
        this.populateCategoryDropdowns();
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  },

  renderCategorySidebar() {
    const listEl = document.getElementById('sidebar-categories-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

    this.activeCategories.forEach((cat, index) => {
      const color = colors[index % colors.length];
      const item = document.createElement('div');
      item.className = `category-item ${this.currentFilters.category === cat ? 'active' : ''}`;
      item.innerHTML = `
        <div style="display:flex; align-items:center;">
          <span class="category-dot" style="background-color: ${color};"></span>
          <span>${escapeHtml(cat)}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        // Toggle or set category filter
        if (this.currentFilters.category === cat) {
          this.currentFilters.category = '';
        } else {
          this.currentFilters.category = cat;
        }
        document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
        this.renderCategorySidebar();
        const select = document.getElementById('filter-category');
        if (select) select.value = this.currentFilters.category;
        this.loadTasks();
      });

      listEl.appendChild(item);
    });
  },

  populateCategoryDropdowns() {
    const formSelect = document.getElementById('task-category-input');
    const filterSelect = document.getElementById('filter-category');

    if (formSelect) {
      formSelect.innerHTML = this.activeCategories
        .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
        .join('');
    }

    if (filterSelect) {
      const currentVal = filterSelect.value;
      filterSelect.innerHTML =
        '<option value="">All Categories</option>' +
        this.activeCategories
          .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
          .join('');
      filterSelect.value = currentVal || '';
    }
  },

  async loadTasks() {
    const container = document.getElementById('tasks-grid');
    if (!container) return;

    try {
      container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">Loading tasks...</div>';

      const params = {};
      if (this.currentFilters.search) params.search = this.currentFilters.search;
      if (this.currentFilters.status) params.status = this.currentFilters.status;
      if (this.currentFilters.priority) params.priority = this.currentFilters.priority;
      if (this.currentFilters.category) params.category = this.currentFilters.category;
      if (this.currentFilters.dateFilter) params.dateFilter = this.currentFilters.dateFilter;
      if (this.currentFilters.sort) params.sort = this.currentFilters.sort;

      const data = await api.get('/tasks', params);
      const tasks = data.tasks || [];

      this.renderTasks(tasks);

      // Refresh dashboard stats and focus tasks simultaneously
      dashboard.loadStats();
      dashboard.loadFocusTasks();
      dashboard.checkRemindersAndNotifications();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-desc">Error loading tasks: ${err.message}</div></div>`;
    }
  },

  renderTasks(tasks) {
    const container = document.getElementById('tasks-grid');
    if (!container) return;

    container.innerHTML = '';

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📝</div>
          <h3 class="empty-title">No tasks found</h3>
          <p class="empty-desc">Create your first task or try adjusting your search and filter criteria.</p>
          <button class="btn btn-primary" onclick="taskManager.openTaskModal()">+ Add New Task</button>
        </div>
      `;
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    tasks.forEach((task) => {
      const card = document.createElement('div');
      const isCompleted = task.status === 'Completed';
      card.className = `task-card ${isCompleted ? 'completed-card' : ''}`;

      let isOverdue = false;
      let dueFormatted = 'No due date';
      if (task.dueDate) {
        const dueTime = new Date(task.dueDate).getTime();
        isOverdue = dueTime < todayStart && !isCompleted;
        dueFormatted = new Date(task.dueDate).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }

      // Render Tags
      const tagsHtml = (task.tags || [])
        .map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`)
        .join('');

      card.innerHTML = `
        <div>
          <div class="task-card-header">
            <div class="task-card-title-group">
              <div class="task-checkbox ${isCompleted ? 'checked' : ''}" 
                   title="${isCompleted ? 'Mark Pending' : 'Mark Completed'}" 
                   onclick="taskManager.toggleStatus('${task._id}', '${isCompleted ? 'Pending' : 'Completed'}', event)">
                ${isCompleted ? '✓' : ''}
              </div>
              <h3 class="task-card-title">${escapeHtml(task.title)}</h3>
            </div>
            <span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span>
          </div>

          ${task.description ? `<p class="task-card-desc">${escapeHtml(task.description)}</p>` : ''}
          
          <div class="task-tags-row">
            ${tagsHtml}
          </div>
        </div>

        <div class="task-card-footer">
          <div class="task-meta-left">
            <span class="badge badge-${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span>
            <span style="font-size:0.75rem;">🏷️ ${escapeHtml(task.category)}</span>
            ${task.recurring && task.recurring.enabled ? `<span class="badge badge-recurring" title="Repeats ${task.recurring.frequency}">🔁 ${task.recurring.frequency}</span>` : ''}
          </div>
          <div>
            <span class="${isOverdue ? 'badge badge-overdue' : ''}">
              📅 ${isOverdue ? 'Overdue: ' : ''}${dueFormatted}
            </span>
          </div>
        </div>
      `;

      // Open detail modal when card clicked (excluding direct checkbox click)
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.task-checkbox')) {
          this.openTaskDetail(task._id);
        }
      });

      container.appendChild(card);
    });
  },

  async toggleStatus(taskId, newStatus, event) {
    if (event) event.stopPropagation();

    try {
      const res = await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      if (res.recurringCreated) {
        showToast('🎉 Task completed! Next recurring task generated.', 'success');
      } else {
        showToast(`Task marked as ${newStatus}`, 'info');
      }
      this.loadTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async quickCompleteFocus(taskId, event) {
    if (event) event.stopPropagation();
    await this.toggleStatus(taskId, 'Completed');
  },

  openTaskModal(taskId = null) {
    this.editingTaskId = taskId;
    const modal = document.getElementById('task-modal');
    const titleEl = document.getElementById('task-modal-title');
    const form = document.getElementById('task-form');

    form.reset();

    if (taskId) {
      titleEl.textContent = 'Edit Task';
      api.get(`/tasks/${taskId}`).then((data) => {
        const t = data.task;
        document.getElementById('task-title-input').value = t.title || '';
        document.getElementById('task-desc-input').value = t.description || '';
        document.getElementById('task-status-input').value = t.status || 'Pending';
        document.getElementById('task-priority-input').value = t.priority || 'Medium';
        document.getElementById('task-category-input').value = t.category || 'Work';
        document.getElementById('task-tags-input').value = (t.tags || []).join(', ');
        
        if (t.dueDate) {
          const d = new Date(t.dueDate);
          const formatted = d.toISOString().split('T')[0];
          document.getElementById('task-due-input').value = formatted;
        }

        const recCheck = document.getElementById('task-recurring-check');
        const recFreq = document.getElementById('task-recurring-freq');
        if (recCheck && t.recurring) {
          recCheck.checked = Boolean(t.recurring.enabled);
          if (recFreq) recFreq.value = t.recurring.frequency || 'daily';
        }
      });
    } else {
      titleEl.textContent = 'Create New Task';
      // Default due date: tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      document.getElementById('task-due-input').value = tomorrow.toISOString().split('T')[0];
    }

    modal.classList.add('active');
  },

  closeTaskModal() {
    const modal = document.getElementById('task-modal');
    modal.classList.remove('active');
    this.editingTaskId = null;
  },

  async handleTaskFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('task-title-input').value.trim();
    const description = document.getElementById('task-desc-input').value.trim();
    const status = document.getElementById('task-status-input').value;
    const priority = document.getElementById('task-priority-input').value;
    const category = document.getElementById('task-category-input').value;
    const tagsRaw = document.getElementById('task-tags-input').value;
    const dueDate = document.getElementById('task-due-input').value;
    const recurringEnabled = document.getElementById('task-recurring-check').checked;
    const recurringFrequency = document.getElementById('task-recurring-freq').value;

    const payload = {
      title,
      description,
      status,
      priority,
      category,
      tags: tagsRaw,
      dueDate: dueDate || null,
      recurring: {
        enabled: recurringEnabled,
        frequency: recurringFrequency,
      },
    };

    try {
      if (this.editingTaskId) {
        await api.put(`/tasks/${this.editingTaskId}`, payload);
        showToast('Task updated successfully!', 'success');
      } else {
        await api.post('/tasks', payload);
        showToast('Task created successfully!', 'success');
      }
      this.closeTaskModal();
      this.loadTasks();
    } catch (err) {
      showToast(err.data?.message || err.message, 'error');
    }
  },

  async openTaskDetail(taskId) {
    try {
      const data = await api.get(`/tasks/${taskId}`);
      const task = data.task;
      const modal = document.getElementById('detail-modal');

      document.getElementById('detail-title').textContent = task.title;
      document.getElementById('detail-desc').textContent = task.description || 'No description provided.';
      
      const statusBadge = document.getElementById('detail-status-badge');
      statusBadge.textContent = task.status;
      statusBadge.className = `badge badge-${task.status.toLowerCase().replace(' ', '-')}`;

      const priorityBadge = document.getElementById('detail-priority-badge');
      priorityBadge.textContent = `${task.priority} Priority`;
      priorityBadge.className = `badge badge-${task.priority.toLowerCase()}`;

      document.getElementById('detail-focus-score').textContent = `${task.focusScore} / 100`;
      document.getElementById('detail-category').textContent = task.category;
      
      const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleString() : 'None';
      document.getElementById('detail-due').textContent = dueStr;

      document.getElementById('detail-created').textContent = new Date(task.createdAt).toLocaleString();
      document.getElementById('detail-updated').textContent = new Date(task.updatedAt).toLocaleString();

      const tagsContainer = document.getElementById('detail-tags');
      tagsContainer.innerHTML = (task.tags || []).length > 0
        ? task.tags.map((t) => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')
        : '<span class="text-muted" style="font-size:0.8rem;">No tags</span>';

      const recInfo = document.getElementById('detail-recurring');
      if (task.recurring && task.recurring.enabled) {
        recInfo.textContent = `Repeats ${task.recurring.frequency}`;
      } else {
        recInfo.textContent = 'None (One-time task)';
      }

      // Detail action buttons
      const editBtn = document.getElementById('btn-detail-edit');
      const deleteBtn = document.getElementById('btn-detail-delete');

      editBtn.onclick = () => {
        this.closeDetailModal();
        this.openTaskModal(task._id);
      };

      deleteBtn.onclick = async () => {
        if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
          try {
            await api.delete(`/tasks/${task._id}`);
            showToast('Task deleted successfully', 'info');
            this.closeDetailModal();
            this.loadTasks();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      };

      modal.classList.add('active');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('active');
  },

  async promptAddCategory() {
    const name = prompt('Enter new category name:');
    if (!name || !name.trim()) return;

    try {
      await api.post('/categories', { name: name.trim() });
      showToast(`Category "${name}" created!`, 'success');
      await this.loadCategories();
    } catch (err) {
      showToast(err.data?.message || err.message, 'error');
    }
  },

  setupListeners() {
    // Search input debouncer
    const searchInput = document.getElementById('search-input');
    let searchTimeout = null;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.currentFilters.search = e.target.value;
          this.loadTasks();
        }, 300);
      });
    }

    // Filter selectors
    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', (e) => {
        this.currentFilters.status = e.target.value;
        this.loadTasks();
      });
    }

    const filterPriority = document.getElementById('filter-priority');
    if (filterPriority) {
      filterPriority.addEventListener('change', (e) => {
        this.currentFilters.priority = e.target.value;
        this.loadTasks();
      });
    }

    const filterCategory = document.getElementById('filter-category');
    if (filterCategory) {
      filterCategory.addEventListener('change', (e) => {
        this.currentFilters.category = e.target.value;
        this.renderCategorySidebar();
        this.loadTasks();
      });
    }

    const filterDate = document.getElementById('filter-date');
    if (filterDate) {
      filterDate.addEventListener('change', (e) => {
        this.currentFilters.dateFilter = e.target.value;
        this.loadTasks();
      });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentFilters.sort = e.target.value;
        this.loadTasks();
      });
    }

    // Task Form
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
      taskForm.addEventListener('submit', (e) => this.handleTaskFormSubmit(e));
    }

    // Sidebar navigation tabs
    const navItems = document.querySelectorAll('.nav-link-tab');
    navItems.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        const filterType = tab.getAttribute('data-filter');
        // Reset specific filters
        this.currentFilters.category = '';
        this.currentFilters.search = '';
        if (searchInput) searchInput.value = '';

        if (filterType === 'all') {
          this.currentFilters.status = '';
          this.currentFilters.dateFilter = '';
        } else if (filterType === 'pending') {
          this.currentFilters.status = 'Pending';
          this.currentFilters.dateFilter = '';
        } else if (filterType === 'today') {
          this.currentFilters.status = '';
          this.currentFilters.dateFilter = 'today';
        } else if (filterType === 'upcoming') {
          this.currentFilters.status = '';
          this.currentFilters.dateFilter = 'upcoming';
        } else if (filterType === 'completed') {
          this.currentFilters.status = 'Completed';
          this.currentFilters.dateFilter = '';
        }

        // Sync dropdowns
        if (filterStatus) filterStatus.value = this.currentFilters.status;
        if (filterDate) filterDate.value = this.currentFilters.dateFilter;

        this.renderCategorySidebar();
        this.loadTasks();
      });
    });

    // Mobile Hamburger
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mobileOverlay = document.getElementById('mobile-overlay');

    if (mobileToggle && sidebar && mobileOverlay) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        mobileOverlay.classList.toggle('active');
      });

      mobileOverlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        mobileOverlay.classList.remove('active');
      });
    }
  },
};
