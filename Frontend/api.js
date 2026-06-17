// api.js
// Tout ce qui touche au serveur passe par ici. Si une route ou un nom de
// champ change côté Go, c'est le seul fichier à modifier.

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
// passe d'une tâche serveur à la forme qu'attend le planning
function normalizeTask(t = {}) {
  const rawDate = t.due_date || t.start_time; 
  
  // Remplacement de l'espace par un "T" pour éviter le bug "Invalid Date"
  let cleanDate = rawDate ? rawDate.replace(" ", "T").substring(0, 19) : null;
  const due = cleanDate ? new Date(cleanDate) : null;
  
  let day = 0, start = "00:00";
  // Si la date est valide, on calcule correctement le jour de la semaine
  if (due && !isNaN(due)) {
    day = (due.getDay() + 6) % 7; // lundi = 0, dimanche = 6
    const p = (n) => String(n).padStart(2, "0");
    start = p(due.getHours()) + ":" + p(due.getMinutes());
  }
  
  return {
    id: t.id,
    userId: t.user_id,
    title: t.name ?? "",
    desc: t.description ?? "",
    dueDate: rawDate ?? null,
    day,
    start,
    durMin: t.duration ?? 60,
    priority: t.priority ?? 1,
    xp: t.exp_reward ?? 0,
    done: t.state === "done",
    isRecurring: !!t.start_time 
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
  async listRecurring(userId) {
    const d = await request(`/tasks/recurring/${userId}`);
    return (d?.recurring_tasks || []).map(normalizeTask);
  },
  // todo + done, pour remplir le planning
  async listAll(userId) {
    const [todo, done] = await Promise.all([this.listTodo(userId), this.listDone(userId)]);
    return [...todo, ...done];
  },

createTask: (userId, { title, desc, dueDateObjs, durMin, priority, recurring }) =>
    request("/tasks/", {
      method: "POST",
      body: {
        user_id: Number(userId),
        name: title,
        description: desc || "",
        due_dates: dueDateObjs.map(toSqlDate), // On map bien le tableau de dates ici !
        duration: Number(durMin),
        priority: Number(priority) || 1,
        recurring: !!recurring
      },
    }),

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