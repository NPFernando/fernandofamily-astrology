import { expect, test } from "@playwright/test";
import { DICTS } from "./helpers";

const PASSPHRASE = "correct horse battery staple";

async function createVault(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Protect private data" }).click();
  await page.getByLabel("Choose a vault passphrase").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Create vault" }).click();
  await expect(page.locator('[title="Private data vault unlocked for this tab"]')).toBeVisible();
}

test("daily planner keeps manual plans and family groups inside the encrypted vault", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("ff_saved_profiles", JSON.stringify([{
      id: "planner-amma", label: "Amma", bird: "peacock", nakshatra_index: null, paksha: null, moon_rashi_index: null, created_at: "2026-08-05T00:00:00.000Z",
    }]));
  });
  await page.goto("/en/daily-guide/planner");
  await expect(page.getByTestId("planner-locked")).toBeVisible();
  await createVault(page);

  await page.getByLabel(DICTS.en.dailyGuide.planTitle).fill("Temple visit");
  await page.getByLabel(DICTS.en.dailyGuide.planStart).fill("09:30");
  await page.getByRole("button", { name: DICTS.en.dailyGuide.addPlan }).click();
  await expect(page.getByTestId("planner-agenda")).toContainText("Temple visit");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: DICTS.en.dailyGuide.exportAgenda }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^daily-agenda-\d{4}-\d{2}-\d{2}\.ics$/);

  await page.getByLabel("Amma").check();
  await page.getByPlaceholder(DICTS.en.dailyGuide.groupNamePlaceholder).fill("Weekend family");
  await page.getByRole("button", { name: DICTS.en.dailyGuide.saveGroup }).click();
  await expect(page.getByText("Weekend family", { exact: false })).toBeVisible();

  const vault = await page.evaluate(() => window.localStorage.getItem("ff_private_vault_v1"));
  expect(vault).toContain("ciphertext");
  expect(vault).not.toContain("Temple visit");
  expect(vault).not.toContain("Weekend family");
});

test("roadmap feedback remains a local draft while votes persist on this device", async ({ page }) => {
  await page.goto("/en/roadmap");
  const roadmap = page.getByTestId("roadmap-items");
  await expect(roadmap).toContainText(DICTS.en.roadmap.planner);
  await expect(page.getByTestId("roadmap-safety-notice")).toContainText(DICTS.en.roadmap.safetyTitle);
  await page.getByLabel(DICTS.en.roadmap.search).fill("calendar");
  await expect(roadmap).toContainText(DICTS.en.roadmap.calendar);
  await expect(roadmap).not.toContainText(DICTS.en.roadmap.planner);
  await page.getByLabel(DICTS.en.roadmap.search).fill("");
  await roadmap.getByRole("button", { name: new RegExp(`${DICTS.en.roadmap.vote}.*0`) }).first().click();
  await expect(roadmap.getByRole("button", { name: new RegExp(`${DICTS.en.roadmap.vote}.*1`) }).first()).toBeVisible();

  await page.getByLabel(DICTS.en.roadmap.feedbackLabel).fill("Please add a compact week view.");
  const issue = page.getByRole("link", { name: DICTS.en.roadmap.openIssue });
  await expect(issue).toHaveAttribute("href", /Please%20add%20a%20compact%20week%20view/);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("ff_roadmap_votes_v1"))).toContain("1");
});

test("keyboard command palette finds and opens privacy-aware tools", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("button", { name: DICTS.en.ui.commandPalette })).toBeVisible();
  await page.keyboard.press("Control+K");
  const dialog = page.getByRole("dialog", { name: DICTS.en.ui.commandPalette });
  await expect(dialog).toBeVisible();
  const search = dialog.getByLabel(DICTS.en.ui.commandPaletteSearch);
  await search.fill("Roadmap");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/en\/roadmap$/);

  await page.keyboard.press("Control+K");
  const nextSearch = page.getByRole("dialog", { name: DICTS.en.ui.commandPalette }).getByLabel(DICTS.en.ui.commandPaletteSearch);
  await nextSearch.press("ArrowDown");
  await nextSearch.press("Enter");
  await expect(page).toHaveURL(/\/en\/pancha-pakshi$/);
});
