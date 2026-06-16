/* =========================================================
   api.js — pont entre le front Yboost et le back Go (Gin).
   Tout ce qui dépend du serveur (URL, noms de champs JSON)
   est rassemblé ici. Si le back change, on ne touche qu'ici.

   Contrats du back (lus dans Handelers.go / fetch.go) :
     POST /users/register      { name, email, password } -> { userID }
     POST /users/login         { identifier, password }  -> { user }
     GET  /users/:id/profile                              -> User
     DELETE /users/:id
     POST /tasks/              { user_id, name, description, due_date, duration, priority }
     GET  /tasks/user/:id                                 -> { tasks }  (état "todo")
     GET  /tasks/completed/:id                            -> { tasks }  (état "done")
     PUT  /tasks/:id/complete  { user_id }                -> XP recalculée côté serveur
     DELETE /tasks/:id?user_id=...
     GET  /leaderboard                                    -> { leaderboard:[{name,lvl}] }

   Important : l'XP, le niveau et le rang sont calculés par le
   SERVEUR. Le front ne fait que les afficher.
   ========================================================= */

const API_BASE = "http://localhost:3000";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body } = {}) {
  const opts = { method, headers: { Accept: "application/json" } };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(API_BASE + path, opts);
  } catch {
    throw new ApiError("Serveur injoignable (le back tourne sur :3000 ?)", 0);
  }
  if (res.status === 204) return null;

  const raw = await res.text();
  let data = null;
  if (raw) { try { data = JSON.parse(raw); } catch { data = raw; } }

  if (!res.ok) {
    const msg = (data && data.error) || `Erreur ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data;
}

// Le back attend une date SQL "YYYY-MM-DD HH:MM:SS".
function toSqlDate(jsDate) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    jsDate.getFullYear() + "-" + p(jsDate.getMonth() + 1) + "-" + p(jsDate.getDate()) +
    " " + p(jsDate.getHours()) + ":" + p(jsDate.getMinutes()) + ":00"
  );
}

// Convertit une tâche du back vers la forme attendue par le front.
// Back : { id, user_id, name, description, due_date, duration, priority, state, exp_reward }
function normalizeTask(t = {}) {
  const due = t.due_date ? new Date(t.due_date) : null;
  // jour de la semaine lundi=0 ... dimanche=6
  let day = 0, start = "08:00";
  if (due && !isNaN(due)) {
    day = (due.getDay() + 6) % 7;
    const p = (n) => String(n).padStart(2, "0");
    start = p(due.getHours()) + ":" + p(due.getMinutes());
  }
  return {
    id: t.id,
    userId: t.user_id,
    title: t.name ?? "",
    desc: t.description ?? "",
    dueDate: t.due_date ?? null,
    day,
    start,
    durMin: t.duration ?? 60,
    priority: t.priority ?? 1,
    xp: t.exp_reward ?? 0,
    done: t.state === "done",
  };
}

const api = {
  ApiError,
  base: API_BASE,

  // ---- Comptes ----
  register: (name, email, password) =>
    request("/users/register", { method: "POST", body: { name, email, password } }),

  login: (identifier, password) =>
    request("/users/login", { method: "POST", body: { identifier, password } }),

  // Renvoie l'objet User complet (lvl, exp, exp_next, rank, progress…)
  profile: (userId) => request(`/users/${userId}/profile`),

  deleteUser: (userId) => request(`/users/${userId}`, { method: "DELETE" }),

  // ---- Tâches ----
  async listTodo(userId) {
    const d = await request(`/tasks/user/${userId}`);
    return (d?.tasks || []).map(normalizeTask);
  },
  async listDone(userId) {
    const d = await request(`/tasks/completed/${userId}`);
    return (d?.tasks || []).map(normalizeTask);
  },
  // Toutes les tâches (todo + done), pour le planning.
  async listAll(userId) {
    const [todo, done] = await Promise.all([this.listTodo(userId), this.listDone(userId)]);
    return [...todo, ...done];
  },

  // Le back calcule lui-même l'exp_reward à partir de durée/priorité.
  createTask: (userId, { title, desc, dueDateObj, durMin, priority }) =>
    request("/tasks/", {
      method: "POST",
      body: {
        user_id: Number(userId),
        name: title,
        description: desc || "",
        due_date: toSqlDate(dueDateObj),
        duration: Number(durMin),
        priority: Number(priority) || 1,
      },
    }),

  // Terminer une tâche : le serveur met l'état à "done" ET recalcule l'XP/niveau.
  completeTask: (taskId, userId) =>
    request(`/tasks/${taskId}/complete`, { method: "PUT", body: { user_id: Number(userId) } }),

  deleteTask: (taskId, userId) =>
    request(`/tasks/${taskId}?user_id=${Number(userId)}`, { method: "DELETE" }),

  // ---- Classement ----
  async leaderboard() {
    const d = await request("/leaderboard");
    return d?.leaderboard || [];
  },
};

// Sonde le back une seule fois (mis en cache) pour décider live vs démo.
let _alive = null;
async function backendAlive() {
  if (_alive !== null) return _alive;
  try {
    await request("/leaderboard");
    _alive = true;
  } catch {
    _alive = false;
  }
  return _alive;
}

window.YboostApi = { api, backendAlive, toSqlDate };
