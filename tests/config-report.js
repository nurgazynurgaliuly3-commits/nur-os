const assert = require("assert");
const { buildDeployReport } = require("../lib/config");

function report(overrides = {}) {
  return buildDeployReport({
    storageHealth: { provider: "json", ...(overrides.storageHealth || {}) },
    mailerHealth: { provider: "log", configured: true, ...(overrides.mailerHealth || {}) },
    exposeDevTokens: overrides.exposeDevTokens ?? true,
    aiProvider: overrides.aiProvider || "local"
  });
}

const originalMode = process.env.NUROS_DEPLOY_MODE;

try {
  process.env.NUROS_DEPLOY_MODE = "development";
  const dev = report();
  assert.equal(dev.mode, "development");
  assert.equal(dev.ready, true);
  assert.ok(dev.warnings.length >= 3);
  assert.deepEqual(dev.errors, []);

  process.env.NUROS_DEPLOY_MODE = "production";
  const unsafeProd = report();
  assert.equal(unsafeProd.production, true);
  assert.equal(unsafeProd.ready, false);
  assert.ok(unsafeProd.errors.some((item) => item.includes("DATABASE_PROVIDER")));
  assert.ok(unsafeProd.errors.some((item) => item.includes("EMAIL_PROVIDER")));
  assert.ok(unsafeProd.errors.some((item) => item.includes("AUTH_EXPOSE_DEV_TOKENS")));

  const readyProd = report({
    storageHealth: { provider: "supabase" },
    mailerHealth: { provider: "resend", configured: true },
    exposeDevTokens: false,
    aiProvider: "openai"
  });
  assert.equal(readyProd.ready, true);
  assert.deepEqual(readyProd.errors, []);

  console.log("config-report ok");
} finally {
  if (originalMode == null) {
    delete process.env.NUROS_DEPLOY_MODE;
  } else {
    process.env.NUROS_DEPLOY_MODE = originalMode;
  }
}
