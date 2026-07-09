const { spawn } = require("child_process");
const assert = require("assert");

const port = 4190 + Math.floor(Math.random() * 100);
const baseUrl = `http://127.0.0.1:${port}`;
const expectedStorage = (process.env.DATABASE_PROVIDER || "json").toLowerCase();
const server = spawn(process.execPath, ["server.js", String(port)], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${payload.error || response.statusText}`);
  }
  return payload;
}

async function requestRaw(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const health = await request("/api/health");
      return health;
    } catch {
      await wait(200);
    }
  }
  throw new Error(`Server did not start\n${serverOutput}`);
}

(async () => {
  try {
    const health = await waitForServer();
    assert.equal(health.ok, true);
    assert.equal(health.storage, expectedStorage);
    assert.ok(health.audit);
    assert.equal(health.email.provider, "log");
    assert.equal(health.email.configured, true);
    assert.equal(health.features.emailProvider, "log");
    assert.equal(health.features.pwaReady, true);
    assert.equal(health.deploy.ready, true);
    assert.equal(health.deploy.mode, "development");
    assert.ok(health.deploy.warnings.length >= 1);
    assert.ok(health.rateLimit.max > 0);
    assert.ok(health.session.ttlDays > 0);
    assert.ok(["local", "openai"].includes(health.aiProvider));

    const email = `test-${Date.now()}@nuros.local`;
    const registered = await request("/api/register", {
      method: "POST",
      body: JSON.stringify({ name: "Smoke", email, password: "nuros123" })
    });
    assert.ok(registered.token);
    assert.ok(registered.verificationToken);

    let auth = { Authorization: `Bearer ${registered.token}` };
    const me = await request("/api/me", { headers: auth });
    assert.equal(me.user.email, email);
    assert.equal(me.user.emailVerified, false);

    const verified = await request("/api/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: registered.verificationToken })
    });
    assert.equal(verified.ok, true);
    assert.equal(verified.user.emailVerified, true);

    const stateResult = await request("/api/state", { headers: auth });
    assert.ok(stateResult.core.advice);

    stateResult.state.user.name = "Smoke Updated";
    const saved = await request("/api/state", {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({ state: stateResult.state })
    });
    assert.equal(saved.state.user.name, "Smoke Updated");

    const exported = await request("/api/export", { headers: auth });
    assert.equal(exported.state.user.name, "Smoke Updated");

    exported.state.user.name = "Smoke Imported";
    const imported = await request("/api/import", {
      method: "POST",
      headers: auth,
      body: JSON.stringify(exported)
    });
    assert.equal(imported.ok, true);
    assert.equal(imported.state.user.name, "Smoke Imported");

    const oversized = await requestRaw("/api/import", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ state: { chat: [{ role: "user", text: "x".repeat(760_000) }] } })
    });
    assert.equal(oversized.response.status, 413);

    const activity = await request("/api/activity?limit=20", { headers: auth });
    assert.equal(typeof activity.count, "number");
    assert.ok(activity.activity.some((item) => item.action === "data_import"));

    const backup = await request("/api/backup", { method: "POST", headers: auth });
    assert.equal(backup.ok, true);

    const reset = await request("/api/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    assert.ok(reset.resetToken);

    const resetDone = await request("/api/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token: reset.resetToken, password: "nuros456" })
    });
    assert.equal(resetDone.ok, true);

    const loggedInAgain = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "nuros456" })
    });
    auth = { Authorization: `Bearer ${loggedInAgain.token}` };

    const reminder = await request("/api/reminders", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ text: "09:00 - smoke reminder" })
    });
    assert.equal(reminder.ok, true);
    assert.ok(reminder.state.reminders[0].includes("smoke reminder"));

    const dueAt = encodeURIComponent("2026-07-09T09:00:00");
    const due = await request(`/api/reminders/due?at=${dueAt}`, { headers: auth });
    assert.ok(due.count >= 1);

    const tick = await request(`/api/tick?at=${dueAt}`, { method: "POST", headers: auth });
    assert.equal(tick.ok, true);
    assert.ok(tick.count >= 1);

    const tickAgain = await request(`/api/tick?at=${dueAt}`, { method: "POST", headers: auth });
    assert.equal(tickAgain.ok, true);
    assert.equal(tickAgain.count, 0);

    const chat = await request("/api/ai/chat", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ message: "Бүгін не істеймін?" })
    });
    assert.ok(chat.answer.includes("NurOS Core"));
    assert.equal(chat.provider, "local");

    const deleted = await request("/api/account", { method: "DELETE", headers: auth });
    assert.equal(deleted.ok, true);

    console.log("api-smoke ok");
  } finally {
    server.kill();
  }
})().catch((error) => {
  server.kill();
  console.error(error);
  process.exit(1);
});
