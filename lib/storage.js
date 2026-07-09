const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { createSupabaseStorage } = require("./storage-supabase");

function createJsonStorage({ root, defaultState, clone, hashPassword, now, newId }) {
  const dataDir = path.join(root, ".data");
  const dbPath = path.join(dataDir, "nuros-db.json");
  const backupDir = path.join(dataDir, "backups");
  const auditPath = path.join(dataDir, "audit.log");
  const reminderDeliveryPath = path.join(dataDir, "reminder-deliveries.json");

  async function init() {
    await fsp.mkdir(dataDir, { recursive: true });
    if (!fs.existsSync(dbPath)) {
      const demoId = newId();
      const token = randomToken();
      const db = {
        users: [
          {
            id: demoId,
            email: "demo@nuros.local",
            passwordHash: hashPassword("nuros123"),
            createdAt: now()
          }
        ],
        sessions: [{ token, userId: demoId, createdAt: now() }],
        states: { [demoId]: clone(defaultState) }
      };
      await writeDb(db);
    }
  }

  async function readDb() {
    await init();
    return JSON.parse(await fsp.readFile(dbPath, "utf8"));
  }

  async function writeDb(db) {
    await fsp.mkdir(dataDir, { recursive: true });
    const tempPath = `${dbPath}.tmp`;
    await fsp.writeFile(tempPath, JSON.stringify(db, null, 2), "utf8");
    await fsp.rename(tempPath, dbPath);
  }

  async function backup(reason) {
    if (!fs.existsSync(dbPath)) return null;
    await fsp.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `${stamp}-${reason}.json`);
    await fsp.copyFile(dbPath, backupPath);
    return backupPath;
  }

  async function health() {
    const db = await readDb();
    return {
      provider: "json",
      users: db.users.length,
      sessions: db.sessions.length,
      audit: "jsonl"
    };
  }

  async function audit(event) {
    await fsp.mkdir(dataDir, { recursive: true });
    await fsp.appendFile(auditPath, `${JSON.stringify(event)}\n`, "utf8");
  }

  async function activity(userId, limit = 30) {
    if (!fs.existsSync(auditPath)) return [];
    const raw = await fsp.readFile(auditPath, "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((event) => event && event.userId === userId)
      .slice(-limit)
      .reverse();
  }

  async function readReminderDeliveries() {
    if (!fs.existsSync(reminderDeliveryPath)) return [];
    return JSON.parse(await fsp.readFile(reminderDeliveryPath, "utf8"));
  }

  async function deliveredReminderKeys(keys) {
    const set = new Set((await readReminderDeliveries()).map((item) => item.key));
    return keys.filter((key) => set.has(key));
  }

  async function recordReminderDeliveries(events) {
    if (!events.length) return;
    await fsp.mkdir(dataDir, { recursive: true });
    const existing = await readReminderDeliveries();
    const seen = new Set(existing.map((item) => item.key));
    for (const event of events) {
      if (!seen.has(event.key)) {
        existing.push(event);
        seen.add(event.key);
      }
    }
    await fsp.writeFile(reminderDeliveryPath, JSON.stringify(existing.slice(-1000), null, 2), "utf8");
  }

  return { provider: "json", init, readDb, writeDb, backup, health, audit, activity, deliveredReminderKeys, recordReminderDeliveries };
}

function createStorage(options) {
  const provider = (process.env.DATABASE_PROVIDER || "json").toLowerCase();
  if (provider === "supabase") return createSupabaseStorage(options);
  return createJsonStorage(options);
}

function randomToken() {
  return require("crypto").randomBytes(32).toString("hex");
}

module.exports = { createStorage };
