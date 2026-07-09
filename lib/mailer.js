const fsp = require("fs/promises");
const path = require("path");

function createMailer({ root, now }) {
  const provider = (process.env.EMAIL_PROVIDER || "log").toLowerCase();
  const from = process.env.EMAIL_FROM || "NurOS <noreply@nuros.local>";
  const appUrl = (process.env.APP_URL || "http://localhost:4174").replace(/\/$/, "");
  const resendApiKey = process.env.RESEND_API_KEY || "";
  const dataDir = path.join(root, ".data");
  const outboxPath = path.join(dataDir, "email-outbox.log");

  async function sendAuthToken({ to, type, token, expiresAt }) {
    const message = buildAuthMessage({ to, type, token, expiresAt, from, appUrl });
    if (provider === "resend") {
      return sendResend(message);
    }
    if (provider !== "log") throw new Error(`Email provider "${provider}" is not configured yet.`);
    await fsp.mkdir(dataDir, { recursive: true });
    const event = {
      ...message,
      createdAt: now()
    };
    await fsp.appendFile(outboxPath, `${JSON.stringify(event)}\n`, "utf8");
    return { provider, outbox: path.basename(outboxPath) };
  }

  async function sendResend(message) {
    if (!resendApiKey) throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || "Email provider error");
    return { provider, id: payload.id || null };
  }

  function health() {
    return {
      provider,
      from,
      outbox: provider === "log" ? path.basename(outboxPath) : null,
      configured: provider === "log" || Boolean(resendApiKey)
    };
  }

  return { provider, sendAuthToken, health };
}

function buildAuthMessage({ to, type, token, expiresAt, from, appUrl }) {
  const isReset = type === "password_reset";
  const path = isReset ? "/reset-password" : "/verify-email";
  const action = isReset ? "Reset password" : "Verify email";
  const url = `${appUrl}${path}?token=${encodeURIComponent(token)}`;
  const subject = isReset ? "Reset your NurOS password" : "Verify your NurOS email";
  const text = [
    `NurOS ${action}`,
    "",
    `Use this token: ${token}`,
    `Or open: ${url}`,
    `Expires at: ${expiresAt}`,
    "",
    "If you did not request this, ignore this message."
  ].join("\n");
  const html = `<p><strong>NurOS ${action}</strong></p><p>Use this token:</p><pre>${escapeHtml(token)}</pre><p><a href="${escapeHtml(url)}">${action}</a></p><p>Expires at: ${escapeHtml(expiresAt)}</p>`;
  return { provider: "email", type, to, from, subject, text, html, token, url, expiresAt };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { createMailer };
