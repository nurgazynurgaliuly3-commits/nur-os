const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { createSupabaseStorage } = require("../lib/storage-supabase");

const root = path.resolve(__dirname, "..");
const dbPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, ".data", "nuros-db.json");

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  return fs.readFile(envPath, "utf8")
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!process.env[key]) process.env[key] = rest.join("=").trim();
      }
    })
    .catch(() => {});
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function main() {
  await loadEnvFile();
  const raw = await fs.readFile(dbPath, "utf8");
  const db = JSON.parse(raw);
  const storage = createSupabaseStorage({
    defaultState: {},
    clone,
    hashPassword,
    now,
    newId
  });

  await storage.writeDb(db);
  console.log(`Migrated ${db.users?.length || 0} users and ${Object.keys(db.states || {}).length} states to Supabase.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
