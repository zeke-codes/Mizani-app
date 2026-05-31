import { supabase } from "./supabase.js";

console.log("Supabase connected");
console.log(supabase);

/* =============================================
   MIZANI — script.js
   Vanilla JS — No frameworks
   ============================================= */

'use strict';

// ============================================================
// CONSTANTS & CONFIG
// ============================================================

const CATEGORIES = [
  { id: 'food',          label: 'Food & Dining',   emoji: '🍽️',  color: '#F59B42', bg: '#F59B4220' },
  { id: 'transport',     label: 'Transport',        emoji: '🚗',  color: '#4D8EFF', bg: '#4D8EFF20' },
  { id: 'shopping',      label: 'Shopping',         emoji: '🛍️',  color: '#9B72F5', bg: '#9B72F520' },
  { id: 'bills',         label: 'Bills & Utilities',emoji: '📄',  color: '#3EC9C3', bg: '#3EC9C320' },
  { id: 'entertainment', label: 'Entertainment',    emoji: '🎬',  color: '#E05555', bg: '#E0555520' },
  { id: 'health',        label: 'Health',           emoji: '💊',  color: '#3EC97E', bg: '#3EC97E20' },
  { id: 'salary',        label: 'Salary',           emoji: '💼',  color: '#3EC97E', bg: '#3EC97E20' },
  { id: 'business',      label: 'Business',         emoji: '📈',  color: '#C9A84C', bg: '#C9A84C20' },
  { id: 'other',         label: 'Other',            emoji: '📦',  color: '#8890A4', bg: '#8890A420' },
];

const CURRENCIES = {
  USD: { symbol: '$',   name: 'US Dollar' },
  EUR: { symbol: '€',   name: 'Euro' },
  GBP: { symbol: '£',   name: 'British Pound' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling' },
  JPY: { symbol: '¥',   name: 'Japanese Yen' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$',  name: 'Australian Dollar' },
};

const LS_KEYS = {
  TRANSACTIONS: 'mizani_transactions',
  BUDGETS:      'mizani_budgets',
  SETTINGS:     'mizani_settings',
  LAST_REMINDER: 'mizani_last_reminder',
  GOALS:        'mizani_goals',
  ACCOUNTS:     'mizani_accounts',
  ACTIVE_ACCOUNT: 'mizani_active_account'
};

// ============================================================
// STATE
// ============================================================

let state = {
  transactions: [],
  budgets:      {},
  goals:        [],
  accounts:     [{ id: 'default', name: 'Personal Account', type: 'personal' }],
  activeAccountId: 'default',
  settings: {
    theme:    'dark',
    currency: 'USD',
  },
  activeSection:  'dashboard',
  editingId:      null,
  confirmCallback: null,
  charts: {},
};

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================

function loadState() {
  try {
    const txns   = localStorage.getItem(LS_KEYS.TRANSACTIONS);
    const budgets = localStorage.getItem(LS_KEYS.BUDGETS);
    const settings = localStorage.getItem(LS_KEYS.SETTINGS);
    const goals   = localStorage.getItem(LS_KEYS.GOALS);
    const accounts = localStorage.getItem(LS_KEYS.ACCOUNTS);
    const activeAcc = localStorage.getItem(LS_KEYS.ACTIVE_ACCOUNT);

    if (txns)     state.transactions = JSON.parse(txns);
    if (budgets)  state.budgets      = JSON.parse(budgets);
    if (settings) state.settings     = { ...state.settings, ...JSON.parse(settings) };
    if (goals)    state.goals        = JSON.parse(goals);

    // Load and validate accounts; fallback to default Personal Account if none found
    if (accounts) {
      const parsed = JSON.parse(accounts);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.accounts = parsed;
      }
    }
    if (activeAcc && state.accounts.some(a => a.id === activeAcc)) {
      state.activeAccountId = activeAcc;
    }

    // Migration: ensure all transactions have an accountId
    state.transactions.forEach(t => { if (!t.accountId) t.accountId = 'default'; });

    // Legacy support for FlowTrack users
    if (!txns && localStorage.getItem('flowtrack_transactions')) {
      state.transactions = JSON.parse(localStorage.getItem('flowtrack_transactions'));
      state.budgets = JSON.parse(localStorage.getItem('flowtrack_budgets') || '{}');
      saveTransactions(); saveBudgets();
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage', e);
  }
}

function saveTransactions() {
  localStorage.setItem(LS_KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
}

function saveBudgets() {
  localStorage.setItem(LS_KEYS.BUDGETS, JSON.stringify(state.budgets));
}

function saveSettings() {
  localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(state.settings));
}

function saveGoals() {
  localStorage.setItem(LS_KEYS.GOALS, JSON.stringify(state.goals));
}

function saveAccounts() {
  localStorage.setItem(LS_KEYS.ACCOUNTS, JSON.stringify(state.accounts));
}

function saveActiveAccount() {
  localStorage.setItem(LS_KEYS.ACTIVE_ACCOUNT, state.activeAccountId);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getCurrency() {
  return CURRENCIES[state.settings.currency] || CURRENCIES['USD'];
}

function formatAmount(amount) {
  const sym = getCurrency().symbol;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${formatted}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

function generateId() {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getMonthYear(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(ym) {
  const [y, m] = ym.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function getCurrentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Animated counter
function animateValue(el, from, to, duration = 600) {
  el.classList.add('animating');
  const startTime = performance.now();
  const update = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * ease;
    el.textContent = formatAmount(current);
    if (progress < 1) requestAnimationFrame(update);
    else {
      el.classList.remove('animating');
    }
  };
  requestAnimationFrame(update);
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

// ============================================================
// MODAL HELPERS
// ============================================================

function openModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function openConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  state.confirmCallback = callback;
  openModal('confirmModal');
}

// ============================================================
// NAVIGATION
// ============================================================

function navigateTo(section) {
  // Handle layout visibility
  const isAuthOrLanding = section === 'landing' || section === 'auth';
  
  document.getElementById('sidebar').style.display = isAuthOrLanding ? 'none' : '';
  document.querySelector('.topbar').style.display = isAuthOrLanding ? 'none' : '';
  document.querySelector('.mobile-nav').style.display = isAuthOrLanding ? 'none' : '';
  document.getElementById('fabBtn').style.display = isAuthOrLanding ? 'none' : '';
  document.getElementById('mainContent').style.marginLeft = isAuthOrLanding ? '0' : '';

  // Update sidebar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Update mobile nav
  document.querySelectorAll('.mobile-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Update sections
  document.querySelectorAll('.section').forEach(el => {
    el.classList.toggle('active', el.id === `section-${section}`);
  });

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    budgets: 'Budgets',
    analytics: 'Analytics',
    settings: 'Settings',
  };
  document.getElementById('topbarTitle').textContent = titles[section] || section;

  state.activeSection = section;

  // Section-specific rendering
  if (section === 'dashboard')    renderDashboard();
  if (section === 'transactions') renderTransactionsTable();
  if (section === 'budgets')      renderBudgets();
  if (section === 'analytics')    renderAnalytics();
  if (section === 'goals')        renderGoals();

  // Close mobile sidebar
  closeSidebar();

  // Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// SIDEBAR (MOBILE)
// ============================================================

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ============================================================
// THEME
// ============================================================

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.settings.theme = theme;
  saveSettings();

  // Sync toggles
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.checked = theme === 'dark';

  // Re-draw charts for theme change
  setTimeout(renderAllCharts, 100);
}

// ============================================================
// CURRENCY
// ============================================================

function applyCurrency(code) {
  state.settings.currency = code;
  saveSettings();
  updateCurrencyPrefixes();
  renderDashboard();
  if (state.activeSection === 'transactions') renderTransactionsTable();
  if (state.activeSection === 'budgets')      renderBudgets();
  if (state.activeSection === 'analytics')    renderAnalytics();
}

function updateCurrencyPrefixes() {
  const sym = getCurrency().symbol;
  ['modalCurrencyPrefix', 'budgetCurrencyPrefix'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = sym;
  });
}

// ============================================================
// POPULATE CATEGORY DROPDOWNS
// ============================================================

function populateCategoryDropdowns() {
  const selects = ['txnCategory', 'filterCategory', 'budgetCategory'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    if (id === 'filterCategory') {
      const opt = document.createElement('option');
      opt.value = 'all';
      opt.textContent = 'All Categories';
      sel.appendChild(opt);
    }
    CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.emoji} ${cat.label}`;
      sel.appendChild(opt);
    });
  });
}

// ============================================================
// STATS CALCULATION
// ============================================================

function calcStats() {
  const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
  
  const totIncome  = activeTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totExpense = activeTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance    = totIncome - totExpense;

  const curMonth = getCurrentMonthStr();
  const monthInc = activeTxns.filter(t => t.type === 'income' && getMonthYear(t.date) === curMonth).reduce((s,t) => s + t.amount, 0);
  const monthExp = activeTxns.filter(t => t.type === 'expense' && getMonthYear(t.date) === curMonth).reduce((s,t) => s + t.amount, 0);
  const savings  = monthInc - monthExp;

  return { totIncome, totExpense, balance, savings };
}

// ============================================================
// DASHBOARD RENDER
// ============================================================

let prevStats = { balance: 0, income: 0, expense: 0, savings: 0 };

function renderDashboard() {
  const { totIncome, totExpense, balance, savings } = calcStats();
  
  // Set Greeting
  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const greetingEl = document.getElementById('greetingText');
  if (greetingEl) greetingEl.textContent = `${greeting} 👋`;

  animateValue(document.getElementById('totalBalance'), prevStats.balance, balance);
  animateValue(document.getElementById('totalIncome'),  prevStats.income,  totIncome);
  animateValue(document.getElementById('totalExpenses'),prevStats.expense, totExpense);
  animateValue(document.getElementById('monthlySavings'),prevStats.savings, savings);

  runCoach();
  prevStats = { balance, income: totIncome, expense: totExpense, savings };

  renderAccountSelector();
  renderRecentTransactions();
  renderCategoryChart();
  renderWeeklyReview();
  updateMizaniScore();
}

function updateMizaniScore() {
  const score = calculateMizaniScore();
  const el = document.getElementById('mizaniScore');
  if (el) el.textContent = score;
}

function calculateMizaniScore() {
  const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
  if (activeTxns.length === 0) return 0;
  let score = 50; 

  // Budget Adherence
  const curMonth = getCurrentMonthStr();
  let budgetsMet = 0;
  const budgetEntries = Object.entries(state.budgets);
  if (budgetEntries.length > 0) {
    budgetEntries.forEach(([catId, limit]) => {
      const spent = activeTxns
        .filter(t => t.type === 'expense' && t.category === catId && getMonthYear(t.date) === curMonth)
        .reduce((s, t) => s + t.amount, 0);
      if (spent <= limit) budgetsMet++;
    });
    score += (budgetsMet / budgetEntries.length) * 30;
  }

  // Impulse Control
  const recentExpenses = activeTxns.filter(t => t.type === 'expense').slice(0, 10);
  const plannedCount = recentExpenses.filter(t => t.reflection?.isPlanned !== false).length;
  if (recentExpenses.length > 0) score += (plannedCount / recentExpenses.length) * 20;

  return Math.min(Math.round(score), 100);
}

function renderWeeklyReview() {
  const container = document.getElementById('weeklyReview');
  if (!container) return;

  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
  const expenses = activeTxns.filter(t => t.type === 'expense' && new Date(t.date) >= startOfWeek);
  
  if (expenses.length === 0) {
    container.innerHTML = '<div class="empty-state">No data for this week yet.</div>';
    return;
  }

  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const catTotals = {};
  expenses.forEach(t => catTotals[t.category] = (catTotals[t.category] || 0) + t.amount);
  const topCatId = Object.keys(catTotals).reduce((a, b) => catTotals[a] > catTotals[b] ? a : b);

  container.innerHTML = `
    <div class="review-item"><span>Total Spent</span><span class="review-val">${formatAmount(totalSpent)}</span></div>
    <div class="review-item"><span>Top Category</span><span class="review-val">${getCategory(topCatId).label}</span></div>
  `;
}

function renderGoals() {
  const container = document.getElementById('goalList');
  if (!container || !state.goals) return;
  
  const { balance } = calcStats();
  container.innerHTML = state.goals.map(g => {
    const pct = Math.min((Math.max(balance, 0) / g.target) * 100, 100);
    return `
      <div class="goal-item">
        <div class="goal-header"><span class="goal-name">${escapeHtml(g.name)}</span><button class="action-btn delete" onclick="deleteGoal('${g.id}')">×</button></div>
        <div class="budget-progress-bar"><div class="budget-progress-fill" style="width:${pct}%"></div></div>
        <div class="goal-footer"><span>${formatAmount(Math.max(balance, 0))} saved</span><span>of ${formatAmount(g.target)}</span></div>
      </div>`;
  }).join('');
}

function saveGoal() {
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  if (!name || isNaN(target)) return showToast('Enter valid goal info', 'error');
  state.goals.push({ id: Date.now(), name, target });
  saveGoals(); renderGoals(); showToast('Goal created!', 'success');
}

function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id != id);
  saveGoals(); renderGoals();
}

function renderRecentTransactions() {
  const container = document.getElementById('recentTransactions');
  const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
  const recent = [...activeTxns]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  if (!recent.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <p>No transactions yet</p>
        <span>Add your first transaction to get started</span>
      </div>`;
    return;
  }

  container.innerHTML = recent.map(t => {
    const cat = getCategory(t.category);
    const sign = t.type === 'income' ? '+' : '-';
    const amtClass = t.type === 'income' ? 'amount-income' : 'amount-expense';
    return `
      <div class="recent-item">
        <div class="recent-cat-icon" style="background:${cat.bg}">${cat.emoji}</div>
        <div class="recent-item-info">
          <div class="recent-item-title">${escapeHtml(t.title)}</div>
          <div class="recent-item-cat">${cat.label} · ${formatDate(t.date)} ${t.reflection?.isPlanned === false ? '⚡ impulse' : ''}</div>
        </div>
        <div class="recent-item-amount ${amtClass}">${sign}${formatAmount(t.amount)}</div>
      </div>`;
  }).join('');
}

// ============================================================
// TRANSACTIONS TABLE
// ============================================================

function renderTransactionsTable() {
  const search   = (document.getElementById('txnSearch')?.value   || '').toLowerCase();
  const typeF    = document.getElementById('filterType')?.value    || 'all';
  const categoryF = document.getElementById('filterCategory')?.value || 'all';
  const sortBy   = document.getElementById('sortBy')?.value        || 'date-desc';

  let list = state.transactions.filter(t => t.accountId === state.activeAccountId);

  // Filter
  if (search) list = list.filter(t =>
    t.title.toLowerCase().includes(search) ||
    t.notes?.toLowerCase().includes(search) ||
    getCategory(t.category).label.toLowerCase().includes(search)
  );
  if (typeF !== 'all')     list = list.filter(t => t.type === typeF);
  if (categoryF !== 'all') list = list.filter(t => t.category === categoryF);

  // Sort
  switch (sortBy) {
    case 'date-asc':    list.sort((a,b) => new Date(a.date) - new Date(b.date)); break;
    case 'date-desc':   list.sort((a,b) => new Date(b.date) - new Date(a.date)); break;
    case 'amount-desc': list.sort((a,b) => b.amount - a.amount); break;
    case 'amount-asc':  list.sort((a,b) => a.amount - b.amount); break;
  }

  const tbody = document.getElementById('transactionsBody');

  if (!list.length) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>No transactions found</p>
            <span>Try adjusting your filters or add a new transaction</span>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => {
    const cat  = getCategory(t.category);
    const sign = t.type === 'income' ? '+' : '-';
    const amtClass = t.type === 'income' ? 'amount-income' : 'amount-expense';
    const badgeClass = t.type === 'income' ? 'badge-income' : 'badge-expense';
    return `
      <tr>
        <td>
          <div class="txn-title-cell">
            <div class="txn-cat-icon" style="background:${cat.bg}">${cat.emoji}</div>
            <div class="txn-title-info">
              <strong>${escapeHtml(t.title)}</strong>
              ${t.notes ? `<div class="txn-notes">${escapeHtml(t.notes)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${cat.label}</td>
        <td>${formatDate(t.date)}</td>
        <td><span class="type-badge ${badgeClass}">${t.type}</span></td>
        <td class="txn-amount ${amtClass}">${sign}${formatAmount(t.amount)}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn" onclick="editTransaction('${t.id}')" title="Edit">
              <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <button class="action-btn delete" onclick="deleteTransaction('${t.id}')" title="Delete">
              <svg viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ============================================================
// TRANSACTION CRUD
// ============================================================

function openAddTransactionModal() {
  state.editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Transaction';
  document.getElementById('saveTxnBtn').textContent = 'Save Transaction';

  // Reset form
  document.getElementById('txnId').value = '';
  document.getElementById('txnTitle').value = '';
  document.getElementById('txnAmount').value = '';
  document.getElementById('txnCategory').value = CATEGORIES[0].id;
  document.getElementById('txnDate').value = getTodayStr();
  document.getElementById('txnNotes').value = '';
  
  document.getElementById('isPlanned').checked = true;
  document.getElementById('addsValue').checked = true;
  document.getElementById('buyAgain').checked = true;

  // Reset type toggle
  setTypeToggle('expense');
  clearFormErrors();
  openModal('txnModal');
  setTimeout(() => document.getElementById('txnTitle').focus(), 100);
}

function editTransaction(id) {
  const t = state.transactions.find(t => t.id === id);
  if (!t) return;

  state.editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Transaction';
  document.getElementById('saveTxnBtn').textContent = 'Update Transaction';

  document.getElementById('txnId').value       = t.id;
  document.getElementById('txnTitle').value    = t.title;
  document.getElementById('txnAmount').value   = t.amount;
  document.getElementById('txnCategory').value = t.category;
  document.getElementById('txnDate').value     = t.date;
  document.getElementById('txnNotes').value    = t.notes || '';

  document.getElementById('isPlanned').checked = t.reflection?.isPlanned ?? true;
  document.getElementById('addsValue').checked = t.reflection?.addsValue ?? true;
  document.getElementById('buyAgain').checked = t.reflection?.buyAgain ?? true;

  setTypeToggle(t.type);
  clearFormErrors();
  openModal('txnModal');
}

function deleteTransaction(id) {
  openConfirm(
    'Delete Transaction',
    'Are you sure you want to delete this transaction? This action cannot be undone.',
    () => {
      state.transactions = state.transactions.filter(t => t.id !== id);
      saveTransactions();
      showToast('Transaction deleted', 'success');
      renderCurrentSection();
    }
  );
}

function saveTransaction() {
  if (!validateTransactionForm()) return;

  const id       = document.getElementById('txnId').value;
  const type     = document.getElementById('txnType').value;
  const title    = document.getElementById('txnTitle').value.trim();
  const amount   = parseFloat(document.getElementById('txnAmount').value);
  const category = document.getElementById('txnCategory').value;
  const date     = document.getElementById('txnDate').value;
  const notes    = document.getElementById('txnNotes').value.trim();
  
  const reflection = {
    isPlanned: document.getElementById('isPlanned').checked,
    addsValue: document.getElementById('addsValue').checked,
    buyAgain:  document.getElementById('buyAgain').checked,
  };

  if (state.editingId) {
    const idx = state.transactions.findIndex(t => t.id === state.editingId);
    if (idx !== -1) {
      state.transactions[idx] = { id: state.editingId, type, title, amount, category, date, notes, reflection };
      state.transactions[idx].accountId = state.activeAccountId; // Keep consistency
    }
    showToast('Transaction updated', 'success');
  } else {
    const newTxn = { id: generateId(), type, title, amount, category, date, notes, reflection, createdAt: Date.now(), accountId: state.activeAccountId };
    state.transactions.unshift(newTxn);
    showToast('Transaction added', 'success');
  }

  saveTransactions();
  closeModal('txnModal');
  renderCurrentSection();
}

function validateTransactionForm() {
  clearFormErrors();
  let valid = true;

  const title  = document.getElementById('txnTitle').value.trim();
  const amount = document.getElementById('txnAmount').value;
  const date   = document.getElementById('txnDate').value;

  if (!title) {
    document.getElementById('titleError').textContent = 'Title is required';
    valid = false;
  }

  if (!amount || parseFloat(amount) <= 0) {
    document.getElementById('amountError').textContent = 'Please enter a valid amount';
    valid = false;
  }

  if (!date) {
    document.getElementById('dateError').textContent = 'Date is required';
    valid = false;
  }

  return valid;
}

function clearFormErrors() {
  ['titleError', 'amountError', 'categoryError', 'dateError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function setTypeToggle(type) {
  document.getElementById('txnType').value = type;
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

// ============================================================
// BUDGET RENDER & LOGIC
// ============================================================

function renderBudgets() {
  const budgetList  = document.getElementById('budgetList');
  const budgetEmpty = document.getElementById('budgetEmpty');
  const entries = Object.entries(state.budgets);

  if (!entries.length) {
    budgetList.innerHTML  = '';
    budgetEmpty.style.display = 'flex';
    return;
  }

  budgetEmpty.style.display = 'none';

  const curMonth = getCurrentMonthStr();

  budgetList.innerHTML = entries.map(([catId, limit]) => {
    const cat  = getCategory(catId);
    const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
    const spent = activeTxns
      .filter(t => t.type === 'expense' && t.category === catId && getMonthYear(t.date) === curMonth)
      .reduce((s, t) => s + t.amount, 0);

    const pct       = Math.min((spent / limit) * 100, 100);
    const remaining = Math.max(limit - spent, 0);
    const isWarning = pct >= 80 && pct < 100;
    const isOver    = pct >= 100;

    const barColor = isOver ? 'var(--red)' : isWarning ? 'var(--orange)' : 'var(--green)';
    const pctColor = isOver ? 'var(--red)' : isWarning ? 'var(--orange)' : 'var(--green)';

    return `
      <div class="budget-item">
        <div class="budget-item-header">
          <div class="budget-cat-info">
            <div class="budget-cat-icon" style="background:${cat.bg}">${cat.emoji}</div>
            <span class="budget-cat-name">${cat.label}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div class="budget-amounts">
              <div class="budget-spent">${formatAmount(spent)}</div>
              <div class="budget-limit">of ${formatAmount(limit)}</div>
            </div>
            <button class="budget-delete-btn" onclick="deleteBudget('${catId}')" title="Remove budget">
              <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="budget-progress-wrap">
          <div class="budget-progress-bar">
            <div class="budget-progress-fill" style="width:0%;background:${barColor}" data-target="${pct}"></div>
          </div>
          <div class="budget-progress-labels">
            <span class="budget-pct" style="color:${pctColor}">${Math.round(pct)}%</span>
            <span class="budget-remaining">${formatAmount(remaining)} remaining</span>
          </div>
          ${isWarning ? `<div class="budget-warning">⚠️ Approaching limit</div>` : ''}
          ${isOver    ? `<div class="budget-warning" style="color:var(--red)">🚨 Budget exceeded</div>` : ''}
        </div>
      </div>`;
  }).join('');

  // Animate progress bars
  requestAnimationFrame(() => {
    document.querySelectorAll('.budget-progress-fill').forEach(bar => {
      const target = parseFloat(bar.dataset.target);
      setTimeout(() => { bar.style.width = `${target}%`; }, 50);
    });
  });
}

function saveBudget() {
  const catId  = document.getElementById('budgetCategory').value;
  const amount = parseFloat(document.getElementById('budgetAmount').value);

  if (!catId) { showToast('Please select a category', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }

  state.budgets[catId] = amount;
  saveBudgets();
  document.getElementById('budgetAmount').value = '';
  showToast(`Budget set for ${getCategory(catId).label}`, 'success');
  renderBudgets();
}

function deleteBudget(catId) {
  openConfirm('Remove Budget', `Remove budget for ${getCategory(catId).label}?`, () => {
    delete state.budgets[catId];
    saveBudgets();
    showToast('Budget removed', 'success');
    renderBudgets();
  });
}

// ============================================================
// ANALYTICS RENDER
// ============================================================

function renderAnalytics() {
  renderTrendChart();
  renderBreakdownChart();
  renderMonthlySummary();
}

function renderAllCharts() {
  if (state.activeSection === 'dashboard')  renderCategoryChart();
  if (state.activeSection === 'dashboard')  renderWeeklyReview();
  if (state.activeSection === 'analytics')  renderAnalytics();
}

// Destroy a chart safely
function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    delete state.charts[key];
  }
}

// Get Chart.js theme colors
function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    text:    isDark ? '#8890A4' : '#5A6278',
    grid:    isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    tooltip: isDark ? '#1E2332' : '#FFFFFF',
  };
}

function renderCategoryChart() {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;

  const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
  const expenses = activeTxns.filter(t => t.type === 'expense');
  const byCategory = {};
  CATEGORIES.forEach(c => { byCategory[c.id] = 0; });
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  const nonZero = CATEGORIES.filter(c => byCategory[c.id] > 0);

  destroyChart('category');

  if (!nonZero.length) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>No expense data</p>
        <span>Add some expenses to see the breakdown</span>
      </div>`;
    document.getElementById('categoryLegend').innerHTML = '';
    return;
  }

  state.charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: nonZero.map(c => c.label),
      datasets: [{
        data: nonZero.map(c => byCategory[c.id]),
        backgroundColor: nonZero.map(c => c.color + 'CC'),
        borderColor: nonZero.map(c => c.color),
        borderWidth: 1.5,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: getChartColors().tooltip,
          titleColor: getChartColors().text,
          bodyColor: getChartColors().text,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${formatAmount(ctx.raw)}`,
          }
        }
      }
    }
  });

  // Legend
  const legend = document.getElementById('categoryLegend');
  if (legend) {
    legend.innerHTML = nonZero.map(c => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${c.color}"></div>
        <span>${c.label}</span>
      </div>`).join('');
  }
}

function renderTrendChart() {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  // Last 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
  const incomes  = months.map(m => activeTxns.filter(t => t.type === 'income'  && getMonthYear(t.date) === m).reduce((s,t) => s + t.amount, 0));
  const expenses = months.map(m => activeTxns.filter(t => t.type === 'expense' && getMonthYear(t.date) === m).reduce((s,t) => s + t.amount, 0));
  const labels   = months.map(getMonthLabel);
  const colors   = getChartColors();

  destroyChart('trend');

  state.charts.trend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomes,
          backgroundColor: 'rgba(62,201,126,0.7)',
          borderColor: '#3EC97E',
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Expenses',
          data: expenses,
          backgroundColor: 'rgba(224,85,85,0.7)',
          borderColor: '#E05555',
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: colors.text,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { family: "'DM Sans', sans-serif", size: 12 }
          }
        },
        tooltip: {
          backgroundColor: colors.tooltip,
          titleColor: colors.text,
          bodyColor: colors.text,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatAmount(ctx.raw)}`,
          }
        }
      },
      scales: {
        x: {
          ticks: { color: colors.text, font: { family: "'DM Sans', sans-serif", size: 12 } },
          grid: { color: colors.grid },
        },
        y: {
          ticks: {
            color: colors.text,
            font: { family: "'DM Sans', sans-serif", size: 12 },
            callback: v => getCurrency().symbol + v.toLocaleString()
          },
          grid: { color: colors.grid },
        }
      }
    }
  });
}

function renderBreakdownChart() {
  const ctx = document.getElementById('breakdownChart');
  if (!ctx) return;

  const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
  const expenses = activeTxns.filter(t => t.type === 'expense');
  const byCategory = {};
  CATEGORIES.forEach(c => { byCategory[c.id] = 0; });
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  const nonZero = CATEGORIES.filter(c => byCategory[c.id] > 0);
  const colors  = getChartColors();

  destroyChart('breakdown');

  if (!nonZero.length) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state" style="padding:30px">
        <div class="empty-icon">🧮</div>
        <p>No data yet</p>
      </div>`;
    return;
  }

  state.charts.breakdown = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: nonZero.map(c => c.label),
      datasets: [{
        data: nonZero.map(c => byCategory[c.id]),
        backgroundColor: nonZero.map(c => c.color + '99'),
        borderColor: nonZero.map(c => c.color),
        borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: colors.text,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { family: "'DM Sans', sans-serif", size: 11 },
            padding: 14,
          }
        },
        tooltip: {
          backgroundColor: colors.tooltip,
          titleColor: colors.text,
          bodyColor: colors.text,
          callbacks: {
            label: ctx => ` ${formatAmount(ctx.raw)}`,
          }
        }
      },
      scales: {
        r: {
          ticks: { display: false },
          grid: { color: colors.grid }
        }
      }
    }
  });
}

function renderMonthlySummary() {
  const container = document.getElementById('monthlySummaryList');
  if (!container) return;

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
  const rows = months.reverse().map(m => {
    const inc = activeTxns.filter(t => t.type === 'income'  && getMonthYear(t.date) === m).reduce((s,t) => s + t.amount, 0);
    const exp = activeTxns.filter(t => t.type === 'expense' && getMonthYear(t.date) === m).reduce((s,t) => s + t.amount, 0);
    return `
      <div class="monthly-summary-item">
        <span class="month-label">${getMonthLabel(m)}</span>
        <div class="month-stats">
          <span class="month-income">+${formatAmount(inc)}</span>
          <span class="month-expense">-${formatAmount(exp)}</span>
        </div>
      </div>`;
  });

  container.innerHTML = rows.join('') || `<div class="empty-state"><p>No data</p></div>`;
}

// ============================================================
// EXPORT CSV
// ============================================================

function exportCSV() {
  if (!state.transactions.length) {
    showToast('No transactions to export', 'error');
    return;
  }

  const headers = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Notes'];
  const rows = state.transactions.map(t => [
    t.date,
    `"${t.title.replace(/"/g,'""')}"`,
    t.type,
    getCategory(t.category).label,
    t.amount,
    `"${(t.notes || '').replace(/"/g,'""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `flowtrack_${getTodayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Transactions exported to CSV', 'success');
}

// ============================================================
// CLEAR DATA
// ============================================================

function clearAllData() {
  openConfirm(
    'Clear All Data',
    'This will permanently delete all transactions and budgets. This action cannot be undone.',
    () => {
      state.transactions = [];
      state.budgets = {};
      saveTransactions();
      saveBudgets();
      showToast('All data cleared', 'success');
      renderCurrentSection();
      prevStats = { balance: 0, income: 0, expense: 0, savings: 0 };
    }
  );
}

// ============================================================
// HELPER: RENDER CURRENT SECTION
// ============================================================

function renderCurrentSection() {
  const s = state.activeSection;
  if (s === 'dashboard')    renderDashboard();
  if (s === 'transactions') renderTransactionsTable();
  if (s === 'budgets')      renderBudgets();
  if (s === 'analytics')    renderAnalytics();
}

// ============================================================
// XSS PREVENTION
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// ACCOUNT MANAGEMENT
// ============================================================

function renderAccountSelector() {
  const sel = document.getElementById('accountSelect');
  if (!sel) return;
  sel.innerHTML = state.accounts.map(acc => 
    `<option value="${acc.id}" ${acc.id === state.activeAccountId ? 'selected' : ''}>${acc.type === 'business' ? '💼' : '👤'} ${escapeHtml(acc.name)}</option>`
  ).join('');
}

function switchAccount(id) {
  state.activeAccountId = id;
  saveActiveAccount();
  renderCurrentSection();
  showToast(`Switched to ${state.accounts.find(a => a.id === id).name}`, 'info');
}

function saveAccount() {
  const name = document.getElementById('newAccountName').value.trim();
  const type = document.getElementById('newAccountType').value;
  if (!name) return showToast('Please enter an account name', 'error');

  const newAcc = { id: 'acc_' + Date.now(), name, type };
  state.accounts.push(newAcc);
  saveAccounts();
  
  document.getElementById('newAccountName').value = '';
  closeModal('accountModal');
  renderAccountSelector();
  switchAccount(newAcc.id);
  showToast('Account created!', 'success');
}

// ============================================================
// MIZANI COACH (AI-LIKE EXPERIENCE)
// ============================================================

function runCoach() {
  const coachMsg = document.getElementById('coachMessage');
  if (!coachMsg) return;

  const today = getTodayStr();
  const { totExpense, totIncome } = calcStats();
  const activeTxns = state.transactions.filter(t => t.accountId === state.activeAccountId);
  
  // Get impulse totals
  const impulseTotal = activeTxns
    .filter(t => t.type === 'expense' && t.reflection?.isPlanned === false)
    .reduce((s,t) => s + t.amount, 0);

  // Detect overspending vs averages (simple logic)
  const expenses = activeTxns.filter(t => t.type === 'expense');
  const avgExpense = expenses.length > 0 ? (totExpense / 30) : 0; // monthly avg per day
  
  let insights = [];
  
  if (totExpense > totIncome && totIncome > 0) {
    insights.push("You've spent more than you earned. Let's look at your biggest categories.");
  }
  if (impulseTotal > 0) {
    insights.push(`You've spent ${formatAmount(impulseTotal)} on impulse purchases. Pause before the next one!`);
  }
  
  // Alerts for budget overruns
  const overBudgets = Object.entries(state.budgets).filter(([catId, limit]) => {
    const spent = activeTxns.filter(t => t.category === catId && t.type === 'expense').reduce((s,t) => s + t.amount, 0);
    return spent > limit;
  });
  
  if (overBudgets.length > 0) {
    const cat = getCategory(overBudgets[0][0]);
    insights.push(`Warning: You've exceeded your budget for ${cat.label}.`);
  }
  
  if (insights.length === 0) {
    insights.push("Your finances look stable. Keep up the great tracking habit!");
  }
    
  coachMsg.textContent = insights[Math.floor(Math.random() * insights.length)];
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = event.target.result;
      const rows = text.split('\n').slice(1).filter(r => r.trim());
      const newTxns = rows.map(row => {
        const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const cat = CATEGORIES.find(c => c.label === cols[3]) || CATEGORIES[CATEGORIES.length-1];
        return {
          id: generateId(), date: cols[0], title: cols[1], type: cols[2].toLowerCase(),
          category: cat.id, amount: parseFloat(cols[4]), notes: cols[5], createdAt: Date.now()
        };
      });
      state.transactions = [...newTxns, ...state.transactions];
      saveTransactions();
      renderCurrentSection();
      showToast(`Imported ${newTxns.length} transactions`, 'success');
    } catch (err) {
      showToast('Error parsing CSV', 'error');
    }
  };
  reader.readAsText(file);
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      if (!el.dataset.section) return;
      e.preventDefault();
      navigateTo(el.dataset.section);
    });
  });

  document.querySelectorAll('.mobile-nav-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.section));
  });

  // "View all" dashboard link
  document.querySelector('.card-action[data-section="transactions"]')?.addEventListener('click', e => {
    e.preventDefault();
    navigateTo('transactions');
  });

  // Floating Action Button
  document.getElementById('fabBtn').addEventListener('click', openAddTransactionModal);

  // Landing CTAs
  document.getElementById('getStartedBtn').addEventListener('click', () => {
    navigateTo('auth');
  });
  document.getElementById('tryDemoBtn').addEventListener('click', () => {
    navigateTo('dashboard');
  });

  // Hamburger
  document.getElementById('hamburgerBtn').addEventListener('click', openSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // Add transaction button
  document.getElementById('addTxnBtn').addEventListener('click', openAddTransactionModal);

  // Modal close buttons
  document.getElementById('closeModal').addEventListener('click', () => closeModal('txnModal'));
  document.getElementById('cancelModal').addEventListener('click', () => closeModal('txnModal'));

  // Modal overlay click to close
  document.getElementById('txnModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('txnModal');
  });

  // Type toggle buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => setTypeToggle(btn.dataset.type));
  });

  // Save transaction
  document.getElementById('saveTxnBtn').addEventListener('click', saveTransaction);

  // Enter key in form
  ['txnTitle', 'txnAmount'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveTransaction();
    });
  });

  // Confirm modal
  document.getElementById('closeConfirm').addEventListener('click', () => closeModal('confirmModal'));
  document.getElementById('cancelConfirm').addEventListener('click', () => closeModal('confirmModal'));
  document.getElementById('okConfirm').addEventListener('click', () => {
    if (state.confirmCallback) state.confirmCallback();
    state.confirmCallback = null;
    closeModal('confirmModal');
  });
  document.getElementById('confirmModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('confirmModal');
  });

  // Transaction filters
  ['txnSearch', 'filterType', 'filterCategory', 'sortBy'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderTransactionsTable);
    document.getElementById(id)?.addEventListener('change', renderTransactionsTable);
  });

  // Budget save
  document.getElementById('saveBudgetBtn').addEventListener('click', saveBudget);
  
  // Goals save
  document.getElementById('saveGoalBtn')?.addEventListener('click', saveGoal);

  // Account management
  document.getElementById('accountSelect')?.addEventListener('change', e => switchAccount(e.target.value));
  document.getElementById('addAccountBtn')?.addEventListener('click', () => openModal('accountModal'));
  document.getElementById('closeAccountModal')?.addEventListener('click', () => closeModal('accountModal'));
  document.getElementById('cancelAccountModal')?.addEventListener('click', () => closeModal('accountModal'));
  document.getElementById('saveAccountBtn')?.addEventListener('click', saveAccount);
  document.getElementById('accountModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('accountModal');
  });
  document.getElementById('newAccountName')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveAccount();
  });


  // Settings: theme toggle
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('change', () => {
    applyTheme(themeToggle.checked ? 'dark' : 'light');
  });

  // Settings: theme toggle (topbar icon)
  document.getElementById('themeToggleTop')?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(isDark ? 'light' : 'dark');
  });

  // Settings: currency
  document.getElementById('currencySelect').addEventListener('change', e => {
    applyCurrency(e.target.value);
  });

  // Settings: export
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  
  // Settings: import
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importInput').click());
  document.getElementById('importInput').addEventListener('change', handleImport);

  // Settings: clear data
  document.getElementById('clearDataBtn').addEventListener('click', clearAllData);

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('txnModal');
      closeModal('confirmModal');
      closeModal('accountModal');
    }
  });

  // Auth Logic
  const tabSignup = document.getElementById('tabSignup');
  const tabLogin = document.getElementById('tabLogin');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const authSubmitBtn = document.getElementById('authSubmitBtn');

  const toggleAuth = (mode) => {
    const isSignup = mode === 'signup';
    tabSignup.classList.toggle('active', isSignup);
    tabLogin.classList.toggle('active', !isSignup);
    authTitle.textContent = isSignup ? 'Create Account' : 'Welcome Back';
    authSubtitle.textContent = isSignup ? 'Start your financial journey with Mizani' : 'Log in to manage your finances';
    authSubmitBtn.textContent = isSignup ? 'Create Account' : 'Log In';
  };

  tabSignup?.addEventListener('click', () => toggleAuth('signup'));
  tabLogin?.addEventListener('click', () => toggleAuth('login'));

  document.getElementById('authForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const isSignup = tabSignup.classList.contains('active');

    // Disable button to prevent double-submit
    const submitBtn = document.getElementById('authSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        if (data.user && !data.session) {
          showToast('Success! Please check your email to confirm your account.', 'success');
        } else if (data.session) {
          showToast('Account created and logged in!', 'success');
          navigateTo('dashboard');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        showToast(`Welcome back, ${email.split('@')[0]}!`, 'success');
        navigateTo('dashboard');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isSignup ? 'Create Account' : 'Log In';
    }
  });
}

// ============================================================
// INIT
// ============================================================

function init() {
  // PWA Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('Mizani Service Worker registered'))
        .catch(err => console.log('SW registration failed:', err));
    });
  }

  loadState();
  populateCategoryDropdowns();
  applyTheme(state.settings.theme);

  // Apply stored currency
  const currencySelect = document.getElementById('currencySelect');
  if (currencySelect) currencySelect.value = state.settings.currency;
  updateCurrencyPrefixes();

  // Sync theme toggle
  if (document.getElementById('themeToggle'))
  document.getElementById('themeToggle').checked = state.settings.theme === 'dark';

  // Formally persist the default Personal Account if this is the first run
  if (!localStorage.getItem(LS_KEYS.ACCOUNTS)) {
    saveAccounts();
    saveActiveAccount();
  }

  setupEventListeners();

  // If no transactions exist, show landing page
  if (state.transactions.length === 0) {
    navigateTo('landing');
  } else {
    navigateTo('dashboard');
  }
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);