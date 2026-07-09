const target = process.argv[2] || process.env.NUROS_HEALTH_URL || "http://127.0.0.1:4174/api/health";

async function main() {
  const response = await fetch(target);
  const payload = await response.json();
  console.log(JSON.stringify(payload.deploy || payload, null, 2));
  if (!response.ok) throw new Error(`Health check failed with HTTP ${response.status}`);
  if (!payload.deploy?.ready) {
    throw new Error(`Deploy is not ready: ${(payload.deploy?.errors || []).join("; ") || "unknown reason"}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
