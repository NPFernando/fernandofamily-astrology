const baseUrl = process.env.IMAGE_TELEMETRY_BASE_URL;
const token = process.env.IMAGE_TELEMETRY_DASHBOARD_TOKEN;

if (!baseUrl || !token) {
  console.error("Set IMAGE_TELEMETRY_BASE_URL and IMAGE_TELEMETRY_DASHBOARD_TOKEN to export anonymous image telemetry.");
  process.exit(1);
}

const response = await fetch(new URL("/api/telemetry/image-load", baseUrl), {
  headers: { authorization: `Bearer ${token}` },
});
if (!response.ok) {
  console.error(`Image telemetry export failed: ${response.status}`);
  process.exit(1);
}
console.log(JSON.stringify(await response.json(), null, 2));
