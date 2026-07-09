const { spawn } = require("child_process");
const assert = require("assert");

const port = 4290 + Math.floor(Math.random() * 100);
const baseUrl = `http://127.0.0.1:${port}`;
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

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200, `${path} status`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${path} nosniff`);
  assert.ok(response.headers.get("content-security-policy")?.includes("default-src 'self'"), `${path} csp`);
  assert.ok(response.headers.get("content-security-policy")?.includes("script-src 'self' 'unsafe-inline'"), `${path} csp inline handlers`);
  return response.text();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await fetchText("/api/health");
      return;
    } catch {
      await wait(200);
    }
  }
  throw new Error(`Server did not start\n${serverOutput}`);
}

(async () => {
  try {
    await waitForServer();
    const html = await fetchText("/");
    assert.ok(html.includes("NurOS"), "index has brand");
    assert.ok(html.includes("app.js"), "index loads app");
    assert.ok(html.includes("styles.css"), "index loads styles");

    const css = await fetchText("/styles.css");
    assert.ok(css.includes(":root"), "css variables exist");
    assert.ok(css.includes("@media"), "responsive css exists");
    assert.ok(css.includes(".welcome-row .primary-action"), "mobile does not hide all primary buttons");
    assert.ok(css.includes(".logout-icon"), "mobile logout action remains available");
    assert.ok(css.includes(".file-action"), "import file action is styled");
    assert.ok(css.includes(".activity-list"), "activity list is styled");

    const js = await fetchText("/app.js");
    assert.ok(js.includes("renderDashboard"), "app dashboard renderer exists");
    assert.ok(js.includes("requestEmailVerification"), "account verification UI exists");
    assert.ok(js.includes("refreshHealth"), "account diagnostics refresh exists");
    assert.ok(js.includes("Diagnostics ready"), "diagnostics status messaging exists");
    assert.ok(js.includes("importData"), "account import flow exists");
    assert.ok(js.includes("/api/import"), "import endpoint is wired");
    assert.ok(js.includes("file.size > 750_000"), "import size guard exists");
    assert.ok(js.includes("refreshActivity"), "account activity refresh exists");
    assert.ok(js.includes("/api/activity?limit=12"), "activity endpoint is wired");
    assert.ok(js.includes("mountActivityPanel"), "activity panel is mounted");
    assert.ok(js.includes("/api/reminders/due"), "due reminder endpoint is wired");
    assert.ok(js.includes("logout-icon"), "topbar marks logout for mobile");
    assert.ok(js.includes('aria-label="Logout"'), "logout icon has accessible label");
    assert.ok(js.includes('aria-label="Toggle theme"'), "theme icon has accessible label");
    assert.ok(js.includes('aria-label", "Ask NurOS"'), "floating command input has accessible label");
    assert.ok(js.includes('aria-label", "Send message"'), "floating command submit has accessible label");

    const manifest = JSON.parse(await fetchText("/manifest.webmanifest"));
    assert.equal(manifest.name, "NurOS");
    assert.ok(Array.isArray(manifest.icons), "manifest icons exist");

    const serviceWorker = await fetchText("/service-worker.js");
    assert.ok(serviceWorker.includes("install"), "service worker install handler exists");

    console.log("static-smoke ok");
  } finally {
    server.kill();
  }
})().catch((error) => {
  server.kill();
  console.error(error);
  process.exit(1);
});
