import { expect, test } from "@playwright/test";

const STUDENT_EMAIL = "student@bookflow.local";
const STUDENT_PASSWORD = "Password123!";

async function loginAsStudent(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(STUDENT_EMAIL);
  await page.getByTestId("login-password").fill(STUDENT_PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/student/, { timeout: 60_000 });
}

test.describe("Full reader controls", () => {
  test("PDF, AI, themes, bookmarks, notes, quiz all work", async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsStudent(page);

    await page.goto("/student/library");
    await page
      .getByRole("link", { name: /Open PDF reader|Open reader/i })
      .first()
      .click();
    await page.waitForURL(/\/reader\//);

    // PDF present
    await expect(page.getByTestId("pdf-viewer")).toBeVisible();
    await expect(page.getByTestId("pdf-frame")).toBeVisible();
    await expect(page.getByTestId("reader-ai-panel").first()).toBeVisible();

    // Theme buttons
    await page.getByRole("button", { name: "Sepia theme" }).click();
    await page.getByRole("button", { name: "Dark theme" }).click();
    await page.getByRole("button", { name: "Light theme" }).click();

    // Font size
    await page.getByRole("button", { name: "Increase font size" }).click();
    await page.getByRole("button", { name: "Decrease font size" }).click();

    // AI tutor: teach whole PDF + ask
    const ai = page.getByTestId("reader-ai-panel").first();
    await ai.getByTestId("ai-teach-book").click();
    await expect(ai.getByTestId("ai-tutor-result")).toContainText(/Tutor mode|Lesson/i, {
      timeout: 20_000,
    });

    await ai.getByLabel(/Ask anything about this book/i).fill("What is adaptive learning?");
    await ai.getByRole("button", { name: "Ask tutor" }).click();
    await expect(ai.getByTestId("ai-tutor-result")).toBeVisible({
      timeout: 20_000,
    });

    await ai.getByRole("button", { name: /Flashcards/i }).click();
    await expect(ai.getByTestId("ai-tutor-result")).toContainText(/Card|Study flashcards/i, {
      timeout: 20_000,
    });

    // Switch to Activities
    await page.getByRole("button", { name: /Activities/i }).click();
    await expect(page.getByTestId("reader-chapter")).toBeVisible();

    // Bookmark
    await page.getByRole("button", { name: "Add bookmark" }).click();
    await expect(page.getByTestId("action-message")).toContainText(/Bookmark/i);

    // Highlights panel + add
    await page.getByRole("button", { name: "Show highlights panel" }).click();
    await page.getByLabel("Highlight text").fill("adaptive learning");
    await page.getByRole("button", { name: "Save highlight" }).click();
    await expect(page.getByTestId("action-message")).toContainText(/Highlight/i);

    // Notes panel + add
    await page.getByRole("button", { name: "Show notes panel" }).click();
    await page.getByLabel("New note").fill("My study note about pacing.");
    await page.getByRole("button", { name: "Save note" }).click(); // aria-label
    await expect(page.getByTestId("action-message")).toContainText(/Note/i);

    // Chapter navigation
    await page.getByRole("button", { name: "Next chapter" }).click();
    await page.getByRole("button", { name: "Previous chapter" }).click();

    // Quiz if chapter questions exist
    const mcq = page.getByLabel(/Personalize pacing and practice/i);
    if (await mcq.isVisible().catch(() => false)) {
      await mcq.check();
      const trueOpt = page.getByLabel(/^True$/i).first();
      if (await trueOpt.isVisible().catch(() => false)) {
        await trueOpt.check();
      }
      await page.getByTestId("quiz-submit").click();
      await expect(page.getByTestId("quiz-score")).toBeVisible({ timeout: 15_000 });
    }

    // Back to PDF
    await page.getByRole("button", { name: /Read PDF/i }).click();
    await expect(page.getByTestId("pdf-frame")).toBeVisible();
  });
});
