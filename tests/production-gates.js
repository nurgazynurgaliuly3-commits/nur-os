const { spawn } = require("child_process");
const assert = require("assert");

const port = 4390 + Math.floor(Math.random() * 100);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server.js", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NUROS_DEPLOY_MODE: "production",
    DATABASE_PROVIDER: "json",
    EMAIL_PROVIDER: "log",
    AUTH_EXPOSE_DEV_TOKENS: "true",
    NUROS_DEMO_USER_ENABLED: "true",
    APP_URL: "http://localhost"
  },
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

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function waitForLive() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const live = await request("/api/live");
      if (live.response.status === 200) return live;
    } catch {
      await wait(200);
    }
  }
  throw new Error(`Server did not start\n${serverOutput}`);
}

(async () => {
  try {
    const live = await waitForLive();
    assert.equal(live.payload.ok, true);
    assert.equal(live.payload.service, "NurOS");

    const ready = await request("/api/ready");
    assert.equal(ready.response.status, 503);
    assert.equal(ready.payload.ok, false);
    assert.ok(ready.payload.deploy.errors.some((item) => item.includes("DATABASE_PROVIDER")));
    assert.ok(ready.payload.deploy.errors.some((item) => item.includes("NUROS_DEMO_USER_ENABLED")));
    assert.ok(ready.payload.deploy.errors.some((item) => item.includes("APP_URL")));

    const health = await request("/api/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.payload.deploy.ready, false);
    assert.equal(health.payload.features.demoUserEnabled, true);

    console.log("production-gates ok");
  } finally {
    server.kill();
  }
})().catch((error) => {
  server.kill();
  console.error(error);
  process.exit(1);
});
