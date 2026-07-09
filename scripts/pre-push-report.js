const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "server.js",
  "app.js",
  "styles.css",
  "index.html",
  "package.json",
  ".env.example",
  ".gitignore",
  "supabase-schema.sql",
  "render.yaml",
  "PRODUCTION_CHECKLIST.md",
  "run-tests.cmd",
  "validate-env.cmd",
  "migrate-supabase.cmd",
  "run-supabase-tests.cmd",
  "check-health.cmd"
];

const checks = [];
const warnings = [];
const errors = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) errors.push(detail || name);
}

for (const file of requiredFiles) {
  check(`required:${file}`, fs.existsSync(path.join(root, file)), `${file} is missing`);
}

const gitignore = read(".gitignore");
check("gitignore:data", gitignore.includes(".data/"), ".data/ must be ignored");
check("gitignore:env", gitignore.includes(".env"), ".env should be ignored");
if (!gitignore.includes(".env")) warnings.push(".env is not explicitly ignored.");

const envExists = fs.existsSync(path.join(root, ".env"));
if (envExists) warnings.push(".env exists locally; confirm it is ignored before push.");

const status = runGit(["status", "--short"]);
const trackedEnv = runGit(["ls-files", ".env"]).trim();
check("git:no-tracked-env", !trackedEnv, ".env is tracked by git");

const packageJson = JSON.parse(read("package.json"));
check("package:private", packageJson.private === true, "package.json should remain private");
check("package:test-script", Boolean(packageJson.scripts?.test), "package.json test script is missing");

const checklist = read("PRODUCTION_CHECKLIST.md");
for (const phrase of ["AUTH_EXPOSE_DEV_TOKENS=false", "DATABASE_PROVIDER=supabase", "EMAIL_PROVIDER=resend"]) {
  check(`checklist:${phrase}`, checklist.includes(phrase), `Production checklist missing ${phrase}`);
}

const report = {
  ok: errors.length === 0,
  version: packageJson.version,
  changedFiles: status.split(/\r?\n/).filter(Boolean).length,
  checks,
  warnings,
  errors,
  externalBlockers: [
    "Supabase project credentials are required for hosted storage.",
    "Resend API key and verified sender are required for hosted email.",
    "OpenAI API key is required for real hosted AI responses.",
    "Public HTTPS APP_URL is required before production launch."
  ],
  nextCommands: [
    ".\\validate-env.cmd",
    ".\\run-tests.cmd",
    ".\\migrate-supabase.cmd",
    ".\\run-supabase-tests.cmd",
    ".\\check-health.cmd <health-url>"
  ]
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function runGit(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" });
  } catch {
    return "";
  }
}
