import { expect, test, type Page } from "@playwright/test";

/**
 * ROADMAP v0.9 happy path: login -> расписание -> отмена -> студент видит отмену.
 *
 * 1. Admin logs in and creates a lesson (Вторник, слот №3, PHYS101, Лекция, ауд. 101,
 *    преподаватель-демо, группа ИВТ-21-1) via the /manager/lessons form.
 * 2. Teacher logs in and files a CANCEL change for that lesson (teacher is the demo
 *    user with a personal schedule; the /changes/create page lists lessons from
 *    /api/schedule/me, so an admin — who has no student/teacher profile — cannot
 *    file a CANCEL through the real UI).
 * 3. Admin approves the change on /changes.
 * 4. Student logs in and sees the lesson marked "Отмена" on /schedule.
 */

const LESSON_DOW = 2; // Вторник

/** Next UTC date matching `dow`, at least `minDaysAhead` days in the future (minCancelHours = 2). */
function nextDowDate(dow: number, minDaysAhead = 2): string {
  const d = new Date(Date.now() + minDaysAhead * 86400000);
  const isoDow = (x: Date) => (x.getUTCDay() === 0 ? 7 : x.getUTCDay());
  while (isoDow(d) !== dow) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Next dev streams Suspense boundaries: right after a navigation the streamed page
 * exists twice in the DOM (inline + the #S:0 temp container attached to <body>)
 * until hydration finishes, so strict locators transiently match 2 elements.
 * networkidle alone is not enough — hydration can lag behind it in dev.
 */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => !document.querySelector('div[id^="S:"]'),
    null,
    { timeout: 90_000 },
  );
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/schedule**", { timeout: 90_000 });
  await settle(page);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Выйти" }).click();
  await page.waitForURL("**/login**", { timeout: 90_000 });
  await settle(page);
}

async function selectOptionByLabel(page: Page, select: string, text: string) {
  const option = page.locator(`${select} option`, { hasText: text });
  const value = await option.getAttribute("value");
  expect(value, `option with text "${text}" in ${select}`).toBeTruthy();
  await page.locator(select).selectOption(value!);
}

test("happy path: admin creates lesson, teacher cancels, admin approves, student sees cancellation", async ({
  page,
}) => {
  const date = nextDowDate(LESSON_DOW);

  await test.step("admin logs in and creates the lesson", async () => {
    await login(page, "admin@example.com", "admin12345");
    await page.goto("/manager/lessons");
    await settle(page);

    // Active semester (E2E Осень 2026) is preselected.
    await expect(
      page.locator("select[name='semesterId'] option:checked").first(),
    ).toContainText("E2E");

    await page
      .locator("select[name='dayOfWeek']")
      .selectOption(String(LESSON_DOW));
    await selectOptionByLabel(page, "select[name='timeslotId']", "12:50");
    await selectOptionByLabel(page, "select[name='subjectId']", "PHYS101");
    await selectOptionByLabel(page, "select[name='lessonTypeId']", "Лекция");
    await selectOptionByLabel(page, "select[name='roomId']", "101");
    await selectOptionByLabel(
      page,
      "select[name='teacherIds']",
      "teacher@example.com",
    );
    await selectOptionByLabel(page, "select[name='groupIds']", "ИВТ-21-1");
    await page.locator("input[name='note']").fill("e2e happy path");
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    await page.waitForURL("**/manager/lessons**", { timeout: 90_000 });
    await settle(page);

    const row = page.getByRole("row").filter({ hasText: "PHYS101" });
    await expect(row).toBeVisible({ timeout: 90_000 });
    await expect(row).toContainText("ИВТ-21-1");
  });

  await test.step("teacher files a CANCEL change for the lesson", async () => {
    await logout(page);
    await login(page, "teacher@example.com", "teacher12345");
    await page.goto(`/changes/create?type=CANCEL&date=${date}`);
    await settle(page);

    await selectOptionByLabel(page, "select[name='lessonId']", "PHYS101");
    await page.locator("textarea[name='reason']").fill("e2e happy path отмена");
    await page.getByRole("button", { name: "Отправить" }).click();
    await page.waitForURL("**/changes?status=PENDING**", { timeout: 90_000 });
    await settle(page);

    const row = page.getByRole("row").filter({ hasText: "PHYS101" });
    await expect(row).toBeVisible({ timeout: 90_000 });
    await expect(row).toContainText("PENDING");
    await expect(row).toContainText("CANCEL");
  });

  await test.step("admin approves the change", async () => {
    await logout(page);
    await login(page, "admin@example.com", "admin12345");
    await page.goto("/changes?status=PENDING");
    await settle(page);

    const row = page.getByRole("row").filter({ hasText: "PHYS101" });
    await expect(row).toBeVisible({ timeout: 90_000 });
    await row.getByRole("button", { name: "Одобрить" }).click();
    await page.waitForURL("**/changes?status=PENDING**", { timeout: 90_000 });
    await settle(page);

    await page.goto("/changes?status=APPROVED");
    await settle(page);
    const approved = page.getByRole("row").filter({ hasText: "PHYS101" });
    await expect(approved).toBeVisible({ timeout: 90_000 });
    await expect(approved).toContainText("APPROVED");
    await expect(approved).toContainText("CANCEL");
  });

  await test.step("student sees the cancellation in the schedule", async () => {
    await logout(page);
    await login(page, "student@example.com", "student12345");
    await page.goto(`/schedule?date=${date}`);
    await settle(page);

    const cell = page.locator("td", { hasText: "PHYS101" });
    await expect(cell).toBeVisible({ timeout: 90_000 });
    await expect(cell.getByText("Отмена")).toBeVisible();
    await expect(cell.locator(".line-through")).toBeVisible();
  });
});
