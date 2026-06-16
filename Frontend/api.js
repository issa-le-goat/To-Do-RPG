// api.js
// Tout ce qui touche au serveur passe par ici. Si une route ou un nom de
// champ change côté Go, c'est le seul fichier à modifier.
//
// Rappel des routes du back (cf Handelers.go / fetch.go) :
//   POST /users/register      { name, email, password }
//   POST /users/login         { identifier, password }
//   GET  /users/:id/profile
//   POST /tasks/              { user_id, name, description, due_date, duration, priority }
//   GET  /tasks/user/:id      -> tâches "todo"
//   GET  /tasks/completed/:id -> tâches "done"
//   PUT  /tasks/:id/complete  { user_id }   (le serveur recalcule l'XP)
//   DELETE /tasks/:id?user_id=...
//   GET  /leaderboard
//
// À retenir : l'XP, le niveau et le rang viennent du serveur, le front se
// contente de les afficher.

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

// format que MySQL veut : "YYYY-MM-DD HH:MM:SS"
function toSqlDate(jsDate) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    jsDate.getFullYear() + "-" + p(jsDate.getMonth() + 1) + "-" + p(jsDate.getDate()) +
    " " + p(jsDate.getHours()) + ":" + p(jsDate.getMinutes()) + ":00"
  );
}

// passe d'une tâche serveur à la forme qu'attend le planning
// Back : { id, user_id, name, description, due_date, duration, priority, state, exp_reward }
function normalizeTask(t = {}) {
  const due = t.due_date ? new Date(t.due_date) : null;
  // lundi = 0, dimanche = 6
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

  // profil complet du joueur (niveau, xp, rang...)
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
  // todo + done, pour remplir le planning
  async listAll(userId) {
    const [todo, done] = await Promise.all([this.listTodo(userId), this.listDone(userId)]);
    return [...todo, ...done];
  },

  // pas besoin d'envoyer l'xp : le serveur la calcule (durée x priorité)
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

  // le serveur passe la tâche en "done" et met l'xp à jour
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

// on teste le back une fois et on garde le résultat (live ou démo)
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
