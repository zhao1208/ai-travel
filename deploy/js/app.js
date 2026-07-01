// ===== AI Travel Assistant - Main App =====

let currentPage = 'home';
let currentPhraseCat = 'greetings';
let currentCity = null;
let chatMessages = [];
let chatHistory = [];
let currentChatId = null;
let translateResult = null;
let translateInputText = '';
let translateFromLang = '';
let translateToLang = '';
let currentAdminTab = 'models';
let authMode = 'login'; // 'login' | 'register'

// ===== Auth State =====
const ADMIN_EMAILS = ['admin@travelmate.com', 'root@travelmate.com', 'admin@example.com'];

function isAdmin(user) {
  return user && ADMIN_EMAILS.includes(user.email);
}

function getAuthUser() {
  try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch { return null; }
}

function setAuthUser(user) {
  if (user) localStorage.setItem('authUser', JSON.stringify(user));
  else localStorage.removeItem('authUser');
}

function isLoggedIn() { return !!getAuthUser(); }

function getRegisteredUsers() {
  try { return JSON.parse(localStorage.getItem('registeredUsers') || '{}'); } catch { return {}; }
}

function saveRegisteredUsers(users) {
  localStorage.setItem('registeredUsers', JSON.stringify(users));
}

// Auth actions
function doLogin(email, password) {
  const users = getRegisteredUsers();
  if (!users[email]) return { ok: false, key: 'auth_err_not_found' };
  if (users[email].password !== password) return { ok: false, key: 'auth_err_wrong_pw' };
  // Sync admin role based on email
  users[email].role = ADMIN_EMAILS.includes(email) ? 'admin' : (users[email].role || 'user');
  saveRegisteredUsers(users);
  setAuthUser(users[email]);
  return { ok: true };
}

function doRegister(name, email, password) {
  const users = getRegisteredUsers();
  if (users[email]) return { ok: false, key: 'auth_err_exists' };
  const user = { name, email, password, avatar: name.charAt(0).toUpperCase(), joinedAt: new Date().toISOString(), role: ADMIN_EMAILS.includes(email) ? 'admin' : 'user' };
  users[email] = user;
  saveRegisteredUsers(users);
  setAuthUser(user);
  return { ok: true };
}

function doLogout() {
  setAuthUser(null);
  currentPage = 'home';
  render();
}

// ===== Chat History =====
function loadChatHistory() {
  try { chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]'); } catch { chatHistory = []; }
}

function saveChatHistory() {
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory.slice(0, 20)));
}

function startNewChat() {
  if (chatMessages.length > 0 && currentChatId) {
    const existing = chatHistory.find(h => h.id === currentChatId);
    if (existing) {
      existing.messages = [...chatMessages];
      existing.updatedAt = new Date().toISOString();
    }
  }
  currentChatId = 'chat_' + Date.now();
  chatMessages = [];
  render();
}

function saveCurrentChat() {
  if (chatMessages.length === 0) return;
  const firstUserMsg = chatMessages.find(m => m.role === 'user');
  const title = firstUserMsg ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : 'New Chat';
  const existing = chatHistory.find(h => h.id === currentChatId);
  if (existing) {
    existing.messages = [...chatMessages];
    existing.title = title;
    existing.updatedAt = new Date().toISOString();
  } else {
    chatHistory.unshift({ id: currentChatId, title, messages: [...chatMessages], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  saveChatHistory();
}

function loadChat(id) {
  const chat = chatHistory.find(h => h.id === id);
  if (!chat) return;
  currentChatId = id;
  chatMessages = [...chat.messages];
  render();
}

function deleteChat(id, e) {
  e.stopPropagation();
  chatHistory = chatHistory.filter(h => h.id !== id);
  saveChatHistory();
  if (currentChatId === id) {
    currentChatId = null;
    chatMessages = [];
  }
  render();
}

// ===== Admin mock data =====
let adminModels = [
  { id: 'm1', provider: 'OpenAI', modelKey: 'gpt-4o', apiBase: 'https://api.openai.com/v1', isEnabled: true, priority: 1, timeoutMs: 30000, maxTokens: 4096, temperature: 0.7, supportsStreaming: true, supportsVision: true },
  { id: 'm2', provider: 'OpenAI', modelKey: 'gpt-4o-mini', apiBase: 'https://api.openai.com/v1', isEnabled: true, priority: 2, timeoutMs: 20000, maxTokens: 4096, temperature: 0.7, supportsStreaming: true, supportsVision: false },
  { id: 'm3', provider: 'Anthropic', modelKey: 'claude-sonnet-4-20250514', apiBase: 'https://api.anthropic.com/v1', isEnabled: true, priority: 3, timeoutMs: 30000, maxTokens: 4096, temperature: 0.5, supportsStreaming: true, supportsVision: true },
  { id: 'm4', provider: 'DeepSeek', modelKey: 'deepseek-chat', apiBase: 'https://api.deepseek.com/v1', isEnabled: false, priority: 4, timeoutMs: 20000, maxTokens: 4096, temperature: 0.7, supportsStreaming: true, supportsVision: false },
  { id: 'm5', provider: '百度文心', modelKey: 'ernie-4.0-8k', apiBase: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1', isEnabled: false, priority: 5, timeoutMs: 20000, maxTokens: 4096, temperature: 0.7, supportsStreaming: false, supportsVision: false },
];

let adminPrompts = [
  { id: 'p1', sceneCode: 'trip_planning', name: 'Trip Planner', language: 'en', version: 3, isPublished: true },
  { id: 'p2', sceneCode: 'translator', name: 'Travel Translator', language: 'en', version: 2, isPublished: true },
  { id: 'p3', sceneCode: 'local_guide', name: 'Local Guide', language: 'en', version: 1, isPublished: false },
  { id: 'p4', sceneCode: 'food_helper', name: 'Food Advisor', language: 'zh', version: 2, isPublished: true },
];

// ===== Router =====
function navigate(page, data) {
  currentPage = page;
  if (data && page === 'city') currentCity = data;
  render();
  window.scrollTo(0, 0);
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = renderLayout();
  bindEvents();
}

// ===== Layout =====
function renderLayout() {
  return `
    <div class="app-layout">
      ${renderSidebar()}
      <div class="main-content">
        ${renderContentHeader()}
        <div class="content-body">
          ${renderPage()}
        </div>
      </div>
    </div>
  `;
}

// ===== Sidebar =====
function renderSidebar() {
  const user = getAuthUser();
  const isZh = getLang() === 'zh';

  const navItems = [
    { page: 'home', icon: '🏠', label: t('nav_home'), section: 'main', mobile: true },
    { page: 'chat', icon: '💬', label: t('nav_chat'), section: 'main', mobile: true },
    { page: 'translate', icon: '🌐', label: t('translate_title'), section: 'tools', mobile: true },
    { page: 'phrases', icon: '📝', label: t('nav_phrases'), section: 'tools', mobile: true },
    { page: 'city', icon: '🏙️', label: isZh ? '城市' : 'Cities', section: 'tools', mobile: true },
    { page: 'profile', icon: '👤', label: t('nav_profile'), section: 'account', mobile: false },
  ];

  if (isAdmin(user)) {
    navItems.push({ page: 'admin', icon: '⚙️', label: isZh ? '管理后台' : 'Admin', section: 'account', mobile: false });
  }

  const sections = { main: isZh ? '主要' : 'Main', tools: isZh ? '工具' : 'Tools', account: isZh ? '账户' : 'Account' };

  let lastSection = '', navHtml = '';
  navItems.forEach(item => {
    if (item.section !== lastSection) {
      navHtml += `<div class="nav-section-label">${sections[item.section]}</div>`;
      lastSection = item.section;
    }
    navHtml += `
      <button class="nav-item ${currentPage === item.page ? 'active' : ''}" data-mobile="${item.mobile}" onclick="navigate('${item.page}')">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>
    `;
  });

  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">✈</div>
        <div>
          <h1>TravelMate AI</h1>
          <div class="brand-sub">${isZh ? '旅行智能助手' : 'Smart Travel Assistant'}</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${navHtml}
      </nav>
      <div class="sidebar-footer">
        ${user ? `
          <div class="sidebar-user" onclick="navigate('profile')" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;margin-bottom:8px;transition:background 0.2s" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='transparent'">
            <div style="width:32px;height:32px;border-radius:50%;background:${isAdmin(user) ? 'linear-gradient(135deg,#FAAD14,#FF4D4F)' : 'var(--primary)'};color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">${user.avatar || user.name.charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.name}${isAdmin(user) ? ' <span style="font-size:10px;background:linear-gradient(135deg,#FAAD14,#FF4D4F);color:white;padding:1px 6px;border-radius:8px;font-weight:600">Admin</span>' : ''}</div>
              <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.email}</div>
            </div>
          </div>
        ` : `
          <button class="btn btn-primary btn-sm" style="width:100%;margin-bottom:8px" onclick="navigate('auth')">
            ${isZh ? '登录 / 注册' : 'Sign In'}
          </button>
        `}
        <div class="lang-switch-desktop">
          <button class="${getLang() === 'en' ? 'active' : ''}" onclick="switchLang('en')">EN</button>
          <button class="${getLang() === 'zh' ? 'active' : ''}" onclick="switchLang('zh')">中文</button>
        </div>
      </div>
    </aside>
  `;
}

// ===== Content Header =====
function renderContentHeader() {
  const user = getAuthUser();
  const isZh = getLang() === 'zh';
  const titles = {
    home: isZh ? '首页' : 'Home',
    chat: t('chat_title'),
    translate: t('translate_title'),
    city: currentCity ? t(currentCity + '_name') : (isZh ? '城市探索' : 'Explore Cities'),
    phrases: t('phrases_title'),
    profile: t('profile_title'),
    admin: isZh ? '管理员后台' : 'Admin Panel',
    auth: currentPage === 'auth' ? (authMode === 'login' ? t('auth_login') : t('auth_register')) : '',
  };

  return `
    <header class="content-header">
      <h2>${titles[currentPage] || ''}</h2>
      <div class="header-actions">
        <div class="lang-switch-mobile">
          <button class="${getLang() === 'en' ? 'active' : ''}" onclick="switchLang('en')">EN</button>
          <button class="${getLang() === 'zh' ? 'active' : ''}" onclick="switchLang('zh')">中文</button>
        </div>
        ${currentPage === 'chat' ? `<button class="new-chat-btn" onclick="newChat()">+ ${isZh ? '新对话' : 'New Chat'}</button>` : ''}
        ${currentPage === 'admin' && currentAdminTab === 'models' ? `<button class="btn btn-primary btn-sm" onclick="showAddModelForm()">+ ${isZh ? '添加模型' : 'Add Model'}</button>` : ''}
        ${user ? `
          <div class="header-user" style="display:flex;align-items:center;gap:8px">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">${user.avatar || user.name.charAt(0).toUpperCase()}</div>
          </div>
        ` : ''}
      </div>
    </header>
  `;
}

// ===== Page Router =====
function renderPage() {
  switch (currentPage) {
    case 'home': return renderHome();
    case 'chat': return renderChat();
    case 'translate': return renderTranslate();
    case 'city': return renderCity();
    case 'phrases': return renderPhrases();
    case 'profile': return renderProfile();
    case 'admin': return renderAdmin();
    case 'auth': return renderAuth();
    default: return renderHome();
  }
}

// ==========================
// AUTH PAGE
// ==========================
function renderAuth() {
  const isZh = getLang() === 'zh';
  const isLogin = authMode === 'login';

  return `
    <div class="page" style="display:flex;justify-content:center;align-items:flex-start;padding-top:40px">
      <div class="auth-container" style="width:100%;max-width:440px">
        <!-- Card -->
        <div class="card" style="overflow:visible">
          <div class="card-body" style="padding:40px 36px">
            <!-- Header -->
            <div style="text-align:center;margin-bottom:32px">
              <div style="width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,var(--primary),var(--primary-light));margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:32px;color:white">✈</div>
              <h2 style="font-size:24px;font-weight:800;margin-bottom:6px">
                ${isLogin ? t('auth_welcome_back') : t('auth_welcome_new')}
              </h2>
              <p style="font-size:14px;color:var(--text-muted)">
                ${isLogin ? t('auth_subtitle_login') : t('auth_subtitle_register')}
              </p>
            </div>

            <!-- Form -->
            <div id="authForm">
              ${!isLogin ? `
                <div class="form-group">
                  <label>${t('auth_name')}</label>
                  <input type="text" id="authName" placeholder="${t('auth_name_placeholder')}" autocomplete="name">
                </div>
              ` : ''}

              <div class="form-group">
                <label>${t('auth_email')}</label>
                <input type="email" id="authEmail" placeholder="${t('auth_email_placeholder')}" autocomplete="email">
              </div>

              <div class="form-group">
                <label>${t('auth_password')}</label>
                <input type="password" id="authPassword" placeholder="${t('auth_password_placeholder')}" autocomplete="${isLogin ? 'current-password' : 'new-password'}">
              </div>

              ${!isLogin ? `
                <div class="form-group">
                  <label>${t('auth_confirm_password')}</label>
                  <input type="password" id="authConfirmPw" placeholder="${t('auth_password_placeholder')}" autocomplete="new-password">
                </div>
              ` : ''}

              <div id="authError" style="color:var(--danger);font-size:13px;margin-bottom:12px;min-height:20px"></div>

              ${isLogin ? `
                <div style="text-align:right;margin-bottom:16px">
                  <button style="font-size:13px;color:var(--primary);font-weight:500" onclick="showToast('${isZh ? '重置密码功能开发中' : 'Password reset coming soon'}')">${t('auth_forgot')}</button>
                </div>
              ` : `
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;line-height:1.5">
                  ${t('auth_agree')} <a href="#" style="color:var(--primary)">${t('auth_terms')}</a> ${t('auth_and')} <a href="#" style="color:var(--primary)">${t('auth_privacy')}</a>
                </div>
              `}

              <button class="btn btn-primary" style="width:100%;height:48px;font-size:16px;border-radius:24px" onclick="submitAuth()">
                ${isLogin ? t('auth_sign_in') : t('auth_sign_up')}
              </button>
            </div>

            <!-- Divider -->
            <div style="display:flex;align-items:center;gap:16px;margin:24px 0">
              <div style="flex:1;height:1px;background:var(--border)"></div>
              <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${t('auth_or')}</span>
              <div style="flex:1;height:1px;background:var(--border)"></div>
            </div>

            <!-- Social Login -->
            <div style="display:flex;gap:12px">
              <button class="btn btn-secondary" style="flex:1;height:44px;justify-content:center;gap:8px" onclick="socialLogin('google')">
                <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z"/></svg>
                ${t('auth_google')}
              </button>
              <button class="btn btn-secondary" style="flex:1;height:44px;justify-content:center;gap:8px" onclick="socialLogin('wechat')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#07C160"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.109.24-.245 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 01.176-.554C23.016 18.514 24 16.89 24 15.075c0-3.39-3.105-6.163-7.062-6.217zm-2.634 2.87c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.983.97-.983zm5.262 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.983.97-.983z"/></svg>
                ${t('auth_wechat')}
              </button>
            </div>

            <!-- Switch mode -->
            <div style="text-align:center;margin-top:24px;font-size:14px;color:var(--text-secondary)">
              ${isLogin ? t('auth_no_account') : t('auth_has_account')}
              <button style="color:var(--primary);font-weight:600;margin-left:4px" onclick="toggleAuthMode()">
                ${isLogin ? t('auth_sign_up') : t('auth_sign_in')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  render();
}

function submitAuth() {
  const email = document.getElementById('authEmail')?.value?.trim();
  const password = document.getElementById('authPassword')?.value;
  const errEl = document.getElementById('authError');
  const isZh = getLang() === 'zh';

  // Validate email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = t('auth_err_email');
    return;
  }

  // Validate password
  if (!password || password.length < 8) {
    errEl.textContent = t('auth_err_password');
    return;
  }

  if (authMode === 'register') {
    const name = document.getElementById('authName')?.value?.trim();
    const confirmPw = document.getElementById('authConfirmPw')?.value;

    if (!name) { errEl.textContent = t('auth_err_name'); return; }
    if (password !== confirmPw) { errEl.textContent = t('auth_err_confirm'); return; }

    const result = doRegister(name, email, password);
    if (!result.ok) { errEl.textContent = t(result.key); return; }

    showToast(t('auth_success_register'));
    currentPage = 'home';
    render();
  } else {
    const result = doLogin(email, password);
    if (!result.ok) { errEl.textContent = t(result.key); return; }

    showToast(t('auth_success_login'));
    currentPage = 'home';
    render();
  }
}

function socialLogin(provider) {
  // Redirect to OAuth endpoint
  if (provider === 'google') {
    window.location.href = '/auth/google';
  } else if (provider === 'wechat') {
    window.location.href = '/auth/wechat';
  }
}

// ==========================
// HOME PAGE
// ==========================
function renderHome() {
  const cities = [
    { slug: 'shanghai', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', tags: ['Modern', 'Food', 'Nightlife'], descKey: 'shanghai_desc' },
    { slug: 'beijing', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', tags: ['History', 'Culture', 'Great Wall'], descKey: 'beijing_desc' },
    { slug: 'chengdu', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', tags: ['Pandas', 'Spicy Food', 'Tea'], descKey: 'chengdu_desc' },
    { slug: 'xian', gradient: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)', tags: ['Terracotta', 'Silk Road', 'History'], descKey: 'xian_desc' },
    { slug: 'hangzhou', gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', tags: ['West Lake', 'Tea', 'Nature'], descKey: 'hangzhou_desc' },
    { slug: 'guangzhou', gradient: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)', tags: ['Dim Sum', 'Canton Tower', 'Culture'], descKey: 'guangzhou_desc' },
  ];

  const suggestions = [
    { key: 'home_sug_1', icon: '🍜' },
    { key: 'home_sug_2', icon: '📱' },
    { key: 'home_sug_3', icon: '🏯' },
    { key: 'home_sug_4', icon: '🍵' },
  ];

  return `
    <div class="page">
      <div style="margin-bottom:28px">
        <div class="search-bar">
          <input type="text" placeholder="${t('home_search')}" onfocus="navigate('chat')" readonly>
          <span class="search-icon">🔍</span>
        </div>
      </div>
      <div class="quick-actions">
        <div class="action-card" onclick="navigate('translate')">
          <div class="action-icon blue">🌐</div>
          <div class="action-text"><div class="action-title">${t('home_quick_translate')}</div><div class="action-desc">${t('home_quick_translate_desc')}</div></div>
        </div>
        <div class="action-card" onclick="navigate('chat')">
          <div class="action-icon green">🤖</div>
          <div class="action-text"><div class="action-title">${t('home_ai_chat')}</div><div class="action-desc">${t('home_ai_chat_desc')}</div></div>
        </div>
        <div class="action-card" onclick="showToast(getLang() === 'zh' ? '即将推出' : 'Coming soon')">
          <div class="action-icon orange">📸</div>
          <div class="action-text"><div class="action-title">${t('home_camera')}</div><div class="action-desc">${t('home_camera_desc')}</div></div>
        </div>
        <div class="action-card" onclick="navigate('phrases')">
          <div class="action-icon purple">📖</div>
          <div class="action-text"><div class="action-title">${t('home_phrases')}</div><div class="action-desc">${t('home_phrases_desc')}</div></div>
        </div>
      </div>
      <div class="section-header"><h2>${t('home_featured')}</h2><button class="see-all">${t('home_see_all')} →</button></div>
      <div class="city-grid">
        ${cities.map(city => `
          <div class="city-card" onclick="navigate('city', '${city.slug}')">
            <div class="city-cover" style="background:${city.gradient}">
              <span class="city-badge">${t('city_offline')}</span>
              <span class="city-name">${t(city.slug + '_name')}</span>
            </div>
            <div class="city-info">
              <div class="city-desc">${t(city.descKey).substring(0, 80)}...</div>
              <div class="city-tags">${city.tags.map(tag => `<span class="city-tag">${tag}</span>`).join('')}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="section-header"><h2>${t('home_suggestions')}</h2></div>
      <div class="suggestions-grid">
        ${suggestions.map(s => `<div class="suggestion-card" onclick="navigate('chat')"><span class="sug-icon">${s.icon}</span><span class="sug-text">${t(s.key)}</span></div>`).join('')}
      </div>
    </div>
  `;
}

// ==========================
// API Functions
// ==========================
async function callChatAPI(messages) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.content;
  } catch (e) {
    console.error('Chat API error:', e);
    throw e;
  }
}

async function callTranslateAPI(text, from, to) {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from, to })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch (e) {
    console.error('Translate API error:', e);
    throw e;
  }
}

// Web Speech API TTS
function speakText(text, lang = 'zh-CN') {
  if (!('speechSynthesis' in window)) {
    showToast(getLang() === 'zh' ? '浏览器不支持语音功能' : 'Speech not supported');
    return;
  }
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.pitch = 1;
  
  // Try to find a voice for the language
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
  if (voice) utterance.voice = voice;
  
  utterance.onerror = () => {
    showToast(getLang() === 'zh' ? '语音播放失败' : 'Speech failed');
  };
  
  window.speechSynthesis.speak(utterance);
}

// ==========================
// CHAT PAGE
// ==========================
function renderChat() {
  if (chatMessages.length === 0) chatMessages = [{ role: 'assistant', content: t('chat_welcome') }];
  const suggestions = [t('chat_suggest_1'), t('chat_suggest_2'), t('chat_suggest_3'), t('chat_suggest_4')];

  return `
    <div class="page chat-layout" id="chat-page">
      <div class="chat-sidebar">
        <div class="chat-sidebar-header">
          <h3>${getLang() === 'zh' ? '对话历史' : 'History'}</h3>
          <button class="btn btn-primary btn-sm" onclick="startNewChat()" style="padding:4px 12px;font-size:12px">+ ${getLang() === 'zh' ? '新对话' : 'New'}</button>
        </div>
        <div class="chat-history">
          ${chatHistory.map(h => `
            <div class="chat-history-item ${currentChatId === h.id ? 'active' : ''}" onclick="loadChat('${h.id}')">
              <div style="flex:1;overflow:hidden">
                <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.title}</div>
                <div class="ch-time">${new Date(h.updatedAt).toLocaleDateString()}</div>
              </div>
              <button onclick="deleteChat('${h.id}', event)" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:2px 4px;flex-shrink:0" title="Delete">×</button>
            </div>
          `).join('')}
          ${chatHistory.length === 0 ? `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">${getLang() === 'zh' ? '暂无历史对话' : 'No chat history yet'}</div>` : ''}
        </div>
      </div>
      <div class="chat-main">
        <div class="chat-messages" id="chatMessages">
          ${chatMessages.map(msg => renderChatMsg(msg)).join('')}
          ${chatMessages.length <= 1 ? `<div class="suggestion-chips">${suggestions.map(s => `<button class="suggestion-chip" onclick="sendChat('${s.replace(/'/g, "\\'")}')">${s}</button>`).join('')}</div>` : ''}
        </div>
        <div class="chat-input-bar">
          <textarea id="chatInput" rows="1" placeholder="${t('chat_placeholder')}" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChatFromInput()}"></textarea>
          <button class="send-btn" onclick="sendChatFromInput()">➤</button>
        </div>
      </div>
    </div>
  `;
}

function renderChatMsg(msg) {
  if (msg.loading) return `<div class="chat-msg assistant"><div class="chat-avatar">🤖</div><div class="chat-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>`;
  return `<div class="chat-msg ${msg.role}"><div class="chat-avatar">${msg.role === 'user' ? '🧑' : '🤖'}</div><div class="chat-bubble">${formatMsg(msg.content)}</div></div>`;
}

function formatMsg(c) { return c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>').replace(/•/g, '&bull;'); }
function sendChatFromInput() { const i = document.getElementById('chatInput'); if (!i || !i.value.trim()) return; sendChat(i.value.trim()); i.value = ''; }
function newChat() { chatMessages = []; render(); }

async function sendChat(message) {
  if (!currentChatId) currentChatId = 'chat_' + Date.now();
  chatMessages.push({ role: 'user', content: message });
  chatMessages.push({ role: 'assistant', content: '', loading: true });
  render();
  scrollChatToBottom();
  
  try {
    const aiMessages = chatMessages
      .filter(m => !m.loading)
      .map(m => ({ role: m.role, content: m.content }));
    
    const systemPrompt = getLang() === 'zh' 
      ? `你是 TravelMate AI，一个专为中国游客提供帮助的旅行助手。你的专长包括：行程规划、美食推荐、交通指引、翻译帮助、文化介绍。请用中文回答，语气友好专业。`
      : `You are TravelMate AI, a travel assistant helping visitors to China. Your expertise includes: trip planning, food recommendations, transport guidance, translation help, and culture introduction. Be friendly and professional.`;
    
    const response = await callChatAPI([
      { role: 'system', content: systemPrompt },
      ...aiMessages.slice(-10)
    ]);
    
    const loadingIdx = chatMessages.findIndex(m => m.loading);
    if (loadingIdx !== -1) {
      chatMessages[loadingIdx] = { role: 'assistant', content: response };
    }
  } catch (e) {
    const loadingIdx = chatMessages.findIndex(m => m.loading);
    if (loadingIdx !== -1) {
      chatMessages[loadingIdx] = { 
        role: 'assistant', 
        content: getLang() === 'zh' 
          ? '抱歉，AI 服务暂时不可用，请稍后重试。' 
          : 'Sorry, AI service is temporarily unavailable. Please try again later.' 
      };
    }
  }
  
  saveCurrentChat();
  render();
  scrollChatToBottom();
}

function scrollChatToBottom() {
  setTimeout(() => { 
    const el = document.getElementById('chatMessages'); 
    if (el) el.scrollTop = el.scrollHeight; 
  }, 50);
}

// ==========================
// TRANSLATE PAGE
// ==========================
function renderTranslate() {
  return `
    <div class="page">
      <div class="translate-layout">
        <div class="translate-panel">
          <div class="lang-bar"><select id="fromLang"><option value="en">${t('lang_en')}</option><option value="zh">${t('lang_zh')}</option></select></div>
          <div class="panel-body">
            <textarea id="translateInput" placeholder="${t('translate_input_placeholder')}">${translateInputText}</textarea>
            <button class="translate-btn" onclick="doTranslate()">${t('translate_btn')}</button>
          </div>
        </div>
        <div class="translate-panel">
          <div class="lang-bar">
            <select id="toLang"><option value="zh">${t('lang_zh')}</option><option value="en">${t('lang_en')}</option></select>
            <button class="swap-btn" onclick="swapLangs()" title="${t('translate_swap')}">⇄</button>
          </div>
          <div class="panel-body">
            ${translateResult ? `
              <div class="result-text">${translateResult.text}</div>
              ${translateResult.pinyin ? `<div class="pinyin-text">${translateResult.pinyin}</div>` : ''}
              <div class="translate-actions">
                <button onclick="copyResult()">📋 ${t('translate_copy')}</button>
                <button onclick="showFullscreen()">🔍 ${t('translate_fullscreen')}</button>
                <button onclick="speakTranslation()">🔊 ${t('translate_audio')}</button>
                <button onclick="showToast('${getLang() === 'zh' ? '已保存' : 'Saved!'}')">⭐ ${t('translate_save')}</button>
              </div>
            ` : `<div class="empty-state"><div class="empty-icon">🌐</div><h3>${getLang() === 'zh' ? '输入文字开始翻译' : 'Enter text to translate'}</h3><p>${getLang() === 'zh' ? '支持中英文互译' : 'Supports Chinese ↔ English'}</p></div>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

async function doTranslate() {
  const input = document.getElementById('translateInput');
  if (!input || !input.value.trim()) return;
  
  const text = input.value.trim();
  translateInputText = text;
  const fromLang = document.getElementById('fromLang').value;
  const toLang = document.getElementById('toLang').value;
  translateFromLang = fromLang;
  translateToLang = toLang;
  
  translateResult = { text: '...', pinyin: null };
  render();
  
  try {
    const result = await callTranslateAPI(text, fromLang, toLang);
    translateResult = result;
  } catch (e) {
    translateResult = { 
      text: getLang() === 'zh' ? '翻译失败，请重试' : 'Translation failed, please try again',
      pinyin: null 
    };
  }
  render();
}

function speakTranslation() {
  if (!translateResult || !translateResult.text) return;
  const toLang = document.getElementById('toLang').value;
  const lang = toLang === 'zh' ? 'zh-CN' : 'en-US';
  speakText(translateResult.text, lang);
}

function swapLangs() { 
  const f = document.getElementById('fromLang'), t2 = document.getElementById('toLang'); 
  const tmp = f.value; 
  f.value = t2.value; 
  t2.value = tmp; 
}
function copyResult() { 
  if (translateResult) { 
    navigator.clipboard?.writeText(translateResult.text).catch(() => {}); 
    showToast(t('translate_copied')); 
  } 
}
function showFullscreen() { 
  if (!translateResult) return; 
  const ov = document.createElement('div'); 
  ov.className = 'fullscreen-overlay'; 
  ov.id = 'fullscreenOverlay'; 
  ov.innerHTML = `<button class="fs-close" onclick="closeFullscreen()">✕</button><div class="fs-text">${translateResult.text}</div>${translateResult.pinyin ? `<div class="fs-pinyin">${translateResult.pinyin}</div>` : ''}`; 
  ov.onclick = e => { if (e.target === ov) closeFullscreen(); }; 
  document.body.appendChild(ov); 
}
function closeFullscreen() { document.getElementById('fullscreenOverlay')?.remove(); document.getElementById('modelFormOverlay')?.remove(); }

// ==========================
// CITY PAGE
// ==========================
function renderCity() {
  const city = currentCity || 'shanghai';
  const allCities = ['shanghai', 'beijing', 'chengdu', 'xian', 'hangzhou', 'guangzhou'];
  const cityGradients = {
    shanghai: '#667eea, #764ba2',
    beijing: '#f093fb, #f5576c',
    chengdu: '#4facfe, #00f2fe',
    xian: '#f5af19, #f12711',
    hangzhou: '#11998e, #38ef7d',
    guangzhou: '#ee9ca7, #ffdde1',
  };
  const places = {
    shanghai: [
      { icon: '🏙️', name: getLang() === 'zh' ? '外滩' : 'The Bund', desc: getLang() === 'zh' ? '上海标志性天际线' : 'Iconic skyline', meta: '⭐ 4.8 · Free' },
      { icon: '🏮', name: getLang() === 'zh' ? '豫园' : 'Yu Garden', desc: getLang() === 'zh' ? '明代古典园林' : 'Ming Dynasty garden', meta: '⭐ 4.6 · ¥40' },
      { icon: '🛍️', name: getLang() === 'zh' ? '南京路' : 'Nanjing Road', desc: getLang() === 'zh' ? '繁华购物街' : 'Shopping paradise', meta: '⭐ 4.5 · Free' },
      { icon: '🌃', name: getLang() === 'zh' ? '新天地' : 'Xintiandi', desc: getLang() === 'zh' ? '时尚餐饮区' : 'Dining & nightlife', meta: '⭐ 4.7 · Free' },
    ],
    beijing: [
      { icon: '🏯', name: getLang() === 'zh' ? '故宫' : 'Forbidden City', desc: getLang() === 'zh' ? '明清皇宫' : 'Imperial palace', meta: '⭐ 4.9 · ¥60' },
      { icon: '🧱', name: getLang() === 'zh' ? '长城' : 'Great Wall', desc: getLang() === 'zh' ? '世界奇迹' : 'World wonder', meta: '⭐ 4.9 · ¥40' },
      { icon: '🛕', name: getLang() === 'zh' ? '天坛' : 'Temple of Heaven', desc: getLang() === 'zh' ? '祭天建筑群' : 'Sacrificial complex', meta: '⭐ 4.7 · ¥34' },
      { icon: '🎨', name: getLang() === 'zh' ? '798艺术区' : '798 Art District', desc: getLang() === 'zh' ? '当代艺术' : 'Contemporary art', meta: '⭐ 4.5 · Free' },
    ],
    chengdu: [
      { icon: '🐼', name: getLang() === 'zh' ? '大熊猫基地' : 'Panda Base', desc: getLang() === 'zh' ? '大熊猫繁育基地' : 'Giant panda center', meta: '⭐ 4.9 · ¥55' },
      { icon: '🏮', name: getLang() === 'zh' ? '锦里古街' : 'Jinli Street', desc: getLang() === 'zh' ? '古色古香步行街' : 'Ancient street', meta: '⭐ 4.6 · Free' },
      { icon: '🍵', name: getLang() === 'zh' ? '宽窄巷子' : 'Kuanzhai Alley', desc: getLang() === 'zh' ? '清代老街区' : 'Qing Dynasty lanes', meta: '⭐ 4.7 · Free' },
      { icon: '🌶️', name: getLang() === 'zh' ? '小龙坎火锅' : 'Hotpot', desc: getLang() === 'zh' ? '正宗四川火锅' : 'Authentic Sichuan', meta: '⭐ 4.8 · ¥120' },
    ],
    xian: [
      { icon: '🗿', name: getLang() === 'zh' ? '兵马俑' : 'Terracotta Army', desc: getLang() === 'zh' ? '世界第八大奇迹' : 'Eighth wonder of the world', meta: '⭐ 4.9 · ¥120' },
      { icon: '🏯', name: getLang() === 'zh' ? '古城墙' : 'City Wall', desc: getLang() === 'zh' ? '明代古城墙' : 'Ming Dynasty wall', meta: '⭐ 4.7 · ¥54' },
      { icon: '🕌', name: getLang() === 'zh' ? '回民街' : 'Muslim Quarter', desc: getLang() === 'zh' ? '美食文化街' : 'Food & culture street', meta: '⭐ 4.5 · Free' },
      { icon: '🔔', name: getLang() === 'zh' ? '钟楼' : 'Bell Tower', desc: getLang() === 'zh' ? '城市地标' : 'City landmark', meta: '⭐ 4.6 · ¥30' },
    ],
    hangzhou: [
      { icon: '🏞️', name: getLang() === 'zh' ? '西湖' : 'West Lake', desc: getLang() === 'zh' ? '世界文化遗产' : 'UNESCO World Heritage', meta: '⭐ 4.9 · Free' },
      { icon: '🍵', name: getLang() === 'zh' ? '龙井茶园' : 'Longjing Tea Fields', desc: getLang() === 'zh' ? '龙井茶产地' : 'Dragon Well tea origin', meta: '⭐ 4.7 · Free' },
      { icon: '🏛️', name: getLang() === 'zh' ? '灵隐寺' : 'Lingyin Temple', desc: getLang() === 'zh' ? '千年古刹' : 'Ancient Buddhist temple', meta: '⭐ 4.7 · ¥75' },
      { icon: '🌉', name: getLang() === 'zh' ? '断桥' : 'Broken Bridge', desc: getLang() === 'zh' ? '西湖十景之一' : 'West Lake scenic spot', meta: '⭐ 4.6 · Free' },
    ],
    guangzhou: [
      { icon: '🗼', name: getLang() === 'zh' ? '广州塔' : 'Canton Tower', desc: getLang() === 'zh' ? '小蛮腰地标' : 'Iconic landmark tower', meta: '⭐ 4.7 · ¥150' },
      { icon: '🍜', name: getLang() === 'zh' ? '上下九步行街' : 'Shangxiajiu Street', desc: getLang() === 'zh' ? '美食购物街' : 'Food & shopping street', meta: '⭐ 4.5 · Free' },
      { icon: '🏛️', name: getLang() === 'zh' ? '陈家祠' : 'Chen Clan Ancestral Hall', desc: getLang() === 'zh' ? '岭南建筑瑰宝' : 'Lingnan architecture', meta: '⭐ 4.7 · ¥10' },
      { icon: '🌳', name: getLang() === 'zh' ? '白云山' : 'Baiyun Mountain', desc: getLang() === 'zh' ? '城市绿肺' : 'City green lung', meta: '⭐ 4.5 · ¥5' },
    ],
  };

  return `
    <div class="page">
      <div class="city-tabs-bar">
        ${allCities.map(c => `<button class="city-tab-btn ${city === c ? 'active' : ''}" onclick="navigate('city', '${c}')">${t(c + '_name')}</button>`).join('')}
      </div>
      <div class="city-hero" style="background:linear-gradient(135deg, ${cityGradients[city] || cityGradients.shanghai})">
        <div class="city-hero-content"><h1>${t(city + '_name')}</h1><p>${t(city + '_tagline')}</p></div>
      </div>
      <div class="city-detail-grid">
        <div>
          <div class="info-card"><h3>📋 ${t('city_overview')}</h3><p>${t(city + '_desc')}</p></div>
          <div class="section-header" style="margin-top:8px"><h2>📍 ${getLang() === 'zh' ? '热门景点' : 'Top Places'}</h2></div>
          <div class="place-grid">
            ${(places[city] || places.shanghai).map(p => `<div class="place-card"><div class="place-icon">${p.icon}</div><div class="place-info"><h4>${p.name}</h4><div class="place-desc">${p.desc}</div><div class="place-meta">${p.meta}</div></div></div>`).join('')}
          </div>
          <div class="info-card" style="margin-top:16px"><h3>🎭 ${t('city_culture')}</h3><p>${t(city + '_culture')}</p></div>
        </div>
        <div>
          <div class="info-card"><h3>🌤️ ${t('city_best_season')}</h3><p>${t(city + '_season')}</p></div>
          <div class="info-card"><h3>🚇 ${t('city_transport')}</h3><p>${t(city + '_transport')}</p></div>
          <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="navigate('chat')">🤖 ${t('city_ask_ai')}</button>
          <button class="btn btn-secondary" style="width:100%;margin-top:8px" onclick="navigate('translate')">🌐 ${t('translate_title')}</button>
        </div>
      </div>
    </div>
  `;
}

// ==========================
// PHRASES PAGE
// ==========================
function renderPhrases() {
  const categories = [{ key: 'greetings', icon: '👋' }, { key: 'food', icon: '🍜' }, { key: 'transport', icon: '🚇' }, { key: 'shopping', icon: '🛍️' }, { key: 'emergency', icon: '🆘' }, { key: 'hotel', icon: '🏨' }];
  const data = {
    greetings: [{ en: t('p_hello_en'), zh: t('p_hello_zh'), pinyin: t('p_hello_pinyin') }, { en: t('p_thank_en'), zh: t('p_thank_zh'), pinyin: t('p_thank_pinyin') }, { en: t('p_bye_en'), zh: t('p_bye_zh'), pinyin: t('p_bye_pinyin') }, { en: t('p_sorry_en'), zh: t('p_sorry_zh'), pinyin: t('p_sorry_pinyin') }, { en: t('p_yesno_en'), zh: t('p_yesno_zh'), pinyin: t('p_yesno_pinyin') }, { en: t('p_understand_en'), zh: t('p_understand_zh'), pinyin: t('p_understand_pinyin') }],
    food: [{ en: t('p_menu_en'), zh: t('p_menu_zh'), pinyin: t('p_menu_pinyin') }, { en: t('p_bill_en'), zh: t('p_bill_zh'), pinyin: t('p_bill_pinyin') }, { en: t('p_water_en'), zh: t('p_water_zh'), pinyin: t('p_water_pinyin') }, { en: t('p_spicy_en'), zh: t('p_spicy_zh'), pinyin: t('p_spicy_pinyin') }, { en: t('p_veg_en'), zh: t('p_veg_zh'), pinyin: t('p_veg_pinyin') }, { en: t('p_howmuch_en'), zh: t('p_howmuch_zh'), pinyin: t('p_howmuch_pinyin') }],
    transport: [{ en: t('p_metro_en'), zh: t('p_metro_zh'), pinyin: t('p_metro_pinyin') }, { en: t('p_taxi_en'), zh: t('p_taxi_zh'), pinyin: t('p_taxi_pinyin') }, { en: t('p_airport_en'), zh: t('p_airport_zh'), pinyin: t('p_airport_pinyin') }],
    shopping: [{ en: t('p_howmuch_en'), zh: t('p_howmuch_zh'), pinyin: t('p_howmuch_pinyin') }, { en: getLang() === 'zh' ? '太贵了' : 'Too expensive', zh: '太贵了', pinyin: 'Tài guì le' }, { en: getLang() === 'zh' ? '可以便宜点吗' : 'Can you make it cheaper?', zh: '可以便宜点吗', pinyin: 'Kěyǐ piányi diǎn ma?' }],
    emergency: [{ en: t('p_help_urgent_en'), zh: t('p_help_urgent_zh'), pinyin: t('p_help_urgent_pinyin') }, { en: t('p_hospital_en'), zh: t('p_hospital_zh'), pinyin: t('p_hospital_pinyin') }, { en: t('p_help_en'), zh: t('p_help_zh'), pinyin: t('p_help_pinyin') }],
    hotel: [{ en: t('p_hotel_en'), zh: t('p_hotel_zh'), pinyin: t('p_hotel_pinyin') }, { en: t('p_wifi_en'), zh: t('p_wifi_zh'), pinyin: t('p_wifi_pinyin') }, { en: getLang() === 'zh' ? '退房时间是几点' : 'What time is checkout?', zh: '退房时间是几点', pinyin: 'Tuìfáng shíjiān shì jǐ diǎn?' }],
  };
  const phrases = data[currentPhraseCat] || data.greetings;

  return `
    <div class="page"><div class="phrases-layout">
      <div class="phrase-cats-sidebar">${categories.map(cat => `<button class="phrase-cat-item ${currentPhraseCat === cat.key ? 'active' : ''}" onclick="currentPhraseCat='${cat.key}';render()"><span class="cat-icon">${cat.icon}</span><span>${t('phrases_' + cat.key)}</span></button>`).join('')}</div>
      <div class="phrase-grid">${phrases.map(p => `<div class="phrase-card" onclick="showPhraseFull('${p.zh.replace(/'/g, "\\'")}', '${p.pinyin.replace(/'/g, "\\'")}')"><div class="phrase-en">${p.en}</div><div class="phrase-zh">${p.zh}</div><div class="phrase-pinyin">${p.pinyin}</div><div class="phrase-actions"><button onclick="event.stopPropagation();speakPhrase('${p.zh.replace(/'/g, "\\'")}', '${p.en.replace(/'/g, "\\'")}')">🔊 ${getLang() === 'zh' ? '听' : 'Listen'}</button><button onclick="event.stopPropagation();copyToClipboard('${p.zh.replace(/'/g, "\\'")}')">📋 ${getLang() === 'zh' ? '复制' : 'Copy'}</button></div></div>`).join('')}</div>
    </div></div>
  `;
}

function showPhraseFull(zh, pinyin) { 
  const ov = document.createElement('div'); 
  ov.className = 'fullscreen-overlay'; 
  ov.id = 'fullscreenOverlay'; 
  ov.innerHTML = `<button class="fs-close" onclick="closeFullscreen()">✕</button>
    <button class="fs-speak-btn" onclick="speakText('${zh.replace(/'/g, "\\'")}', 'zh-CN')" style="position:absolute;top:60px;right:20px;background:var(--primary);color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:16px">🔊 ${getLang() === 'zh' ? '朗读' : 'Speak'}</button>
    <div class="fs-text">${zh}</div><div class="fs-pinyin">${pinyin}</div>`; 
  ov.onclick = e => { if (e.target === ov) closeFullscreen(); }; 
  document.body.appendChild(ov); 
}

function speakPhrase(zh, en) {
  // Speak Chinese by default, but we can detect language
  const lang = /[\u4e00-\u9fa5]/.test(zh) ? 'zh-CN' : 'en-US';
  speakText(zh, lang);
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
  showToast(getLang() === 'zh' ? '已复制' : 'Copied!');
}

// ==========================
// PROFILE PAGE
// ==========================
function renderProfile() {
  const user = getAuthUser();
  const isZh = getLang() === 'zh';

  if (!user) {
    return `
      <div class="page" style="display:flex;justify-content:center;padding-top:60px">
        <div style="text-align:center;max-width:400px">
          <div style="font-size:64px;margin-bottom:16px">🔒</div>
          <h2 style="font-size:24px;font-weight:800;margin-bottom:8px">${isZh ? '请先登录' : 'Sign in to continue'}</h2>
          <p style="color:var(--text-muted);margin-bottom:24px">${isZh ? '登录后可以保存翻译、对话记录和个性化推荐' : 'Save translations, chat history, and get personalized recommendations'}</p>
          <button class="btn btn-primary" style="padding:12px 40px;font-size:16px;border-radius:24px" onclick="authMode='login';navigate('auth')">${t('auth_sign_in')}</button>
          <div style="margin-top:12px;font-size:14px;color:var(--text-secondary)">${t('auth_no_account')} <button style="color:var(--primary);font-weight:600" onclick="authMode='register';navigate('auth')">${t('auth_sign_up')}</button></div>
        </div>
      </div>
    `;
  }

  const joinedDate = user.joinedAt ? new Date(user.joinedAt).toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' }) : '-';

  return `
    <div class="page">
      <div class="profile-layout">
        <div class="profile-sidebar card" style="padding:32px 20px">
          <div class="profile-avatar">${user.avatar || user.name.charAt(0).toUpperCase()}</div>
          <h2>${user.name}${isAdmin(user) ? ' <span style="font-size:12px;background:var(--primary);color:white;padding:2px 8px;border-radius:10px;font-weight:600;vertical-align:middle">Admin</span>' : ''}</h2>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:4px">${user.email}</p>
          <p style="font-size:12px;color:var(--text-muted)">${t('profile_joined')}: ${joinedDate}</p>
          ${user.provider ? `<div style="margin-top:8px"><span class="status-badge enabled">${user.provider === 'google' ? 'Google' : 'WeChat'}</span></div>` : ''}
        </div>
        <div>
          <!-- Account Info -->
          <div class="profile-card">
            <div class="card-header" style="padding:16px 20px"><h3 style="font-size:16px;font-weight:700">${t('profile_account')}</h3></div>
            <div class="profile-item">
              <div class="item-icon" style="background:var(--primary-bg)">📧</div>
              <div class="item-info"><h4>${t('profile_email')}</h4><p>${user.email}</p></div>
            </div>
            <div class="profile-item">
              <div class="item-icon" style="background:var(--accent-bg)">👤</div>
              <div class="item-info"><h4>${t('auth_name')}</h4><p>${user.name}</p></div>
            </div>
            <div class="profile-item" onclick="showToast('${isZh ? '编辑功能开发中' : 'Edit coming soon'}')">
              <div class="item-icon" style="background:#FFF7E6">✏️</div>
              <div class="item-info"><h4>${t('profile_edit')}</h4><p>${isZh ? '修改昵称和头像' : 'Change name & avatar'}</p></div>
              <span class="item-arrow">→</span>
            </div>
          </div>

          <!-- Subscription -->
          <div class="profile-card">
            <div class="profile-item">
              <div class="item-icon" style="background:#FFF7E6">💎</div>
              <div class="item-info"><h4>${t('profile_subscription')}</h4><p>${t('profile_free_plan')}</p><div class="usage-bar"><div class="usage-fill" style="width:30%"></div></div></div>
            </div>
            <div style="padding:0 20px 20px"><button class="btn btn-primary" style="width:100%" onclick="showToast('${isZh ? '订阅功能即将推出' : 'Subscription coming soon'}')">⭐ ${t('profile_upgrade')}</button></div>
          </div>

          <!-- Usage -->
          <div class="profile-card">
            <div class="profile-item">
              <div class="item-icon" style="background:var(--primary-bg)">📊</div>
              <div class="item-info"><h4>${t('profile_usage')}</h4><p>${t('profile_ai_requests')}: 3/10</p><div class="usage-bar"><div class="usage-fill" style="width:30%"></div></div></div>
            </div>
            <div class="profile-item">
              <div class="item-icon" style="background:var(--accent-bg)">🌐</div>
              <div class="item-info"><h4>${t('profile_translations')}</h4><p>5/20</p><div class="usage-bar"><div class="usage-fill" style="width:25%;background:var(--accent)"></div></div></div>
            </div>
          </div>

          <!-- Security -->
          <div class="profile-card">
            <div class="card-header" style="padding:16px 20px"><h3 style="font-size:16px;font-weight:700">${t('profile_security')}</h3></div>
            <div class="profile-item" onclick="showToast('${isZh ? '密码修改功能开发中' : 'Password change coming soon'}')">
              <div class="item-icon" style="background:#F5EDFF">🔐</div>
              <div class="item-info"><h4>${t('profile_change_pw')}</h4></div>
              <span class="item-arrow">→</span>
            </div>
            ${isAdmin(user) ? `
            <div class="profile-item" onclick="navigate('admin')">
              <div class="item-icon" style="background:#E6F7FF">⚙️</div>
              <div class="item-info"><h4>${isZh ? '管理后台' : 'Admin Panel'}</h4><p>${isZh ? '配置API、模型和提示词' : 'Configure APIs, models & prompts'}</p></div>
              <span class="item-arrow">→</span>
            </div>
            ` : ''}
          </div>

          <!-- Logout -->
          <div style="margin-top:8px">
            <button class="btn btn-danger" style="width:100%" onclick="confirmLogout()">🚪 ${t('auth_logout')}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function confirmLogout() {
  if (confirm(t('auth_logout_confirm'))) doLogout();
}

// ==========================
// ADMIN PAGE
// ==========================
function renderAdmin() {
  // Admin guard - redirect non-admin users
  const user = getAuthUser();
  if (!user || !isAdmin(user)) {
    navigate('home');
    showToast(getLang() === 'zh' ? '需要管理员权限' : 'Admin access required');
    return '';
  }

  const tabs = [
    { key: 'models', icon: '🤖', label: getLang() === 'zh' ? '模型配置' : 'AI Models' },
    { key: 'prompts', icon: '📝', label: getLang() === 'zh' ? '提示词' : 'Prompts' },
    { key: 'usage', icon: '📊', label: getLang() === 'zh' ? '用量统计' : 'Usage' },
  ];
  return `<div class="page"><div class="admin-layout"><div class="admin-sidebar">${tabs.map(tab => `<button class="admin-nav-item ${currentAdminTab === tab.key ? 'active' : ''}" onclick="currentAdminTab='${tab.key}';render()"><span>${tab.icon}</span><span>${tab.label}</span></button>`).join('')}</div><div class="admin-main">${currentAdminTab === 'models' ? renderAdminModels() : ''}${currentAdminTab === 'prompts' ? renderAdminPrompts() : ''}${currentAdminTab === 'usage' ? renderAdminUsage() : ''}</div></div></div>`;
}

function renderAdminModels() {
  const isZh = getLang() === 'zh';
  return `
    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center"><h3 style="font-size:18px;font-weight:700">${isZh ? 'AI 模型配置' : 'AI Model Configuration'}</h3><button class="btn btn-primary btn-sm" onclick="showAddModelForm()">+ ${isZh ? '添加模型' : 'Add Model'}</button></div>
    <table class="admin-table"><thead><tr><th>${isZh ? '服务商' : 'Provider'}</th><th>${isZh ? '模型' : 'Model'}</th><th>${isZh ? '状态' : 'Status'}</th><th>${isZh ? '优先级' : 'Priority'}</th><th>Streaming</th><th>Vision</th><th>${isZh ? '操作' : 'Actions'}</th></tr></thead><tbody>${adminModels.map(m => `<tr><td><strong>${m.provider}</strong></td><td><code style="background:var(--bg);padding:2px 8px;border-radius:4px;font-size:13px">${m.modelKey}</code></td><td><span class="status-badge ${m.isEnabled ? 'enabled' : 'disabled'}">${m.isEnabled ? (isZh ? '已启用' : 'Enabled') : (isZh ? '已禁用' : 'Disabled')}</span></td><td>${m.priority}</td><td>${m.supportsStreaming ? '✅' : '❌'}</td><td>${m.supportsVision ? '✅' : '❌'}</td><td><div class="btn-group"><button class="btn btn-secondary btn-sm" onclick="editModel('${m.id}')">${isZh ? '编辑' : 'Edit'}</button><button class="btn ${m.isEnabled ? 'btn-danger' : 'btn-primary'} btn-sm" onclick="toggleModel('${m.id}')">${m.isEnabled ? (isZh ? '禁用' : 'Disable') : (isZh ? '启用' : 'Enable')}</button></div></td></tr>`).join('')}</tbody></table>`;
}

function renderAdminPrompts() {
  const isZh = getLang() === 'zh';
  return `<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center"><h3 style="font-size:18px;font-weight:700">${isZh ? '提示词管理' : 'Prompt Management'}</h3><button class="btn btn-primary btn-sm" onclick="showToast('${isZh ? '新建提示词功能开发中' : 'New prompt coming soon'}')">+ ${isZh ? '新建提示词' : 'New Prompt'}</button></div><table class="admin-table"><thead><tr><th>${isZh ? '场景' : 'Scene'}</th><th>${isZh ? '名称' : 'Name'}</th><th>${isZh ? '语言' : 'Lang'}</th><th>${isZh ? '版本' : 'Version'}</th><th>${isZh ? '状态' : 'Status'}</th><th>${isZh ? '操作' : 'Actions'}</th></tr></thead><tbody>${adminPrompts.map(p => `<tr><td><code style="background:var(--bg);padding:2px 8px;border-radius:4px;font-size:13px">${p.sceneCode}</code></td><td><strong>${p.name}</strong></td><td>${p.language === 'en' ? '🇺🇸 EN' : '🇨🇳 中文'}</td><td>v${p.version}</td><td><span class="status-badge ${p.isPublished ? 'enabled' : 'disabled'}">${p.isPublished ? (isZh ? '已发布' : 'Published') : (isZh ? '草稿' : 'Draft')}</span></td><td><div class="btn-group"><button class="btn btn-secondary btn-sm" onclick="showToast('${isZh ? '编辑功能开发中' : 'Edit coming soon'}')">${isZh ? '编辑' : 'Edit'}</button><button class="btn ${p.isPublished ? 'btn-danger' : 'btn-primary'} btn-sm" onclick="showToast('${isZh ? '操作成功' : 'Done'}')">${p.isPublished ? (isZh ? '下线' : 'Unpublish') : (isZh ? '发布' : 'Publish')}</button></div></td></tr>`).join('')}</tbody></table>`;
}

function renderAdminUsage() {
  const isZh = getLang() === 'zh';
  return `<h3 style="font-size:18px;font-weight:700;margin-bottom:16px">${isZh ? 'API 用量统计' : 'API Usage Statistics'}</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px"><div class="card" style="padding:20px;text-align:center"><div style="font-size:32px;font-weight:800;color:var(--primary)">1,247</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">${isZh ? '今日请求' : "Today's Requests"}</div></div><div class="card" style="padding:20px;text-align:center"><div style="font-size:32px;font-weight:800;color:var(--accent)">98.5%</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">${isZh ? '成功率' : 'Success Rate'}</div></div><div class="card" style="padding:20px;text-align:center"><div style="font-size:32px;font-weight:800;color:var(--warning)">$12.36</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">${isZh ? '今日花费' : "Today's Cost"}</div></div></div><table class="admin-table"><thead><tr><th>${isZh ? '模型' : 'Model'}</th><th>${isZh ? '请求数' : 'Requests'}</th><th>${isZh ? 'Token用量' : 'Tokens'}</th><th>${isZh ? '平均延迟' : 'Avg Latency'}</th><th>${isZh ? '花费' : 'Cost'}</th></tr></thead><tbody><tr><td><strong>GPT-4o</strong></td><td>523</td><td>1.2M</td><td>1.8s</td><td>$8.42</td></tr><tr><td><strong>GPT-4o-mini</strong></td><td>489</td><td>2.1M</td><td>0.6s</td><td>$2.15</td></tr><tr><td><strong>Claude Sonnet</strong></td><td>235</td><td>890K</td><td>2.1s</td><td>$1.79</td></tr></tbody></table>`;
}

function showAddModelForm() {
  const isZh = getLang() === 'zh';
  const overlay = document.createElement('div');
  overlay.className = 'fullscreen-overlay'; overlay.id = 'modelFormOverlay';
  overlay.style.background = 'rgba(0,0,0,0.5)'; overlay.style.justifyContent = 'flex-start'; overlay.style.padding = '60px 20px'; overlay.style.overflowY = 'auto';
  overlay.innerHTML = `<div class="admin-form" style="max-width:640px;width:100%;margin:0 auto" onclick="event.stopPropagation()"><h3>${isZh ? '添加 AI 模型' : 'Add AI Model'}</h3><div class="form-row"><div class="form-group"><label>${isZh ? '服务商' : 'Provider'} *</label><select id="formProvider"><option value="OpenAI">OpenAI</option><option value="Anthropic">Anthropic</option><option value="DeepSeek">DeepSeek</option><option value="百度文心">百度文心 (ERNIE)</option><option value="阿里通义">阿里通义 (Qwen)</option><option value="智谱AI">智谱AI (GLM)</option><option value="Moonshot">Moonshot (Kimi)</option><option value="Custom">${isZh ? '自定义' : 'Custom'}</option></select></div><div class="form-group"><label>${isZh ? '模型标识' : 'Model Key'} *</label><input type="text" id="formModelKey" placeholder="e.g. gpt-4o, deepseek-chat"></div></div><div class="form-group"><label>${isZh ? 'API 地址' : 'API Base URL'} *</label><input type="text" id="formApiBase" placeholder="https://api.openai.com/v1"><div class="form-hint">${isZh ? '服务商的 API 接口地址' : 'The API endpoint URL'}</div></div><div class="form-group"><label>API Key *</label><input type="password" id="formApiKey" placeholder="sk-xxxxxxxx"><div class="form-hint">${isZh ? '密钥将加密存储，不会明文显示' : 'Stored encrypted, never shown in plain text'}</div></div><div class="form-row"><div class="form-group"><label>${isZh ? '超时(ms)' : 'Timeout (ms)'}</label><input type="number" id="formTimeout" value="30000"></div><div class="form-group"><label>${isZh ? '最大Token' : 'Max Tokens'}</label><input type="number" id="formMaxTokens" value="4096"></div></div><div class="form-row"><div class="form-group"><label>${isZh ? '温度' : 'Temperature'}</label><input type="number" id="formTemp" value="0.7" step="0.1" min="0" max="2"></div><div class="form-group"><label>${isZh ? '优先级' : 'Priority'}</label><input type="number" id="formPriority" value="1" min="1" max="99"><div class="form-hint">${isZh ? '数字越小优先级越高' : 'Lower = higher priority'}</div></div></div><div class="form-row" style="margin-bottom:24px"><div class="form-group" style="display:flex;align-items:center;gap:12px"><label class="toggle"><input type="checkbox" id="formStreaming" checked><span class="slider"></span></label><span style="font-size:14px">${isZh ? '支持流式输出' : 'Supports Streaming'}</span></div><div class="form-group" style="display:flex;align-items:center;gap:12px"><label class="toggle"><input type="checkbox" id="formVision"><span class="slider"></span></label><span style="font-size:14px">${isZh ? '支持视觉(图片)' : 'Supports Vision'}</span></div></div><div style="display:flex;gap:12px;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--border)"><button class="btn btn-secondary" onclick="closeFullscreen()">${isZh ? '取消' : 'Cancel'}</button><button class="btn btn-primary" onclick="saveModel()">${isZh ? '保存并启用' : 'Save & Enable'}</button></div></div>`;
  overlay.onclick = () => closeFullscreen();
  document.body.appendChild(overlay);
}

function editModel(id) {
  const model = adminModels.find(m => m.id === id);
  if (!model) return;
  showAddModelForm();
  setTimeout(() => {
    document.getElementById('formProvider').value = model.provider;
    document.getElementById('formModelKey').value = model.modelKey;
    document.getElementById('formApiBase').value = model.apiBase;
    document.getElementById('formTimeout').value = model.timeoutMs;
    document.getElementById('formMaxTokens').value = model.maxTokens;
    document.getElementById('formTemp').value = model.temperature;
    document.getElementById('formPriority').value = model.priority;
    document.getElementById('formStreaming').checked = model.supportsStreaming;
    document.getElementById('formVision').checked = model.supportsVision;
    document.getElementById('modelFormOverlay').dataset.editId = id;
  }, 50);
}

function toggleModel(id) { const m = adminModels.find(x => x.id === id); if (m) { m.isEnabled = !m.isEnabled; showToast(m.isEnabled ? (getLang() === 'zh' ? '已启用' : 'Enabled') : (getLang() === 'zh' ? '已禁用' : 'Disabled')); render(); } }

function saveModel() {
  const provider = document.getElementById('formProvider').value, modelKey = document.getElementById('formModelKey').value, apiBase = document.getElementById('formApiBase').value;
  if (!modelKey || !apiBase) { showToast(getLang() === 'zh' ? '请填写必填项' : 'Please fill required fields'); return; }
  const overlay = document.getElementById('modelFormOverlay'), editId = overlay?.dataset.editId;
  const data = { provider, modelKey, apiBase, timeoutMs: parseInt(document.getElementById('formTimeout').value) || 30000, maxTokens: parseInt(document.getElementById('formMaxTokens').value) || 4096, temperature: parseFloat(document.getElementById('formTemp').value) || 0.7, priority: parseInt(document.getElementById('formPriority').value) || 1, supportsStreaming: document.getElementById('formStreaming').checked, supportsVision: document.getElementById('formVision').checked };
  if (editId) { const m = adminModels.find(x => x.id === editId); if (m) Object.assign(m, data); }
  else adminModels.push({ id: 'm' + Date.now(), ...data, isEnabled: true });
  closeFullscreen(); showToast(getLang() === 'zh' ? '✅ 保存成功' : '✅ Saved successfully'); render();
}

// ==========================
// UTILS
// ==========================
function showToast(msg) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = msg;
  document.body.appendChild(toast); setTimeout(() => toast.remove(), 2000);
}

function switchLang(lang) { setLang(lang); chatMessages = []; translateResult = null; translateInputText = ''; translateFromLang = ''; translateToLang = ''; render(); }

function bindEvents() {
  const ta = document.getElementById('chatInput');
  if (ta) ta.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 140) + 'px'; });
  if (translateFromLang) {
    const fl = document.getElementById('fromLang');
    if (fl) fl.value = translateFromLang;
  }
  if (translateToLang) {
    const tl = document.getElementById('toLang');
    if (tl) tl.value = translateToLang;
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFullscreen(); });
document.addEventListener('DOMContentLoaded', () => {
  // Check for OAuth callback parameters
  const urlParams = new URLSearchParams(window.location.search);
  const authStatus = urlParams.get('auth');
  const provider = urlParams.get('provider');
  
  if (authStatus === 'success' && provider) {
    // Create user object from OAuth provider
    const isZh = getLang() === 'zh';
    const mockUser = {
      name: provider === 'google' ? 'Google User' : '微信用户',
      email: provider === 'google' ? 'user@gmail.com' : 'user@wechat.com',
      avatar: provider === 'google' ? 'G' : '微',
      provider,
      joinedAt: new Date().toISOString(),
      role: 'user',
    };
    setAuthUser(mockUser);
    showToast(isZh ? `${provider === 'google' ? 'Google' : '微信'} 登录成功！` : `${provider === 'google' ? 'Google' : 'WeChat'} login successful!`);
    
    // Clean up URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  loadChatHistory();
  render();
});

// ==========================
// INITIALIZATION
// ==========================

// Initialize Web Speech API voices (load async)
if ('speechSynthesis' in window) {
  // Voices might not be immediately available
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// Health check for API availability
async function checkApiHealth() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    console.log('API Status:', data.status, 'LLM Configured:', data.llmConfigured);
    return data;
  } catch (e) {
    console.warn('API health check failed:', e);
    return null;
  }
}

// Run health check on load
checkApiHealth();
