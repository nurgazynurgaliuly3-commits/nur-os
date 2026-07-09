const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, ".env");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

function validate(env) {
  const mode = (env.NUROS_DEPLOY_MODE || env.NODE_ENV || "development").toLowerCase();
  const production = mode === "production";
  const errors = [];
  const warnings = [];

  const requiredBase = ["APP_URL", "PORT", "SESSION_TTL_DAYS", "AUTH_TOKEN_TTL_MINUTES"];
  for (const key of requiredBase) {
    if (!env[key]) warnings.push(`${key} is not set; default runtime value will be used.`);
  }

  if (production) {
    requireValue(env, "DATABASE_PROVIDER", "supabase", errors);
    requirePresent(env, "SUPABASE_URL", errors);
    requirePresent(env, "SUPABASE_SERVICE_ROLE_KEY", errors);
    requireValue(env, "AUTH_EXPOSE_DEV_TOKENS", "false", errors);
    requireValue(env, "EMAIL_PROVIDER", "resend", errors);
    requirePresent(env, "EMAIL_FROM", errors);
    requirePresent(env, "RESEND_API_KEY", errors);
    requireHttps(env, "APP_URL", errors);
    if (!env.OPENAI_API_KEY) warnings.push("OPENAI_API_KEY is missing; production will use local AI fallback.");
  } else {
    if ((env.DATABASE_PROVIDER || "json") === "json") warnings.push("Local JSON storage mode is active.");
    if ((env.EMAIL_PROVIDER || "log") === "log") warnings.push("Email log mode is active.");
  }

  return { mode, production, ready: errors.length === 0, errors, warnings };
}

function requirePresent(env, key, errors) {
  if (!env[key]) errors.push(`${key} is required.`);
}

function requireValue(env, key, expected, errors) {
  if ((env[key] || "").toLowerCase() !== expected) errors.push(`${key} must be ${expected}.`);
}

function requireHttps(env, key, errors) {
  if (!String(env[key] || "").startsWith("https://")) errors.push(`${key} must be an HTTPS URL.`);
}

const env = parseEnvFile(envPath);
const report = validate(env);
console.log(JSON.stringify({ file: fs.existsSync(envPath) ? envPath : null, ...report }, null, 2));
if (!report.ready) process.exit(1);
