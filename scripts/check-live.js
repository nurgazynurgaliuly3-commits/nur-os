const target = process.argv[2] || process.env.NUROS_LIVE_URL || "http://127.0.0.1:4174/api/live";

async function main() {
  const response = await fetch(target);
  const payload = await response.json().catch(() => ({}));
  console.log(JSON.stringify(payload, null, 2));
  if (!response.ok || payload.ok !== true) {
    throw new Error(`Live check failed with HTTP ${response.status}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
