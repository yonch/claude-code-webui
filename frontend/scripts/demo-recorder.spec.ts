import { test, expect } from "@playwright/test";
import { type DemoScenario, type Theme } from "./demo-constants";

/**
 * Demo recording tests for Claude Code Web UI
 * These tests automatically record demo scenarios for documentation
 */

// Get scenario and theme from environment variables
const scenario =
  (process.env.DEMO_SCENARIO as DemoScenario) || "codeGeneration";
const theme = (process.env.DEMO_THEME as Theme) || "light";

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
});
