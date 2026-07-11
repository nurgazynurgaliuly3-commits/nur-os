const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { createStorage } = require("./lib/storage");
const { createMailer } = require("./lib/mailer");
const { buildDeployReport } = require("./lib/config");
const pkg = require("./package.json");

const root = path.resolve(__dirname);

loadEnvFile();
const port = Number(process.argv[2] || process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff"
};

const defaultState = {
  user: {
    name: "Нұр",
    age: 24,
    height: 176,
    gender: "male",
    activity: "moderate",
    theme: "light",
    salary: 420000,
    savingsGoal: 1200000,
    saved: 360000,
    monthlyBudget: 260000
  },
  finance: {
    incomeToday: 18000,
    expenseToday: 11200,
    mandatoryPayments: 84000,
    history: [
      { label: "Жалақы", amount: 420000, type: "income" },
      { label: "Пәтер", amount: 65000, type: "expense" },
      { label: "Тамақ", amount: 48000, type: "expense" },
      { label: "Көлік", amount: 18000, type: "expense" },
      { label: "Жинақ", amount: 70000, type: "saving" }
    ]
  },
  rituals: [
    { id: "wake", title: "Ерте тұру", done: true, streak: 12, target: "06:30" },
    { id: "water", title: "Су ішу", done: true, streak: 8, target: "2.5 л" },
    { id: "prayer", title: "Намаз", done: false, streak: 4, target: "5/5" },
    { id: "plan", title: "Жұмыс жоспары", done: true, streak: 15, target: "09:00" },
    { id: "book", title: "Кітап оқу", done: false, streak: 0, target: "20 бет" },
    { id: "workout", title: "Жаттығу", done: false, streak: 2, target: "18:00" },
    { id: "sleep", title: "Ұйқы", done: true, streak: 6, target: "23:30" }
  ],
  fitness: {
    weight: 67.4,
    targetWeight: 74,
    goal: "gain",
    experience: "beginner",
    daysPerWeek: 3,
    injuries: "Жоқ",
    sleep: 7,
    water: 1.7,
    supplements: "Креатин, протеин",
    dietLimits: "Жоқ",
    calories: 2860,
    missedWorkouts: 2,
    supplementTime: "20:30"
  },
  reminders: ["19:00 - жаттығуға сөмке дайындау", "21:30 - ертеңгі жоспарды бекіту"],
  chat: [
    {
      role: "ai",
      text: "Бүгін 5 минуттық режим: қаржы тұрақты, бірақ кітап пен жаттығуды қысқа форматта қайтарған дұрыс."
    }
  ]
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const storage = createStorage({ root, defaultState, clone, hashPassword, now, newId });
const mailer = createMailer({ root, now });
const rateBuckets = new Map();
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 120);
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 25);
const sessionTtlDays = Number(process.env.SESSION_TTL_DAYS || 30);
const tokenTtlMinutes = Number(process.env.AUTH_TOKEN_TTL_MINUTES || 30);
const exposeDevTokens = process.env.AUTH_EXPOSE_DEV_TOKENS !== "false";
const demoUserEnabled = process.env.NUROS_DEMO_USER_ENABLED === "true";

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, encoded) {
  const [salt, hash] = String(encoded || "").split(":");
  if (!salt || !hash) return false;
  const attempt = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), attempt);
}

function createPlainToken() {
  return crypto.randomBytes(24).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function tokenExpiresAt() {
  return new Date(Date.now() + tokenTtlMinutes * 60 * 1000).toISOString();
}

async function readDb() {
  return storage.readDb();
}

async function writeDb(db) {
  return storage.writeDb(db);
}

async function createBackup(reason) {
  return storage.backup(reason);
}

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim();
}

function ipHash(req) {
  return crypto.createHash("sha256").update(getClientIp(req)).digest("hex").slice(0, 24);
}

function checkRateLimit(req, pathname) {
  const key = `${getClientIp(req)}:${pathname}`;
  const authRoutes = new Set([
    "/api/login",
    "/api/register",
    "/api/verify-email/request",
    "/api/verify-email",
    "/api/password-reset/request",
    "/api/password-reset/confirm"
  ]);
  const limit = authRoutes.has(pathname) ? authRateLimitMax : rateLimitMax;
  const timestamp = Date.now();
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: timestamp + rateLimitWindowMs };
  if (timestamp > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = timestamp + rateLimitWindowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: new Date(bucket.resetAt).toISOString()
  };
}

async function auditEvent(req, action, userId, metadata = {}) {
  if (typeof storage.audit !== "function") return;
  try {
    await storage.audit({
      action,
      userId,
      route: req.url,
      method: req.method,
      ipHash: ipHash(req),
      metadata,
      createdAt: now()
    });
  } catch {
    // Audit logging must never block the user workflow.
  }
}

function sanitizeState(input) {
  const state = { ...clone(defaultState), ...(input || {}) };
  state.user = { ...clone(defaultState.user), ...(state.user || {}) };
  state.finance = { ...clone(defaultState.finance), ...(state.finance || {}) };
  state.fitness = { ...clone(defaultState.fitness), ...(state.fitness || {}) };
  state.rituals = Array.isArray(state.rituals) ? state.rituals.slice(0, 100) : clone(defaultState.rituals);
  state.reminders = Array.isArray(state.reminders) ? state.reminders.slice(0, 100) : clone(defaultState.reminders);
  state.chat = Array.isArray(state.chat) ? state.chat.slice(-200) : clone(defaultState.chat);
  state.finance.history = Array.isArray(state.finance.history) ? state.finance.history.slice(0, 1000) : clone(defaultState.finance.history);

  state.user.age = Math.max(10, Math.min(100, Number(state.user.age) || defaultState.user.age));
  state.user.height = Math.max(100, Math.min(230, Number(state.user.height) || defaultState.user.height));
  state.user.salary = Math.max(0, Number(state.user.salary) || 0);
  state.user.monthlyBudget = Math.max(0, Number(state.user.monthlyBudget) || 0);
  state.user.savingsGoal = Math.max(1, Number(state.user.savingsGoal) || 1);
  state.user.saved = Math.max(0, Number(state.user.saved) || 0);
  state.finance.incomeToday = Math.max(0, Number(state.finance.incomeToday) || 0);
  state.finance.expenseToday = Math.max(0, Number(state.finance.expenseToday) || 0);
  state.finance.mandatoryPayments = Math.max(0, Number(state.finance.mandatoryPayments) || 0);
  state.fitness.weight = Math.max(30, Math.min(250, Number(state.fitness.weight) || defaultState.fitness.weight));
  state.fitness.targetWeight = Math.max(30, Math.min(250, Number(state.fitness.targetWeight) || defaultState.fitness.targetWeight));
  state.fitness.daysPerWeek = Math.max(1, Math.min(6, Number(state.fitness.daysPerWeek) || 3));
  state.fitness.sleep = Math.max(0, Math.min(14, Number(state.fitness.sleep) || 7));
  state.fitness.water = Math.max(0, Math.min(10, Number(state.fitness.water) || 2));
  return state;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders()
  });
  res.end(JSON.stringify(payload));
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy":
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data:; " +
      "connect-src 'self' https://api.openai.com https://api.resend.com; " +
      "manifest-src 'self'; " +
      "base-uri 'self'; " +
      "form-action 'self'"
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

async function getAuthUser(req, db) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  if (isExpiredSession(session)) return null;
  const user = db.users.find((item) => item.id === session.userId);
  return user ? { user, token } : null;
}

function isExpiredSession(session) {
  const createdAt = Date.parse(session.createdAt || "");
  if (!Number.isFinite(createdAt)) return true;
  return Date.now() - createdAt > sessionTtlDays * 24 * 60 * 60 * 1000;
}

function pruneExpiredSessions(db) {
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((session) => !isExpiredSession(session));
  return before - db.sessions.length;
}

function publicUser(user) {
  return { id: user.id, email: user.email, emailVerified: Boolean(user.emailVerified), createdAt: user.createdAt };
}

function findUserByValidToken(db, token, fields) {
  const tokenHash = hashToken(token);
  const nowMs = Date.now();
  return db.users.find((user) => user[fields.hash] === tokenHash && Date.parse(user[fields.expiresAt] || "") > nowMs);
}

function buildCore(state) {
  const expenses = state.finance.history.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const income = state.finance.history.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const savingsProgress = Math.round((state.user.saved / Math.max(1, state.user.savingsGoal)) * 100);
  const freeCash = state.user.monthlyBudget - state.finance.mandatoryPayments - expenses;
  const foodBudget = Math.max(35000, Math.round(Math.max(0, freeCash) * 0.42));
  const ritualsDone = state.rituals.filter((ritual) => ritual.done).length;
  const ritualRate = Math.round((ritualsDone / Math.max(1, state.rituals.length)) * 100);
  const financeScore = Math.max(20, Math.min(95, Math.round(((income - expenses) / Math.max(1, income)) * 100)));
  const dayProgress = Math.round((ritualRate + Math.min(100, savingsProgress) + (state.fitness.missedWorkouts ? 55 : 85)) / 3);
  const insights = [];

  if (freeCash < 70000) insights.push("Еркін шығынды қысқарт: фитнес тамағын қарапайым, ақуызға бай рационмен жап.");
  if (state.fitness.missedWorkouts >= 2) insights.push("Екі жаттығу өткізіп алдың: бүгін 35 минуттық жеңіл full-body жаса.");
  if (state.rituals.some((ritual) => ritual.title === "Кітап оқу" && !ritual.done)) insights.push("Кітап оқу үшін бүгін 10 бет жеткілікті.");
  if (savingsProgress < 40) insights.push("Жинаққа автоматты 15% бөлу режимін сақта.");

  return {
    freeCash,
    foodBudget,
    savingsProgress,
    ritualRate,
    financeScore,
    dayProgress,
    advice: insights[0] || "Жүйе жақсы қалыпта: бүгін негізгі жоспарды бұзбай орында.",
    insights
  };
}

function buildAiPrompt(state, core, message) {
  return [
    "You are NurOS, a personal AI operating system assistant.",
    "Answer in Kazakh unless the user asks otherwise.",
    "Use finance, ritual, fitness, reminder, and savings context.",
    "Do not diagnose medical conditions. Do not prescribe medication.",
    "For supplements, give general planning/reminder guidance only.",
    "",
    `User message: ${message}`,
    `Free cash: ${core.freeCash} KZT`,
    `Food budget: ${core.foodBudget} KZT`,
    `Ritual completion: ${core.ritualRate}%`,
    `Savings progress: ${core.savingsProgress}%`,
    `Fitness goal: ${state.fitness.goal}`,
    `Weight: ${state.fitness.weight} kg, target: ${state.fitness.targetWeight} kg`,
    `Workout days per week: ${state.fitness.daysPerWeek}`,
    `Injuries/limits: ${state.fitness.injuries}`,
    `Supplements: ${state.fitness.supplements}`,
    "",
    "Give a concise proactive plan with 3-5 concrete steps."
  ].join("\n");
}

function fallbackAiAnswer(state, core) {
  return [
    `NurOS Core: ${core.advice}`,
    `Қаржы: бос қаражат ${core.freeCash} KZT, тамақ бюджеті ${core.foodBudget} KZT.`,
    `Ритуал: бүгінгі орындалу ${core.ritualRate}%.`,
    `Фитнес: мақсат ${state.fitness.goal}, аптасына ${state.fitness.daysPerWeek} күн жаттығу.`
  ].join(" ");
}

function parseReminderTime(reminder) {
  const match = String(reminder || "").match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function collectDueReminders(db, at = new Date()) {
  const hhmm = at.toTimeString().slice(0, 5);
  const day = at.toISOString().slice(0, 10);
  const due = [];
  for (const user of db.users) {
    const state = db.states[user.id] || clone(defaultState);
    for (const reminder of state.reminders || []) {
      if (parseReminderTime(reminder) === hhmm) {
        due.push({
          key: reminderDeliveryKey(user.id, reminder, day, hhmm),
          userId: user.id,
          email: user.email,
          reminder,
          dueAt: at.toISOString()
        });
      }
    }
  }
  return due;
}

function reminderDeliveryKey(userId, reminder, day, hhmm) {
  return crypto.createHash("sha256").update(`${userId}|${day}|${hhmm}|${reminder}`).digest("hex");
}

function requestTime(req) {
  const value = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("at");
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function undeliveredReminders(due) {
  if (!due.length || typeof storage.deliveredReminderKeys !== "function") return due;
  const delivered = new Set(await storage.deliveredReminderKeys(due.map((item) => item.key)));
  return due.filter((item) => !delivered.has(item.key));
}

async function recordDeliveredReminders(due) {
  if (!due.length || typeof storage.recordReminderDeliveries !== "function") return;
  await storage.recordReminderDeliveries(
    due.map((item) => ({
      key: item.key,
      userId: item.userId,
      reminder: item.reminder,
      dueAt: item.dueAt,
      deliveredAt: now()
    }))
  );
}

async function callAiProvider(state, core, message) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { provider: "local", answer: fallbackAiAnswer(state, core) };

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: buildAiPrompt(state, core, message),
      max_output_tokens: 500
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { provider: "local", answer: `${fallbackAiAnswer(state, core)} AI provider error: ${payload.error?.message || response.statusText}` };
  }
  const answer =
    payload.output_text ||
    payload.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n").trim() ||
    fallbackAiAnswer(state, core);
  return { provider: "openai", model, answer };
}

async function handleApi(req, res, pathname) {
  try {
    const rate = checkRateLimit(req, pathname);
    if (!rate.allowed) {
      res.setHeader("Retry-After", "60");
      await auditEvent(req, "rate_limit", null, { pathname });
      return sendJson(res, 429, { error: "Too many requests", resetAt: rate.resetAt });
    }

    const db = await readDb();
    const expiredSessions = pruneExpiredSessions(db);
    if (expiredSessions) await writeDb(db);
    const storageHealth = await storage.health();
    const mailerHealth = mailer.health();
    const aiProvider = process.env.OPENAI_API_KEY ? "openai" : "local";
    const deploy = buildDeployReport({ storageHealth, mailerHealth, exposeDevTokens, aiProvider });

    if (req.method === "GET" && pathname === "/api/live") {
      return sendJson(res, 200, {
        ok: true,
        service: "NurOS",
        version: pkg.version,
        timestamp: now()
      });
    }

    if (req.method === "GET" && pathname === "/api/ready") {
      return sendJson(res, deploy.ready ? 200 : 503, {
        ok: deploy.ready,
        service: "NurOS",
        version: pkg.version,
        deploy,
        timestamp: now()
      });
    }

    if (req.method === "GET" && pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "NurOS",
        version: pkg.version,
        aiProvider,
        deploy,
        features: {
          aiProvider,
          storageProvider: storageHealth.provider,
          emailProvider: mailerHealth.provider,
          emailConfigured: mailerHealth.configured,
          devTokensExposed: exposeDevTokens,
          demoUserEnabled,
          supabaseReady: storageHealth.provider === "supabase",
          pwaReady: true
        },
        storage: storageHealth.provider,
        email: mailerHealth,
        audit: storageHealth.audit,
        rateLimit: { windowMs: rateLimitWindowMs, max: rateLimitMax, authMax: authRateLimitMax },
        session: { ttlDays: sessionTtlDays, expiredPruned: expiredSessions },
        users: storageHealth.users,
        sessions: storageHealth.sessions,
        timestamp: now()
      });
    }

    if (req.method === "POST" && pathname === "/api/register") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const name = String(body.name || "Пайдаланушы").trim();
      if (!email || password.length < 6) return sendJson(res, 400, { error: "Email және кемінде 6 таңбалы password керек." });
      if (db.users.some((user) => user.email === email)) return sendJson(res, 409, { error: "Бұл email тіркелген." });

      const verificationToken = createPlainToken();
      const user = {
        id: newId(),
        email,
        passwordHash: hashPassword(password),
        emailVerified: false,
        verificationTokenHash: hashToken(verificationToken),
        verificationExpiresAt: tokenExpiresAt(),
        createdAt: now()
      };
      const token = crypto.randomBytes(32).toString("hex");
      const state = clone(defaultState);
      state.user.name = name;
      db.users.push(user);
      db.sessions.push({ token, userId: user.id, createdAt: now() });
      db.states[user.id] = sanitizeState(state);
      await writeDb(db);
      await mailer.sendAuthToken({ to: email, type: "email_verification", token: verificationToken, expiresAt: user.verificationExpiresAt });
      await auditEvent(req, "register", user.id, { email });
      return sendJson(res, 201, { token, user: publicUser(user), state: db.states[user.id], verificationToken: exposeDevTokens ? verificationToken : undefined });
    }

    if (req.method === "POST" && pathname === "/api/verify-email/request") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const user = db.users.find((item) => item.email === email);
      if (user && !user.emailVerified) {
        const verificationToken = createPlainToken();
        user.verificationTokenHash = hashToken(verificationToken);
        user.verificationExpiresAt = tokenExpiresAt();
        await writeDb(db);
        await mailer.sendAuthToken({ to: email, type: "email_verification", token: verificationToken, expiresAt: user.verificationExpiresAt });
        await auditEvent(req, "email_verification_request", user.id, { email });
        return sendJson(res, 200, { ok: true, verificationToken: exposeDevTokens ? verificationToken : undefined });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/api/verify-email") {
      const body = await readBody(req);
      const token = String(body.token || "").trim();
      const user = findUserByValidToken(db, token, { hash: "verificationTokenHash", expiresAt: "verificationExpiresAt" });
      if (!user) return sendJson(res, 400, { error: "Verification token is invalid or expired" });
      user.emailVerified = true;
      delete user.verificationTokenHash;
      delete user.verificationExpiresAt;
      await writeDb(db);
      await auditEvent(req, "email_verified", user.id);
      return sendJson(res, 200, { ok: true, user: publicUser(user) });
    }

    if (req.method === "POST" && pathname === "/api/password-reset/request") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const user = db.users.find((item) => item.email === email);
      if (user) {
        const resetToken = createPlainToken();
        user.resetTokenHash = hashToken(resetToken);
        user.resetExpiresAt = tokenExpiresAt();
        await writeDb(db);
        await mailer.sendAuthToken({ to: email, type: "password_reset", token: resetToken, expiresAt: user.resetExpiresAt });
        await auditEvent(req, "password_reset_request", user.id, { email });
        return sendJson(res, 200, { ok: true, resetToken: exposeDevTokens ? resetToken : undefined });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/api/password-reset/confirm") {
      const body = await readBody(req);
      const token = String(body.token || "").trim();
      const password = String(body.password || "");
      if (password.length < 6) return sendJson(res, 400, { error: "Password must be at least 6 characters" });
      const user = findUserByValidToken(db, token, { hash: "resetTokenHash", expiresAt: "resetExpiresAt" });
      if (!user) return sendJson(res, 400, { error: "Reset token is invalid or expired" });
      user.passwordHash = hashPassword(password);
      delete user.resetTokenHash;
      delete user.resetExpiresAt;
      db.sessions = db.sessions.filter((session) => session.userId !== user.id);
      await writeDb(db);
      await auditEvent(req, "password_reset_confirm", user.id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/api/login") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = db.users.find((item) => item.email === email);
      if (!user || !verifyPassword(password, user.passwordHash)) return sendJson(res, 401, { error: "Email немесе password қате." });
      const token = crypto.randomBytes(32).toString("hex");
      db.sessions.push({ token, userId: user.id, createdAt: now() });
      db.states[user.id] ||= clone(defaultState);
      await writeDb(db);
      await auditEvent(req, "login", user.id, { email });
      return sendJson(res, 200, { token, user: publicUser(user), state: db.states[user.id] });
    }

    const auth = await getAuthUser(req, db);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    if (req.method === "POST" && pathname === "/api/logout") {
      db.sessions = db.sessions.filter((session) => session.token !== auth.token);
      await writeDb(db);
      await auditEvent(req, "logout", auth.user.id);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && pathname === "/api/me") {
      return sendJson(res, 200, { user: publicUser(auth.user), state: db.states[auth.user.id] || clone(defaultState) });
    }

    if (req.method === "GET" && pathname === "/api/state") {
      return sendJson(res, 200, { state: db.states[auth.user.id] || clone(defaultState), core: buildCore(db.states[auth.user.id] || clone(defaultState)) });
    }

    if (req.method === "GET" && pathname === "/api/reminders/due") {
      const at = requestTime(req);
      const due = await undeliveredReminders(collectDueReminders(db, at).filter((item) => item.userId === auth.user.id));
      return sendJson(res, 200, { due, count: due.length, checkedAt: now() });
    }

    if (req.method === "GET" && pathname === "/api/activity") {
      const limit = Math.max(1, Math.min(100, Number(new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("limit")) || 30));
      const activity = typeof storage.activity === "function" ? await storage.activity(auth.user.id, limit) : [];
      return sendJson(res, 200, { activity, count: activity.length, checkedAt: now() });
    }

    if (req.method === "POST" && pathname === "/api/tick") {
      const at = requestTime(req);
      const due = await undeliveredReminders(collectDueReminders(db, at));
      await recordDeliveredReminders(due);
      await auditEvent(req, "reminder_tick", auth.user.id, { delivered: due.length });
      return sendJson(res, 200, { ok: true, due, count: due.length, checkedAt: now() });
    }

    if (req.method === "PUT" && pathname === "/api/state") {
      const body = await readBody(req);
      await createBackup("before-state-update");
      db.states[auth.user.id] = sanitizeState(body.state || clone(defaultState));
      await writeDb(db);
      await auditEvent(req, "state_update", auth.user.id);
      return sendJson(res, 200, { ok: true, state: db.states[auth.user.id], core: buildCore(db.states[auth.user.id]) });
    }

    if (req.method === "POST" && pathname === "/api/reminders") {
      const body = await readBody(req);
      const text = String(body.text || "").trim();
      if (!text) return sendJson(res, 400, { error: "Reminder text is required" });
      const state = sanitizeState(db.states[auth.user.id] || clone(defaultState));
      state.reminders.unshift(text);
      db.states[auth.user.id] = sanitizeState(state);
      await writeDb(db);
      await auditEvent(req, "reminder_create", auth.user.id, { hasTime: Boolean(parseReminderTime(text)) });
      return sendJson(res, 201, { ok: true, state: db.states[auth.user.id] });
    }

    if (req.method === "GET" && pathname === "/api/export") {
      const state = db.states[auth.user.id] || clone(defaultState);
      await auditEvent(req, "data_export", auth.user.id);
      return sendJson(res, 200, {
        exportedAt: now(),
        user: publicUser(auth.user),
        state,
        core: buildCore(state)
      });
    }

    if (req.method === "POST" && pathname === "/api/import") {
      const body = await readBody(req);
      const incomingState = body.state || body;
      if (!incomingState || typeof incomingState !== "object" || Array.isArray(incomingState)) {
        return sendJson(res, 400, { error: "Import requires a NurOS state object or export JSON." });
      }
      if (JSON.stringify(incomingState).length > 750_000) {
        return sendJson(res, 413, { error: "Import payload is too large." });
      }
      await createBackup("before-import");
      db.states[auth.user.id] = sanitizeState(incomingState);
      await writeDb(db);
      await auditEvent(req, "data_import", auth.user.id, {
        hasFinance: Boolean(incomingState.finance),
        hasFitness: Boolean(incomingState.fitness),
        hasRituals: Array.isArray(incomingState.rituals)
      });
      return sendJson(res, 200, { ok: true, state: db.states[auth.user.id], core: buildCore(db.states[auth.user.id]) });
    }

    if (req.method === "POST" && pathname === "/api/backup") {
      const backupPath = await createBackup("manual");
      await auditEvent(req, "backup_create", auth.user.id, { provider: storage.provider });
      return sendJson(res, 200, { ok: true, backup: backupPath ? path.basename(backupPath) : null });
    }

    if (req.method === "DELETE" && pathname === "/api/account") {
      await createBackup("before-account-delete");
      await auditEvent(req, "account_delete", auth.user.id);
      db.users = db.users.filter((user) => user.id !== auth.user.id);
      db.sessions = db.sessions.filter((session) => session.userId !== auth.user.id);
      delete db.states[auth.user.id];
      await writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && pathname === "/api/ai/chat") {
      const body = await readBody(req);
      const state = db.states[auth.user.id] || clone(defaultState);
      const core = buildCore(state);
      const message = String(body.message || "").trim();
      if (!message) return sendJson(res, 400, { error: "Message is required" });
      const ai = await callAiProvider(state, core, message);
      state.chat ||= [];
      state.chat.push({ role: "user", text: message });
      state.chat.push({ role: "ai", text: ai.answer });
      db.states[auth.user.id] = state;
      await writeDb(db);
      await auditEvent(req, "ai_chat", auth.user.id, { provider: ai.provider, model: ai.model || "local" });
      return sendJson(res, 200, { answer: ai.answer, provider: ai.provider, model: ai.model, state, core });
    }
    return sendJson(res, 404, { error: "API route not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Server error" });
  }
}

function serveStatic(req, res, pathname) {
  const safePath = path.normalize(pathname === "/" ? "index.html" : pathname).replace(/^[/\\]+/, "");
  const filePath = path.resolve(root, safePath);

  if (!filePath.toLowerCase().startsWith(root.toLowerCase())) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
      ...securityHeaders()
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname);
    return;
  }
  serveStatic(req, res, pathname);
});

storage.init().then(() => {
  server.listen(port, () => {
    console.log(`NurOS running at http://localhost:${port}`);
    if (demoUserEnabled) console.log("Demo login: demo@nuros.local / nuros123");
  });
});
