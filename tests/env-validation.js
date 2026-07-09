const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "validate-env.js");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nuros-env-"));

function runWith(content) {
  const envPath = path.join(tempDir, `case-${Date.now()}-${Math.random()}.env`);
  fs.writeFileSync(envPath, content, "utf8");
  const result = spawnSync(process.execPath, [script, envPath], { cwd: root, encoding: "utf8" });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

const dev = runWith("NUROS_DEPLOY_MODE=development\nDATABASE_PROVIDER=json\nEMAIL_PROVIDER=log\n");
assert.equal(dev.code, 0);
assert.ok(dev.output.includes("Local JSON storage mode is active."));

const badProd = runWith("NUROS_DEPLOY_MODE=production\nDATABASE_PROVIDER=json\nEMAIL_PROVIDER=log\nAUTH_EXPOSE_DEV_TOKENS=true\nAPP_URL=http://example.com\n");
assert.notEqual(badProd.code, 0);
assert.ok(badProd.output.includes("DATABASE_PROVIDER must be supabase."));
assert.ok(badProd.output.includes("APP_URL must be an HTTPS URL."));

const goodProd = runWith(
  [
    "NUROS_DEPLOY_MODE=production",
    "DATABASE_PROVIDER=supabase",
    "SUPABASE_URL=https://example.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY=secret",
    "AUTH_EXPOSE_DEV_TOKENS=false",
    "EMAIL_PROVIDER=resend",
    "EMAIL_FROM=NurOS <noreply@example.com>",
    "RESEND_API_KEY=secret",
    "APP_URL=https://nuros.example.com"
  ].join("\n")
);
assert.equal(goodProd.code, 0);
assert.ok(goodProd.output.includes('"ready": true'));

console.log("env-validation ok");
