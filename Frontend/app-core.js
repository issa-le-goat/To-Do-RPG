// Yboost — planning gamifié.

const USERS_KEY = "yboost.users.v1";
const SESSION_KEY = "yboost.session.v1";
const SEED_KEY = "yboost.seeded.v1";

let users = loadUsers();
let current = null;
let mode = "login";
let weekOffset = 0; 

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch { return {}; }
}
function saveUsers() { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function data() { return users[current]; }

function obscure(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return "h" + (h >>> 0).toString(36);
}

function xpForLevel(n) { return 100 + n * 50; }

function levelInfo(totalXp) {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  const need = xpForLevel(level);
  return {
    level, inLevel: remaining, need, toNext: need - remaining,
    pct: Math.round((remaining / need) * 100),
  };
}

function currentLevelInfo(u) {
  if (u && u.live) {
    const need = u.expNext || 1;
    const inLevel = u.xp || 0;
    return {
      level: u.lvl || 0, inLevel, need,
      toNext: Math.max(0, need - inLevel),
      pct: Math.min(100, Math.round((inLevel / need) * 100)),
    };
  }
  return levelInfo((u && u.xp) || 0);
}

const GRADES = [
  { min: 0,  name: "Bronze",  color: "#a9713c" },
  { min: 10, name: "Argent",  color: "#9298a1" },
  { min: 20, name: "Or",      color: "#c9a22e" },
  { min: 30, name: "Platine", color: "#4aa3a0" },
  { min: 40, name: "Diamant", color: "#5b8def" },
  { min: 50, name: "Maître",  color: "#9b59b6" },
];
function gradeFor(level) {
  let g = GRADES[0];
  for (const grade of GRADES) if (level >= grade.min) g = grade;
  return g;
}

function medalSVG(level, size = 40) {
  const g = gradeFor(level);
  return `
  <svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <linearGradient id="med${level}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${g.color}" stop-opacity="0.95"/>
        <stop offset="1" stop-color="${g.color}" stop-opacity="0.6"/>
      </linearGradient>
    </defs>
    <circle cx="24" cy="26" r="15" fill="url(#med${level})" stroke="${g.color}" stroke-width="2"/>
    <circle cx="24" cy="26" r="9" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="1.5"/>
    <path d="M16 12 L20 4 L28 4 L32 12" fill="none" stroke="${g.color}" stroke-width="2.5" stroke-linejoin="round"/>
    <text x="24" y="30" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Inter, sans-serif">${level}</text>
  </svg>`;
}

function defaultProfile(name, pass) {
  return {
    display: name, pass: obscure(pass), mail: "",
    xp: 0, coins: 0, streak: 0, lastDoneDay: null,
    tasks: [], history: [], purchases: [], nextId: 1, createdAt: Date.now(),
  };
}

const COINS_BY_PRIORITY = { 1: 10, 2: 25, 3: 50 };
function coinsForTask(priority) { return COINS_BY_PRIORITY[priority] || COINS_BY_PRIORITY[1]; }

const SHOP_CATALOG = [
  { id: "gc_amazon",  name: "Carte cadeau Amazon 25€",   cost: 500,  emoji: "🎁", tag: "Carte cadeau" },
  { id: "gc_fnac",    name: "Carte cadeau Fnac 50€",      cost: 950,  emoji: "🎟️", tag: "Carte cadeau" },
  { id: "gc_steam",   name: "Carte Steam 20€",            cost: 420,  emoji: "🎮", tag: "Carte cadeau" },
  { id: "cinema",     name: "2 places de cinéma",         cost: 300,  emoji: "🍿", tag: "Sortie" },
  { id: "resto",      name: "Dîner au restaurant",        cost: 700,  emoji: "🍽️", tag: "Sortie" },
  { id: "spa",        name: "Journée spa & détente",      cost: 1200, emoji: "💆", tag: "Bien-être" },
  { id: "weekend",    name: "Week-end à Barcelone",       cost: 4000, emoji: "✈️", tag: "Voyage" },
  { id: "trip_rome",  name: "Voyage à Rome (3 nuits)",    cost: 6000, emoji: "🏛️", tag: "Voyage" },
  { id: "trip_bali",  name: "Séjour à Bali (1 semaine)",  cost: 12000, emoji: "🏝️", tag: "Voyage" },
];

function seedDemoTasks(profile) {
  const t = (id, title, desc, day, start, durMin, priority, done, isRec = false) => ({
    id, title, desc, day, start, durMin, priority, isRecurring: isRec,
    xp: Math.floor(durMin / 15) * 10 * priority, coins: coinsForTask(priority),
    done: !!done, doneAt: done ? Date.now() - id * 3600000 : null,
    gained: done ? Math.floor(durMin / 15) * 10 * priority : 0,
  });
  profile.tasks = [
    t(1, "Réviser les maths", "Chapitre sur les intégrales", 0, "09:00", 90, 2, false),
    t(2, "Séance de sport", "Course + musculation", 0, "18:00", 60, 1, false, true),
    t(3, "Rendre le dossier", "Projet de fin de semestre", 2, "14:00", 120, 3, false),
    t(4, "Appeler le médecin", "Prendre rendez-vous", 1, "11:00", 15, 1, true),
    t(5, "Lecture", "30 pages du roman", 3, "20:00", 45, 1, false, true),
    t(6, "Réunion d'équipe", "Point hebdomadaire", 4, "10:00", 60, 2, true, true),
    t(7, "Courses", "Liste de la semaine", 5, "16:00", 45, 1, false),
  ];
  profile.nextId = 8;
}

function seedFakePlayers() {
  if (localStorage.getItem(SEED_KEY)) return;
  const fakes = [
    { n: "Léa", xp: 22000 }, { n: "Tom", xp: 14500 },
    { n: "Inès", xp: 8200 }, { n: "Maxime", xp: 3400 }, { n: "Sofia", xp: 900 },
  ];
  fakes.forEach((f) => {
    const key = f.n.toLowerCase();
    if (!users[key]) {
      const p = defaultProfile(f.n, "pasdemdp" + Math.random());
      p.xp = f.xp; p.fake = true; p.mail = key + "@yboost.demo";
      users[key] = p;
    }
  });
  if (!users["admin"]) {
    const a = defaultProfile("admin", "admin001");
    a.mail = "admin@admin.com"; a.isAdmin = true; a.xp = 0;
    users["admin"] = a;
  }
  localStorage.setItem(SEED_KEY, "1");
  saveUsers();
}

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const authTitle = document.getElementById("authTitle");
const authSub = document.getElementById("authSub");
const authName = document.getElementById("authName");
const authMail = document.getElementById("authMail");
const authPass = document.getElementById("authPass");
const mailField = document.getElementById("mailField");
const authError = document.getElementById("authError");
const authSubmit = document.getElementById("authSubmit");
const switchText = document.getElementById("switchText");
const switchMode = document.getElementById("switchMode");

function setMode(m) {
  mode = m;
  authError.textContent = "";
  if (m === "login") {
    authTitle.textContent = "Bon retour"; authSub.textContent = "Connecte-toi pour reprendre ta progression.";
    authSubmit.textContent = "Se connecter"; switchText.textContent = "Pas encore de compte ?";
    switchMode.textContent = "Créer un compte"; mailField.hidden = true; authPass.autocomplete = "current-password";
  } else {
    authTitle.textContent = "Nouveau joueur"; authSub.textContent = "Crée ton compte et commence à gagner de l'XP.";
    authSubmit.textContent = "Créer le compte"; switchText.textContent = "Tu as déjà un compte ?";
    switchMode.textContent = "Se connecter"; mailField.hidden = false; authPass.autocomplete = "new-password";
  }
}
switchMode.onclick = () => setMode(mode === "login" ? "signup" : "login");

async function submitAuth() {
  const name = authName.value.trim();
  const pass = authPass.value;
  authError.textContent = "";
  if (!name) { authError.textContent = "Indique un nom de joueur."; return; }
  if (pass.length < 4) { authError.textContent = "Mot de passe : 4 caractères minimum."; return; }
  const key = name.toLowerCase();

  if (mode === "login" && (key === "admin" || key === "admin@admin.com")) {
    if (!users["admin"]) {
      const a = defaultProfile("admin", "admin001");
      a.mail = "admin@admin.com"; a.isAdmin = true;
      users["admin"] = a; saveUsers();
    }
    const adm = users["admin"];
    if (adm.pass !== obscure(pass)) { authError.textContent = "Mot de passe admin incorrect."; return; }
    startSession("admin", false);
    return;
  }

  if (await isLive()) {
    const { api } = window.YboostApi;
    authSubmit.disabled = true;
    try {
      if (mode === "signup") {
        const mail = authMail.value.trim();
        if (!mail) { authError.textContent = "Indique un e-mail."; return; }
        await api.register(name, mail, pass);
      }
      const res = await api.login(name, pass);
      await startServerSession(res.user);
    } catch (err) { authError.textContent = err.message || "Échec de la connexion."; } 
    finally { authSubmit.disabled = false; }
    return;
  }

  if (mode === "signup") {
    if (users[key]) { authError.textContent = "Ce nom est déjà pris."; return; }
    const p = defaultProfile(name, pass);
    p.mail = authMail.value.trim();
    seedDemoTasks(p); 
    users[key] = p; saveUsers(); startSession(key, true);
  } else {
    const u = users[key];
    if (!u || u.fake) { authError.textContent = "Compte introuvable."; return; }
    if (u.pass !== obscure(pass)) { authError.textContent = "Mot de passe incorrect."; return; }
    startSession(key, false);
  }
}
authSubmit.onclick = submitAuth;
authName.onkeydown = (e) => { if (e.key === "Enter") (mailField.hidden ? authPass : authMail).focus(); };
authMail.onkeydown = (e) => { if (e.key === "Enter") authPass.focus(); };
authPass.onkeydown = (e) => { if (e.key === "Enter") submitAuth(); };

function startSession(key, isNew) {
  current = key;
  localStorage.setItem(SESSION_KEY, key);
  const u = data();
  if (u.xp === undefined) u.xp = 0; if (u.coins === undefined) u.coins = 0;
  if (u.streak === undefined) u.streak = 0; if (u.lastDoneDay === undefined) u.lastDoneDay = null;
  if (!Array.isArray(u.tasks)) u.tasks = []; if (!Array.isArray(u.history)) u.history = [];
  if (!Array.isArray(u.purchases)) u.purchases = []; if (u.nextId === undefined) u.nextId = 1;
  if (u.mail === undefined) u.mail = "";
  saveUsers();

  authName.value = ""; authPass.value = ""; authMail.value = "";
  authView.hidden = true; appView.hidden = false;
  applyAdminUI(!!u.isAdmin);
  if (isNew) log("add", "Compte créé");
  goTo(u.isAdmin ? "admin" : "planning");
  refreshTopBar();
}

function applyAdminUI(isAdmin) {
  const tab = document.querySelector('.navtab[data-page="admin"]');
  if (tab) tab.hidden = !isAdmin;
  document.body.classList.toggle("is-admin", isAdmin);
}

function logout() {
  current = null; localStorage.removeItem(SESSION_KEY);
  appView.hidden = true; authView.hidden = false; setMode("login");
}
document.getElementById("logoutBtn").onclick = logout;

let LIVE = null;
let serverUserId = null;

async function isLive() {
  if (LIVE !== null) return LIVE;
  try { LIVE = await window.YboostApi.backendAlive(); } catch { LIVE = false; }
  return LIVE;
}

function applyServerUser(serverUser) {
  current = "srv:" + serverUser.id;
  serverUserId = serverUser.id;
  if (!users[current]) users[current] = defaultProfile(serverUser.name, "x");
  const u = users[current];
  u.display = serverUser.name; u.mail = serverUser.email || ""; u.serverId = serverUser.id;
  u.xp = serverUser.exp ?? 0; u.lvl = serverUser.lvl ?? 0;
  u.expNext = serverUser.exp_next ?? serverUser.expNext ?? 100;
  u.rank = serverUser.rank || null; u.live = true;
}

async function syncProfile() {
  const { api } = window.YboostApi;
  try { applyServerUser(await api.profile(serverUserId)); } catch (e) { }
}

async function syncTasks() {
  const { api } = window.YboostApi;
  const [all, recurring] = await Promise.all([
    api.listAll(serverUserId),
    api.listRecurring(serverUserId)
  ]);
  
  data().tasks = [...all, ...recurring].map((t) => ({
    id: t.id, title: t.title, desc: t.desc, day: t.day,
    start: t.start, durMin: t.durMin, xp: t.xp,
    priority: t.priority, dueDate: t.dueDate, done: t.done,
    doneAt: t.done ? Date.now() : null, gained: t.xp,
    isRecurring: t.isRecurring
  }));
}

async function startServerSession(serverUser) {
  applyServerUser(serverUser);
  localStorage.setItem(SESSION_KEY, current);
  localStorage.setItem("yboost.srvid", String(serverUser.id));
  authName.value = ""; authPass.value = ""; authMail.value = "";
  authView.hidden = true; appView.hidden = false;
  await syncTasks();
  goTo("planning");
  refreshTopBar();
}

function log(type, taskText) {
  data().history.unshift({ type, task: taskText, at: Date.now() });
  if (data().history.length > 300) data().history.length = 300;
  saveUsers();
}

const PAGES = ["planning", "todo", "done", "shop", "rewards", "profile", "leaderboard", "admin"];
function goTo(page) {
  document.querySelectorAll(".navtab").forEach((t) => t.classList.toggle("is-active", t.dataset.page === page));
  PAGES.forEach((p) => { const el = document.getElementById("page-" + p); if (el) el.hidden = p !== page; });
  if (page === "planning") renderPlanning();
  if (page === "todo") renderTodo();
  if (page === "done") renderDone();
  if (page === "shop") renderShop();
  if (page === "rewards") renderRewards();
  if (page === "profile") renderProfile();
  if (page === "leaderboard") renderLeaderboard();
  if (page === "admin") renderAdmin();
}
document.querySelectorAll(".navtab").forEach((t) => { t.onclick = () => goTo(t.dataset.page); });

function refreshTopBar() {
  const u = data(); const info = currentLevelInfo(u); const g = gradeFor(info.level);
  document.getElementById("hello").textContent = u.display;
  document.getElementById("topMedal").innerHTML = medalSVG(info.level, 34);
  document.getElementById("topLevel").textContent = "Niv. " + info.level;
  document.getElementById("topGrade").textContent = g.name; document.getElementById("topGrade").style.color = g.color;
  document.getElementById("topXpBar").style.width = info.pct + "%"; document.getElementById("topXpBar").style.background = g.color;
  document.getElementById("topXpText").textContent = info.inLevel + " / " + info.need + " XP";
  const coinEl = document.getElementById("topCoins");
  if (coinEl) coinEl.textContent = (u.coins || 0).toLocaleString("fr-FR");
}

const STREAK_BONUS = 0.1; const STREAK_CAP = 1.0;
function todayKey(d = new Date()) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

function updateStreakOnComplete() {
  const u = data(); const today = todayKey();
  if (u.lastDoneDay !== today) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (u.lastDoneDay === todayKey(y)) u.streak += 1; else u.streak = 1;
    u.lastDoneDay = today;
  }
}

function xpGain(baseXp) {
  const mult = 1 + Math.min((data().streak - 1) * STREAK_BONUS, STREAK_CAP);
  return Math.round(baseXp * Math.max(1, mult));
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOUR_START = 0; const HOUR_END = 24; const HOUR_PX = 64;

function mondayOf(offset = 0) {
  const d = new Date(); const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + offset * 7); d.setHours(0, 0, 0, 0); return d;
}

function minutesFromStr(s) { const [h, m] = s.split(":").map(Number); return h * 60 + m; }
function strFromMinutes(min) { const h = Math.floor(min / 60), m = min % 60; return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"); }

function renderPlanning() {
  const monday = mondayOf(weekOffset);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  document.getElementById("weekLabel").textContent = "Semaine du " + fmt(monday) + " au " + fmt(sunday);

  const grid = document.getElementById("planningGrid");
  grid.innerHTML = "";

  const totalH = HOUR_END - HOUR_START;
  const timeCol = document.createElement("div"); timeCol.className = "time-col";
  timeCol.innerHTML = '<div class="day-head"></div>';
  for (let h = HOUR_START; h < HOUR_END; h++) {
    const cell = document.createElement("div"); cell.className = "hour-label";
    cell.style.height = HOUR_PX + "px"; cell.textContent = h + "h"; timeCol.appendChild(cell);
  }
  grid.appendChild(timeCol);

  const todayK = todayKey();

  DAYS.forEach((dayName, dayIdx) => {
    const col = document.createElement("div"); col.className = "day-col";
    const date = new Date(monday); date.setDate(monday.getDate() + dayIdx);
    const isToday = todayKey(date) === todayK;

    const head = document.createElement("div"); head.className = "day-head" + (isToday ? " is-today" : "");
    head.innerHTML = `<span class="day-name">${DAY_SHORT[dayIdx]}</span><span class="day-date">${date.getDate()}</span>`;
    col.appendChild(head);

    const body = document.createElement("div"); body.className = "day-body";
    body.style.height = totalH * HOUR_PX + "px";

    for (let h = 0; h < totalH; h++) {
      const line = document.createElement("div"); line.className = "hour-line";
      line.style.top = h * HOUR_PX + "px"; body.appendChild(line);
    }

    body.onclick = (e) => {
      if (e.target.closest(".event")) return;
      const rect = body.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const hour = HOUR_START + Math.floor(y / HOUR_PX);
      openTaskModal(null, dayIdx, strFromMinutes(hour * 60));
    };

    data().tasks.filter((t) => t.day === dayIdx).forEach((t) => {
      const startMin = minutesFromStr(t.start);
      const top = ((startMin - HOUR_START * 60) / 60) * HOUR_PX;
      const height = Math.max(26, (t.durMin / 60) * HOUR_PX - 4);
      const ev = document.createElement("div");
      ev.className = "event" + (t.done ? " done" : "");
      ev.style.top = top + "px"; ev.style.height = height + "px";
      const recurringIcon = t.isRecurring ? " ↻" : "";
      ev.innerHTML = `
        <div class="event-title">${escapeHtml(t.title)}${recurringIcon}</div>
        <div class="event-meta">${t.start} · +${t.xp} XP</div>`;
      ev.onclick = (e) => { e.stopPropagation(); openTaskModal(t); };
      body.appendChild(ev);
    });
    col.appendChild(body); grid.appendChild(col);
  });
}

document.getElementById("prevWeek").onclick = () => { weekOffset--; renderPlanning(); };
document.getElementById("nextWeek").onclick = () => { weekOffset++; renderPlanning(); };
document.getElementById("todayWeek").onclick = () => { weekOffset = 0; renderPlanning(); };
document.getElementById("addTaskBtn").onclick = () => openTaskModal(null, 0, "08:00");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const modal = document.getElementById("taskModal");
const mTitle = document.getElementById("mTitle");
const mDesc = document.getElementById("mDesc");
const mStart = document.getElementById("mStart");
const mDur = document.getElementById("mDur");
const mXp = document.getElementById("mXp");
const mPriority = document.getElementById("mPriority");
const xpEstimate = document.getElementById("xpEstimate");
const mRecurring = document.getElementById("mRecurring"); 

function estimateXp() {
  const dur = Math.max(15, Number(mDur.value) || 60);
  const pri = Number(mPriority ? mPriority.value : 1) || 1;
  return Math.floor(dur / 15) * 10 * pri;
}
function refreshXpEstimate() { if (xpEstimate) xpEstimate.textContent = "Récompense estimée : +" + estimateXp() + " XP"; }
if (mDur) mDur.addEventListener("input", refreshXpEstimate);
if (mPriority) mPriority.addEventListener("change", refreshXpEstimate);
let editingId = null;

const mDaysContainer = document.getElementById("mDaysContainer");
DAYS.forEach((d, i) => {
  const lbl = document.createElement("label");
  lbl.style.cssText = "display:flex; align-items:center; gap:4px; font-size:0.75rem; background:var(--paper); padding:4px 8px; border-radius:6px; border:1px solid var(--rule); cursor:pointer; flex-direction:row; text-transform:none; letter-spacing:normal;";
  lbl.innerHTML = `<input type="checkbox" value="${i}" class="mDayCheckbox" style="width:auto; margin:0; padding:0;"> ${DAY_SHORT[i]}`;
  mDaysContainer.appendChild(lbl);
});

function openTaskModal(task, presetDay, presetStart) {
  editingId = task ? task.id : null;
  document.getElementById("modalTitle").textContent = task ? "Détail de la tâche" : "Nouvelle tâche";
  mTitle.value = task ? task.title : "";
  mDesc.value = task ? (task.desc || "") : "";
  mStart.value = task ? task.start : (presetStart ?? "08:00");
  mDur.value = task ? task.durMin : 60;
  mXp.value = task ? task.xp : 20;
  if (mPriority) mPriority.value = task ? (task.priority || 1) : 1;
  if (mRecurring) mRecurring.checked = task ? !!task.isRecurring : false;
  
  document.querySelectorAll(".mDayCheckbox").forEach(cb => {
    cb.checked = task ? (Number(cb.value) === task.day) : (Number(cb.value) === (presetDay ?? 0));
  });

  refreshXpEstimate();

  const doneBtn = document.getElementById("mDone");
  const delBtn = document.getElementById("mDelete");
  if (task) {
    delBtn.hidden = false;
    if (task.done) {
      doneBtn.hidden = LIVE === true; doneBtn.textContent = "Marquer à refaire";
    } else {
      doneBtn.hidden = false; doneBtn.textContent = "Terminer (+XP)";
    }
  } else {
    doneBtn.hidden = true; delBtn.hidden = true;
  }
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; editingId = null; }
document.getElementById("mClose").onclick = closeModal;
document.getElementById("modalBackdrop").onclick = closeModal;

document.getElementById("mSave").onclick = async () => {
  const title = mTitle.value.trim();
  if (!title) { mTitle.focus(); return; }
  
  const selectedDays = Array.from(document.querySelectorAll(".mDayCheckbox"))
    .filter(cb => cb.checked)
    .map(cb => Number(cb.value));

  if (selectedDays.length === 0) { alert("Sélectionne au moins un jour."); return; }

  const start = mStart.value || "08:00";
  const durMin = Math.max(15, Number(mDur.value) || 60);
  const priority = Math.max(1, Number(mPriority ? mPriority.value : 1) || 1);
  const recurring = mRecurring ? mRecurring.checked : false;

  if (await isLive()) {
    const monday = mondayOf(weekOffset);
    const [h, m] = start.split(":").map(Number);
    
    const dueDateObjs = selectedDays.map(day => {
      const due = new Date(monday);
      due.setDate(monday.getDate() + day);
      due.setHours(h, m, 0, 0);
      return due;
    });

    const saveBtn = document.getElementById("mSave"); saveBtn.disabled = true;
    try {
      if (editingId) await window.YboostApi.api.deleteTask(editingId, serverUserId);
      await window.YboostApi.api.createTask(serverUserId, {
        title, desc: mDesc.value.trim(), dueDateObjs, durMin, priority, recurring
      });
      await syncTasks(); closeModal(); renderPlanning(); renderTodo(); renderDone();
    } catch (err) { alert("Erreur : " + (err.message || "création impossible")); } 
    finally { saveBtn.disabled = false; }
    return;
  }

  // Local/Demo Mode
  if (editingId) {
    const t = data().tasks.find((x) => x.id === editingId);
    Object.assign(t, { title, desc: mDesc.value.trim(), day: selectedDays[0], start, durMin, priority, isRecurring: recurring, xp: Math.max(1, Number(mXp.value) || 10) });
    log("edit", t.title);
  } else {
    selectedDays.forEach(day => {
      const payload = { title, desc: mDesc.value.trim(), day, start, durMin, priority, isRecurring: recurring, xp: Math.max(1, Number(mXp.value) || 10) };
      data().tasks.push({ id: data().nextId++, done: false, doneAt: null, ...payload });
    });
    log("add", title);
  }
  saveUsers(); closeModal(); renderPlanning(); renderTodo();
};

document.getElementById("mDone").onclick = async () => {
  if (await isLive()) {
    const doneBtn = document.getElementById("mDone"); doneBtn.disabled = true;
    try {
      const task = data().tasks.find((x) => x.id === editingId);
      await window.YboostApi.api.completeTask(editingId, serverUserId);
      await syncTasks(); await syncProfile();
      const gainCoins = coinsForTask(task ? task.priority : 1);
      data().coins = (data().coins || 0) + gainCoins; saveUsers();
      closeModal(); refreshTopBar(); renderPlanning(); renderTodo(); renderDone(); flyXp("✓ +" + gainCoins + " coins");
    } catch (err) { alert("Erreur : " + (err.message || "impossible de terminer")); } 
    finally { doneBtn.disabled = false; }
    return;
  }

  const t = data().tasks.find((x) => x.id === editingId);
  if (!t) return;
  if (!t.done) {
    t.done = true; t.doneAt = Date.now(); updateStreakOnComplete();
    const gain = xpGain(t.xp); t.gained = gain; data().xp += gain;
    const gainCoins = coinsForTask(t.priority || 1); t.coinsGained = gainCoins; data().coins = (data().coins || 0) + gainCoins;
    log("done", `+${gain} XP · +${gainCoins} coins · ${t.title}`); flyXp("+" + gain + " XP · +" + gainCoins + " coins");
  } else {
    t.done = false; data().xp = Math.max(0, data().xp - (t.gained || 0));
    data().coins = Math.max(0, (data().coins || 0) - (t.coinsGained || 0));
    t.gained = 0; t.coinsGained = 0; log("reopen", t.title);
  }
  saveUsers(); closeModal(); refreshTopBar(); renderPlanning(); renderTodo(); renderDone();
};

document.getElementById("mDelete").onclick = async () => {
  if (await isLive()) {
    const delBtn = document.getElementById("mDelete"); delBtn.disabled = true;
    try {
      await window.YboostApi.api.deleteTask(editingId, serverUserId);
      await syncTasks(); closeModal(); renderPlanning(); renderTodo(); renderDone();
    } catch (err) { alert("Erreur : " + (err.message || "suppression impossible")); } 
    finally { delBtn.disabled = false; }
    return;
  }
  const t = data().tasks.find((x) => x.id === editingId);
  if (t) log("delete", t.title);
  data().tasks = data().tasks.filter((x) => x.id !== editingId);
  saveUsers(); closeModal(); renderPlanning(); renderTodo(); renderDone();
};

function flyXp(n) {
  const anchor = document.querySelector(".topbar"); if (!anchor) return;
  const r = anchor.getBoundingClientRect(); const c = document.createElement("div");
  c.className = "xp-fly"; c.textContent = typeof n === "number" ? "+" + n + " XP" : String(n);
  c.style.left = r.left + r.width / 2 + "px"; c.style.top = r.bottom - 10 + "px";
  document.body.appendChild(c); setTimeout(() => c.remove(), 1100);
}

function renderTodo() {
  const u = data(); 
  const todos = u.tasks.filter((t) => !t.done).sort((a, b) => a.day - b.day);
  const list = document.getElementById("todoList"); 
  list.innerHTML = "";

  todos.forEach((t) => {
    const li = document.createElement("li"); 
    li.className = "done-item"; 
    li.style.cursor = "pointer";
    
    const recurringIcon = t.isRecurring ? " ↻" : "";
    
    li.innerHTML = `
      <div class="done-body">
        <div class="done-title">${escapeHtml(t.title)}${recurringIcon}</div>
        <div class="done-meta">${DAYS[t.day]} à ${t.start} · Priorité ${t.priority || 1}</div>
      </div>
      <span class="done-xp" style="color: var(--ink-soft);">+${t.xp} XP</span>`;
      
    li.onclick = () => openTaskModal(t); 
    list.appendChild(li);
  });

  document.getElementById("todoEmpty").style.display = todos.length ? "none" : "block";
  document.getElementById("todoSummary").textContent = todos.length ? `${todos.length} tâche(s) à faire` : "";
}

function renderDone() {
  const u = data(); const done = u.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const list = document.getElementById("doneList"); list.innerHTML = "";
  done.forEach((t) => {
    const li = document.createElement("li"); li.className = "done-item";
    const when = t.doneAt ? new Date(t.doneAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "—";
    li.innerHTML = `
      <span class="done-check">✓</span>
      <div class="done-body">
        <div class="done-title">${escapeHtml(t.title)}</div>
        <div class="done-meta">${DAYS[t.day]} ${t.start} · terminée ${when}</div>
      </div>
      <span class="done-xp">+${t.gained || t.xp} XP</span>`;
    list.appendChild(li);
  });
  document.getElementById("doneEmpty").style.display = done.length ? "none" : "block";
  const totalXp = done.reduce((s, t) => s + (t.gained || t.xp), 0);
  document.getElementById("doneSummary").textContent = done.length ? `${done.length} tâche${done.length > 1 ? "s" : ""} · ${totalXp} XP gagnés` : "";
}

function renderProfile() {
  const u = data(); const info = currentLevelInfo(u); const g = gradeFor(info.level);
  document.getElementById("pMedal").innerHTML = medalSVG(info.level, 96);
  document.getElementById("pName").textContent = u.display; document.getElementById("pMail").textContent = u.mail || "—";
  document.getElementById("pGrade").textContent = g.name; document.getElementById("pGrade").style.color = g.color;
  document.getElementById("pLevel").textContent = info.level; document.getElementById("pStreak").textContent = u.streak + " j";
  document.getElementById("pTotalXp").textContent = u.xp + " XP";
  const doneCount = u.tasks.filter((t) => t.done).length; document.getElementById("pDone").textContent = doneCount;
  document.getElementById("pBar").style.width = info.pct + "%"; document.getElementById("pBar").style.background = g.color;
  document.getElementById("pBarText").textContent = info.toNext + " XP avant le niveau " + (info.level + 1);
  document.getElementById("pMailInput").value = u.mail || "";
}
document.getElementById("pSaveMail").onclick = async () => {
  if (await isLive()) {
    const note = document.getElementById("pSavedNote"); note.textContent = "Modification du mail non disponible.";
    note.style.opacity = "1"; setTimeout(() => (note.style.opacity = "0"), 2500); return;
  }
  data().mail = document.getElementById("pMailInput").value.trim(); saveUsers(); renderProfile();
  const note = document.getElementById("pSavedNote"); note.textContent = "Enregistré ✓";
  note.style.opacity = "1"; setTimeout(() => (note.style.opacity = "0"), 1500);
};

async function renderLeaderboard() {
  const list = document.getElementById("lbList");
  if (await isLive()) {
    let entries = [];
    try { entries = await window.YboostApi.api.leaderboard(); } catch { entries = []; }
    const myName = (data() && data().display) || ""; list.innerHTML = "";
    entries.forEach((e, i) => {
      const level = e.lvl ?? e.level ?? 0; const isMe = e.name === myName;
      const li = document.createElement("li"); li.className = "lb-row" + (isMe ? " is-me" : "");
      const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
      li.innerHTML = `
        <span class="lb-rank ${rankClass}">${i + 1}</span><span class="lb-medal">${medalSVG(level, 30)}</span>
        <div class="lb-info"><span class="lb-name">${escapeHtml(e.name)}${isMe ? " <em>(toi)</em>" : ""}</span><span class="lb-grade">${gradeFor(level).name} · Niv. ${level}</span></div>
        <span class="lb-xp">Niv. ${level}</span>`;
      list.appendChild(li);
    });
    document.getElementById("lbList").hidden = false; return;
  }

  const rows = Object.keys(users).map((k) => {
    const u = users[k]; const info = levelInfo(u.xp || 0);
    return { key: k, name: u.display, xp: u.xp || 0, level: info.level, fake: !!u.fake };
  }).sort((a, b) => b.xp - a.xp);

  list.innerHTML = "";
  rows.forEach((r, i) => {
    const li = document.createElement("li"); li.className = "lb-row" + (r.key === current ? " is-me" : "");
    const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
    li.innerHTML = `
      <span class="lb-rank ${rankClass}">${i + 1}</span><span class="lb-medal">${medalSVG(r.level, 30)}</span>
      <div class="lb-info"><span class="lb-name">${escapeHtml(r.name)}${r.key === current ? " <em>(toi)</em>" : ""}</span><span class="lb-grade">${gradeFor(r.level).name} · Niv. ${r.level}</span></div>
      <span class="lb-xp">${r.xp} XP</span>`;
    list.appendChild(li);
  });
}

function renderShop() {
  const u = data(); document.getElementById("shopCoins").textContent = (u.coins || 0).toLocaleString("fr-FR");
  const grid = document.getElementById("shopGrid"); grid.innerHTML = "";
  SHOP_CATALOG.forEach((r) => {
    const owned = (u.purchases || []).filter((p) => p.rewardId === r.id).length;
    const affordable = (u.coins || 0) >= r.cost;
    const card = document.createElement("div"); card.className = "shop-card";
    card.innerHTML = `
      <div class="shop-emoji">${r.emoji}</div><span class="shop-tag">${r.tag}</span>
      <div class="shop-name">${escapeHtml(r.name)}</div>
      <div class="shop-cost"><span class="coin-dot">●</span> ${r.cost.toLocaleString("fr-FR")}</div>
      <button class="shop-buy" ${affordable ? "" : "disabled"}>${affordable ? "Échanger" : "Pas assez de coins"}</button>
      ${owned ? `<div class="shop-owned">Obtenu ×${owned}</div>` : ""}`;
    card.querySelector(".shop-buy").onclick = () => buyReward(r); grid.appendChild(card);
  });
}

function buyReward(r) {
  const u = data(); if ((u.coins || 0) < r.cost) return;
  u.coins -= r.cost; u.purchases = u.purchases || [];
  u.purchases.unshift({ rewardId: r.id, name: r.name, cost: r.cost, at: Date.now() });
  log("buy", `−${r.cost} coins · ${r.name}`); saveUsers(); refreshTopBar(); renderShop(); showShopToast(r);
}

function showShopToast(r) {
  const t = document.getElementById("shopToast"); if (!t) return;
  t.innerHTML = `${r.emoji} <b>${escapeHtml(r.name)}</b> ajouté à tes récompenses ! <span class="toast-note">(récompense fictive)</span>`;
  t.classList.add("show"); clearTimeout(showShopToast._t); showShopToast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

function renderRewards() {
  const u = data(); const purchases = u.purchases || [];
  const list = document.getElementById("rewardsList"); list.innerHTML = "";
  purchases.forEach((p) => {
    const cat = SHOP_CATALOG.find((c) => c.id === p.rewardId) || {};
    const when = p.at ? new Date(p.at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
    const li = document.createElement("li"); li.className = "reward-row";
    li.innerHTML = `
      <span class="reward-emoji">${cat.emoji || "🎁"}</span>
      <div class="reward-body"><div class="reward-name">${escapeHtml(p.name)}</div><div class="reward-meta">${cat.tag ? escapeHtml(cat.tag) + " · " : ""}échangé le ${when}</div></div>
      <span class="reward-price"><span class="coin-dot">●</span> ${p.cost.toLocaleString("fr-FR")}</span>`;
    list.appendChild(li);
  });
  document.getElementById("rewardsEmpty").style.display = purchases.length ? "none" : "block";
  const spent = purchases.reduce((s, p) => s + (p.cost || 0), 0);
  document.getElementById("rewardsSummary").textContent = purchases.length ? `${purchases.length} récompense${purchases.length > 1 ? "s" : ""} · ${spent.toLocaleString("fr-FR")} coins dépensés` : "";
}

function renderAdmin() {
  const u = data(); if (!u.isAdmin) { goTo("planning"); return; }
  document.getElementById("adXp").textContent = (u.xp || 0).toLocaleString("fr-FR");
  document.getElementById("adCoins").textContent = (u.coins || 0).toLocaleString("fr-FR");
  const info = currentLevelInfo(u); document.getElementById("adLevel").textContent = info.level; document.getElementById("adGrade").textContent = gradeFor(info.level).name;
  const sel = document.getElementById("adTarget");
  if (sel && !sel.dataset.filled) {
    sel.innerHTML = "";
    Object.keys(users).forEach((k) => {
      const o = document.createElement("option"); o.value = k; o.textContent = users[k].display + (k === current ? " (toi)" : "") + (users[k].fake ? " · fictif" : "");
      sel.appendChild(o);
    });
    sel.value = current; sel.dataset.filled = "1";
  }
}

function adminGrantXp(targetKey, amount) {
  const u = users[targetKey]; if (!u) return;
  if (u.live) { alert("XP serveur non modifiable d'ici."); return; }
  u.xp = Math.max(0, (u.xp || 0) + amount); saveUsers();
  if (targetKey === current) refreshTopBar(); renderAdmin();
}

function adminGrantCoins(targetKey, amount) {
  const u = users[targetKey]; if (!u) return;
  u.coins = Math.max(0, (u.coins || 0) + amount); saveUsers();
  if (targetKey === current) refreshTopBar(); renderAdmin();
}

function wireAdminButtons() {
  const grid = document.getElementById("adminButtons"); if (!grid) return;
  grid.querySelectorAll("[data-xp]").forEach((b) => { b.onclick = () => adminGrantXp(document.getElementById("adTarget").value, Number(b.dataset.xp)); });
  grid.querySelectorAll("[data-coins]").forEach((b) => { b.onclick = () => adminGrantCoins(document.getElementById("adTarget").value, Number(b.dataset.coins)); });
  const customBtn = document.getElementById("adCustomBtn");
  if (customBtn) customBtn.onclick = () => {
    const target = document.getElementById("adTarget").value;
    const xp = Number(document.getElementById("adCustomXp").value) || 0; const coins = Number(document.getElementById("adCustomCoins").value) || 0;
    if (xp) adminGrantXp(target, xp); if (coins) adminGrantCoins(target, coins);
  };
  const resetBtn = document.getElementById("adResetBtn");
  if (resetBtn) resetBtn.onclick = () => {
    const target = document.getElementById("adTarget").value; const u = users[target]; if (!u) return;
    if (confirm("Remettre XP, niveau et coins à zéro ?")) { u.xp = 0; u.coins = 0; saveUsers(); if (target === current) refreshTopBar(); renderAdmin(); }
  };
}

(async function init() {
  setMode("login");
  const live = await isLive();
  if (live) {
    ensureAdminAccount(); wireAdminButtons();
    const savedId = localStorage.getItem("yboost.srvid");
    if (savedId) {
      try {
        const p = await window.YboostApi.api.profile(Number(savedId));
        await startServerSession({ id: p.id, name: p.name, email: p.email, lvl: p.lvl, exp: p.exp, exp_next: p.exp_next, rank: p.rank });
        return;
      } catch { }
    }
    authView.hidden = false; appView.hidden = true; return;
  }
  seedFakePlayers(); users = loadUsers(); ensureAdminAccount(); wireAdminButtons();
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved && users[saved] && !users[saved].fake) { startSession(saved, false); } 
  else { authView.hidden = false; appView.hidden = true; }
})();

function ensureAdminAccount() {
  if (!users["admin"]) {
    const a = defaultProfile("admin", "admin001"); a.mail = "admin@admin.com"; a.isAdmin = true;
    users["admin"] = a; saveUsers();
  }
}