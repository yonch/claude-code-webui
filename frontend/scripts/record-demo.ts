#!/usr/bin/env node

import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, copyFileSync, unlinkSync } from "fs";
import { join } from "path";
import {
  DEMO_SCENARIOS,
  type DemoScenario,
  type Theme,
  type RecordingOptions,
} from "./demo-constants";

/**
 * Demo recording script using Playwright's native video recording
 * Creates context dynamically to control recording timing
 */

function createOutputDir(): string {
  const outputDir = join(process.cwd(), "demo-recordings");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }
  return outputDir;
}

function createVideoFilename(scenario: DemoScenario, theme: Theme): string {
  const themeLabel = theme !== "light" ? `-${theme}` : "";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${scenario}${themeLabel}-${timestamp}.webm`;
}

async function recordDemoVideo(options: RecordingOptions): Promise<void> {
  const { scenario, theme } = options;
  const themeLabel = theme !== "light" ? ` (${theme})` : "";
  console.log(`🎬 Recording demo scenario: ${scenario}${themeLabel}`);

  const browser = await chromium.launch({
    headless: !!process.env.CI, // Use headless mode in CI environment
    args: [
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
  });

  // Setup phase - no recording context
  const setupContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  let page = await setupContext.newPage();

  try {
    // Setup phase (not recorded)
    console.log(`📱 Setting up demo page...`);
    
    // Pre-configure theme to avoid flashing
    if (theme === "dark") {
      await page.addInitScript(() => {
        localStorage.setItem("theme", "dark");
        document.documentElement.classList.add("dark");
      });
    }

    // Navigate to demo page
    const actualTheme = theme === "both" ? "light" : theme;
    const url = `http://localhost:3000/demo?scenario=${scenario}&theme=${actualTheme}`;
    
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for demo page to be ready
    await page.waitForSelector('[data-demo-active="true"]', { timeout: 10000 });
    await page.waitForSelector("h1");
    console.log(`📝 Demo page loaded for scenario: ${scenario}${themeLabel}`);

    // Verify theme is applied correctly
    if (actualTheme === "dark") {
      console.log("⏳ Verifying dark theme...");
      await page.waitForFunction(
        () => document.documentElement.classList.contains("dark"),
        { timeout: 5000 }
      );
      console.log("✅ Dark theme applied");
    }

    // Wait for demo to be ready to start (when demo step appears)
    await page.waitForSelector("[data-demo-step]", { timeout: 10000 });
    console.log("🎯 Demo is ready to start");

    // Additional stabilization wait
    await page.waitForTimeout(2000);

    // Close setup context and create recording context
    console.log("🔄 Switching to recording context...");
    await setupContext.close();

    // Create recording context with video enabled
    const outputDir = createOutputDir();
    const videoFilename = createVideoFilename(scenario, actualTheme);
    
    const recordingContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: outputDir,
        size: { width: 1280, height: 720 },
      },
    });

    page = await recordingContext.newPage();

    // Re-setup in recording context
    if (theme === "dark") {
      await page.addInitScript(() => {
        localStorage.setItem("theme", "dark");
        document.documentElement.classList.add("dark");
      });
    }

    console.log("🔴 Starting video recording...");
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for demo to be ready again
    await page.waitForSelector('[data-demo-active="true"]', { timeout: 10000 });
    await page.waitForSelector("[data-demo-step]", { timeout: 10000 });

    console.log("🎬 Recording demo content...");
    
    // Wait for demo completion
    console.log("⏳ Waiting for demo to complete...");
    try {
      await page.waitForSelector('[data-demo-completed="true"]', {
        timeout: 120000, // 2 minutes timeout
      });
      console.log("✅ Demo completed successfully");

      // Add a small buffer time at the end for clean recording
      await page.waitForTimeout(2000);
    } catch (error) {
      console.error("❌ Demo did not complete within timeout");
      
      // Capture current state for debugging
      const currentStep = await page.getAttribute("[data-demo-step]", "data-demo-step");
      const isCompleted = await page.getAttribute("[data-demo-completed]", "data-demo-completed");
      
      console.log(`Debug info - Current step: ${currentStep}, Completed: ${isCompleted}`);
      throw error;
    }

    // Close recording context to save video
    console.log("⏹️ Stopping video recording...");
    await recordingContext.close();
    
    // Find and rename the generated video file
    const videoFiles = readdirSync(outputDir).filter(f => f.endsWith('.webm'));
    if (videoFiles.length > 0) {
      const generatedVideoPath = join(outputDir, videoFiles[0]);
      const finalVideoPath = join(outputDir, videoFilename);
      
      if (existsSync(generatedVideoPath)) {
        copyFileSync(generatedVideoPath, finalVideoPath);
        // Remove the original file with generated name
        try {
          unlinkSync(generatedVideoPath);
        } catch {
          // Ignore deletion errors
        }
        console.log(`📹 Video saved: ${videoFilename}`);
      }
    }
    
    console.log(`✅ Successfully recorded ${scenario} demo${themeLabel}`);

  } catch (error) {
    console.error(`❌ Failed to record ${scenario} demo${themeLabel}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

function parseArguments(): RecordingOptions {
  const args = process.argv.slice(2);
  let scenario: DemoScenario = "codeGeneration";
  let theme: Theme = "light";

  if (args[0] && DEMO_SCENARIOS.includes(args[0] as DemoScenario)) {
    scenario = args[0] as DemoScenario;
  }

  const themeArg = args.find((arg) => arg.startsWith("--theme="));
  if (themeArg) {
    const themeValue = themeArg.split("=")[1] as Theme;
    if (["light", "dark", "both"].includes(themeValue)) {
      theme = themeValue;
    }
  }

  return { scenario, theme };
}

async function checkDependencies(): Promise<void> {
  try {
    const response = await fetch("http://localhost:3000");
    if (!response.ok) {
      throw new Error("Development server not responding");
    }
  } catch {
    console.error("❌ Development server is not running. Please start it first:");
    console.error("   npm run dev");
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArguments();

  console.log("🎥 Claude Code Web UI Demo Recorder");
  console.log("=====================================");

  await checkDependencies();

  try {
    const firstArg = args[0];

    if (firstArg === "all") {
      const themeLabel = options.theme !== "light" ? ` (${options.theme})` : "";
      console.log(
        `📝 Recording all ${DEMO_SCENARIOS.length} demo scenarios${themeLabel}...`,
      );

      if (options.theme === "both") {
        for (const scenario of DEMO_SCENARIOS) {
          await recordDemoVideo({ scenario, theme: "light" });
          await recordDemoVideo({ scenario, theme: "dark" });
        }
      } else {
        for (const scenario of DEMO_SCENARIOS) {
          await recordDemoVideo({ scenario, theme: options.theme });
        }
      }
    } else {
      if (options.theme === "both") {
        await recordDemoVideo({ scenario: options.scenario, theme: "light" });
        await recordDemoVideo({ scenario: options.scenario, theme: "dark" });
      } else {
        await recordDemoVideo(options);
      }
    }

    console.log("🎉 Demo recording completed successfully!");
    console.log(`📹 Videos saved to: ${createOutputDir()}`);
  } catch (error) {
    console.error(
      "❌ Demo recording failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/record-demo.ts")
) {
  main().catch(console.error);
}

export { recordDemoVideo };