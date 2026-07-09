const STORAGE_KEY = "nuros.state.v4";
const AUTH_KEY = "nuros.auth.v1";

const seedState = {
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
      text: "Қош келдіңіз. Мен қаржы, ритуал және фитнес деректерін біріктіріп, бүгін не істеу керегін қысқа ұсынамын."
    }
  ]
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const byId = (id) => document.getElementById(id);
const icon = (name, extra = "") => `<span class="material-symbols-outlined ${extra}">${name}</span>`;
const numberValue = (form, name) => Number(new FormData(form).get(name) || 0);
const textValue = (form, name) => String(new FormData(form).get(name) || "").trim();
const formatKzt = (amount) =>
  new Intl.NumberFormat("kk-KZ", { style: "currency", currency: "KZT", maximumFractionDigits: 0 }).format(amount || 0);

let state = loadLocalState();
let session = loadSession();
let activeView = "dashboard";
let authMode = "login";
let notice = "";
let healthStatus = null;
let activityItems = [];
let syncStatus = session ? "Синхрондау дайын" : "Жергілікті режим";

function loadLocalState() {
  try {
    return { ...clone(seedState), ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return clone(seedState);
  }
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "API error");
  return payload;
}

function persist({ remote = true } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (remote && session?.token) {
    syncStatus = "Сақталып жатыр...";
    api("/api/state", { method: "PUT", body: JSON.stringify({ state }) })
      .then(() => {
        syncStatus = "Серверге сақталды";
        render();
      })
      .catch((error) => {
        syncStatus = `Sync error: ${error.message}`;
        render();
      });
  }
}

async function bootstrap() {
  if (!session?.token) {
    try {
      healthStatus = await api("/api/health");
    } catch {
      healthStatus = null;
    }
    render();
    return;
  }
  try {
    healthStatus = await api("/api/health");
    const activityPayload = await api("/api/activity?limit=12");
    activityItems = activityPayload.activity || [];
    const payload = await api("/api/me");
    session.user = payload.user;
    state = { ...clone(seedState), ...(payload.state || {}) };
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncStatus = "Серверден жүктелді";
  } catch {
    session = null;
    localStorage.removeItem(AUTH_KEY);
    syncStatus = "Қайта кіріңіз";
  }
  render();
}

async function refreshHealth() {
  try {
    healthStatus = await api("/api/health");
    syncStatus = healthStatus.deploy?.ready ? "Diagnostics ready" : "Diagnostics warning";
  } catch (error) {
    syncStatus = `Diagnostics error: ${error.message}`;
  }
  render();
}

async function refreshActivity() {
  try {
    const payload = await api("/api/activity?limit=12");
    activityItems = payload.activity || [];
    syncStatus = activityItems.length ? "Activity loaded" : "No activity yet";
  } catch (error) {
    syncStatus = `Activity error: ${error.message}`;
  }
  render();
}

const activityFactor = { low: 1.2, moderate: 1.45, high: 1.7 };

function buildFitnessPlan(current, core) {
  const fitness = current.fitness;
  const user = current.user;
  const bmr =
    user.gender === "female"
      ? 10 * fitness.weight + 6.25 * user.height - 5 * user.age - 161
      : 10 * fitness.weight + 6.25 * user.height - 5 * user.age + 5;
  const maintenance = Math.round(bmr * (activityFactor[user.activity] || 1.45));
  const goalDelta = fitness.goal === "gain" ? 320 : fitness.goal === "lose" ? -420 : 0;
  const calories = Math.max(1500, maintenance + goalDelta);
  const protein = Math.round(fitness.weight * (fitness.goal === "gain" ? 1.8 : 2));
  const fat = Math.round(fitness.weight * 0.9);
  const carbs = Math.max(120, Math.round((calories - protein * 4 - fat * 9) / 4));
  const direction =
    fitness.goal === "gain"
      ? "салмақ қосу үшін калория профициті"
      : fitness.goal === "lose"
        ? "салмақ азайту үшін жұмсақ дефицит"
        : "салмақты ұстап тұру";
  const split =
    Number(fitness.daysPerWeek) >= 4
      ? [
          ["Дүйсенбі", "Кеуде + трицепс"],
          ["Сейсенбі", "Арқа + бицепс"],
          ["Бейсенбі", "Аяқ + core"],
          ["Сенбі", "Иық + жеңіл кардио"]
        ]
      : [
          ["Дүйсенбі", "Full body: squat + push"],
          ["Сәрсенбі", "Арқа + аяқ + core"],
          ["Жұма", "Кеуде + иық + қол"]
        ];
  const nutrition =
    core.foodBudget < 60000
      ? "үнемді рацион: жұмыртқа, сұлы, күріш, тауық, сүзбе, банан"
      : "кең рацион: ет/тауық/балық, күрделі көмірсу, көкөніс, сүзбе, жаңғақ";
  const safety =
    fitness.injuries && fitness.injuries.toLowerCase() !== "жоқ"
      ? "Жарақат немесе шектеу көрсетілген: ауыр салмақты бірден көтерме, ауырсыну болса маманға қарал."
      : "Жарақат көрсетілмеген: техниканы бірінші орынға қой, салмақты біртіндеп арттыр.";

  return { maintenance, calories, protein, fat, carbs, direction, split, nutrition, safety };
}

function aiCore(current) {
  const expenses = current.finance.history.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const income = current.finance.history.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const savingsProgress = Math.round((current.user.saved / Math.max(1, current.user.savingsGoal)) * 100);
  const freeCash = current.user.monthlyBudget - current.finance.mandatoryPayments - expenses;
  const foodBudget = Math.max(35000, Math.round(Math.max(0, freeCash) * 0.42));
  const ritualsDone = current.rituals.filter((ritual) => ritual.done).length;
  const ritualRate = Math.round((ritualsDone / Math.max(1, current.rituals.length)) * 100);
  const weakRituals = current.rituals.filter((ritual) => !ritual.done).map((ritual) => ritual.title);
  const financeScore = Math.max(20, Math.min(95, Math.round(((income - expenses) / Math.max(1, income)) * 100)));
  const dayProgress = Math.round((ritualRate + Math.min(100, savingsProgress) + (current.fitness.missedWorkouts ? 55 : 85)) / 3);
  const insights = [];

  if (freeCash < 70000) insights.push("Еркін шығынды қысқарт: фитнес тамағын қарапайым, ақуызға бай рационмен жап.");
  if (current.fitness.missedWorkouts >= 2) insights.push("Екі жаттығу өткізіп алдың: бүгін 35 минуттық жеңіл full-body жаса.");
  if (weakRituals.includes("Кітап оқу")) insights.push("Кітап оқу үшін бүгін 10 бет жеткілікті.");
  if (savingsProgress < 40) insights.push("Жинаққа автоматты 15% бөлу режимін сақта.");

  const core = { freeCash, foodBudget, savingsProgress, ritualRate, weakRituals, dayProgress, financeScore };
  core.fitnessPlan = buildFitnessPlan(current, core);
  core.advice = insights[0] || "Жүйе жақсы қалыпта: бүгін негізгі жоспарды бұзбай орында.";
  core.insights = insights;
  return core;
}

const progress = (value) => `<div class="progress" aria-label="${value}%"><span style="width:${Math.min(100, Math.max(0, value))}%"></span></div>`;
const stat = (label, value, meta = "") => `<article class="stat"><span>${label}</span><strong>${value}</strong>${meta ? `<small>${meta}</small>` : ""}</article>`;
const field = (label, name, value, type = "text", attrs = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${value ?? ""}" ${attrs} /></label>`;
const selectField = (label, name, value, options) =>
  `<label class="field"><span>${label}</span><select name="${name}">${options
    .map(([val, text]) => `<option value="${val}" ${val === value ? "selected" : ""}>${text}</option>`)
    .join("")}</select></label>`;

async function submitAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (authMode === "reset") return submitPasswordReset(form);
  const endpoint = authMode === "register" ? "/api/register" : "/api/login";
  notice = "Күте тұрыңыз...";
  render();
  try {
    const payload = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({
        name: textValue(form, "name"),
        email: textValue(form, "email"),
        password: textValue(form, "password")
      })
    });
    session = { token: payload.token, user: payload.user };
    state = { ...clone(seedState), ...(payload.state || {}) };
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notice = "";
    if (payload.verificationToken) syncStatus = `Verification token: ${payload.verificationToken}`;
    syncStatus = "Серверге қосылды";
    if (payload.verificationToken) syncStatus = `Verification token: ${payload.verificationToken}`;
  } catch (error) {
    notice = error.message;
  }
  render();
}

function setAuthMode(mode) {
  authMode = mode;
  notice = "";
  render();
}

async function submitPasswordReset(form) {
  notice = "Requesting reset token...";
  render();
  try {
    const email = textValue(form, "email");
    const first = await api("/api/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    const token = first.resetToken || textValue(form, "token");
    if (!token) {
      notice = "Reset requested. Check email when delivery is configured.";
      render();
      return;
    }
    await api("/api/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password: textValue(form, "password") })
    });
    authMode = "login";
    notice = "Password reset complete. Sign in with the new password.";
  } catch (error) {
    notice = error.message;
  }
  render();
}

async function logout() {
  try {
    if (session?.token) await api("/api/logout", { method: "POST" });
  } catch {
    // Local logout still clears the session.
  }
  session = null;
  localStorage.removeItem(AUTH_KEY);
  render();
}

function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  state.user = {
    ...state.user,
    name: textValue(form, "name") || state.user.name,
    age: numberValue(form, "age"),
    height: numberValue(form, "height"),
    gender: textValue(form, "gender"),
    activity: textValue(form, "activity")
  };
  persist();
  render();
}

function saveFinance(event) {
  event.preventDefault();
  const form = event.currentTarget;
  state.user.salary = numberValue(form, "salary");
  state.user.monthlyBudget = numberValue(form, "monthlyBudget");
  state.user.savingsGoal = numberValue(form, "savingsGoal");
  state.user.saved = numberValue(form, "saved");
  state.finance.incomeToday = numberValue(form, "incomeToday");
  state.finance.expenseToday = numberValue(form, "expenseToday");
  state.finance.mandatoryPayments = numberValue(form, "mandatoryPayments");
  persist();
  render();
}

function addTransaction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const label = textValue(form, "label");
  const amount = numberValue(form, "amount");
  const type = textValue(form, "type");
  if (!label || !amount) return;
  state.finance.history.unshift({ label, amount, type, createdAt: new Date().toISOString() });
  persist();
  render();
}

function saveFitness(event) {
  event.preventDefault();
  const form = event.currentTarget;
  state.fitness = {
    ...state.fitness,
    weight: numberValue(form, "weight"),
    targetWeight: numberValue(form, "targetWeight"),
    goal: textValue(form, "goal"),
    experience: textValue(form, "experience"),
    daysPerWeek: numberValue(form, "daysPerWeek"),
    injuries: textValue(form, "injuries") || "Жоқ",
    sleep: numberValue(form, "sleep"),
    water: numberValue(form, "water"),
    supplements: textValue(form, "supplements"),
    dietLimits: textValue(form, "dietLimits") || "Жоқ",
    supplementTime: textValue(form, "supplementTime") || "20:30"
  };
  state.fitness.calories = aiCore(state).fitnessPlan.calories;
  persist();
  render();
}

function addRitual(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const title = textValue(form, "title");
  if (!title) return;
  state.rituals.push({ id: `ritual-${Date.now()}`, title, target: textValue(form, "target"), done: false, streak: 0 });
  persist();
  render();
}

function toggleRitual(id) {
  state.rituals = state.rituals.map((ritual) =>
    ritual.id === id ? { ...ritual, done: !ritual.done, streak: ritual.done ? Math.max(0, ritual.streak - 1) : ritual.streak + 1 } : ritual
  );
  persist();
  render();
}

function setTheme(theme) {
  state.user.theme = theme;
  persist();
  render();
}

async function addChat(event) {
  event.preventDefault();
  const input = event.currentTarget.querySelector("input, textarea");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  if (session?.token) {
    try {
      const payload = await api("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: text }) });
      state = { ...clone(seedState), ...(payload.state || state) };
    } catch {
      pushLocalChat(text);
    }
  } else {
    pushLocalChat(text);
  }
  persist({ remote: false });
  activeView = "chat";
  render();
}

function pushLocalChat(text) {
  const core = aiCore(state);
  state.chat.push({ role: "user", text });
  state.chat.push({
    role: "ai",
    text: `Контекст бойынша: бос қаражат ${formatKzt(core.freeCash)}, фитнес калориясы ${core.fitnessPlan.calories} kcal, ритуал ${core.ritualRate}%. Ұсыныс: ${core.advice}`
  });
}

function setView(view) {
  activeView = view;
  render();
}

function renderDashboard(core) {
  return `
    <div class="welcome-row">
      <div><h3>Қайырлы күн, ${state.user.name}</h3><p>${syncStatus}</p></div>
      <button class="primary-action" type="button" onclick="setView('fitness')">${icon("add")}Дерек енгізу</button>
    </div>
    <section class="dashboard-grid">
      <article class="panel ai-panel"><div class="ai-watermark">${icon("auto_awesome")}</div><div><div class="panel-kicker">${icon("bolt")}AI кеңесі</div><h2>"${core.advice}"</h2></div></article>
      <article class="panel progress-panel"><div class="progress-ring" style="--value:${core.dayProgress}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"></circle><circle cx="50" cy="50" r="40"></circle></svg><strong>${core.dayProgress}%</strong></div><h3>Күндік прогресс</h3><p>${state.rituals.filter((ritual) => ritual.done).length}/${state.rituals.length} ритуал</p></article>
      <article class="panel finance-snapshot"><div class="panel-head"><h3>${icon("account_balance_wallet")}Қаржы</h3><span>Осы айда</span></div><div class="money-block"><span>Бос қаражат</span><strong>${formatKzt(core.freeCash)}</strong></div><div class="bar-chart"><span style="height:50%"></span><span style="height:74%"></span><span class="hot" style="height:100%"></span><span style="height:66%"></span><span style="height:50%"></span><span style="height:80%"></span><span class="blue" style="height:34%"></span></div></article>
      <article class="panel rituals-snapshot"><div class="panel-head"><h3>${icon("star")}Ритуалдар</h3></div>${state.rituals.slice(2, 5).map((ritual) => `<div class="ritual-line"><div><span>${ritual.title}</span><strong>${ritual.done ? "done" : ritual.target}</strong></div>${progress(ritual.done ? 100 : Math.min(80, ritual.streak * 12))}</div>`).join("")}</article>
      <article class="panel fitness-snapshot"><div class="panel-head"><h3>${icon("fitness_center")}Фитнес</h3></div><div class="workout-callout"><strong>${core.fitnessPlan.direction}</strong><span>${icon("local_fire_department", "mini")}${core.fitnessPlan.calories} kcal</span></div><button class="secondary-action" type="button" onclick="setView('fitness')">Жоспарды көру</button></article>
      <article class="panel reminders"><div class="panel-head"><h3>${icon("priority_high")}Еске салғыштар</h3></div><div class="reminder-list">${state.reminders.map((item, index) => `<button type="button"><span></span><strong>${item}</strong>${index === 0 ? "<em>жоғары</em>" : ""}</button>`).join("")}<button type="button"><span></span><strong>Қоспа уақыты: ${state.fitness.supplementTime}</strong>${icon("more_vert")}</button></div></article>
    </section>`;
}

function renderFinance(core) {
  return `
    <section class="module-grid">
      <article class="panel wide"><div class="panel-head"><h2>Жеке қаржы</h2><span>AI score ${core.financeScore}%</span></div><form class="form-grid" onsubmit="saveFinance(event)">
        ${field("Айлық жалақы", "salary", state.user.salary, "number")}
        ${field("Айлық бюджет", "monthlyBudget", state.user.monthlyBudget, "number")}
        ${field("Міндетті төлемдер", "mandatoryPayments", state.finance.mandatoryPayments, "number")}
        ${field("Бүгінгі кіріс", "incomeToday", state.finance.incomeToday, "number")}
        ${field("Бүгінгі шығыс", "expenseToday", state.finance.expenseToday, "number")}
        ${field("Жинақ мақсаты", "savingsGoal", state.user.savingsGoal, "number")}
        ${field("Жиналған ақша", "saved", state.user.saved, "number")}
        <button class="primary-action" type="submit">${icon("save")}Сақтау</button>
      </form></article>
      <article class="panel"><h3>Қысқаша есеп</h3><div class="stats-grid single">${stat("Бос қаражат", formatKzt(core.freeCash))}${stat("Fitness тамақ бюджеті", formatKzt(core.foodBudget))}${stat("Жинақ", `${core.savingsProgress}%`)}</div></article>
      <article class="panel"><h3>Транзакция қосу</h3><form class="stack-form" onsubmit="addTransaction(event)">${field("Атауы", "label", "")}${field("Сома", "amount", "", "number")}${selectField("Түрі", "type", "expense", [["expense", "Шығыс"], ["income", "Кіріс"], ["saving", "Жинақ"]])}<button class="secondary-action" type="submit">Қосу</button></form></article>
      <article class="panel wide"><div class="panel-head"><h3>Қаржы тарихы</h3><span>соңғы жазбалар</span></div><div class="timeline">${state.finance.history.slice(0, 8).map((item) => `<div><span>${item.label}</span><strong>${formatKzt(item.amount)}</strong><small>${item.type}</small></div>`).join("")}</div></article>
      <article class="panel"><h3>AI аналитика</h3><p>Еркін лимит: ${formatKzt(Math.max(3500, Math.round(core.freeCash / 21)))} / күн. Тамақ бюджеті фитнес жоспарына автоматты берілді.</p></article>
    </section>`;
}

function renderRituals(core) {
  return `
    <section class="module-grid">
      <article class="panel wide"><div class="panel-head"><h2>Ритуалдар</h2><span>${core.ritualRate}% бүгін орындалды</span></div><div class="ritual-grid">${state.rituals.map((ritual) => `<button class="ritual ${ritual.done ? "is-done" : ""}" onclick="toggleRitual('${ritual.id}')"><span>${ritual.done ? "✓" : ""}</span><strong>${ritual.title}</strong><small>${ritual.target} · ${ritual.streak} күн</small></button>`).join("")}</div></article>
      <article class="panel"><h3>Жаңа ритуал</h3><form class="stack-form" onsubmit="addRitual(event)">${field("Ритуал атауы", "title", "")}${field("Мақсат/уақыт", "target", "")}<button class="secondary-action" type="submit">Қосу</button></form></article>
      <article class="panel"><h3>AI ұсынысы</h3><p>Жиі орындалмай тұрғандары: ${core.weakRituals.join(", ") || "жоқ"}. Ертең ең әлсіз ритуалды таңертеңгі тыныш слотқа қой.</p></article>
    </section>`;
}

function renderFitness(core) {
  const plan = core.fitnessPlan;
  return `
    <section class="module-grid">
      <article class="panel wide"><div class="panel-head"><h2>Personal Fitness Intake</h2><span>жеке жоспар генераторы</span></div>
        <form class="form-grid" onsubmit="saveProfile(event)">
          ${field("Атыңыз", "name", state.user.name)}
          ${field("Жас", "age", state.user.age, "number")}
          ${field("Бой", "height", state.user.height, "number")}
          ${selectField("Жыныс", "gender", state.user.gender, [["male", "Ер"], ["female", "Әйел"]])}
          ${selectField("Белсенділік", "activity", state.user.activity, [["low", "Төмен"], ["moderate", "Орташа"], ["high", "Жоғары"]])}
          <button class="primary-action" type="submit">${icon("save")}Профильді сақтау</button>
        </form>
        <form class="form-grid separated" onsubmit="saveFitness(event)">
          ${field("Қазіргі салмақ", "weight", state.fitness.weight, "number", "step='0.1'")}
          ${field("Мақсат салмақ", "targetWeight", state.fitness.targetWeight, "number", "step='0.1'")}
          ${selectField("Мақсат", "goal", state.fitness.goal, [["gain", "Салмақ қосу"], ["lose", "Салмақ азайту"], ["maintain", "Ұстап тұру"]])}
          ${selectField("Тәжірибе", "experience", state.fitness.experience, [["beginner", "Бастаушы"], ["intermediate", "Орташа"], ["advanced", "Тәжірибелі"]])}
          ${field("Зал күні / апта", "daysPerWeek", state.fitness.daysPerWeek, "number", "min='1' max='6'")}
          ${field("Жарақат/шектеу", "injuries", state.fitness.injuries)}
          ${field("Ұйқы сағаты", "sleep", state.fitness.sleep, "number", "step='0.5'")}
          ${field("Су, литр", "water", state.fitness.water, "number", "step='0.1'")}
          ${field("Қоспалар / БАД", "supplements", state.fitness.supplements)}
          ${field("Тамақ шектеуі", "dietLimits", state.fitness.dietLimits)}
          ${field("Қоспа уақыты", "supplementTime", state.fitness.supplementTime, "time")}
          <button class="primary-action" type="submit">${icon("auto_awesome")}Жоспар құру</button>
        </form>
      </article>
      <article class="panel"><h3>AI қорытынды</h3><div class="stats-grid single">${stat("Бағыт", plan.direction)}${stat("Калория", `${plan.calories} kcal`, `maintenance ${plan.maintenance}`)}${stat("Ақуыз", `${plan.protein} г`)}${stat("Көмірсу", `${plan.carbs} г`)}${stat("Май", `${plan.fat} г`)}${stat("Тамақ бюджеті", formatKzt(core.foodBudget))}</div></article>
      <article class="panel"><h3>Апталық зал кестесі</h3><div class="workout-list">${plan.split.map(([day, focus], index) => `<div class="${index === 1 ? "today" : ""}"><span>${day}</span><strong>${focus}</strong></div>`).join("")}</div></article>
      <article class="panel wide"><h3>Тамақтану және қоспалар</h3><p>${plan.nutrition}. Егер "${state.fitness.supplements || "қоспа жоқ"}" қолдансаң, NurOS оны тек reminder ретінде қадағалайды: ${state.fitness.supplementTime}.</p><p class="disclaimer">${plan.safety} NurOS медициналық диагноз қоймайды және дәрі ұсынбайды. БАД/спорттық қоспалар бойынша нақты қарсы көрсетілім болса дәрігермен кеңес.</p></article>
    </section>`;
}

function renderChat(core) {
  return `
    <section class="chat-layout">
      <article class="panel chat-panel"><div class="panel-head"><h2>AI Chat</h2><span>барлық бөлім контексті</span></div><div class="messages">${state.chat.map((message) => `<p class="${message.role}">${message.text}</p>`).join("")}</div><form onsubmit="addChat(event)" class="chat-form"><input placeholder="Бүгін не істегенім дұрыс?" autocomplete="off" /><button type="submit">${icon("arrow_upward")}</button></form></article>
      <aside class="panel context-panel"><h3>AI білетін контекст</h3><p>Бос қаражат: ${formatKzt(core.freeCash)}</p><p>Ритуалдар: ${core.ritualRate}%</p><p>Фитнес мақсаты: ${core.fitnessPlan.direction}</p><p>Калория: ${core.fitnessPlan.calories} kcal</p><p>Жинақ: ${core.savingsProgress}%</p></aside>
    </section>`;
}

async function exportData() {
  try {
    const payload = await api("/api/export");
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nuros-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    syncStatus = "Export дайын";
  } catch (error) {
    syncStatus = `Export error: ${error.message}`;
  }
  render();
}

async function importData(event) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (!file) return;
  if (file.size > 750_000) {
    syncStatus = "Import error: JSON file is too large";
    render();
    return;
  }
  try {
    const payload = JSON.parse(await file.text());
    const imported = await api("/api/import", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state = { ...clone(seedState), ...(imported.state || state) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncStatus = "Import complete";
  } catch (error) {
    syncStatus = `Import error: ${error.message}`;
  }
  render();
}

async function createManualBackup() {
  try {
    const payload = await api("/api/backup", { method: "POST" });
    syncStatus = payload.backup ? `Backup: ${payload.backup}` : "Backup дайын";
  } catch (error) {
    syncStatus = `Backup error: ${error.message}`;
  }
  render();
}

async function checkDueReminders() {
  try {
    const payload = await api("/api/reminders/due");
    syncStatus = payload.count ? `Due reminders: ${payload.count}` : "Қазір due reminder жоқ";
  } catch (error) {
    syncStatus = `Reminder check error: ${error.message}`;
  }
  render();
}

async function addReminderFromAccount(event) {
  event.preventDefault();
  const text = textValue(event.currentTarget, "reminder");
  if (!text) return;
  try {
    const payload = await api("/api/reminders", { method: "POST", body: JSON.stringify({ text }) });
    state = { ...clone(seedState), ...(payload.state || state) };
    syncStatus = "Reminder сақталды";
  } catch (error) {
    syncStatus = `Reminder error: ${error.message}`;
  }
  render();
}

async function requestNotificationAccess() {
  if (!("Notification" in window)) {
    syncStatus = "Бұл браузер notification қолдамайды";
  } else {
    const result = await Notification.requestPermission();
    syncStatus = `Notification: ${result}`;
  }
  render();
}

async function requestEmailVerification() {
  try {
    const payload = await api("/api/verify-email/request", {
      method: "POST",
      body: JSON.stringify({ email: session.user?.email })
    });
    syncStatus = payload.verificationToken ? `Verification token: ${payload.verificationToken}` : "Verification requested";
  } catch (error) {
    syncStatus = `Verification error: ${error.message}`;
  }
  render();
}

async function confirmEmailVerification() {
  const token = window.prompt("Verification token");
  if (!token) return;
  try {
    const payload = await api("/api/verify-email", {
      method: "POST",
      body: JSON.stringify({ token })
    });
    session.user = payload.user;
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    syncStatus = "Email verified";
  } catch (error) {
    syncStatus = `Verification error: ${error.message}`;
  }
  render();
}

async function deleteAccount() {
  const confirmed = window.confirm("Аккаунт пен барлық деректі өшіру керек пе? Алдымен backup жасалады.");
  if (!confirmed) return;
  try {
    await api("/api/account", { method: "DELETE" });
  } finally {
    session = null;
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(STORAGE_KEY);
    state = clone(seedState);
    render();
  }
}

function renderAccount(core) {
  return `
    <section class="module-grid">
      <article class="panel wide">
        <div class="panel-head"><h2>Account & Data</h2><span>${syncStatus}</span></div>
        <div class="stats-grid">
          ${stat("Email", session.user?.email || "unknown")}
          ${stat("Email status", session.user?.emailVerified ? "Verified" : "Pending")}
          ${stat("Storage", healthStatus?.storage || "unknown")}
          ${stat("Email provider", healthStatus?.email?.provider || "unknown")}
          ${stat("Deploy", healthStatus?.deploy?.ready ? "Ready" : "Review")}
          ${stat("User", state.user.name)}
          ${stat("AI progress", `${core.dayProgress}%`)}
          ${stat("Finance score", `${core.financeScore}%`)}
          ${stat("Rituals", `${core.ritualRate}%`)}
          ${stat("Fitness calories", `${core.fitnessPlan.calories} kcal`)}
        </div>
        <div class="inline-actions">
          <button class="secondary-action" type="button" onclick="requestEmailVerification()">Request email token</button>
          <button class="secondary-action" type="button" onclick="confirmEmailVerification()">Confirm email</button>
          <button class="secondary-action" type="button" onclick="refreshHealth()">Refresh diagnostics</button>
          <button class="secondary-action" type="button" onclick="refreshActivity()">Refresh activity</button>
          <label class="file-action"><input type="file" accept="application/json,.json" onchange="importData(event)" />Import JSON</label>
        </div>
      </article>
      <article class="panel"><h3>Data export</h3><p>Барлық жеке дерек пен AI context JSON ретінде жүктеледі.</p><button class="secondary-action" type="button" onclick="exportData()">Export JSON</button></article>
      <article class="panel"><h3>Manual backup</h3><p>Сервердегі .data/backups ішіне database көшірмесін жасайды.</p><button class="secondary-action" type="button" onclick="createManualBackup()">Backup жасау</button></article>
      <article class="panel"><h3>Quick reminder</h3><form class="stack-form" onsubmit="addReminderFromAccount(event)">${field("Reminder", "reminder", "08:00 - су ішу")}<button class="secondary-action" type="submit">Reminder қосу</button></form><button class="secondary-action" type="button" onclick="checkDueReminders()">Due тексеру</button></article>
      <article class="panel"><h3>Notifications</h3><p>Кейін push notification қосуға дайын permission flow.</p><button class="secondary-action" type="button" onclick="requestNotificationAccess()">Permission сұрау</button></article>
      <article class="panel"><h3>Danger zone</h3><p class="disclaimer">Аккаунт өшірілсе, backup жасалып, user/session/state өшеді.</p><button class="danger-action" type="button" onclick="deleteAccount()">Аккаунтты өшіру</button></article>
    </section>`;
}

const views = {
  dashboard: { label: "Dashboard", render: renderDashboard, icon: "dashboard" },
  finance: { label: "Қаржы", render: renderFinance, icon: "payments" },
  rituals: { label: "Ритуал", render: renderRituals, icon: "self_improvement" },
  fitness: { label: "Фитнес", render: renderFitness, icon: "fitness_center" },
  chat: { label: "AI Chat", render: renderChat, icon: "smart_toy" },
  account: { label: "Account", render: renderAccount, icon: "manage_accounts" }
};

function renderAuth() {
  const demoEnabled = Boolean(healthStatus?.features?.demoUserEnabled);
  const demoEmail = "demo" + "@nuros.local";
  const demoPassword = "nuros" + "123";
  const loginEmail = demoEnabled && authMode === "login" ? demoEmail : "";
  const loginPassword = demoEnabled && authMode === "login" ? demoPassword : "";
  const authCopy = demoEnabled
    ? "Demo mode is enabled for local testing. Create your own account for real use."
    : "Create your private NurOS account. Your data is stored in the configured server database.";
  byId("app").innerHTML = `
    <section class="auth-shell">
      <article class="auth-card">
        <div class="brand auth-brand"><span>${icon("blur_on")}</span><div><strong>NurOS</strong><small>Personal AI OS</small></div></div>
        <h1>${authMode === "register" ? "Create account" : authMode === "reset" ? "Reset password" : "Sign in"}</h1>
        <p>${authCopy}</p>
        <form class="stack-form" onsubmit="submitAuth(event)">
          ${authMode === "register" ? field("Name", "name", "Nur") : ""}
          ${field("Email", "email", loginEmail, "email")}
          ${authMode === "reset" ? field("Reset token", "token", "") : ""}
          ${field(authMode === "reset" ? "New password" : "Password", "password", loginPassword, "password")}
          <button class="primary-action" type="submit">${authMode === "register" ? "Create account" : authMode === "reset" ? "Reset password" : "Sign in"}</button>
        </form>
        ${notice ? `<p class="auth-notice">${notice}</p>` : ""}
        <button class="link-button" onclick="setAuthMode('${authMode === "register" ? "login" : "register"}')">${authMode === "register" ? "I have an account" : "Create new account"}</button>
        <button class="link-button" onclick="setAuthMode('${authMode === "reset" ? "login" : "reset"}')">${authMode === "reset" ? "Back to login" : "Forgot password"}</button>
      </article>
    </section>`;
  return;
  byId("app").innerHTML = `
    <section class="auth-shell">
      <article class="auth-card">
        <div class="brand auth-brand"><span>${icon("blur_on")}</span><div><strong>NurOS</strong><small>Personal AI OS</small></div></div>
        <h1>${authMode === "register" ? "Аккаунт ашу" : "Жүйеге кіру"}</h1>
        <p>Деректеріңіз сервердегі жеке JSON database-ке сақталады.</p>
        <form class="stack-form" onsubmit="submitAuth(event)">
          ${authMode === "register" ? field("Атыңыз", "name", "Нұр") : ""}
          ${field("Email", "email", "", "email")}
          ${field("Password", "password", "", "password")}
          <button class="primary-action" type="submit">${authMode === "register" ? "Тіркелу" : "Кіру"}</button>
        </form>
        ${notice ? `<p class="auth-notice">${notice}</p>` : ""}
        <button class="link-button" onclick="setAuthMode('${authMode === "register" ? "login" : "register"}')">${authMode === "register" ? "Аккаунтым бар" : "Жаңа аккаунт ашу"}</button>
      </article>
    </section>`;
}

function render() {
  if (!session?.token) {
    renderAuth();
    return;
  }

  const core = aiCore(state);
  document.documentElement.dataset.theme = state.user.theme;
  byId("app").innerHTML = `
    <aside class="sidebar">
      <div class="brand"><span>${icon("blur_on")}</span><div><strong>NurOS</strong><small>Personal AI OS</small></div></div>
      <nav>${Object.entries(views).map(([key, view]) => `<button aria-label="${view.label}" class="${activeView === key ? "active" : ""}" onclick="setView('${key}')">${icon(view.icon)}<span>${view.label}</span></button>`).join("")}</nav>
      <div class="sidebar-profile"><div class="avatar">${state.user.name.slice(0, 1)}</div><div><strong>${state.user.name}</strong><small>${session.user?.email || "Pro Plan"}</small></div></div>
    </aside>
    <section class="workspace">
      <header class="topbar"><h1>${views[activeView].label}</h1><div class="top-actions"><button type="button" aria-label="Sync status" title="${syncStatus}">${icon("cloud_done")}</button><button type="button" aria-label="Notifications">${icon("notifications")}</button><button class="logout-icon" type="button" aria-label="Logout" onclick="logout()">${icon("logout")}</button><button class="theme-icon" type="button" aria-label="Toggle theme" onclick="setTheme('${state.user.theme === "light" ? "dark" : "light"}')">${icon(state.user.theme === "light" ? "dark_mode" : "light_mode")}</button></div></header>
      <div class="content-stage">${views[activeView].render(core)}</div>
    </section>
    <form class="floating-command" onsubmit="addChat(event)">${icon("temp_preferences_custom")}<input placeholder="NurOS-тан бірдеңе сұраңыз..." autocomplete="off" /><kbd>⌘ K</kbd><button type="submit">${icon("arrow_upward")}</button></form>`;
  byId("app").querySelector(".floating-command input")?.setAttribute("aria-label", "Ask NurOS");
  byId("app").querySelector(".floating-command button")?.setAttribute("aria-label", "Send message");
  if (activeView === "account") mountActivityPanel();
}

function mountActivityPanel() {
  const grid = byId("app").querySelector(".module-grid");
  if (!grid || grid.querySelector("[data-activity-panel]")) return;
  const panel = document.createElement("article");
  panel.className = "panel wide";
  panel.dataset.activityPanel = "true";
  const rows = activityItems.length
    ? activityItems
        .map(
          (item) =>
            `<div><strong>${item.action}</strong><span>${new Date(item.createdAt).toLocaleString()}</span><small>${item.method || ""} ${item.route || ""}</small></div>`
        )
        .join("")
    : "<p>No activity yet.</p>";
  panel.innerHTML = `<div class="panel-head"><h3>Recent activity</h3><span>${activityItems.length} events</span></div><div class="activity-list">${rows}</div>`;
  const firstNarrowPanel = grid.querySelector(".panel:not(.wide)");
  grid.insertBefore(panel, firstNarrowPanel || null);
}

Object.assign(window, {
  setView,
  setTheme,
  toggleRitual,
  saveProfile,
  saveFinance,
  saveFitness,
  addTransaction,
  addRitual,
  addChat,
  exportData,
  importData,
  createManualBackup,
  checkDueReminders,
  addReminderFromAccount,
  requestNotificationAccess,
  requestEmailVerification,
  confirmEmailVerification,
  refreshHealth,
  refreshActivity,
  deleteAccount,
  submitAuth,
  setAuthMode,
  logout
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(() => {}));
}

bootstrap();
