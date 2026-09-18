import { execFileSync } from "node:child_process";

const owner = (process.env.REPOSITORY_OWNER_LOGIN || process.env.GITHUB_REPOSITORY_OWNER || "NPFernando").toLowerCase();
const repository = process.env.GITHUB_REPOSITORY || "NPFernando/fernandofamily-astrology";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const openPulls = JSON.parse(gh(["pr", "list", "--repo", repository, "--state", "open", "--limit", "100", "--json", "number,title,author,isDraft,url,updatedAt,labels"]));
const dependencyPulls = openPulls.filter((pull) => {
  const login = pull.author?.login?.toLowerCase() || "";
  const title = pull.title?.toLowerCase() || "";
  return login === "dependabot[bot]" || login === "renovate[bot]" || title.startsWith("bump ") || title.startsWith("chore(deps)");
});

const rows = dependencyPulls.map((pull) => {
  const detail = JSON.parse(gh(["pr", "view", String(pull.number), "--repo", repository, "--json", "statusCheckRollup,mergeStateStatus"]));
  const checks = detail.statusCheckRollup || [];
  const failed = checks.some((check) => ["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"].includes(check.conclusion));
  const pending = checks.some((check) => check.status !== "COMPLETED");
  const checksState = failed ? "failing" : pending || checks.length === 0 ? "pending" : "passing";
  const authorLogin = pull.author?.login || "unknown";
  const ownerAuthored = authorLogin.toLowerCase() === owner;
  const recommendation = ownerAuthored && checksState === "passing" && !pull.isDraft ? "owner-merge-eligible" : "review-required";
  return {
    number: pull.number,
    title: pull.title,
    author: authorLogin,
    ownerAuthored,
    draft: pull.isDraft,
    checks: checksState,
    mergeState: detail.mergeStateStatus,
    recommendation,
    url: pull.url,
    updatedAt: pull.updatedAt,
  };
});

if (process.env.OUTPUT_JSON === "1") {
  console.log(JSON.stringify({ repository, owner, generatedAt: new Date().toISOString(), pullRequests: rows }, null, 2));
} else {
  console.log(`# Dependency PR triage (${repository})`);
  console.log(`Generated: ${new Date().toISOString()} · owner policy: @${owner}`);
  if (rows.length === 0) {
    console.log("\nNo open dependency pull requests found.");
  } else {
    console.log("\n| PR | Author | Checks | Merge state | Recommendation | Updated |\n|---:|---|---|---|---|---|");
    for (const row of rows) {
      console.log(`| [#${row.number}](${row.url}) | ${row.author} | ${row.checks} | ${row.mergeState || "unknown"} | ${row.recommendation} | ${row.updatedAt} |`);
    }
  }
}
