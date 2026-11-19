/* ==========================================================================
   SaveGrow Lab — shared site behaviour (2026 rebuild)
   - Mobile navigation drawer
   - "Penny" money assistant: asks questions, builds a plan, links the tools
   - In-browser calculators (one per page)
   - PWA install prompt + service worker registration
   - Daily money minute + saving streak, share buttons, quiz, glossary search
   Everything runs on the visitor's device. Nothing is uploaded anywhere.
   ========================================================================== */
(function () {
  'use strict';

  var SG = (window.SG = window.SG || {});
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- formatting + storage ---------- */
  var money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });
  var money0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
  function gbp(n) { return money.format(Number.isFinite(n) ? n : 0); }
  function gbp0(n) { return money0.format(Number.isFinite(n) ? n : 0); }
  SG.gbp = gbp; SG.gbp0 = gbp0;

  var store = {
    get: function (key, fallback) {
      try { var raw = localStorage.getItem('sg_' + key); return raw ? JSON.parse(raw) : fallback; }
      catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem('sg_' + key, JSON.stringify(value)); } catch (e) { /* private mode */ }
    },
    remove: function (key) { try { localStorage.removeItem('sg_' + key); } catch (e) {} }
  };
  SG.store = store;

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toNum(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  /* ---------- toast ---------- */
  var toastEl;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }
  SG.toast = toast;

  /* ---------- mobile navigation ---------- */
  function setupNav() {
    var drawer = $('#navDrawer');
    var openBtn = $('#menuBtn');
    var closeBtn = $('#navClose');
    if (!drawer) return;
    function open() {
      drawer.classList.add('open');
      document.body.classList.add('no-scroll');
      if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
      var first = $('a, button', drawer);
      if (first) first.focus();
    }
    function close() {
      drawer.classList.remove('open');
      document.body.classList.remove('no-scroll');
      if (openBtn) { openBtn.setAttribute('aria-expanded', 'false'); openBtn.focus(); }
    }
    if (openBtn) openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    drawer.addEventListener('click', function (e) { if (e.target === drawer) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('open')) close(); });
  }
  SG.toggleMenu = setupNav;

  /* ---------- PWA install ---------- */
  var deferredPrompt = null;
  function setupPWA() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () { /* ignore */ });
      });
    }
    var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) document.documentElement.classList.add('pwa-standalone');

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      $$('[data-install-app]').forEach(function (b) { b.disabled = false; });
    });
    $$('[data-install-app]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (standalone) { toast('SaveGrow Lab is already installed on this device.'); return; }
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function (choice) {
            toast(choice && choice.outcome === 'accepted' ? 'Installing SaveGrow Lab…' : 'No problem — you can install any time from the browser menu.');
            deferredPrompt = null;
          });
          return;
        }
        var help = $('#installHelp');
        if (help) {
          help.classList.add('open');
          help.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        toast('Open your browser menu and choose “Add to Home Screen”.');
      });
    });
    window.addEventListener('appinstalled', function () {
      toast('SaveGrow Lab is on your home screen. See you tomorrow!');
      document.documentElement.classList.add('pwa-standalone');
    });
  }

  /* ---------- share ---------- */
  function shareData() {
    var title = (document.querySelector('meta[property="og:title"]') || {}).content || document.title;
    var text = (document.querySelector('meta[property="og:description"]') || {}).content || '';
    return { title: title, text: text, url: location.href.split('?')[0].split('#')[0] };
  }
  function setupShare() {
    $$('[data-share]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var data = shareData();
        if (btn.dataset.share === 'copy') {
          copyText(data.url + '\n' + data.text);
          return;
        }
        if (navigator.share) {
          navigator.share({ title: data.title, text: data.text, url: data.url }).catch(function () {});
        } else {
          copyText(data.url + '\n' + data.text);
        }
      });
    });
    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('Link copied — send it to a friend.'); },
          function () { toast('Copy this page URL from your address bar.'); });
      } else {
        toast('Copy this page URL from your address bar.');
      }
    }
  }

  /* ---------- money minute + streak ---------- */
  var TIPS = [
    'Move <strong>1% of your pay</strong> to savings the day it lands. One percent is invisible in your spending but real in your account.',
    'A subscription you have forgotten about still charges you. Cancel one today and put the amount toward your goal.',
    'Before any non-essential over £30, wait <strong>24 hours</strong>. The urge usually fades; the money stays.',
    'Name your savings account after the thing you want. “Holiday fund” is harder to raid than “Savings”.',
    'Rounding up purchases is a nice bonus, but a <strong>standing order</strong> is what actually builds the balance.',
    'Check your bank app for one recurring charge you do not recognise. That is found money.',
    'A £3 daily takeaway coffee is about <strong>£1,095 a year</strong>. Halving it funds a real goal.',
    'Weekend spending is where budgets quietly die. Set a cash or app limit before Saturday.',
    'Every pay rise is a chance to raise your saving rate before your lifestyle absorbs it.',
    'Your emergency fund should live in a <strong>separate bank</strong> so a bad evening cannot reach it.',
    'Shopping list first, then the shop. Never the other way round.',
    'Compare the <strong>unit price</strong>, not the pack price — the big box is not always cheaper.',
    'Put a 48-hour pause on sale emails. If you still want it after two days, buy it.',
    'Progress feels good. Open your savings app on a Friday and look at the number — that is the reward.'
  ];

  function dateKey(d) {
    var x = d || new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function dayOfYear(d) {
    var start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }
  function checkIn() {
    var today = dateKey();
    var s = store.get('streak', { count: 0, best: 0, last: null, done: [] });
    if (s.last === today) return s;
    var yesterday = dateKey(new Date(Date.now() - 86400000));
    s.count = s.last === yesterday ? (s.count || 0) + 1 : 1;
    s.best = Math.max(s.best || 0, s.count);
    s.last = today;
    store.set('streak', s);
    return s;
  }
  function renderStreak() {
    var s = checkIn();
    $$('[data-streak]').forEach(function (box) {
      var days = [];
      for (var i = 6; i >= 0; i--) {
        var d = new Date(Date.now() - i * 86400000);
        var k = dateKey(d);
        var done = k === dateKey() || (s.done || []).indexOf(k) !== -1;
        days.push('<span class="streak-day' + (done ? ' done' : '') + (i === 0 ? ' today' : '') + '" title="' + k + '">' +
          ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()] + '</span>');
      }
      box.innerHTML =
        '<div class="streak-top"><div><div class="small muted">Your saving streak</div>' +
        '<div class="streak-count">' + s.count + ' day' + (s.count === 1 ? '' : 's') + '</div></div>' +
        '<span class="pill">Best: ' + s.best + '</span></div>' +
        '<div class="streak-days" aria-label="Last seven days">' + days.join('') + '</div>';
    });
    $$('[data-money-tip]').forEach(function (box) {
      box.innerHTML = '<b>Money minute:</b> ' + TIPS[dayOfYear(new Date()) % TIPS.length];
    });
    $$('[data-mark-minute]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var today = dateKey();
        var s2 = store.get('streak', { count: 0, best: 0, last: null, done: [] });
        s2.done = s2.done || [];
        if (s2.done.indexOf(today) === -1) s2.done.push(today);
        store.set('streak', s2);
        btn.disabled = true;
        btn.textContent = 'Logged for today ✓';
        toast('Nice. One small money action beats a perfect plan.');
      });
    });
  }

  /* ---------- saved plan ---------- */
  function savePlan(plan) { store.set('plan', plan); renderPlan(); }
  function renderPlan() {
    var plan = store.get('plan', null);
    $$('[data-plan-card]').forEach(function (box) {
      if (!plan || !plan.target || !plan.months) {
        box.innerHTML = '<div class="small muted">No plan saved yet.</div>' +
          '<p class="mt-8" style="font-size:14px">Answer three quick questions and Penny will work out the monthly amount.</p>' +
          '<button class="btn primary sm mt-12" data-open-penny type="button">Build my plan →</button>';
        return;
      }
      var monthly = plan.monthly || Math.ceil(plan.target / plan.months);
      var pct = clamp((plan.saved || 0) / plan.target * 100, 0, 100);
      box.innerHTML =
        '<div class="mini-plan-top"><div><div class="mini-label">Your saved plan</div>' +
        '<div class="mini-title">' + esc(plan.label || 'Savings goal') + '</div></div>' +
        '<span class="pill">' + plan.months + ' months</span></div>' +
        '<div class="mini-value">' + gbp0(monthly) + '<span style="font-size:13px;font-weight:600;color:var(--muted)"> / month</span></div>' +
        '<div class="mini-sub">Target ' + gbp0(plan.target) + '</div>' +
        '<div class="mini-progress" aria-label="Progress ' + Math.round(pct) + ' percent"><i style="width:' + pct + '%"></i></div>' +
        '<div class="mini-stats">' +
        '<div class="mini-stat"><b>' + gbp0(plan.saved || 0) + '</b><span>saved</span></div>' +
        '<div class="mini-stat"><b>' + gbp0(Math.max(0, plan.target - (plan.saved || 0))) + '</b><span>to go</span></div>' +
        '<div class="mini-stat"><b>' + Math.round(pct) + '%</b><span>progress</span></div>' +
        '</div>' +
        '<a class="btn primary sm mt-12" href="/savemoney/?target=' + plan.target + '&months=' + plan.months +
        (plan.saved ? '&saved=' + plan.saved : '') + '&label=' + encodeURIComponent(plan.label || 'My goal') + '">Open my calculator →</a>';
    });
    $$('[data-plan-inline]').forEach(function (el) {
      if (plan && plan.target) {
        el.textContent = 'Your plan: ' + gbp0(plan.target) + ' in ' + plan.months + ' months → ' + gbp0(plan.monthly || plan.target / plan.months) + ' a month.';
      }
    });
  }
  SG.savePlan = savePlan;

  /* ---------- assistant: Penny ---------- */
  var TOOL_PAGES = {
    savings: '/savemoney/',
    budget: '/budget/',
    emergency: '/emergency-fund/',
    compound: '/compound-interest/',
    trip: '/trip-budget/',
    quickmaths: '/quickmaths/',
    debt: '/debt-payoff/',
    pace: '/savings-pace/',
    subscriptions: '/subscriptions/',
    quiz: '/money-health-check/'
  };
  var NAME = 'Penny';
  var GREETING = "Hi, I'm Penny — your money-saving assistant. I ask a few quick questions, then turn your answers into a monthly number you can actually use. What are you saving for?";

  var QUICK_CHIPS = ['Holiday', 'Emergency fund', 'Pay off debt', 'Budget my pay', 'Just looking'];

  var RULES = [
    {
      id: 'savings', kw: ['save', 'saving', 'savings', 'goal', 'holiday', 'target', 'deposit', 'wedding', 'laptop', 'phone', 'car'],
      reply: 'Let’s turn that into a monthly figure. I’ll ask three quick questions — or you can jump straight to the calculator.',
      links: [{ label: 'Open the savings goal calculator', href: TOOL_PAGES.savings }, { label: 'Guide: how to save money consistently', href: '/guides/how-to-save-money.html' }],
      chips: ['Build my plan']
    },
    {
      id: 'emergency', kw: ['emergency', 'rainy day', 'cushion', 'redundancy', 'job loss', 'unexpected bill', 'safety net'],
      reply: 'An emergency fund is the bit that stops a bad week becoming a debt. Aim for one month of essential costs first, then build to three.',
      links: [{ label: 'Check my emergency fund', href: TOOL_PAGES.emergency }, { label: 'Guide: sizing your emergency fund', href: '/guides/emergency-fund-uk.html' }],
      chips: ['Check my cushion']
    },
    {
      id: 'budget', kw: ['budget', '50/30/20', 'spending plan', 'payday', 'salary', 'income', 'rent', 'bills', 'afford'],
      reply: 'A budget is just a decision made before payday, not after. The 50/30/20 split is the easiest place to start.',
      links: [{ label: 'Open the budget planner', href: TOOL_PAGES.budget }, { label: 'Guide: a UK budget that survives real life', href: '/guides/budgeting-guide-uk.html' }],
      chips: ['Split my pay']
    },
    {
      id: 'debt', kw: ['debt', 'loan', 'credit card', 'overdraft', 'repay', 'apr', 'borrow', 'interest charge'],
      reply: 'High-rate debt grows faster than savings do, so it usually comes first. I can estimate how long yours will take to clear.',
      links: [{ label: 'Open the debt payoff planner', href: TOOL_PAGES.debt }, { label: 'Guide: snowball vs avalanche', href: '/guides/debt-snowball-vs-avalanche.html' }],
      chips: ['Plan my debt payoff']
    },
    {
      id: 'compound', kw: ['compound', 'interest', 'aer', 'growth', 'invest', 'etf', 'stocks', 'shares', 'isa', 'pension', 'risk'],
      reply: 'Compound growth rewards time more than amount. Small monthly contributions over many years beat big lump sums added late.',
      links: [{ label: 'Open the compound interest calculator', href: TOOL_PAGES.compound }, { label: 'Investing starter: mix and fees', href: '/invest/' }, { label: 'Guide: compound interest with real numbers', href: '/guides/compound-interest-explained.html' }, { label: 'Guide: investing for beginners', href: '/guides/investing-for-beginners-uk.html' }],
      chips: []
    },
    {
      id: 'trip', kw: ['trip', 'holiday', 'travel', 'vacation', 'flight', 'hotel', 'weekend away', 'honeymoon'],
      reply: 'Holidays get expensive in the extras: food, transfers, and “we’re on holiday” spending. A 10–15% buffer keeps the total honest.',
      links: [{ label: 'Open the trip budget calculator', href: TOOL_PAGES.trip }, { label: 'Guide: plan a cheap holiday', href: '/guides/cheap-holiday-planning-uk.html' }],
      chips: []
    },
    {
      id: 'shop', kw: ['shop', 'shopping', 'basket', 'supermarket', 'groceries', 'discount', 'sale', 'impulse', 'spend too much'],
      reply: 'Grocery bills respond to systems, not guilt. Estimate the basket before the till, compare unit prices, and shop from a list.',
      links: [{ label: 'Try quick maths for a basket or discount', href: TOOL_PAGES.quickmaths }, { label: 'Guide: save money on groceries', href: '/guides/save-money-on-groceries.html' }],
      chips: []
    },
    {
      id: 'subscriptions', kw: ['subscription', 'subscriptions', 'netflix', 'spotify', 'recurring', 'direct debit', 'free trial', 'membership'],
      reply: 'Subscriptions are designed to be forgotten. List every recurring payment once, multiply by 12, and cancel the one you would not buy again today.',
      links: [{ label: 'Open the subscription audit', href: TOOL_PAGES.subscriptions }, { label: 'Guide: the subscription audit', href: '/guides/subscription-audit-guide.html' }],
      chips: []
    },
    {
      id: 'autopilot', kw: ['autopilot', 'where do i start', 'what first', 'order of operations', 'priority', 'prioritise', 'prioritize', 'surplus', 'what should i do first'],
      reply: 'Start with one month of essentials, then any debt above 10% APR, then the goal. I can sequence the whole thing from your pay, your essentials, the debt and a deadline — one plan, no spreadsheet.',
      links: [{ label: 'Build a money autopilot plan', href: '/autopilot/' }, { label: 'Why the order matters', href: '/guides/payday-routine.html' }],
      chips: ['Build my plan']
    },
    {
      id: 'earn', kw: ['pay rise', 'raise', 'salary', 'earn more', 'side hustle', 'side income', 'second job', 'promotion', 'freelance', 'overtime'],
      reply: 'Cutting costs has a floor; income does not. Ask for a specific number with three evidenced outcomes, or add one small income stream — and check the £1,000 trading allowance before you start.',
      links: [{ label: 'Guide: earning more in the UK', href: '/guides/earn-more-uk-side-income.html' }, { label: 'The pay-rise script, word for word', href: '/post/pay-rise-script.html' }],
      chips: ['How do I ask?']
    },
    {
      id: 'challenge', kw: ['challenge', '52 week', 'save 1000', 'save £1000', 'streak', 'no spend', 'save faster'],
      reply: 'A short challenge makes progress visible. Give me a total and a deadline — “£1,000 in 13 weeks” — and I can point you at the weekly schedule.',
      links: [{ label: 'Generate a savings challenge', href: '/challenges/' }, { label: 'Blog: save £1,000 in 90 days', href: '/post/save-1000-in-90-days.html' }],
      chips: []
    },
    {
      id: 'install', kw: ['app', 'install', 'home screen', 'shortcut', 'pwa', 'phone', 'qr', 'offline'],
      reply: 'SaveGrow Lab installs like an app: open your browser menu and choose “Add to Home Screen”. On iPhone that is the Share button → Add to Home Screen. The QR code on the home page takes you straight here.',
      links: [{ label: 'Install help + QR code', href: '/#install' }],
      chips: []
    },
    {
      id: 'quiz', kw: ['quiz', 'health check', 'score', 'how am i doing', 'check my money'],
      reply: 'The money health check scores six habits in under a minute, then gives you the one thing to fix first.',
      links: [{ label: 'Take the money health check', href: TOOL_PAGES.quiz }],
      chips: []
    },
    {
      id: 'privacy', kw: ['privacy', 'data', 'cookie', 'tracking', 'safe', 'store my'],
      reply: 'No account, no upload: calculator numbers never leave your device. Your saved plan and streak live in your browser’s local storage, and you can clear them any time. Adverts are served by Adsterra, which sets its own cookies.',
      links: [{ label: 'Read the privacy policy', href: '/privacy-policy.html' }],
      chips: []
    },
    {
      id: 'contact', kw: ['contact', 'email', 'human', 'feedback', 'correction', 'complaint'],
      reply: 'The editorial team reads everything sent to services@digitalinfohub.net. The contact form opens a pre-filled email in your own mail app.',
      links: [{ label: 'Open the contact page', href: '/contact.html' }],
      chips: []
    }
  ];

  var NUM_HINT = 'I need a number for that — try something like 1500, £1500 or 1.5k.';

  function parseMoney(text) {
    var s = String(text).toLowerCase().replace(/,/g, '').replace(/£/g, '').trim();
    var m = s.match(/(\d+(?:\.\d+)?)\s*(k|thousand|m|million)?/);
    if (!m) return NaN;
    var n = parseFloat(m[1]);
    if (m[2] === 'k' || m[2] === 'thousand') n *= 1000;
    if (m[2] === 'm' || m[2] === 'million') n *= 1000000;
    return Number.isFinite(n) ? n : NaN;
  }
  function parseMonths(text) {
    var s = String(text).toLowerCase();
    var n = parseFloat((s.match(/(\d+(?:\.\d+)?)/) || [])[1]);
    if (!Number.isFinite(n)) return NaN;
    if (/year|yr/.test(s)) n *= 12;
    else if (/week/.test(s)) n = Math.max(1, Math.ceil(n / 4.345));
    return Math.round(n);
  }

  var FLOWS = {
    goal: {
      intro: 'Three questions and you’ll have a monthly number. What are you saving for?',
      steps: [
        { key: 'label', q: 'What are you saving for?', chips: ['Holiday', 'Emergency fund', 'House deposit', 'A car', 'Something else'], parse: function (t) { return String(t).slice(0, 40) || 'My goal'; } },
        { key: 'target', q: 'How much does it need to be?', chips: ['£500', '£1,000', '£2,000', '£5,000'], parse: parseMoney, numeric: true },
        { key: 'months', q: 'When do you want it by?', chips: ['3 months', '6 months', '12 months', '2 years'], parse: parseMonths, numeric: true }
      ],
      finish: function (d) {
        var months = Math.max(1, d.months);
        var monthly = Math.ceil(d.target / months);
        savePlan({ label: d.label, target: d.target, months: months, monthly: monthly, saved: 0 });
        return {
          text: 'Here’s the plan: <strong>' + gbp0(monthly) + ' a month</strong> for ' + months + ' month' + (months === 1 ? '' : 's') +
            ' gets you to <strong>' + gbp0(d.target) + '</strong> for ' + esc(d.label) + '. I’ve saved it to this device — the calculator can refine it with interest or an existing balance.',
          links: [
            { label: 'Open my plan in the calculator', href: '/savemoney/?target=' + d.target + '&months=' + months + '&label=' + encodeURIComponent(d.label) },
            { label: 'Read: how to make the habit stick', href: '/guides/how-to-save-money.html' }
          ],
          chips: ['Make it cheaper', 'Set up my budget']
        };
      }
    },
    emergency: {
      intro: 'Let’s size your safety net. What are your essential monthly costs — rent, bills, food, travel?',
      steps: [
        { key: 'costs', q: 'Essential monthly costs (£)?', chips: ['£800', '£1,200', '£1,600', '£2,000'], parse: parseMoney, numeric: true },
        { key: 'saved', q: 'How much is in your emergency fund now?', chips: ['£0', '£500', '£1,500', '£3,000'], parse: parseMoney, numeric: true, allowZero: true }
      ],
      finish: function (d) {
        var months = d.costs > 0 ? d.saved / d.costs : 0;
        var gap = Math.max(0, d.costs * 3 - d.saved);
        return {
          text: 'You currently cover <strong>' + months.toFixed(1) + ' months</strong> of essentials. A three-month cushion is ' + gbp0(d.costs * 3) +
            (gap > 0 ? ', so you’re ' + gbp0(gap) + ' away. At £100 a month, closing that gap takes about ' + Math.ceil(gap / 100) + ' months.' : ' — you’re already there.'),
          links: [
            { label: 'Open the emergency fund calculator', href: '/emergency-fund/?costs=' + d.costs + '&saved=' + d.saved },
            { label: 'Read: how much is enough?', href: '/guides/emergency-fund-uk.html' }
          ],
          chips: ['Where do I keep it?', 'Build my savings plan']
        };
      }
    },
    budget: {
      intro: 'Tell me your monthly take-home pay and I’ll split it 50/30/20.',
      steps: [
        { key: 'income', q: 'Monthly take-home pay (£)?', chips: ['£1,200', '£1,800', '£2,500', '£3,500'], parse: parseMoney, numeric: true }
      ],
      finish: function (d) {
        var inc = d.income;
        return {
          text: 'On ' + gbp0(inc) + ': <strong>' + gbp0(inc * 0.5) + ' essentials</strong>, <strong>' + gbp0(inc * 0.3) +
            ' lifestyle</strong> and <strong>' + gbp0(inc * 0.2) + ' saving</strong>. If rent makes 50% impossible, use the 60/20/20 or 70/15/15 version instead — a plan you can keep beats a perfect one you quit.',
          links: [
            { label: 'Open the budget planner', href: '/budget/?income=' + inc },
            { label: 'Read: the UK budgeting guide', href: '/guides/budgeting-guide-uk.html' }
          ],
          chips: ['What counts as essentials?', 'Build a savings plan']
        };
      }
    },
    debt: {
      intro: 'Let’s see how long this will take. What’s the balance you want to clear?',
      steps: [
        { key: 'balance', q: 'Balance owed (£)?', chips: ['£1,000', '£3,000', '£5,000', '£10,000'], parse: parseMoney, numeric: true },
        { key: 'apr', q: 'Roughly what APR?', chips: ['0%', '10%', '20%', '29%'], parse: function (t) { return clamp(parseMoney(t), 0, 100); }, numeric: true, allowZero: true },
        { key: 'payment', q: 'What can you pay each month?', chips: ['£100', '£200', '£300', '£500'], parse: parseMoney, numeric: true }
      ],
      finish: function (d) {
        var bal = d.balance, apr = d.apr, pay = d.payment, months = 0, interest = 0;
        var rate = apr / 100 / 12;
        if (pay <= bal * rate) {
          return { text: 'At ' + gbp0(pay) + ' a month the interest alone is ' + gbp0(bal * rate) + ', so the balance never falls. Even £25 more a month changes the outcome.', links: [{ label: 'Open the debt payoff planner', href: '/debt-payoff/' }], chips: ['Try a bigger payment'] };
        }
        while (bal > 0 && months < 720) { var add = bal * rate; interest += add; bal = bal + add - pay; months++; }
        return {
          text: 'Debt-free in about <strong>' + months + ' months</strong>, paying <strong>' + gbp0(interest) + '</strong> in interest along the way. Adding even £50 a month cuts both numbers sharply.',
          links: [
            { label: 'Open the debt payoff planner', href: '/debt-payoff/?balance=' + d.balance + '&apr=' + apr + '&payment=' + pay },
            { label: 'Read: snowball vs avalanche', href: '/guides/debt-snowball-vs-avalanche.html' }
          ],
          chips: ['Build a savings plan']
        };
      }
    }
  };

  var CONTEXT_QUESTIONS = {
    savings: 'Want me to check that number works? I can compare it against a realistic monthly amount.',
    budget: 'Does your budget survive payday? I can split your take-home in one question.',
    emergency: 'Quick check: how many months of essentials could your savings cover right now?',
    compound: 'Want to see what time does to your money? Tell me an amount and I’ll show the growth.',
    autopilot: 'Want your whole plan sequenced — buffer, debt, goal, investing? Give me eight numbers and I’ll build it.',
    trip: 'Planning a trip? Tell me the destination budget and I’ll add a realistic buffer.',
    quickmaths: 'Need a bill split, a discount or a unit price? Ask me and I’ll do the maths.',
    debt: 'Want to know how long your debt will take to clear? I can estimate it in three questions.',
    subscriptions: 'How many subscriptions are you paying for? I can show the yearly total.',
    challenges: 'How much do you want to save, and by when? A weekly schedule is easier to finish than a monthly intention.',
    pace: 'Several goals competing for the same pay? I can help you choose what to fund first.',
    quiz: 'Six questions, one score. Want to find the weakest part of your money setup?',
    home: 'What are you saving for? I’ll turn it into a monthly amount in three questions.',
    assistant: 'What are you saving for? Pick a starting point or just type a question.'
  };

  function ruleMatch(text) {
    var t = ' ' + text.toLowerCase().replace(/[^a-z0-9£\s'\/.-]/g, ' ').replace(/\s+/g, ' ') + ' ';
    var best = null, bestScore = 0;
    RULES.forEach(function (rule) {
      var score = 0;
      rule.kw.forEach(function (k) {
        if (k.indexOf(' ') !== -1) { if (t.indexOf(k) !== -1) score += 2; }
        else if (new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t)) score += 1;
      });
      if (score > bestScore) { best = rule; bestScore = score; }
    });
    return best;
  }

  function chatTemplate() {
    return '' +
      '<div class="penny-head">' +
      '<span class="penny-avatar"><img src="/assets/icons/icon-192.png" alt="" width="34" height="34" loading="lazy"></span>' +
      '<div class="penny-id"><div class="penny-name">' + NAME + ' <span class="tag" style="font-size:9px">on-device</span></div>' +
      '<div class="penny-status"><i></i> Money-saving assistant</div></div>' +
      '<button class="penny-mini-btn" type="button" data-penny-close aria-label="Close assistant">✕</button>' +
      '</div>' +
      '<div class="penny-log" data-penny-log role="log" aria-live="polite"></div>' +
      '<form class="penny-form" data-penny-form>' +
      '<label class="sr-only" for="pennyInput">Ask Penny a question</label>' +
      '<input class="penny-input" data-penny-input placeholder="Ask me anything about money…" autocomplete="off">' +
      '<button class="penny-send" type="submit">Send</button>' +
      '</form>' +
      '<div class="penny-note">Penny runs in your browser and gives general guidance, not regulated financial advice. Your answers are saved only on this device.</div>';
  }

  function createPenny(root, opts) {
    opts = opts || {};
    var isPanel = !!opts.panel;
    root.innerHTML = chatTemplate();
    var log = $('[data-penny-log]', root);
    var form = $('[data-penny-form]', root);
    var input = $('[data-penny-input]', root);
    var closeBtn = $('[data-penny-close]', root);
    if (isPanel && closeBtn) closeBtn.addEventListener('click', function () { closePanel(); });
    else if (closeBtn) closeBtn.hidden = true;

    var state = { flow: null, step: 0, data: {}, greeted: false };

    function addMessage(role, html) {
      var el = document.createElement('div');
      el.className = 'penny-msg ' + role;
      el.innerHTML = html;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }
    function chips(list) {
      if (!list || !list.length) return '';
      return '<div class="penny-chips">' + list.map(function (c) {
        return '<button class="penny-chip" type="button" data-chip="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div>';
    }
    function links(list) {
      if (!list || !list.length) return '';
      return '<div class="link-list">' + list.map(function (l) {
        return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
      }).join('') + '</div>';
    }
    function bot(payload) {
      if (typeof payload === 'string') payload = { text: payload };
      addMessage('bot', '<span>' + payload.text + '</span>' + links(payload.links) + chips(payload.chips));
    }
    function ask(step) {
      bot({ text: step.q, chips: step.chips });
    }

    function startFlow(id) {
      var flow = FLOWS[id];
      if (!flow) return;
      state.flow = id; state.step = 0; state.data = {};
      bot(flow.intro || flow.steps[0].q);
      if (flow.intro) ask(flow.steps[0]);
    }

    function finishFlow() {
      var flow = FLOWS[state.flow];
      var result;
      try { result = flow.finish(state.data); }
      catch (e) { result = { text: 'Something in those numbers did not add up. Try starting again with a target and a timeline.' }; }
      state.flow = null; state.step = 0; state.data = {};
      bot(result);
    }

    function answerStep(text) {
      var flow = FLOWS[state.flow];
      var step = flow.steps[state.step];
      var value = step.parse(text);
      if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || (value === 0 && !step.allowZero))) {
        bot({ text: NUM_HINT, chips: step.chips });
        return;
      }
      if (typeof value === 'string' && !value.trim()) {
        bot({ text: 'Give it a short name and I’ll use it on your plan.', chips: step.chips });
        return;
      }
      state.data[step.key] = value;
      state.step++;
      if (state.step < flow.steps.length) ask(flow.steps[state.step]);
      else finishFlow();
    }

    function handle(text) {
      var clean = String(text).trim();
      if (!clean) return;
      addMessage('user', esc(clean));

      if (state.flow) { answerStep(clean); return; }

      var lower = clean.toLowerCase();
      var shortcuts = {
        'holiday': ['goal', 'Holiday'],
        'emergency fund': ['emergency'],
        'pay off debt': ['debt'],
        'budget my pay': ['budget'],
        'set up my budget': ['budget'],
        'build my savings plan': ['goal'],
        'check my cushion': ['emergency'],
        'plan my debt payoff': ['debt']
      };
      if (lower === 'just looking') {
        bot({ text: 'That is allowed. Here is the least effortful place to start: the money health check takes about a minute and tells you the one thing worth fixing first.', links: [{ label: 'Take the money health check', href: '/money-health-check/' }, { label: 'See all ten tools', href: '/tools/' }], chips: ['Build my plan', 'Emergency fund', 'Budget my pay'] });
        return;
      }
      if (shortcuts[lower]) {
        var route = shortcuts[lower];
        startFlow(route[0]);
        if (route[1]) answerStep(route[1]);
        return;
      }
      var chipReplies = {
        'make it cheaper': {
          text: 'Three fastest cuts: plan the weekly shop from a list, cancel one subscription, and add a 24-hour pause to any purchase over £30. Together they usually free £40–£80 a month.',
          links: [{ label: 'Cut the grocery bill', href: '/guides/save-money-on-groceries.html' }, { label: 'Run the subscription audit', href: '/guides/subscription-audit-guide.html' }],
          chips: []
        },
        'where do i keep it?': {
          text: 'Easy access, separate bank, not invested. The fund must not be able to fall the week you need it, and it should not be attached to your debit card.',
          links: [{ label: 'Read the emergency fund guide', href: '/guides/emergency-fund-uk.html' }, { label: 'ISA vs savings account', href: '/guides/isa-vs-savings-account-uk.html' }],
          chips: []
        },
        'what counts as essentials?': {
          text: 'Housing, Council Tax, energy, water, insurance, food shops, commuting, childcare and minimum debt payments. Everything else is lifestyle — including the subscriptions that leave automatically.',
          links: [{ label: 'The 50/30/20 guide', href: '/guides/50-30-20-budget-rule.html' }, { label: 'Open the budget planner', href: '/budget/' }],
          chips: []
        },
        'try a bigger payment': {
          text: 'The payment must beat the monthly interest, or the balance never falls. Add the amount that would cover the interest plus a little, and increase it whenever a subscription or bill gets cancelled.',
          links: [{ label: 'Open the debt payoff planner', href: '/debt-payoff/' }],
          chips: []
        }
      };
      if (chipReplies[lower]) { bot(chipReplies[lower]); return; }
      if (/^(start again|restart|reset)$/.test(lower)) {
        state.flow = null; state.step = 0; state.data = {};
        bot({ text: 'Fresh start. What are you saving for?', chips: QUICK_CHIPS });
        return;
      }
      if (lower.indexOf('build my plan') !== -1 || lower === 'make a plan' || lower.indexOf('saving plan') !== -1) {
        startFlow('goal'); return;
      }
      if (lower.indexOf('emergency') !== -1 || lower.indexOf('cushion') !== -1) { startFlow('emergency'); return; }
      if (lower.indexOf('split my pay') !== -1 || lower.indexOf('budget my pay') !== -1 || lower.indexOf('my pay') !== -1) { startFlow('budget'); return; }
      if (lower.indexOf('plan my debt') !== -1 || lower.indexOf('debt payoff') !== -1) { startFlow('debt'); return; }

      var rule = ruleMatch(clean);
      if (rule) {
        bot({ text: rule.reply, links: rule.links, chips: rule.chips });
        if (rule.id === 'savings' && /^save|saving/.test(lower) && clean.split(' ').length > 2) return;
        return;
      }
      bot({
        text: 'I can help with saving plans, budgets, emergency funds, debt, compound growth, bills and subscriptions. Which is closest to what you need?',
        links: [
          { label: 'See every free calculator', href: '/tools/' },
          { label: 'Browse the guides', href: '/guides/' }
        ],
        chips: QUICK_CHIPS
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value;
      input.value = '';
      handle(text);
    });
    root.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-chip]');
      if (chip) { handle(chip.getAttribute('data-chip')); return; }
    });

    // Opening question: Penny always asks something first.
    var context = opts.context || document.body.getAttribute('data-penny-context') || 'home';
    var first = opts.startFlow && FLOWS[opts.startFlow] ? opts.startFlow : null;
    bot({ text: GREETING, chips: QUICK_CHIPS });
    if (CONTEXT_QUESTIONS[context] && context !== 'home' && context !== 'assistant') {
      bot({ text: CONTEXT_QUESTIONS[context], chips: [] });
    }
    if (first) setTimeout(function () { startFlow(first); }, 500);

    SG.pennyInstances = SG.pennyInstances || [];
    SG.pennyInstances.push({ root: root, handle: handle, panel: isPanel });
  }

  /* Floating launcher + panel */
  var panelRoot, panelPressed;
  function ensurePanel() {
    if (panelRoot) return panelRoot;
    var panel = document.createElement('div');
    panel.className = 'penny-panel';
    panel.innerHTML = '<div class="penny-panel-inner penny" data-penny-floating></div>';
    document.body.appendChild(panel);
    panel.addEventListener('click', function (e) { if (e.target === panel) closePanel(); });
    panelRoot = panel;
    createPenny($('[data-penny-floating]', panel), { panel: true });
    return panel;
  }
  function openPenny() {
    ensurePanel();
    panelRoot.classList.add('open');
    document.body.classList.add('no-scroll');
    setTimeout(function () {
      var input = $('[data-penny-input]', panelRoot);
      if (input) input.focus();
    }, 60);
  }
  function closePanel() {
    if (!panelRoot) return;
    panelRoot.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }
  SG.openPenny = openPenny;
  SG.closePenny = closePanel;

  function setupPenny() {
    // Delegated so buttons rendered later (saved plan card, etc.) still work.
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-open-penny]');
      if (!btn) return;
      e.preventDefault();
      openPenny();
    });
    $$('[data-penny-inline]').forEach(function (root) {
      createPenny(root, {
        context: root.getAttribute('data-penny-context') || null,
        full: root.hasAttribute('data-penny-full'),
        startFlow: root.getAttribute('data-penny-start') || null
      });
    });
    if (document.body.getAttribute('data-penny') === 'off') return;

    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'penny-fab';
    fab.setAttribute('aria-label', 'Ask Penny, the SaveGrow money assistant');
    fab.innerHTML = '<span class="fab-dot"></span> Ask ' + NAME;
    fab.addEventListener('click', openPenny);
    document.body.appendChild(fab);

    var pop = document.createElement('div');
    pop.className = 'penny-pop';
    pop.setAttribute('role', 'status');
    pop.innerHTML = '<div data-pop-content></div>';
    document.body.appendChild(pop);
    pop.addEventListener('click', function (e) {
      var act = e.target.closest('[data-pop-action]');
      if (act) {
        var action = act.getAttribute('data-pop-action');
        pop.classList.remove('open');
        if (action === 'open') openPenny();
        else if (action === 'close') return;
      }
    });

    var shown = false;
    function showPop(kind) {
      if (shown) return;
      try { if (sessionStorage.getItem('sg_pop')) return; } catch (e) {}
      shown = true;
      var content = kind === 'exit'
        ? '<b>Before you go:</b> the 7-day saving challenge is free and takes two minutes a day.' +
          '<div class="penny-pop-actions"><a class="btn primary sm" href="/guides/no-spend-challenge.html">Start the challenge</a>' +
          '<button class="penny-mini-btn" type="button" data-pop-action="close" aria-label="Dismiss">✕</button></div>'
        : '<b>' + (CONTEXT_QUESTIONS[document.body.getAttribute('data-penny-context')] ? 'Quick question' : 'One quick question') + ':</b> ' +
          esc(CONTEXT_QUESTIONS[document.body.getAttribute('data-penny-context')] || CONTEXT_QUESTIONS.home) +
          '<div class="penny-pop-actions"><button class="btn primary sm" type="button" data-pop-action="open">Ask ' + NAME + '</button>' +
          '<button class="penny-mini-btn" type="button" data-pop-action="close" aria-label="Dismiss">✕</button></div>';
      $('[data-pop-content]', pop).innerHTML = content;
      pop.classList.add('open');
      try { sessionStorage.setItem('sg_pop', '1'); } catch (e) {}
    }
    setTimeout(function () { showPop('nudge'); }, 20000);
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && e.clientY <= 0) showPop('exit');
    });
  }

  /* ---------- calculators ---------- */
  function readField(root, name) {
    var el = root.querySelector('[name="' + name + '"]');
    if (!el) return NaN;
    var v = toNum(el.value);
    var field = el.closest('.field');
    if (field) field.classList.toggle('invalid', el.value !== '' && (!Number.isFinite(v) || v < 0));
    return v;
  }
  function headingText(box, label, value, meta, stats, next) {
    var statsHtml = (stats || []).map(function (s) {
      return '<div class="result-stat"><b>' + s.value + '</b><span>' + s.label + '</span></div>';
    }).join('');
    box.className = 'result';
    box.innerHTML = '<div class="result-label">' + label + '</div>' +
      '<div class="result-value">' + value + '</div>' +
      '<div class="result-meta">' + meta + '</div>' +
      (statsHtml ? '<div class="result-grid">' + statsHtml + '</div>' : '') +
      (next ? '<div class="next-step">' + next + '</div>' : '');
  }
  function errorBox(box, message) {
    box.className = 'result error';
    box.innerHTML = '<div class="result-label">Check your inputs</div><div class="result-value" style="font-size:1.1rem;letter-spacing:0">Something is missing</div><div class="result-meta">' + esc(message) + '</div>';
  }
  function stat(label, value) { return { label: label, value: value }; }

  function bindSubmit(form, fn) {
    form.addEventListener('submit', function (e) { e.preventDefault(); fn(); });
    $$('[data-calc]', form).forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); fn(); });
    });
  }

  function applyQuery(form) {
    var params = new URLSearchParams(location.search);
    if (!params.toString()) return;
    var touched = false;
    params.forEach(function (value, key) {
      if (key === 'label') return;
      var input = form.querySelector('[name="' + key + '"]');
      if (input && value !== '') { input.value = value; touched = true; }
    });
    var note = document.querySelector('[data-prefill-note]');
    if (note && touched) {
      var label = params.get('label');
      note.innerHTML = 'Loaded from your saved plan' + (label ? ' for <strong>' + esc(label) + '</strong>' : '') + ' — adjust anything you like.';
      note.classList.add('open');
    }
  }

  var tools = {
    savings: function (form) {
      var box = $('[data-result]', form);
      applyQuery(form);
      function calc() {
        var target = readField(form, 'target');
        var saved = readField(form, 'saved') || 0;
        var months = readField(form, 'months');
        var monthly = readField(form, 'monthly');
        var rate = readField(form, 'rate') || 0;
        if (!Number.isFinite(target) || target <= 0) return errorBox(box, 'Enter a savings target above £0.');
        if (!Number.isFinite(months) || months < 1) return errorBox(box, 'Enter how many months you have (at least 1).');
        months = Math.max(1, Math.round(months));
        if (saved >= target) {
          headingText(box, 'Goal already funded', gbp(target), 'Your balance already meets the target. Name the next goal so the money keeps a purpose.',
            [stat('Target', gbp0(target)), stat('Saved', gbp0(saved)), stat('To go', gbp0(0))],
            'Ready for the next step? <a href="/guides/sinking-funds-explained.html">Read about sinking funds</a> so future costs stop arriving as surprises.');
          return;
        }
        var mRate = rate / 100 / 12;
        var needed;
        if (mRate > 0) needed = (target - saved * Math.pow(1 + mRate, months)) * mRate / (Math.pow(1 + mRate, months) - 1);
        else needed = (target - saved) / months;
        needed = Math.max(0, needed);
        var remaining = target - saved;
        var monthsAtPace = Number.isFinite(monthly) && monthly > 0
          ? (mRate > 0 ? Math.ceil(Math.log((monthly + (target * mRate)) / ((saved * mRate) + monthly)) / Math.log(1 + mRate)) : Math.ceil(remaining / monthly))
          : null;
        var meta = 'To reach ' + gbp0(target) + ' in ' + months + ' months from ' + gbp0(saved) +
          (rate > 0 ? ', assuming ' + rate + '% a year and savings at the end of each month.' : ', with no interest assumed.') +
          (monthsAtPace ? ' At ' + gbp0(monthly) + ' a month you would get there in about ' + monthsAtPace + ' months.' : '');
        headingText(box, 'Save this much each month', gbp(needed), meta,
          [stat('Target', gbp0(target)), stat('Already saved', gbp0(saved)), stat('Months', months)],
          'Save the plan to your device: use “Save my plan” below, then check the <a href="/savemoney/#guide">savings guide</a> for the habit side.');
        var planBox = $('[data-plan-save]', form);
        if (planBox) planBox.hidden = false;
        form._plan = { label: new URLSearchParams(location.search).get('label') || 'My savings goal', target: target, saved: saved, months: months, monthly: Math.ceil(needed) };
      }
      bindSubmit(form, calc);
      var saveBtn = $('[data-save-plan]', form);
      if (saveBtn) saveBtn.addEventListener('click', function () {
        if (form._plan) { savePlan(form._plan); toast('Plan saved to this device.'); }
        else calc();
      });
      calc();
    },

    budget: function (form) {
      var box = $('[data-result]', form);
      applyQuery(form);
      function calc() {
        var income = readField(form, 'income');
        var styleEl = form.querySelector('[name="style"]');
        var style = ((styleEl && styleEl.value) || '50/30/20').split('/').map(Number);
        if (!Number.isFinite(income) || income <= 0) return errorBox(box, 'Enter your monthly take-home pay above £0.');
        var ess = income * style[0] / 100, flex = income * style[1] / 100, save = income * style[2] / 100;
        headingText(box, 'Your monthly split', gbp0(income),
          'Using ' + style[0] + '/' + style[1] + '/' + style[2] + '. If rent pushes essentials past ' + style[0] + '%, shift the percentages rather than abandoning the budget.',
          [stat('Essentials', gbp0(ess)), stat('Lifestyle', gbp0(flex)), stat('Save / invest', gbp0(save))],
          'Put the saving first: <a href="/guides/payday-routine.html">set up a payday routine</a>, then check what your saving rate becomes in 10 years with the <a href="/compound-interest/">compound calculator</a>.');
      }
      bindSubmit(form, calc);
      calc();
    },

    emergency: function (form) {
      var box = $('[data-result]', form);
      applyQuery(form);
      function calc() {
        var saved = readField(form, 'saved');
        var costs = readField(form, 'costs');
        var target = readField(form, 'target') || 3;
        var monthly = readField(form, 'monthly');
        if (!Number.isFinite(costs) || costs <= 0) return errorBox(box, 'Enter your essential monthly costs above £0.');
        if (!Number.isFinite(saved) || saved < 0) return errorBox(box, 'Enter what you currently have saved (0 is fine).');
        var coverage = saved / costs;
        var goal = costs * target;
        var gap = Math.max(0, goal - saved);
        var monthsToClose = Number.isFinite(monthly) && monthly > 0 ? Math.ceil(gap / monthly) : null;
        headingText(box, 'Your emergency fund covers', coverage.toFixed(1) + ' months',
          'At ' + gbp0(costs) + ' of essential costs a month, a ' + target + '-month cushion is ' + gbp0(goal) + '. ' +
          (gap > 0 ? 'You are ' + gbp0(gap) + ' away' + (monthsToClose ? ' — about ' + monthsToClose + ' months at ' + gbp0(monthly) + ' a month.' : '.') : 'You have reached it.'),
          [stat('Saved', gbp0(saved)), stat('Target', gbp0(goal)), stat('Gap', gbp0(gap))],
          'Keep it separate and boring: <a href="/guides/emergency-fund-uk.html">where to hold an emergency fund</a>.');
      }
      bindSubmit(form, calc);
      calc();
    },

    compound: function (form) {
      var box = $('[data-result]', form);
      var tabs = $$('[data-mode]', form);
      applyQuery(form);
      function calc() {
        var principal = readField(form, 'principal') || 0;
        var monthly = readField(form, 'monthly') || 0;
        var rate = readField(form, 'rate');
        var years = readField(form, 'years');
        var mode = form.querySelector('[data-mode].active');
        mode = mode ? mode.getAttribute('data-mode') : 'compound';
        if (!Number.isFinite(rate) || rate < 0) return errorBox(box, 'Enter an annual interest rate of 0% or more.');
        if (!Number.isFinite(years) || years < 1) return errorBox(box, 'Enter a number of years (at least 1).');
        years = Math.min(60, years);
        var months = Math.round(years * 12);
        var total = principal;
        var points = [principal];
        if (mode === 'compound') {
          var r = rate / 100 / 12;
          for (var i = 0; i < months; i++) {
            total = total * (1 + r) + monthly;
            if ((i + 1) % 12 === 0) points.push(total);
          }
        } else {
          for (var y = 1; y <= years; y++) {
            total = principal * (1 + rate / 100 * y) + monthly * 12 * y;
            points.push(total);
          }
        }
        var contributed = principal + monthly * months;
        var growth = total - contributed;
        var max = Math.max.apply(null, points) || 1;
        var bars = points.map(function (p, idx) {
          return '<i style="height:' + Math.max(6, (p / max) * 100) + '%" title="Year ' + idx + ': ' + gbp0(p) + '" class="' + (idx === points.length - 1 ? 'hi' : '') + '"></i>';
        }).join('');
        box.className = 'result';
        box.innerHTML = '<div class="result-label">Estimated value after ' + years + ' year' + (years === 1 ? '' : 's') + '</div>' +
          '<div class="result-value">' + gbp0(total) + '</div>' +
          '<div class="result-meta">' + (mode === 'compound' ? 'Interest added to the growing balance each month' : 'Simple interest on the starting amount only') +
          ' at ' + rate + '% a year, with ' + gbp0(monthly) + ' added monthly. Contributed ' + gbp0(contributed) + ', growth ' + gbp0(growth) + '.</div>' +
          '<div class="result-grid">' +
          '<div class="result-stat"><b>' + gbp0(contributed) + '</b><span>your money</span></div>' +
          '<div class="result-stat"><b>' + gbp0(growth) + '</b><span>growth</span></div>' +
          '<div class="result-stat"><b>' + Math.round(total > 0 ? (growth / total) * 100 : 0) + '%</b><span>from growth</span></div>' +
          '</div>' +
          '<div class="chart" aria-hidden="true">' + bars + '</div>' +
          '<div class="chart-legend"><span>Start</span><span>Year ' + years + '</span></div>' +
          '<div class="next-step">This is a projection, not a promise — real rates move. Read <a href="/guides/compound-interest-explained.html">compound interest explained</a> or compare an <a href="/guides/isa-vs-savings-account-uk.html">ISA with a savings account</a>.</div>';
        form._mode = mode;
      }
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          calc();
        });
      });
      bindSubmit(form, calc);
      calc();
    },

    trip: function (form) {
      var box = $('[data-result]', form);
      applyQuery(form);
      function calc() {
        var transport = readField(form, 'transport') || 0;
        var accommodation = readField(form, 'accommodation') || 0;
        var food = readField(form, 'food') || 0;
        var days = readField(form, 'days');
        var activities = readField(form, 'activities') || 0;
        var people = readField(form, 'people') || 1;
        var bufferPct = readField(form, 'buffer');
        if (!Number.isFinite(days) || days < 1) return errorBox(box, 'Enter how many days the trip lasts.');
        if (!Number.isFinite(bufferPct) || bufferPct < 0) return errorBox(box, 'Enter a buffer percentage (10–15% is sensible).');
        people = Math.max(1, people);
        var foodTotal = food * days * people;
        var base = transport + accommodation + foodTotal + activities;
        if (base <= 0) return errorBox(box, 'Add at least one cost so there is something to estimate.');
        var buffer = base * bufferPct / 100;
        var total = base + buffer;
        headingText(box, 'Realistic trip budget', gbp0(total),
          'Base costs ' + gbp0(base) + ' plus a ' + bufferPct + '% buffer of ' + gbp0(buffer) + '. That is ' + gbp0(total / days) + ' per day and ' + gbp0(total / people) + ' per person.',
          [stat('Travel + stay', gbp0(transport + accommodation)), stat('Food', gbp0(foodTotal)), stat('Buffer', gbp0(buffer))],
          'Turn the total into a monthly target with the <a href="/savemoney/?target=' + Math.ceil(total) + '&months=9&label=' + encodeURIComponent('Holiday') + '">savings calculator</a>, or read <a href="/guides/cheap-holiday-planning-uk.html">how to cut the cost</a>.');
      }
      bindSubmit(form, calc);
      calc();
    },

    quickmaths: function (form) {
      var box = $('[data-result]', form);
      var tabs = $$('[data-qm-tab]', form);
      var panels = $$('[data-qm-panel]', form);
      function show(name) {
        tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-qm-tab') === name); });
        panels.forEach(function (p) { p.classList.toggle('hide', p.getAttribute('data-qm-panel') !== name); });
        box.innerHTML = '';
        box.className = 'result';
        box.hidden = true;
      }
      tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.getAttribute('data-qm-tab')); }); });
      function reveal() { box.hidden = false; }

      bindSubmit(form, function () {
        var active = form.querySelector('[data-qm-tab].active');
        var mode = active ? active.getAttribute('data-qm-tab') : 'split';
        reveal();
        if (mode === 'split') {
          var total = readField(form, 'bill');
          var people = readField(form, 'people');
          var tip = readField(form, 'tip') || 0;
          if (!Number.isFinite(total) || total <= 0) return errorBox(box, 'Enter the bill total.');
          if (!Number.isFinite(people) || people < 1) return errorBox(box, 'Enter at least one person.');
          var tipAmt = total * tip / 100;
          var withTip = total + tipAmt;
          headingText(box, 'Each person pays', gbp(withTip / people),
            'A ' + tip + '% tip adds ' + gbp(tipAmt) + ', making the bill ' + gbp(withTip) + '.',
            [stat('Bill', gbp(total)), stat('Tip', gbp(tipAmt)), stat('Total', gbp(withTip))], '');
        } else if (mode === 'discount') {
          var price = readField(form, 'price');
          var off = readField(form, 'off');
          var extra = readField(form, 'extra') || 0;
          if (!Number.isFinite(price) || price <= 0) return errorBox(box, 'Enter the original price.');
          if (!Number.isFinite(off) || off < 0 || off > 100) return errorBox(box, 'Enter a discount between 0 and 100%.');
          var afterFirst = price * (1 - off / 100);
          var final = afterFirst * (1 - extra / 100);
          headingText(box, 'You pay', gbp(final),
            'A ' + off + '% reduction' + (extra ? ' plus a further ' + extra + '% off' : '') + ' saves you ' + gbp(price - final) + '.',
            [stat('Was', gbp(price)), stat('Saving', gbp(price - final)), stat('Off', Math.round((1 - final / price) * 100) + '%')],
            'Only a good deal if you were going to buy it anyway. <a href="/guides/no-spend-challenge.html">Try a no-spend week</a>.');
        } else if (mode === 'unit') {
          var pA = readField(form, 'priceA'); var qA = readField(form, 'qtyA');
          var pB = readField(form, 'priceB'); var qB = readField(form, 'qtyB');
          if (!Number.isFinite(pA) || !Number.isFinite(qA) || qA <= 0 || !Number.isFinite(pB) || !Number.isFinite(qB) || qB <= 0) return errorBox(box, 'Enter both prices and both quantities.');
          var uA = pA / qA, uB = pB / qB;
          var cheaper = uA === uB ? 'Both are the same value' : (uA < uB ? 'Option A is cheaper per unit' : 'Option B is cheaper per unit');
          var diff = Math.abs(uA - uB);
          headingText(box, 'Price per unit', gbp(Math.min(uA, uB)),
            cheaper + ' — by ' + gbp(diff) + ' per unit. Pack sizes are marketing; unit price is maths.',
            [stat('A per unit', gbp(uA)), stat('B per unit', gbp(uB)), stat('Difference', gbp(diff))],
            'Make a list before you shop: <a href="/guides/save-money-on-groceries.html">grocery guide</a>.');
        } else {
          var items = readField(form, 'items');
          var each = readField(form, 'each');
          if (!Number.isFinite(items) || items <= 0) return errorBox(box, 'Enter how many items are in the basket.');
          if (!Number.isFinite(each) || each <= 0) return errorBox(box, 'Enter a rough price per item.');
          var est = items * each;
          headingText(box, 'Basket estimate', gbp(est),
            items + ' items at roughly ' + gbp(each) + ' each. Compare with the real total at the till — the gap is where your budget leaks.',
            [stat('Items', items), stat('Rough price', gbp(each)), stat('Estimate', gbp(est))],
            'Estimate before you shop, every week: <a href="/guides/save-money-on-groceries.html">grocery guide</a>.');
        }
      });
      show('split');
    },

    debt: function (form) {
      var box = $('[data-result]', form);
      applyQuery(form);
      function simulate(balance, apr, payment) {
        var rate = apr / 100 / 12, months = 0, interest = 0, bal = balance;
        while (bal > 0.01 && months < 720) { var add = bal * rate; interest += add; bal = bal + add - payment; months++; }
        return { months: months, interest: interest, total: balance + interest, cleared: bal <= 0.01 };
      }
      function calc() {
        var balance = readField(form, 'balance');
        var apr = readField(form, 'apr');
        var payment = readField(form, 'payment');
        var extra = readField(form, 'extra') || 0;
        if (!Number.isFinite(balance) || balance <= 0) return errorBox(box, 'Enter the balance you want to clear.');
        if (!Number.isFinite(apr) || apr < 0) return errorBox(box, 'Enter an APR of 0% or more.');
        if (!Number.isFinite(payment) || payment <= 0) return errorBox(box, 'Enter what you can pay each month.');
        var base = simulate(balance, apr, payment);
        if (!base.cleared) return errorBox(box, 'At ' + gbp(payment) + ' a month the interest is ' + gbp(balance * apr / 100 / 12) + ', so the balance never falls. Increase the payment.');
        var boost = simulate(balance, apr, payment + extra);
        var monthsSaved = Math.max(0, base.months - boost.months);
        var interestSaved = Math.max(0, base.interest - boost.interest);
        headingText(box, extra > 0 ? 'Debt-free sooner' : 'Debt-free in', boost.months + ' month' + (boost.months === 1 ? '' : 's'),
          'Paying ' + gbp(payment + extra) + ' a month clears ' + gbp0(balance) + ' at ' + apr + '% APR, costing ' + gbp0(boost.interest) + ' in interest.' +
          (extra > 0 ? ' The extra ' + gbp0(extra) + ' saves ' + monthsSaved + ' month' + (monthsSaved === 1 ? '' : 's') + ' and ' + gbp0(interestSaved) + '.' : ''),
          [stat('Total paid', gbp0(boost.total)), stat('Interest', gbp0(boost.interest)), stat('Months', boost.months)],
          'Clear the highest rate first (avalanche) or the smallest balance first (snowball) — <a href="/guides/debt-snowball-vs-avalanche.html">compare both</a>.');
      }
      bindSubmit(form, calc);
      calc();
    },

    pace: function (form) {
      var box = $('[data-result]', form);
      var rows = $('[data-pace-rows]', form);
      var addBtn = $('[data-add-row]', form);
      function rowTemplate(name, target, months) {
        var div = document.createElement('div');
        div.className = 'dyn-row';
        div.setAttribute('data-pace-row', '');
        div.innerHTML =
          '<div class="field"><label>Goal name</label><input type="text" name="name" value="' + esc(name) + '" maxlength="30"></div>' +
          '<div class="field"><label>Target (£)</label><input type="number" name="target" min="0" step="10" inputmode="decimal" value="' + target + '"></div>' +
          '<div class="field"><label>Saved (£)</label><input type="number" name="saved" min="0" step="10" inputmode="decimal" value="0"></div>' +
          '<div class="field"><label>Months</label><input type="number" name="months" min="1" step="1" inputmode="numeric" value="' + months + '"></div>' +
          '<div class="field"><label>Rate %</label><input type="number" name="rate" min="0" step="0.1" inputmode="decimal" value="0"></div>' +
          '<button type="button" class="btn secondary sm remove" data-remove-row>Remove</button>';
        return div;
      }
      function addRow() {
        if ($$('[data-pace-row]', rows).length >= 4) { toast('Four goals at a time is plenty — combine any smaller ones.'); return; }
        rows.appendChild(rowTemplate('New goal', 1000, 12));
      }
      if (addBtn) addBtn.addEventListener('click', addRow);
      form.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-remove-row]');
        if (!rm) return;
        var row = rm.closest('[data-pace-row]');
        if ($$('[data-pace-row]', rows).length <= 1) { toast('Keep at least one goal.'); return; }
        row.remove();
      });
      rows.appendChild(rowTemplate('Holiday', 1500, 12));
      rows.appendChild(rowTemplate('Emergency top-up', 1000, 8));
      rows.appendChild(rowTemplate('Car repairs', 900, 6));

      bindSubmit(form, function () {
        var budget = readField(form, 'budget');
        if (!Number.isFinite(budget) || budget <= 0) return errorBox(box, 'Enter how much you can save each month.');
        var goals = [];
        $$('[data-pace-row]', rows).forEach(function (row) {
          var name = row.querySelector('[name="name"]').value.trim() || 'Goal';
          var target = toNum(row.querySelector('[name="target"]').value);
          var saved = toNum(row.querySelector('[name="saved"]').value) || 0;
          var months = toNum(row.querySelector('[name="months"]').value);
          var rate = toNum(row.querySelector('[name="rate"]').value) || 0;
          if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(months) || months < 1) return;
          var remaining = Math.max(0, target - saved);
          var mRate = rate / 100 / 12;
          var monthly = mRate > 0
            ? remaining * mRate / (1 - Math.pow(1 + mRate, -months))
            : remaining / months;
          goals.push({ name: name, target: target, saved: saved, months: months, monthly: Math.max(0, monthly) });
        });
        if (!goals.length) return errorBox(box, 'Add at least one goal with a target and a timeline.');
        var total = goals.reduce(function (sum, g) { return sum + g.monthly; }, 0);
        var over = total - budget;
        var biggest = goals.slice().sort(function (a, b) { return b.monthly - a.monthly; })[0];
        var verdict = over > 0
          ? 'These goals need ' + gbp(over) + ' a month more than your budget. Stretch the longest deadline first — one extra month often closes the gap.'
          : 'They fit inside your budget with ' + gbp(Math.abs(over)) + ' a month to spare.';
        var rowsHtml = goals.map(function (g) {
          return '<div class="result-stat"><b>' + gbp(g.monthly) + '</b><span>' + esc(g.name) + ' · ' + g.months + ' mo</span></div>';
        }).join('');
        box.className = 'result';
        box.innerHTML = '<div class="result-label">Combined monthly cost</div>' +
          '<div class="result-value">' + gbp(total) + '</div>' +
          '<div class="result-meta">Against a budget of ' + gbp(budget) + '. ' + verdict + ' Biggest commitment: ' + esc(biggest.name) + '.</div>' +
          '<div class="result-grid">' + rowsHtml + '</div>' +
          '<div class="next-step">Fund in order: emergency buffer first, then deadlines. <a href="/guides/how-to-save-money.html">Build the habit</a>.</div>';
      });
    },

    subscriptions: function (form) {
      var box = $('[data-result]', form);
      var rows = $('[data-sub-rows]', form);
      var addBtn = $('[data-add-sub]', form);
      function rowTemplate(name, cost, cycle) {
        var div = document.createElement('div');
        div.className = 'dyn-row';
        div.setAttribute('data-sub-row', '');
        div.innerHTML =
          '<div class="field"><label>Subscription</label><input type="text" name="name" value="' + esc(name) + '" maxlength="30"></div>' +
          '<div class="field"><label>Cost (£)</label><input type="number" name="cost" min="0" step="0.01" inputmode="decimal" value="' + cost + '"></div>' +
          '<div class="field"><label>Billing</label><select name="cycle"><option value="month"' + (cycle === 'month' ? ' selected' : '') + '>Per month</option><option value="year"' + (cycle === 'year' ? ' selected' : '') + '>Per year</option></select></div>' +
          '<button type="button" class="btn secondary sm remove" data-remove-sub>Remove</button>';
        return div;
      }
      if (addBtn) addBtn.addEventListener('click', function () { rows.appendChild(rowTemplate('New subscription', 10, 'month')); });
      form.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-remove-sub]');
        if (rm) rm.closest('[data-sub-row]').remove();
      });
      rows.appendChild(rowTemplate('Streaming', 10.99, 'month'));
      rows.appendChild(rowTemplate('Music', 11.99, 'month'));
      rows.appendChild(rowTemplate('Cloud storage', 79.99, 'year'));

      bindSubmit(form, function () {
        var items = [];
        $$('[data-sub-row]', rows).forEach(function (row) {
          var name = row.querySelector('[name="name"]').value.trim() || 'Subscription';
          var cost = toNum(row.querySelector('[name="cost"]').value);
          var cycle = row.querySelector('[name="cycle"]').value;
          if (!Number.isFinite(cost) || cost <= 0) return;
          items.push({ name: name, monthly: cycle === 'year' ? cost / 12 : cost, yearly: cycle === 'year' ? cost : cost * 12 });
        });
        if (!items.length) return errorBox(box, 'Add at least one subscription with a cost.');
        var monthly = items.reduce(function (s, i) { return s + i.monthly; }, 0);
        var yearly = monthly * 12;
        var biggest = items.slice().sort(function (a, b) { return b.monthly - a.monthly; })[0];
        var tenYears = yearly * 10;
        box.className = 'result';
        box.innerHTML = '<div class="result-label">Every subscription, per month</div>' +
          '<div class="result-value">' + gbp(monthly) + '</div>' +
          '<div class="result-meta">That is ' + gbp(yearly) + ' a year, or ' + gbp0(tenYears) + ' over ten years. Biggest: ' + esc(biggest.name) + ' at ' + gbp(biggest.monthly) + ' a month.</div>' +
          '<div class="result-grid">' +
          '<div class="result-stat"><b>' + items.length + '</b><span>subscriptions</span></div>' +
          '<div class="result-stat"><b>' + gbp(yearly) + '</b><span>per year</span></div>' +
          '<div class="result-stat"><b>' + gbp0(tenYears) + '</b><span>over 10 years</span></div>' +
          '</div>' +
          '<div class="next-step">Cancel one you would not buy again today, then send the saving to your goal. <a href="/guides/subscription-audit-guide.html">Run the full audit</a>.</div>';
      });
    },

    autopilot: function (form) {
      var box = $('[data-result]', form);
      applyQuery(form);

      function payoff(balance, apr, payment) {
        var rate = apr / 100 / 12, months = 0, interest = 0, bal = balance;
        while (bal > 0.01 && months < 720) { var add = bal * rate; interest += add; bal = bal + add - payment; months++; }
        return { months: months, interest: interest, cleared: bal <= 0.01 };
      }

      function calc() {
        var income = readField(form, 'income');
        var essentials = readField(form, 'essentials');
        var debt = readField(form, 'debt') || 0;
        var apr = readField(form, 'apr') || 0;
        var debtpay = readField(form, 'debtpay') || 0;
        var saved = readField(form, 'saved') || 0;
        var target = readField(form, 'target');
        var months = readField(form, 'months');

        if (!Number.isFinite(income) || income <= 0) return errorBox(box, 'Enter your monthly take-home pay above £0.');
        if (!Number.isFinite(essentials) || essentials <= 0) return errorBox(box, 'Enter your essential monthly costs — rent or mortgage, bills, food, travel.');
        if (!Number.isFinite(target) || target <= 0) return errorBox(box, 'Enter what you are saving towards, even roughly.');
        if (!Number.isFinite(months) || months < 1) return errorBox(box, 'Enter how many months you have until you need the money.');
        months = Math.round(months);

        var surplus = income - essentials;
        var bufferMonths = essentials > 0 ? saved / essentials : 0;
        if (surplus <= 0) {
          box.className = 'result error';
          box.innerHTML = '<div class="result-label">The honest answer</div>' +
            '<div class="result-value" style="font-size:1.35rem;letter-spacing:0">There is no surplus yet</div>' +
            '<div class="result-meta">Your essentials (' + gbp0(essentials) + ') meet or exceed your take-home pay (' + gbp0(income) + '). No allocation can fix that — the gap has to close first. Two levers: reduce a fixed cost (rent share, energy, a contract) or raise income. Both beat squeezing the food shop another £10.</div>' +
            '<div class="next-step">Start with the <a href="/guides/budgeting-guide-uk.html">budgeting guide</a>, then look at <a href="/guides/earn-more-uk-side-income.html">ways to raise income</a>. If essentials are 70%+ of pay, this is structural, not a discipline problem.</div>';
          return;
        }

        var highApr = apr >= 10;
        var w = { buffer: 0.20, debt: 0, goal: 0.30, invest: 0.10, life: 0.10 };
        if (bufferMonths < 1) w.buffer += 0.30;
        else if (bufferMonths < 3) w.buffer += 0.15;
        if (highApr && debt > 0) { w.debt = 0.30; w.goal = 0.15; w.invest = 0; }
        else if (debt > 0) { w.debt = 0.10; }
        if (months > 60) { w.invest += 0.10; w.goal = 0.15; }
        var totalW = w.buffer + w.debt + w.goal + w.invest + w.life;
        Object.keys(w).forEach(function (k) { w[k] = w[k] / totalW; });

        var amt = {};
        Object.keys(w).forEach(function (k) { amt[k] = surplus * w[k]; });

        var bufferGap = Math.max(0, essentials - saved);
        var bufferTarget = essentials * 3;
        var bufferFullGap = Math.max(0, bufferTarget - saved);
        var bufferMonthsAtPace = amt.buffer > 0 && bufferGap > 0 ? Math.ceil(bufferGap / amt.buffer) : 0;
        var goalGap = Math.max(0, target - saved);
        var goalMonthsAtPace = amt.goal > 0 ? Math.ceil(goalGap / amt.goal) : 0;

        var debtPlan = null;
        if (debt > 0) {
          var payTotal = debtpay + amt.debt;
          debtPlan = payTotal > 0 ? payoff(debt, apr, payTotal) : null;
        }

        var score = 0;
        score += Math.min(30, (bufferMonths / 3) * 30);
        score += debt <= 0 ? 25 : Math.max(0, 25 - (debt / (income * 12)) * 100);
        score += Math.min(25, (surplus / income) * 100 * 0.85);
        score += saved > 0 ? 10 : 0;
        score += months > 0 ? 10 : 0;
        score = Math.max(0, Math.min(100, Math.round(score)));

        var fv10 = 0;
        if (amt.invest > 0) {
          var r = 0.05 / 12;
          for (var i = 0; i < 120; i++) fv10 = fv10 * (1 + r) + amt.invest;
        }

        var steps = [];
        steps.push({
          ico: '🛟', urgent: bufferMonths < 1,
          title: bufferMonths < 1 ? 'Build the one-month buffer first' : 'Top up the safety net',
          body: bufferGap > 0
            ? 'Send ' + gbp(amt.buffer) + ' to a separate easy-access account. ' + gbp0(bufferGap) + ' gets you to one month of essentials' + (bufferMonthsAtPace ? ', about ' + bufferMonthsAtPace + ' month' + (bufferMonthsAtPace === 1 ? '' : 's') + ' away' : '') + '. Keep going to three months (' + gbp0(bufferTarget) + ').'
            : 'One month is covered. ' + gbp0(bufferFullGap) + ' more reaches a three-month cushion; until then this money stays liquid and boring.',
          amt: gbp(amt.buffer)
        });
        if (debt > 0) {
          steps.push({
            ico: highApr ? '🔥' : '💳', urgent: highApr,
            title: highApr ? 'Overpay the expensive debt' : 'Keep clearing the debt',
            body: (debtPlan && debtPlan.cleared
              ? 'Adding ' + gbp(amt.debt) + ' to your ' + gbp0(debtpay) + ' payment clears ' + gbp0(debt) + ' in about ' + debtPlan.months + ' months, costing ' + gbp0(debtPlan.interest) + ' in interest.'
              : debtPlan
              ? 'At ' + gbp(debtpay + amt.debt) + ' a month the interest still exceeds the payment, so the balance never falls. The minimum has to rise before an overpayment can help.'
              : 'Put ' + gbp(amt.debt) + ' towards the balance as an extra payment each month.') +
              (highApr ? ' At ' + apr + '% APR this is a guaranteed ' + apr + '% return — better than almost any savings rate.' : ' Low-rate debt can run alongside saving.'),
            amt: gbp(amt.debt)
          });
        }
        steps.push({
          ico: '🎯', urgent: false,
          title: 'Fund the goal: ' + esc(new URLSearchParams(location.search).get('label') || 'your target'),
          body: 'At ' + gbp(amt.goal) + ' a month you reach ' + gbp0(target) + ' in about ' + goalMonthsAtPace + ' months' + (goalMonthsAtPace > months ? ' — that is later than your ' + months + '-month deadline. Stretch the date or raise this amount before you cut the buffer.' : ' — inside your ' + months + '-month deadline.') ,
          amt: gbp(amt.goal)
        });
        if (amt.invest > 0) {
          steps.push({
            ico: '📈', urgent: false,
            title: 'Invest for the long term',
            body: gbp(amt.invest) + ' a month into a diversified fund inside a Stocks &amp; Shares ISA, only after the buffer and expensive debt are handled. At an illustrative 5% net, that is about ' + gbp0(fv10) + ' after ten years — assumption, not a promise.',
            amt: gbp(amt.invest)
          });
        }
        steps.push({
          ico: '🍃', urgent: false,
          title: 'Spend this without guilt',
          body: gbp(amt.life) + ' a month is yours. A plan with no breathing room gets abandoned in week three; this line is what makes the other lines survivable.',
          amt: gbp(amt.life)
        });

        var proj = saved, points = [saved];
        var monthlyIntoCash = amt.buffer + amt.goal;
        for (var m = 1; m <= 12; m++) {
          proj += monthlyIntoCash;
          if (m % 3 === 0) points.push(proj);
        }
        var maxPoint = Math.max.apply(null, points) || 1;
        var bars = points.map(function (p, idx) {
          return '<i class="' + (idx === points.length - 1 ? 'hi' : '') + '" style="height:' + Math.max(8, (p / maxPoint) * 100) + '%" title="' + gbp0(p) + '"></i>';
        }).join('');

        var done = store.get('ap_done', {});
        var tasks = [
          { id: 'so', text: 'Set a standing order for <b>' + gbp(amt.buffer) + '</b> the day after payday' },
          { id: 'pot', text: 'Open or rename a separate pot: “<b>Buffer</b>” — not “Savings”' },
          { id: 'debt', text: debt > 0 ? 'Set the debt payment to <b>' + gbp(debtpay + amt.debt) + '</b> a month' : 'Check one fixed bill for a cheaper equivalent' },
          { id: 'cancel', text: 'Cancel one subscription you would not buy again today' },
          { id: 'review', text: 'Put a 10-minute money review in the calendar for the 1st' }
        ];
        var tasksHtml = tasks.map(function (t) {
          return '<label class="check"><input type="checkbox" data-ap-task="' + t.id + '"' + (done[t.id] ? ' checked' : '') + '><span>' + t.text + '</span></label>';
        }).join('');
        var doneCount = tasks.filter(function (t) { return done[t.id]; }).length;

        box.className = 'result';
        box.innerHTML =
          '<div class="result-label">Your monthly surplus, allocated</div>' +
          '<div class="result-value">' + gbp(surplus) + '<span style="font-size:13px;font-weight:700;color:var(--muted)"> / month</span></div>' +
          '<div class="result-meta">Money fitness score <strong>' + score + '/100</strong>. The order below follows three rules: protect the basics, kill any debt costing more than saving pays, then fund the goal. Change any number and the whole plan recalculates.</div>' +
          '<div class="stat-strip">' +
          '<div><b>' + bufferMonths.toFixed(1) + ' mo</b><span>buffer now</span></div>' +
          '<div><b>' + goalMonthsAtPace + ' mo</b><span>to your goal</span></div>' +
          '<div><b>' + gbp0(debt) + '</b><span>debt outstanding</span></div>' +
          '<div><b>' + gbp0(saved + monthlyIntoCash * 12) + '</b><span>cash in 12 months</span></div>' +
          '</div>' +
          '<div class="ap-steps">' + steps.map(function (s) {
            return '<div class="ap-step' + (s.urgent ? ' urgent' : '') + '"><span class="ap-ico" aria-hidden="true">' + s.ico + '</span><div style="min-width:0"><b>' + s.title + '</b><p>' + s.body + '</p></div><span class="ap-amt">' + s.amt + '</span></div>';
          }).join('') + '</div>' +
          '<div class="chart" aria-hidden="true">' + bars + '</div>' +
          '<div class="chart-legend"><span>Today: ' + gbp0(saved) + '</span><span>12 months: ' + gbp0(saved + monthlyIntoCash * 12) + '</span></div>' +
          '<div class="mini-note">Cash saved only — excludes debt repayments and any investment growth.</div>' +
          '<div class="progress-inline" data-ap-progress>' +
          '<div class="pi-top"><span>This week’s moves</span><span><b data-ap-count>' + doneCount + '</b> of ' + tasks.length + ' done</span></div>' +
          '<div class="bar"><i style="width:' + Math.round(doneCount / tasks.length * 100) + '%"></i></div>' +
          '</div>' +
          '<div class="checklist">' + tasksHtml + '</div>' +
          '<div class="next-step">Save this plan into the rest of the site: <a href="/savemoney/?target=' + Math.round(target) + '&months=' + months + '&label=' + encodeURIComponent('My goal') + '">open it in the savings calculator</a>, or <a href="/budget/?income=' + Math.round(income) + '">check the budget split</a>.</div>';

        $$('[data-ap-task]', box).forEach(function (cb) {
          cb.addEventListener('change', function () {
            var d = store.get('ap_done', {});
            d[cb.getAttribute('data-ap-task')] = cb.checked;
            store.set('ap_done', d);
            var n = $$('[data-ap-task]', box).filter(function (x) { return x.checked; }).length;
            var count = $('[data-ap-count]', box);
            var bar = $('[data-ap-progress] .bar i', box);
            if (count) count.textContent = n;
            if (bar) bar.style.width = Math.round(n / tasks.length * 100) + '%';
            if (n === tasks.length) toast('Every move done. That is how the plan becomes real.');
          });
        });
      }
      bindSubmit(form, calc);
      calc();
    },

    invest: function (form) {
      var box = $('[data-result]', form);
      applyQuery(form);

      function fv(monthly, existing, years, ratePct) {
        var r = ratePct / 100 / 12, months = Math.round(years * 12), total = existing;
        for (var i = 0; i < months; i++) total = total * (1 + r) + monthly;
        return total;
      }

      function calc() {
        var monthly = readField(form, 'monthly');
        var existing = readField(form, 'existing') || 0;
        var years = readField(form, 'years');
        var fee = readField(form, 'fee');
        var answers = ['q1', 'q2', 'q3', 'q4', 'q5'].map(function (n) {
          var el = form.querySelector('[name="' + n + '"]');
          return el ? Number(el.value) : 0;
        });
        if (!Number.isFinite(monthly) || monthly < 0) return errorBox(box, 'Enter a monthly amount of £0 or more.');
        if (!Number.isFinite(years) || years < 1) return errorBox(box, 'Enter a time horizon of at least one year.');
        if (!Number.isFinite(fee) || fee < 0 || fee > 3) return errorBox(box, 'Enter total annual costs between 0% and 3% — platform plus fund charges.');
        years = Math.min(45, Math.round(years));

        var riskScore = answers.reduce(function (s, v) { return s + (Number.isFinite(v) ? v : 0); }, 0);
        var profile, alloc, mid;
        if (riskScore <= 5) { profile = 'Cautious'; mid = 3.5; alloc = { eq: 30, bd: 45, cash: 25 }; }
        else if (riskScore <= 10) { profile = 'Balanced'; mid = 5.0; alloc = { eq: 60, bd: 30, cash: 10 }; }
        else { profile = 'Growth'; mid = 6.5; alloc = { eq: 85, bd: 12, cash: 3 }; }

        var netMid = Math.max(0, mid - fee);
        var low = Math.max(0, mid - 2.5 - fee), high = mid + 2.5 - fee;
        var midVal = fv(monthly, existing, years, netMid);
        var lowVal = fv(monthly, existing, years, low);
        var highVal = fv(monthly, existing, years, high);
        var contributed = existing + monthly * 12 * years;

        var cheap = fv(monthly, existing, years, Math.max(0, mid - 0.2));
        var dear = fv(monthly, existing, years, Math.max(0, mid - 1.2));
        var feeCost = dear - cheap;

        var horizonAdvice = years < 5
          ? 'Under five years, this money probably belongs in cash. A market fall near the deadline is not a risk you can wait out.'
          : years < 10
          ? 'Five to ten years is a workable investing horizon, but keep the emergency fund and any spending within two years out of it.'
          : 'A horizon this long is where investing makes the most sense — time is doing more work than the contribution.';

        var eq = gbp0(monthly * alloc.eq / 100), bd = gbp0(monthly * alloc.bd / 100), cash = gbp0(monthly * alloc.cash / 100);

        box.className = 'result';
        box.innerHTML =
          '<div class="result-label">Your investor profile</div>' +
          '<div class="result-value">' + profile + '</div>' +
          '<div class="result-meta">Risk score ' + riskScore + '/15. Illustrative expected return for this mix: about ' + mid + '% a year before costs, ' + netMid.toFixed(1) + '% after ' + fee + '% of charges. ' + horizonAdvice + '</div>' +
          '<div class="alloc">' +
          '<div class="alloc-bar" aria-label="Suggested asset mix"><i class="eq" style="width:' + alloc.eq + '%"></i><i class="bd" style="width:' + alloc.bd + '%"></i><i class="cash" style="width:' + alloc.cash + '%"></i></div>' +
          '<div class="alloc-legend">' +
          '<div class="alloc-key"><i style="background:#4be08e"></i>Global shares<b>' + alloc.eq + '% · ' + eq + '/mo</b></div>' +
          '<div class="alloc-key"><i style="background:#7fb7ff"></i>Bonds / gilts<b>' + alloc.bd + '% · ' + bd + '/mo</b></div>' +
          '<div class="alloc-key"><i style="background:#ffca7a"></i>Cash buffer<b>' + alloc.cash + '% · ' + cash + '/mo</b></div>' +
          '</div></div>' +
          '<div class="result-grid">' +
          '<div class="result-stat"><b>' + gbp0(lowVal) + '</b><span>pessimistic</span></div>' +
          '<div class="result-stat"><b>' + gbp0(midVal) + '</b><span>middle estimate</span></div>' +
          '<div class="result-stat"><b>' + gbp0(highVal) + '</b><span>optimistic</span></div>' +
          '</div>' +
          '<div class="result-meta" style="margin-top:10px">You put in ' + gbp0(contributed) + '. The spread between the three columns is volatility, not a menu — any single year can land outside it.</div>' +
          '<div class="next-step"><strong>Cost check:</strong> over ' + years + ' years at ' + mid + '%, paying 0.2% instead of 1.2% leaves about <strong>' + gbp0(feeCost) + '</strong> more in your pocket. At your ' + fee + '% it is a ' + (fee <= 0.45 ? 'lean' : fee <= 1 ? 'mid-range' : 'expensive') + ' plan. Read <a href="/guides/investment-fees-and-tax-uk.html">what the fees actually cost</a>.</div>' +
          '<div class="next-step">Next step: confirm the <a href="/guides/emergency-fund-uk.html">emergency fund</a> and any 10%+ debt are handled, then compare <a href="/guides/isa-vs-savings-account-uk.html">ISA wrappers</a> before opening an account.</div>';
      }
      bindSubmit(form, calc);
      calc();
    },

    challenge: function (form) {
      var box = $('[data-result]', form);

      function build(target, weeks, style) {
        var weights = [], i;
        for (i = 1; i <= weeks; i++) {
          if (style === 'ladder') weights.push(i);
          else if (style === 'no-spend') weights.push(i % 2 === 1 ? 1.4 : 0.6);
          else if (style === 'roundup') weights.push([1, 1.6, 1.2, 2][(i - 1) % 4]);
          else weights.push(1);
        }
        var weightSum = weights.reduce(function (s, x) { return s + x; }, 0);
        var amounts = weights.map(function (x) { return Math.round((target * x / weightSum) * 100) / 100; });
        var sum = amounts.reduce(function (s, x) { return s + x; }, 0);
        amounts[weeks - 1] = Math.round((amounts[weeks - 1] + target - sum) * 100) / 100;
        return amounts;
      }

      function calc() {
        var target = readField(form, 'target');
        var weeks = readField(form, 'weeks');
        var styleEl = form.querySelector('[name="style"]');
        var style = styleEl ? styleEl.value : 'steady';
        if (!Number.isFinite(target) || target <= 0) return errorBox(box, 'Enter a challenge total above £0.');
        if (!Number.isFinite(weeks) || weeks < 4 || weeks > 52) return errorBox(box, 'Choose between 4 and 52 weeks.');
        weeks = Math.round(weeks);

        var amounts = build(target, weeks, style);
        var key = 'c' + Math.round(target) + '-' + weeks + '-' + style;
        var savedState = store.get('challenge_' + key, []);
        var doneMap = {};
        savedState.forEach(function (n) { doneMap[n] = true; });
        var savedSoFar = amounts.reduce(function (s, a, idx) { return s + (doneMap[idx] ? a : 0); }, 0);
        var doneCount = amounts.filter(function (a, idx) { return doneMap[idx]; }).length;

        var label = { steady: 'Steady weekly amount', ladder: 'Ladder (grows each week)', 'no-spend': 'Alternating spend / no-spend weeks', roundup: 'Four-week round-up cycle' }[style];
        var start = new Date();
        var daysTo = Math.ceil((new Date(start.getTime() + weeks * 7 * 86400000) - start) / 86400000);

        var cells = amounts.map(function (a, idx) {
          var amount = gbp(a).replace('.00', '');
          return '<button type="button" class="week' + (doneMap[idx] ? ' done' : '') + '" data-week="' + idx + '" aria-pressed="' + (doneMap[idx] ? 'true' : 'false') + '" aria-label="Week ' + (idx + 1) + ', ' + amount + (doneMap[idx] ? ', saved' : ', not saved yet') + '"><b>' + amount + '</b>wk ' + (idx + 1) + '</button>';
        }).join('');

        box.className = 'result';
        box.innerHTML =
          '<div class="result-label">Your challenge</div>' +
          '<div class="result-value">' + gbp0(target) + ' in ' + weeks + ' weeks</div>' +
          '<div class="result-meta">' + label + '. That is ' + gbp0(target / weeks) + ' a week on average and ' + gbp0(target / (weeks / 4.345)) + ' a month set aside. Finishing on schedule takes ' + weeks + ' weeks from today.</div>' +
          '<div class="result-grid">' +
          '<div class="result-stat"><b>' + gbp(amounts[0]) + '</b><span>week one</span></div>' +
          '<div class="result-stat"><b>' + gbp(amounts[weeks - 1]) + '</b><span>final week</span></div>' +
          '<div class="result-stat"><b>' + gbp(savedSoFar) + '</b><span>ticked off</span></div>' +
          '</div>' +
          '<div class="week-grid" role="group" aria-label="Weekly amounts — tick each week once the money has moved">' + cells + '</div>' +
          '<div class="progress-inline"><div class="pi-top"><span>Saved so far</span><span><b data-ch-saved>' + gbp(savedSoFar) + '</b> · ' + doneCount + '/' + weeks + ' weeks</span></div><div class="bar"><i data-ch-bar style="width:' + Math.round(savedSoFar / target * 100) + '%"></i></div></div>' +
          '<div class="week-actions"><button class="btn secondary sm" type="button" data-ch-next>✓ Tick the next week</button><button class="btn ghost sm" type="button" data-ch-reset>Reset tracker</button></div>' +
          '<div class="next-step">Tap the week cells as you go — progress is stored on this device. Keep the money in a separate pot so the streak means something. <a href="/guides/no-spend-challenge.html">Read the no-spend rules</a> or <a href="/autopilot/">build the monthly plan</a>.</div>';

        function persist() {
          var done = [];
          $$('.week', box).forEach(function (el) {
            var idx = Number(el.getAttribute('data-week'));
            var isDone = el.classList.contains('done');
            el.setAttribute('aria-pressed', isDone ? 'true' : 'false');
            el.setAttribute('aria-label', 'Week ' + (idx + 1) + ', ' + gbp(amounts[idx]).replace('.00', '') + (isDone ? ', saved' : ', not saved yet'));
            if (isDone) done.push(idx);
          });
          done.sort(function (a, b) { return a - b; });
          store.set('challenge_' + key, done);
          var totalSaved = amounts.reduce(function (s, a, idx) { return s + (done.indexOf(idx) !== -1 ? a : 0); }, 0);
          var savedEl = $('[data-ch-saved]', box);
          var bar = $('[data-ch-bar]', box);
          if (savedEl) savedEl.textContent = gbp(totalSaved);
          if (bar) bar.style.width = Math.round(totalSaved / target * 100) + '%';
          if (done.length === weeks) toast('Challenge complete — ' + gbp0(target) + ' saved. Pick a harder one.');
        }

        $$('.week', box).forEach(function (cell) {
          cell.addEventListener('click', function () {
            cell.classList.toggle('done');
            persist();
          });
        });
        var next = $('[data-ch-next]', box);
        if (next) next.addEventListener('click', function () {
          var first = $$('.week', box).filter(function (el) { return !el.classList.contains('done'); })[0];
          if (first) { first.classList.add('done'); persist(); first.focus(); }
        });
        var reset = $('[data-ch-reset]', box);
        if (reset) reset.addEventListener('click', function () {
          $$('.week', box).forEach(function (el) { el.classList.remove('done'); });
          persist();
        });
      }
      bindSubmit(form, calc);
      calc();
    }
  };

  function setupTools() {
    $$('[data-tool]').forEach(function (form) {
      var name = form.getAttribute('data-tool');
      if (tools[name]) tools[name](form);
    });
  }

  /* ---------- money health check ---------- */
  function setupQuiz() {
    var form = $('[data-quiz]');
    if (!form) return;
    var result = $('[data-quiz-result]');
    $$('.quiz-opt input', form).forEach(function (input) {
      input.addEventListener('change', function () {
        $$('.quiz-opt', input.closest('.quiz-q')).forEach(function (label) {
          var radio = label.querySelector('input');
          label.classList.toggle('checked', radio.checked);
        });
        labelProgress();
      });
    });
    function labelProgress() {
      var total = $$('fieldset', form).length;
      var answered = $$('fieldset', form).filter(function (f) { return f.querySelector('input:checked'); }).length;
      var bar = $('[data-quiz-progress]');
      if (bar) bar.textContent = answered + ' of ' + total + ' answered';
    }
    labelProgress();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fieldsets = $$('fieldset', form);
      var missing = fieldsets.filter(function (f) { return !f.querySelector('input:checked'); });
      if (missing.length) {
        toast('Answer all six questions — it takes about a minute.');
        missing[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      var score = fieldsets.reduce(function (sum, f) {
        return sum + Number(f.querySelector('input:checked').value);
      }, 0);
      var max = fieldsets.length * 3;
      var pct = Math.round(score / max * 100);
      var band, advice;
      if (pct >= 80) { band = 'Strong'; advice = 'Your basics are in place. The next lever is making the money work harder — check the ISA comparison and the compound calculator.'; }
      else if (pct >= 55) { band = 'Solid, with gaps'; advice = 'You have the habits; what is missing is usually automation. Put one standing order in place this week.'; }
      else if (pct >= 30) { band = 'Fragile'; advice = 'Start with the smallest possible buffer, then make it automatic. One month of essentials changes everything.'; }
      else { band = 'Needs attention'; advice = 'Do not try to fix everything at once. Pick the emergency fund, save £20 this week, and build from there.'; }
      result.hidden = false;
      result.innerHTML = '<div class="score-ring" style="--score:' + pct + '"><b>' + pct + '</b><span>out of 100</span></div>' +
        '<h2 class="center">' + band + '</h2>' +
        '<p class="center muted small mt-8">' + advice + '</p>' +
        '<div class="link-grid mt-16">' +
        '<a href="/emergency-fund/">Check your emergency fund</a>' +
        '<a href="/savemoney/">Build a savings plan</a>' +
        '<a href="/guides/payday-routine.html">Set up a payday routine</a>' +
        '</div>';
      result.scrollIntoView({ behavior: 'smooth', block: 'center' });
      store.set('health', { score: pct, band: band, date: dateKey() });
    });
  }

  /* ---------- glossary ---------- */
  function setupGlossary() {
    var root = $('[data-glossary]');
    if (!root) return;
    var search = $('#termSearch');
    var count = $('#termCount');
    var noResults = $('#noResults');
    var az = $('#azNav');
    var groups = $$('.term-group', root);
    var total = $$('.terms dt', root).length;

    if (az) {
      groups.forEach(function (group) {
        var letter = $('.term-letter', group);
        if (!letter) return;
        var a = document.createElement('a');
        a.href = '#' + group.id;
        a.textContent = letter.textContent.trim();
        az.appendChild(a);
      });
    }
    function filter(query) {
      var q = query.trim().toLowerCase();
      var shown = 0;
      groups.forEach(function (group) {
        var any = false;
        $$('.terms dt', group).forEach(function (dt) {
          var dd = dt.nextElementSibling;
          var text = (dt.textContent + ' ' + (dd ? dd.textContent : '')).toLowerCase();
          var match = !q || text.indexOf(q) !== -1;
          dt.classList.toggle('hide', !match);
          if (dd) dd.classList.toggle('hide', !match);
          if (match) any = true;
        });
        group.classList.toggle('hide', !any);
        if (any) shown += $$('.terms dt', group).filter(function (dt) { return !dt.classList.contains('hide'); }).length;
      });
      if (count) count.textContent = q ? shown + ' of ' + total + ' terms' : total + ' terms';
      if (noResults) noResults.classList.toggle('open', shown === 0);
    }
    if (search) search.addEventListener('input', function () { filter(search.value); });
    var q = new URLSearchParams(location.search).get('q');
    if (q && search) { search.value = q; filter(q); }
    else filter('');
  }

  /* ---------- persistent article checklists ---------- */
  function setupChecklists() {
    $$('[data-checklist]').forEach(function (root) {
      var key = 'checks_' + (root.getAttribute('data-checklist') || location.pathname);
      var boxes = $$('input[data-check]', root);
      if (!boxes.length) return;
      var done = store.get(key, []);
      var bar = $('[data-check-bar]', root);
      var count = $('[data-check-count]', root);
      function refresh() {
        var n = boxes.filter(function (b) { return b.checked; }).length;
        if (bar) bar.style.width = Math.round(n / boxes.length * 100) + '%';
        if (count) count.textContent = n + ' of ' + boxes.length + ' done';
        var list = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.getAttribute('data-check'); });
        store.set(key, list);
        if (n === boxes.length) toast('All done. That is a real change, not a read.');
      }
      boxes.forEach(function (box) {
        box.checked = done.indexOf(box.getAttribute('data-check')) !== -1;
        box.addEventListener('change', refresh);
      });
      refresh();
    });
  }

  /* ---------- contact ---------- */
  function setupContact() {
    var form = $('[data-contact]');
    if (!form) return;
    var success = $('[data-contact-success]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('[name="name"]');
      var email = form.querySelector('[name="email"]');
      var message = form.querySelector('[name="message"]');
      var valid = true;
      [[name, name.value.trim().length > 1], [email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)], [message, message.value.trim().length > 9]]
        .forEach(function (pair) {
          var field = pair[0].closest('.field');
          var ok = pair[1];
          field.classList.toggle('invalid', !ok);
          if (!ok) valid = false;
        });
      if (!valid) { toast('Check the highlighted fields.'); return; }
      var subject = encodeURIComponent('SaveGrow Lab enquiry from ' + name.value.trim());
      var body = encodeURIComponent(message.value.trim() + '\n\nFrom: ' + name.value.trim() + ' <' + email.value.trim() + '>');
      window.location.href = 'mailto:services@digitalinfohub.net?subject=' + subject + '&body=' + body;
      if (success) { success.classList.add('open'); success.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      toast('Opening your email app…');
    });
  }

  /* ---------- contextual nudges (Penny's tip pop-ups) ---------- */
  var NUDGES = [
    { tags: ['home', 'general'], title: 'Your saving rate beats your return', body: 'Early on, £50 more saved each month moves the finish line further than chasing an extra 1% of growth. Raise the transfer before you shop around for a better rate.', href: '/savemoney/', cta: 'Set the amount' },
    { tags: ['home', 'general'], title: 'The 1% rule for pay rises', body: 'When your pay goes up, add one percentage point to your saving rate in the same week. On £2,400 take-home that is £24 a month — £288 a year you never notice leaving.', href: '/guides/payday-routine.html', cta: 'The payday routine' },
    { tags: ['home', 'general'], title: '£5 a day is £1,825 a year', body: 'Small daily habits are annual numbers in disguise. Check what your “just a coffee” pattern actually costs before you decide it is too small to matter.', href: '/budget/', cta: 'Run your budget' },
    { tags: ['home', 'general'], title: 'Name the pot', body: 'Money in an account called “Savings 2” gets raided. Money in one called “Car MOT — March” does not. Naming is free and it works.', href: '/guides/sinking-funds-explained.html', cta: 'How sinking funds work' },
    { tags: ['home', 'general'], title: 'Annual costs break more budgets than weekly ones', body: 'Insurance, MOT, birthdays and Christmas are predictable. Divide each by 12 and move that amount monthly so the bill never lands on a normal week.', href: '/guides/budgeting-guide-uk.html', cta: 'Build the budget' },
    { tags: ['tools', 'autopilot'], title: 'The buffer is not the goal', body: 'One month of essential costs in cash is what stops a car repair becoming a credit card balance. It is the least exciting line in the plan and the one that protects all the others.', href: '/emergency-fund/', cta: 'Size your buffer' },
    { tags: ['tools', 'autopilot'], title: 'Essentials first, honestly', body: 'If essentials take 70% of take-home, no spreadsheet fixes it. That is a housing, transport or income problem — use the income guide instead of shaving £5 off groceries.', href: '/guides/earn-more-uk-side-income.html', cta: 'Raise the income' },
    { tags: ['tools'], title: 'Round the answer up, not down', body: 'If a calculation says £163.40 a month, set £170. The overshoot finishes the goal early and gives you slack for the month that goes wrong.', href: '/savings-pace/', cta: 'Check your pace' },
    { tags: ['tools', 'challenges'], title: 'Transfer first, tick second', body: 'A tick without a transfer is a diary entry. Move the money the same day, then press the week — the streak should cost you something.', href: '/challenges/', cta: 'Open the challenge' },
    { tags: ['challenges'], title: 'Choose the ladder if you have quit before', body: 'Week one at £10.99 is not about the money; it is about not failing on day three. Momentum is cheaper to buy early than to rebuild late.', href: '/post/save-1000-in-90-days.html', cta: 'Read the 13-week plan' },
    { tags: ['challenges'], title: 'Decide the miss rule now', body: 'Do not double up after a missed week. Add it to the final week or extend by seven days. Doubling up turns one bad week into a debt to yourself.', href: '/guides/no-spend-challenge.html', cta: 'No-spend rules' },
    { tags: ['invest'], title: 'Fees are the only certain number', body: 'Returns are a guess; charges are a fact. On £10,000 plus £200 a month over 20 years, paying 0.2% instead of 1.2% leaves roughly £15,600 more in the pot.', href: '/guides/investment-fees-and-tax-uk.html', cta: 'See the fee maths' },
    { tags: ['invest'], title: 'Money you need soon should not wobble', body: 'Under five years, cash is usually the right home. Volatility is only a problem when the deadline is close enough that you cannot wait for a recovery.', href: '/guides/isa-vs-savings-account-uk.html', cta: 'Pick the wrapper' },
    { tags: ['guides'], title: 'Read one guide, move one number', body: 'Knowledge does not compound; transfers do. Pick the single change you can make on payday and ignore the other nine things this page just taught you.', href: '/guides/payday-routine.html', cta: 'The 10-minute routine' },
    { tags: ['guides'], title: 'Unit price is the only price that matters', body: 'Bigger packs are not automatically cheaper. Compare price per 100g or per wash, and be suspicious of the “was” price on the shelf edge.', href: '/guides/save-money-on-groceries.html', cta: 'Cut the grocery bill' },
    { tags: ['guides', 'post'], title: 'The £50 three-day rule', body: 'Anything non-essential over £50 waits 72 hours. Most of it stops looking necessary. The rule costs nothing and does not require willpower in the moment.', href: '/guides/subscription-audit-guide.html', cta: 'Audit the subscriptions' },
    { tags: ['post'], title: 'A budget is a prediction, not a punishment', body: 'When a month goes over, the useful question is which line was wrong — not which line to feel bad about. Fix the forecast, keep the habit.', href: '/budget/', cta: 'Adjust the budget' },
    { tags: ['general'], title: 'Check the annual cost, not the monthly one', body: '£9.99 a month is £119.88 a year, and that is before the price rise in month seven. Annual numbers are the ones that change decisions.', href: '/subscriptions/', cta: 'Subscription audit' },
    { tags: ['general'], title: 'Save the raise before you feel it', body: 'Lifestyle expands to fill the pay rise within about two months. Move the extra on the first payday and it never becomes normal spending.', href: '/autopilot/', cta: 'Rebuild the plan' },
    { tags: ['general'], title: 'One month ahead is the real target', body: 'Being a month ahead turns every bill from an emergency into a diary entry. It is the cheapest form of financial calm available.', href: '/emergency-fund/', cta: 'Check the buffer' }
  ];

  function nudgeSection() {
    var path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/$/, '');
    if (!path) return 'home';
    if (path.indexOf('/post/') === 0) return 'post';
    if (path.indexOf('/guides/') === 0) return 'guides';
    if (path === '/challenges') return 'challenges';
    if (path === '/autopilot' || path === '/invest') return path.slice(1);
    if (['/budget', '/savemoney', '/emergency-fund', '/compound-interest', '/subscriptions', '/debt-payoff', '/savings-pace', '/trip-budget', '/quickmaths', '/tools'].indexOf(path) !== -1) return 'tools';
    return document.body.getAttribute('data-penny-context') || 'general';
  }

  function setupNudges() {
    if (document.querySelector('.nudge')) return;
    // The Ask Penny page is a full chat surface with its own input — no overlay there.
    if (/(^|\/)assistant(\.html)?\/?$/.test(location.pathname)) return;
    var section = nudgeSection();
    var pool = NUDGES.filter(function (n) { return n.tags.indexOf(section) !== -1; });
    if (!pool.length) pool = NUDGES.filter(function (n) { return n.tags.indexOf('general') !== -1; });
    if (!pool.length) return;

    // One dismissal per section per day, not one for the whole site.
    var today = dateKey();
    var seen = store.get('nudgeSeen', {});
    if (!seen || typeof seen !== 'object' || Array.isArray(seen)) seen = {};
    Object.keys(seen).forEach(function (k) { if (seen[k] !== today) delete seen[k]; });
    if (seen[section] === today) return;

    var el = document.createElement('aside');
    el.className = 'nudge';
    el.setAttribute('aria-label', 'Money tip from Penny');
    document.body.appendChild(el);

    var i = Math.floor(Date.now() / 86400000) % pool.length;
    var dismissed = false;

    function paint() {
      var n = pool[i % pool.length];
      el.innerHTML = '<button class="nudge-close" type="button" data-nudge-close aria-label="Dismiss this tip">✕</button>' +
        '<div class="nudge-kicker"><i aria-hidden="true"></i>Penny’s nudge<span>' + ((i % pool.length) + 1) + ' of ' + pool.length + '</span></div>' +
        '<h3>' + esc(n.title) + '</h3>' +
        '<p>' + esc(n.body) + '</p>' +
        '<div class="nudge-actions"><a class="btn primary sm" href="' + n.href + '">' + esc(n.cta) + '</a>' +
        (pool.length > 1 ? '<button class="btn ghost sm" type="button" data-nudge-next>Another tip</button>' : '') + '</div>';
    }

    var autoClose;

    function hide() {
      dismissed = true;
      clearTimeout(autoClose);
      el.classList.remove('show');
      document.body.classList.remove('nudge-visible');
      seen[section] = today;
      store.set('nudgeSeen', seen);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }

    // Timed exit is not a dismissal: the section stays unseen, so the tip can
    // appear again on a later visit, and the Ask Penny launcher comes back.
    function clearOverlay() {
      clearTimeout(autoClose);
      el.classList.remove('show');
      document.body.classList.remove('nudge-visible');
    }

    function pennyBusy() {
      if (document.querySelector('.penny-panel.open')) return true;
      var active = document.activeElement;
      return !!(active && active.closest && active.closest('.penny-input, .penny-panel'));
    }

    function show() {
      if (dismissed) return;
      if (pennyBusy()) { timer = setTimeout(show, 5000); return; }
      el.classList.add('show');
      document.body.classList.add('nudge-visible');
      clearTimeout(autoClose);
      autoClose = setTimeout(clearOverlay, 20000);
    }

    paint();
    var timer = setTimeout(show, 6500);

    // Never cover the chat input: hide the tip when Penny is opened or focused.
    document.addEventListener('focusin', function (e) {
      if (e.target.closest && e.target.closest('.penny-input, .penny-panel')) clearOverlay();
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-open-penny], .penny-fab')) clearOverlay();
    });

    el.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      if (btn.hasAttribute('data-nudge-close')) hide();
      else if (btn.hasAttribute('data-nudge-next')) { i += 1; paint(); show(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el.classList.contains('show')) hide();
    });
  }

  /* ---------- init ---------- */
  function init() {
    setupNav();
    setupPWA();
    setupShare();
    renderStreak();
    renderPlan();
    setupPenny();
    setupTools();
    setupQuiz();
    setupGlossary();
    setupChecklists();
    setupContact();
    setupNudges();
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
