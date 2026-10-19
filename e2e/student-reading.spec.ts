import { expect, test } from "@playwright/test";

const STUDENT_EMAIL = "student@bookflow.local";
const STUDENT_PASSWORD = "Password123!";

test.describe("Student reading flow", () => {
  test("login, open book, read chapter, complete quiz", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/login");

    await page.getByTestId("login-email").fill(STUDENT_EMAIL);
    await page.getByTestId("login-password").fill(STUDENT_PASSWORD);
    await page.getByTestId("login-submit").click();

    await page.waitForURL(/\/student/, { timeout: 60_000 });

    await page.goto("/student/library");
    const bookCard = page.getByTestId("library-book-card").first();
    if (await bookCard.isVisible().catch(() => false)) {
      await bookCard.click();
    } else {
      await page
        .getByRole("link", { name: /Open PDF reader|Open reader/i })
        .first()
        .click();
    }

    await page.waitForURL(/\/reader\//, { timeout: 30_000 });

    // PDF should be open in-app with AI panel available
    await expect(page.getByTestId("pdf-viewer")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("pdf-frame")).toBeVisible();
    await expect(page.getByTestId("reader-ai-panel").first()).toBeVisible();

    // Switch to chapter activities for quiz
    const activities = page.getByRole("button", { name: /Activities/i });
    if (await activities.isVisible()) {
      await activities.click();
    }

    const chapter = page.getByTestId("reader-chapter");
    await expect(chapter).toBeVisible();

    await expect(page.getByTestId("reading-progress")).toBeVisible();

    const mcqCorrect = page
      .getByLabel(/Personalize pacing and practice/i)
      .first();
    if (await mcqCorrect.isVisible()) {
      await mcqCorrect.check();
    }

    const trueOption = page.getByLabel(/^True$/i).first();
    if (await trueOption.isVisible()) {
      await trueOption.check();
    }

    const submit = page.getByTestId("quiz-submit");
    if (await submit.isVisible()) {
      await submit.click();
      await expect(page.getByTestId("quiz-score")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("quiz-score")).toContainText(/Score:/);
    }
  });
});
