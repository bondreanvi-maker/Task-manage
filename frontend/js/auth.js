/**
 * TaskFlow Authentication & Theme Controller
 */

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('taskflow_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('taskflow_theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const themeBtns = document.querySelectorAll('.theme-toggle-btn');
  themeBtns.forEach((btn) => {
    btn.innerHTML = theme === 'dark' 
      ? '<span>☀️</span> <span>Light Mode</span>' 
      : '<span>🌙</span> <span>Dark Mode</span>';
  });
}

// Check Authentication Route Guards
function checkAuthGuard() {
  const token = api.getToken();
  const path = window.location.pathname;

  const isAuthPage = path.endsWith('login.html') || path.endsWith('register.html');
  const isProtectedPage = path.endsWith('dashboard.html');

  if (isProtectedPage && !token) {
    window.location.href = 'login.html';
  } else if (isAuthPage && token) {
    window.location.href = 'dashboard.html';
  }
}

// User Profile Display
function renderUserProfile() {
  const user = api.getUser();
  if (!user) return;

  const nameEls = document.querySelectorAll('.user-name');
  const emailEls = document.querySelectorAll('.user-email');
  const avatarEls = document.querySelectorAll('.user-avatar');

  nameEls.forEach((el) => (el.textContent = user.name || 'User'));
  emailEls.forEach((el) => (el.textContent = user.email || 'user@taskflow.dev'));
  avatarEls.forEach((el) => {
    const initial = (user.name || 'U').charAt(0).toUpperCase();
    el.textContent = initial;
  });
}

// Logout Handler
async function handleLogout() {
  try {
    await api.post('/auth/logout', {});
  } catch {
    // proceed anyway
  } finally {
    api.clearAuth();
    showToast('Logged out successfully', 'info');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 400);
  }
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuthGuard();
  renderUserProfile();

  // Theme toggle listeners
  const themeBtns = document.querySelectorAll('.theme-toggle-btn');
  themeBtns.forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });

  // Logout buttons
  const logoutBtns = document.querySelectorAll('.btn-logout');
  logoutBtns.forEach((btn) => {
    btn.addEventListener('click', handleLogout);
  });

  // Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        const data = await api.post('/auth/login', { email, password });
        api.setToken(data.token);
        api.setUser(data.user);

        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 600);
      } catch (err) {
        showToast(err.data?.message || err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  }

  // Register Form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const submitBtn = registerForm.querySelector('button[type="submit"]');

      if (password !== confirmPassword) {
        showToast('Passwords do not match!', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        const data = await api.post('/auth/register', { name, email, password });
        api.setToken(data.token);
        api.setUser(data.user);

        showToast('Account created successfully!', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 600);
      } catch (err) {
        showToast(err.data?.message || err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    });
  }
});
