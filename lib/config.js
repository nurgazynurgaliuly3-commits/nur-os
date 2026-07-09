function getDeployMode() {
  return (process.env.NUROS_DEPLOY_MODE || process.env.NODE_ENV || "development").toLowerCase();
}

function buildDeployReport({ storageHealth, mailerHealth, exposeDevTokens, aiProvider }) {
  const mode = getDeployMode();
  const production = mode === "production";
  const warnings = [];
  const errors = [];
  const databaseProvider = storageHealth.provider;
  const emailProvider = mailerHealth.provider;

  if (databaseProvider === "json") warnings.push("JSON storage is for local/private prototype use.");
  if (emailProvider === "log") warnings.push("Email log provider does not send real email.");
  if (exposeDevTokens) warnings.push("Auth recovery tokens are exposed in API responses.");
  if (aiProvider === "local") warnings.push("Local AI fallback is active; no external LLM is configured.");

  if (production && databaseProvider === "json") errors.push("Production requires DATABASE_PROVIDER=supabase.");
  if (production && emailProvider === "log") errors.push("Production requires a real EMAIL_PROVIDER.");
  if (production && exposeDevTokens) errors.push("Production requires AUTH_EXPOSE_DEV_TOKENS=false.");
  if (production && !mailerHealth.configured) errors.push("Email provider is not fully configured.");
  if (production && aiProvider === "local") warnings.push("Production is running without OPENAI_API_KEY.");

  return {
    mode,
    ready: errors.length === 0,
    production,
    warnings,
    errors
  };
}

module.exports = { buildDeployReport, getDeployMode };
