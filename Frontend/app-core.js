/* =========================================================
   Yboost - planning gamifié (maquette 100% locale)
   ATTENTION : stockage navigateur, non sécurisé. Le mot de
   passe n'est que "brouillé". Ne pas réutiliser un vrai mdp.
   ========================================================= */

const USERS_KEY = "yboost.users.v1";
const SESSION_KEY = "yboost.session.v1";
const SEED_KEY = "yboost.seeded.v1";

let users = loadUsers();
let current = null;
let mode = "login";
let weekOffset = 0; // 0 = semaine courante, -1 = précédente, +1 = suivante

/* ---------- Persistance ---------- */
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch { return {}; }
}
function saveUsers() { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function data() { return users[current]; }

/* ---------- "Hachage" léger (PAS de vraie sécurité) ---------- */
function obscure(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return "h" + (h >>> 0).toString(36);
}

/* =========================================================
   SYSTÈME XP / NIVEAUX / GRADES
   ========================================================= */
// XP nécessaire pour PASSER du niveau n au niveau n+1.
function xpForLevel(n) { return 100 + n * 50; }

// À partir d'une XP totale, calcule niveau + progression dans le niveau.
function levelInfo(totalXp) {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  const need = xpForLevel(level);
  return {
    level,
    inLevel: remaining,        // XP accumulée dans le niveau courant
    need,                      // XP totale requise pour ce niveau
    toNext: need - remaining,  // XP restante avant le prochain niveau
    pct: Math.round((remaining / need) * 100),
  };
}

// En mode live, lvl/exp/expNext viennent du serveur ; sinon calcul local.
function currentLevelInfo(u) {
  if (u && u.live) {
    const need = u.expNext || 1;
    const inLevel = u.xp || 0;
    return {
      level: u.lvl || 0,
      inLevel,
      need,
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

// Médaille SVG colorée selon le grade.
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

/* =========================================================
   GÉNÉRATION / SEED
   ========================================================= */
function defaultProfile(name, pass) {
  return {
    display: name,
    pass: obscure(pass),
    mail: "",
    xp: 0,
    streak: 0,
    lastDoneDay: null,
    tasks: [],       // { id, title, desc, day(0-6, lundi=0), start("16:00"), durMin, xp, done, doneAt }
    history: [],     // { type, task, at }
    nextId: 1,
    createdAt: Date.now(),
  };
}

// Joueurs fictifs pour étoffer le classement.
function seedFakePlayers() {
  if (localStorage.getItem(SEED_KEY)) return;
  const fakes = [
    { n: "Léa",     xp: 22000 },  // ~ Or / Platine
    { n: "Tom",     xp: 14500 },
    { n: "Inès",    xp: 8200 },
    { n: "Maxime",  xp: 3400 },
    { n: "Sofia",   xp: 900 },
  ];
  fakes.forEach((f) => {
    const key = f.n.toLowerCase();
    if (!users[key]) {
      const p = defaultProfile(f.n, "pasdemdp" + Math.random());
      p.xp = f.xp;
      p.fake = true;          // marqué fictif : pas connectable
      p.mail = key + "@yboost.demo";
      users[key] = p;
    }
  });
  localStorage.setItem(SEED_KEY, "1");
  saveUsers();
}

/* =========================================================
   AUTHENTIFICATION
   ========================================================= */
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
    authTitle.textContent = "Bon retour";
    authSub.textContent = "Connecte-toi pour reprendre ta progression.";
    authSubmit.textContent = "Se connecter";
    switchText.textContent = "Pas encore de compte ?";
    switchMode.textContent = "Créer un compte";
    mailField.hidden = true;
    authPass.autocomplete = "current-password";
  } else {
    authTitle.textContent = "Nouveau joueur";
    authSub.textContent = "Crée ton compte et commence à gagner de l'XP.";
    authSubmit.textContent = "Créer le compte";
    switchText.textContent = "Tu as déjà un compte ?";
    switchMode.textContent = "Se connecter";
    mailField.hidden = false;
    authPass.autocomplete = "new-password";
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

  // ---- Mode LIVE : on parle au back Go ----
  if (await isLive()) {
    const { api } = window.YboostApi;
    authSubmit.disabled = true;
    try {
      if (mode === "signup") {
        const mail = authMail.value.trim();
        if (!mail) { authError.textContent = "Indique un e-mail."; return; }
        await api.register(name, mail, pass);
        // on enchaîne sur un login pour récupérer l'objet user complet
      }
      const res = await api.login(name, pass);
      const serverUser = res.user; // { id, name, email, lvl, exp, exp_next, ... }
      await startServerSession(serverUser);
    } catch (err) {
      authError.textContent = err.message || "Échec de la connexion.";
    } finally {
      authSubmit.disabled = false;
    }
    return;
  }

  // ---- Mode DÉMO local (back absent) ----
  if (mode === "signup") {
    if (users[key]) { authError.textContent = "Ce nom est déjà pris."; return; }
    const p = defaultProfile(name, pass);
    p.mail = authMail.value.trim();
    users[key] = p;
    saveUsers();
    startSession(key, true);
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
  // migration douce
  const u = data();
  if (u.xp === undefined) u.xp = 0;
  if (u.streak === undefined) u.streak = 0;
  if (u.lastDoneDay === undefined) u.lastDoneDay = null;
  if (!Array.isArray(u.tasks)) u.tasks = [];
  if (!Array.isArray(u.history)) u.history = [];
  if (u.nextId === undefined) u.nextId = 1;
  if (u.mail === undefined) u.mail = "";
  saveUsers();

  authName.value = ""; authPass.value = ""; authMail.value = "";
  authView.hidden = true;
  appView.hidden = false;
  if (isNew) log("add", "Compte créé");
  goTo("planning");
  refreshTopBar();
}

function logout() {
  current = null;
  localStorage.removeItem(SESSION_KEY);
  appView.hidden = true;
  authView.hidden = false;
  setMode("login");
}
document.getElementById("logoutBtn").onclick = logout;

/* =========================================================
   PONT VERS LE BACK GO
   ---------------------------------------------------------
   En mode LIVE : le serveur est la source de vérité pour
   l'XP, le niveau, le rang et les tâches. Le front charge
   ces données dans la structure locale `data()` puis se
   contente de les afficher.
   ========================================================= */
let LIVE = null;          // null = pas encore testé
let serverUserId = null;  // id de l'utilisateur côté serveur

async function isLive() {
  if (LIVE !== null) return LIVE;
  try { LIVE = await window.YboostApi.backendAlive(); }
  catch { LIVE = false; }
  return LIVE;
}

// Mappe un User serveur -> profil local affichable.
function applyServerUser(serverUser) {
  current = "srv:" + serverUser.id;
  serverUserId = serverUser.id;
  if (!users[current]) users[current] = defaultProfile(serverUser.name, "x");
  const u = users[current];
  u.display = serverUser.name;
  u.mail = serverUser.email || "";
  u.serverId = serverUser.id;
  u.xp = serverUser.exp ?? 0;
  u.lvl = serverUser.lvl ?? 0;
  u.expNext = serverUser.exp_next ?? serverUser.expNext ?? 100;
  u.rank = serverUser.rank || null;
  u.live = true;
}

// Recharge le profil serveur (XP/niveau à jour après une action).
async function syncProfile() {
  const { api } = window.YboostApi;
  try {
    const p = await api.profile(serverUserId);
    applyServerUser(p);
  } catch (e) { /* on garde l'état courant si l'appel échoue */ }
}

// Recharge toutes les tâches depuis le serveur dans data().tasks.
async function syncTasks() {
  const { api } = window.YboostApi;
  const all = await api.listAll(serverUserId);
  // on conserve la forme attendue par le planning local
  data().tasks = all.map((t) => ({
    id: t.id,
    title: t.title,
    desc: t.desc,
    day: t.day,
    start: t.start,
    durMin: t.durMin,
    xp: t.xp,
    priority: t.priority,
    dueDate: t.dueDate,
    done: t.done,
    doneAt: t.done ? Date.now() : null,
    gained: t.xp,
  }));
}

async function startServerSession(serverUser) {
  applyServerUser(serverUser);
  localStorage.setItem(SESSION_KEY, current);
  localStorage.setItem("yboost.srvid", String(serverUser.id));
  authName.value = ""; authPass.value = ""; authMail.value = "";
  authView.hidden = true;
  appView.hidden = false;
  await syncTasks();
  goTo("planning");
  refreshTopBar();
}


/* =========================================================
   HISTORIQUE (journal d'actions)
   ========================================================= */
function log(type, taskText) {
  data().history.unshift({ type, task: taskText, at: Date.now() });
  if (data().history.length > 300) data().history.length = 300;
  saveUsers();
}

/* =========================================================
   NAVIGATION ENTRE PAGES
   ========================================================= */
const PAGES = ["planning", "done", "profile", "leaderboard"];
function goTo(page) {
  document.querySelectorAll(".navtab").forEach((t) =>
    t.classList.toggle("is-active", t.dataset.page === page)
  );
  PAGES.forEach((p) => {
    const el = document.getElementById("page-" + p);
    if (el) el.hidden = p !== page;
  });
  if (page === "planning") renderPlanning();
  if (page === "done") renderDone();
  if (page === "profile") renderProfile();
  if (page === "leaderboard") renderLeaderboard();
}
document.querySelectorAll(".navtab").forEach((t) => {
  t.onclick = () => goTo(t.dataset.page);
});

/* =========================================================
   BARRE DU HAUT (niveau + XP)
   ========================================================= */
function refreshTopBar() {
  const u = data();
  const info = currentLevelInfo(u);
  const g = gradeFor(info.level);
  document.getElementById("hello").textContent = u.display;
  document.getElementById("topMedal").innerHTML = medalSVG(info.level, 34);
  document.getElementById("topLevel").textContent = "Niv. " + info.level;
  document.getElementById("topGrade").textContent = g.name;
  document.getElementById("topGrade").style.color = g.color;
  document.getElementById("topXpBar").style.width = info.pct + "%";
  document.getElementById("topXpBar").style.background = g.color;
  document.getElementById("topXpText").textContent = info.inLevel + " / " + info.need + " XP";
}

/* =========================================================
   XP : gain lors de la complétion d'une tâche
   ========================================================= */
const STREAK_BONUS = 0.1;     // +10% d'XP par jour de série
const STREAK_CAP = 1.0;       // bonus plafonné à +100%

function todayKey(d = new Date()) {
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function updateStreakOnComplete() {
  const u = data();
  const today = todayKey();
  if (u.lastDoneDay !== today) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (u.lastDoneDay === todayKey(y)) u.streak += 1;
    else u.streak = 1;
    u.lastDoneDay = today;
  }
}

function xpGain(baseXp) {
  const u = data();
  const mult = 1 + Math.min((u.streak - 1) * STREAK_BONUS, STREAK_CAP);
  return Math.round(baseXp * Math.max(1, mult));
}

/* =========================================================
   PLANNING HEBDOMADAIRE (style Hyperplanning)
   ========================================================= */
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOUR_START = 7;   // grille de 7h
const HOUR_END = 23;    // à 23h
const HOUR_PX = 52;     // hauteur d'une heure

function mondayOf(offset = 0) {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - dow + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function minutesFromStr(s) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function strFromMinutes(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function renderPlanning() {
  const monday = mondayOf(weekOffset);
  // libellé de semaine
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  document.getElementById("weekLabel").textContent =
    "Semaine du " + fmt(monday) + " au " + fmt(sunday);

  const grid = document.getElementById("planningGrid");
  grid.innerHTML = "";

  // colonne des heures
  const totalH = HOUR_END - HOUR_START;
  const timeCol = document.createElement("div");
  timeCol.className = "time-col";
  timeCol.innerHTML = '<div class="day-head"></div>';
  for (let h = HOUR_START; h < HOUR_END; h++) {
    const cell = document.createElement("div");
    cell.className = "hour-label";
    cell.style.height = HOUR_PX + "px";
    cell.textContent = h + "h";
    timeCol.appendChild(cell);
  }
  grid.appendChild(timeCol);

  const todayK = todayKey();

  DAYS.forEach((dayName, dayIdx) => {
    const col = document.createElement("div");
    col.className = "day-col";

    const date = new Date(monday); date.setDate(monday.getDate() + dayIdx);
    const isToday = todayKey(date) === todayK;

    const head = document.createElement("div");
    head.className = "day-head" + (isToday ? " is-today" : "");
    head.innerHTML = `<span class="day-name">${DAY_SHORT[dayIdx]}</span><span class="day-date">${date.getDate()}</span>`;
    col.appendChild(head);

    const body = document.createElement("div");
    body.className = "day-body";
    body.style.height = totalH * HOUR_PX + "px";

    // lignes d'heures
    for (let h = 0; h < totalH; h++) {
      const line = document.createElement("div");
      line.className = "hour-line";
      line.style.top = h * HOUR_PX + "px";
      body.appendChild(line);
    }

    // clic sur une zone vide -> créer une tâche à cette heure
    body.onclick = (e) => {
      if (e.target.closest(".event")) return;
      const rect = body.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const hour = HOUR_START + Math.floor(y / HOUR_PX);
      openTaskModal(null, dayIdx, strFromMinutes(hour * 60));
    };

    // événements du jour
    data().tasks.filter((t) => t.day === dayIdx).forEach((t) => {
      const startMin = minutesFromStr(t.start);
      const top = ((startMin - HOUR_START * 60) / 60) * HOUR_PX;
      const height = Math.max(26, (t.durMin / 60) * HOUR_PX - 4);
      const ev = document.createElement("div");
      ev.className = "event" + (t.done ? " done" : "");
      ev.style.top = top + "px";
      ev.style.height = height + "px";
      ev.innerHTML = `
        <div class="event-title">${escapeHtml(t.title)}</div>
        <div class="event-meta">${t.start} · +${t.xp} XP</div>`;
      ev.onclick = (e) => { e.stopPropagation(); openTaskModal(t); };
      body.appendChild(ev);
    });

    col.appendChild(body);
    grid.appendChild(col);
  });
}

document.getElementById("prevWeek").onclick = () => { weekOffset--; renderPlanning(); };
document.getElementById("nextWeek").onclick = () => { weekOffset++; renderPlanning(); };
document.getElementById("todayWeek").onclick = () => { weekOffset = 0; renderPlanning(); };
document.getElementById("addTaskBtn").onclick = () => openTaskModal(null, 0, "08:00");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* =========================================================
   MODALE TÂCHE (création / édition / détail)
   ========================================================= */
const modal = document.getElementById("taskModal");
const mTitle = document.getElementById("mTitle");
const mDesc = document.getElementById("mDesc");
const mDay = document.getElementById("mDay");
const mStart = document.getElementById("mStart");
const mDur = document.getElementById("mDur");
const mXp = document.getElementById("mXp");
const mPriority = document.getElementById("mPriority");
const xpEstimate = document.getElementById("xpEstimate");

// Même formule que le back (Create.go) : (durée/15) * 10 * priorité
function estimateXp() {
  const dur = Math.max(15, Number(mDur.value) || 60);
  const pri = Number(mPriority ? mPriority.value : 1) || 1;
  return Math.floor(dur / 15) * 10 * pri;
}
function refreshXpEstimate() {
  if (xpEstimate) xpEstimate.textContent = "Récompense estimée : +" + estimateXp() + " XP";
}
if (mDur) mDur.addEventListener("input", refreshXpEstimate);
if (mPriority) mPriority.addEventListener("change", refreshXpEstimate);
let editingId = null;

// remplir le menu déroulant des jours une fois
DAYS.forEach((d, i) => {
  const o = document.createElement("option");
  o.value = i; o.textContent = d;
  mDay.appendChild(o);
});

function openTaskModal(task, presetDay, presetStart) {
  editingId = task ? task.id : null;
  document.getElementById("modalTitle").textContent = task ? "Détail de la tâche" : "Nouvelle tâche";
  mTitle.value = task ? task.title : "";
  mDesc.value = task ? (task.desc || "") : "";
  mDay.value = task ? task.day : (presetDay ?? 0);
  mStart.value = task ? task.start : (presetStart ?? "08:00");
  mDur.value = task ? task.durMin : 60;
  mXp.value = task ? task.xp : 20;
  if (mPriority) mPriority.value = task ? (task.priority || 1) : 1;
  refreshXpEstimate();

  // bouton "terminer" seulement pour une tâche existante non faite
  const doneBtn = document.getElementById("mDone");
  const delBtn = document.getElementById("mDelete");
  if (task) {
    delBtn.hidden = false;
    // En mode live, terminer est définitif (le serveur n'a pas de "refaire").
    if (task.done) {
      doneBtn.hidden = LIVE === true; // pas de "refaire" en live
      doneBtn.textContent = "Marquer à refaire";
    } else {
      doneBtn.hidden = false;
      doneBtn.textContent = "Terminer (+XP)";
    }
  } else {
    doneBtn.hidden = true;
    delBtn.hidden = true;
  }
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; editingId = null; }
document.getElementById("mClose").onclick = closeModal;
document.getElementById("modalBackdrop").onclick = closeModal;

document.getElementById("mSave").onclick = async () => {
  const title = mTitle.value.trim();
  if (!title) { mTitle.focus(); return; }
  const day = Number(mDay.value);
  const start = mStart.value || "08:00";
  const durMin = Math.max(15, Number(mDur.value) || 60);
  const priority = Math.max(1, Number(mPriority ? mPriority.value : 1) || 1);

  // ---- LIVE : la tâche est créée côté serveur ----
  if (await isLive()) {
    // reconstruire la date réelle à partir du jour de la semaine affichée + heure
    const monday = mondayOf(weekOffset);
    const due = new Date(monday);
    due.setDate(monday.getDate() + day);
    const [h, m] = start.split(":").map(Number);
    due.setHours(h, m, 0, 0);

    const saveBtn = document.getElementById("mSave");
    saveBtn.disabled = true;
    try {
      if (editingId) {
        // pas d'édition côté back : on supprime puis recrée
        await window.YboostApi.api.deleteTask(editingId, serverUserId);
      }
      await window.YboostApi.api.createTask(serverUserId, {
        title, desc: mDesc.value.trim(), dueDateObj: due, durMin, priority,
      });
      await syncTasks();
      closeModal();
      renderPlanning();
      renderDone();
    } catch (err) {
      alert("Erreur : " + (err.message || "création impossible"));
    } finally {
      saveBtn.disabled = false;
    }
    return;
  }

  // ---- DÉMO local ----
  const payload = {
    title, desc: mDesc.value.trim(), day, start, durMin,
    priority,
    xp: Math.max(1, Number(mXp.value) || 10),
  };
  if (editingId) {
    const t = data().tasks.find((x) => x.id === editingId);
    Object.assign(t, payload);
    log("edit", t.title);
  } else {
    data().tasks.push({ id: data().nextId++, done: false, doneAt: null, ...payload });
    log("add", payload.title);
  }
  saveUsers();
  closeModal();
  renderPlanning();
};

document.getElementById("mDone").onclick = async () => {
  // ---- LIVE : le serveur valide et recalcule l'XP ----
  if (await isLive()) {
    const doneBtn = document.getElementById("mDone");
    doneBtn.disabled = true;
    try {
      await window.YboostApi.api.completeTask(editingId, serverUserId);
      await syncTasks();
      await syncProfile();
      closeModal();
      refreshTopBar();
      renderPlanning();
      renderDone();
      flyXp("✓");
    } catch (err) {
      alert("Erreur : " + (err.message || "impossible de terminer"));
    } finally {
      doneBtn.disabled = false;
    }
    return;
  }

  // ---- DÉMO local ----
  const t = data().tasks.find((x) => x.id === editingId);
  if (!t) return;
  if (!t.done) {
    t.done = true;
    t.doneAt = Date.now();
    updateStreakOnComplete();
    const gain = xpGain(t.xp);
    t.gained = gain;
    data().xp += gain;
    log("done", `+${gain} XP · ${t.title}`);
    flyXp(gain);
  } else {
    t.done = false;
    data().xp = Math.max(0, data().xp - (t.gained || 0));
    t.gained = 0;
    log("reopen", t.title);
  }
  saveUsers();
  closeModal();
  refreshTopBar();
  renderPlanning();
};

document.getElementById("mDelete").onclick = async () => {
  if (await isLive()) {
    const delBtn = document.getElementById("mDelete");
    delBtn.disabled = true;
    try {
      await window.YboostApi.api.deleteTask(editingId, serverUserId);
      await syncTasks();
      closeModal();
      renderPlanning();
      renderDone();
    } catch (err) {
      alert("Erreur : " + (err.message || "suppression impossible"));
    } finally {
      delBtn.disabled = false;
    }
    return;
  }
  const t = data().tasks.find((x) => x.id === editingId);
  if (t) log("delete", t.title);
  data().tasks = data().tasks.filter((x) => x.id !== editingId);
  saveUsers();
  closeModal();
  renderPlanning();
};

// petite animation d'XP qui monte
function flyXp(n) {
  const anchor = document.querySelector(".topbar");
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const c = document.createElement("div");
  c.className = "xp-fly";
  c.textContent = typeof n === "number" ? "+" + n + " XP" : String(n);
  c.style.left = r.left + r.width / 2 + "px";
  c.style.top = r.bottom - 10 + "px";
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 1100);
}

/* =========================================================
   PAGE : TÂCHES TERMINÉES
   ========================================================= */
function renderDone() {
  const u = data();
  const done = u.tasks.filter((t) => t.done)
    .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const list = document.getElementById("doneList");
  list.innerHTML = "";
  done.forEach((t) => {
    const li = document.createElement("li");
    li.className = "done-item";
    const when = t.doneAt
      ? new Date(t.doneAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
      : "—";
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
  document.getElementById("doneSummary").textContent =
    done.length ? `${done.length} tâche${done.length > 1 ? "s" : ""} · ${totalXp} XP gagnés` : "";
}

/* =========================================================
   PAGE : PROFIL
   ========================================================= */
function renderProfile() {
  const u = data();
  const info = currentLevelInfo(u);
  const g = gradeFor(info.level);
  document.getElementById("pMedal").innerHTML = medalSVG(info.level, 96);
  document.getElementById("pName").textContent = u.display;
  document.getElementById("pMail").textContent = u.mail || "—";
  document.getElementById("pGrade").textContent = g.name;
  document.getElementById("pGrade").style.color = g.color;
  document.getElementById("pLevel").textContent = info.level;
  document.getElementById("pStreak").textContent = u.streak + " j";
  document.getElementById("pTotalXp").textContent = u.xp + " XP";
  const doneCount = u.tasks.filter((t) => t.done).length;
  document.getElementById("pDone").textContent = doneCount;

  document.getElementById("pBar").style.width = info.pct + "%";
  document.getElementById("pBar").style.background = g.color;
  document.getElementById("pBarText").textContent =
    info.toNext + " XP avant le niveau " + (info.level + 1);

  // édition du mail
  const mailInput = document.getElementById("pMailInput");
  mailInput.value = u.mail || "";
}
document.getElementById("pSaveMail").onclick = async () => {
  if (await isLive()) {
    const note = document.getElementById("pSavedNote");
    note.textContent = "Modification du mail non disponible (gérée par le serveur).";
    note.style.opacity = "1";
    setTimeout(() => (note.style.opacity = "0"), 2500);
    return;
  }
  data().mail = document.getElementById("pMailInput").value.trim();
  saveUsers();
  renderProfile();
  const note = document.getElementById("pSavedNote");
  note.textContent = "Enregistré ✓";
  note.style.opacity = "1";
  setTimeout(() => (note.style.opacity = "0"), 1500);
};

/* =========================================================
   PAGE : LEADERBOARD
   ========================================================= */
async function renderLeaderboard() {
  const list = document.getElementById("lbList");

  // ---- LIVE : classement réel depuis le serveur ----
  if (await isLive()) {
    let entries = [];
    try { entries = await window.YboostApi.api.leaderboard(); }
    catch { entries = []; }
    const myName = (data() && data().display) || "";
    list.innerHTML = "";
    entries.forEach((e, i) => {
      const level = e.lvl ?? e.level ?? 0;
      const isMe = e.name === myName;
      const li = document.createElement("li");
      li.className = "lb-row" + (isMe ? " is-me" : "");
      const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
      li.innerHTML = `
        <span class="lb-rank ${rankClass}">${i + 1}</span>
        <span class="lb-medal">${medalSVG(level, 30)}</span>
        <div class="lb-info">
          <span class="lb-name">${escapeHtml(e.name)}${isMe ? " <em>(toi)</em>" : ""}</span>
          <span class="lb-grade">${gradeFor(level).name} · Niv. ${level}</span>
        </div>
        <span class="lb-xp">Niv. ${level}</span>`;
      list.appendChild(li);
    });
    document.getElementById("lbList").hidden = false;
    return;
  }

  // ---- DÉMO local ----
  const rows = Object.keys(users).map((k) => {
    const u = users[k];
    const info = levelInfo(u.xp || 0);
    return { key: k, name: u.display, xp: u.xp || 0, level: info.level, fake: !!u.fake };
  }).sort((a, b) => b.xp - a.xp);

  list.innerHTML = "";
  rows.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "lb-row" + (r.key === current ? " is-me" : "");
    const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
    li.innerHTML = `
      <span class="lb-rank ${rankClass}">${i + 1}</span>
      <span class="lb-medal">${medalSVG(r.level, 30)}</span>
      <div class="lb-info">
        <span class="lb-name">${escapeHtml(r.name)}${r.key === current ? " <em>(toi)</em>" : ""}</span>
        <span class="lb-grade">${gradeFor(r.level).name} · Niv. ${r.level}</span>
      </div>
      <span class="lb-xp">${r.xp} XP</span>`;
    list.appendChild(li);
  });
}

/* =========================================================
   DÉMARRAGE
   ========================================================= */
(async function init() {
  setMode("login");

  const live = await isLive();
  if (live) {
    // En mode live : on ne sème PAS de faux joueurs (le classement vient du serveur).
    const savedId = localStorage.getItem("yboost.srvid");
    if (savedId) {
      try {
        const p = await window.YboostApi.api.profile(Number(savedId));
        await startServerSession({
          id: p.id, name: p.name, email: p.email,
          lvl: p.lvl, exp: p.exp, exp_next: p.exp_next, rank: p.rank,
        });
        return;
      } catch { /* profil indisponible : on retombe sur l'écran de connexion */ }
    }
    authView.hidden = false;
    appView.hidden = true;
    return;
  }

  // ---- Mode DÉMO local ----
  seedFakePlayers();
  users = loadUsers();
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved && users[saved] && !users[saved].fake) {
    startSession(saved, false);
  } else {
    authView.hidden = false;
    appView.hidden = true;
  }
})();
