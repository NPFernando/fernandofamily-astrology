const baseUrl = (process.env.DEPLOY_URL ?? "").replace(/\/$/, "");
const expectedCommit = process.env.EXPECTED_COMMIT ?? "";

if (!baseUrl) {
  throw new Error("DEPLOY_URL is required, for example https://astrology.fernandofamily.com");
}

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
  const body = await response.text();
  return { response, body };
}

const checks = [
  ["/api/v1/health/live", (body, response) => response.ok && JSON.parse(body).status === "ok"],
  ["/api/v1/health/ready", (body, response) => response.ok && JSON.parse(body).status === "ok"],
  ["/api/v1/metadata", (body, response) => response.ok && JSON.parse(body)],
  ["/en/", (body, response) => response.ok && body.includes("<html")],
  ["/en/roadmap", (body, response) => response.ok && body.includes("Roadmap")],
  ["/sw.js", (body, response) => response.ok && body.includes("CACHE_NAME")],
];

const results = new Map();
for (const [path, predicate] of checks) {
  const result = await get(path);
  let passed = false;
  try {
    passed = Boolean(predicate(result.body, result.response));
  } catch {
    passed = false;
  }
  results.set(path, result);
  if (!passed) throw new Error(`Deployed smoke check failed: ${path} (${result.response.status})`);
}

const metadata = JSON.parse(results.get("/api/v1/metadata").body);
if (expectedCommit && metadata.deployed_commit !== expectedCommit) {
  throw new Error(`Deployed commit mismatch: expected ${expectedCommit}, got ${metadata.deployed_commit}`);
}

const featureIds = metadata.features.filter((feature) => feature.enabled && feature.public).map((feature) => feature.id);
if (featureIds.length < 3) throw new Error(`Deployed metadata exposes too few public features: ${featureIds.length}`);

console.log(JSON.stringify({
  baseUrl,
  deployedCommit: metadata.deployed_commit,
  featureCount: featureIds.length,
  checks: [...results.keys()],
}));
