import { test, expect } from "@playwright/test";

/**
 * Demo recording tests for Claude Code Web UI
 * These tests automatically record demo scenarios for documentation
 */

const DEMO_SCENARIOS = {
  basic: "basic",
  codeGeneration: "codeGeneration",
  debugging: "debugging",
  fileOperations: "fileOperations",
} as const;

// Get scenario and theme from environment variables
const scenario =
  (process.env.DEMO_SCENARIO as keyof typeof DEMO_SCENARIOS) ||
  "codeGeneration";
const theme = (process.env.DEMO_THEME as "light" | "dark" | "both") || "light";

test.describe("Demo Recording", () => {
  test.beforeEach(async ({ page }) => {
    // Set up video recording context
    await page.setViewportSize({ width: 1280, height: 720 });

    // Enable slower actions for better video recording
    await page.setDefaultTimeout(30000);
    await page.setDefaultNavigationTimeout(30000);

    // Pre-configure theme to avoid flashing
    if (theme === "dark") {
      await page.addInitScript(() => {
        // Set theme in localStorage before page loads
        localStorage.setItem("theme", "dark");
        // Add dark class to html element immediately
        document.documentElement.classList.add("dark");
      });
    }
  });

  test(`record ${scenario} demo`, async ({ page }) => {
    const actualTheme = theme === "both" ? "light" : theme; // Default to light for "both"
    const themeLabel = actualTheme !== "light" ? ` (${actualTheme})` : "";

    // Build URL with scenario and theme parameters
    const url = `/demo?scenario=${scenario}&theme=${actualTheme}`;

    // Navigate IMMEDIATELY to minimize white frame
    const navigationPromise = page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log(`🎬 Recording ${scenario} demo${themeLabel}...`);

    // Wait for navigation to complete
    await navigationPromise;

    // Verify demo page loaded
    await expect(page.locator('[data-demo-active="true"]')).toBeVisible();
    await expect(page.locator("h1")).toContainText("Claude Code Web UI");

    console.log(`📝 Demo page loaded for scenario: ${scenario}${themeLabel}`);

    // Wait for demo to start (should auto-start)
    await page.waitForSelector("[data-demo-step]", { timeout: 10000 });

    // Quick theme verification and minimal wait
    if (actualTheme === "dark") {
      console.log("⏳ Verifying dark theme...");
      await page.waitForFunction(
        () => document.documentElement.classList.contains("dark"),
        { timeout: 5000 },
      );
      console.log("✅ Dark theme applied");
    }

    // Verify theme is applied correctly
    if (actualTheme === "dark") {
      await expect(page.locator("html")).toHaveClass(/dark/);
    } else {
      await expect(page.locator("html")).not.toHaveClass(/dark/);
    }

    // Minimal wait for visual stability
    console.log("⏳ Brief stabilization...");
    await page.waitForTimeout(1000);

    console.log("🎬 Recording demo content...");

    // Wait for demo completion with generous timeout
    console.log("⏳ Waiting for demo to complete...");

    try {
      await page.waitForSelector('[data-demo-completed="true"]', {
        timeout: 120000, // 2 minutes timeout
      });

      console.log("✅ Demo completed successfully");

      // Add a small buffer time at the end for clean recording
      await page.waitForTimeout(3000);
    } catch (error) {
      console.error("❌ Demo did not complete within timeout");

      // Capture current state for debugging
      const currentStep = await page.getAttribute(
        "[data-demo-step]",
        "data-demo-step",
      );
      const isCompleted = await page.getAttribute(
        "[data-demo-completed]",
        "data-demo-completed",
      );

      console.log(
        `Debug info - Current step: ${currentStep}, Completed: ${isCompleted}`,
      );

      // Take a screenshot for debugging
      await page.screenshot({
        path: `demo-timeout-${scenario}-${Date.now()}.png`,
        fullPage: true,
      });

      throw error;
    }

    // Verify final state
    const finalStep = await page.getAttribute(
      "[data-demo-step]",
      "data-demo-step",
    );
    const isCompleted = await page.getAttribute(
      "[data-demo-completed]",
      "data-demo-completed",
    );

    console.log(
      `🎯 Final state - Step: ${finalStep}, Completed: ${isCompleted}`,
    );

    // Assert demo completed successfully
    await expect(page.locator('[data-demo-completed="true"]')).toBeVisible();
  });

  // Additional test for specific scenarios with custom behavior
  if (scenario === "codeGeneration") {
    test("record codeGeneration demo with permissions", async ({ page }) => {
      const actualTheme = theme === "both" ? "light" : theme;
      console.log(
        "🎬 Starting codeGeneration demo with permission handling...",
      );

      const testUrl = `/demo?scenario=codeGeneration&theme=${actualTheme}`;
      await page.goto(testUrl, {
        waitUntil: "networkidle",
      });

      // Wait for permission dialogs and verify they auto-dismiss
      await page.waitForSelector('[data-demo-active="true"]');

      // Monitor for permission dialogs (they should auto-dismiss in demo)
      page.on("dialog", async (dialog) => {
        console.log(`📋 Permission dialog appeared: ${dialog.message()}`);
        await dialog.accept();
      });

      // Wait for completion
      await page.waitForSelector('[data-demo-completed="true"]', {
        timeout: 120000,
      });

      // Extra wait for permission interactions
      await page.waitForTimeout(2000);

      console.log("✅ CodeGeneration demo with permissions completed");
    });
  }
});

// Helper test for validating demo page functionality
test.describe("Demo Page Validation", () => {
  test("demo page loads correctly", async ({ page }) => {
    await page.goto("/demo", { waitUntil: "networkidle" });

    // Verify essential elements
    await expect(page.locator("h1")).toContainText("Claude Code Web UI");
    await expect(page.locator('[data-demo-active="true"]')).toBeVisible();

    // Verify theme toggle works
    const themeToggle = page.locator('button[aria-label*="theme"]');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);
    }

    console.log("✅ Demo page validation passed");
  });

  test("demo scenarios are accessible", async ({ page }) => {
    for (const [key, value] of Object.entries(DEMO_SCENARIOS)) {
      await page.goto(`/demo?scenario=${value}`, { waitUntil: "networkidle" });

      await expect(page.locator('[data-demo-active="true"]')).toBeVisible();
      await expect(page.locator(`[data-demo-step]`)).toBeVisible({
        timeout: 10000,
      });

      console.log(`✅ Scenario ${key} (${value}) loads correctly`);
    }
  });
});
