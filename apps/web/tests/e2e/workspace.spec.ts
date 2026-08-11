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

  await page.getByLabel("Amma").check();
  await page.getByPlaceholder(DICTS.en.dailyGuide.groupNamePlaceholder).fill("Weekend family");
  await page.getByRole("button", { name: DICTS.en.dailyGuide.saveGroup }).click();
  await expect(page.getByTestId("planner-group-picker")).toContainText("Weekend family");
  await page.getByLabel("Amma").uncheck();
  await page.getByTestId("planner-group-picker").getByRole("button", { name: /Weekend family/ }).click();
  await expect(page.getByLabel("Amma")).toBeChecked();

  await page.getByLabel(DICTS.en.dailyGuide.planTitle).fill("Temple visit");
  await page.getByLabel(DICTS.en.dailyGuide.planStart).fill("09:30");
  await page.getByRole("button", { name: DICTS.en.dailyGuide.addPlan }).click();
  await expect(page.getByTestId("planner-agenda")).toContainText("Temple visit");
  await expect(page.getByTestId("planner-agenda")).toContainText("For: Amma");
  await expect(page.getByTestId("planner-week")).toContainText("Temple visit");
  const plannerDate = page.getByLabel(DICTS.en.ui.pickDate);
  const today = await plannerDate.inputValue();
  const dateControls = page.getByTestId("planner-date-controls");
  await dateControls.getByRole("button", { name: DICTS.en.ui.nextDay }).click();
  await expect(plannerDate).not.toHaveValue(today);
  await dateControls.getByRole("button", { name: DICTS.en.ui.backToToday }).click();
  await expect(plannerDate).toHaveValue(today);
  await page.getByRole("button", { name: DICTS.en.dailyGuide.editPlan }).click();
  await expect(page.getByLabel(DICTS.en.dailyGuide.planTitle)).toHaveValue("Temple visit");
  await page.getByLabel(DICTS.en.dailyGuide.planTitle).fill("Temple visit revised");
  await page.getByRole("button", { name: DICTS.en.dailyGuide.savePlan }).click();
  await expect(page.getByTestId("planner-agenda")).toContainText("Temple visit revised");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: DICTS.en.dailyGuide.exportAgenda }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^daily-agenda-\d{4}-\d{2}-\d{2}\.ics$/);
  const downloadStream = await download.createReadStream();
  let downloadedCalendar = "";
  if (downloadStream) for await (const chunk of downloadStream) downloadedCalendar += chunk.toString();
  expect(downloadedCalendar).toContain("SUMMARY:Temple visit revised");
  const weekDownloadPromise = page.waitForEvent("download");
  await page.getByTestId("planner-week").getByRole("button", { name: DICTS.en.dailyGuide.plannerWeekExport }).click();
  const weekDownload = await weekDownloadPromise;
  expect(weekDownload.suggestedFilename()).toMatch(/^weekly-agenda-\d{4}-\d{2}-\d{2}\.ics$/);
  await page.getByRole("button", { name: DICTS.en.dailyGuide.copyPlan }).click();
  await expect(page.getByRole("status")).toContainText("Copied to");
  await dateControls.getByRole("button", { name: DICTS.en.ui.nextDay }).click();
  await expect(page.getByTestId("planner-agenda")).toContainText("Temple visit revised");
  const selectedDate = await page.getByLabel(DICTS.en.ui.pickDate).inputValue();
  await page.getByTestId("planner-week").getByRole("button").nth(2).click();
  await expect(page.getByLabel(DICTS.en.ui.pickDate)).not.toHaveValue(selectedDate);

  const vault = await page.evaluate(() => window.localStorage.getItem("ff_private_vault_v1"));
  expect(vault).toContain("ciphertext");
  expect(vault).not.toContain("Temple visit");
  expect(vault).not.toContain("Weekend family");
});

test("roadmap feedback remains a local draft while votes persist on this device", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => window.sessionStorage.setItem("copied-roadmap-feedback", text) },
    });
  });
  await page.goto("/en/roadmap");
  const roadmap = page.getByTestId("roadmap-items");
  await expect(roadmap).toContainText(DICTS.en.roadmap.planner);
  await expect(roadmap.getByRole("heading", { name: DICTS.en.roadmap.released }).locator("..").locator("..")).toContainText(DICTS.en.roadmap.week);
  await expect(page.getByTestId("roadmap-safety-notice")).toContainText(DICTS.en.roadmap.safetyTitle);
  await page.getByLabel(DICTS.en.roadmap.search).fill("calendar");
  await expect(roadmap).toContainText(DICTS.en.roadmap.calendar);
  await expect(roadmap).not.toContainText(DICTS.en.roadmap.planner);
  await page.getByLabel(DICTS.en.roadmap.search).fill("");
  await roadmap.getByRole("article").filter({ hasText: DICTS.en.roadmap.week }).getByRole("button", { name: new RegExp(DICTS.en.roadmap.draftForItem.replace("{item}", "")) }).click();
  const feedbackFor = page.getByLabel(DICTS.en.roadmap.feedbackFor);
  await expect(feedbackFor).toHaveValue("week");
  await expect(feedbackFor).toBeFocused();
  const vote = roadmap.getByRole("button", { name: new RegExp(`${DICTS.en.roadmap.vote}.*0`) }).first();
  await vote.click();
  await expect(roadmap.getByRole("button", { name: new RegExp(`${DICTS.en.roadmap.voted}.*1`) }).first()).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: DICTS.en.roadmap.clearVotes }).click();
  await expect(page.getByRole("status")).toContainText(DICTS.en.roadmap.votesCleared);
  await expect(roadmap.getByRole("button", { name: new RegExp(`${DICTS.en.roadmap.vote}.*0`) }).first()).toHaveAttribute("aria-pressed", "false");
  const privacyFilter = page.getByRole("button", { name: DICTS.en.roadmap.categoryPrivacy, exact: false }).first();
  await privacyFilter.click();
  await expect(privacyFilter).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel(DICTS.en.roadmap.feedbackLabel).fill("Please add a compact week view.");
  await feedbackFor.selectOption("planner");
  await page.getByLabel(DICTS.en.roadmap.feedbackLabel).fill("Keep planner feedback private.");
  await feedbackFor.selectOption("week");
  await expect(page.getByLabel(DICTS.en.roadmap.feedbackLabel)).toHaveValue("Please add a compact week view.");
  await page.getByRole("button", { name: DICTS.en.roadmap.copyFeedback }).click();
  await expect(page.getByText(DICTS.en.roadmap.copiedFeedback)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("copied-roadmap-feedback"))).toContain("Please add a compact week view.");
  const issue = page.getByTestId("roadmap-open-issue");
  await expect(issue).toHaveAttribute("href", /Please%20add%20a%20compact%20week%20view/);
  await page.getByLabel(DICTS.en.roadmap.feedbackLabel).fill("API key: do-not-share");
  await expect(page.getByTestId("roadmap-sensitive-feedback")).toContainText(DICTS.en.roadmap.sensitiveFeedbackWarning);
  await expect(issue).toHaveAttribute("aria-disabled", "true");
  await expect(issue).not.toHaveAttribute("href", /./);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("ff_roadmap_votes_v1"))).toBeNull();
});

test("keyboard command palette finds and opens privacy-aware tools", async ({ page }) => {
  await page.goto("/en");
  const trigger = page.getByRole("button", { name: DICTS.en.ui.commandPalette });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("dialog", { name: DICTS.en.ui.commandPalette })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: DICTS.en.ui.commandPalette })).toHaveCount(0);
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

  await trigger.focus();
  await page.keyboard.press("Control+K");
  const focusDialog = page.getByRole("dialog", { name: DICTS.en.ui.commandPalette });
  const focusSearch = focusDialog.getByLabel(DICTS.en.ui.commandPaletteSearch);
  await expect(focusSearch).toBeFocused();
  await expect(focusSearch).toHaveAttribute("aria-activedescendant", "command-palette-option-0");
  await nextSearch.press("ArrowDown");
  await expect(focusSearch).toHaveAttribute("aria-activedescendant", "command-palette-option-1");
  await page.keyboard.press("Shift+Tab");
  await expect(focusDialog.getByRole("option", { name: DICTS.en.nav.privacy })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(focusSearch).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
