function createSupabaseStorage({ defaultState, clone, hashPassword, now, newId }) {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  function assertConfigured() {
    if (!url || !serviceKey) {
      throw new Error("Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
  }

  async function request(resource, options = {}) {
    assertConfigured();
    const response = await fetch(`${url}/rest/v1/${resource}`, {
      method: options.method || "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation",
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = payload?.message || payload?.hint || response.statusText;
      throw new Error(`Supabase ${response.status}: ${message}`);
    }
    return payload;
  }

  function listFilter(values) {
    return `(${values.map((value) => String(value).replace(/"/g, "")).join(",")})`;
  }

  async function init() {
    assertConfigured();
    const profiles = await request("nuros_profiles?select=id&limit=1");
    if (profiles.length) return;

    const demoId = newId();
    const demoState = clone(defaultState);
    await writeDb({
      users: [
        {
          id: demoId,
          email: "demo@nuros.local",
          name: "Demo",
          passwordHash: hashPassword("nuros123"),
          createdAt: now()
        }
      ],
      sessions: [],
      states: { [demoId]: demoState }
    });
  }

  async function readDb() {
    await init();
    const [profiles, sessions, states] = await Promise.all([
      request("nuros_profiles?select=*"),
      request("nuros_sessions?select=*"),
      request("nuros_states?select=*")
    ]);

    return {
      users: profiles.map((profile) => ({
        id: profile.id,
        email: profile.email,
        name: profile.display_name,
        passwordHash: profile.password_hash,
        emailVerified: profile.email_verified,
        verificationTokenHash: profile.verification_token_hash,
        verificationExpiresAt: profile.verification_expires_at,
        resetTokenHash: profile.reset_token_hash,
        resetExpiresAt: profile.reset_expires_at,
        createdAt: profile.created_at
      })),
      sessions: sessions.map((session) => ({
        token: session.token,
        userId: session.user_id,
        createdAt: session.created_at
      })),
      states: states.reduce((acc, row) => {
        acc[row.user_id] = row.state || clone(defaultState);
        return acc;
      }, {})
    };
  }

  async function writeDb(db) {
    assertConfigured();
    const users = db.users || [];
    const sessions = db.sessions || [];
    const stateEntries = Object.entries(db.states || {});
    const userIds = users.map((user) => user.id);
    const sessionTokens = sessions.map((session) => session.token);

    if (userIds.length) {
      await request(`nuros_profiles?id=not.in.${listFilter(userIds)}`, {
        method: "DELETE",
        prefer: "return=minimal"
      });
      await request("nuros_profiles?on_conflict=id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: users.map((user) => ({
          id: user.id,
          email: user.email,
          display_name: user.name || "User",
          password_hash: user.passwordHash,
          email_verified: Boolean(user.emailVerified),
          verification_token_hash: user.verificationTokenHash || null,
          verification_expires_at: user.verificationExpiresAt || null,
          reset_token_hash: user.resetTokenHash || null,
          reset_expires_at: user.resetExpiresAt || null,
          created_at: user.createdAt || now(),
          updated_at: now()
        }))
      });
    } else {
      await request("nuros_profiles?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
    }

    if (stateEntries.length) {
      await request(`nuros_states?user_id=not.in.${listFilter(userIds)}`, {
        method: "DELETE",
        prefer: "return=minimal"
      });
      await request("nuros_states?on_conflict=user_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: stateEntries.map(([userId, state]) => ({
          user_id: userId,
          state,
          updated_at: now()
        }))
      });
    } else {
      await request("nuros_states?user_id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
    }

    if (sessionTokens.length) {
      await request(`nuros_sessions?token=not.in.${listFilter(sessionTokens)}`, {
        method: "DELETE",
        prefer: "return=minimal"
      });
      await request("nuros_sessions?on_conflict=token", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: sessions.map((session) => ({
          token: session.token,
          user_id: session.userId,
          created_at: session.createdAt || now()
        }))
      });
    } else {
      await request("nuros_sessions?token=not.is.null", { method: "DELETE", prefer: "return=minimal" });
    }
  }

  async function backup() {
    return null;
  }

  async function audit(event) {
    await request("nuros_audit_events", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        user_id: event.userId || null,
        action: event.action,
        route: event.route,
        method: event.method,
        ip_hash: event.ipHash,
        metadata: event.metadata || {},
        created_at: event.createdAt
      }
    });
  }

  async function activity(userId, limit = 30) {
    const rows = await request(
      `nuros_audit_events?select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${Number(limit) || 30}`
    );
    return rows.map((row) => ({
      action: row.action,
      userId: row.user_id,
      route: row.route,
      method: row.method,
      ipHash: row.ip_hash,
      metadata: row.metadata || {},
      createdAt: row.created_at
    }));
  }

  async function deliveredReminderKeys(keys) {
    if (!keys.length) return [];
    const rows = await request(`nuros_reminder_events?select=delivery_key&delivery_key=in.${listFilter(keys)}`);
    return rows.map((row) => row.delivery_key);
  }

  async function recordReminderDeliveries(events) {
    if (!events.length) return;
    await request("nuros_reminder_events?on_conflict=delivery_key", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: events.map((event) => ({
        delivery_key: event.key,
        user_id: event.userId,
        reminder: event.reminder,
        due_at: event.dueAt,
        delivered_at: event.deliveredAt
      }))
    });
  }

  async function health() {
    const db = await readDb();
    return {
      provider: "supabase",
      users: db.users.length,
      sessions: db.sessions.length,
      audit: "table"
    };
  }

  return { provider: "supabase", init, readDb, writeDb, backup, health, audit, activity, deliveredReminderKeys, recordReminderDeliveries };
}

module.exports = { createSupabaseStorage };
